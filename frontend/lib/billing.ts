import type { SupabaseClient } from "@supabase/supabase-js";

export const FREE_DAILY_LIMIT = 2;

// Dubai is UTC+4 all year (no daylight saving).
const DUBAI_OFFSET_MS = 4 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfDubaiDay(now = Date.now()): Date {
  const local = now + DUBAI_OFFSET_MS;
  return new Date(local - (local % DAY_MS) - DUBAI_OFFSET_MS);
}

export type Usage = { plan: "free" | "pro"; used: number; limit: number | null };

// Works with the user's own client: row-level security limits both queries to their rows.
export async function getUsage(supabase: SupabaseClient): Promise<Usage> {
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("status")
    .maybeSingle();
  const pro = sub?.status === "active" || sub?.status === "trialing";

  // Failed runs do not count against the free limit.
  const { count } = await supabase
    .from("lead_history")
    .select("id", { count: "exact", head: true })
    .gte("created_at", startOfDubaiDay().toISOString())
    .neq("status", "failed");

  return {
    plan: pro ? "pro" : "free",
    used: count ?? 0,
    limit: pro ? null : FREE_DAILY_LIMIT,
  };
}
