// app/api/attendance/set/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";
import { prisma } from "@/lib/prisma";
import { parseFromSessionCode } from "@/lib/session";

export const runtime = "nodejs";

/**
 * Espera JSON:
 * {
 *   "sessionCode": "ABC-123",
 *   "status": "present" | "absent" | "late",
 *   "studentId": number (opcional; si omites, inferimos por auth en el futuro)
 * }
 */
export async function POST(req: Request) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: userRes, error: authError } = await supabase.auth.getUser();
    if (authError) {
      return NextResponse.json({ ok: false, error: authError.message }, { status: 401 });
    }
    if (!userRes?.user) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
    }

    const body = (await req.json()) as {
      sessionCode?: string;
      status?: "present" | "absent" | "late";
      studentId?: number;
    };

    const sessionCode = (body.sessionCode || "").trim();
    const status = body.status || "present";

    if (!sessionCode) {
      return NextResponse.json({ ok: false, error: "sessionCode requerido" }, { status: 400 });
    }

    // Parseamos el código de la sesión (helper del repo limpio)
    const parsed = parseFromSessionCode(sessionCode);
    if (!parsed) {
      return NextResponse.json({ ok: false, error: "sessionCode inválido" }, { status: 400 });
    }
    // parsed típicamente trae: { termId, groupCode, subjectCode, startsAt? ... }
    // Ajusta según tu implementación de lib/session.ts
    const meta = parsed as any;

    // Determina quién actualiza (email del usuario autenticado)
    let updated_by: string | null = null;
    const user = userRes.user;
    if (user?.email) updated_by = user.email;

    // TODO: aquí persiste la asistencia según tu modelo:
    // - Si tienes tabla Attendance, AttendanceEntry, etc., inserta/actualiza.
    // A falta del modelo exacto, te dejo un ejemplo NO destructivo:

    // Ejemplo: guarda un registro en una tabla de bitácora temporal (si existe)
    // await prisma.attendance.create({
    //   data: {
    //     termId: meta.termId,
    //     groupCode: meta.groupCode,
    //     subjectCode: meta.subjectCode,
    //     status,
    //     studentId: body.studentId ?? null,
    //     updatedBy: updated_by,
    //     createdAt: new Date(),
    //   },
    // });

    // Por ahora, solo respondemos lo interpretado (para que la UI avance)
    return NextResponse.json({
      ok: true,
      session: meta,
      status,
      updated_by,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
