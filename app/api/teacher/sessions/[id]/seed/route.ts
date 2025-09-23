// app/api/teacher/sessions/[id]/seed/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase/adminClient";

export const runtime = "nodejs";

/**
 * POST JSON:
 * { "groupId": number }
 * - Crea filas en `attendance` (si no existen) para todos los alumnos inscritos en ese Group.
 * - status inicial: "Ausente"
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const sessionId = Number(params.id);
    if (!Number.isFinite(sessionId)) {
      return NextResponse.json({ ok: false, error: "sessionId inválido" }, { status: 400 });
    }
    const body = await req.json().catch(() => ({}));
    const groupId = Number(body?.groupId);
    if (!Number.isFinite(groupId) || groupId <= 0) {
      return NextResponse.json({ ok: false, error: "groupId inválido" }, { status: 400 });
    }

    // 1) Leer alumnos del grupo via Prisma
    const enrollments = await prisma.enrollment.findMany({
      where: { groupId },
      include: {
        student: true, // asumiendo: Enrollment.student -> StudentProfile
      },
    });

    // 2) Insertar faltantes en Supabase.attendance
    // Intentamos obtener nombre desde las posibles columnas; si no hay, usamos "ID:<id>"
    const toName = (sp: any) => sp?.fullName ?? sp?.full_name ?? sp?.name ?? `ID:${sp?.id ?? ""}`;

    const inserts = [];
    for (const e of enrollments) {
      const sid = Number(e.studentId);
      const sname = toName(e.student);

      // ¿ya existe?
      const { data: existing } = await supabaseAdmin
        .from("attendance")
        .select("id")
        .eq("session_id", sessionId)
        .eq("student_id", sid)
        .maybeSingle();

      if (!existing?.id) {
        inserts.push({
          session_id: sessionId,
          student_id: sid,
          student_name: sname,
          status: "Ausente", // inicial
          updated_at: new Date().toISOString(),
          updated_by: "seed",
        });
      }
    }

    let inserted: any[] = [];
    if (inserts.length > 0) {
      const { data, error } = await supabaseAdmin
        .from("attendance")
        .insert(inserts)
        .select();
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      inserted = data ?? [];
    }

    return NextResponse.json({ ok: true, inserted: inserted.length, total: enrollments.length });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
