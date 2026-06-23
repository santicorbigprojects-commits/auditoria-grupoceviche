# PROMPT CLAUDE CODE — Sistema de Auditoría Grupo Ceviche

## CONTEXTO Y REGLA DE ORO

Vas a construir desde cero una plataforma web de **auditorías de locales** para Grupo Ceviche. El backend es **Supabase COMPARTIDO** con otros dos sistemas (Ventas y Pagos) que ya están en producción.

**REGLA DE ORO INNEGOCIABLE:** TODAS las tablas, vistas, funciones y políticas que crees DEBEN llevar el prefijo `au_`. Está PROHIBIDO leer, modificar, borrar o referenciar cualquier tabla con prefijo `vc_` o cualquier tabla del sistema de pagos. Si en algún momento dudas si una tabla es tuya, NO la toques. Trabaja exclusivamente sobre tablas `au_*` en el schema `public`.

## STACK (idéntico al resto de mis sistemas)

- React + TypeScript + Vite
- Tailwind CSS
- Zustand (estado global)
- Supabase JS client (`@supabase/supabase-js`) sobre PostgREST
- Deploy: Vercel (GitHub-connected)
- NO usar Supabase Auth. Login únicamente por **CUT** (código de empleado), con routing por rol post-login. Sesión en localStorage (8 horas).

## VARIABLES DE ENTORNO

Usa exclusivamente:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Crea `.env.local` con placeholders y agrégalo a `.gitignore`. NO hardcodees credenciales.

## CUIDADO CON EL LÍMITE DE FILAS DE POSTGREST

En consultas sobre tablas que crecen (auditorías, observaciones, visitas) añade SIEMPRE `.range(0, 9999)` y, donde aplique, filtros por fecha (`.gte`). Ya tuve truncamiento silencioso a 1000 filas en otro sistema.

---

## 1. ESQUEMA DE BASE DE DATOS (genera un archivo `supabase_schema.sql`)

Crea el SQL completo (CREATE TABLE IF NOT EXISTS) con prefijo `au_`. RLS habilitado pero con políticas permisivas para la `anon` key (igual que mi sistema de Ventas), ya que la auth es por CUT en el frontend.

### Tablas

**au_usuarios** — auditores, directores y admin
- `cut` text PK
- `nombre` text
- `rol` text CHECK in ('AUDITOR','DIRECTOR','ADMIN')
- `activo` boolean default true

**au_marcas** — para agrupar locales en "carpetas" (Rikos, Cholito, e individuales)
- `id` text PK (ej. 'rikos','cholito','carmela')
- `nombre` text
- `es_carpeta` boolean (true para Rikos y Cholito)

**au_locales**
- `id` text PK (ej. 'loc_rikos_badal')
- `nombre` text (nombre normalizado)
- `marca_id` text FK -> au_marcas.id
- `direccion` text
- `encargado_nombre` text
- `encargado_cut` text
- `jefe_cocina_nombre` text
- `jefe_cocina_cut` text
- `activo` boolean default true

**au_director_locales** — relación director (CUT) <-> locales que supervisa
- `id` uuid default gen_random_uuid() PK
- `director_cut` text
- `local_id` text FK -> au_locales.id

**au_platos** — catálogo de platos (config)
- `id` uuid default gen_random_uuid() PK
- `nombre` text
- `codigo` text null (opcional R/XXXX)
- `activo` boolean default true

**au_plato_locales** — qué locales tienen cada plato (un plato puede estar en varios locales, ej. Rikos comparten platos)
- `id` uuid PK
- `plato_id` uuid FK -> au_platos.id
- `local_id` text FK -> au_locales.id

**au_plato_ingredientes** — ingredientes/elementos visibles de cada plato
- `id` uuid PK
- `plato_id` uuid FK -> au_platos.id
- `nombre` text
- `orden` int default 0
- `activo` boolean default true

**au_auditorias** — cabecera de cada auditoría realizada
- `id` uuid PK default gen_random_uuid()
- `local_id` text FK -> au_locales.id
- `auditor_cut` text
- `fecha` date
- `mesero_nombre` text null
- `nota_producto` numeric(5,2)
- `nota_servicio` numeric(5,2)
- `nota_local` numeric(5,2)
- `nota_total` numeric(5,2)
- `creado_en` timestamptz default now()

**au_auditoria_producto_items** — detalle: ✅/❌ por ingrediente de cada plato auditado
- `id` uuid PK
- `auditoria_id` uuid FK -> au_auditorias.id
- `plato_id` uuid FK -> au_platos.id
- `plato_nombre` text (denormalizado snapshot)
- `ingrediente_nombre` text (snapshot)
- `cumple` boolean

**au_auditoria_servicio** — checklist de Servicio (booleans ✅/❌) y tiempos
- `id` uuid PK
- `auditoria_id` uuid FK
- `fid_speech` boolean
- `fid_nombre_camarero` boolean
- `ups_bebidas` boolean
- `ups_meta_dia` boolean
- `pres_uniformes` boolean
- `pres_cabellos` boolean
- `pres_unas` boolean
- `pres_zapatos` boolean
- `pres_barba_o_maquillaje` boolean  (barba si hombre / maquillaje si mujer)
- `tiempo_entrante_min` numeric null
- `tiempo_principal_min` numeric null
- `tiempo_bebida_min` numeric null
- `tiempo_postre_min` numeric null
- `tiempo_entrante_ok` boolean
- `tiempo_principal_ok` boolean
- `tiempo_bebida_ok` boolean
- `tiempo_postre_ok` boolean

**au_auditoria_local** — checklist de Infraestructura (booleans ✅/❌)
- `id` uuid PK
- `auditoria_id` uuid FK
- `cart_actualizada` boolean
- `cart_completa` boolean
- `limp_sala` boolean
- `limp_banos` boolean
- `limp_barras` boolean

**au_observaciones** — oportunidades de mejora con severidad (aplican descuento al área)
- `id` uuid PK
- `auditoria_id` uuid FK
- `area` text CHECK in ('PRODUCTO','SERVICIO','LOCAL')
- `texto` text
- `severidad` text CHECK in ('NINGUNA','LEVE','MEDIA','GRAVE')

**au_config_severidad** — pesos editables de descuento por severidad
- `severidad` text PK
- `descuento` numeric
- Seed: NINGUNA=0, LEVE=0.25, MEDIA=0.50, GRAVE=1.00

**au_visitas** — calendario de visitas planificadas
- `id` uuid PK
- `local_id` text FK -> au_locales.id
- `auditor_cut` text
- `fecha` date
- `hora` time
- `estado` text CHECK in ('PROGRAMADA','REALIZADA','CANCELADA') default 'PROGRAMADA'
- `notas` text null

---

## 2. LÓGICA DE CÁLCULO DE NOTAS (implementar en util `src/lib/calculo.ts`)

Nota total sobre **20**. Cada área vale **20/3 ≈ 6.6667** puntos.

### Producto (área = 6.6667)
- nota_base = (ingredientes en ✅ / total ingredientes evaluados) * 6.6667
- Si no se evaluó ningún plato, nota_base de Producto = 6.6667 (no penalizar por no auditar) — pero deja un comentario `// TODO confirmar con Santi` por si prefiere null/0.
- Luego aplicar descuento de observaciones del área PRODUCTO.

### Servicio (área = 6.6667)
Ítems booleanos que cuentan (todos pesan igual, reparto aritmético):
fid_speech, fid_nombre_camarero, ups_bebidas, ups_meta_dia, pres_uniformes, pres_cabellos, pres_unas, pres_zapatos, pres_barba_o_maquillaje, tiempo_entrante_ok, tiempo_principal_ok, tiempo_bebida_ok, tiempo_postre_ok = **13 ítems**.
- nota_base = (ítems en true / 13) * 6.6667
- Luego descuento de observaciones área SERVICIO.

### Local (área = 6.6667)
Ítems booleanos: cart_actualizada, cart_completa, limp_sala, limp_banos, limp_barras = **5 ítems**.
- nota_base = (ítems en true / 5) * 6.6667
- Luego descuento de observaciones área LOCAL.

### Descuento por observaciones
Para cada área: descuento_total = suma de `descuento` (según severidad, leído de au_config_severidad) de todas las observaciones de esa área.
- nota_area = max(0, nota_base - descuento_total)  // piso en 0, nunca negativo

### Nota total
nota_total = nota_producto + nota_servicio + nota_local (máx 20, redondear a 2 decimales).

Los rangos objetivo de tiempos los define el auditor en el formulario; el booleano `_ok` se calcula en el frontend comparando el tiempo digitado contra el rango que el auditor ingresa (min/max en minutos por cada uno).

---

## 3. VISTAS / FUNCIONALIDADES

### Login (común)
- Input de CUT. Busca en au_usuarios. Según rol redirige:
  - AUDITOR -> Vista Auditor
  - DIRECTOR -> Vista Director
  - ADMIN -> Vista Director pero con TODOS los locales
- Guardar sesión en localStorage (8h).

### Vista Auditor — dos pestañas: "Tracking" y "Calendario"

**Tracking (nueva auditoría):**
1. Selecciona local (mostrar agrupado por carpeta: Rikos > [locales], Cholito > [locales], y los individuales sueltos).
2. Sección **PRODUCTO**: elegir uno o varios platos disponibles para ese local (filtrar por au_plato_locales). Por cada plato, listar sus ingredientes con toggle ✅/❌. Más sub-sección "Oportunidades de mejora" (lista dinámica: texto + selector severidad).
3. Sección **SERVICIO**: campo nombre del mesero. Checklist booleano de Fidelización, Upselling, Presentación. Tiempos: por cada uno (entrante/principal/bebida/postre) inputs de tiempo real + rango objetivo (min-max) que define el auditor; el ✅/❌ se calcula solo. Oportunidades de mejora (texto + severidad).
4. Sección **LOCAL**: checklist booleano de Cartelería y Limpieza. Oportunidades de mejora (texto + severidad).
5. Panel lateral en vivo que muestra:
   ```
   Nota Producto: XX.XX
   Nota Servicio: XX.XX
   Nota Local:    XX.XX
   ------------------
   Nota total:    XX.XX
   ```
6. Botón Guardar -> inserta cabecera + detalles (patrón draft + commit; no autoguardado).

**Calendario:**
- Vista mensual tipo calendario. El auditor crea visitas: día, hora, local. Estado PROGRAMADA/REALIZADA/CANCELADA. CRUD sobre au_visitas.

### Configuración (dentro de Vista Auditor o ADMIN)
- **Gestión de Platos**: crear plato (nombre, código opcional), agregar/editar ingredientes, y asignar a qué locales pertenece (multi-select). Editar pesos de severidad (au_config_severidad).

### Vista Director
- Director ingresa con su CUT. Ve SOLO los locales que tiene asignados en au_director_locales.
- ADMIN ve todos.
- Para cada local: historial de auditorías con nota_producto/servicio/local/total, fecha, y al expandir, las observaciones (texto + severidad) y el detalle. Solo lectura.
- Tarjetas con semáforo de color según nota_total (usa los mismos cortes que mi sistema de ventas: >=100% verde... pero aquí es sobre 20, así que: >=16 verde, 12-15.99 ámbar, <12 rojo. Deja TODO para que Santi ajuste cortes).

---

## 4. SEED DE DATOS (inclúyelo al final de supabase_schema.sql como INSERTs)

### au_marcas
- ('rikos','Rikos',true)
- ('cholito','Cholito',true)
- ('carmela','Carmela',false)
- ('ceviche103','Ceviche 103',false)
- ('cholochang','Chifa Cholo Chang',false)
- ('laturuleca','La Turuleca',false)
- ('nikkei103','Nikkei 103',false)

### au_locales (id, nombre, marca_id, direccion, encargado_nombre, encargado_cut, jefe_cocina_nombre, jefe_cocina_cut)
Nombres normalizados. CUTs de encargado/jefe cruzados POR NOMBRE con las listas oficiales:

- loc_carmela | Carmela | carmela | Carrer de Sant Pere Més Alt, 4, Ciutat Vella, 08003 | Henrry Lizandro Fernandez Olortegui (Interino) | A00056 (ojo: en tabla figura como jefe de cocina; el encargado interino es Henry Fernández -> A00056) | Cristian Salas | (sin CUT en lista, dejar null)
  -> NOTA: "Henry Fernández (Interino)" como ENCARGADO cruza con A00056 (Henrry Fernandez). "Cristian Salas" como jefe de cocina NO está en la lista de CUTs -> null.
- loc_ceviche103 | Ceviche 103 | ceviche103 | Carrer de Londres, 103, Eixample, 08036 Barcelona | Christian Chumbes | A00025 | Christian Bulnes | A00006
- loc_cholochang | Chifa Cholo Chang | cholochang | Carrer de Sants, 32, Sants-Montjuïc, 08014 Barcelona | Víctor Ramírez | A00099 | Alonso Castellanos | null
- loc_laturuleca | La Turuleca | laturuleca | Carrer d'Arizala, 5, 08028 Barcelona | Alexander Gutti | A00008 | Carlos Reyes | (Carlos Reyes ambiguo: A00062 Carlos Gustavo Reyes Cervantes -> usar A00062)
- loc_nikkei | Nikkei 103 | nikkei103 | Carrer d'Aribau, 33, Eixample, 08011 Barcelona | Iman Gasal | A00023 | Jesús Oshiro | A00200
- loc_cholito_hospitalet | Cholito Hospitalet | cholito | Carrer Progrés, 124, 08904 L'Hospitalet de Llobregat, Barcelona | Elva Arias | A00166 | null | null
- loc_cholito_sagrera | Cholito Sagrera | cholito | Carrer de Felip II, 134, Sant Andreu, 08027 Barcelona | Edith Cruzatt | A00087 | null | null
- loc_cholito_sagrada | Cholito Sagrada | cholito | Carrer de Cartagena, 285, Eixample, 08025 Barcelona | Michael Mayorga | A00069 | null | null
- loc_cholito_poblesec | Cholito Poble Sec | cholito | Avinguda del Paral·lel, 150 Local 2, Eixample, 08015 Barcelona | Giovanna Arce | A00021 | null | null
- loc_rikos_badal | Rikos Badal | rikos | Carrer de Sugranyes, 6, Sants-Montjuïc, 08028 Barcelona | Eddu Barrientos | A00002 | Jose Luis Ccohaquira | A00037
- loc_rikos_lluria | Rikos Lluria | rikos | Carrer de Roger de Llúria, 54, Eixample, 08009 Barcelona | Anderson Llempen | A00028 | Pablo Noé | null
- loc_rikos_santacoloma | Rikos Santa Coloma | rikos | Avinguda de Santa Coloma, 5, 08922 Santa Coloma de Gramenet, Barcelona | Ingrid Muguerza | A00075 | Roberto Pérez | A00003
- loc_rikos_canvidalet | Rikos Can Vidalet | rikos | Carrer Hierbabuena, 41, 43, 08906 L'Hospitalet de Llobregat, Barcelona | Ana Sissa Arco Huaman | A00017 | Jaime Torres | A00149
- loc_rikos_cornella | Rikos Cornella | rikos | Carrer del Bruc, 7, 08940 Cornellà de Llobregat, Barcelona | Luis Pinchi | A00051 (Luis Antonio Cardenas Pinchi) | Juan Chanta | A00053
- loc_rikos_glories | Rikos Glories | rikos | Carrer de Sant Joan de Malta, 119, Sant Martí, 08018 Barcelona | Jordi Villaverde | A00116 | Robert Díaz | null
- loc_rikos_icaria | Rikos Icaria | rikos | Avinguda d'Icària, 132, local 2, Sant Martí, 08005 Barcelona | Xiomara Cárdenas | A00150 | Luis Santamaría | A00125
- loc_rikos_meridiana | Rikos Meridiana | rikos | Avinguda Meridiana, 211, Sant Andreu, 08027 Barcelona | Simón León | A00014 | Jhonny Sudario | A00036
- loc_rikos_poblesec | Rikos Poble Sec | rikos | Avinguda del Paral·lel, 150 Local 1, Eixample, 08015 Barcelona | Jesús Arco | A00177 (Jesus Valentin Arco Huaman) | Jaffet Cárdenas | A00067
- loc_rikos_4caminos | Rikos 4 Caminos | rikos | Carrer de Ávila, 17, Tetuán, 28020 Madrid | Roberto Arco | A00005 (Roberto Junior Arco Huaman) | Richar Pujay | A00109

### au_usuarios
Auditor (inventado): ('A00300','Auditor de Calidad','AUDITOR',true)
Directores:
- ('A00019','Vladimir Calanche','DIRECTOR',true)
- ('A00021','Giovanna Arce','DIRECTOR',true)
- ('A00004','Alex Luna','DIRECTOR',true)
Admin (ven todo):
- ('A99001','Thalía Rubio','ADMIN',true)
- ('A99002','Santiago Cornelio','ADMIN',true)
- ('A00128','Milagros Mejia','ADMIN',true)
- ('A00024','Karol Trujillo','ADMIN',true)
- ('A00038','Gianina Espinoza','ADMIN',true)
- ('A00076','Luzmila Chang','ADMIN',true)

### au_director_locales
- A00019 (Vladimir): rikos_badal, rikos_lluria, rikos_santacoloma, ceviche103, laturuleca, rikos_canvidalet, rikos_cornella, rikos_meridiana
- A00021 (Giovanna): cholito_hospitalet, cholito_sagrera, cholito_sagrada, cholito_poblesec
- A00004 (Alex Luna): carmela, nikkei, cholochang, rikos_poblesec, rikos_4caminos, rikos_glories, rikos_icaria

### au_config_severidad
NINGUNA=0, LEVE=0.25, MEDIA=0.50, GRAVE=1.00

(au_platos / au_plato_ingredientes / au_plato_locales se dejan vacíos: Santi los carga desde la config.)

---

## 5. DISEÑO / UI

- Paleta Grupo Ceviche: #EE5128 (naranja), #D5372A (terranova), #121621 (navy), #FEF5E4 (crema), #FF9445 (ámbar), #4E1015 (marrón).
- Fuentes: Poppins / Inter. Iconos SVG (no emojis). Estética SaaS profesional.
- Semáforo de notas con sus propios colores (verde/ámbar/rojo), independiente de la paleta de marca.
- Sidebar colapsable (mismo patrón que mis otros sistemas).

---

## 6. ENTREGABLES Y FORMA DE TRABAJO

1. Primero muéstrame la estructura de carpetas propuesta y el `supabase_schema.sql` completo. ESPERA mi confirmación antes de seguir.
2. Luego el scaffold (Vite + deps + supabase client + store Zustand + router).
3. Luego Login, luego Vista Auditor (Tracking), luego Calendario, luego Config Platos, luego Vista Director.
4. Trabaja en bloques. Pídeme confirmación entre cada bloque grande. Entrega código completo de cada archivo (no parches parciales).
5. NO toques tablas que no sean `au_*`. Recuérdamelo si detectas riesgo.

Cuando termines un bloque, dame un mini-reporte de qué hiciste y qué falta.
