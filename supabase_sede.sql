-- Sede de entrenamiento de cada socio (Recoleta, Independencia, Renca)
-- Ejecutar una sola vez en Supabase > SQL Editor.
-- Con tipo enum, el Table Editor muestra un desplegable con las opciones.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'sede_entrenamiento') then
    create type sede_entrenamiento as enum ('Recoleta', 'Independencia', 'Renca');
  end if;
end $$;

alter table personas add column if not exists sede sede_entrenamiento;

-- Asignacion masiva por ID (ejemplo):
-- update personas set sede = 'Recoleta' where id_caif in (101, 102, 103);

-- Agregar una sede nueva mas adelante:
-- alter type sede_entrenamiento add value 'NuevaSede';
