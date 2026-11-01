import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FREE_DAILY_LIMIT, PENDING_TTL_MS, getUsage, startOfDubaiDay } from "../billing";

describe("startOfDubaiDay", () => {
  it("returns Dubai midnight, which is 20:00 UTC the day before", () => {
    const now = Date.parse("2026-10-27T10:00:00Z"); // 14:00 in Dubai
    expect(startOfDubaiDay(now).toISOString()).toBe("2026-10-26T20:00:00.000Z");
  });

  it("rolls over at midnight Dubai time, not midnight UTC", () => {
    const before = Date.parse("2026-10-27T19:59:59Z"); // 23:59:59 in Dubai
    const after = Date.parse("2026-10-27T20:00:00Z"); // 00:00:00 next day in Dubai
    expect(startOfDubaiDay(before).toISOString()).toBe("2026-10-26T20:00:00.000Z");
    expect(startOfDubaiDay(after).toISOString()).toBe("2026-10-27T20:00:00.000Z");
  });
});

afterEach(() => vi.useRealTimers());

// Minimal stand-in for the two queries getUsage runs.
function fakeSupabase(subscriptionStatus: string | null, runCount: number | null) {
  const calls = { or: [] as unknown[][] };
  const client = {
    from(table: string) {
      if (table === "subscriptions") {
        return {
          select: () => ({
            maybeSingle: async () => ({ data: subscriptionStatus ? { status: subscriptionStatus } : null }),
          }),
        };
      }
      const query = {
        gte: () => query,
        or: (...args: unknown[]) => {
          calls.or.push(args);
          return Promise.resolve({ count: runCount });
        },
      };
      return { select: () => query };
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

describe("getUsage", () => {
  it("gives a user with no subscription the free plan and daily limit", async () => {
    const { client } = fakeSupabase(null, 1);
    expect(await getUsage(client)).toEqual({ plan: "free", used: 1, limit: FREE_DAILY_LIMIT });
  });

  it("treats active and trialing subscriptions as Pro with no limit", async () => {
    for (const status of ["active", "trialing"]) {
      const { client } = fakeSupabase(status, 50);
      expect(await getUsage(client)).toEqual({ plan: "pro", used: 50, limit: null });
    }
  });

  it("treats canceled or past-due subscriptions as free", async () => {
    for (const status of ["canceled", "past_due", "incomplete"]) {
      const { client } = fakeSupabase(status, 0);
      expect((await getUsage(client)).plan).toBe("free");
    }
  });

  it("counts done runs and recent pending runs, but not failed or stale pending runs", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse("2026-10-27T10:00:00Z"));
    const { client, calls } = fakeSupabase(null, 0);
    await getUsage(client);
    const cutoff = new Date(Date.parse("2026-10-27T10:00:00Z") - PENDING_TTL_MS).toISOString();
    expect(PENDING_TTL_MS).toBe(10 * 60 * 1000);
    expect(calls.or).toEqual([[`status.eq.done,and(status.eq.pending,created_at.gte.${cutoff})`]]);
  });

  it("treats a null count as zero", async () => {
    const { client } = fakeSupabase(null, null);
    expect((await getUsage(client)).used).toBe(0);
  });
});
