import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

const HAS_ACCESS = new Set(["active", "trialing"]);

// Stripe calls this route, not a logged-in user. The signature check is the protection.
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    // A config error, not a bad request. 500 makes Stripe retry once the secret is set.
    console.error("webhook: STRIPE_WEBHOOK_SECRET is not set");
    return Response.json({ error: "Webhook is not configured." }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "Missing signature." }, { status: 400 });

  // Signature verification needs the exact raw body.
  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, secret);
  } catch {
    return Response.json({ error: "Invalid signature." }, { status: 400 });
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    // Stripe does not promise event order, so the event's own copy can be older than one already
    // handled. Use the event only to learn which subscription changed, then ask Stripe for its
    // state right now. A canceled subscription can still be retrieved.
    let sub: Stripe.Subscription;
    try {
      sub = await getStripe().subscriptions.retrieve((event.data.object as Stripe.Subscription).id);
    } catch (err) {
      console.error("webhook: could not retrieve subscription:", err instanceof Error ? err.message : err);
      // 500 makes Stripe retry later.
      return Response.json({ error: "Could not read subscription." }, { status: 500 });
    }
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    const admin = createAdminClient();

    // The checkout route saved the customer id before payment, so match on it.
    const { data: row, error: readError } = await admin
      .from("subscriptions")
      .select("stripe_subscription_id, status")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    if (readError) {
      console.error("webhook read failed:", readError.code, event.type);
      return Response.json({ error: "Could not update subscription." }, { status: 500 });
    }
    if (!row) {
      // A subscription made outside the app. Retrying cannot help, so acknowledge it.
      console.warn("webhook: no matching customer, ignored", event.type);
      return Response.json({ received: true });
    }

    // One row per user holds one subscription. If it already holds a different one that gives
    // access, an event about another subscription of the same customer (for example a failed
    // first payment that later expires) must not overwrite it.
    if (row.stripe_subscription_id && row.stripe_subscription_id !== sub.id && HAS_ACCESS.has(row.status)) {
      console.warn("webhook: event for another subscription ignored", event.type);
      return Response.json({ received: true });
    }

    const { error } = await admin
      .from("subscriptions")
      .update({
        stripe_subscription_id: sub.id,
        status: sub.status,
        cancel_at_period_end: sub.cancel_at_period_end,
        updated_at: new Date().toISOString(),
      })
      .eq("stripe_customer_id", customerId);

    if (error) {
      console.error("webhook update failed:", error.code, event.type);
      // 500 makes Stripe retry later.
      return Response.json({ error: "Could not update subscription." }, { status: 500 });
    }
  }

  return Response.json({ received: true });
}
