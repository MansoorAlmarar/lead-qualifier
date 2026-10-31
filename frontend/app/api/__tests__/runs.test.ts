import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  maybeSingle: vi.fn(),
  updateEq: vi.fn(),
  update: vi.fn(),
  userUpdate: vi.fn(),
  retrieve: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: mocks.getUser },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }),
      update: mocks.userUpdate,
    }),
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => ({ update: mocks.update }) }),
}));
vi.mock("@trigger.dev/sdk", () => ({ runs: { retrieve: mocks.retrieve } }));

import { GET } from "../runs/[id]/route";

const valid = { qualified: true, score: 80, reasoning: "Clear need.", next_step: "Book a call.", red_flags: [] };

function get(id = "run_abc123") {
  return GET(new Request(`http://localhost/api/runs/${id}`) as never, { params: Promise.resolve({ id }) } as never);
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  mocks.maybeSingle.mockResolvedValue({ data: { status: "pending", result: null } });
  mocks.update.mockReturnValue({ eq: mocks.updateEq });
  mocks.updateEq.mockResolvedValue({ error: null });
});

describe("GET /api/runs/[id]", () => {
  it("saves a valid completed result as done", async () => {
    mocks.retrieve.mockResolvedValue({ status: "COMPLETED", output: valid });
    const res = await get();
    expect(await res.json()).toEqual({ status: "done", result: valid });
    expect(mocks.update).toHaveBeenCalledWith({ status: "done", result: valid });
  });

  it("marks a completed run with a malformed result as failed", async () => {
    mocks.retrieve.mockResolvedValue({ status: "COMPLETED", output: { ...valid, score: 150 } });
    const res = await get();
    expect(await res.json()).toEqual({ status: "failed" });
    expect(mocks.update).toHaveBeenCalledWith({ status: "failed" });
  });

  it("writes the result with the admin client, never the user's own client", async () => {
    mocks.retrieve.mockResolvedValue({ status: "COMPLETED", output: valid });
    await get();
    expect(mocks.update).toHaveBeenCalled();
    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });

  it("keeps a run pending while it is still running", async () => {
    mocks.retrieve.mockResolvedValue({ status: "EXECUTING", output: undefined });
    const res = await get();
    expect(await res.json()).toEqual({ status: "pending" });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("marks a crashed run as failed", async () => {
    mocks.retrieve.mockResolvedValue({ status: "CRASHED", output: undefined });
    expect(await (await get()).json()).toEqual({ status: "failed" });
  });

  it("returns 404 for a run the user does not own", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null });
    const res = await get();
    expect(res.status).toBe(404);
    expect(mocks.retrieve).not.toHaveBeenCalled();
  });

  it("returns 400 for a malformed run id", async () => {
    const res = await get("not-a-run");
    expect(res.status).toBe(400);
  });
});
