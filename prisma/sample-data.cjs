// One-off local sample-data seed — NOT run automatically (unlike seed.cjs).
// Run manually inside the app container when you want test data to click
// around with: `docker exec kerafresh-app-1 node prisma/sample-data.cjs`
const { PrismaClient } = require("@prisma/client");

const db = new PrismaClient();

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function main() {
  const [user1, user2] = await db.user.findMany({ orderBy: { createdAt: "asc" } });
  if (!user1) throw new Error("No users found — log in at least once before seeding sample data.");
  const chargeTypes = await db.chargeType.findMany();
  const lorryRent = chargeTypes.find((c) => c.name === "Lorry Rent");
  const packing = chargeTypes.find((c) => c.name === "Packing Charge");
  const categories = await db.category.findMany();
  const rentCategory = categories.find((c) => c.name === "Rent");
  const utilitiesCategory = categories.find((c) => c.name === "Utilities");

  console.log("Creating parties...");
  const [ravi, meera, copraSupplier, both] = await Promise.all([
    db.party.create({
      data: { name: "Ravi Traders", type: "CUSTOMER", phone: "9876543210", address: "Kochi, Kerala" },
    }),
    db.party.create({
      data: { name: "Meera Stores", type: "CUSTOMER", phone: "9876501234", address: "Alappuzha, Kerala" },
    }),
    db.party.create({
      data: {
        name: "Thottam Copra Suppliers",
        type: "SUPPLIER",
        phone: "9847012345",
        address: "Thrissur, Kerala",
        gstNumber: "32AAAAA0000A1Z5",
      },
    }),
    db.party.create({
      data: { name: "Kannan Agencies", type: "BOTH", phone: "9900011122", address: "Kozhikode, Kerala" },
    }),
  ]);

  console.log("Creating items...");
  const [coconutOil, copra, coconutShell, dryCoconut] = await Promise.all([
    db.item.create({ data: { name: "Coconut Oil", unit: "L", openingStockQty: 200, lowStockThreshold: 50 } }),
    db.item.create({ data: { name: "Copra", unit: "kg", openingStockQty: 1000, lowStockThreshold: 200 } }),
    db.item.create({ data: { name: "Coconut Shell", unit: "kg", openingStockQty: 500 } }),
    db.item.create({ data: { name: "Dry Coconut", unit: "pcs", openingStockQty: 300, lowStockThreshold: 50 } }),
  ]);

  // Sale 1 — Ravi Traders, two items + a lorry charge, fully paid in two installments.
  console.log("Creating sales...");
  const sale1Items = [
    { item: coconutOil, quantity: 20, priceCents: 45000 },
    { item: dryCoconut, quantity: 50, priceCents: 3500 },
  ];
  const sale1Charges = [{ chargeType: lorryRent, label: "Lorry Rent", amountCents: 50000 }];
  const sale1ItemsTotal = sale1Items.reduce((s, l) => s + l.quantity * l.priceCents, 0);
  const sale1ChargesTotal = sale1Charges.reduce((s, c) => s + c.amountCents, 0);
  const sale1Total = sale1ItemsTotal + sale1ChargesTotal;
  const sale1 = await db.sale.create({
    data: {
      billNumber: 1,
      date: daysAgo(10),
      partyId: ravi.id,
      totalCents: sale1Total,
      paidCents: sale1Total,
      paymentMethod: "CASH",
      userId: user1.id,
      items: { create: sale1Items.map((l) => ({ itemId: l.item.id, quantity: l.quantity, priceCents: l.priceCents, lineTotalCents: l.quantity * l.priceCents })) },
      charges: { create: sale1Charges.map((c) => ({ chargeTypeId: c.chargeType?.id, label: c.label, amountCents: c.amountCents })) },
      payments: {
        create: [
          { date: daysAgo(10), amountCents: Math.round(sale1Total * 0.6), paymentMethod: "CASH" },
          { date: daysAgo(3), amountCents: sale1Total - Math.round(sale1Total * 0.6), paymentMethod: "BANK" },
        ],
      },
    },
  });

  // Sale 2 — Meera Stores, one item, partially paid.
  const sale2Qty = 15;
  const sale2Price = 45000;
  const sale2Total = sale2Qty * sale2Price;
  const sale2Paid = 400000;
  const sale2 = await db.sale.create({
    data: {
      billNumber: 2,
      date: daysAgo(5),
      partyId: meera.id,
      totalCents: sale2Total,
      paidCents: sale2Paid,
      paymentMethod: "BANK",
      userId: user2?.id ?? user1.id,
      items: { create: [{ itemId: coconutOil.id, quantity: sale2Qty, priceCents: sale2Price, lineTotalCents: sale2Total }] },
      payments: { create: [{ date: daysAgo(5), amountCents: sale2Paid, paymentMethod: "BANK" }] },
    },
  });

  // Sale 3 — Kannan Agencies (BOTH), two items, unpaid.
  const sale3Items = [
    { item: dryCoconut, quantity: 100, priceCents: 3200 },
    { item: coconutShell, quantity: 200, priceCents: 800 },
  ];
  const sale3Total = sale3Items.reduce((s, l) => s + l.quantity * l.priceCents, 0);
  const sale3 = await db.sale.create({
    data: {
      billNumber: 3,
      date: daysAgo(1),
      partyId: both.id,
      totalCents: sale3Total,
      paidCents: 0,
      paymentMethod: "CASH",
      userId: user1.id,
      items: { create: sale3Items.map((l) => ({ itemId: l.item.id, quantity: l.quantity, priceCents: l.priceCents, lineTotalCents: l.quantity * l.priceCents })) },
    },
  });

  console.log("Creating purchases...");
  const purchase1Items = [{ item: copra, quantity: 500, priceCents: 9000 }];
  const purchase1Charges = [{ chargeType: packing, label: "Packing Charge", amountCents: 20000 }];
  const purchase1ItemsTotal = purchase1Items.reduce((s, l) => s + l.quantity * l.priceCents, 0);
  const purchase1ChargesTotal = purchase1Charges.reduce((s, c) => s + c.amountCents, 0);
  const purchase1Total = purchase1ItemsTotal + purchase1ChargesTotal;
  const purchase1 = await db.purchase.create({
    data: {
      billNumber: 1,
      date: daysAgo(12),
      partyId: copraSupplier.id,
      totalCents: purchase1Total,
      paidCents: purchase1Total,
      paymentMethod: "BANK",
      userId: user1.id,
      items: { create: purchase1Items.map((l) => ({ itemId: l.item.id, quantity: l.quantity, priceCents: l.priceCents, lineTotalCents: l.quantity * l.priceCents })) },
      charges: { create: purchase1Charges.map((c) => ({ chargeTypeId: c.chargeType?.id, label: c.label, amountCents: c.amountCents })) },
      payments: { create: [{ date: daysAgo(12), amountCents: purchase1Total, paymentMethod: "BANK" }] },
    },
  });

  const purchase2Qty = 300;
  const purchase2Price = 8800;
  const purchase2Total = purchase2Qty * purchase2Price;
  const purchase2Paid = 1500000;
  const purchase2 = await db.purchase.create({
    data: {
      billNumber: 2,
      date: daysAgo(6),
      partyId: both.id,
      totalCents: purchase2Total,
      paidCents: purchase2Paid,
      paymentMethod: "CASH",
      userId: user1.id,
      items: { create: [{ itemId: copra.id, quantity: purchase2Qty, priceCents: purchase2Price, lineTotalCents: purchase2Total }] },
      payments: { create: [{ date: daysAgo(6), amountCents: purchase2Paid, paymentMethod: "CASH" }] },
    },
  });

  console.log("Creating expenses...");
  await db.transaction.createMany({
    data: [
      {
        date: daysAgo(8),
        description: "October shop rent",
        amountCents: 1500000,
        type: "EXPENSE",
        categoryId: rentCategory?.id,
        userId: user1.id,
        paymentMethod: "BANK",
      },
      {
        date: daysAgo(2),
        description: "Electricity bill",
        amountCents: 320000,
        type: "EXPENSE",
        categoryId: utilitiesCategory?.id,
        userId: user1.id,
        paymentMethod: "CASH",
      },
    ],
  });

  console.log("Creating a party advance payment...");
  await db.partyPayment.create({
    data: {
      partyId: ravi.id,
      date: daysAgo(4),
      direction: "RECEIVED",
      amountCents: 200000,
      paymentMethod: "CASH",
      notes: "Advance for next order",
      userId: user1.id,
    },
  });

  console.log("\nDone:");
  console.log(`  Parties: Ravi Traders (${ravi.id}), Meera Stores, Thottam Copra Suppliers, Kannan Agencies`);
  console.log(`  Items: Coconut Oil, Copra, Coconut Shell, Dry Coconut`);
  console.log(`  Sales: #${sale1.billNumber} (paid), #${sale2.billNumber} (partial), #${sale3.billNumber} (unpaid)`);
  console.log(`  Purchases: #${purchase1.billNumber} (paid), #${purchase2.billNumber} (partial)`);
  console.log("  2 expenses, 1 party advance payment");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
