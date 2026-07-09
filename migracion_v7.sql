-- ============================================================
-- MIGRACIÓN v7 — Acciones de mejora
-- Sistema de auditorías Grupo Ceviche
-- REVISAR Y EJECUTAR MANUALMENTE en Supabase SQL Editor
-- REGLA: solo toca objetos con prefijo au_. Nada más.
-- ============================================================

-- Acciones de mejora: una por observación (relación 1 a 1, opcional).
CREATE TABLE IF NOT EXISTS au_acciones_mejora (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  observacion_id uuid NOT NULL UNIQUE REFERENCES au_observaciones(id) ON DELETE CASCADE,
  accion         text,
  fecha_evaluacion date,
  resuelto       boolean NOT NULL DEFAULT false,
  actualizado_en timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE au_acciones_mejora ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON au_acciones_mejora FOR ALL TO anon USING (true) WITH CHECK (true);
