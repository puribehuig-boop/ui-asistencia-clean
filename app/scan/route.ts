import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const roomId =
    url.searchParams.get("roomId") ||
    url.searchParams.get("roomID") ||
    url.searchParams.get("room");

  if (!roomId) {
    // Sin room -> manda a la página de QR para elegir/leer salones
    return NextResponse.redirect(new URL("/qr", req.url));
  }

  const supabase = createSupabaseServerClient();

  // Usa RPC que resuelve por hora efectiva + tolerancia
  const { data, error } = await supabase.rpc("resolve_active_session", { p_room: roomId });

  if (error) {
    return NextResponse.redirect(
      new URL(`/qr?error=${encodeURIComponent(error.message)}`, req.url)
    );
  }

  const sessionId = Array.isArray(data) && data.length ? data[0].id : null;

  if (!sessionId) {
    // No hay sesión activa en ventana para ese salón
    return NextResponse.redirect(
      new URL(`/teacher/sessions?room=${encodeURIComponent(roomId)}&noSession=1`, req.url)
    );
  }

  // ¡Listo! Redirige a la toma de asistencia de esa sesión
  return NextResponse.redirect(new URL(`/teacher/sessions/${sessionId}`, req.url));
}
