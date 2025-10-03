import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

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

  const source = (form.get("source") as string) || null;
  const campaign = (form.get("campaign") as string) || null;
  const termRaw = form.get("term_id") as string | null;
  const term_id = termRaw ? Number(termRaw) : null;

  const { error } = await supabase
    .from("prospects")
    .update({ source, campaign, term_id })
    .eq("id", prospectId);

  if (error) return NextResponse.json({ ok:false, error: error.message }, { status: 500 });

  // redirect back to detail
  return NextResponse.redirect(new URL(`/staff/admissions/prospects/${prospectId}`, req.url));
}
