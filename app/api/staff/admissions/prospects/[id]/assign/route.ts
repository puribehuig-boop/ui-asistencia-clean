import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ ok:false, error:"unauthorized" }, { status: 401 });

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  const role = (me?.role ?? "").toLowerCase();
  if (!["admin","admissions"].includes(role)) {
    return NextResponse.json({ ok:false, error:"forbidden" }, { status: 403 });
  }

  const prospectId = Number(params.id || 0);
  if (!prospectId) return NextResponse.json({ ok:false, error:"bad_id" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const mode = String(body?.mode || "take"); // take | assign | unassign
  let owner_user_id: string | null = null;

  if (mode === "take") {
    owner_user_id = auth.user.id;
  } else if (mode === "assign") {
    owner_user_id = String(body?.owner_user_id || "");
    if (!owner_user_id) return NextResponse.json({ ok:false, error:"owner_required" }, { status: 400 });
  } else if (mode === "unassign") {
    owner_user_id = null;
  } else {
    return NextResponse.json({ ok:false, error:"bad_mode" }, { status: 400 });
  }

  const { error } = await supabase
    .from("prospects")
    .update({ owner_user_id })
    .eq("id", prospectId);

  if (error) return NextResponse.json({ ok:false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok:true });
}
