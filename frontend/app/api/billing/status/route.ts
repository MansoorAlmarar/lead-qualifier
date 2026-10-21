import { getUsage } from "@/lib/billing";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Please log in." }, { status: 401 });

  return Response.json(await getUsage(supabase));
}
