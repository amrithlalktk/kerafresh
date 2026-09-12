import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isAdminRole } from "@/lib/types";
import { paymentSchema } from "@/lib/validation";
import { formatBillNumber, toCents } from "@/lib/money";

async function canModify(userId: string, isAdmin: boolean, saleId: string) {
  if (isAdmin) return true;
  const sale = await db.sale.findUnique({ where: { id: saleId }, select: { userId: true } });
  return sale?.userId === userId;
}

export async function POST(
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
  const parsed = paymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { date, amount, paymentMethod, notes } = parsed.data;
  const amountCents = toCents(amount);

  const sale = await db.$transaction(async (tx) => {
    const existing = await tx.sale.findUniqueOrThrow({
      where: { id },
      select: { billNumber: true, totalCents: true, paidCents: true, partyId: true },
    });
    const dueCents = Math.max(0, existing.totalCents - existing.paidCents);
    // Anything paid beyond what's actually due on this bill becomes advance
    // credit for the party instead of over-paying the bill itself, so it's
    // automatically available to settle their next sale (see
    // getAvailableAdvanceForSalesMap) — only possible when there's a party to
    // attribute it to; a cash sale with no party keeps the old behavior.
    const billPortionCents = existing.partyId ? Math.min(amountCents, dueCents) : amountCents;
    const excessCents = amountCents - billPortionCents;

    if (billPortionCents > 0) {
      await tx.salePayment.create({
        data: {
          saleId: id,
          date: new Date(date),
          amountCents: billPortionCents,
          paymentMethod,
          notes: notes || null,
        },
      });
    }
    if (excessCents > 0 && existing.partyId) {
      await tx.partyPayment.create({
        data: {
          partyId: existing.partyId,
          date: new Date(date),
          direction: "RECEIVED",
          amountCents: excessCents,
          paymentMethod,
          notes: `Excess payment on Sale #${formatBillNumber(existing.billNumber)} — added as advance credit`,
          userId: session.userId,
        },
      });
    }

    const total = await tx.salePayment.aggregate({
      where: { saleId: id },
      _sum: { amountCents: true },
    });
    return tx.sale.update({
      where: { id },
      data: { paidCents: total._sum.amountCents ?? 0 },
      include: {
        party: { select: { name: true } },
        items: { include: { item: { select: { name: true, unit: true } } } },
        charges: true,
        payments: { orderBy: { date: "asc" } },
        recordedBy: { select: { name: true } },
      },
    });
  });

  return NextResponse.json(sale);
}
