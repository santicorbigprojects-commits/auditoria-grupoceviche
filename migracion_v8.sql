-- ============================================================
-- MIGRACIÓN v8 — Tiempos configurables + tiempos de Cholito
-- Sistema de auditorías Grupo Ceviche
-- REVISAR Y EJECUTAR MANUALMENTE en Supabase SQL Editor
-- REGLA: solo toca objetos con prefijo au_. Nada más.
--
-- ADVERTENCIA: incluye 1 DROP CONSTRAINT (no DROP TABLE) para ampliar
-- los tipos permitidos en au_config_tiempos.tipo. Se recrea en la misma
-- migración con la lista ampliada. Todo lo demás es aditivo (ADD COLUMN
-- IF NOT EXISTS / INSERT ... ON CONFLICT DO NOTHING).
-- ============================================================

-- Flags de qué tiempos se evaluaron + los 2 tiempos nuevos de Cholito.
-- Todo nullable/aditivo: las auditorías existentes quedan en NULL y el código
-- las interpreta como "tiempos base activos, sándwich/jugos no aplican"
-- (retrocompatibilidad: sus notas no cambian).
ALTER TABLE au_auditoria_servicio ADD COLUMN IF NOT EXISTS tiempos_base_activo boolean;
ALTER TABLE au_auditoria_servicio ADD COLUMN IF NOT EXISTS tiempo_sandwich_activo boolean;
ALTER TABLE au_auditoria_servicio ADD COLUMN IF NOT EXISTS tiempo_jugos_activo    boolean;
ALTER TABLE au_auditoria_servicio ADD COLUMN IF NOT EXISTS tiempo_sandwich_min numeric;
ALTER TABLE au_auditoria_servicio ADD COLUMN IF NOT EXISTS tiempo_jugos_min    numeric;
ALTER TABLE au_auditoria_servicio ADD COLUMN IF NOT EXISTS tiempo_sandwich_ok  boolean;
ALTER TABLE au_auditoria_servicio ADD COLUMN IF NOT EXISTS tiempo_jugos_ok     boolean;

-- Config de tiempo máximo para los 2 tipos nuevos. au_config_tiempos ya existe
-- (local_id nullable = global, tipo, max_min) con CHECK en tipo. Ampliar el CHECK:
ALTER TABLE au_config_tiempos DROP CONSTRAINT IF EXISTS au_config_tiempos_tipo_check;
ALTER TABLE au_config_tiempos ADD CONSTRAINT au_config_tiempos_tipo_check
  CHECK (tipo IN ('ENTRANTE','PRINCIPAL','BEBIDA','POSTRE','SANDWICH','JUGOS'));

-- Seed de los globales nuevos (local_id NULL = aplica a todos los locales;
-- solo se usarán para locales de marca 'cholito', que es donde el formulario
-- muestra estos dos tiempos).
INSERT INTO au_config_tiempos (local_id, tipo, max_min) VALUES
  (NULL,'SANDWICH',10),(NULL,'JUGOS',5)
ON CONFLICT (local_id, tipo) DO NOTHING;
