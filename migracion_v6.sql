-- ============================================================
-- MIGRACIÓN v6 — Revisión Interna + Severidad "Extremadamente grave"
-- Sistema de auditorías Grupo Ceviche
-- REVISAR Y EJECUTAR MANUALMENTE en Supabase SQL Editor
-- REGLA: solo toca objetos con prefijo au_. Nada más.
-- ============================================================

-- 1. Nueva severidad: agregar EXTREMA a la config.
--    au_config_severidad ya existe (severidad PK, descuento numeric).
INSERT INTO au_config_severidad (severidad, descuento) VALUES ('EXTREMA', 2.00)
  ON CONFLICT (severidad) DO NOTHING;

-- 2. En au_observaciones: permitir la nueva severidad y el modo de extremadamente grave.
--    La columna severidad es text con CHECK. Hay que ampliar el CHECK para incluir 'EXTREMA'.
--    ADVERTENCIA: DROP CONSTRAINT + ADD CONSTRAINT (no se puede modificar un CHECK in-place).
ALTER TABLE au_observaciones DROP CONSTRAINT IF EXISTS au_observaciones_severidad_check;
ALTER TABLE au_observaciones ADD CONSTRAINT au_observaciones_severidad_check
  CHECK (severidad IN ('NINGUNA','LEVE','MEDIA','GRAVE','EXTREMA'));
-- modo de la extremadamente grave: 'PESO' o 'PORCENTAJE' (nullable; solo aplica si severidad='EXTREMA')
ALTER TABLE au_observaciones ADD COLUMN IF NOT EXISTS extrema_modo text
  CHECK (extrema_modo IN ('PESO','PORCENTAJE'));

-- 3. Ampliar el CHECK de 'area' en au_observaciones para incluir el apartado 4 y sus 3 aspectos.
--    Hoy area IN ('PRODUCTO','SERVICIO','LOCAL'). Agregar los 3 aspectos de Revisión Interna.
--    ADVERTENCIA: DROP CONSTRAINT + ADD CONSTRAINT.
ALTER TABLE au_observaciones DROP CONSTRAINT IF EXISTS au_observaciones_area_check;
ALTER TABLE au_observaciones ADD CONSTRAINT au_observaciones_area_check
  CHECK (area IN ('PRODUCTO','SERVICIO','LOCAL','RI_REVISION','RI_ROTULACION','RI_HIGIENE'));

-- 4. Revisión Interna: casilla conforme + comentarios por aspecto, en au_auditorias.
ALTER TABLE au_auditorias ADD COLUMN IF NOT EXISTS ri_revision_conforme  boolean;
ALTER TABLE au_auditorias ADD COLUMN IF NOT EXISTS ri_rotulacion_conforme boolean;
ALTER TABLE au_auditorias ADD COLUMN IF NOT EXISTS ri_higiene_conforme    boolean;
ALTER TABLE au_auditorias ADD COLUMN IF NOT EXISTS ri_revision_comentario  text;
ALTER TABLE au_auditorias ADD COLUMN IF NOT EXISTS ri_rotulacion_comentario text;
ALTER TABLE au_auditorias ADD COLUMN IF NOT EXISTS ri_higiene_comentario    text;
ALTER TABLE au_auditorias ADD COLUMN IF NOT EXISTS descuento_ri numeric(5,2);

-- 5. Config de descuento máximo por aspecto de Revisión Interna.
CREATE TABLE IF NOT EXISTS au_config_ri (
  aspecto     text PRIMARY KEY CHECK (aspecto IN ('RI_REVISION','RI_ROTULACION','RI_HIGIENE')),
  max_descuento numeric NOT NULL
);
ALTER TABLE au_config_ri ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON au_config_ri FOR ALL TO anon USING (true) WITH CHECK (true);
INSERT INTO au_config_ri (aspecto, max_descuento) VALUES
  ('RI_REVISION',2),('RI_ROTULACION',2),('RI_HIGIENE',3)
  ON CONFLICT (aspecto) DO NOTHING;

-- 6. au_evidencias.area ya permite PRODUCTO/SERVICIO/LOCAL. Ampliar para las fotos del apartado 4:
--    las fotos del apartado 4 usan area='REVISION_INTERNA' y la etiqueta (columna etiqueta ya existe)
--    guarda 'Revisión' / 'Rotulación' / 'Higiene de cocina'.
--    ADVERTENCIA: DROP CONSTRAINT + ADD CONSTRAINT.
ALTER TABLE au_evidencias DROP CONSTRAINT IF EXISTS au_evidencias_area_check;
ALTER TABLE au_evidencias ADD CONSTRAINT au_evidencias_area_check
  CHECK (area IN ('PRODUCTO','SERVICIO','LOCAL','REVISION_INTERNA'));
