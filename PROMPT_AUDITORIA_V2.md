# PROMPT CLAUDE CODE — Auditoría Grupo Ceviche · ACTUALIZACIÓN V2

## CONTEXTO

Este es un proyecto YA EXISTENTE y EN PRODUCCIÓN (desplegado en Vercel). NO es un proyecto nuevo. Vas a aplicar una serie de cambios sobre el código actual. Stack: React + TypeScript + Vite + Tailwind + Zustand + Supabase. Backend en Supabase COMPARTIDO con otros sistemas.

**REGLA DE ORO INNEGOCIABLE:** Todas las tablas, buckets, políticas y objetos de Supabase que crees o toques DEBEN llevar prefijo `au_`. PROHIBIDO leer, modificar o referenciar tablas `vc_*` o del sistema de pagos. Si dudas si algo es tuyo, NO lo toques.

**Toda la lógica de cálculo de notas vive EXCLUSIVAMENTE en `src/lib/calculo.ts`.** Cualquier cambio al cálculo se hace ahí, nunca duplicado en componentes.

## FORMA DE TRABAJO (CRÍTICO)

Hubo cortes de conexión en sesiones anteriores con respuestas largas. Por eso:
- Trabaja en TANDAS. Completa una tanda, da un mini-reporte, y ESPERA mi confirmación antes de la siguiente.
- Dentro de cada tanda, escribe UN archivo por vez cuando el archivo sea grande (>150 líneas).
- Antes de modificar un archivo existente, LÉELO primero. No reescribas a ciegas.
- Cuando generes SQL para Supabase, ponlo en un archivo `migracion_v2.sql` y NO lo ejecutes tú: yo lo corro manualmente en el SQL Editor.

---

## TANDA A — Cambios en el formulario de auditoría (bajo riesgo)

### A1. Renombrar conceptos (INVERSIÓN DE NOMBRES — leer con cuidado)

Actualmente el sistema tiene "Observaciones" con severidad que restan puntos, etiquetadas en la UI como "Oportunidades de mejora". Hay que INVERTIR la terminología visible:

- Lo que HOY se llama "Oportunidades de mejora" en la UI (los ítems con severidad que restan puntos) pasa a llamarse **"Observaciones"** en todos los textos visibles.
- Se AGREGA un concepto NUEVO de texto libre llamado **"Oportunidades de mejora"** que NO resta puntos (ver A2).

Resultado final de la terminología:
- **Observaciones** = ítems con severidad (NINGUNA/LEVE/MEDIA/GRAVE) que SÍ restan puntos del área. (Es el `au_observaciones` actual, sin cambios en su lógica de cálculo.)
- **Oportunidades de mejora** = texto libre, informativo, NO afecta la nota.

Cambia todos los textos visibles (labels, títulos, placeholders, botones) en TrackingPage, SeccionProducto, SeccionServicio, SeccionLocal, ObservacionesEditor, PanelNotas, DirectorPage, y donde aparezca. NO cambies nombres de tablas ni columnas de BD (eso rompería datos existentes); solo el texto de cara al usuario.

### A2. Campo "Oportunidades de mejora" (texto libre, no puntúa)

Agregar un campo de texto libre (textarea) llamado "Oportunidades de mejora" en cada una de las 3 áreas: Producto, Servicio y Local. Es informativo, no afecta el cálculo.

SQL (en migracion_v2.sql): agregar a `au_auditorias` tres columnas:
```sql
ALTER TABLE au_auditorias ADD COLUMN IF NOT EXISTS oportunidad_producto text;
ALTER TABLE au_auditorias ADD COLUMN IF NOT EXISTS oportunidad_servicio text;
ALTER TABLE au_auditorias ADD COLUMN IF NOT EXISTS oportunidad_local    text;
```
Guardar/leer estos campos en el flujo de guardado y en la vista detalle.

### A3. Tres casillas por ingrediente en Producto

Hoy cada ingrediente del plato tiene UN booleano `cumple`. Cambiar a TRES casillas independientes por ingrediente:
- **Contiene el elemento** (`contiene`)
- **Limpieza del elemento** (`limpieza`)
- **Peso adecuado** (`peso_adecuado`)

Cada casilla es un ítem INDEPENDIENTE que cuenta al denominador de Producto. Es decir: un plato con 5 ingredientes aporta 15 checks (5 × 3) al cálculo de Producto.

Actualizar el cálculo en `src/lib/calculo.ts`: Producto = (suma de casillas en true / total de casillas evaluadas) × (20/3), luego descuento de observaciones de severidad (sin cambios en esa parte). Si no se auditó ningún plato, Producto sigue dando 20/3 (6.67) — MANTENER comportamiento actual.

SQL (en migracion_v2.sql): en `au_auditoria_producto_items`, reemplazar la columna `cumple` por las tres nuevas:
```sql
ALTER TABLE au_auditoria_producto_items ADD COLUMN IF NOT EXISTS contiene      boolean;
ALTER TABLE au_auditoria_producto_items ADD COLUMN IF NOT EXISTS limpieza      boolean;
ALTER TABLE au_auditoria_producto_items ADD COLUMN IF NOT EXISTS peso_adecuado boolean;
-- la columna 'cumple' se deja por compatibilidad con auditorías viejas; no se usa en nuevas
```
Actualizar UI de SeccionProducto: cada ingrediente muestra 3 toggles claramente etiquetados.

### A4. Tiempos: quitar "objetivo mínimo" del formulario

En SeccionServicio, quitar el input de "objetivo mínimo" de cada tiempo (entrante/principal/bebida/postre). Dejar SOLO el tiempo real digitado por el auditor. El "objetivo máximo" ya no se ingresa en el formulario: viene de Configuración (ver Tanda B). El cálculo de `_ok` pasa a ser: tiempo_real <= objetivo_maximo_configurado.

---

## TANDA B — Configuración de tiempos máximos (global + override por local)

Mover el objetivo máximo de cada tiempo a Configuración, con modelo jerárquico:
- Un valor GLOBAL por defecto por cada tipo de tiempo (entrante, principal, bebida, postre).
- Opción de OVERRIDE por local (si un local específico tiene otro máximo).
- Al calcular `_ok` en una auditoría: usar el override del local si existe; si no, el global.

SQL (en migracion_v2.sql):
```sql
CREATE TABLE IF NOT EXISTS au_config_tiempos (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id  text REFERENCES au_locales(id),  -- NULL = valor global por defecto
  tipo      text NOT NULL CHECK (tipo IN ('ENTRANTE','PRINCIPAL','BEBIDA','POSTRE')),
  max_min   numeric NOT NULL,                 -- objetivo máximo en minutos
  UNIQUE (local_id, tipo)
);
-- RLS permisivo anon, igual que el resto
ALTER TABLE au_config_tiempos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON au_config_tiempos FOR ALL TO anon USING (true) WITH CHECK (true);
-- Seed de valores globales por defecto (ajustables luego en UI). local_id NULL = global.
INSERT INTO au_config_tiempos (local_id, tipo, max_min) VALUES
  (NULL,'ENTRANTE',10),(NULL,'PRINCIPAL',20),(NULL,'BEBIDA',5),(NULL,'POSTRE',10)
ON CONFLICT (local_id, tipo) DO NOTHING;
```
En ConfiguracionPage agregar una sección "Tiempos objetivo": editar los 4 globales, y opcionalmente agregar overrides por local. El cálculo en calculo.ts y SeccionServicio debe leer de esta tabla.

---

## TANDA C — Fotos/evidencias, historial editable, vista detalle completa

### C1. Carga de fotos por área (Supabase Storage)

En el formulario, cada área (Producto, Servicio, Local) tiene un campo para subir una o varias fotos/evidencias.

Implementación:
- Crear un bucket de Storage llamado `au-evidencias` (PÚBLICO).
- Antes de subir, COMPRIMIR/redimensionar la imagen en el navegador a máx ~1280px de ancho y calidad ~0.7 (apunta a <500KB por foto). Usa canvas o una lib ligera; no agregues dependencias pesadas.
- Nombre de archivo: UUID aleatorio + extensión. Nunca el nombre original.
- En BD guardar solo la URL pública + a qué auditoría y área pertenece.

SQL (en migracion_v2.sql):
```sql
CREATE TABLE IF NOT EXISTS au_evidencias (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auditoria_id uuid NOT NULL REFERENCES au_auditorias(id) ON DELETE CASCADE,
  area         text NOT NULL CHECK (area IN ('PRODUCTO','SERVICIO','LOCAL')),
  url          text NOT NULL,
  creado_en    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE au_evidencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON au_evidencias FOR ALL TO anon USING (true) WITH CHECK (true);
```
NOTA SOBRE EL BUCKET: dame en el mini-reporte las instrucciones EXACTAS para crear el bucket `au-evidencias` como público desde el dashboard de Supabase (yo lo creo a mano), y la policy de Storage necesaria para permitir subida con la anon key. No asumas que existe.

En la UI: mostrar miniaturas de las fotos subidas, con opción de ampliar (modal/lightbox) y de eliminar antes de guardar.

### C2. Historial editable para el auditor

El auditor (Vista Auditor) necesita una pestaña/sección nueva "Mis auditorías" donde:
- Vea la lista de auditorías que ÉL realizó (filtrar por `auditor_cut` = su CUT), con fecha, local y nota total.
- Pueda ABRIR una auditoría y EDITARLA (cargar todos sus datos en el formulario, modificar, y volver a guardar actualizando la misma fila, no creando una nueva).
- Use `.range(0, 9999)` y filtros para evitar el límite de 1000 filas de PostgREST.

Para soportar edición limpia, considera el patrón draft+commit ya usado en el proyecto. Al editar, cargar la auditoría completa (cabecera + items producto + servicio + local + observaciones + oportunidades + evidencias) al store, y al guardar hacer UPDATE de la cabecera + reemplazo (delete+insert) de las tablas hijas.

### C3. Vista detalle completa en TODAS las vistas

Hoy Director/Admin ven la tabla de notas. Agregar que al expandir/abrir una auditoría se vea el DETALLE COMPLETO (solo lectura para director/admin):
- Notas por área y total.
- Detalle de Producto: platos auditados con sus ingredientes y las 3 casillas.
- Detalle de Servicio: todos los checks + tiempos reales vs objetivo.
- Detalle de Local: todos los checks.
- Observaciones (con severidad) y Oportunidades de mejora (texto) por área.
- Evidencias (fotos) por área, con opción de ampliar.

---

## TANDA D — Gestión de platos: carga CSV, filtrado por local, buscador

### D1. Selector de platos filtrado por local + buscador (en el formulario de auditoría)

En SeccionProducto: una vez elegido el local de la auditoría, el selector de platos debe mostrar SOLO los platos asignados a ESE local (vía `au_plato_locales`). Sobre esa lista filtrada, agregar un BUSCADOR por nombre o código que filtre en vivo. Así, de 1000 platos globales, el auditor ve solo los ~20-40 de su local y puede buscar dentro.

### D2. Carga masiva de platos por CSV (en Configuración → Gestión de Platos)

Agregar botón "Importar platos (CSV)" en GestionPlatos.

Formato del CSV (encabezados exactos):
```
LOCAL,NOMBRE_PLATO,CODIGO,INGREDIENTE
```
- Las 3 primeras columnas se repiten por cada ingrediente del plato. El ORDEN de las filas define el orden de los ingredientes (primera fila del plato = ingrediente 1).
- Columna LOCAL acepta DOS modalidades:
  - Nombre exacto de un local (ej. `Rikos Meridiana`) → asigna a ese local.
  - Una marca-carpeta: `RIKOS` o `CHOLITO` (case-insensitive) → expande a TODOS los locales de esa marca.
- El parser debe detectar separador (coma estándar; pero contempla que vengan CSVs con `;` de sistemas españoles — detecta dinámicamente) y manejar bien acentos (UTF-8).

Comportamiento del importador:
- Agrupar filas por (LOCAL resuelto + NOMBRE_PLATO).
- Si el plato YA EXISTE para ese local: REEMPLAZAR sus ingredientes (delete + insert de `au_plato_ingredientes`), manteniendo el plato. No duplicar.
- Si el LOCAL no existe (nombre mal escrito y no es RIKOS/CHOLITO): NO fallar en silencio. Acumular esos errores y mostrarlos al final en un reporte ("Fila 12: local 'Rikos Meridian' no encontrado").
- Al terminar, mostrar resumen: X platos creados, Y actualizados, Z filas con error (con detalle).

Provee también un CSV de ejemplo descargable con el formato correcto (2-3 platos de muestra) para que el usuario sepa cómo armarlo.

---

## TANDA E — Exportar calendario (.ics)

En la sección Calendario de la Vista Auditor, agregar botón "Exportar calendario". Genera y descarga un archivo `.ics` (iCalendar estándar, compatible con Google Calendar y Microsoft/Outlook) con las visitas del auditor.
- Permitir delimitar qué visitas exportar (ej. un rango de fechas, o todas las futuras). Implementa un selector simple de rango; por defecto, todas las visitas programadas del auditor de hoy en adelante.
- Cada visita = un VEVENT con: fecha, hora, local (nombre + dirección en la ubicación), y estado en la descripción.
- Generar el .ics en cliente (sin librerías pesadas) y disparar la descarga.

---

## ORDEN DE EJECUCIÓN

1. Primero genera `migracion_v2.sql` COMPLETO (todos los ALTER/CREATE de todas las tandas juntos) y muéstramelo. Lo reviso y lo corro yo en Supabase. ESPERA mi confirmación.
2. Luego ejecuta Tanda A. Mini-reporte. Espera confirmación.
3. Tanda B. Mini-reporte. Espera.
4. Tanda C (la más grande — ve archivo por archivo). Incluye las instrucciones del bucket de Storage. Espera.
5. Tanda D. Espera.
6. Tanda E. Espera.
7. Al final: confirma que `npm run build` pase limpio (corre tsc), porque el deploy en Vercel usa `tsc && vite build` y es estricto con tipos no usados y similares.

Recuerda: prefijo `au_` siempre, cálculo solo en calculo.ts, `.range(0,9999)` en tablas que crecen, y nunca tocar tablas ajenas.
