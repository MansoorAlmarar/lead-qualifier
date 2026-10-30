"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Usage } from "@/lib/billing";
import type { Lead, QualificationResult, RunState } from "@/lib/schema";
import { SAMPLES } from "@/lib/samples";
import { readJson } from "@/lib/api";
import { PlanBar } from "./PlanBar";

type Phase =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done"; result: QualificationResult }
  | { kind: "error"; message: string };

const EMPTY: Lead = {
  name: "",
  company: "",
  role: "",
  budget: "",
  need: "",
  timeline: "",
  source: "",
  notes: "",
};

const POLL_MS = 1500;
const TIMEOUT_MS = 90_000;

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}

export function LeadQualifier() {
  const [lead, setLead] = useState<Lead>(EMPTY);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [usage, setUsage] = useState<Usage | null>(null);
  const runToken = useRef(0);

  const refreshUsage = useCallback(async () => {
    try {
      const res = await fetch("/api/billing/status");
      if (!res.ok) return null;
      const next = (await res.json()) as Usage;
      setUsage(next);
      return next;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const first = await refreshUsage();
      // Coming back from Stripe Checkout: the webhook can take a few seconds to mark the user as Pro.
      const fromStripe = document.referrer.includes("stripe.com");
      let latest = first;
      for (let i = 0; fromStripe && latest?.plan === "free" && i < 6 && !cancelled; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        latest = await refreshUsage();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshUsage]);

  const limitReached = usage?.limit != null && usage.used >= usage.limit;

  const set = (key: keyof Lead) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setLead((l) => ({ ...l, [key]: e.target.value }));

  async function analyze(e: React.FormEvent) {
    e.preventDefault();
    const token = ++runToken.current;
    setPhase({ kind: "loading" });

    // Send only filled fields.
    const payload = Object.fromEntries(
      Object.entries(lead).filter(([, v]) => v.trim() !== ""),
    );

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await readJson<{ runId: string; error: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");

      const started = Date.now();
      while (Date.now() - started < TIMEOUT_MS) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        if (token !== runToken.current) return; // a newer run replaced this one
        const poll = await fetch(`/api/runs/${data.runId}`);
        const state = (await readJson<RunState & { error: string }>(poll)) as RunState & { error?: string };
        if (!poll.ok) throw new Error(state.error ?? "Could not read the result.");
        if (state.status === "done") {
          setPhase({ kind: "done", result: state.result });
          void refreshUsage();
          return;
        }
        if (state.status === "failed") {
          throw new Error("The analysis failed. Please try again.");
        }
      }
      throw new Error("This is taking too long. Please try again.");
    } catch (err) {
      if (token !== runToken.current) return;
      setPhase({ kind: "error", message: err instanceof Error ? err.message : "Something went wrong." });
      void refreshUsage();
    }
  }

  const loading = phase.kind === "loading";

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="lg:col-span-2">
        <PlanBar usage={usage} />
      </div>
      <form onSubmit={analyze} className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-zinc-500">Fill a sample lead:</span>
          {SAMPLES.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => setLead({ ...EMPTY, ...s.lead })}
              className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 transition hover:border-indigo-500 hover:text-indigo-600 dark:border-zinc-700 dark:text-zinc-300 dark:hover:text-indigo-400"
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" required>
            <input className={inputClass} value={lead.name} onChange={set("name")} maxLength={100} required />
          </Field>
          <Field label="Company">
            <input className={inputClass} value={lead.company} onChange={set("company")} maxLength={100} />
          </Field>
          <Field label="Role">
            <input className={inputClass} value={lead.role} onChange={set("role")} maxLength={100} />
          </Field>
          <Field label="Budget">
            <input className={inputClass} value={lead.budget} onChange={set("budget")} maxLength={100} />
          </Field>
          <Field label="Timeline">
            <input className={inputClass} value={lead.timeline} onChange={set("timeline")} maxLength={100} />
          </Field>
          <Field label="Source">
            <input className={inputClass} value={lead.source} onChange={set("source")} maxLength={100} />
          </Field>
        </div>

        <Field label="What do they need?" required>
          <textarea className={inputClass} rows={3} value={lead.need} onChange={set("need")} maxLength={1000} required />
        </Field>
        <Field label="Notes">
          <textarea className={inputClass} rows={2} value={lead.notes} onChange={set("notes")} maxLength={1000} />
        </Field>

        <button
          type="submit"
          disabled={loading || limitReached}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Analyzing…" : limitReached ? "Daily limit reached" : "Analyze"}
        </button>
      </form>

      <div aria-live="polite" className="min-h-64 rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
        {phase.kind === "idle" && (
          <div className="flex h-full min-h-52 flex-col items-center justify-center text-center text-sm text-zinc-500">
            <p className="font-medium text-zinc-700 dark:text-zinc-300">No result yet</p>
            <p className="mt-1">Fill in the form or pick a sample, then click Analyze.</p>
          </div>
        )}

        {phase.kind === "loading" && (
          <div className="flex h-full min-h-52 flex-col items-center justify-center gap-3 text-sm text-zinc-500">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-indigo-600" />
            <p>Running the workflow on Trigger.dev…</p>
          </div>
        )}

        {phase.kind === "error" && (
          <div role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {phase.message}
          </div>
        )}

        {phase.kind === "done" && <ResultCard result={phase.result} />}
      </div>
    </div>
  );
}

function ResultCard({ result }: { result: QualificationResult }) {
  const tone = result.qualified
    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
    : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300";
  const bar = result.qualified ? "bg-emerald-500" : "bg-rose-500";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>
          {result.qualified ? "Qualified" : "Not qualified"}
        </span>
        <span className="text-2xl font-semibold tabular-nums">
          {Math.round(result.score)}
          <span className="text-sm font-normal text-zinc-500">/100</span>
        </span>
      </div>

      <div
        role="progressbar"
        aria-label="Lead score"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(result.score)}
        className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
      >
        <div className={`h-full ${bar}`} style={{ width: `${Math.min(100, Math.max(0, result.score))}%` }} />
      </div>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Reasoning</h3>
        <p className="mt-1 text-sm leading-relaxed">{result.reasoning}</p>
      </section>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Next step</h3>
        <p className="mt-1 text-sm leading-relaxed">{result.next_step}</p>
      </section>

      {result.red_flags.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Red flags</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {result.red_flags.map((f) => (
              <li key={f} className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                {f}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
