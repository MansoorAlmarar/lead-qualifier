import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

// Stripe calls this route, not a logged-in user. The signature check is the protection.
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "Missing signature." }, { status: 400 });

  // Signature verification needs the exact raw body.
  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return Response.json({ error: "Invalid signature." }, { status: 400 });
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const sub = event.data.object as Stripe.Subscription;
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

    // The checkout route saved the customer id before payment, so match on it.
    const { data, error } = await createAdminClient()
      .from("subscriptions")
      .update({
        stripe_subscription_id: sub.id,
        status: sub.status,
        cancel_at_period_end: sub.cancel_at_period_end,
        updated_at: new Date().toISOString(),
      })
      .eq("stripe_customer_id", customerId)
      .select("user_id");

    if (error) {
      console.error("webhook update failed:", error.code, event.type);
      // 500 makes Stripe retry later.
      return Response.json({ error: "Could not update subscription." }, { status: 500 });
    }
    if (!data?.length) {
      // A subscription made outside the app. Retrying cannot help, so acknowledge it.
      console.warn("webhook: no matching customer, ignored", event.type);
    }
  }

  return Response.json({ received: true });
}
