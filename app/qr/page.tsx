// app/qr/page.tsx
import { headers } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/adminClient";
import QrClient from "./QrClient";

export const runtime = "nodejs";

export default async function QrPage({
  searchParams,
}: {
  searchParams?: { roomId?: string; roomID?: string };
}) {
  const roomParam = (searchParams?.roomId || searchParams?.roomID || "").toString().trim();

  // origin (https://<tu-dominio>) para armar el deep link del QR -> /scan?roomId=...
  const h = headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const origin = `${proto}://${host}`;

  // Lista de salones desde schedule_slots (deduplicado)
  const { data, error } = await supabaseAdmin
    .from("schedule_slots")
    .select("room_code")
    .not("room_code", "is", null)
    .order("room_code");
  const rooms = Array.from(new Set((data ?? []).map((r: any) => String(r.room_code))));

  if (error) {
    return <div className="p-6 text-red-600">Error: {error.message}</div>;
  }

  return <QrClient origin={origin} rooms={rooms} initialRoomId={roomParam} />;
}
