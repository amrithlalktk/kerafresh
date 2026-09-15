import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { purchaseSchema } from "@/lib/validation";
import { toCents } from "@/lib/money";
import { getAvailableAdvanceForPurchasesMap } from "@/lib/balances";
import type { Prisma } from "@prisma/client";

const PAGE_SIZE = 25;
const PURCHASE_INCLUDE = {
  party: { select: { name: true } },
  items: { include: { item: { select: { name: true, unit: true } } } },
  charges: true,
  payments: {
    orderBy: { date: "asc" },
    include: { excessPartyPayment: { select: { amountCents: true } } },
  },
  recordedBy: { select: { name: true } },
} satisfies Prisma.PurchaseInclude;

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const partyId = searchParams.get("partyId");
  const itemId = searchParams.get("itemId");
  const q = searchParams.get("q")?.trim();
  const sortBy = searchParams.get("sortBy") === "billNumber" ? "billNumber" : "date";
  const sortDir = searchParams.get("sortDir") === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  // Lets a party statement request everything in one call instead of
  // paging through — capped well above what a small business would ever
  // need in one view.
  const pageSize = Math.min(1000, Math.max(1, Number(searchParams.get("pageSize") ?? PAGE_SIZE)));

  const where: Prisma.PurchaseWhereInput = {};
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setUTCHours(23, 59, 59, 999);
      where.date.lte = end;
    }
  }
  if (partyId) where.partyId = partyId;
  if (itemId) where.items = { some: { itemId } };
  if (q) {
    where.OR = [
      { party: { name: { contains: q, mode: "insensitive" } } },
      { items: { some: { item: { name: { contains: q, mode: "insensitive" } } } } },
      { notes: { contains: q, mode: "insensitive" } },
    ];
  }

  const [purchases, total] = await Promise.all([
    db.purchase.findMany({
      where,
      include: PURCHASE_INCLUDE,
      orderBy:
        sortBy === "billNumber"
          ? [{ billNumber: sortDir }, { createdAt: "desc" }]
          : [{ date: sortDir }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.purchase.count({ where }),
  ]);

  return NextResponse.json({
    purchases,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = purchaseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { date, partyId, items, charges, paid, advanceAppliedCents, paymentMethod, notes } =
    parsed.data;

  if (advanceAppliedCents > 0) {
    if (!partyId) {
      return NextResponse.json(
        { error: "Advance credit requires a party" },
        { status: 400 }
      );
    }
    const availableByParty = await getAvailableAdvanceForPurchasesMap();
    if (advanceAppliedCents > (availableByParty.get(partyId) ?? 0)) {
      return NextResponse.json(
        { error: "That party doesn't have that much advance credit available" },
        { status: 400 }
      );
    }
  }

  const lineData = items.map((line) => {
    const priceCents = toCents(line.price);
    // Quantity is in KG and can be fractional (e.g. 1.5) — round to whole
    // cents since lineTotalCents is stored as an integer.
    const lineTotalCents = Math.round(priceCents * line.quantity);
    const taxCents = Math.round((lineTotalCents * line.taxPercent) / 100);
    return {
      itemId: line.itemId,
      quantity: line.quantity,
      priceCents,
      lineTotalCents,
      taxPercent: line.taxPercent,
      taxCents,
      ffaGrade: line.ffaGrade ?? null,
    };
  });
  const chargeData = charges.map((charge) => ({
    chargeTypeId: charge.chargeTypeId || null,
    label: charge.label,
    amountCents: toCents(charge.amount),
  }));
  const totalCents =
    lineData.reduce((sum, l) => sum + l.lineTotalCents + l.taxCents, 0) +
    chargeData.reduce((sum, c) => sum + c.amountCents, 0);

  const paidCents = toCents(paid);
  const cashPaidCents = Math.max(0, paidCents - advanceAppliedCents);
  const lastBill = await db.purchase.aggregate({ _max: { billNumber: true } });
  const billNumber = (lastBill._max.billNumber ?? 0) + 1;
  // Split "paid now" into an ADVANCE-sourced entry (already-given money, just
  // applied to this bill) and a CASH entry (new money) — mirrors sales/route.ts.
  const paymentData = [
    ...(advanceAppliedCents > 0
      ? [
          {
            date: new Date(date),
            amountCents: advanceAppliedCents,
            paymentMethod,
            source: "ADVANCE" as const,
            notes: "Settled from advance credit",
          },
        ]
      : []),
    ...(cashPaidCents > 0
      ? [{ date: new Date(date), amountCents: cashPaidCents, paymentMethod }]
      : []),
  ];
  const purchase = await db.purchase.create({
    data: {
      billNumber,
      date: new Date(date),
      partyId: partyId || null,
      totalCents,
      paidCents,
      paymentMethod,
      notes: notes || null,
      userId: session.userId,
      items: { create: lineData },
      charges: { create: chargeData },
      payments: paymentData.length > 0 ? { create: paymentData } : undefined,
    },
    include: PURCHASE_INCLUDE,
  });

  return NextResponse.json(purchase);
}
