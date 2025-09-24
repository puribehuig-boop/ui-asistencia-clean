// lib/supabase/browserClient.ts
"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Crea un cliente de Supabase para componentes cliente.
 * Úsalo así:
 *   const supabase = createSupabaseBrowserClient();
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/**
 * Instancia por defecto, útil si no quieres crear uno por componente.
 * Úsalo así:
 *   import supabase from "@/lib/supabase/browserClient";
 */
const supabase = createSupabaseBrowserClient();
export default supabase;

/** Compat: si en algún archivo usabas `browserClient` con nombre */
export const browserClient = supabase;
