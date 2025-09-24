// app/api/sessions/create-manual/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

export const runtime = "nodejs";

function yyyymmddMX(d = new Date()) {
  const tz = "America/Mexico_City";
  const opts: Intl.DateTimeFormatOptions = { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" };
  // YYYY-MM-DD
  const ds = new Intl.DateTimeFormat("en-CA", opts).format(d);
  return ds.replaceAll("-", "");
}

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient();
  const url = new URL(req.url);
  const roomRaw = url.searchParams.get("room") || "";
  const room = roomRaw.trim();
  if (!room) {
    return NextResponse.redirect(new URL(`/scan/new?room=${encodeURIComponent(roomRaw)}&error=room_required`, req.url));
  }

  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth?.user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  const uid = auth.user.id;

  // Intentar inferir group_id y start_planned por slot (opcional)
  const now = new Date();
  const weekday = ((now.getDay() + 6) % 7) + 1; // 1..7 Lun..Dom
  let group_id: number | null = null;
  let start_planned: string | null = null;

  const { data: slots, error: slotErr } = await supabase
    .from("schedule_slots")
    .select("group_id, start_time, room_code, weekday")
    .eq("weekday", weekday)
    .ilike("room_code", room); // coincide exactamente; si quieres prefijo usa `${room}%`

  if (!slotErr && slots?.length) {
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
      start_planned = `${hh}${mm}`;
    }
  }

  const code = `${room}-${yyyymmddMX(now)}-manual`;

  // ⬇️ FIX CLAVE: incluir room_code (NOT NULL)
  const { data: inserted, error } = await supabase
    .from("sessions")
    .insert({
      teacher_user_id: uid,
      session_date: new Date().toISOString().slice(0, 10),
      start_planned,               // puede quedar null
      started_at: new Date().toISOString(),
      is_manual: true,
      session_code: code,
      group_id,                    // puede quedar null
      room_code: room,             // ⬅️ requerido por tu NOT NULL
    })
    .select("id")
    .maybeSingle();

  if (error || !inserted) {
    const msg = encodeURIComponent(error?.message || "insert_failed");
    return NextResponse.redirect(new URL(`/scan/new?room=${encodeURIComponent(room)}&error=${msg}`, req.url));
  }

  return NextResponse.redirect(new URL(`/teacher/sessions/${inserted.id}`, req.url));
}
