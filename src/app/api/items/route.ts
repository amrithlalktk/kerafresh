import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { itemSchema } from "@/lib/validation";
import { toCents } from "@/lib/money";
import { getItemStockMap } from "@/lib/balances";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [items, stockDelta] = await Promise.all([
    db.item.findMany({ orderBy: { name: "asc" } }),
    getItemStockMap(),
  ]);

  return NextResponse.json(
    items.map((item) => ({
      ...item,
      currentStockQty: item.openingStockQty + (stockDelta.get(item.id) ?? 0),
    }))
  );
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  const item = await db.item.create({
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

  return NextResponse.json({ ...item, currentStockQty: item.openingStockQty });
}
