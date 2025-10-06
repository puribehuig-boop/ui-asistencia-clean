// app/api/staff/admissions/prospects/[id]/enroll/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";
import { supabaseAdmin } from "@/lib/supabase/adminClient"; // service role

export const dynamic = "force-dynamic";
export const revalidate = 0;

function randomPassword() {
  return Math.random().toString(36).slice(-10) + "A1!";
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const s = createSupabaseServerClient();

  // Guard: solo admin/admissions
  const { data: auth } = await s.auth.getUser();
  if (!auth?.user) return NextResponse.json({ ok:false, error: "unauthorized" }, { status: 401 });

  const { data: me } = await s.from("profiles").select("role").eq("user_id", auth.user.id).maybeSingle();
  const role = (me?.role ?? "").toLowerCase();
  if (!["admin","admissions"].includes(role)) {
    return NextResponse.json({ ok:false, error: "forbidden" }, { status: 403 });
  }

  const prospectId = Number(params.id || 0);
  if (!prospectId) return NextResponse.json({ ok:false, error: "bad_id" }, { status: 400 });

  // Traer prospecto con programa/periodo
  const { data: pr } = await s
    .from("prospects")
    .select("id, full_name, email, phone, stage, program_id, term_id")
    .eq("id", prospectId)
    .maybeSingle();

  if (!pr) return NextResponse.json({ ok:false, error: "not_found" }, { status: 404 });
  if (pr.stage !== "inscrito")
    return NextResponse.json({ ok:false, error: "stage_must_be_inscrito" }, { status: 400 });
  if (!pr.program_id || !pr.term_id)
    return NextResponse.json({ ok:false, error: "missing_program_or_term" }, { status: 400 });
  if (!pr.email)
    return NextResponse.json({ ok:false, error: "missing_email" }, { status: 400 });

  // 1) Reutilizar o crear usuario/auth + profiles (rol alumno)
  let userId: string | null = null;

  // ¿Ya existe en profiles por email?
  const { data: existingProfile } = await s
    .from("profiles")
    .select("user_id, email, role")
    .eq("email", pr.email.toLowerCase())
    .maybeSingle();

  if (existingProfile?.user_id) {
    userId = existingProfile.user_id;
    // asegurar rol alumno (no pisamos admin/docente)
    if (existingProfile.role !== "alumno") {
      await s.from("profiles").update({ role: existingProfile.role ?? "alumno" }).eq("user_id", userId);
    }
  } else {
    // Crear usuario en auth con service role (email confirmado)
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: pr.email.toLowerCase(),
      email_confirm: true,
      password: randomPassword(),
      user_metadata: { full_name: pr.full_name ?? null, origin: "admissions_convert" },
    });

    if (createErr || !created.user?.id) {
      return NextResponse.json({ ok:false, error: createErr?.message ?? "cannot_create_auth_user" }, { status: 500 });
    }
    userId = created.user.id;

    // Insert profiles
    const { error: pErr } = await s.from("profiles").insert({
      user_id: userId,
      email: pr.email.toLowerCase(),
      role: "alumno",
    });
    if (pErr) return NextResponse.json({ ok:false, error: pErr.message }, { status: 500 });
  }

  // 2) StudentProfile (upsert)
  const { error: spErr } = await s
    .from("StudentProfile")
    .upsert({
      userId: userId,
      fullName: pr.full_name ?? pr.email, // ajusta al esquema exacto (fullName vs display_name, etc.)
    }, { onConflict: "userId" });
  if (spErr) return NextResponse.json({ ok:false, error: spErr.message }, { status: 500 });

  // 3) Alta académica mínima: students_enrolled (idempotente por unique)
  const { error: seErr } = await s.from("students_enrolled").insert({
    student_user_id: userId,
    program_id: pr.program_id,
    term_id: pr.term_id,
    source_prospect_id: pr.id,
    status: "active",
  });
  if (seErr && !seErr.message.includes("duplicate key")) {
    return NextResponse.json({ ok:false, error: seErr.message }, { status: 500 });
  }

  // 4) Placeholder de caja (idempotente aproximado: no unique, pero aceptable para MVP)
  await s.from("student_accounts_placeholder").insert({
    student_user_id: userId,
    term_id: pr.term_id,
    status: "pendiente",
  });

  // (Opcional) marca prospecto como convertido (timestamp)
  await s.from("prospects").update({ /* converted_at: new Date().toISOString() */ }).eq("id", pr.id);

  return NextResponse.redirect(new URL(`/staff/control-escolar/alumnos?email=${encodeURIComponent(pr.email)}`, req.url));
}
