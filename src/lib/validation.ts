import { z } from "zod";

export const signupSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export const createUserSchema = signupSchema.extend({
  role: z.enum(["ADMIN", "STAFF"]),
});

// Categories are expense-only — income is tracked via Sale.
export const categorySchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
});

const paymentMethodSchema = z.enum(["CASH", "BANK"]).optional().nullable();

export const expenseSchema = z.object({
  date: z.string().min(1, "Date is required"),
  description: z.string().trim().min(1, "Description is required"),
  amount: z.number().positive("Amount must be greater than 0"),
  categoryId: z.string().min(1, "Category is required"),
  paymentMethod: paymentMethodSchema,
  notes: z.string().trim().optional().nullable(),
});

export const partySchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  type: z.enum(["CUSTOMER", "SUPPLIER", "BOTH"]),
  phone: z.string().trim().optional().nullable(),
  email: z.string().trim().optional().nullable(),
  address: z.string().trim().optional().nullable(),
  gstNumber: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  openingBalance: z.number().finite().default(0),
});

export const itemSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  unit: z.string().trim().min(1).default("pcs"),
  salePrice: z.number().nonnegative("Sale price can't be negative").default(0),
  purchasePrice: z.number().nonnegative("Purchase price can't be negative").default(0),
  openingStockQty: z.number().int().nonnegative().default(0),
  lowStockThreshold: z.number().int().nonnegative().optional().nullable(),
});

// Charge types (lorry rent, packing charge, coolie, etc.) are a manageable
// list, like categories — but a charge line always carries its own label so
// historical charges stay readable if the type is renamed/deleted later.
export const chargeTypeSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
});

const saleLineSchema = z.object({
  itemId: z.string().min(1, "Item is required"),
  quantity: z.number().int().positive("Quantity must be at least 1"),
  price: z.number().nonnegative("Price can't be negative"),
});

const chargeLineSchema = z.object({
  chargeTypeId: z.string().trim().optional().nullable(),
  label: z.string().trim().min(1, "Charge description is required"),
  amount: z.number().positive("Charge amount must be greater than 0"),
});

export const saleSchema = z.object({
  date: z.string().min(1, "Date is required"),
  partyId: z.string().trim().optional().nullable(),
  items: z.array(saleLineSchema).min(1, "Add at least one item"),
  charges: z.array(chargeLineSchema).optional().default([]),
  paid: z.number().nonnegative().default(0),
  paymentMethod: z.enum(["CASH", "BANK"]).default("CASH"),
  notes: z.string().trim().optional().nullable(),
});

export const purchaseSchema = saleSchema;

// A single installment recorded against an existing Sale/Purchase.
export const paymentSchema = z.object({
  date: z.string().min(1, "Date is required"),
  amount: z.number().positive("Amount must be greater than 0"),
  paymentMethod: z.enum(["CASH", "BANK"]).default("CASH"),
  notes: z.string().trim().optional().nullable(),
});
