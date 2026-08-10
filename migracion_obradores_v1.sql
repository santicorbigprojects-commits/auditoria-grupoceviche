-- ============================================================
-- MÓDULO: AUDITORÍAS DE OBRADORES (v1)
-- Prefijo obligatorio: au_ | Independiente de la Auditoría de Calidad
-- REGLA DE ORO: NO tocar ni referenciar tablas vc_* ni pagos
-- NO ejecutar automáticamente: revisar y correr a mano en el SQL Editor
-- ============================================================

-- ============================================================
-- 1. TABLAS
-- ============================================================

-- Catálogo de obradores (Plancha/Salsa, Pastelería, Panadería)
CREATE TABLE IF NOT EXISTS au_obradores (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text    NOT NULL UNIQUE,
  descripcion text,
  categoria   text,   -- 'Plancha', 'Pastelería', 'Panadería'
  activo      boolean NOT NULL DEFAULT true,
  creado_en   timestamptz NOT NULL DEFAULT now()
);

-- Catálogo de los 5 aspectos evaluados (fijo, editable desde Configuración)
CREATE TABLE IF NOT EXISTS au_config_obrador_aspectos (
  id            uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        text    NOT NULL,
  descripcion   text,
  puntos_maximo integer NOT NULL,  -- peso del aspecto (3, 4 o 5)
  orden         integer NOT NULL,
  activo        boolean NOT NULL DEFAULT true,
  creado_en     timestamptz NOT NULL DEFAULT now()
);

-- Cabecera de cada auditoría de obrador
CREATE TABLE IF NOT EXISTS au_auditoria_obrador (
  id                       uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  obrador_id               uuid    NOT NULL REFERENCES au_obradores(id) ON DELETE CASCADE,
  auditor_cut              text    NOT NULL REFERENCES au_usuarios(cut),
  fecha_auditoria          date    NOT NULL,
  nota_final               numeric(5,2) NOT NULL DEFAULT 0,
  observaciones_generales  text,
  creado_en                timestamptz NOT NULL DEFAULT now(),
  actualizado_en           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_obrador_obrador_id ON au_auditoria_obrador(obrador_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_obrador_auditor_cut ON au_auditoria_obrador(auditor_cut);
CREATE INDEX IF NOT EXISTS idx_auditoria_obrador_fecha ON au_auditoria_obrador(fecha_auditoria);

-- Respuesta por cada aspecto evaluado en una auditoría (0=No / 1=Masomenos / 2=Sí)
CREATE TABLE IF NOT EXISTS au_auditoria_obrador_aspectos (
  id            uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  auditoria_id  uuid    NOT NULL REFERENCES au_auditoria_obrador(id) ON DELETE CASCADE,
  aspecto_id    uuid    NOT NULL REFERENCES au_config_obrador_aspectos(id) ON DELETE RESTRICT,
  respuesta     integer NOT NULL CHECK (respuesta IN (0, 1, 2)),
  observacion   text,
  creado_en     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (auditoria_id, aspecto_id)
);

CREATE INDEX IF NOT EXISTS idx_auditoria_obrador_aspectos_auditoria_id ON au_auditoria_obrador_aspectos(auditoria_id);

-- Observaciones con severidad (SÍ restan puntos)
CREATE TABLE IF NOT EXISTS au_auditoria_obrador_observaciones (
  id            uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  auditoria_id  uuid    NOT NULL REFERENCES au_auditoria_obrador(id) ON DELETE CASCADE,
  aspecto_id    uuid    REFERENCES au_config_obrador_aspectos(id) ON DELETE SET NULL,
  descripcion   text    NOT NULL,
  severidad     text    NOT NULL CHECK (severidad IN ('NINGUNA','LEVE','MEDIA','GRAVE','EXTREMA')),
  extrema_modo  text    CHECK (extrema_modo IN ('PESO','PORCENTAJE')),  -- solo si severidad='EXTREMA'
  peso_resta    numeric(5,2) NOT NULL DEFAULT 0,  -- snapshot del peso configurado al momento de guardar
  creado_en     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_obs_obrador_auditoria_id ON au_auditoria_obrador_observaciones(auditoria_id);

-- Evidencias fotográficas (reutiliza el bucket público au-evidencias ya existente)
CREATE TABLE IF NOT EXISTS au_auditoria_obrador_evidencias (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auditoria_id    uuid NOT NULL REFERENCES au_auditoria_obrador(id) ON DELETE CASCADE,
  aspecto_id      uuid REFERENCES au_config_obrador_aspectos(id) ON DELETE SET NULL,
  url             text NOT NULL,
  archivo_nombre  text,
  creado_en       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evidencias_obrador_auditoria_id ON au_auditoria_obrador_evidencias(auditoria_id);

-- Acciones de mejora (una por observación, igual patrón que au_acciones_mejora)
CREATE TABLE IF NOT EXISTS au_acciones_mejora_obrador (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  observacion_id    uuid NOT NULL UNIQUE REFERENCES au_auditoria_obrador_observaciones(id) ON DELETE CASCADE,
  auditoria_id      uuid NOT NULL REFERENCES au_auditoria_obrador(id) ON DELETE CASCADE,
  obrador_id        uuid NOT NULL REFERENCES au_obradores(id) ON DELETE CASCADE,
  accion_correctiva text,
  fecha_evaluacion  date,
  resuelto          boolean NOT NULL DEFAULT false,
  actualizado_en    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_acciones_mejora_obrador_obrador_id ON au_acciones_mejora_obrador(obrador_id);

-- Calendario de visitas a obradores (separado de au_visitas de locales)
CREATE TABLE IF NOT EXISTS au_visitas_obrador (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obrador_id        uuid NOT NULL REFERENCES au_obradores(id) ON DELETE CASCADE,
  auditor_cut       text NOT NULL REFERENCES au_usuarios(cut),
  fecha_programada  date NOT NULL,
  estado            text NOT NULL CHECK (estado IN ('PROGRAMADA','REALIZADA','CANCELADA')) DEFAULT 'PROGRAMADA',
  notas             text
);

CREATE INDEX IF NOT EXISTS idx_visitas_obrador_obrador_id ON au_visitas_obrador(obrador_id);
CREATE INDEX IF NOT EXISTS idx_visitas_obrador_auditor_cut ON au_visitas_obrador(auditor_cut);

-- Pesos de severidad propios de Obradores (independientes de au_config_severidad)
CREATE TABLE IF NOT EXISTS au_config_severidad_obrador (
  severidad   text PRIMARY KEY CHECK (severidad IN ('NINGUNA','LEVE','MEDIA','GRAVE','EXTREMA')),
  descuento   numeric NOT NULL
);


-- ============================================================
-- 2. ROW LEVEL SECURITY — permisivo para anon key (igual que el resto)
-- ============================================================

ALTER TABLE au_obradores                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE au_config_obrador_aspectos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE au_auditoria_obrador               ENABLE ROW LEVEL SECURITY;
ALTER TABLE au_auditoria_obrador_aspectos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE au_auditoria_obrador_observaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE au_auditoria_obrador_evidencias    ENABLE ROW LEVEL SECURITY;
ALTER TABLE au_acciones_mejora_obrador         ENABLE ROW LEVEL SECURITY;
ALTER TABLE au_visitas_obrador                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE au_config_severidad_obrador        ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all" ON au_obradores                       FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON au_config_obrador_aspectos         FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON au_auditoria_obrador               FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON au_auditoria_obrador_aspectos      FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON au_auditoria_obrador_observaciones FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON au_auditoria_obrador_evidencias    FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON au_acciones_mejora_obrador         FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON au_visitas_obrador                 FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON au_config_severidad_obrador        FOR ALL TO anon USING (true) WITH CHECK (true);


-- ============================================================
-- 3. SEED
-- ============================================================

INSERT INTO au_obradores (nombre, descripcion, categoria) VALUES
  ('Obrador Plancha y Salsa', 'Producción de salsas, marinadas y preparados de plancha', 'Plancha'),
  ('Obrador Pastelería',      'Producción de postres, pasteles y preparados de repostería', 'Pastelería'),
  ('Obrador Panadería',       'Producción de pan, bollos y productos de panadería', 'Panadería')
ON CONFLICT (nombre) DO NOTHING;

-- Suma de puntos_maximo = 20 (4+4+3+4+5), la nota queda naturalmente en escala 0-20
INSERT INTO au_config_obrador_aspectos (nombre, descripcion, puntos_maximo, orden) VALUES
  ('Limpieza de zona',   'Pisos, paredes, superficies de trabajo limpias y organizadas', 4, 1),
  ('Limpieza de fríos',  'Congeladores y refrigeradores sin suciedad, desorden ni fugas', 4, 2),
  ('Uniforme',           'Personal con uniforme limpio, completo y adecuado para la zona', 3, 3),
  ('Rotulación',         'Productos correctamente etiquetados, fechados y almacenados', 4, 4),
  ('Higiene',            'Cumplimiento de prácticas de higiene personal, manipulación y desinfección', 5, 5)
ON CONFLICT DO NOTHING;

INSERT INTO au_config_severidad_obrador (severidad, descuento) VALUES
  ('NINGUNA', 0.00),
  ('LEVE',    0.50),
  ('MEDIA',   1.00),
  ('GRAVE',   2.00),
  ('EXTREMA', 4.00)
ON CONFLICT (severidad) DO NOTHING;
