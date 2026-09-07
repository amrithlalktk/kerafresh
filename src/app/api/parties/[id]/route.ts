import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { partySchema } from "@/lib/validation";
import { toCents } from "@/lib/money";
import { getPartyBalanceMap } from "@/lib/balances";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const parsed = partySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { name, type, phone, email, address, gstNumber, notes, openingBalance } = parsed.data;
  const party = await db.party.update({
    where: { id },
    data: {
      name,
      type,
      phone: phone || null,
      email: email || null,
      address: address || null,
      gstNumber: gstNumber || null,
      notes: notes || null,
      openingBalanceCents: toCents(openingBalance),
    },
  });

  const dueByParty = await getPartyBalanceMap();
  return NextResponse.json({
    ...party,
    balanceCents: party.openingBalanceCents + (dueByParty.get(party.id) ?? 0),
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const [saleCount, purchaseCount] = await Promise.all([
    db.sale.count({ where: { partyId: id } }),
    db.purchase.count({ where: { partyId: id } }),
  ]);
  if (saleCount > 0 || purchaseCount > 0) {
    return NextResponse.json(
      { error: "Party has sales or purchases recorded and can't be deleted" },
      { status: 409 }
    );
  }

  await db.party.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
