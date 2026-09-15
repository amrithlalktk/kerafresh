"use client";

import { useState } from "react";
import Link from "next/link";

// Generic one-click "email this PDF to my configured address" button —
// used both on bill print pages (POSTs to /api/print/.../[id]/email) and on
// report pages (POSTs {title, header, rows} to /api/reports/email-pdf).
// The endpoint does the actual PDF build + send; this just calls it and
// reports the result.
export default function EmailPdfButton({
  endpoint,
  body,
  disabled,
  className,
}: {
  endpoint: string;
  body?: unknown;
  disabled?: boolean;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setState("sending");
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not send email");
        setState("error");
        return;
      }
      setState("sent");
    } catch {
      setError("Could not send email");
      setState("error");
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || state === "sending"}
        className={
          className ??
          "rounded-md border border-black/15 px-3 py-2 text-sm disabled:opacity-40 dark:border-white/15"
        }
      >
        {state === "sending" ? "Sending…" : state === "sent" ? "Sent ✓" : "Email PDF"}
      </button>
      {state === "error" && error && (
        <span className="text-xs text-red-600">
          {error}
          {error.includes("Account settings") && (
            <>
              {" "}
              <Link href="/account" className="underline underline-offset-4">
                Go there
              </Link>
            </>
          )}
        </span>
      )}
    </span>
  );
}
