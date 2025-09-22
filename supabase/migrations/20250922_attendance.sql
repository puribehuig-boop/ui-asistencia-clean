-- 1. Tablas base (asumiendo ya existen programs, subjects, terms, groups)
--    Creamos asignación docente-grupo, sesiones y matrículas

create table if not exists public.group_teachers (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  teacher_id uuid not null, -- = profiles.user_id (uuid)
  unique (group_id, teacher_id)
);

create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  student_id uuid not null, -- = profiles.user_id (uuid)
  active boolean not null default true,
  unique (group_id, student_id)
);

-- Sesiones de clase (una por día/horario real)
create table if not exists public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  date date not null,
  start_time time not null,
  end_time time not null,
  room text,
  -- Token QR rotatorio (opcional), vence para evitar escaneos fuera de tiempo
  qr_token text,
  qr_expires_at timestamptz,
  created_by uuid not null, -- normalmente teacher_id
  created_at timestamptz not null default now(),
  unique (group_id, date, start_time)
);

-- Registros de asistencia
create type public.attendance_status as enum ('present','late','absent','justified');

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.class_sessions(id) on delete cascade,
  student_id uuid not null, -- = profiles.user_id (uuid)
  status public.attendance_status not null,
  check_in_at timestamptz not null default now(),
  marked_by uuid not null,  -- quien marcó: el propio alumno (QR) o el docente/admin
  source text not null default 'qr', -- 'qr' | 'manual'
  late boolean not null default false,
  justification_text text,
  justification_file_url text,
  unique (session_id, student_id)
);

-- 2. Configuración global sencilla
create table if not exists public.global_settings (
  id text primary key, -- usa 'default' como única fila
  scan_window_before_minutes int not null default 10,   -- ventana antes de start_time para aceptar QR
  scan_window_after_minutes int not null default 20,    -- ventana después de start_time
  late_threshold_minutes int not null default 15,       -- a partir de X min => 'late'
  lock_hours_after_session int not null default 24      -- bloquear cambios de alumno tras 24h
);

insert into public.global_settings (id)
values ('default')
on conflict (id) do nothing;
