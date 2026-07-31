-- ============================================================
-- MIGRACIÓN v9 — Módulo "Evaluación de Seguridad Alimentaria"
-- Sistema de auditorías Grupo Ceviche
-- REVISAR Y EJECUTAR MANUALMENTE en Supabase SQL Editor
-- REGLA: solo toca objetos con prefijo au_. Nada más.
--
-- Módulo NUEVO e independiente, paralelo a la auditoría de calidad
-- existente (no la modifica). Usa prefijo au_sa_ (seguridad alimentaria)
-- para todas sus tablas. Puramente aditiva: 3 tablas nuevas, no toca
-- ninguna tabla existente.
-- ============================================================

-- Cabecera de cada evaluación de seguridad alimentaria
CREATE TABLE IF NOT EXISTS au_sa_evaluaciones (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id      text NOT NULL REFERENCES au_locales(id),
  auditor_cut   text NOT NULL,
  fecha         date NOT NULL,
  estado_global text CHECK (estado_global IN ('CORRECTO','MEJORA','DEFICIENTE')),
  creado_en     timestamptz NOT NULL DEFAULT now()
);

-- Respuesta por cada punto evaluado (el catálogo de puntos vive en el código;
-- aquí se guarda la clave del punto como snapshot + su estado)
CREATE TABLE IF NOT EXISTS au_sa_respuestas (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluacion_id  uuid NOT NULL REFERENCES au_sa_evaluaciones(id) ON DELETE CASCADE,
  seccion_key    text NOT NULL,
  punto_key      text NOT NULL,
  punto_nombre   text NOT NULL,   -- snapshot legible
  seccion_nombre text NOT NULL,   -- snapshot legible
  estado         text NOT NULL CHECK (estado IN ('CUMPLE','NO_CUMPLE','NO_APLICA'))
);

-- Personas registradas en un punto que NO cumple (solo para puntos con ▶)
CREATE TABLE IF NOT EXISTS au_sa_personas (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  respuesta_id uuid NOT NULL REFERENCES au_sa_respuestas(id) ON DELETE CASCADE,
  nombre       text NOT NULL,
  accesorio    text   -- solo para el punto de accesorios; null en los demás
);

-- RLS permisivo anon en las 3 tablas (mismo patrón que el resto del proyecto)
ALTER TABLE au_sa_evaluaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE au_sa_respuestas   ENABLE ROW LEVEL SECURITY;
ALTER TABLE au_sa_personas     ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON au_sa_evaluaciones FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON au_sa_respuestas   FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON au_sa_personas     FOR ALL TO anon USING (true) WITH CHECK (true);
