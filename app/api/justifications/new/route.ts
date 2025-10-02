// app/api/justifications/new/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const { sessionId, reason, evidencePath } = await req.json();
    const session_id = Number(sessionId || 0);
    if (!session_id || !reason?.trim()) {
      return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
    }

    // --- Claves del alumno sólo con columnas existentes ---
    // Usamos student_id como texto: su UUID y, si existe, su StudentProfile.id en texto.
    const candidateIds: string[] = [auth.user.id];

    const { data: sp } = await supabase
      .from("StudentProfile")
      .select("id")
      .eq("userId", auth.user.id)
      .maybeSingle();

    if (sp?.id != null) candidateIds.push(String(sp.id));

    // 1) ¿Ya existe una justificación para esta sesión/alumno?
    const { data: existing } = await supabase
      .from("attendance_justifications")
      .select("id, status")
      .eq("session_id", session_id)
      .in("student_id", candidateIds)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ ok: false, error: "already_exists" }, { status: 409 });
    }

    // 2) Crear (status 'pending') usando student_id = UUID del usuario
    const { error: insErr } = await supabase.from("attendance_justifications").insert({
      session_id,
      student_id: auth.user.id,        // <- clave canónica como TEXTO
      reason: String(reason),
      evidence_path: evidencePath || null,
      status: "pending",
    } as any);

    if (insErr) throw insErr;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 }
    );
  }
}
