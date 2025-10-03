import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

const ALLOWED = new Set([
  "nuevo","contactado","interesado","en_proceso","aceptado","inscrito","descartado"
]);

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient();
  const body = await req.json().catch(() => ({}));
  const id = Number(body?.id || 0);
  const stage = String(body?.stage || "");

  if (!id || !ALLOWED.has(stage)) {
    return NextResponse.json({ ok:false, error:"bad_request" }, { status: 400 });
  }

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ ok:false, error:"unauthorized" }, { status: 401 });

  const { data: me } = await supabase.from("profiles").select("role").eq("user_id", auth.user.id).maybeSingle();
  const role = (me?.role ?? "").toLowerCase();
  if (!["admin","admissions"].includes(role)) {
    return NextResponse.json({ ok:false, error:"forbidden" }, { status: 403 });
  }

  const { error } = await supabase
    .from("prospects")
    .update({ stage })
    .eq("id", id);

  if (error) return NextResponse.json({ ok:false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok:true });
}
