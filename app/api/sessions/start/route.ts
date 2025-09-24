// app/api/sessions/start/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const session_id = Number(body?.session_id);
  if (!Number.isFinite(session_id)) return NextResponse.json({ ok: false, error: "invalid_session_id" }, { status: 400 });

  const { error } = await supabase
    .from("sessions")
    .update({ started_at: new Date().toISOString() })
    .eq("id", session_id)
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
