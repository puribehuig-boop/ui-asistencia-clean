import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/adminClient";

export const runtime = "nodejs";

function hhmmToTime(hhmm?: string | null) {
  if (!hhmm) return "";
  const m = hhmm.match(/^(\d{2})(\d{2})$/);
  if (!m) return hhmm;
  return `${m[1]}:${m[2]}`;
}
function toHHMMSS(s?: string | null) {
  if (!s) return "";
  if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s;
  if (/^\d{2}:\d{2}$/.test(s)) return `${s}:00`;
  if (/^\d{4}$/.test(s)) return `${s.slice(0,2)}:${s.slice(2)}:00`;
  return s || "";
}
function baseStartTs(s: any): Date {
  const sd = s?.session_date as string | null;
  let sp = s?.start_planned as string | null;
  const startedAt = s?.started_at as string | null;
  if (sp && /^\d{4}$/.test(sp)) sp = hhmmToTime(sp);
  if (sd && sp) return new Date(`${sd}T${sp}:00`);
  if (startedAt) return new Date(startedAt);
  return new Date();
}
function roomFromSessionCode(code?: string | null): string | null {
  if (!code) return null;
  const toks = code.split("-");
  const iDate = toks.findIndex(t => /^\d{8}$/.test(t));
  if (iDate > 0) return toks.slice(0, iDate).join("-");
  return toks[0] || null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const roomId = url.searchParams.get("roomId")?.trim();
  if (!roomId) {
    return NextResponse.json({ ok: false, error: "roomId requerido" }, { status: 400 });
  }

  // Settings (tolerancia)
  const { data: gs } = await supabaseAdmin
    .from("global_settings")
    .select("attendance_tolerance_min")
    .eq("id", 1)
    .maybeSingle();
  const tol = Number(gs?.attendance_tolerance_min ?? 15);

  // Hoy (simple, formato YYYY-MM-DD)
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  // 1) Buscar sesiones de HOY cuyo session_code empiece por "<roomId>-"
  let cand: any[] = [];
  {
    const { data, error } = await supabaseAdmin
      .from("sessions")
      .select("id, session_code, session_date, start_planned, started_at")
      .eq("session_date", today)
      .ilike("session_code", `${roomId}-%`);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    cand = data ?? [];
  }

  // Si no hay por código, probamos TODAS las de hoy (fallback)
  if (!cand.length) {
    const { data } = await supabaseAdmin
      .from("sessions")
      .select("id, session_code, session_date, start_planned, started_at")
      .eq("session_date", today);
    cand = data ?? [];
  }

  // Elegir la mejor por cercanía de hora y tolerancia; exigir que room del code sea el roomId si se puede
  let best: any = null;
  let bestAbs = Number.POSITIVE_INFINITY;

  for (const s of cand) {
    const room = roomFromSessionCode(s.session_code);
    if (room && room !== roomId) continue; // si el código tiene salón y no coincide, descártala
    const start = baseStartTs(s);
    const abs = Math.abs(now.getTime() - start.getTime());
    if (abs < bestAbs) { bestAbs = abs; best = s; }
  }

  if (!best) {
    return NextResponse.json({ ok: false, error: "No se encontró sesión para este salón hoy." }, { status: 404 });
  }

  // Checar ventana (± tolerancia)
  const start = baseStartTs(best);
  const from = new Date(start.getTime() - tol * 60_000);
  const to   = new Date(start.getTime() + tol * 60_000);
  const inside = now >= from && now <= to;

  // Redirigir siempre a la página del docente (si está dentro o cerca, mucho mejor)
  const dest = new URL(`/teacher/sessions/${best.id}`, url.origin);
  return NextResponse.redirect(dest, { status: 302 });
}
