import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Please log in." }, { status: 401 });

  // Row-level security returns only this user's row.
  const { data: sub } = await supabase.from("subscriptions").select("stripe_customer_id").maybeSingle();
  if (!sub) return Response.json({ error: "No subscription found." }, { status: 404 });

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${new URL(request.url).origin}/`,
    });
    return Response.json({ url: session.url });
  } catch (err) {
    console.error("portal failed:", err instanceof Error ? err.message : err);
    return Response.json({ error: "Could not open the billing portal." }, { status: 502 });
  }
}
