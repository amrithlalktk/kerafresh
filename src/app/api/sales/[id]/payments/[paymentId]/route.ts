import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

async function canModify(userId: string, isAdmin: boolean, saleId: string) {
  if (isAdmin) return true;
  const sale = await db.sale.findUnique({ where: { id: saleId }, select: { userId: true } });
  return sale?.userId === userId;
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, paymentId } = await params;
  if (!(await canModify(session.userId, session.role === "ADMIN", id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sale = await db.$transaction(async (tx) => {
    await tx.salePayment.delete({ where: { id: paymentId } });
    const total = await tx.salePayment.aggregate({
      where: { saleId: id },
      _sum: { amountCents: true },
    });
    return tx.sale.update({
      where: { id },
      data: { paidCents: total._sum.amountCents ?? 0 },
      include: {
        party: { select: { name: true } },
        items: { include: { item: { select: { name: true, unit: true, purchasePriceCents: true } } } },
        charges: true,
        payments: { orderBy: { date: "asc" } },
        recordedBy: { select: { name: true } },
      },
    });
  });

  return NextResponse.json(sale);
}
