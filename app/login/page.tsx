"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browserClient";

export default function LoginPage() {
  const [step, setStep] = useState<"request" | "verify">("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function requestOtp(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    const cleanEmail = email.trim();
    if (!cleanEmail) return;

    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();

      // Enviar OTP al correo (también puede incluir magic link,
      // pero nosotros vamos a verificar el CÓDIGO en el paso 2).
      const { error } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          // Si el correo trae link y dan clic, /auth/callback seguirá funcionando.
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          shouldCreateUser: true,
        },
      });
      if (error) throw error;

      setMsg("Te enviamos un código de acceso a tu correo.");
      setStep("verify");
    } catch (e: any) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(e: React.FormEvent) {
  e.preventDefault();
  setErr(null);
  setMsg(null);

  const cleanEmail = email.trim();
  const token = code.trim();

  if (!cleanEmail || !token) return;
  if (!/^\d{6}$/.test(token)) {
    setErr("Ingresa el código de 6 dígitos tal como llegó en tu correo.");
    return;
  }

  setLoading(true);
  try {
    const supabase = createSupabaseBrowserClient();

    // Verificamos OTP y obtenemos la sesión en el CLIENTE
    const { data, error } = await supabase.auth.verifyOtp({
      email: cleanEmail,
      token,
      type: "email", // OTP por correo
    });
    if (error) throw error;

    // Asegúrate de tener tokens para sincronizar con el servidor
    const access_token = data.session?.access_token;
    const refresh_token = data.session?.refresh_token;

    if (!access_token || !refresh_token) {
      throw new Error("No se recibió sesión válida tras verificar el código.");
    }

    // 🔸 Sincroniza la sesión al SERVIDOR (cookies del lado server)
    const res = await fetch("/auth/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ access_token, refresh_token }),
      credentials: "include",
    });
    const j = await res.json();
    if (!res.ok || !j.ok) throw new Error(j.error || "No se pudo sincronizar la sesión en el servidor");

    // Listo: ahora el guard del Admin verá la sesión
    window.location.href = "/admin";
  } catch (e: any) {
    setErr(e.message || String(e));
  } finally {
    setLoading(false);
  }
}


  return (
    <main className="max-w-md mx-auto p-6">
      <h1 className="text-xl font-semibold mb-3">Iniciar sesión</h1>

      {step === "request" && (
        <form onSubmit={requestOtp} className="flex gap-2">
          <input
            className="border rounded px-2 py-1 flex-1 text-black"
            type="email"
            placeholder="tu@correo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="border rounded px-3 py-1" disabled={loading}>
            Enviar código
          </button>
        </form>
      )}

      {step === "verify" && (
        <form onSubmit={verifyOtp} className="flex flex-col gap-2">
          <label className="text-sm opacity-80">
            Código enviado a <b>{email}</b>
          </label>
          <input
            className="border rounded px-2 py-1 text-black tracking-widest"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="Ingresa tu código (6 dígitos)"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <div className="flex gap-2">
            <button className="border rounded px-3 py-1" disabled={loading}>
              Verificar
            </button>
            <button
              type="button"
              className="border rounded px-3 py-1"
              onClick={() => {
                setStep("request");
                setCode("");
                setMsg(null);
                setErr(null);
              }}
            >
              Cambiar correo
            </button>
          </div>
        </form>
      )}

      {msg && <p className="text-green-700 mt-3">{msg}</p>}
      {err && <p className="text-red-600 mt-3">Error: {err}</p>}
    </main>
  );
}
