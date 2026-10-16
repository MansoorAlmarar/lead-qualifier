import { Suspense } from "react";
import { AppNav } from "@/components/AppNav";
import { createClient } from "@/lib/supabase/server";
import type { Lead, QualificationResult } from "@/lib/schema";

type Row = {
  id: string;
  lead: Lead;
  result: QualificationResult | null;
  status: "pending" | "done" | "failed";
  created_at: string;
};

async function HistoryList() {
  const supabase = await createClient();
  // Row-level security limits this to the logged-in user's rows.
  const { data, error } = await supabase
    .from("lead_history")
    .select("id, lead, result, status, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  const rows = (data ?? []) as Row[];

  return (
    <>
      {error && <p className="mt-6 text-sm text-red-600">Could not load your history.</p>}
      {!error && rows.length === 0 && (
        <p className="mt-8 rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
          No leads yet. Qualify one and it shows up here.
        </p>
      )}

      <ul className="mt-6 space-y-3">
        {rows.map((r) => (
          <li key={r.id} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">
                {r.lead.name}
                {r.lead.company ? <span className="text-zinc-500"> · {r.lead.company}</span> : null}
              </p>
              <time className="text-xs text-zinc-500" dateTime={r.created_at}>
                {new Date(r.created_at).toLocaleString("en-GB", { timeZone: "Asia/Dubai" })}
              </time>
            </div>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{r.lead.need}</p>
            {r.status === "done" && r.result ? (
              <div className="mt-3 space-y-1 text-sm">
                <p>
                  <span
                    className={r.result.qualified ? "font-semibold text-emerald-600" : "font-semibold text-amber-600"}
                  >
                    {r.result.qualified ? "Qualified" : "Not qualified"}
                  </span>
                  <span className="text-zinc-500"> · score {r.result.score}</span>
                </p>
                <p className="text-zinc-700 dark:text-zinc-300">{r.result.reasoning}</p>
                <p className="text-zinc-500">Next: {r.result.next_step}</p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-zinc-500">
                {r.status === "failed" ? "The analysis failed." : "Result not saved yet."}
              </p>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

export default function HistoryPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
      <Suspense fallback={<div className="mb-8 h-12" />}>
        <AppNav />
      </Suspense>
      <h1 className="text-3xl font-semibold tracking-tight">Your history</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Only you can see these.</p>
      <Suspense fallback={<p className="mt-8 text-sm text-zinc-500">Loading...</p>}>
        <HistoryList />
      </Suspense>
    </main>
  );
}
