import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
  adminUpdate: vi.fn(),
  adminEqId: vi.fn(),
  trigger: vi.fn(),
  getUsage: vi.fn(),
  rateLimit: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: mocks.getUser },
    rpc: mocks.rpc,
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => ({ update: mocks.adminUpdate }) }),
}));
vi.mock("@trigger.dev/sdk", () => ({ tasks: { trigger: mocks.trigger } }));
vi.mock("@/lib/billing", async (orig) => ({
  ...(await orig<typeof import("@/lib/billing")>()),
  getUsage: mocks.getUsage,
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mocks.rateLimit }));

import { POST } from "../analyze/route";

const validLead = { name: "Sara Khan", need: "Automate invoice processing." };

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/analyze", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  mocks.rateLimit.mockReturnValue(true);
  mocks.getUsage.mockResolvedValue({ plan: "free", used: 0, limit: 2 });
  mocks.trigger.mockResolvedValue({ id: "run_123" });
  mocks.rpc.mockResolvedValue({ data: "row-1", error: null });
  // update(...).eq("id").eq("user_id") resolves to { error }.
  mocks.adminEqId.mockReturnValue({ eq: () => Promise.resolve({ error: null }) });
  mocks.adminUpdate.mockReturnValue({ eq: mocks.adminEqId });
});

describe("POST /api/analyze", () => {
  it("returns 401 when logged out and does nothing else", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    const res = await post(validLead);
    expect(res.status).toBe(401);
    expect(mocks.trigger).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("returns 429 when rate limited", async () => {
    mocks.rateLimit.mockReturnValue(false);
    const res = await post(validLead);
    expect(res.status).toBe(429);
    expect(mocks.rateLimit).toHaveBeenCalledWith("user-1");
    expect(mocks.trigger).not.toHaveBeenCalled();
  });

  it("returns 402 limit_reached when the free quota is used up", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    const res = await post(validLead);
    expect(res.status).toBe(402);
    expect((await res.json()).code).toBe("limit_reached");
    expect(mocks.trigger).not.toHaveBeenCalled();
  });

  it("does not block a Pro user (limit is null)", async () => {
    mocks.getUsage.mockResolvedValue({ plan: "pro", used: 500, limit: null });
    const res = await post(validLead);
    expect(res.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("claim_analysis", expect.objectContaining({ p_limit: null }));
  });

  it("returns 413 for a body over the size limit and does nothing else", async () => {
    const res = await post(JSON.stringify({ ...validLead, notes: "a".repeat(20_000) }));
    expect(res.status).toBe(413);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.trigger).not.toHaveBeenCalled();
  });

  it("returns 400 for a lead missing required fields", async () => {
    const res = await post({ name: "", need: "x" });
    expect(res.status).toBe(400);
    expect(mocks.trigger).not.toHaveBeenCalled();
  });

  it("returns 400 for an over-long field", async () => {
    const res = await post({ ...validLead, need: "a".repeat(1001) });
    expect(res.status).toBe(400);
    expect(mocks.trigger).not.toHaveBeenCalled();
  });

  it("returns 400 for a body that is not JSON", async () => {
    const res = await post("not json {");
    expect(res.status).toBe(400);
    expect(mocks.trigger).not.toHaveBeenCalled();
  });

  it("happy path: claims the row, triggers the task, saves the run id", async () => {
    const res = await post({ ...validLead, company: "  Gulf Logistics LLC  " });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ runId: "run_123" });
    const lead = { ...validLead, company: "Gulf Logistics LLC" };
    // The task gets the parsed (trimmed) lead, not the raw body.
    expect(mocks.trigger).toHaveBeenCalledWith("qualify-lead", lead);
    expect(mocks.rpc).toHaveBeenCalledWith(
      "claim_analysis",
      expect.objectContaining({ p_lead: lead, p_limit: 2 }),
    );
    expect(mocks.adminUpdate).toHaveBeenCalledWith({ run_id: "run_123" });
    // The row is claimed before the task starts.
    expect(mocks.rpc.mock.invocationCallOrder[0]).toBeLessThan(mocks.trigger.mock.invocationCallOrder[0]);
  });

  it("returns 502 and never starts the task when the claim fails", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501" } });
    const res = await post(validLead);
    expect(res.status).toBe(502);
    expect(mocks.trigger).not.toHaveBeenCalled();
  });

  it("returns 502 and marks the row failed when Trigger.dev fails", async () => {
    mocks.trigger.mockRejectedValue(new Error("boom"));
    const res = await post(validLead);
    expect(res.status).toBe(502);
    expect(mocks.adminUpdate).toHaveBeenCalledWith({ status: "failed" });
  });
});
