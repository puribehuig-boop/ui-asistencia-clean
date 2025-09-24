// app/scan/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const roomId =
    url.searchParams.get("roomId") ||
    url.searchParams.get("roomID") ||
    url.searchParams.get("room");

  if (!roomId) return NextResponse.redirect(new URL("/qr", req.url));

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("resolve_active_session", { p_room: roomId });

  if (error) {
    return NextResponse.redirect(new URL(`/qr?error=${encodeURIComponent(error.message)}`, req.url));
  }

  const sessionId = Array.isArray(data) && data.length ? data[0].id : null;

  if (!sessionId) {
    // ⬇️ Antes mandábamos a /teacher/sessions; ahora mostramos confirmación de crear manual
    return NextResponse.redirect(new URL(`/scan/new?room=${encodeURIComponent(roomId)}`, req.url));
  }

  return NextResponse.redirect(new URL(`/teacher/sessions/${sessionId}`, req.url));
}
