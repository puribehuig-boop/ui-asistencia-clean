// lib/auth/isAdmin.ts
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function isAdminUser() {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user?.id) return false;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("user_id", data.user.id)
    .maybeSingle();

  return profile?.role === "admin";
}
