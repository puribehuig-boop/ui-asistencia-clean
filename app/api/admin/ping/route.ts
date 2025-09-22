import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/adminClient";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin.from("global_settings").select("id").limit(1);
    if (error) throw error;
    return NextResponse.json({ ok: true, hasSettings: Array.isArray(data) && data.length > 0 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
