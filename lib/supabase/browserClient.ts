// lib/supabase/browserClient.ts
"use client";
import { createBrowserClient } from "@supabase/ssr";

export const browserClient = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Export default para poder: import supabase from ".../browserClient"
export default browserClient;
