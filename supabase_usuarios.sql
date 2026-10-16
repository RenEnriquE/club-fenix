-- ============================================================
-- GESTION DE USUARIOS - Club Fenix
-- Ejecutar UNA vez en Supabase > SQL Editor.
-- ANTES de ejecutar: editar la clave del admin en el bloque final (v_clave).
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

-- 1. Tablas (sin acceso directo desde el navegador: RLS activo y sin politicas)
create table if not exists public.app_usuarios (
  id               uuid primary key default gen_random_uuid(),
  email            text not null unique,          -- siempre en minusculas
  password_hash    text not null,                 -- bcrypt, nunca texto plano
  role             text not null check (role in ('admin','comite','coach')),
  nombre           text,
  activo           boolean not null default true,
  intentos_fallidos integer not null default 0,
  bloqueado_hasta  timestamptz,
  creado_en        timestamptz not null default now(),
  ultimo_login     timestamptz
);

create table if not exists public.app_sesiones (
  token       text primary key,
  id_usuario  uuid not null references public.app_usuarios(id) on delete cascade,
  creada_en   timestamptz not null default now(),
  ultimo_uso  timestamptz not null default now(),
  expira_en   timestamptz not null
);
create index if not exists idx_app_sesiones_usuario on public.app_sesiones(id_usuario);

alter table public.app_usuarios enable row level security;
alter table public.app_sesiones enable row level security;
revoke all on public.app_usuarios from anon, authenticated;
revoke all on public.app_sesiones from anon, authenticated;

-- 2. Verificacion interna de admin (no expuesta al navegador)
create or replace function public.app_check_admin(p_token text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid;
begin
  select u.id into v_id
    from app_sesiones s join app_usuarios u on u.id = s.id_usuario
   where s.token = p_token and s.expira_en > now() and u.activo and u.role = 'admin';
  if v_id is null then raise exception 'No autorizado'; end if;
  return v_id;
end $$;
revoke all on function public.app_check_admin(text) from public, anon, authenticated;

-- 3. Login: valida clave, bloquea 15 min tras 5 intentos fallidos, crea sesion de 30 dias
create or replace function public.app_login(p_email text, p_password text)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare
  u public.app_usuarios;
  v_token text;
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  select * into u from app_usuarios where email = v_email;
  if not found then
    return json_build_object('ok', false, 'error', 'Email o clave incorrectos.');
  end if;

  if u.bloqueado_hasta is not null and u.bloqueado_hasta <= now() then
    update app_usuarios set intentos_fallidos = 0, bloqueado_hasta = null where id = u.id;
    u.intentos_fallidos := 0; u.bloqueado_hasta := null;
  end if;
  if u.bloqueado_hasta is not null then
    return json_build_object('ok', false, 'error', 'Demasiados intentos. Intenta de nuevo en unos minutos.');
  end if;

  if not u.activo or u.password_hash <> crypt(coalesce(p_password, ''), u.password_hash) then
    update app_usuarios
       set intentos_fallidos = intentos_fallidos + 1,
           bloqueado_hasta = case when intentos_fallidos + 1 >= 5 then now() + interval '15 minutes' else null end
     where id = u.id;
    return json_build_object('ok', false, 'error', 'Email o clave incorrectos.');
  end if;

  v_token := encode(gen_random_bytes(32), 'hex');
  insert into app_sesiones(token, id_usuario, expira_en) values (v_token, u.id, now() + interval '30 days');
  update app_usuarios set ultimo_login = now(), intentos_fallidos = 0, bloqueado_hasta = null where id = u.id;
  delete from app_sesiones where expira_en < now();
  return json_build_object('ok', true, 'token', v_token, 'email', u.email, 'role', u.role, 'nombre', u.nombre);
end $$;

-- 4. Validar sesion (tambien actua como "latido" para saber quien esta conectado)
create or replace function public.app_session_check(p_token text)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare u public.app_usuarios;
begin
  select usr.* into u
    from app_sesiones s join app_usuarios usr on usr.id = s.id_usuario
   where s.token = p_token and s.expira_en > now() and usr.activo;
  if not found then return json_build_object('ok', false); end if;
  update app_sesiones set ultimo_uso = now() where token = p_token;
  return json_build_object('ok', true, 'email', u.email, 'role', u.role, 'nombre', u.nombre);
end $$;

create or replace function public.app_logout(p_token text)
returns void language sql security definer set search_path = public, extensions as $$
  delete from app_sesiones where token = p_token;
$$;

-- 5. Funciones de administracion (solo con token de un admin activo)
create or replace function public.app_admin_listar(p_token text)
returns json language plpgsql security definer set search_path = public, extensions as $$
begin
  perform app_check_admin(p_token);
  return coalesce((
    select json_agg(x order by x.role, x.email) from (
      select u.id, u.email, u.nombre, u.role, u.activo, u.creado_en, u.ultimo_login,
             (select max(s.ultimo_uso) from app_sesiones s
               where s.id_usuario = u.id and s.expira_en > now()) as ultimo_uso,
             exists (select 1 from app_sesiones s
               where s.id_usuario = u.id and s.expira_en > now()
                 and s.ultimo_uso > now() - interval '10 minutes') as conectado
        from app_usuarios u
    ) x
  ), '[]'::json);
end $$;

create or replace function public.app_admin_crear(
  p_token text, p_email text, p_password text, p_role text, p_nombre text default null)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_id uuid;
begin
  perform app_check_admin(p_token);
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Correo invalido'; end if;
  if length(coalesce(p_password, '')) < 8 then raise exception 'La clave debe tener al menos 8 caracteres'; end if;
  if p_role not in ('comite','coach') then raise exception 'Rol no permitido'; end if;
  if exists (select 1 from app_usuarios where email = v_email) then
    raise exception 'Ya existe un usuario con ese correo';
  end if;
  insert into app_usuarios(email, password_hash, role, nombre)
  values (v_email, crypt(p_password, gen_salt('bf')), p_role, nullif(trim(coalesce(p_nombre, '')), ''))
  returning id into v_id;
  return json_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.app_admin_cambiar_clave(p_token text, p_id uuid, p_password text)
returns json language plpgsql security definer set search_path = public, extensions as $$
begin
  perform app_check_admin(p_token);
  if length(coalesce(p_password, '')) < 8 then raise exception 'La clave debe tener al menos 8 caracteres'; end if;
  update app_usuarios
     set password_hash = crypt(p_password, gen_salt('bf')), intentos_fallidos = 0, bloqueado_hasta = null
   where id = p_id;
  if not found then raise exception 'Usuario no encontrado'; end if;
  -- cierra las sesiones abiertas de ese usuario (menos la del admin que hace el cambio)
  delete from app_sesiones where id_usuario = p_id and token <> p_token;
  return json_build_object('ok', true);
end $$;

create or replace function public.app_admin_set_activo(p_token text, p_id uuid, p_activo boolean)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare v_role text;
begin
  perform app_check_admin(p_token);
  select role into v_role from app_usuarios where id = p_id;
  if v_role is null then raise exception 'Usuario no encontrado'; end if;
  if v_role = 'admin' then raise exception 'No se puede desactivar a un administrador'; end if;
  update app_usuarios set activo = p_activo where id = p_id;
  if not p_activo then delete from app_sesiones where id_usuario = p_id; end if;
  return json_build_object('ok', true);
end $$;

create or replace function public.app_admin_cambiar_rol(p_token text, p_id uuid, p_role text)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare v_role text;
begin
  perform app_check_admin(p_token);
  if p_role not in ('comite','coach') then raise exception 'Rol no permitido'; end if;
  select role into v_role from app_usuarios where id = p_id;
  if v_role is null then raise exception 'Usuario no encontrado'; end if;
  if v_role = 'admin' then raise exception 'No se puede cambiar el rol de un administrador'; end if;
  update app_usuarios set role = p_role where id = p_id;
  return json_build_object('ok', true);
end $$;

-- 6. Permisos: solo estas funciones son invocables desde la app
grant execute on function
  public.app_login(text, text),
  public.app_session_check(text),
  public.app_logout(text),
  public.app_admin_listar(text),
  public.app_admin_crear(text, text, text, text, text),
  public.app_admin_cambiar_clave(text, uuid, text),
  public.app_admin_set_activo(text, uuid, boolean),
  public.app_admin_cambiar_rol(text, uuid, text)
to anon, authenticated;

-- 7. Cuentas iniciales.
--    El admin queda con la clave que escribas en v_clave (minimo 8 caracteres).
--    Las otras 3 cuentas quedan con una clave aleatoria: asignales su clave desde la hoja Usuarios.
do $$
declare v_clave text := 'CAMBIAR_ESTA_CLAVE';
begin
  if v_clave = 'CAMBIAR_ESTA_CLAVE' or length(v_clave) < 8 then
    raise exception 'Edita v_clave con la nueva clave del admin (minimo 8 caracteres) antes de ejecutar';
  end if;
  insert into public.app_usuarios(email, password_hash, role, nombre) values
    ('renenrique@gmail.com', extensions.crypt(v_clave, extensions.gen_salt('bf')), 'admin', 'Rene Enrique')
  on conflict (email) do nothing;
  insert into public.app_usuarios(email, password_hash, role, nombre) values
    ('contactoclubcaif@gmail.com', extensions.crypt(encode(extensions.gen_random_bytes(16), 'hex'), extensions.gen_salt('bf')), 'comite', 'Comite CAIF'),
    ('faviohernan16@gmail.com', extensions.crypt(encode(extensions.gen_random_bytes(16), 'hex'), extensions.gen_salt('bf')), 'coach', 'Favio'),
    ('sepulvedaperezfrancisca@gmail.com', extensions.crypt(encode(extensions.gen_random_bytes(16), 'hex'), extensions.gen_salt('bf')), 'coach', 'Francisca')
  on conflict (email) do nothing;
end $$;
