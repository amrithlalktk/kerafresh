import { db } from "@/lib/db";

// Party/item balances are always computed at read time from Sale/Purchase
// rows rather than stored, so they can never drift out of sync.

// SalePayments settled against a party's existing advance credit (source:
// "ADVANCE") rather than fresh cash — see PartyPayment and SalePayment.source.
// Grouped by party via the parent Sale, since SalePayment has no partyId of
// its own.
async function getAdvanceSourcedOnSalesMap() {
  const rows = await db.salePayment.findMany({
    where: { source: "ADVANCE" },
    select: { amountCents: true, sale: { select: { partyId: true } } },
  });
  const map = new Map<string, number>();
  for (const row of rows) {
    const partyId = row.sale.partyId;
    if (!partyId) continue;
    map.set(partyId, (map.get(partyId) ?? 0) + row.amountCents);
  }
  return map;
}

// Mirrors getAdvanceSourcedOnSalesMap but for the "we prepaid this supplier"
// pool (PartyPayment PAID) settled against Purchases instead.
async function getAdvanceSourcedOnPurchasesMap() {
  const rows = await db.purchasePayment.findMany({
    where: { source: "ADVANCE" },
    select: { amountCents: true, purchase: { select: { partyId: true } } },
  });
  const map = new Map<string, number>();
  for (const row of rows) {
    const partyId = row.purchase.partyId;
    if (!partyId) continue;
    map.set(partyId, (map.get(partyId) ?? 0) + row.amountCents);
  }
  return map;
}

export async function getPartyBalanceMap() {
  const [
    saleTotals,
    purchaseTotals,
    receivedTotals,
    paidTotals,
    advanceSourcedOnSales,
    advanceSourcedOnPurchases,
  ] = await Promise.all([
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
      // Advance payments outside of any Sale/Purchase (see PartyPayment) feed
      // into the same balance: receiving money from a party reduces what they
      // owe us, paying them money increases it (mirrors how Sale/Purchase
      // paidCents moves the balance below).
      db.partyPayment.groupBy({
        by: ["partyId"],
        where: { direction: "RECEIVED" },
        _sum: { amountCents: true },
      }),
      db.partyPayment.groupBy({
        by: ["partyId"],
        where: { direction: "PAID" },
        _sum: { amountCents: true },
      }),
      getAdvanceSourcedOnSalesMap(),
      getAdvanceSourcedOnPurchasesMap(),
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
  for (const row of receivedTotals) {
    dueByParty.set(
      row.partyId,
      (dueByParty.get(row.partyId) ?? 0) - (row._sum.amountCents ?? 0)
    );
  }
  for (const row of paidTotals) {
    dueByParty.set(
      row.partyId,
      (dueByParty.get(row.partyId) ?? 0) + (row._sum.amountCents ?? 0)
    );
  }
  // A Sale's paidCents already includes any ADVANCE-sourced payments (so the
  // bill itself shows as paid), which independently nudges the line above
  // toward positive. Add the same amount back here to cancel that out —
  // otherwise the advance would count as both "still available" and "used".
  for (const [partyId, amount] of advanceSourcedOnSales) {
    dueByParty.set(partyId, (dueByParty.get(partyId) ?? 0) + amount);
  }
  // Mirror image for Purchases: a Purchase's paidCents already includes any
  // ADVANCE-sourced payments, which independently nudges the line above
  // toward positive too (via paidTotals above) — subtract the same amount
  // back out here to cancel that double-count.
  for (const [partyId, amount] of advanceSourcedOnPurchases) {
    dueByParty.set(partyId, (dueByParty.get(partyId) ?? 0) - amount);
  }
  return dueByParty;
}

// How much of a party's RECEIVED advance is still unapplied — i.e. hasn't
// already been used to settle a Sale (see SalePayment.source) or paid back
// out. Used to offer "apply advance to this bill" when recording a new sale.
export async function getAvailableAdvanceForSalesMap() {
  const [receivedTotals, paidTotals, advanceSourcedOnSales] = await Promise.all([
    db.partyPayment.groupBy({
      by: ["partyId"],
      where: { direction: "RECEIVED" },
      _sum: { amountCents: true },
    }),
    db.partyPayment.groupBy({
      by: ["partyId"],
      where: { direction: "PAID" },
      _sum: { amountCents: true },
    }),
    getAdvanceSourcedOnSalesMap(),
  ]);

  const map = new Map<string, number>();
  for (const row of receivedTotals) {
    map.set(row.partyId, (map.get(row.partyId) ?? 0) + (row._sum.amountCents ?? 0));
  }
  for (const row of paidTotals) {
    map.set(row.partyId, (map.get(row.partyId) ?? 0) - (row._sum.amountCents ?? 0));
  }
  for (const [partyId, amount] of advanceSourcedOnSales) {
    map.set(partyId, (map.get(partyId) ?? 0) - amount);
  }
  for (const [partyId, amount] of map) {
    map.set(partyId, Math.max(0, amount));
  }
  return map;
}

// Mirror of getAvailableAdvanceForSalesMap for the other direction: how much
// of a party's PAID advance (money we already gave them, e.g. prepaying a
// supplier) is still unapplied — used to offer "apply advance to this bill"
// when recording a new purchase. A party's net advance position can only
// ever favor one direction at a time (this and getAvailableAdvanceForSalesMap
// are mirror images of the same RECEIVED/PAID totals), so at most one of the
// two returns a positive amount for any given party.
export async function getAvailableAdvanceForPurchasesMap() {
  const [receivedTotals, paidTotals, advanceSourcedOnPurchases] = await Promise.all([
    db.partyPayment.groupBy({
      by: ["partyId"],
      where: { direction: "RECEIVED" },
      _sum: { amountCents: true },
    }),
    db.partyPayment.groupBy({
      by: ["partyId"],
      where: { direction: "PAID" },
      _sum: { amountCents: true },
    }),
    getAdvanceSourcedOnPurchasesMap(),
  ]);

  const map = new Map<string, number>();
  for (const row of paidTotals) {
    map.set(row.partyId, (map.get(row.partyId) ?? 0) + (row._sum.amountCents ?? 0));
  }
  for (const row of receivedTotals) {
    map.set(row.partyId, (map.get(row.partyId) ?? 0) - (row._sum.amountCents ?? 0));
  }
  for (const [partyId, amount] of advanceSourcedOnPurchases) {
    map.set(partyId, (map.get(partyId) ?? 0) - amount);
  }
  for (const [partyId, amount] of map) {
    map.set(partyId, Math.max(0, amount));
  }
  return map;
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

// Items don't store a purchase price — it varies purchase to purchase — so
// this is the cost basis profit reports use instead: total value purchased
// divided by total quantity purchased, i.e. a running weighted average
// across every PurchaseItem recorded for that item to date.
export async function getItemAverageCostMap() {
  const rows = await db.purchaseItem.groupBy({
    by: ["itemId"],
    _sum: { quantity: true, lineTotalCents: true },
  });
  const map = new Map<string, number>();
  for (const row of rows) {
    const qty = row._sum.quantity ?? 0;
    const total = row._sum.lineTotalCents ?? 0;
    if (qty > 0) map.set(row.itemId, Math.round(total / qty));
  }
  return map;
}
