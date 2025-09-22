// lib/supabase/adminClient.ts
import { supabaseAdmin } from "./supabaseAdmin";

export { supabaseAdmin };

// Opcional: factory (devuelve el singleton)
export const createSupabaseAdminClient = () => supabaseAdmin;
