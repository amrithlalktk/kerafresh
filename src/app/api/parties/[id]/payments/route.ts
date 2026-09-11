import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { partyPaymentSchema } from "@/lib/validation";
import { toCents } from "@/lib/money";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const payments = await db.partyPayment.findMany({
    where: { partyId: id },
    orderBy: { date: "desc" },
  });
  return NextResponse.json(payments);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const parsed = partyPaymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { date, direction, amount, paymentMethod, notes } = parsed.data;
  const payment = await db.partyPayment.create({
    data: {
      partyId: id,
      date: new Date(date),
      direction,
      amountCents: toCents(amount),
      paymentMethod,
      notes: notes || null,
      userId: session.userId,
    },
  });

  return NextResponse.json(payment);
}
