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
      <div className="isolate relative ml-56 flex min-w-0 flex-1 flex-col overflow-hidden bg-[#f2f0eb] dark:bg-[#12141f]">
        <Watermark />
        <TopBar />
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
