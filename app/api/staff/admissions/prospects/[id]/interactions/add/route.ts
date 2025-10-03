import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

const TYPES = new Set(["nota","llamada","correo","visita","whatsapp","otro"]);

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ ok:false, error:"unauthorized" }, { status: 401 });

  const { data: me } = await supabase.from("profiles").select("role").eq("user_id", auth.user.id).maybeSingle();
  const role = (me?.role ?? "").toLowerCase();
  if (!["admin","admissions"].includes(role)) {
    return NextResponse.json({ ok:false, error:"forbidden" }, { status: 403 });
  }

  const form = await req.formData();
  const prospectId = Number(params.id || 0);
  if (!prospectId) return NextResponse.json({ ok:false, error:"bad_id" }, { status: 400 });

  const type = String(form.get("type") || "");
  const note = (form.get("note") as string) || null;
  const happened_at_raw = (form.get("happened_at") as string) || "";
  const happened_at = happened_at_raw ? new Date(happened_at_raw).toISOString() : new Date().toISOString();

  if (!TYPES.has(type)) {
    return NextResponse.json({ ok:false, error:"bad_type" }, { status: 400 });
  }

  const { error } = await supabase
    .from("prospect_interactions")
    .insert([{
      prospect_id: prospectId,
      type,
      note,
      happened_at,
      user_id: auth.user.id,
    }]);

  if (error) return NextResponse.json({ ok:false, error: error.message }, { status: 500 });

  // El trigger touch_prospect_last_contact() ya actualiza last_contact_at
  return NextResponse.redirect(new URL(`/staff/admissions/prospects/${prospectId}`, req.url));
}
