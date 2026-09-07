export default function SummaryCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "positive" | "negative";
}) {
  const toneClass =
    tone === "positive"
      ? "text-[#0ca30c]"
      : tone === "negative"
        ? "text-[#d03b3b]"
        : "";

  return (
    <div className="rounded-2xl bg-[#fdfcfa] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] dark:bg-[#1e2231] dark:shadow-none">
      <p className="text-sm text-black/60 dark:text-white/60">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}
