import { Suspense } from "react";
import { AppNav } from "@/components/AppNav";
import { LeadQualifier } from "@/components/LeadQualifier";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
      <Suspense fallback={<div className="mb-8 h-12" />}>
        <AppNav />
      </Suspense>

      <header className="mb-10 max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
          AI workflow demo
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">AI Lead Qualifier</h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          Describe an inbound lead and get a qualified or not qualified verdict, a score out of 100, the
          reasoning, and a suggested next step. Not sure what to type? Pick a sample below.
        </p>
        <p className="mt-2 text-sm text-zinc-500">
          Each analysis runs as a Trigger.dev task that calls an LLM through OpenRouter. Please use fictional
          data only.
        </p>
      </header>

      <LeadQualifier />

      <footer className="mt-12 max-w-2xl text-xs leading-relaxed text-zinc-500">
        Built with the WAT framework (workflows, agent, tools). Next.js on Vercel, Trigger.dev backend, Supabase
        for auth and history. Billing runs in Stripe test mode, so no real payments are taken.
        {" "}
        <a
          href="https://github.com/MansoorAlmarar/lead-qualifier"
          className="underline underline-offset-2 hover:text-indigo-600 dark:hover:text-indigo-400"
        >
          Source on GitHub
        </a>
      </footer>
    </main>
  );
}
