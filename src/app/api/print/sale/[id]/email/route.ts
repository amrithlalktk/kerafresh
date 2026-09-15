import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatBillNumber } from "@/lib/money";
import { buildInvoicePdfBuffer } from "@/lib/invoicePdf";
import { sendMail } from "@/lib/mail";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { notifyEmails: true },
  });
  if (!user?.notifyEmails) {
    return NextResponse.json(
      { error: "Set your notification email first in Account settings." },
      { status: 400 }
    );
  }

  const { id } = await params;
  const sale = await db.sale.findUnique({
    where: { id },
    include: {
      party: true,
      items: { include: { item: { select: { name: true, unit: true } } } },
      charges: true,
    },
  });
  if (!sale) return NextResponse.json({ error: "Sale not found" }, { status: 404 });

  const pdf = buildInvoicePdfBuffer("SALE", sale, session.name);
  const filename = `sale_${formatBillNumber(sale.billNumber)}.pdf`;

  await sendMail({
    to: user.notifyEmails,
    subject: `Sale Invoice #${formatBillNumber(sale.billNumber)}`,
    text: `Attached: Sale Invoice #${formatBillNumber(sale.billNumber)}.`,
    attachments: [{ filename, content: pdf, contentType: "application/pdf" }],
  });

  return NextResponse.json({ ok: true, sentTo: user.notifyEmails });
}
