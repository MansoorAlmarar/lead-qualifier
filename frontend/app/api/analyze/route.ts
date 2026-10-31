import { tasks } from "@trigger.dev/sdk";
import { leadSchema } from "@/lib/schema";
import { PENDING_TTL_MS, getUsage, startOfDubaiDay } from "@/lib/billing";
import { BodyTooLargeError, readLimitedText } from "@/lib/body";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Please log in." }, { status: 401 });

  if (!rateLimit(user.id)) {
    return Response.json({ error: "Too many requests. Try again in a minute." }, { status: 429 });
  }

  let body: unknown = null;
  try {
    body = JSON.parse(await readLimitedText(request));
  } catch (err) {
    if (err instanceof BodyTooLargeError) {
      return Response.json({ error: "Request is too large." }, { status: 413 });
    }
  }
  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid lead" },
      { status: 400 },
    );
  }

  const { limit } = await getUsage(supabase);

  // One database step checks the daily limit and writes the history row together.
  // The row exists before the task starts, so a failed insert never costs an LLM call.
  const { data: rowId, error: claimError } = await supabase.rpc("claim_analysis", {
    p_lead: parsed.data,
    p_limit: limit,
    p_since: startOfDubaiDay().toISOString(),
    p_stale_before: new Date(Date.now() - PENDING_TTL_MS).toISOString(),
  });
  if (claimError) {
    console.error("claim failed:", claimError.code);
    return Response.json({ error: "Could not start the analysis." }, { status: 502 });
  }
  if (!rowId) {
    return Response.json(
      {
        error: `You have used your ${limit} free analyses for today. Upgrade to Pro for unlimited runs.`,
        code: "limit_reached",
      },
      { status: 402 },
    );
  }

  const admin = createAdminClient();
  try {
    const handle = await tasks.trigger("qualify-lead", parsed.data);
    const { error } = await admin
      .from("lead_history")
      .update({ run_id: handle.id })
      .eq("id", rowId)
      .eq("user_id", user.id);
    if (error) throw new Error(`run id update failed: ${error.code}`);
    return Response.json({ runId: handle.id });
  } catch (err) {
    console.error("trigger failed:", err instanceof Error ? err.message : err);
    // Failed rows do not count against the limit, so the user keeps the attempt.
    await admin.from("lead_history").update({ status: "failed" }).eq("id", rowId).eq("user_id", user.id);
    return Response.json({ error: "Could not start the analysis." }, { status: 502 });
  }
}
