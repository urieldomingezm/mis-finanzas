-- =====================================================================
--  Mis Finanzas — esquema de base de datos para Supabase (v2: multiusuario)
--  Pega TODO este archivo en Supabase → SQL Editor → New query → Run.
--  Se puede ejecutar varias veces y también sobre la versión anterior:
--  no borra tus datos, solo agrega lo nuevo.
--
--  Privacidad:
--   · Ingresos, deudas y presupuestos: siempre privados.
--   · Gastos, gastos fijos, metas y eventos: privados, salvo que al
--     registrarlos elijas un grupo en "Compartir con".
--   · Evidencias (fotos/PDF): las ve quien puede ver el registro al
--     que pertenecen.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Grupos (depa, casa, roomies) ----------
create table if not exists public.grupos (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  codigo      text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 6)),
  creado_por  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table if not exists public.miembros (
  id          uuid primary key default gen_random_uuid(),
  grupo_id    uuid not null references public.grupos(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  alias       text not null default 'Compañero',
  rol         text not null default 'miembro',
  created_at  timestamptz not null default now(),
  unique (grupo_id, user_id)
);

-- ---------- Ingresos (privado) ----------
create table if not exists public.ingresos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  fecha       date not null default current_date,
  concepto    text not null,
  fuente      text,
  monto       numeric(12,2) not null check (monto >= 0),
  notas       text,
  created_at  timestamptz not null default now()
);

-- ---------- Gastos (privado o compartido) ----------
create table if not exists public.gastos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  fecha       date not null default current_date,
  concepto    text not null,
  categoria   text,
  metodo      text,
  monto       numeric(12,2) not null check (monto >= 0),
  notas       text,
  created_at  timestamptz not null default now()
);
alter table public.gastos add column if not exists grupo_id      uuid references public.grupos(id) on delete set null;
alter table public.gastos add column if not exists pagado_por    uuid default auth.uid();
alter table public.gastos add column if not exists participantes uuid[];

-- ---------- Deudas (privado) ----------
create table if not exists public.deudas (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  acreedor        text not null,
  tipo            text,
  saldo           numeric(12,2) not null default 0 check (saldo >= 0),
  monto_original  numeric(12,2),
  pago_minimo     numeric(12,2) not null default 0,
  frecuencia      text not null default 'mensual' check (frecuencia in ('semanal','quincenal','mensual')),
  proximo_pago    date,
  tasa_anual      numeric(7,2) default 0,
  notas           text,
  created_at      timestamptz not null default now()
);

-- ---------- Gastos fijos / suscripciones (privado o compartido) ----------
create table if not exists public.recurrentes (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nombre         text not null,
  monto          numeric(12,2) not null check (monto >= 0),
  frecuencia     text not null default 'mensual' check (frecuencia in ('semanal','quincenal','mensual','anual')),
  proximo_cobro  date,
  categoria      text,
  en_uso         boolean not null default true,
  notas          text,
  created_at     timestamptz not null default now()
);
alter table public.recurrentes add column if not exists grupo_id uuid references public.grupos(id) on delete set null;

-- ---------- Metas (privado o compartido) ----------
create table if not exists public.metas (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nombre        text not null,
  objetivo      numeric(12,2) not null check (objetivo > 0),
  ahorrado      numeric(12,2) not null default 0,
  fecha_limite  date,
  notas         text,
  created_at    timestamptz not null default now()
);
alter table public.metas add column if not exists grupo_id uuid references public.grupos(id) on delete set null;

-- ---------- Presupuestos (privado) ----------
create table if not exists public.presupuestos (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  categoria       text not null,
  limite_mensual  numeric(12,2) not null check (limite_mensual > 0),
  created_at      timestamptz not null default now(),
  unique (user_id, categoria)
);

-- ---------- Eventos del calendario (privado o compartido) ----------
create table if not exists public.eventos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  grupo_id    uuid references public.grupos(id) on delete set null,
  titulo      text not null,
  fecha       date not null default current_date,
  hora        time,
  tipo        text default 'Recordatorio',
  monto       numeric(12,2),
  repetir     text default 'no se repite',
  notas       text,
  created_at  timestamptz not null default now()
);

-- ---------- Pagos entre compañeros (para quedar a mano) ----------
create table if not exists public.liquidaciones (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  grupo_id    uuid not null references public.grupos(id) on delete cascade,
  de          uuid not null references auth.users(id) on delete cascade,
  para        uuid not null references auth.users(id) on delete cascade,
  monto       numeric(12,2) not null check (monto > 0),
  fecha       date not null default current_date,
  notas       text,
  created_at  timestamptz not null default now(),
  check (de <> para)
);

-- ---------- Evidencias (fotos de tickets, comprobantes, PDF) ----------
create table if not exists public.adjuntos (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  grupo_id     uuid references public.grupos(id) on delete set null,
  tabla        text not null,
  registro_id  uuid not null,
  ruta         text not null unique,
  nombre       text,
  tipo_mime    text,
  created_at   timestamptz not null default now()
);

-- =====================================================================
--  Funciones
-- =====================================================================
-- ¿El usuario actual pertenece al grupo? (security definer evita recursión en RLS)
create or replace function public.es_miembro(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.miembros m where m.grupo_id = g and m.user_id = auth.uid());
$$;

create or replace function public.crear_grupo(p_nombre text, p_alias text) returns uuid
language plpgsql security definer set search_path = public as $$
declare g uuid;
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión'; end if;
  if coalesce(trim(p_nombre), '') = '' then raise exception 'El grupo necesita un nombre'; end if;
  insert into public.grupos (nombre, creado_por) values (trim(p_nombre), auth.uid()) returning id into g;
  insert into public.miembros (grupo_id, user_id, alias, rol)
  values (g, auth.uid(), coalesce(nullif(trim(p_alias), ''), 'Yo'), 'admin');
  return g;
end $$;

create or replace function public.unirse_grupo(p_codigo text, p_alias text) returns uuid
language plpgsql security definer set search_path = public as $$
declare g uuid;
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión'; end if;
  select id into g from public.grupos where codigo = upper(trim(p_codigo));
  if g is null then raise exception 'Código de grupo no válido'; end if;
  insert into public.miembros (grupo_id, user_id, alias)
  values (g, auth.uid(), coalesce(nullif(trim(p_alias), ''), 'Compañero'))
  on conflict (grupo_id, user_id) do update set alias = excluded.alias;
  return g;
end $$;

revoke execute on function public.es_miembro(uuid), public.crear_grupo(text, text), public.unirse_grupo(text, text) from public, anon;
grant  execute on function public.es_miembro(uuid), public.crear_grupo(text, text), public.unirse_grupo(text, text) to authenticated;

-- =====================================================================
--  Seguridad por fila (RLS)
-- =====================================================================
do $$
declare t text; p record;
begin
  -- limpiar políticas anteriores de estas tablas para recrearlas
  for p in select policyname, tablename from pg_policies
           where schemaname = 'public'
             and tablename in ('ingresos','gastos','deudas','recurrentes','metas','presupuestos',
                               'eventos','liquidaciones','adjuntos','grupos','miembros') loop
    execute format('drop policy if exists %I on public.%I', p.policyname, p.tablename);
  end loop;

  foreach t in array array['ingresos','gastos','deudas','recurrentes','metas','presupuestos',
                           'eventos','liquidaciones','adjuntos','grupos','miembros'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;

  -- Tablas siempre privadas
  foreach t in array array['ingresos','deudas','presupuestos'] loop
    execute format('create policy "solo_propietario" on public.%I for all to authenticated
      using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;

  -- Tablas que pueden compartirse con un grupo
  foreach t in array array['gastos','recurrentes','metas','eventos','adjuntos'] loop
    execute format('create policy "ver" on public.%I for select to authenticated
      using (user_id = (select auth.uid()) or (grupo_id is not null and public.es_miembro(grupo_id)))', t);
    execute format('create policy "crear" on public.%I for insert to authenticated
      with check (user_id = (select auth.uid()) and (grupo_id is null or public.es_miembro(grupo_id)))', t);
    execute format('create policy "borrar" on public.%I for delete to authenticated
      using (user_id = (select auth.uid()))', t);
  end loop;
  foreach t in array array['gastos','recurrentes','eventos','adjuntos'] loop
    execute format('create policy "editar" on public.%I for update to authenticated
      using (user_id = (select auth.uid()))
      with check (user_id = (select auth.uid()) and (grupo_id is null or public.es_miembro(grupo_id)))', t);
  end loop;
end $$;

-- Metas compartidas: cualquier miembro puede aportar (editar)
create policy "editar" on public.metas for update to authenticated
  using (user_id = (select auth.uid()) or (grupo_id is not null and public.es_miembro(grupo_id)))
  with check (user_id = (select auth.uid()) or (grupo_id is not null and public.es_miembro(grupo_id)));

-- Pagos entre compañeros: los ve todo el grupo; los registra quien paga o quien recibe
create policy "ver" on public.liquidaciones for select to authenticated
  using (public.es_miembro(grupo_id));
create policy "crear" on public.liquidaciones for insert to authenticated
  with check (user_id = (select auth.uid()) and public.es_miembro(grupo_id)
              and ((select auth.uid()) in (de, para)));
create policy "editar" on public.liquidaciones for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.es_miembro(grupo_id) and ((select auth.uid()) in (de, para)));
create policy "borrar" on public.liquidaciones for delete to authenticated
  using (user_id = (select auth.uid()));

-- Grupos: se crean y se unen con las funciones de arriba
create policy "ver" on public.grupos for select to authenticated
  using (creado_por = (select auth.uid()) or public.es_miembro(id));
create policy "editar" on public.grupos for update to authenticated
  using (creado_por = (select auth.uid())) with check (creado_por = (select auth.uid()));
create policy "borrar" on public.grupos for delete to authenticated
  using (creado_por = (select auth.uid()));

-- Miembros: ves a tus compañeros; cambias tu nombre; sales tú o te saca quien creó el grupo
create policy "ver" on public.miembros for select to authenticated
  using (public.es_miembro(grupo_id));
create policy "editar" on public.miembros for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "borrar" on public.miembros for delete to authenticated
  using (user_id = (select auth.uid())
         or exists (select 1 from public.grupos g where g.id = grupo_id and g.creado_por = (select auth.uid())));

-- Índices
create index if not exists ingresos_fecha_idx    on public.ingresos (user_id, fecha);
create index if not exists gastos_fecha_idx      on public.gastos   (user_id, fecha);
create index if not exists gastos_grupo_idx      on public.gastos   (grupo_id);
create index if not exists recurrentes_grupo_idx on public.recurrentes (grupo_id);
create index if not exists metas_grupo_idx       on public.metas (grupo_id);
create index if not exists eventos_idx           on public.eventos (user_id, fecha);
create index if not exists eventos_grupo_idx     on public.eventos (grupo_id);
create index if not exists adjuntos_reg_idx      on public.adjuntos (tabla, registro_id);
create index if not exists liquidaciones_idx     on public.liquidaciones (grupo_id);
create index if not exists miembros_user_idx     on public.miembros (user_id);

-- =====================================================================
--  Almacenamiento de evidencias (Supabase Storage, privado)
--  Ruta de cada archivo: <id_del_usuario>/<archivo>
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('evidencias', 'evidencias', false, 10485760,
        array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;

drop policy if exists "evidencias_ver"    on storage.objects;
drop policy if exists "evidencias_subir"  on storage.objects;
drop policy if exists "evidencias_borrar" on storage.objects;

-- Ver: tus archivos, o los que están ligados a un registro que puedes ver
create policy "evidencias_ver" on storage.objects for select to authenticated
  using (bucket_id = 'evidencias' and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or exists (select 1 from public.adjuntos a where a.ruta = objects.name)));
create policy "evidencias_subir" on storage.objects for insert to authenticated
  with check (bucket_id = 'evidencias' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "evidencias_borrar" on storage.objects for delete to authenticated
  using (bucket_id = 'evidencias' and (storage.foldername(name))[1] = (select auth.uid())::text);
