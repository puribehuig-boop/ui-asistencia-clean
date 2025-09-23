// app/components/TopNav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Inicio" },
  { href: "/admin", label: "Panel admin" },
  { href: "/teacher/sessions", label: "Sesiones (docente)" },
  { href: "/qr", label: "Imprimir QRs de Salones" },
  { href: "/profile", label: "Perfil" }, // para uso futuro
];

export default function TopNav() {
  const pathname = usePathname();
  return (
    <header className="w-full border-b bg-white">
      <nav className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3">
        {links.map(({ href, label }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`text-sm px-2 py-1 rounded ${
                active ? "bg-black text-white" : "text-black hover:bg-gray-100"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
