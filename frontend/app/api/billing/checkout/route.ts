import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Please log in." }, { status: 401 });

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("subscriptions")
    .select("stripe_customer_id, status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing && (existing.status === "active" || existing.status === "trialing")) {
    return Response.json({ error: "You already have a Pro subscription." }, { status: 409 });
  }

  try {
    let customerId = existing?.stripe_customer_id;
    if (!customerId) {
      const customer = await getStripe().customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      // Upsert, not insert: a second checkout at the same moment must not fail.
      // The first saved customer wins, so read it back and use that one.
      const { data: saved, error } = await admin
        .from("subscriptions")
        .upsert({ user_id: user.id, stripe_customer_id: customer.id }, { onConflict: "user_id", ignoreDuplicates: true })
        .select("stripe_customer_id")
        .maybeSingle();
      if (error) throw new Error(`subscription row upsert failed: ${error.code}`);
      customerId = saved?.stripe_customer_id;
      if (!customerId) {
        const { data: winner } = await admin
          .from("subscriptions")
          .select("stripe_customer_id")
          .eq("user_id", user.id)
          .maybeSingle();
        customerId = winner?.stripe_customer_id;
      }
      if (!customerId) throw new Error("subscription row missing after upsert");
    }

    const origin = new URL(request.url).origin;
    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
      subscription_data: { metadata: { supabase_user_id: user.id } },
      success_url: `${origin}/?upgraded=1`,
      cancel_url: `${origin}/`,
    });
    return Response.json({ url: session.url });
  } catch (err) {
    console.error("checkout failed:", err instanceof Error ? err.message : err);
    return Response.json({ error: "Could not start checkout." }, { status: 502 });
  }
}
