import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { partyPaymentSchema } from "@/lib/validation";
import { toCents } from "@/lib/money";

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
  const payment = await db.partyPayment.update({
    where: { id: paymentId },
    data: {
      date: new Date(date),
      direction,
      amountCents: toCents(amount),
      paymentMethod,
      notes: notes || null,
    },
  });

  return NextResponse.json(payment);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { paymentId } = await params;
  await db.partyPayment.delete({ where: { id: paymentId } });
  return NextResponse.json({ ok: true });
}
