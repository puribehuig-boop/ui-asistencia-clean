# UI Asistencia (Starter)

Prototipo listo para importar en **Vercel**. Incluye:
- Next.js (App Router) + Tailwind
- Página de **Sesión demo** con 3 botones: Iniciar / Tomar asistencia / Terminar
- **Panel admin** simple con sesiones del día (mock)

## Cómo usar (Vercel)
1. Crea un repositorio en GitHub (por ejemplo `ui-asistencia`).
2. Sube todo el contenido de esta carpeta al repositorio.
3. Ve a https://vercel.com → **Add New Project** → Importa tu repo → **Deploy**.
4. Abre `/session-demo?sessionId=demo-123` para probar el flujo.

## Estructura
- `app/` · Páginas de Next.js
- `app/session-demo` · Pantalla del docente (demo)
- `app/admin` · Panel admin (demo)
- `app/page.tsx` · Inicio con accesos rápidos
- `app/layout.tsx` · Layout base + estilos
- `app/globals.css` · Tailwind

## Siguientes pasos sugeridos
- Conectar con base de datos (Supabase o Postgres) para guardar sesiones/asis.
- Generar QR por sesión con URL firmada.
- Autenticación de docente/admin.

- (deploy trigger 9 19 25 v1)

