import { runs } from "@trigger.dev/sdk";
import type { NextRequest } from "next/server";
import type { QualificationResult, RunState } from "@/lib/schema";

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

  try {
    const run = await runs.retrieve(id);
    let state: RunState;
    if (run.status === "COMPLETED") {
      state = { status: "done", result: run.output as QualificationResult };
    } else if (FAILED.has(run.status)) {
      state = { status: "failed" };
    } else {
      state = { status: "pending" };
    }
    return Response.json(state);
  } catch {
    return Response.json({ error: "Could not read the run." }, { status: 502 });
  }
}
