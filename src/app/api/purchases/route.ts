import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { purchaseSchema } from "@/lib/validation";
import { toCents } from "@/lib/money";
import type { Prisma } from "@prisma/client";

const PAGE_SIZE = 25;
const PURCHASE_INCLUDE = {
  party: { select: { name: true } },
  items: { include: { item: { select: { name: true, unit: true } } } },
  charges: true,
  payments: { orderBy: { date: "asc" } },
  recordedBy: { select: { name: true } },
} satisfies Prisma.PurchaseInclude;

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const partyId = searchParams.get("partyId");
  const q = searchParams.get("q")?.trim();
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));

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
  if (q) {
    where.OR = [
      { party: { name: { contains: q } } },
      { items: { some: { item: { name: { contains: q } } } } },
      { notes: { contains: q } },
    ];
  }

  const [purchases, total] = await Promise.all([
    db.purchase.findMany({
      where,
      include: PURCHASE_INCLUDE,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.purchase.count({ where }),
  ]);

  return NextResponse.json({
    purchases,
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
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

  const { date, partyId, items, charges, paid, paymentMethod, notes } = parsed.data;
  const lineData = items.map((line) => {
    const priceCents = toCents(line.price);
    return {
      itemId: line.itemId,
      quantity: line.quantity,
      priceCents,
      lineTotalCents: priceCents * line.quantity,
    };
  });
  const chargeData = charges.map((charge) => ({
    chargeTypeId: charge.chargeTypeId || null,
    label: charge.label,
    amountCents: toCents(charge.amount),
  }));
  const totalCents =
    lineData.reduce((sum, l) => sum + l.lineTotalCents, 0) +
    chargeData.reduce((sum, c) => sum + c.amountCents, 0);

  const paidCents = toCents(paid);
  const purchase = await db.purchase.create({
    data: {
      date: new Date(date),
      partyId: partyId || null,
      totalCents,
      paidCents,
      paymentMethod,
      notes: notes || null,
      userId: session.userId,
      items: { create: lineData },
      charges: { create: chargeData },
      payments: paidCents > 0
        ? { create: [{ date: new Date(date), amountCents: paidCents, paymentMethod }] }
        : undefined,
    },
    include: PURCHASE_INCLUDE,
  });

  return NextResponse.json(purchase);
}
