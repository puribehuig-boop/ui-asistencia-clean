// app/api/sessions/create-manual/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

export const runtime = "nodejs";

function yyyymmddMX(d = new Date()) {
  const tz = "America/Mexico_City";
  const ds = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d); // YYYY-MM-DD
  return ds.replaceAll("-", "");
}

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient();
  const url = new URL(req.url);
  const room = url.searchParams.get("room") || "";

  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth?.user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  const uid = auth.user.id;

  // Intentar inferir group_id y hora planificada según slot más cercano
  const now = new Date();
  const weekday = ((now.getDay() + 6) % 7) + 1; // 1..7 Lun..Dom
  let group_id: number | null = null;
  let start_planned: string | null = null;

  // Buscar slots del salón para hoy y tomar el más cercano en tiempo
  const { data: slots } = await supabase
    .from("schedule_slots")
    .select("group_id, start_time, room_code, weekday")
    .eq("weekday", weekday)
    .ilike("room_code", room || "%");

  if (slots && slots.length) {
    // Elegir el slot más próximo a ahora (por diferencia absoluta)
    const candidates = slots
      .filter((s) => s.group_id)
      .map((s) => {
        const [h, m, sec] = String(s.start_time).split(":").map((x: string) => parseInt(x, 10));
        const slot = new Date(now);
        slot.setHours(h || 0, m || 0, sec || 0, 0);
        const diff = Math.abs(slot.getTime() - now.getTime());
        return { s, diff };
      })
      .sort((a, b) => a.diff - b.diff);

    if (candidates.length) {
      group_id = candidates[0].s.group_id as number;
      // guardar HHMM
      const hh = String(candidates[0].s.start_time).slice(0, 2);
      const mm = String(candidates[0].s.start_time).slice(3, 5);
      start_planned = `${hh}${mm}`;
    }
  }

  const code = `${room || "ROOM"}-${yyyymmddMX(now)}-manual`;

  // Insertar sesión manual (RLS: teacher_user_id debe ser = auth.uid())
  const { data: inserted, error } = await supabase
    .from("sessions")
    .insert({
      teacher_user_id: uid,
      session_date: new Date().toISOString().slice(0, 10),
      start_planned,         // puede quedar null
      started_at: new Date().toISOString(),
      is_manual: true,
      session_code: code,
      group_id,              // puede quedar null
    })
    .select("id")
    .maybeSingle();

  if (error || !inserted) {
    return NextResponse.redirect(
      new URL(`/scan/new?room=${encodeURIComponent(room)}&error=${encodeURIComponent(error?.message || "insert_failed")}`, req.url)
    );
  }

  return NextResponse.redirect(new URL(`/teacher/sessions/${inserted.id}`, req.url));
}
