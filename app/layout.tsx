import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UI Asistencia - Demo",
  description: "Prototipo inicial para asistencia por QR",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen text-white">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <header className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-semibold tracking-wide">Universidad Interglobal · Asistencia</h1>
            <nav className="text-sm opacity-80">
              <a href="/" className="hover:underline">Inicio</a>
              <span className="mx-3">·</span>
              <a href="/session-demo" className="hover:underline">Sesión demo</a>
              <span className="mx-3">·</span>
              <a href="/admin" className="hover:underline">Panel admin</a>
            </nav>
          </header>
          {children}
          <footer className="mt-12 text-xs opacity-60">Prototipo inicial · Listo para importar en Vercel</footer>
        </div>
      </body>
    </html>
  );
}
