import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { itemSchema } from "@/lib/validation";
import { toCents } from "@/lib/money";
import { getItemStockMap } from "@/lib/balances";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const parsed = itemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { name, unit, salePrice, purchasePrice, openingStockQty, lowStockThreshold, ffaGraded } =
    parsed.data;

  const item = await db.item.update({
    where: { id },
    data: {
      name,
      unit,
      salePriceCents: toCents(salePrice),
      purchasePriceCents: toCents(purchasePrice),
      openingStockQty,
      lowStockThreshold: lowStockThreshold ?? null,
      ffaGraded,
    },
  });

  const stockDelta = await getItemStockMap();
  return NextResponse.json({
    ...item,
    currentStockQty: item.openingStockQty + (stockDelta.get(item.id) ?? 0),
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const [saleItemCount, purchaseItemCount] = await Promise.all([
    db.saleItem.count({ where: { itemId: id } }),
    db.purchaseItem.count({ where: { itemId: id } }),
  ]);
  if (saleItemCount > 0 || purchaseItemCount > 0) {
    return NextResponse.json(
      { error: "Item is used in sales or purchases and can't be deleted" },
      { status: 409 }
    );
  }

  await db.item.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
