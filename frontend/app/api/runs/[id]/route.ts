import { runs } from "@trigger.dev/sdk";
import type { NextRequest } from "next/server";
import { resultSchema, type RunState } from "@/lib/schema";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const FAILED = new Set([
  "FAILED",
  "CRASHED",
  "SYSTEM_FAILURE",
  "CANCELED",
  "TIMED_OUT",
  "EXPIRED",
  "INTERRUPTED",
]);

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/runs/[id]">) {
  const { id } = await ctx.params;
  if (!/^run_[a-z0-9]+$/i.test(id)) {
    return Response.json({ error: "Invalid run id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Please log in." }, { status: 401 });

  // Row-level security means this only finds the caller's own runs.
  const { data: row } = await supabase
    .from("lead_history")
    .select("status, result")
    .eq("run_id", id)
    .maybeSingle();
  if (!row) return Response.json({ error: "Run not found." }, { status: 404 });

  if (row.status === "done") {
    return Response.json({ status: "done", result: row.result } satisfies RunState);
  }
  if (row.status === "failed") {
    return Response.json({ status: "failed" } satisfies RunState);
  }

  try {
    const run = await runs.retrieve(id);
    // Writes use the admin client, so a user cannot change the stored result of their own run.
    // The row was already found with the user's own client above, so it is theirs.
    const admin = createAdminClient();
    let state: RunState;
    // Check the output before saving it. A malformed result is a failed run.
    const output = run.status === "COMPLETED" ? resultSchema.safeParse(run.output) : null;
    if (output?.success) {
      state = { status: "done", result: output.data };
      await admin.from("lead_history").update({ status: "done", result: output.data }).eq("run_id", id);
    } else if (output || FAILED.has(run.status)) {
      state = { status: "failed" };
      await admin.from("lead_history").update({ status: "failed" }).eq("run_id", id);
    } else {
      state = { status: "pending" };
    }
    return Response.json(state);
  } catch {
    return Response.json({ error: "Could not read the run." }, { status: 502 });
  }
}
