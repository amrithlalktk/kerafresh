import { z } from "zod";
import { FFA_GRADES } from "@/lib/types";

export const signupSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

// Admin-created accounts get emailed a setup link instead of an
// admin-chosen temporary password — see POST /api/users.
export const inviteUserSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().email("Enter a valid email"),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "STAFF"]),
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
  openingStockQty: z.number().int().nonnegative().default(0),
  lowStockThreshold: z.number().int().nonnegative().optional().nullable(),
  ffaGraded: z.boolean().default(false),
});

// Charge types (lorry rent, packing charge, coolie, etc.) are a manageable
// list, like categories — but a charge line always carries its own label so
// historical charges stay readable if the type is renamed/deleted later.
export const chargeTypeSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
});

const saleLineSchema = z.object({
  itemId: z.string().min(1, "Item is required"),
  // Not integer-only — quantities are in KG, so fractional amounts like 1.5
  // are normal, not an edge case.
  quantity: z.number().positive("Quantity must be greater than 0"),
  price: z.number().nonnegative("Price can't be negative"),
  taxPercent: z.number().min(0, "Tax % can't be negative").max(100, "Tax % can't exceed 100").default(0),
  ffaGrade: z.enum(FFA_GRADES).optional().nullable(),
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
  // How much of `paid` is settled from the party's existing advance credit
  // (PartyPayment) instead of fresh cash — see POST /api/sales.
  advanceAppliedCents: z.number().int().nonnegative().default(0),
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

// An advance payment with a party, outside of any specific Sale/Purchase.
export const partyPaymentSchema = z.object({
  date: z.string().min(1, "Date is required"),
  direction: z.enum(["RECEIVED", "PAID"]),
  amount: z.number().positive("Amount must be greater than 0"),
  paymentMethod: z.enum(["CASH", "BANK"]).default("CASH"),
  notes: z.string().trim().optional().nullable(),
});

export const noteSheetSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60, "Name is too long"),
});

export const noteSheetDataSchema = z.object({
  rows: z.number().int().min(1).max(2000),
  cols: z.number().int().min(1).max(500),
  cells: z.record(z.string(), z.string()),
});

// Renaming a sheet and saving its grid happen separately (rename is rare,
// grid saves happen on a debounce) — both optional so either can be sent
// alone.
export const noteSheetPatchSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60, "Name is too long").optional(),
  data: noteSheetDataSchema.optional(),
});
