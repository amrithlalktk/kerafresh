import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isAdminRole } from "@/lib/types";
import { purchaseSchema } from "@/lib/validation";
import { toCents } from "@/lib/money";
import type { Prisma } from "@prisma/client";

const PURCHASE_INCLUDE = {
  party: { select: { name: true } },
  items: { include: { item: { select: { name: true, unit: true } } } },
  charges: true,
  payments: { orderBy: { date: "asc" } },
  recordedBy: { select: { name: true } },
} satisfies Prisma.PurchaseInclude;

async function canModify(userId: string, isAdmin: boolean, purchaseId: string) {
  if (isAdmin) return true;
  const purchase = await db.purchase.findUnique({
    where: { id: purchaseId },
    select: { userId: true },
  });
  return purchase?.userId === userId;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!(await canModify(session.userId, isAdminRole(session.role), id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = purchaseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  // paid/paymentMethod are intentionally not applied here — once a purchase
  // exists, its paidCents only changes via the payment-history endpoint
  // (POST /api/purchases/[id]/payments).
  const { date, partyId, items, charges, notes } = parsed.data;
  const lineData = items.map((line) => {
    const priceCents = toCents(line.price);
    const lineTotalCents = priceCents * line.quantity;
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

  const purchase = await db.$transaction(async (tx) => {
    await tx.purchaseItem.deleteMany({ where: { purchaseId: id } });
    await tx.purchaseCharge.deleteMany({ where: { purchaseId: id } });
    return tx.purchase.update({
      where: { id },
      data: {
        date: new Date(date),
        partyId: partyId || null,
        totalCents,
        notes: notes || null,
        items: { create: lineData },
        charges: { create: chargeData },
      },
      include: PURCHASE_INCLUDE,
    });
  });

  return NextResponse.json(purchase);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!(await canModify(session.userId, isAdminRole(session.role), id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.purchase.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
