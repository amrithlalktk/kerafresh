import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { formatCents, formatBillNumber } from "@/lib/money";
import { formatDate } from "@/lib/date";
import {
  getAvailableAdvanceForPurchasesMap,
  getAvailableAdvanceForSalesMap,
  getPartyBalanceMap,
} from "@/lib/balances";

// A deliberately simple, rule-based assistant — no external API, no LLM.
// It pattern-matches the message into one of a few intents (a specific
// bill, a specific party, or general help) and answers from the app's own
// data. Good enough for "what's Ravi Traders' balance" / "purchase #2",
// not meant to hold a real conversation.

const HELP_TEXT = `I can help with a few things:

• A party's details — try "Ravi Traders" or "details for Ravi Traders"
• A bill's details — try "sale #3" or "purchase #2"
• What this app does — try "what is this app" or "features"

I only know what's already in Kerafresh — I can't answer anything else.`;

const ABOUT_TEXT = `Kerafresh is a day-to-day billing, inventory, and accounts app. It covers:

• Parties — customers/suppliers with running balances and advance credit
• Items — product catalog with live stock levels
• Sale & Purchase — quick entry or advanced entry (multiple items, tax, charges)
• Payments — a combined ledger of every sale/purchase/advance payment
• Expenses — tracked by category
• Reports — Day Book, Sales & Purchases, Profit & Loss, Bill Wise Profit, Expenses, exportable as CSV/PDF
• Notes — a free-form spreadsheet for anything else
• Import — bring in past sales/purchases in bulk from a spreadsheet

Ask me about a specific party or bill and I'll look it up for you.`;

function matchBillQuery(message: string) {
  const match = message.match(/\b(sale|purchase|bill)\s*#?\s*0*(\d+)\b/i);
  if (!match) return null;
  return { kind: match[1].toLowerCase(), billNumber: Number(match[2]) };
}

function isHelpQuery(message: string) {
  return /\b(help|what can you do|commands?)\b/i.test(message);
}

function isAboutQuery(message: string) {
  return /\b(what is this app|about (the )?app|features|what does (this|kerafresh) do)\b/i.test(message);
}

// Strips common lookup phrasing so "details for Ravi Traders" / "balance of
// Ravi Traders" / "who is Ravi Traders" all reduce to the same candidate
// name to search for.
function extractPartyName(message: string) {
  return message
    .replace(/\b(details?|balance|info|information)\s+(for|of|about)\b/gi, "")
    .replace(/\b(show me|tell me about|who is|what is)\b/gi, "")
    .replace(/\bparty\b/gi, "")
    .replace(/[?.!]/g, "")
    .trim();
}

async function describeBill(kind: string, billNumber: number) {
  const tryTypes = kind === "bill" ? (["sale", "purchase"] as const) : ([kind] as const);
  const found: string[] = [];

  for (const type of tryTypes) {
    const record =
      type === "sale"
        ? await db.sale.findUnique({
            where: { billNumber },
            include: { party: { select: { name: true } }, items: { include: { item: true } } },
          })
        : await db.purchase.findUnique({
            where: { billNumber },
            include: { party: { select: { name: true } }, items: { include: { item: true } } },
          });
    if (!record) continue;

    const label = type === "sale" ? "Sale" : "Purchase";
    const itemLines = record.items
      .map((l) => `  - ${l.item.name} — ${l.quantity} × ${formatCents(l.priceCents)}`)
      .join("\n");
    found.push(
      `**${label} #${formatBillNumber(record.billNumber)}** — ${formatDate(record.date)}\n` +
        `Party: ${record.party?.name ?? (type === "sale" ? "Cash sale" : "No party")}\n` +
        `Items:\n${itemLines}\n` +
        `Total: ${formatCents(record.totalCents)}\n` +
        `Paid: ${formatCents(record.paidCents)}\n` +
        `Balance: ${formatCents(record.totalCents - record.paidCents)}`
    );
  }

  if (found.length === 0) {
    return `I couldn't find a ${kind === "bill" ? "sale or purchase" : kind} numbered ${formatBillNumber(billNumber)}.`;
  }
  return found.join("\n\n");
}

async function describeParty(name: string) {
  if (!name) return null;
  const matches = await db.party.findMany({
    where: { name: { contains: name, mode: "insensitive" } },
    orderBy: { name: "asc" },
  });
  if (matches.length === 0) return null;
  if (matches.length > 1) {
    return `I found more than one match: ${matches.map((p) => p.name).join(", ")}. Which one did you mean?`;
  }

  const party = matches[0];
  const [dueByParty, availableAdvanceByParty, availableAdvanceForPurchaseByParty] = await Promise.all([
    getPartyBalanceMap(),
    getAvailableAdvanceForSalesMap(),
    getAvailableAdvanceForPurchasesMap(),
  ]);
  const balanceCents = party.openingBalanceCents + (dueByParty.get(party.id) ?? 0);
  const advanceForSale = availableAdvanceByParty.get(party.id) ?? 0;
  const advanceForPurchase = availableAdvanceForPurchaseByParty.get(party.id) ?? 0;

  const lines = [
    `**${party.name}** (${party.type.charAt(0) + party.type.slice(1).toLowerCase()})`,
    party.phone ? `Phone: ${party.phone}` : null,
    party.address ? `Address: ${party.address}` : null,
    party.gstNumber ? `GSTIN: ${party.gstNumber}` : null,
    balanceCents === 0
      ? "Balance: settled"
      : `Balance: ${balanceCents > 0 ? "receive" : "pay"} ${formatCents(Math.abs(balanceCents))}`,
    advanceForSale > 0 ? `Advance available: ${formatCents(advanceForSale)} (for their next sale)` : null,
    advanceForPurchase > 0
      ? `Advance available: ${formatCents(advanceForPurchase)} (for their next purchase)`
      : null,
  ].filter(Boolean);

  return lines.join("\n");
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return NextResponse.json({ reply: HELP_TEXT });

  const billQuery = matchBillQuery(message);
  if (billQuery) {
    return NextResponse.json({ reply: await describeBill(billQuery.kind, billQuery.billNumber) });
  }

  if (isAboutQuery(message)) {
    return NextResponse.json({ reply: ABOUT_TEXT });
  }

  if (isHelpQuery(message)) {
    return NextResponse.json({ reply: HELP_TEXT });
  }

  const partyName = extractPartyName(message);
  const partyReply = await describeParty(partyName);
  if (partyReply) {
    return NextResponse.json({ reply: partyReply });
  }

  return NextResponse.json({
    reply: `I couldn't find a party matching "${message}", and it didn't look like a bill lookup either.\n\n${HELP_TEXT}`,
  });
}
