import { tasks } from "@trigger.dev/sdk";
import { leadSchema } from "@/lib/schema";
import { rateLimit } from "@/lib/rate-limit";
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

  const body = await request.json().catch(() => null);
  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid lead" },
      { status: 400 },
    );
  }

  try {
    const handle = await tasks.trigger("qualify-lead", parsed.data);
    const { error } = await supabase
      .from("lead_history")
      .insert({ user_id: user.id, run_id: handle.id, lead: parsed.data });
    if (error) throw new Error(`history insert failed: ${error.code}`);
    return Response.json({ runId: handle.id });
  } catch (err) {
    console.error("trigger failed:", err instanceof Error ? err.message : err);
    return Response.json({ error: "Could not start the analysis." }, { status: 502 });
  }
}
