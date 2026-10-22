-- =====================================================================
--  Mis Finanzas — esquema de base de datos para Supabase (v3: reforzado)
--  Pega TODO este archivo en Supabase → SQL Editor → New query → Run.
--  Se puede ejecutar varias veces y sobre versiones anteriores:
--  no borra tus datos, solo agrega o actualiza lo necesario.
--
--  Privacidad:
--   · Ingresos, deudas y presupuestos: siempre privados.
--   · Gastos, gastos fijos, metas y eventos: privados, salvo que al
--     registrarlos elijas un grupo en "Compartir con".
--   · Evidencias (fotos/PDF): las ve quien puede ver el registro al
--     que pertenecen, y nadie más.
-- =====================================================================

create extension if not exists pgcrypto;

-- Esquema interno: sus funciones NO se publican en la API
create schema if not exists privado;
revoke all on schema privado from public, anon;
grant usage on schema privado to authenticated;

-- ---------- Grupos (depa, casa, roomies) ----------
create table if not exists public.grupos (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  codigo      text not null unique,
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

-- ---------- Registro de intentos fallidos al unirse (anti fuerza bruta) ----------
create table if not exists privado.intentos_union (
  user_id  uuid not null,
  at       timestamptz not null default now()
);
create index if not exists intentos_union_idx on privado.intentos_union (user_id, at);
revoke all on privado.intentos_union from public, anon, authenticated;

-- =====================================================================
--  Límites de datos (evitan textos gigantes, montos absurdos y basura)
-- =====================================================================
do $$
declare r record;
begin
  for r in select * from (values
    ('grupos','nombre',60), ('grupos','codigo',12), ('miembros','alias',40), ('miembros','rol',20),
    ('ingresos','concepto',120), ('ingresos','fuente',60), ('ingresos','notas',1000),
    ('gastos','concepto',120), ('gastos','categoria',60), ('gastos','metodo',40), ('gastos','notas',1000),
    ('deudas','acreedor',120), ('deudas','tipo',60), ('deudas','notas',1000),
    ('recurrentes','nombre',120), ('recurrentes','categoria',60), ('recurrentes','notas',1000),
    ('metas','nombre',120), ('metas','notas',1000), ('presupuestos','categoria',60),
    ('eventos','titulo',120), ('eventos','tipo',30), ('eventos','repetir',20), ('eventos','notas',1000),
    ('liquidaciones','notas',300), ('adjuntos','tabla',30), ('adjuntos','ruta',200), ('adjuntos','nombre',200), ('adjuntos','tipo_mime',60)
  ) as t(tabla, columna, maximo) loop
    if not exists (select 1 from pg_constraint where conname = r.tabla || '_' || r.columna || '_largo') then
      execute format('alter table public.%I add constraint %I check (char_length(%I) <= %s)',
                     r.tabla, r.tabla || '_' || r.columna || '_largo', r.columna, r.maximo);
    end if;
  end loop;

  if not exists (select 1 from pg_constraint where conname = 'adjuntos_tabla_valida') then
    alter table public.adjuntos add constraint adjuntos_tabla_valida
      check (tabla in ('ingresos','gastos','deudas','recurrentes','metas','eventos','liquidaciones'));
  end if;
  -- Cada evidencia solo puede apuntar a un archivo de tu propia carpeta
  if not exists (select 1 from pg_constraint where conname = 'adjuntos_ruta_propia') then
    alter table public.adjuntos add constraint adjuntos_ruta_propia
      check (split_part(ruta, '/', 1) = user_id::text and ruta !~ '\.\.');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'metas_ahorrado_valido') then
    alter table public.metas add constraint metas_ahorrado_valido check (ahorrado >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'deudas_tasa_valida') then
    alter table public.deudas add constraint deudas_tasa_valida check (tasa_anual is null or tasa_anual between 0 and 5000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'eventos_monto_valido') then
    alter table public.eventos add constraint eventos_monto_valido check (monto is null or monto >= 0);
  end if;
end $$;

-- =====================================================================
--  Funciones
-- =====================================================================
-- ¿El usuario actual pertenece al grupo? (interna; no está expuesta en la API)
create or replace function privado.es_miembro(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.miembros m where m.grupo_id = g and m.user_id = auth.uid());
$$;
revoke all on function privado.es_miembro(uuid) from public, anon;
grant execute on function privado.es_miembro(uuid) to authenticated;

-- Código de invitación: 8 caracteres aleatorios criptográficamente seguros (~1 billón de combinaciones)
create or replace function privado.nuevo_codigo() returns text
language plpgsql volatile set search_path = public, extensions as $$
declare
  abc constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  b bytea := gen_random_bytes(8);
  c text := '';
begin
  for i in 0..7 loop c := c || substr(abc, 1 + (get_byte(b, i) % 32), 1); end loop;
  return c;
end $$;
revoke all on function privado.nuevo_codigo() from public, anon, authenticated;
alter table public.grupos alter column codigo set default privado.nuevo_codigo();

create or replace function public.crear_grupo(p_nombre text, p_alias text) returns uuid
language plpgsql security definer set search_path = public as $$
declare g uuid;
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión'; end if;
  if coalesce(trim(p_nombre), '') = '' then raise exception 'El grupo necesita un nombre'; end if;
  if (select count(*) from public.miembros where user_id = auth.uid()) >= 10 then
    raise exception 'Puedes estar en máximo 10 grupos';
  end if;
  insert into public.grupos (nombre, creado_por) values (left(trim(p_nombre), 60), auth.uid()) returning id into g;
  insert into public.miembros (grupo_id, user_id, alias, rol)
  values (g, auth.uid(), left(coalesce(nullif(trim(p_alias), ''), 'Yo'), 40), 'admin');
  return g;
end $$;

-- Devuelve el id del grupo, o NULL si el código no existe.
-- Máximo 10 intentos fallidos por hora por usuario.
create or replace function public.unirse_grupo(p_codigo text, p_alias text) returns uuid
language plpgsql security definer set search_path = public as $$
declare g uuid;
begin
  if auth.uid() is null then raise exception 'Necesitas iniciar sesión'; end if;
  if (select count(*) from privado.intentos_union where user_id = auth.uid() and at > now() - interval '1 hour') >= 10 then
    raise exception 'Demasiados intentos con códigos incorrectos. Espera una hora e inténtalo de nuevo.';
  end if;
  select id into g from public.grupos where codigo = upper(regexp_replace(coalesce(p_codigo, ''), '\s', '', 'g'));
  if g is null then
    insert into privado.intentos_union (user_id) values (auth.uid());
    delete from privado.intentos_union where at < now() - interval '1 day';
    return null;
  end if;
  if not exists (select 1 from public.miembros where grupo_id = g and user_id = auth.uid()) then
    if (select count(*) from public.miembros where grupo_id = g) >= 20 then raise exception 'Ese grupo ya está lleno (20 personas)'; end if;
    if (select count(*) from public.miembros where user_id = auth.uid()) >= 10 then raise exception 'Puedes estar en máximo 10 grupos'; end if;
  end if;
  insert into public.miembros (grupo_id, user_id, alias)
  values (g, auth.uid(), left(coalesce(nullif(trim(p_alias), ''), 'Compañero'), 40))
  on conflict (grupo_id, user_id) do update set alias = excluded.alias;
  return g;
end $$;

revoke execute on function public.crear_grupo(text, text), public.unirse_grupo(text, text) from public, anon;
grant  execute on function public.crear_grupo(text, text), public.unirse_grupo(text, text) to authenticated;

-- ---------- Validaciones de integridad de grupo ----------
-- Gastos compartidos: quien pagó y entre quiénes se divide deben ser miembros del grupo
create or replace function privado.validar_gasto() returns trigger
language plpgsql security definer set search_path = public as $$
declare ms uuid[];
begin
  if new.grupo_id is null then
    new.pagado_por := new.user_id;
    new.participantes := null;
    return new;
  end if;
  if tg_op = 'UPDATE' and new.grupo_id is not distinct from old.grupo_id
     and new.pagado_por is not distinct from old.pagado_por
     and new.participantes is not distinct from old.participantes then
    return new;
  end if;
  select array_agg(user_id) into ms from public.miembros where grupo_id = new.grupo_id;
  new.pagado_por := coalesce(new.pagado_por, new.user_id);
  if not (new.pagado_por = any(ms)) then raise exception 'Quien pagó debe ser miembro del grupo'; end if;
  if new.participantes is null or cardinality(new.participantes) = 0 then new.participantes := ms; end if;
  if not (new.participantes <@ ms) then raise exception 'Solo puedes dividir entre miembros del grupo'; end if;
  return new;
end $$;
drop trigger if exists validar_gasto on public.gastos;
create trigger validar_gasto before insert or update on public.gastos
  for each row execute function privado.validar_gasto();

-- Pagos entre compañeros: ambos deben ser miembros
create or replace function privado.validar_liquidacion() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.miembros where grupo_id = new.grupo_id and user_id = new.de)
     or not exists (select 1 from public.miembros where grupo_id = new.grupo_id and user_id = new.para) then
    raise exception 'Ambas personas deben ser miembros del grupo';
  end if;
  return new;
end $$;
drop trigger if exists validar_liquidacion on public.liquidaciones;
create trigger validar_liquidacion before insert or update on public.liquidaciones
  for each row execute function privado.validar_liquidacion();

-- Evidencias: solo se pueden colgar de registros tuyos (o pagos del grupo donde participas),
-- y heredan con quién se comparte ese registro.
create or replace function privado.validar_adjunto() returns trigger
language plpgsql security definer set search_path = public as $$
declare dueno uuid; grupo uuid;
begin
  if new.tabla in ('ingresos', 'deudas') then
    execute format('select user_id, null::uuid from public.%I where id = $1', new.tabla) into dueno, grupo using new.registro_id;
  else
    execute format('select user_id, grupo_id from public.%I where id = $1', new.tabla) into dueno, grupo using new.registro_id;
  end if;
  if dueno is null then raise exception 'El registro de la evidencia no existe'; end if;
  if dueno <> new.user_id and not (new.tabla in ('liquidaciones', 'metas') and grupo is not null
       and exists (select 1 from public.miembros where grupo_id = grupo and user_id = new.user_id)) then
    raise exception 'Solo puedes adjuntar evidencias a tus propios registros';
  end if;
  new.grupo_id := grupo;
  return new;
end $$;
drop trigger if exists validar_adjunto on public.adjuntos;
create trigger validar_adjunto before insert or update on public.adjuntos
  for each row execute function privado.validar_adjunto();

-- Al cambiar con quién se comparte un registro, sus evidencias lo siguen
create or replace function privado.sincronizar_adjuntos() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.grupo_id is distinct from old.grupo_id then
    update public.adjuntos set grupo_id = new.grupo_id where tabla = tg_table_name and registro_id = new.id;
  end if;
  return new;
end $$;
do $$
declare t text;
begin
  foreach t in array array['gastos','recurrentes','metas','eventos'] loop
    execute format('drop trigger if exists sincronizar_adjuntos on public.%I', t);
    execute format('create trigger sincronizar_adjuntos after update on public.%I
      for each row execute function privado.sincronizar_adjuntos()', t);
  end loop;
end $$;

-- Al borrar un registro se borran sus filas de evidencia
create or replace function privado.borrar_adjuntos() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.adjuntos where tabla = tg_table_name and registro_id = old.id;
  return old;
end $$;
do $$
declare t text;
begin
  foreach t in array array['ingresos','gastos','deudas','recurrentes','metas','eventos','liquidaciones'] loop
    execute format('drop trigger if exists borrar_adjuntos on public.%I', t);
    execute format('create trigger borrar_adjuntos after delete on public.%I
      for each row execute function privado.borrar_adjuntos()', t);
  end loop;
end $$;

revoke all on function privado.validar_gasto(), privado.validar_liquidacion(), privado.validar_adjunto(),
  privado.sincronizar_adjuntos(), privado.borrar_adjuntos() from public, anon, authenticated;

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
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;

  -- Tablas siempre privadas
  foreach t in array array['ingresos','deudas','presupuestos'] loop
    execute format('create policy "solo_propietario" on public.%I for all to authenticated
      using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;

  -- Tablas que pueden compartirse con un grupo
  foreach t in array array['gastos','recurrentes','metas','eventos','adjuntos'] loop
    execute format('create policy "ver" on public.%I for select to authenticated
      using (user_id = (select auth.uid()) or (grupo_id is not null and privado.es_miembro(grupo_id)))', t);
    execute format('create policy "crear" on public.%I for insert to authenticated
      with check (user_id = (select auth.uid()) and (grupo_id is null or privado.es_miembro(grupo_id)))', t);
    execute format('create policy "borrar" on public.%I for delete to authenticated
      using (user_id = (select auth.uid()))', t);
  end loop;
  foreach t in array array['gastos','recurrentes','eventos','adjuntos'] loop
    execute format('create policy "editar" on public.%I for update to authenticated
      using (user_id = (select auth.uid()))
      with check (user_id = (select auth.uid()) and (grupo_id is null or privado.es_miembro(grupo_id)))', t);
  end loop;
end $$;

-- Grupos y miembros solo se crean mediante crear_grupo / unirse_grupo
revoke insert on public.grupos, public.miembros from authenticated;
-- Nadie puede cambiar a mano el dueño, el código ni el rol
revoke update on public.grupos, public.miembros from authenticated;
grant update (nombre) on public.grupos to authenticated;
grant update (alias) on public.miembros to authenticated;

-- Metas compartidas: cualquier miembro puede aportar (solo el monto ahorrado)
create policy "editar" on public.metas for update to authenticated
  using (user_id = (select auth.uid()) or (grupo_id is not null and privado.es_miembro(grupo_id)))
  with check (user_id = (select auth.uid()) or (grupo_id is not null and privado.es_miembro(grupo_id)));

create or replace function privado.proteger_meta() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.user_id <> auth.uid() and (new.user_id, new.nombre, new.objetivo, new.fecha_limite, new.grupo_id, new.notas)
     is distinct from (old.user_id, old.nombre, old.objetivo, old.fecha_limite, old.grupo_id, old.notas) then
    raise exception 'Solo quien creó la meta puede cambiarla; tú puedes aportar';
  end if;
  return new;
end $$;
revoke all on function privado.proteger_meta() from public, anon, authenticated;
drop trigger if exists proteger_meta on public.metas;
create trigger proteger_meta before update on public.metas for each row execute function privado.proteger_meta();

-- Pagos entre compañeros: los ve todo el grupo; los registra quien paga o quien recibe
create policy "ver" on public.liquidaciones for select to authenticated
  using (privado.es_miembro(grupo_id));
create policy "crear" on public.liquidaciones for insert to authenticated
  with check (user_id = (select auth.uid()) and privado.es_miembro(grupo_id)
              and ((select auth.uid()) in (de, para)));
create policy "editar" on public.liquidaciones for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and privado.es_miembro(grupo_id) and ((select auth.uid()) in (de, para)));
create policy "borrar" on public.liquidaciones for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "ver" on public.grupos for select to authenticated
  using (creado_por = (select auth.uid()) or privado.es_miembro(id));
create policy "editar" on public.grupos for update to authenticated
  using (creado_por = (select auth.uid())) with check (creado_por = (select auth.uid()));
create policy "borrar" on public.grupos for delete to authenticated
  using (creado_por = (select auth.uid()));

create policy "ver" on public.miembros for select to authenticated
  using (privado.es_miembro(grupo_id));
create policy "editar" on public.miembros for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "borrar" on public.miembros for delete to authenticated
  using (user_id = (select auth.uid())
         or exists (select 1 from public.grupos g where g.id = grupo_id and g.creado_por = (select auth.uid())));

-- La versión anterior exponía es_miembro en la API; ya no se usa
drop function if exists public.es_miembro(uuid);

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
on conflict (id) do update set public = false, file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','application/pdf'];

drop policy if exists "evidencias_ver"    on storage.objects;
drop policy if exists "evidencias_subir"  on storage.objects;
drop policy if exists "evidencias_borrar" on storage.objects;

-- Ver: tus archivos, o los ligados a un registro que puedes ver
create policy "evidencias_ver" on storage.objects for select to authenticated
  using (bucket_id = 'evidencias' and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or exists (select 1 from public.adjuntos a where a.ruta = objects.name)));
create policy "evidencias_subir" on storage.objects for insert to authenticated
  with check (bucket_id = 'evidencias' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "evidencias_borrar" on storage.objects for delete to authenticated
  using (bucket_id = 'evidencias' and (storage.foldername(name))[1] = (select auth.uid())::text);
