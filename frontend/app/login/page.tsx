import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";

async function LoginForm({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <AuthForm
      initialError={error === "confirm" ? "That confirmation link is invalid or expired. Sign up again." : undefined}
    />
  );
}

export default function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-4 py-16">
      <p className="mb-6 text-xs font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
        AI Lead Qualifier
      </p>
      <Suspense>
        <LoginForm searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
