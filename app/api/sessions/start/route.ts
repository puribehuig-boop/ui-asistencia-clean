import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ ok:false, error:"unauthenticated" }, { status:401 });

  let session_id: number | null = null;
  const ct = req.headers.get("content-type") || "";
  try {
    if (ct.includes("application/json")) {
      const body = await req.json();
      session_id = Number(body?.session_id);
    } else {
      const form = await req.formData();
      session_id = Number(form.get("session_id"));
    }
  } catch {}
  if (!Number.isFinite(session_id)) {
    return NextResponse.json({ ok:false, error:"invalid_session_id" }, { status:400 });
  }

  const { data: inserted, error } = await supabase
  .from("sessions")
  .insert({
    teacher_user_id: uid,
    session_date: new Date().toISOString().slice(0, 10),
    start_planned,               // puede ser null
    started_at: new Date().toISOString(),
    is_manual: true,
    session_code: code,
    group_id,                    // puede ser null
    room_code: room,
    status: "started",           // ⬅️ aquí
  })
  .select("id")
  .maybeSingle();


  if (error) return NextResponse.json({ ok:false, error: error.message }, { status:400 });
  return NextResponse.json({ ok:true });
}

