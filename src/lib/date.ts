// Transaction dates are stored as UTC midnight of the calendar day the user
// picked (a date-only value with no meaningful time-of-day). Always format
// them in UTC so the displayed date doesn't shift by a day depending on the
// viewer's timezone.
export function formatDate(date: string | Date) {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(undefined, { timeZone: "UTC" });
}
