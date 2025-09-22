// lib/supabase/adminClient.ts
import { supabaseAdmin } from "./supabaseAdmin";

// Singleton (recomendado para serverless)
export { supabaseAdmin };

// Si algún código quiere una “factory”, ofrecemos el mismo singleton:
export const createSupabaseAdminClient = () => supabaseAdmin;
