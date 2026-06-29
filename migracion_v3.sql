-- ============================================================
-- Migración v3: hora_fin en au_visitas
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

ALTER TABLE au_visitas ADD COLUMN IF NOT EXISTS hora_fin time;
