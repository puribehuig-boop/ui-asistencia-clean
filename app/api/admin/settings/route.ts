import { isAdminUser } from "@/lib/auth/isAdmin";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  if (!(await isAdminUser())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("global_settings")
    .select("attendance_tolerance_min, late_threshold_min")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    attendance_tolerance_min: data?.attendance_tolerance_min ?? 15,
    late_threshold_min: data?.late_threshold_min ?? 30,
  });
}

export async function POST(req: Request) {
  if (!(await isAdminUser())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const tol = Number(body?.attendance_tolerance_min);
  const late = Number(body?.late_threshold_min);

  if (!Number.isFinite(tol) || tol < 0 || tol > 240) {
    return NextResponse.json({ ok: false, error: "tolerance_out_of_range" }, { status: 400 });
  }
  if (!Number.isFinite(late) || late < tol || late > 240) {
    return NextResponse.json(
      { ok: false, error: "late_threshold_must_be>=tolerance_and<=240" },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin
    .from("global_settings")
    .upsert({ id: 1, attendance_tolerance_min: tol, late_threshold_min: late });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    attendance_tolerance_min: tol,
    late_threshold_min: late,
  });
}
