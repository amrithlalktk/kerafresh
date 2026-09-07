// Set NEXT_PUBLIC_CURRENCY in .env to your business's currency code (e.g. "EUR", "INR").
const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY || "USD";

export function formatCents(cents: number) {
  return (cents / 100).toLocaleString(undefined, {
    style: "currency",
    currency: CURRENCY,
  });
}

export function toCents(amount: number) {
  return Math.round(amount * 100);
}
