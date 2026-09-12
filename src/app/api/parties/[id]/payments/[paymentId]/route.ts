import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isAdminRole } from "@/lib/types";
import { partyPaymentSchema } from "@/lib/validation";
import { toCents } from "@/lib/money";
import {
  sweepAdvanceIntoOutstandingPurchases,
  sweepAdvanceIntoOutstandingSales,
} from "@/lib/balances";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { paymentId } = await params;
  const body = await request.json();
  const parsed = partyPaymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { date, direction, amount, paymentMethod, notes } = parsed.data;

  try {
    const payment = await db.$transaction(async (tx) => {
      const updated = await tx.partyPayment.update({
        where: { id: paymentId },
        data: {
          date: new Date(date),
          direction,
          amountCents: toCents(amount),
          paymentMethod,
          notes: notes || null,
        },
      });

      // Re-run in case the edit freed up more credit (or changed direction),
      // so it immediately reduces the party's other outstanding bills.
      if (direction === "RECEIVED") {
        await sweepAdvanceIntoOutstandingSales(tx, updated.partyId);
      } else {
        await sweepAdvanceIntoOutstandingPurchases(tx, updated.partyId);
      }

      return updated;
    });

    return NextResponse.json(payment);
  } catch (err) {
    console.error("Failed to update advance payment", err);
    return NextResponse.json(
      { error: "Could not save this change. Try logging out and back in, then retry." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminRole(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { paymentId } = await params;
  await db.partyPayment.delete({ where: { id: paymentId } });
  return NextResponse.json({ ok: true });
}
