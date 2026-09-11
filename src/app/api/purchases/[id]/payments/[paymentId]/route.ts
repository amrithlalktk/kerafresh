import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isAdminRole } from "@/lib/types";

async function canModify(userId: string, isAdmin: boolean, purchaseId: string) {
  if (isAdmin) return true;
  const purchase = await db.purchase.findUnique({
    where: { id: purchaseId },
    select: { userId: true },
  });
  return purchase?.userId === userId;
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, paymentId } = await params;
  if (!(await canModify(session.userId, isAdminRole(session.role), id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const purchase = await db.$transaction(async (tx) => {
    await tx.purchasePayment.delete({ where: { id: paymentId } });
    const total = await tx.purchasePayment.aggregate({
      where: { purchaseId: id },
      _sum: { amountCents: true },
    });
    return tx.purchase.update({
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

  return NextResponse.json(purchase);
}
