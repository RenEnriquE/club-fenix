-- ============================================================
-- Club Atlético Independencia Fénix — Schema Supabase
-- Ejecutar en: Supabase > SQL Editor > New query
-- ============================================================

-- 1. TABLA PERSONAS
CREATE TABLE IF NOT EXISTS personas (
  id_caif       INTEGER PRIMARY KEY,
  rut           TEXT,
  dv            TEXT,
  apodo         TEXT,
  nombre        TEXT,
  seg_nombre    TEXT,
  apellido      TEXT,
  ap_mat        TEXT,
  fecha_nac     DATE,
  genero        TEXT,
  nacionalidad  TEXT,
  direccion     TEXT,
  comuna        TEXT,
  celular       TEXT,
  email         TEXT,
  atleta        TEXT,          -- 'Atleta Adulto' | 'Atleta Niño'
  vigente       INTEGER DEFAULT 1,
  f_ini_vig     DATE,
  expulsado     INTEGER DEFAULT 0,
  apoderado     TEXT,
  nombre_comp   TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_personas_nombre ON personas USING gin(to_tsvector('spanish', COALESCE(nombre_comp,'')));
CREATE INDEX IF NOT EXISTS idx_personas_vigente ON personas(vigente);

-- 2. TABLA PAGOS
CREATE TABLE IF NOT EXISTS pagos (
  id_pago       INTEGER PRIMARY KEY,
  id_socio      INTEGER REFERENCES personas(id_caif) ON DELETE CASCADE,
  periodo       INTEGER,        -- YYYYMM ej: 202604
  fecha_pago    DATE,
  monto         INTEGER DEFAULT 3000,
  tipo_pago     TEXT,           -- 'Transferencia' | 'Efectivo' | 'Cheque'
  banco         TEXT,
  num_transacc  TEXT,
  cuenta        TEXT,
  obs           TEXT,
  anio          INTEGER,
  mes           INTEGER,        -- 1-12
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para consultas por socio y año
CREATE INDEX IF NOT EXISTS idx_pagos_socio ON pagos(id_socio);
CREATE INDEX IF NOT EXISTS idx_pagos_anio ON pagos(anio);
CREATE INDEX IF NOT EXISTS idx_pagos_periodo ON pagos(periodo);

-- 3. TABLA ROLES DE USUARIO
CREATE TABLE IF NOT EXISTS user_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'comite',  -- 'admin' | 'comite'
  email       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Personas: todos los autenticados pueden leer
CREATE POLICY "Leer personas autenticados"
  ON personas FOR SELECT
  TO authenticated
  USING (true);

-- Personas: solo admin puede escribir
CREATE POLICY "Escribir personas admin"
  ON personas FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Pagos: todos los autenticados pueden leer
CREATE POLICY "Leer pagos autenticados"
  ON pagos FOR SELECT
  TO authenticated
  USING (true);

-- Pagos: solo admin puede escribir/eliminar
CREATE POLICY "Escribir pagos admin"
  ON pagos FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- User roles: cada usuario lee su propio rol
CREATE POLICY "Ver propio rol"
  ON user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- FUNCIÓN BÚSQUEDA DE PERSONAS (full-text search)
-- ============================================================
CREATE OR REPLACE FUNCTION buscar_personas(term TEXT)
RETURNS SETOF personas AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM personas
  WHERE vigente = 1
    AND (
      nombre_comp ILIKE '%' || term || '%'
      OR apodo ILIKE '%' || term || '%'
      OR CAST(id_caif AS TEXT) = term
    )
  ORDER BY nombre_comp
  LIMIT 30;
END;
$$ LANGUAGE plpgsql;
