import { isAdminUser } from "@/lib/auth/isAdmin";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function todayMX() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function GET(req: Request) {
  if (!(await isAdminUser())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const date = url.searchParams.get("date") || todayMX();
  const room = url.searchParams.get("room") || "";
  const group = url.searchParams.get("group") || "";
  const status = url.searchParams.get("status") || "";

  let q = supabaseAdmin
    .from("sessions")
    .select(
      "id, session_code, session_date, room_code, subject, group_name, start_planned, end_planned, started_at, ended_at, status, arrival_status, arrival_delay_min"
    )
    .eq("session_date", date)
    .order("start_planned", { ascending: true, nullsFirst: true })
    .order("room_code", { ascending: true });

  if (room) q = q.ilike("room_code", `%${room}%`);
  if (group) q = q.ilike("group_name", `%${group}%`);
  if (status) q = q.eq("status", status);

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, date, items: data ?? [] });
}
