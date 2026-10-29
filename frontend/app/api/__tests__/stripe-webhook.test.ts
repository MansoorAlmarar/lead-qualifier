import Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Test fixtures only. Nothing here is a real key and no request leaves the process.
const WEBHOOK_SECRET = "whsec_test_placeholder";
const stripe = new Stripe("sk_test_placeholder");

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
}));

vi.mock("@/lib/stripe", () => ({ getStripe: () => stripe }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      update: mocks.update.mockReturnValue({ eq: mocks.eq.mockReturnValue({ select: mocks.select }) }),
    }),
  }),
}));

import { POST } from "../stripe/webhook/route";

// Real Stripe HMAC signing, so the route's verification is exercised for real.
function signedRequest(payload: object, opts: { secret?: string; header?: string | null } = {}) {
  const body = JSON.stringify(payload);
  const header =
    opts.header === undefined
      ? stripe.webhooks.generateTestHeaderString({ payload: body, secret: opts.secret ?? WEBHOOK_SECRET })
      : opts.header;
  const headers = new Headers();
  if (header !== null) headers.set("stripe-signature", header);
  return new Request("http://localhost/api/stripe/webhook", { method: "POST", body, headers });
}

const subscriptionEvent = (type: string, overrides: object = {}) => ({
  id: "evt_1",
  object: "event",
  type,
  data: {
    object: {
      id: "sub_1",
      object: "subscription",
      customer: "cus_1",
      status: "active",
      cancel_at_period_end: false,
      ...overrides,
    },
  },
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", WEBHOOK_SECRET);
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.select.mockResolvedValue({ data: [{ user_id: "user-1" }], error: null });
});

describe("POST /api/stripe/webhook", () => {
  it("returns 400 when the stripe-signature header is missing", async () => {
    const res = await POST(signedRequest(subscriptionEvent("customer.subscription.created"), { header: null }));
    expect(res.status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("returns 400 when signed with the wrong secret", async () => {
    const res = await POST(
      signedRequest(subscriptionEvent("customer.subscription.created"), { secret: "whsec_wrong_placeholder" }),
    );
    expect(res.status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("returns 400 when the body is changed after signing", async () => {
    const original = signedRequest(subscriptionEvent("customer.subscription.created"));
    const tampered = new Request(original.url, {
      method: "POST",
      headers: original.headers,
      body: JSON.stringify(subscriptionEvent("customer.subscription.created", { status: "canceled" })),
    });
    const res = await POST(tampered);
    expect(res.status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("happy path: a valid subscription update is written to the matching customer", async () => {
    const res = await POST(
      signedRequest(subscriptionEvent("customer.subscription.updated", { cancel_at_period_end: true })),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        stripe_subscription_id: "sub_1",
        status: "active",
        cancel_at_period_end: true,
      }),
    );
    expect(mocks.eq).toHaveBeenCalledWith("stripe_customer_id", "cus_1");
  });

  it("handles an expanded customer object", async () => {
    const res = await POST(
      signedRequest(subscriptionEvent("customer.subscription.deleted", { customer: { id: "cus_2" }, status: "canceled" })),
    );
    expect(res.status).toBe(200);
    expect(mocks.eq).toHaveBeenCalledWith("stripe_customer_id", "cus_2");
  });

  it("returns 500 so Stripe retries when no customer row matches", async () => {
    mocks.select.mockResolvedValue({ data: [], error: null });
    const res = await POST(signedRequest(subscriptionEvent("customer.subscription.created")));
    expect(res.status).toBe(500);
  });

  it("returns 500 when the database update errors", async () => {
    mocks.select.mockResolvedValue({ data: null, error: { code: "XX000" } });
    const res = await POST(signedRequest(subscriptionEvent("customer.subscription.created")));
    expect(res.status).toBe(500);
  });

  it("acknowledges unrelated event types without touching the database", async () => {
    const res = await POST(signedRequest({ id: "evt_2", object: "event", type: "invoice.paid", data: { object: {} } }));
    expect(res.status).toBe(200);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
