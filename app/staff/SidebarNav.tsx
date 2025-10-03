// app/staff/SidebarNav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border rounded p-3 space-y-2">
      <div className="text-xs uppercase opacity-60">{title}</div>
      {children}
    </div>
  );
}

function NavItem({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={`block px-3 py-2 rounded text-sm ${
        active ? "bg-black text-white" : "hover:bg-gray-100"
      }`}
    >
      {label}
    </Link>
  );
}

export default function SidebarNav() {
  return (
    <div className="space-y-3">
      <Section title="Staff">
        <NavItem href="/staff" label="Resumen" />
      </Section>

      <Section title="Control escolar">
        <NavItem href="/staff/control-escolar/alumnos" label="Alumnos" />
        <NavItem href="/staff/control-escolar/profesores" label="Profesores" />
        <NavItem href="/staff/control-escolar/tramites" label="Trámites" />
        <NavItem href="/staff/control-escolar/justificaciones" label="Justificaciones" />
      </Section>

      <Section title="Admisiones">
        <NavItem href="/staff/admissions/kanban" label="Kanban (CRM)" />
        <NavItem href="/staff/admissions/prospects" label="Prospectos" />
      </Section>

      <Section title="Caja">
        <NavItem href="/staff/caja" label="Panel de Caja" />
      </Section>
    </div>
  );
}
