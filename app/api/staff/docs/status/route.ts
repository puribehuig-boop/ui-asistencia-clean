import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  // Guard rol
  const { data: me } = await supabase.from("profiles").select("role").eq("user_id", auth.user.id).maybeSingle();
  const role = (me?.role ?? "").toLowerCase();
  if (!["admin","control_escolar","staff"].includes(role)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const form = await req.formData();
  const docId = Number(form.get("docId") || 0);
  const status = String(form.get("status") || "");

  if (!docId || !["pending","verified","rejected"].includes(status)) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const { error } = await supabase
    .from("student_documents")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", docId);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
