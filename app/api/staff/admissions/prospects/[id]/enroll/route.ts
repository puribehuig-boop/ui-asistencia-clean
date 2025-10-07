// app/api/staff/admissions/prospects/[id]/enroll/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";
import { supabaseAdmin } from "@/lib/supabase/adminClient"; // SERVICE ROLE

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

  const { data: me } = await s
    .from("profiles")
    .select("role")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  const role = (me?.role ?? "").toLowerCase();
  if (!["admin","admissions"].includes(role)) {
    return NextResponse.json({ ok:false, error: "forbidden" }, { status: 403 });
  }

  const prospectId = Number(params.id || 0);
  if (!prospectId) return NextResponse.json({ ok:false, error: "bad_id" }, { status: 400 });

  // 1) Traer prospecto con programa/periodo
  const { data: pr, error: pErr } = await s
    .from("prospects")
    .select("id, full_name, email, phone, stage, program_id, term_id")
    .eq("id", prospectId)
    .maybeSingle();

  if (pErr) return NextResponse.json({ ok:false, error: pErr.message }, { status: 500 });
  if (!pr) return NextResponse.json({ ok:false, error: "not_found" }, { status: 404 });
  if (pr.stage !== "inscrito")
    return NextResponse.json({ ok:false, error: "stage_must_be_inscrito" }, { status: 400 });
  if (!pr.program_id || !pr.term_id)
    return NextResponse.json({ ok:false, error: "missing_program_or_term" }, { status: 400 });
  if (!pr.email)
    return NextResponse.json({ ok:false, error: "missing_email" }, { status: 400 });

  // 2) Reutilizar o crear usuario/auth
  let userId: string | null = null;

  // ¿Ya existe profile por email?
  const { data: existingProfile } = await s
    .from("profiles")
    .select("user_id, email, role")
    .eq("email", pr.email.toLowerCase())
    .maybeSingle();

  if (existingProfile?.user_id) {
    userId = existingProfile.user_id;

    // Si NO es admin, forzamos a 'alumno'
    if ((existingProfile.role ?? "").toLowerCase() !== "admin") {
      const { error: updErr } = await supabaseAdmin
        .from("profiles")
        .update({ role: "alumno" })
        .eq("user_id", userId);
      if (updErr) return NextResponse.json({ ok:false, error: updErr.message }, { status: 500 });
    }
  } else {
    // Crear usuario en auth con SERVICE ROLE
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

    // Upsert de profiles con SERVICE ROLE (omite RLS) → rol alumno
    const { error: upErr } = await supabaseAdmin
      .from("profiles")
      .upsert(
        { user_id: userId, email: pr.email.toLowerCase(), role: "alumno" },
        { onConflict: "user_id" }
      );
    if (upErr) return NextResponse.json({ ok:false, error: upErr.message }, { status: 500 });
  }

  // 3) Upsert de StudentProfile con SERVICE ROLE
  const { error: spErr } = await supabaseAdmin
    .from("StudentProfile")
    .upsert(
      {
        userId: userId,
        fullName: pr.full_name ?? pr.email, // ajusta si usas otro modelo
      },
      { onConflict: "userId" }
    );
  if (spErr) return NextResponse.json({ ok:false, error: spErr.message }, { status: 500 });

  // 4) Alta académica en ProgramEnrollment (histórico)
  const { error: peErr } = await supabaseAdmin
    .from("ProgramEnrollment")
    .insert({
      studentUserId: userId,
      programId: pr.program_id,
      termId: pr.term_id,
      sourceProspectId: pr.id,
      status: "active",
    });
  if (peErr && !peErr.message.includes("duplicate key")) {
    return NextResponse.json({ ok:false, error: peErr.message }, { status: 500 });
  }

  // 5) (Opcional) placeholder de caja
  await supabaseAdmin.from("student_accounts_placeholder").insert({
    student_user_id: userId,
    term_id: pr.term_id,
    status: "pendiente",
  });

  // 6) Redirige a listado de alumnos con filtro por email
  return NextResponse.redirect(
    new URL(`/staff/control-escolar/alumnos?email=${encodeURIComponent(pr.email)}`, req.url)
  );
}
