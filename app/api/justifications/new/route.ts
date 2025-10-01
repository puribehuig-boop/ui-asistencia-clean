// app/api/justifications/new/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const session_id = Number(body.sessionId ?? 0);
  const reason = String(body.reason ?? "").trim();
  const evidence_path = body.evidencePath ? String(body.evidencePath) : null;

  if (!session_id || !reason) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("attendance_justifications")
    .insert({
      session_id,
      student_id: auth.user.id, // texto en tabla, uuid->text
      reason,
      evidence_path,
      status: "pending",
    })
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, id: data?.id ?? null });
}
