import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isAdminRole } from "@/lib/types";
import { paymentSchema } from "@/lib/validation";
import { formatBillNumber, toCents } from "@/lib/money";
import { sweepAdvanceIntoOutstandingPurchases } from "@/lib/balances";

async function canModify(userId: string, isAdmin: boolean, purchaseId: string) {
  if (isAdmin) return true;
  const purchase = await db.purchase.findUnique({
    where: { id: purchaseId },
    select: { userId: true },
  });
  return purchase?.userId === userId;
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

  try {
    const purchase = await db.$transaction(async (tx) => {
      const existing = await tx.purchase.findUniqueOrThrow({
        where: { id },
        select: { billNumber: true, totalCents: true, paidCents: true, partyId: true },
      });
      const dueCents = Math.max(0, existing.totalCents - existing.paidCents);
      // Anything paid beyond what's actually due on this bill becomes advance
      // credit for the party instead of over-paying the bill itself, so it's
      // automatically available to settle their next purchase (see
      // getAvailableAdvanceForPurchasesMap) — only possible when there's a
      // party to attribute it to; a cash purchase with no party keeps the old
      // behavior.
      const billPortionCents = existing.partyId ? Math.min(amountCents, dueCents) : amountCents;
      const excessCents = amountCents - billPortionCents;

      let billPayment = null;
      if (billPortionCents > 0) {
        billPayment = await tx.purchasePayment.create({
          data: {
            purchaseId: id,
            date: new Date(date),
            amountCents: billPortionCents,
            paymentMethod,
            notes: notes || null,
          },
        });
      }
      if (excessCents > 0 && existing.partyId) {
        // Linked back to the bill payment that created it (when there is
        // one) so deleting that payment later cascades this credit away too,
        // instead of leaving it behind still applied to some other bill —
        // see PartyPayment.sourcePurchasePayment.
        await tx.partyPayment.create({
          data: {
            partyId: existing.partyId,
            date: new Date(date),
            direction: "PAID",
            amountCents: excessCents,
            paymentMethod,
            notes: `Excess payment on Purchase #${formatBillNumber(existing.billNumber)} — added as advance credit`,
            userId: session.userId,
            sourcePurchasePaymentId: billPayment?.id,
          },
        });
      }

      const total = await tx.purchasePayment.aggregate({
        where: { purchaseId: id },
        _sum: { amountCents: true },
      });
      await tx.purchase.update({
        where: { id },
        data: { paidCents: total._sum.amountCents ?? 0 },
      });

      // Any advance credit the party now has — the excess above, or credit
      // already sitting unapplied from before — immediately reduces their
      // OTHER outstanding purchases too, not just bills created from here on.
      if (existing.partyId) {
        await sweepAdvanceIntoOutstandingPurchases(tx, existing.partyId);
      }

      return tx.purchase.findUniqueOrThrow({
        where: { id },
        include: {
          party: { select: { name: true } },
          items: { include: { item: { select: { name: true, unit: true } } } },
          charges: true,
          payments: { orderBy: { date: "asc" } },
          recordedBy: { select: { name: true } },
        },
      });
    });

    return NextResponse.json(purchase);
  } catch (err) {
    console.error("Failed to record purchase payment", err);
    return NextResponse.json(
      { error: "Could not record this payment. Try logging out and back in, then retry." },
      { status: 500 }
    );
  }
}
