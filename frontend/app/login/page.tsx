import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";

async function LoginForm({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <AuthForm
      initialError={error === "confirm" ? "We could not sign you in from that link. If you just confirmed your email, log in below with your password. If the link is expired, sign up again." : undefined}
    />
  );
}

export default function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-4 py-16">
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
        AI Lead Qualifier
      </p>
      <p className="mb-8 max-w-sm text-center text-sm text-zinc-600 dark:text-zinc-400">
        Paste in a sales lead and an AI workflow scores it and suggests a next step. Create a free account to
        try it. Billing runs in Stripe test mode, so no real payments are taken.
      </p>
      <Suspense>
        <LoginForm searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
