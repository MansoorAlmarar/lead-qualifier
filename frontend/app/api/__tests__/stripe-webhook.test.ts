import Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Test fixtures only. Nothing here is a real key and no request leaves the process.
const WEBHOOK_SECRET = "whsec_test_placeholder";
const stripe = new Stripe("sk_test_placeholder");

const mocks = vi.hoisted(() => ({
  retrieve: vi.fn(),
  readRow: vi.fn(),
  readEq: vi.fn(),
  update: vi.fn(),
  updateEq: vi.fn(),
}));

// Real signature checking, but the subscription lookup is stubbed so nothing calls Stripe.
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({ webhooks: stripe.webhooks, subscriptions: { retrieve: mocks.retrieve } }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({ eq: mocks.readEq.mockReturnValue({ maybeSingle: mocks.readRow }) }),
      update: mocks.update.mockReturnValue({ eq: mocks.updateEq }),
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

const subscription = (overrides: object = {}) => ({
  id: "sub_1",
  object: "subscription",
  customer: "cus_1",
  status: "active",
  cancel_at_period_end: false,
  ...overrides,
});

const subscriptionEvent = (type: string, overrides: object = {}) => ({
  id: "evt_1",
  object: "event",
  type,
  data: { object: subscription(overrides) },
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", WEBHOOK_SECRET);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  // By default Stripe's current state equals the event, and the row is new (no subscription yet).
  mocks.retrieve.mockImplementation(async (id: string) => subscription({ id }));
  mocks.readRow.mockResolvedValue({ data: { stripe_subscription_id: null, status: "none" }, error: null });
  mocks.updateEq.mockResolvedValue({ error: null });
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
    expect(mocks.retrieve).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("returns 500, not 400, when the webhook secret is not configured", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    const res = await POST(signedRequest(subscriptionEvent("customer.subscription.created")));
    expect(res.status).toBe(500);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("happy path: the current subscription is written to the matching customer", async () => {
    mocks.retrieve.mockResolvedValue(subscription({ cancel_at_period_end: true }));
    const res = await POST(
      signedRequest(subscriptionEvent("customer.subscription.updated", { cancel_at_period_end: true })),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
    expect(mocks.retrieve).toHaveBeenCalledWith("sub_1");
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        stripe_subscription_id: "sub_1",
        status: "active",
        cancel_at_period_end: true,
      }),
    );
    expect(mocks.updateEq).toHaveBeenCalledWith("stripe_customer_id", "cus_1");
  });

  it("out-of-order event: writes Stripe's current state, not the older copy in the event", async () => {
    // An old "incomplete" event arrives after the subscription already became active.
    mocks.readRow.mockResolvedValue({ data: { stripe_subscription_id: "sub_1", status: "active" }, error: null });
    mocks.retrieve.mockResolvedValue(subscription({ status: "active" }));
    const res = await POST(signedRequest(subscriptionEvent("customer.subscription.updated", { status: "incomplete" })));
    expect(res.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ status: "active" }));
    expect(mocks.update).not.toHaveBeenCalledWith(expect.objectContaining({ status: "incomplete" }));
  });

  it("second subscription: does not overwrite a different subscription that is active", async () => {
    // sub_1 is the paid one. sub_old was a failed first payment that has now expired.
    mocks.readRow.mockResolvedValue({ data: { stripe_subscription_id: "sub_1", status: "active" }, error: null });
    mocks.retrieve.mockResolvedValue(subscription({ id: "sub_old", status: "incomplete_expired" }));
    const res = await POST(
      signedRequest(subscriptionEvent("customer.subscription.updated", { id: "sub_old", status: "incomplete_expired" })),
    );
    expect(res.status).toBe(200);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("second subscription: replaces a stored subscription that no longer gives access", async () => {
    mocks.readRow.mockResolvedValue({ data: { stripe_subscription_id: "sub_old", status: "canceled" }, error: null });
    mocks.retrieve.mockResolvedValue(subscription({ id: "sub_2" }));
    const res = await POST(signedRequest(subscriptionEvent("customer.subscription.created", { id: "sub_2" })));
    expect(res.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ stripe_subscription_id: "sub_2", status: "active" }),
    );
  });

  it("handles an expanded customer object", async () => {
    mocks.retrieve.mockResolvedValue(subscription({ customer: { id: "cus_2" }, status: "canceled" }));
    const res = await POST(signedRequest(subscriptionEvent("customer.subscription.deleted", { status: "canceled" })));
    expect(res.status).toBe(200);
    expect(mocks.readEq).toHaveBeenCalledWith("stripe_customer_id", "cus_2");
    expect(mocks.updateEq).toHaveBeenCalledWith("stripe_customer_id", "cus_2");
  });

  it("returns 200 and logs a warning when no customer row matches", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.readRow.mockResolvedValue({ data: null, error: null });
    const res = await POST(signedRequest(subscriptionEvent("customer.subscription.created")));
    expect(res.status).toBe(200);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("no matching customer"), "customer.subscription.created");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("returns 500 when Stripe cannot return the subscription, so Stripe retries", async () => {
    mocks.retrieve.mockRejectedValue(new Error("network"));
    const res = await POST(signedRequest(subscriptionEvent("customer.subscription.created")));
    expect(res.status).toBe(500);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("returns 500 when the database read errors", async () => {
    mocks.readRow.mockResolvedValue({ data: null, error: { code: "XX000" } });
    const res = await POST(signedRequest(subscriptionEvent("customer.subscription.created")));
    expect(res.status).toBe(500);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("returns 500 when the database update errors", async () => {
    mocks.updateEq.mockResolvedValue({ error: { code: "XX000" } });
    const res = await POST(signedRequest(subscriptionEvent("customer.subscription.created")));
    expect(res.status).toBe(500);
  });

  it("acknowledges unrelated event types without touching Stripe or the database", async () => {
    const res = await POST(signedRequest({ id: "evt_2", object: "event", type: "invoice.paid", data: { object: {} } }));
    expect(res.status).toBe(200);
    expect(mocks.retrieve).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
