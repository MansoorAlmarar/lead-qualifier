"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

export function AuthForm({ initialError }: { initialError?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError ?? "");
  const [notice, setNotice] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const supabase = createClient();

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
      } else {
        router.replace("/");
        router.refresh();
      }
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
      });
      if (error) {
        setError(error.message);
      } else if (data.session) {
        router.replace("/");
        router.refresh();
      } else {
        setNotice("Check your email and click the confirmation link, then log in.");
        setMode("login");
        setPassword("");
      }
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {mode === "login" ? "Log in" : "Create an account"}
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {mode === "login" ? "to qualify leads and see your history." : "to qualify leads and keep your history."}
        </p>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Email</span>
        <input
          className={inputClass}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Password</span>
        <input
          className={inputClass}
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          {notice}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-60"
      >
        {busy ? "Please wait..." : mode === "login" ? "Log in" : "Sign up"}
      </button>

      <button
        type="button"
        onClick={() => {
          setMode(mode === "login" ? "signup" : "login");
          setError("");
          setNotice("");
        }}
        className="w-full text-sm text-zinc-600 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400"
      >
        {mode === "login" ? "No account? Sign up" : "Have an account? Log in"}
      </button>
    </form>
  );
}
