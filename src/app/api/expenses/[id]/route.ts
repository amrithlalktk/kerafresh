import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isAdminRole } from "@/lib/types";
import { expenseSchema } from "@/lib/validation";
import { toCents } from "@/lib/money";

async function canModify(userId: string, isAdmin: boolean, expenseId: string) {
  if (isAdmin) return true;
  const expense = await db.transaction.findUnique({
    where: { id: expenseId },
    select: { userId: true },
  });
  return expense?.userId === userId;
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
  const parsed = expenseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { date, description, amount, categoryId, paymentMethod, notes } = parsed.data;

  const expense = await db.transaction.update({
    where: { id },
    data: {
      date: new Date(date),
      description,
      amountCents: toCents(amount),
      categoryId,
      paymentMethod: paymentMethod || null,
      notes: notes || null,
    },
    include: { category: true, recordedBy: { select: { name: true } } },
  });

  return NextResponse.json(expense);
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

  await db.transaction.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
