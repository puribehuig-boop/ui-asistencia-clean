// app/api/sessions/create-manual/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

export const runtime = "nodejs";

// YYYYMMDD en zona MX
function yyyymmddMX(d = new Date()) {
  const ds = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d); // YYYY-MM-DD
  return ds.replaceAll("-", "");
}

// HHMMSS en zona MX
function hhmmssMX(d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Mexico_City",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const h = parts.find(p => p.type === "hour")?.value ?? "00";
  const m = parts.find(p => p.type === "minute")?.value ?? "00";
  const s = parts.find(p => p.type === "second")?.value ?? "00";
  return `${h}${m}${s}`;
}

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient();
  const url = new URL(req.url);
  const roomRaw = url.searchParams.get("room") || "";
  const room = roomRaw.trim();
  if (!room) {
    return NextResponse.redirect(new URL(`/scan/new?room=${encodeURIComponent(roomRaw)}&error=room_required`, req.url));
  }

  // Usuario autenticado
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth?.user) return NextResponse.redirect(new URL("/login", req.url));
  const uid = auth.user.id;

  // Intentar inferir group_id y start_planned (opcional)
  const now = new Date();
  const weekday = ((now.getDay() + 6) % 7) + 1; // 1..7 Lun..Dom
  let group_id: number | null = null;
  let start_planned: string | null = null;

  const { data: slots } = await supabase
    .from("schedule_slots")
    .select("group_id, start_time, room_code, weekday")
    .eq("weekday", weekday)
    .eq("room_code", room);

  if (Array.isArray(slots) && slots.length) {
    const candidates = slots
      .filter((s: any) => s.group_id)
      .map((s: any) => {
        const [h, m, sec] = String(s.start_time).split(":").map((x: string) => parseInt(x, 10));
        const slot = new Date(now);
        slot.setHours(h || 0, m || 0, sec || 0, 0);
        const diff = Math.abs(slot.getTime() - now.getTime());
        return { s, diff };
      })
      .sort((a, b) => a.diff - b.diff);

    if (candidates.length) {
      group_id = candidates[0].s.group_id as number;
      const hh = String(candidates[0].s.start_time).slice(0, 2);
      const mm = String(candidates[0].s.start_time).slice(3, 5);
      start_planned = `${hh}${mm}`; // HHMM
    }
  }

  // Generar session_code único (fecha+hora+manual) y reintentar si choca
  const datePart = yyyymmddMX(now);
  const timePart = hhmmssMX(now);
  let code = `${room}-${datePart}-${timePart}-manual`;
  let attempt = 0;
  let inserted: { id: number } | null = null;
  let lastErr: any = null;

  while (attempt < 3 && !inserted) {
    const { data, error } = await supabase
      .from("sessions")
      .insert({
        teacher_user_id: uid,
        session_date: new Date().toISOString().slice(0, 10),
        start_planned,                     // puede ser null
        started_at: new Date().toISOString(),
        is_manual: true,
        session_code: code,
        group_id,                          // puede ser null
        room_code: room,                   // NOT NULL en tu esquema
        status: "started",                 // ya normalizado con el CHECK
      })
      .select("id")
      .maybeSingle();

    if (!error && data) {
      inserted = data as any;
      break;
    }

    lastErr = error;
    // Si es clave duplicada (23505), reintenta con sufijo aleatorio corto
    if (error?.code === "23505") {
      const rand = Math.random().toString(36).slice(2, 6);
      code = `${room}-${datePart}-${timePart}-manual-${rand}`;
      attempt++;
      continue;
    }

    // Otros errores: abortar
    break;
  }

  if (!inserted) {
    const msg = encodeURIComponent(lastErr?.message || "insert_failed");
    return NextResponse.redirect(new URL(`/scan/new?room=${encodeURIComponent(room)}&error=${msg}`, req.url));
  }

  return NextResponse.redirect(new URL(`/teacher/sessions/${inserted.id}`, req.url));
}
