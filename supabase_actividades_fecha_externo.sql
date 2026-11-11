-- Actividades: fecha de realizacion y monto distinto para personas externas
-- Ejecutar una sola vez en Supabase > SQL Editor.

-- Fecha en que se realiza la actividad (para ordenarlas por fecha)
alter table actividades add column if not exists fecha date;

-- Monto por persona externa (no socia). Si queda vacio, los externos pagan lo mismo que los socios
-- (monto_default pasa a ser el monto por socio).
alter table actividades add column if not exists monto_externo numeric;

-- Ejemplo para asignar una fecha a una actividad existente:
-- update actividades set fecha = '2026-12-13' where id_actividad = 12;
