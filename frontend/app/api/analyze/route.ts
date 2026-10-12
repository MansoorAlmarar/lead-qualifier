import { tasks } from "@trigger.dev/sdk";
import { leadSchema } from "@/lib/schema";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(ip)) {
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
    return Response.json({ runId: handle.id });
  } catch (err) {
    console.error("trigger failed:", err instanceof Error ? err.message : err);
    return Response.json({ error: "Could not start the analysis." }, { status: 502 });
  }
}
