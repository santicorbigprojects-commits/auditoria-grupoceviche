-- ============================================================
-- Migración v4: etiqueta opcional en au_evidencias
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

ALTER TABLE au_evidencias ADD COLUMN IF NOT EXISTS etiqueta text;
