import { db } from "@/lib/db";

// Party/item balances are always computed at read time from Sale/Purchase
// rows rather than stored, so they can never drift out of sync.

export async function getPartyBalanceMap() {
  const [saleTotals, purchaseTotals] = await Promise.all([
    db.sale.groupBy({
      by: ["partyId"],
      where: { partyId: { not: null } },
      _sum: { totalCents: true, paidCents: true },
    }),
    db.purchase.groupBy({
      by: ["partyId"],
      where: { partyId: { not: null } },
      _sum: { totalCents: true, paidCents: true },
    }),
  ]);

  const dueByParty = new Map<string, number>();
  for (const row of saleTotals) {
    if (!row.partyId) continue;
    const due = (row._sum.totalCents ?? 0) - (row._sum.paidCents ?? 0);
    dueByParty.set(row.partyId, (dueByParty.get(row.partyId) ?? 0) + due);
  }
  for (const row of purchaseTotals) {
    if (!row.partyId) continue;
    const due = (row._sum.totalCents ?? 0) - (row._sum.paidCents ?? 0);
    dueByParty.set(row.partyId, (dueByParty.get(row.partyId) ?? 0) - due);
  }
  return dueByParty;
}

// Earliest unpaid Sale/Purchase date per party — used to flag a
// receivable/payable as overdue (outstanding for more than ~a month) on the
// dashboard. Prisma can't filter "totalCents > paidCents" in a `where`
// clause (that compares two columns), so this fetches the minimal fields
// and filters in JS — fine at small-business data volumes.
function oldestUnpaidFromRows(
  rows: { partyId: string | null; date: Date; totalCents: number; paidCents: number }[]
) {
  const oldestByParty = new Map<string, Date>();
  for (const row of rows) {
    if (!row.partyId || row.paidCents >= row.totalCents) continue;
    if (!oldestByParty.has(row.partyId)) oldestByParty.set(row.partyId, row.date);
  }
  return oldestByParty;
}

export async function getOldestUnpaidSaleDateByParty() {
  const rows = await db.sale.findMany({
    where: { partyId: { not: null } },
    select: { partyId: true, date: true, totalCents: true, paidCents: true },
    orderBy: { date: "asc" },
  });
  return oldestUnpaidFromRows(rows);
}

export async function getOldestUnpaidPurchaseDateByParty() {
  const rows = await db.purchase.findMany({
    where: { partyId: { not: null } },
    select: { partyId: true, date: true, totalCents: true, paidCents: true },
    orderBy: { date: "asc" },
  });
  return oldestUnpaidFromRows(rows);
}

export async function getItemStockMap() {
  const [saleQty, purchaseQty] = await Promise.all([
    db.saleItem.groupBy({ by: ["itemId"], _sum: { quantity: true } }),
    db.purchaseItem.groupBy({ by: ["itemId"], _sum: { quantity: true } }),
  ]);

  const deltaByItem = new Map<string, number>();
  for (const row of purchaseQty) {
    deltaByItem.set(row.itemId, (deltaByItem.get(row.itemId) ?? 0) + (row._sum.quantity ?? 0));
  }
  for (const row of saleQty) {
    deltaByItem.set(row.itemId, (deltaByItem.get(row.itemId) ?? 0) - (row._sum.quantity ?? 0));
  }
  return deltaByItem;
}
