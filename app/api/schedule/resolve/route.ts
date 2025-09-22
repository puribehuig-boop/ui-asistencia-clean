import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/adminClient";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { data: settings, error } = await supabaseAdmin
      .from("global_settings")
      .select("attendance_tolerance_min, late_threshold_min")
      .eq("id", 1)
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, settings });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
