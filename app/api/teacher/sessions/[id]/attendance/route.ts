// app/api/teacher/sessions/[id]/attendance/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/adminClient";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const sessionId = Number(params.id);
  if (!Number.isFinite(sessionId)) {
    return NextResponse.json({ ok: false, error: "sessionId inválido" }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin
    .from("attendance")
    .select("id, student_id, student_name, status, updated_at")
    .eq("session_id", sessionId)
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, items: data ?? [] });
}
