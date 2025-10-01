// app/staff/control-escolar/justificaciones/reject/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.redirect(new URL("/login", req.url));

  const { data: me } = await supabase.from("profiles").select("role").eq("user_id", auth.user.id).maybeSingle();
  const ok = me?.role && ['admin','staff','escolar','admisiones','caja','finanzas'].includes(me.role);
  if (!ok) return NextResponse.redirect(new URL("/profile", req.url));

  const formData = await req.formData();
  const id = Number(formData.get("id") || 0);
  if (!id) return NextResponse.redirect(new URL("/staff/control-escolar/justificaciones?status=pending", req.url));

  await supabase
    .from("attendance_justifications")
    .update({ status: "rejected", reviewer_id: auth.user.id, reviewed_at: new Date().toISOString() })
    .eq("id", id);

  return NextResponse.redirect(new URL("/staff/control-escolar/justificaciones?status=pending", req.url));
}
