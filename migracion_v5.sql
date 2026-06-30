-- ============================================================
-- MIGRACIÓN v5 — Combos / Platos en conjunto
-- Sistema de auditorías Grupo Ceviche
-- REVISAR Y EJECUTAR MANUALMENTE en Supabase SQL Editor
-- ============================================================

-- 1. Tabla principal de combos
CREATE TABLE IF NOT EXISTS au_combos (
  id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  codigo text,
  activo boolean NOT NULL DEFAULT true
);

-- 2. Slots de cada combo (ej. "Entrante", "Principal")
CREATE TABLE IF NOT EXISTS au_combo_slots (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  combo_id uuid NOT NULL REFERENCES au_combos(id) ON DELETE CASCADE,
  nombre   text NOT NULL,
  orden    integer NOT NULL DEFAULT 0
);

-- 3. Opciones de cada slot (platos existentes que se pueden escoger en ese slot)
CREATE TABLE IF NOT EXISTS au_combo_slot_opciones (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id  uuid NOT NULL REFERENCES au_combo_slots(id) ON DELETE CASCADE,
  plato_id uuid NOT NULL REFERENCES au_platos(id) ON DELETE CASCADE
);

-- 4. Asignación de combos a locales (mismo patrón que au_plato_locales)
CREATE TABLE IF NOT EXISTS au_combo_locales (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  combo_id uuid NOT NULL REFERENCES au_combos(id) ON DELETE CASCADE,
  local_id text NOT NULL REFERENCES au_locales(id)
);

-- 5. Columnas aditivas en au_auditoria_producto_items para identificar
--    de qué combo/slot proviene cada ítem. Nullable: los ítems de platos
--    sueltos los dejan en NULL.
ALTER TABLE au_auditoria_producto_items ADD COLUMN IF NOT EXISTS combo_nombre text;
ALTER TABLE au_auditoria_producto_items ADD COLUMN IF NOT EXISTS slot_nombre  text;

-- 6. RLS permisivo anon en las 4 tablas nuevas
ALTER TABLE au_combos              ENABLE ROW LEVEL SECURITY;
ALTER TABLE au_combo_slots         ENABLE ROW LEVEL SECURITY;
ALTER TABLE au_combo_slot_opciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE au_combo_locales       ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all" ON au_combos              FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON au_combo_slots         FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON au_combo_slot_opciones FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON au_combo_locales       FOR ALL TO anon USING (true) WITH CHECK (true);
