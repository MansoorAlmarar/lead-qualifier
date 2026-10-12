import { LeadQualifier } from "@/components/LeadQualifier";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
      <header className="mb-10 max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
          AI workflow demo
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">AI Lead Qualifier</h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          Enter a lead and the workflow scores it and suggests a next step. The form calls a Trigger.dev
          task that runs an LLM through OpenRouter. This demo uses fictional data, so please do not enter real
          personal information.
        </p>
      </header>

      <LeadQualifier />

      <footer className="mt-12 text-xs text-zinc-500">
        Built with the WAT framework: workflows, an agent, and tools. Next.js on Vercel, Trigger.dev backend.
      </footer>
    </main>
  );
}
