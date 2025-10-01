// app/justifications/new/page.tsx
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";
import { redirect } from "next/navigation";
import NewJustificationClient from "./NewJustificationClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Page() {
  // (Opcional pero recomendado) Requiere sesión para cargar la vista
  const supabase = createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/login");

  return <NewJustificationClient />;
}
