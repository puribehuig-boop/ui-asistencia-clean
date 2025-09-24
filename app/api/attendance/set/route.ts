// app/api/attendance/set/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

export const runtime = "nodejs";

type Update = {
  session_id: number;
  student_id: string | number;
  status: "Presente" | "Tarde" | "Ausente" | "Justificado";
  student_name?: string; // requerido en inserts si tu tabla lo exige NOT NULL
};

function assertStatus(s: string): Update["status"] {
  const norm = String(s || "").trim();
  const ok = ["Presente", "Tarde", "Ausente", "Justificado"];
  if (!ok.includes(norm)) throw new Error("invalid_status");
  return norm as Update["status"];
}

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient();

  // 1) usuario autenticado (RLS aplica)
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth?.user) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }

  // 2) payload: soporta uno o varios updates
  let body: any;
  try { body = await req.json(); } catch { body = null; }
  if (!body) return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });

  const updates: Update[] = Array.isArray(body?.updates)
    ? body.updates
    : (body?.session_id ? [body as Update] : []);

  if (!updates.length) {
    return NextResponse.json({ ok: false, error: "no_updates" }, { status: 400 });
  }

  // 3) normaliza/valida y exige student_name en INSERTs (si hace falta)
  //    Para saber si es insert o update, nos apoyamos en onConflict y en la existencia previa.
  //    Simplificamos: si no viene student_name, intentamos continuar; si el DB lo exige y no existe, fallará con 23502 (NOT NULL).
  const rows = updates.map((u) => ({
    session_id: Number(u.session_id),
    student_id: u.student_id,
    status: assertStatus(u.status),
    student_name: u.student_name ?? null,
  }));

  // 4) upsert bajo RLS (onConflict por par lógico)
  const { data, error } = await supabase
  .from("attendance")
  .upsert(rows, {
    onConflict: "session_id,student_id",
    ignoreDuplicates: false,
    defaultToNull: false,
  })
  .select(); // devuelve las filas afectadas


  if (error) {
    // Mensajes amables para errores comunes
    const msg =
      error.code === "23514" ? "status_not_allowed" : // CHECK o RLS
      error.code === "23503" ? "foreign_key_violation" :
      error.code === "23502" ? "missing_required_field" :
      error.message;

    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }

  // 5) Info de ventana (útil para UI)
  // Nota: usamos RPC para hora efectiva + settings
  const sessionId = rows[0].session_id;

const [effRes, gsRes] = await Promise.all([
  supabase.rpc("session_effective_start", { p_session_id: sessionId }),
  supabase.from("global_settings")
    .select("attendance_tolerance_min")
    .eq("id", 1)
    .maybeSingle(),
]);

const effErr = (effRes as any)?.error;
const effData = (effRes as any)?.data ?? null;
if (effErr) {
  // No interrumpas la respuesta si la RPC falla; simplemente no habrá ventana calculada
  // console.error("RPC session_effective_start error:", effErr);
}

const tol = Number(gsRes.data?.attendance_tolerance_min ?? 15);
const start_effective = effData ? String(effData) : null;


  return NextResponse.json({
    ok: true,
    records: data ?? [],
    window: start_effective
      ? {
          start_effective,
          from: new Date(new Date(start_effective).getTime() - tol * 60 * 1000).toISOString(),
          to:   new Date(new Date(start_effective).getTime() + tol * 60 * 1000).toISOString(),
          tolerance_min: tol,
        }
      : null,
  });
}
