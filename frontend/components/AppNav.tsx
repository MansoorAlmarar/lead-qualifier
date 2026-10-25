import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export async function AppNav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <nav aria-label="Main" className="mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-4 text-sm dark:border-zinc-800">
      <div className="flex gap-4 font-medium">
        <Link href="/" className="hover:text-indigo-600 dark:hover:text-indigo-400">
          Qualify
        </Link>
        <Link href="/history" className="hover:text-indigo-600 dark:hover:text-indigo-400">
          History
        </Link>
      </div>
      <form action="/auth/signout" method="post" className="flex items-center gap-3">
        <span className="hidden max-w-48 truncate text-zinc-500 sm:inline">{user?.email}</span>
        <button
          type="submit"
          className="rounded-lg border border-zinc-300 px-3 py-1 text-xs font-medium hover:border-indigo-500 dark:border-zinc-700 dark:hover:border-indigo-400"
        >
          Log out
        </button>
      </form>
    </nav>
  );
}
