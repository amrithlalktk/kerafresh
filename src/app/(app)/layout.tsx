import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import Watermark from "@/components/Watermark";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <Sidebar session={session} />
      {/* Sidebar is fixed (so its glass blur has scrolled content to pick
          up), so this pane needs matching left margin instead of relying
          on flex layout to make room for it. */}
      {/* `isolate` is required, not decorative — without it this element
          never actually establishes its own stacking context (position:
          relative alone doesn't, absent an explicit z-index), so the
          Watermark's negative z-index escapes to the document root instead
          of just going behind this pane's own content. */}
      <div className="isolate relative ml-56 flex min-w-0 flex-1 flex-col overflow-hidden bg-[#f2f0eb] print:ml-0 print:overflow-visible print:bg-white dark:bg-[#12141f]">
        {/* Soft, blurred color fields with nothing else behind them — the
            point is to give the glass Cards/TopBar something colorful to
            blur, since a backdrop-blur over a flat background is invisible.
            Screen-only: printed pages should be plain white (see Card). */}
        <div className="pointer-events-none absolute -left-24 -top-24 -z-10 h-80 w-80 rounded-full bg-[#1baf7a]/25 blur-3xl print:hidden" />
        <div className="pointer-events-none absolute right-0 top-1/3 -z-10 h-96 w-96 rounded-full bg-[#2a78d6]/20 blur-3xl print:hidden" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 -z-10 h-72 w-72 rounded-full bg-[#0ca30c]/10 blur-3xl print:hidden" />
        <Watermark />
        <TopBar />
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-6 print:overflow-visible print:px-0">
          {children}
        </main>
      </div>
    </div>
  );
}
