-- ============================================================
-- SISTEMA DE AUDITORÍAS — GRUPO CEVICHE
-- Schema: public | Prefijo obligatorio: au_
-- REGLA DE ORO: NO tocar ni referenciar tablas vc_* ni pagos
-- ============================================================


-- ============================================================
-- 1. TABLAS
-- ============================================================

-- Usuarios del sistema de auditorías (auditores, directores, admin)
CREATE TABLE IF NOT EXISTS au_usuarios (
  cut    text    PRIMARY KEY,
  nombre text    NOT NULL,
  rol    text    NOT NULL CHECK (rol IN ('AUDITOR','DIRECTOR','ADMIN')),
  activo boolean NOT NULL DEFAULT true
);

-- Marcas / carpetas de locales (Rikos y Cholito son carpetas; el resto son marcas individuales)
CREATE TABLE IF NOT EXISTS au_marcas (
  id         text    PRIMARY KEY,
  nombre     text    NOT NULL,
  es_carpeta boolean NOT NULL DEFAULT false
);

-- Locales
CREATE TABLE IF NOT EXISTS au_locales (
  id                 text    PRIMARY KEY,
  nombre             text    NOT NULL,
  marca_id           text    NOT NULL REFERENCES au_marcas(id),
  direccion          text,
  encargado_nombre   text,
  encargado_cut      text,
  jefe_cocina_nombre text,
  jefe_cocina_cut    text,
  activo             boolean NOT NULL DEFAULT true
);

-- Asignación director <-> locales que supervisa
CREATE TABLE IF NOT EXISTS au_director_locales (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  director_cut text NOT NULL,
  local_id     text NOT NULL REFERENCES au_locales(id)
);

-- Catálogo de platos auditables
CREATE TABLE IF NOT EXISTS au_platos (
  id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text    NOT NULL,
  codigo text,                       -- opcional, ej. R/001
  activo boolean NOT NULL DEFAULT true
);

-- Qué locales tienen disponible cada plato (un plato puede compartirse entre locales, ej. Rikos)
CREATE TABLE IF NOT EXISTS au_plato_locales (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plato_id uuid NOT NULL REFERENCES au_platos(id)   ON DELETE CASCADE,
  local_id text NOT NULL REFERENCES au_locales(id)
);

-- Ingredientes / elementos visibles de cada plato
CREATE TABLE IF NOT EXISTS au_plato_ingredientes (
  id       uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  plato_id uuid    NOT NULL REFERENCES au_platos(id) ON DELETE CASCADE,
  nombre   text    NOT NULL,
  orden    integer NOT NULL DEFAULT 0,
  activo   boolean NOT NULL DEFAULT true
);

-- Cabecera de cada auditoría realizada
CREATE TABLE IF NOT EXISTS au_auditorias (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id      text        NOT NULL REFERENCES au_locales(id),
  auditor_cut   text        NOT NULL,
  fecha         date        NOT NULL,
  mesero_nombre text,
  nota_producto numeric(5,2),
  nota_servicio numeric(5,2),
  nota_local    numeric(5,2),
  nota_total    numeric(5,2),
  creado_en     timestamptz NOT NULL DEFAULT now()
);

-- Detalle de producto: checkmark ✅/❌ por ingrediente de cada plato auditado (snapshot denormalizado)
CREATE TABLE IF NOT EXISTS au_auditoria_producto_items (
  id                 uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  auditoria_id       uuid    NOT NULL REFERENCES au_auditorias(id) ON DELETE CASCADE,
  plato_id           uuid    NOT NULL REFERENCES au_platos(id),
  plato_nombre       text    NOT NULL,   -- snapshot del nombre en el momento de la auditoría
  ingrediente_nombre text    NOT NULL,   -- snapshot
  cumple             boolean NOT NULL
);

-- Checklist de Servicio (booleans) + tiempos de atención
CREATE TABLE IF NOT EXISTS au_auditoria_servicio (
  id                      uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  auditoria_id            uuid    NOT NULL REFERENCES au_auditorias(id) ON DELETE CASCADE,
  -- Fidelización
  fid_speech              boolean,
  fid_nombre_camarero     boolean,
  -- Upselling
  ups_bebidas             boolean,
  ups_meta_dia            boolean,
  -- Presentación
  pres_uniformes          boolean,
  pres_cabellos           boolean,
  pres_unas               boolean,
  pres_zapatos            boolean,
  pres_barba_o_maquillaje boolean,   -- barba si hombre / maquillaje si mujer
  -- Tiempos reales (minutos digitados por el auditor)
  tiempo_entrante_min     numeric,
  tiempo_principal_min    numeric,
  tiempo_bebida_min       numeric,
  tiempo_postre_min       numeric,
  -- ✅/❌ calculado en el frontend comparando contra el rango objetivo ingresado por el auditor
  tiempo_entrante_ok      boolean,
  tiempo_principal_ok     boolean,
  tiempo_bebida_ok        boolean,
  tiempo_postre_ok        boolean
);

-- Checklist de Infraestructura (Local)
CREATE TABLE IF NOT EXISTS au_auditoria_local (
  id               uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  auditoria_id     uuid    NOT NULL REFERENCES au_auditorias(id) ON DELETE CASCADE,
  cart_actualizada boolean,
  cart_completa    boolean,
  limp_sala        boolean,
  limp_banos       boolean,
  limp_barras      boolean
);

-- Observaciones / oportunidades de mejora (aplican descuento al área correspondiente)
CREATE TABLE IF NOT EXISTS au_observaciones (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auditoria_id uuid NOT NULL REFERENCES au_auditorias(id) ON DELETE CASCADE,
  area         text NOT NULL CHECK (area      IN ('PRODUCTO','SERVICIO','LOCAL')),
  texto        text NOT NULL,
  severidad    text NOT NULL CHECK (severidad IN ('NINGUNA','LEVE','MEDIA','GRAVE'))
);

-- Pesos de descuento por severidad (editables desde la vista de Configuración)
CREATE TABLE IF NOT EXISTS au_config_severidad (
  severidad text    PRIMARY KEY,
  descuento numeric NOT NULL
);

-- Calendario de visitas planificadas
CREATE TABLE IF NOT EXISTS au_visitas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id    text NOT NULL REFERENCES au_locales(id),
  auditor_cut text NOT NULL,
  fecha       date NOT NULL,
  hora        time,
  estado      text NOT NULL CHECK (estado IN ('PROGRAMADA','REALIZADA','CANCELADA')) DEFAULT 'PROGRAMADA',
  notas       text
);


-- ============================================================
-- 2. ROW LEVEL SECURITY — permisivo para anon key
--    (la autenticación real se gestiona por CUT en el frontend)
-- ============================================================

ALTER TABLE au_usuarios                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE au_marcas                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE au_locales                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE au_director_locales         ENABLE ROW LEVEL SECURITY;
ALTER TABLE au_platos                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE au_plato_locales            ENABLE ROW LEVEL SECURITY;
ALTER TABLE au_plato_ingredientes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE au_auditorias               ENABLE ROW LEVEL SECURITY;
ALTER TABLE au_auditoria_producto_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE au_auditoria_servicio       ENABLE ROW LEVEL SECURITY;
ALTER TABLE au_auditoria_local          ENABLE ROW LEVEL SECURITY;
ALTER TABLE au_observaciones            ENABLE ROW LEVEL SECURITY;
ALTER TABLE au_config_severidad         ENABLE ROW LEVEL SECURITY;
ALTER TABLE au_visitas                  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all" ON au_usuarios                 FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON au_marcas                   FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON au_locales                  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON au_director_locales         FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON au_platos                   FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON au_plato_locales            FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON au_plato_ingredientes       FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON au_auditorias               FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON au_auditoria_producto_items FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON au_auditoria_servicio       FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON au_auditoria_local          FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON au_observaciones            FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON au_config_severidad         FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON au_visitas                  FOR ALL TO anon USING (true) WITH CHECK (true);


-- ============================================================
-- 3. SEED
-- ============================================================

-- au_marcas
INSERT INTO au_marcas (id, nombre, es_carpeta) VALUES
  ('rikos',      'Rikos',             true),
  ('cholito',    'Cholito',           true),
  ('carmela',    'Carmela',           false),
  ('ceviche103', 'Ceviche 103',       false),
  ('cholochang', 'Chifa Cholo Chang', false),
  ('laturuleca', 'La Turuleca',       false),
  ('nikkei103',  'Nikkei 103',        false)
ON CONFLICT (id) DO NOTHING;

-- au_locales (19 locales)
-- Nota: las comillas simples dentro de strings se escapan como ''
INSERT INTO au_locales
  (id, nombre, marca_id, direccion, encargado_nombre, encargado_cut, jefe_cocina_nombre, jefe_cocina_cut)
VALUES
  -- Marca individual: Carmela
  -- Encargado interino: Henrry Fernández (A00056). Jefe de cocina: Cristian Salas (sin CUT en lista oficial).
  ('loc_carmela',
   'Carmela', 'carmela',
   'Carrer de Sant Pere Més Alt, 4, Ciutat Vella, 08003 Barcelona',
   'Henrry Lizandro Fernandez Olortegui', 'A00056',
   'Cristian Salas', null),

  -- Marca individual: Ceviche 103
  ('loc_ceviche103',
   'Ceviche 103', 'ceviche103',
   'Carrer de Londres, 103, Eixample, 08036 Barcelona',
   'Christian Chumbes', 'A00025',
   'Christian Bulnes', 'A00006'),

  -- Marca individual: Chifa Cholo Chang
  -- Jefe de cocina: Alonso Castellanos (sin CUT en lista oficial).
  ('loc_cholochang',
   'Chifa Cholo Chang', 'cholochang',
   'Carrer de Sants, 32, Sants-Montjuïc, 08014 Barcelona',
   'Víctor Ramírez', 'A00099',
   'Alonso Castellanos', null),

  -- Marca individual: La Turuleca
  -- Carlos Reyes -> A00062 (Carlos Gustavo Reyes Cervantes, único match no ambiguo).
  ('loc_laturuleca',
   'La Turuleca', 'laturuleca',
   'Carrer d''Arizala, 5, 08028 Barcelona',
   'Alexander Gutti', 'A00008',
   'Carlos Reyes', 'A00062'),

  -- Marca individual: Nikkei 103
  ('loc_nikkei',
   'Nikkei 103', 'nikkei103',
   'Carrer d''Aribau, 33, Eixample, 08011 Barcelona',
   'Iman Gasal', 'A00023',
   'Jesús Oshiro', 'A00200'),

  -- Cholito Hospitalet
  ('loc_cholito_hospitalet',
   'Cholito Hospitalet', 'cholito',
   'Carrer Progrés, 124, 08904 L''Hospitalet de Llobregat, Barcelona',
   'Elva Arias', 'A00166',
   null, null),

  -- Cholito Sagrera
  ('loc_cholito_sagrera',
   'Cholito Sagrera', 'cholito',
   'Carrer de Felip II, 134, Sant Andreu, 08027 Barcelona',
   'Edith Cruzatt', 'A00087',
   null, null),

  -- Cholito Sagrada Familia
  ('loc_cholito_sagrada',
   'Cholito Sagrada', 'cholito',
   'Carrer de Cartagena, 285, Eixample, 08025 Barcelona',
   'Michael Mayorga', 'A00069',
   null, null),

  -- Cholito Poble Sec
  ('loc_cholito_poblesec',
   'Cholito Poble Sec', 'cholito',
   'Avinguda del Paral·lel, 150 Local 2, Eixample, 08015 Barcelona',
   'Giovanna Arce', 'A00021',
   null, null),

  -- Rikos Badal
  ('loc_rikos_badal',
   'Rikos Badal', 'rikos',
   'Carrer de Sugranyes, 6, Sants-Montjuïc, 08028 Barcelona',
   'Eddu Barrientos', 'A00002',
   'Jose Luis Ccohaquira', 'A00037'),

  -- Rikos Lluria
  -- Jefe de cocina: Pablo Noé (sin CUT en lista oficial).
  ('loc_rikos_lluria',
   'Rikos Lluria', 'rikos',
   'Carrer de Roger de Llúria, 54, Eixample, 08009 Barcelona',
   'Anderson Llempen', 'A00028',
   'Pablo Noé', null),

  -- Rikos Santa Coloma
  ('loc_rikos_santacoloma',
   'Rikos Santa Coloma', 'rikos',
   'Avinguda de Santa Coloma, 5, 08922 Santa Coloma de Gramenet, Barcelona',
   'Ingrid Muguerza', 'A00075',
   'Roberto Pérez', 'A00003'),

  -- Rikos Can Vidalet
  ('loc_rikos_canvidalet',
   'Rikos Can Vidalet', 'rikos',
   'Carrer Hierbabuena, 41-43, 08906 L''Hospitalet de Llobregat, Barcelona',
   'Ana Sissa Arco Huaman', 'A00017',
   'Jaime Torres', 'A00149'),

  -- Rikos Cornella
  -- Encargado: Luis Antonio Cardenas Pinchi -> A00051.
  ('loc_rikos_cornella',
   'Rikos Cornella', 'rikos',
   'Carrer del Bruc, 7, 08940 Cornellà de Llobregat, Barcelona',
   'Luis Pinchi', 'A00051',
   'Juan Chanta', 'A00053'),

  -- Rikos Glories
  -- Jefe de cocina: Robert Díaz (sin CUT en lista oficial).
  ('loc_rikos_glories',
   'Rikos Glories', 'rikos',
   'Carrer de Sant Joan de Malta, 119, Sant Martí, 08018 Barcelona',
   'Jordi Villaverde', 'A00116',
   'Robert Díaz', null),

  -- Rikos Icaria
  ('loc_rikos_icaria',
   'Rikos Icaria', 'rikos',
   'Avinguda d''Icària, 132, local 2, Sant Martí, 08005 Barcelona',
   'Xiomara Cárdenas', 'A00150',
   'Luis Santamaría', 'A00125'),

  -- Rikos Meridiana
  ('loc_rikos_meridiana',
   'Rikos Meridiana', 'rikos',
   'Avinguda Meridiana, 211, Sant Andreu, 08027 Barcelona',
   'Simón León', 'A00014',
   'Jhonny Sudario', 'A00036'),

  -- Rikos Poble Sec
  -- Encargado: Jesus Valentin Arco Huaman -> A00177.
  ('loc_rikos_poblesec',
   'Rikos Poble Sec', 'rikos',
   'Avinguda del Paral·lel, 150 Local 1, Eixample, 08015 Barcelona',
   'Jesús Arco', 'A00177',
   'Jaffet Cárdenas', 'A00067'),

  -- Rikos 4 Caminos (Madrid)
  -- Encargado: Roberto Junior Arco Huaman -> A00005.
  ('loc_rikos_4caminos',
   'Rikos 4 Caminos', 'rikos',
   'Carrer de Ávila, 17, Tetuán, 28020 Madrid',
   'Roberto Arco', 'A00005',
   'Richar Pujay', 'A00109')

ON CONFLICT (id) DO NOTHING;

-- au_usuarios
INSERT INTO au_usuarios (cut, nombre, rol, activo) VALUES
  -- Auditor genérico de pruebas
  ('A00300', 'Auditor de Calidad', 'AUDITOR', true),
  -- Directores
  ('A00019', 'Vladimir Calanche',  'DIRECTOR', true),
  ('A00021', 'Giovanna Arce',      'DIRECTOR', true),
  ('A00004', 'Alex Luna',          'DIRECTOR', true),
  -- Administradores (ven todos los locales)
  ('A99001', 'Thalía Rubio',       'ADMIN', true),
  ('A99002', 'Santiago Cornelio',  'ADMIN', true),
  ('A00128', 'Milagros Mejia',     'ADMIN', true),
  ('A00024', 'Karol Trujillo',     'ADMIN', true),
  ('A00038', 'Gianina Espinoza',   'ADMIN', true),
  ('A00076', 'Luzmila Chang',      'ADMIN', true)
ON CONFLICT (cut) DO NOTHING;

-- au_director_locales
INSERT INTO au_director_locales (director_cut, local_id) VALUES
  -- Vladimir Calanche (A00019)
  ('A00019', 'loc_rikos_badal'),
  ('A00019', 'loc_rikos_lluria'),
  ('A00019', 'loc_rikos_santacoloma'),
  ('A00019', 'loc_ceviche103'),
  ('A00019', 'loc_laturuleca'),
  ('A00019', 'loc_rikos_canvidalet'),
  ('A00019', 'loc_rikos_cornella'),
  ('A00019', 'loc_rikos_meridiana'),
  -- Giovanna Arce (A00021)
  ('A00021', 'loc_cholito_hospitalet'),
  ('A00021', 'loc_cholito_sagrera'),
  ('A00021', 'loc_cholito_sagrada'),
  ('A00021', 'loc_cholito_poblesec'),
  -- Alex Luna (A00004)
  ('A00004', 'loc_carmela'),
  ('A00004', 'loc_nikkei'),
  ('A00004', 'loc_cholochang'),
  ('A00004', 'loc_rikos_poblesec'),
  ('A00004', 'loc_rikos_4caminos'),
  ('A00004', 'loc_rikos_glories'),
  ('A00004', 'loc_rikos_icaria');

-- au_config_severidad
INSERT INTO au_config_severidad (severidad, descuento) VALUES
  ('NINGUNA', 0.00),
  ('LEVE',    0.25),
  ('MEDIA',   0.50),
  ('GRAVE',   1.00)
ON CONFLICT (severidad) DO NOTHING;

-- au_platos / au_plato_locales / au_plato_ingredientes
-- Vacíos intencionalmente: Santi los carga desde la vista de Configuración.
