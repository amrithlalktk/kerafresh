import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isAdminRole } from "@/lib/types";
import { paymentSchema } from "@/lib/validation";
import { toCents } from "@/lib/money";

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

  const sale = await db.$transaction(async (tx) => {
    await tx.salePayment.create({
      data: {
        saleId: id,
        date: new Date(date),
        amountCents: toCents(amount),
        paymentMethod,
        notes: notes || null,
      },
    });
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
