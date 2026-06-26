-- ============================================================
-- MIGRACIÓN V2 — Sistema de Auditorías Grupo Ceviche
-- Ejecutar en el SQL Editor de Supabase (una sola vez).
-- REGLA: solo toca objetos con prefijo au_. Nada más.
-- ============================================================


-- ============================================================
-- TANDA A2 — Columnas "Oportunidades de mejora" en au_auditorias
-- Son texto libre, informativo; NO afectan el cálculo de notas.
-- ============================================================

ALTER TABLE au_auditorias
  ADD COLUMN IF NOT EXISTS oportunidad_producto text,
  ADD COLUMN IF NOT EXISTS oportunidad_servicio text,
  ADD COLUMN IF NOT EXISTS oportunidad_local    text;


-- ============================================================
-- TANDA A3 — Tres casillas por ingrediente en au_auditoria_producto_items
-- Reemplaza la semántica de `cumple` por tres checks independientes.
-- La columna `cumple` se deja intacta por compatibilidad con auditorías
-- anteriores; las nuevas auditorías usarán contiene/limpieza/peso_adecuado.
-- ============================================================

ALTER TABLE au_auditoria_producto_items
  ADD COLUMN IF NOT EXISTS contiene      boolean,
  ADD COLUMN IF NOT EXISTS limpieza      boolean,
  ADD COLUMN IF NOT EXISTS peso_adecuado boolean;

-- Nota: la columna 'cumple' NO se elimina; las filas antiguas conservan su valor.


-- ============================================================
-- TANDA B — Tabla de tiempos objetivo (global + override por local)
-- ============================================================

CREATE TABLE IF NOT EXISTS au_config_tiempos (
  id       uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id text    REFERENCES au_locales(id),      -- NULL = valor global por defecto
  tipo     text    NOT NULL CHECK (tipo IN ('ENTRANTE','PRINCIPAL','BEBIDA','POSTRE')),
  max_min  numeric NOT NULL,                        -- objetivo máximo en minutos
  UNIQUE (local_id, tipo)
);

ALTER TABLE au_config_tiempos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all" ON au_config_tiempos
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- Seed: valores globales por defecto (local_id NULL = aplica a todos los locales).
-- Si ya existen, ON CONFLICT los ignora; son seguros de volver a ejecutar.
INSERT INTO au_config_tiempos (local_id, tipo, max_min) VALUES
  (NULL, 'ENTRANTE',  10),
  (NULL, 'PRINCIPAL', 20),
  (NULL, 'BEBIDA',     5),
  (NULL, 'POSTRE',    10)
ON CONFLICT (local_id, tipo) DO NOTHING;


-- ============================================================
-- TANDA C1 — Tabla de evidencias (fotos) por área de auditoría
-- ============================================================

CREATE TABLE IF NOT EXISTS au_evidencias (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  auditoria_id uuid        NOT NULL REFERENCES au_auditorias(id) ON DELETE CASCADE,
  area         text        NOT NULL CHECK (area IN ('PRODUCTO','SERVICIO','LOCAL')),
  url          text        NOT NULL,
  creado_en    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE au_evidencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all" ON au_evidencias
  FOR ALL TO anon USING (true) WITH CHECK (true);


-- ============================================================
-- FIN DE LA MIGRACIÓN V2
-- ============================================================
