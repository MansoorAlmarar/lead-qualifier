import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getUsage: vi.fn(),
  userMaybeSingle: vi.fn(),
  adminMaybeSingle: vi.fn(),
  adminUpsert: vi.fn(),
  customersCreate: vi.fn(),
  sessionsCreate: vi.fn(),
  portalCreate: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: mocks.getUser },
    from: () => ({ select: () => ({ maybeSingle: mocks.userMaybeSingle }) }),
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: mocks.adminMaybeSingle }) }),
      upsert: () => ({ select: () => ({ maybeSingle: mocks.adminUpsert }) }),
    }),
  }),
}));
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    customers: { create: mocks.customersCreate },
    checkout: { sessions: { create: mocks.sessionsCreate } },
    billingPortal: { sessions: { create: mocks.portalCreate } },
  }),
}));
vi.mock("@/lib/billing", () => ({ getUsage: mocks.getUsage }));

import { GET as statusGET } from "../billing/status/route";
import { POST as checkoutPOST } from "../billing/checkout/route";
import { POST as portalPOST } from "../billing/portal/route";

const user = { id: "user-1", email: "sara@example.com" };
const req = (path: string) => new Request(`http://localhost${path}`, { method: "POST" });

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubEnv("STRIPE_PRICE_ID", "price_test_placeholder");
  mocks.getUser.mockResolvedValue({ data: { user } });
});

describe("GET /api/billing/status", () => {
  it("returns 401 when logged out", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    expect((await statusGET()).status).toBe(401);
    expect(mocks.getUsage).not.toHaveBeenCalled();
  });

  it("happy path: returns the usage", async () => {
    mocks.getUsage.mockResolvedValue({ plan: "free", used: 1, limit: 2 });
    const res = await statusGET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ plan: "free", used: 1, limit: 2 });
  });
});

describe("POST /api/billing/checkout", () => {
  it("returns 401 when logged out", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    expect((await checkoutPOST(req("/api/billing/checkout"))).status).toBe(401);
    expect(mocks.customersCreate).not.toHaveBeenCalled();
  });

  it("returns 409 when the user already has an active subscription", async () => {
    mocks.adminMaybeSingle.mockResolvedValue({ data: { stripe_customer_id: "cus_1", status: "active" } });
    const res = await checkoutPOST(req("/api/billing/checkout"));
    expect(res.status).toBe(409);
    expect(mocks.sessionsCreate).not.toHaveBeenCalled();
  });

  it("happy path: creates a customer, saves it, and returns the checkout url", async () => {
    mocks.adminMaybeSingle.mockResolvedValue({ data: null });
    mocks.customersCreate.mockResolvedValue({ id: "cus_new" });
    mocks.adminUpsert.mockResolvedValue({ data: { stripe_customer_id: "cus_new" }, error: null });
    mocks.sessionsCreate.mockResolvedValue({ url: "https://checkout.example/session" });

    const res = await checkoutPOST(req("/api/billing/checkout"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: "https://checkout.example/session" });
    expect(mocks.sessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        customer: "cus_new",
        client_reference_id: "user-1",
        success_url: "http://localhost/?upgraded=1",
      }),
    );
  });

  it("uses the customer that won when two checkouts race (upsert ignored ours)", async () => {
    mocks.adminMaybeSingle
      .mockResolvedValueOnce({ data: null }) // first lookup: no row yet
      .mockResolvedValueOnce({ data: { stripe_customer_id: "cus_winner" } }); // read-back after the conflict
    mocks.customersCreate.mockResolvedValue({ id: "cus_loser" });
    mocks.adminUpsert.mockResolvedValue({ data: null, error: null });
    mocks.sessionsCreate.mockResolvedValue({ url: "https://checkout.example/session" });
    const res = await checkoutPOST(req("/api/billing/checkout"));
    expect(res.status).toBe(200);
    expect(mocks.sessionsCreate).toHaveBeenCalledWith(expect.objectContaining({ customer: "cus_winner" }));
  });

  it("returns 502 when saving the customer fails", async () => {
    mocks.adminMaybeSingle.mockResolvedValue({ data: null });
    mocks.customersCreate.mockResolvedValue({ id: "cus_new" });
    mocks.adminUpsert.mockResolvedValue({ data: null, error: { code: "XX000" } });
    expect((await checkoutPOST(req("/api/billing/checkout"))).status).toBe(502);
    expect(mocks.sessionsCreate).not.toHaveBeenCalled();
  });

  it("reuses the saved customer for a returning (canceled) user", async () => {
    mocks.adminMaybeSingle.mockResolvedValue({ data: { stripe_customer_id: "cus_old", status: "canceled" } });
    mocks.sessionsCreate.mockResolvedValue({ url: "https://checkout.example/session" });
    const res = await checkoutPOST(req("/api/billing/checkout"));
    expect(res.status).toBe(200);
    expect(mocks.customersCreate).not.toHaveBeenCalled();
    expect(mocks.sessionsCreate).toHaveBeenCalledWith(expect.objectContaining({ customer: "cus_old" }));
  });

  it("returns 502 when Stripe fails", async () => {
    mocks.adminMaybeSingle.mockResolvedValue({ data: null });
    mocks.customersCreate.mockRejectedValue(new Error("stripe down"));
    expect((await checkoutPOST(req("/api/billing/checkout"))).status).toBe(502);
  });
});

describe("POST /api/billing/portal", () => {
  it("returns 401 when logged out", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    expect((await portalPOST(req("/api/billing/portal"))).status).toBe(401);
    expect(mocks.portalCreate).not.toHaveBeenCalled();
  });

  it("returns 404 when the user has no subscription row", async () => {
    mocks.userMaybeSingle.mockResolvedValue({ data: null });
    expect((await portalPOST(req("/api/billing/portal"))).status).toBe(404);
  });

  it("happy path: returns the portal url", async () => {
    mocks.userMaybeSingle.mockResolvedValue({ data: { stripe_customer_id: "cus_1" } });
    mocks.portalCreate.mockResolvedValue({ url: "https://portal.example/session" });
    const res = await portalPOST(req("/api/billing/portal"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: "https://portal.example/session" });
    expect(mocks.portalCreate).toHaveBeenCalledWith({ customer: "cus_1", return_url: "http://localhost/" });
  });

  it("returns 502 when Stripe fails", async () => {
    mocks.userMaybeSingle.mockResolvedValue({ data: { stripe_customer_id: "cus_1" } });
    mocks.portalCreate.mockRejectedValue(new Error("stripe down"));
    expect((await portalPOST(req("/api/billing/portal"))).status).toBe(502);
  });
});
