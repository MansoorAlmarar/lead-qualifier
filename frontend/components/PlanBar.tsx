"use client";

import { useState } from "react";
import type { Usage } from "@/lib/billing";

async function goTo(path: string, setError: (m: string) => void, setBusy: (b: boolean) => void) {
  setBusy(true);
  try {
    const res = await fetch(path, { method: "POST" });
    const data = await res.json();
    if (!res.ok || !data.url) throw new Error(data.error ?? "Something went wrong.");
    window.location.href = data.url;
  } catch (err) {
    setError(err instanceof Error ? err.message : "Something went wrong.");
    setBusy(false);
  }
}

export function PlanBar({ usage }: { usage: Usage | null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!usage) return <div className="h-12 rounded-xl border border-zinc-200 dark:border-zinc-800" />;

  const left = usage.limit === null ? null : Math.max(0, usage.limit - usage.used);
  const button =
    "rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <div className="rounded-xl border border-zinc-200 px-4 py-3 text-sm dark:border-zinc-800">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {usage.plan === "pro" ? (
          <p>
            <span className="mr-2 rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
              Pro
            </span>
            Unlimited analyses.
          </p>
        ) : (
          <p>
            <span className="mr-2 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              Free
            </span>
            {left} of {usage.limit} analyses left today.
          </p>
        )}

        {usage.plan === "free" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => goTo("/api/billing/checkout", setError, setBusy)}
            className={`${button} bg-indigo-600 text-white hover:bg-indigo-500`}
          >
            {busy ? "Opening…" : "Upgrade to Pro, $29/month"}
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => goTo("/api/billing/portal", setError, setBusy)}
            className={`${button} border border-zinc-300 hover:border-indigo-500 dark:border-zinc-700`}
          >
            {busy ? "Opening…" : "Manage subscription"}
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
