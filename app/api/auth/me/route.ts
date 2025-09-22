// app/api/auth/me/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  return NextResponse.json({
    ok: !error,
    user: data?.user ?? null,
    error: error?.message ?? null,
  });
}
