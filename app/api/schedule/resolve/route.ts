// app/api/schedule/resolve/route.ts
import { NextResponse } from "next/server";

// ⬇️ IMPORTA tu cliente admin (elige el que exista en tu repo):
// Opción A (si tu repo exporta createSupabaseAdminClient):
import { createSupabaseAdminClient } from "@/lib/supabase/adminClient";
const admin = createSupabaseAdminClient();

// Opción B (si tu repo exporta un singleton supabaseAdmin):
// import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Si no tienes ninguno de los dos, descomenta esta versión mínima:
// import { createClient } from "@supabase/supabase-js";
// const admin = createClient(
//   process.env.NEXT_PUBLIC_SUPABASE_URL!,
//   process.env.SUPABASE_SERVICE_ROLE!,
//   { auth: { persistSession: false } }
// );

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    // ⚠️ Verificación rápida de envs
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return NextResponse.json(
        { ok: false, error: "Falta NEXT_PUBLIC_SUPABASE_URL" },
        { status: 500 }
      );
    }
    if (!process.env.SUPABASE_SERVICE_ROLE) {
      return NextResponse.json(
        { ok: false, error: "Falta SUPABASE_SERVICE_ROLE (service key) en entorno Server" },
        { status: 500 }
      );
    }

    // Lee parámetros de tolerancia/retardo desde tabla de settings
    // (con service role para evitar problemas de RLS)
    const { data: settings, error: setErr } = await supabaseAdmin
      .from("global_settings")
      .select("attendance_tolerance_min, late_threshold_min")
      .eq("id", 1)
      .single();

    if (setErr) throw setErr;

    // Aquí iría tu lógica de “resolver horario” (grupos, materias, slots, etc.)
    // Por ahora devolvemos solo los settings para que compile y pruebes el flujo.
    return NextResponse.json({ ok: true, settings });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
