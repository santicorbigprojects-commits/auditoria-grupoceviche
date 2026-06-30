# PROMPT CLAUDE CODE — Combos / Platos en conjunto

## CONTEXTO

Proyecto existente en producción (sistema de auditorías Grupo Ceviche). React + TS + Vite + Tailwind + Zustand + Supabase compartido. REGLA DE ORO: todo con prefijo `au_`, nunca tocar `vc_` ni pagos. Cálculo SOLO en calculo.ts. `.range(0,9999)` en tablas que crecen. Build usa `tsc && vite build` (estricto).

## QUÉ ES UN COMBO

Un "combo" (o plato en conjunto) es un plato contenedor con varios SLOTS. Ejemplo: "Menú del día" con slot "Entrante" + slot "Principal". Otro: "Combo Familiar" con "Principal 1" + "Principal 2" + "Bebida".

- Un combo tiene N slots (número VARIABLE, definido al crear el combo).
- Cada slot tiene un nombre (ej. "Entrante") y una lista de PLATOS YA EXISTENTES (de au_platos) como opciones.
- Al auditar un combo, el auditor elige UN plato por cada slot (el que se sirvió en la mesa).
- Los combos se asignan a locales, igual que los platos (un combo puede estar en varios locales).

## FORMA DE TRABAJO

Sub-bloques, parando entre cada uno para que yo confirme:
- BLOQUE 1: migración SQL (genera migracion_v5.sql, NO la ejecutes, la reviso y corro yo). PARA.
- BLOQUE 2: gestión de combos (pestaña nueva en Configuración).
- BLOQUE 3: selección de combo en el formulario de auditoría.
- BLOQUE 4: cálculo de nota + guardado.
- BLOQUE 5: vista detalle (director + edición).
Lee cada archivo antes de modificarlo. Mini-reporte por bloque. Build limpio al final de cada uno.

---

## BLOQUE 1 — Migración (migracion_v5.sql)

```sql
-- Combos
CREATE TABLE IF NOT EXISTS au_combos (
  id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  codigo text,
  activo boolean NOT NULL DEFAULT true
);

-- Slots de cada combo (ej. "Entrante", "Principal")
CREATE TABLE IF NOT EXISTS au_combo_slots (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  combo_id uuid NOT NULL REFERENCES au_combos(id) ON DELETE CASCADE,
  nombre   text NOT NULL,
  orden    integer NOT NULL DEFAULT 0
);

-- Opciones de cada slot (platos existentes que se pueden escoger en ese slot)
CREATE TABLE IF NOT EXISTS au_combo_slot_opciones (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id  uuid NOT NULL REFERENCES au_combo_slots(id) ON DELETE CASCADE,
  plato_id uuid NOT NULL REFERENCES au_platos(id) ON DELETE CASCADE
);

-- Asignación de combos a locales (igual que au_plato_locales)
CREATE TABLE IF NOT EXISTS au_combo_locales (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  combo_id uuid NOT NULL REFERENCES au_combos(id) ON DELETE CASCADE,
  local_id text NOT NULL REFERENCES au_locales(id)
);

-- En el detalle de producto de la auditoría, marcar de qué combo/slot viene cada ingrediente.
-- Aditivo y nullable: ítems de platos sueltos dejan estas columnas en NULL.
ALTER TABLE au_auditoria_producto_items ADD COLUMN IF NOT EXISTS combo_nombre text;
ALTER TABLE au_auditoria_producto_items ADD COLUMN IF NOT EXISTS slot_nombre  text;

-- RLS permisivo anon en las 4 tablas nuevas
ALTER TABLE au_combos              ENABLE ROW LEVEL SECURITY;
ALTER TABLE au_combo_slots         ENABLE ROW LEVEL SECURITY;
ALTER TABLE au_combo_slot_opciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE au_combo_locales       ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON au_combos              FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON au_combo_slots         FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON au_combo_slot_opciones FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON au_combo_locales       FOR ALL TO anon USING (true) WITH CHECK (true);
```

Muéstrame el archivo y PARA.

---

## BLOQUE 2 — Gestión de combos (pestaña nueva en Configuración)

En ConfiguracionPage, agregar una pestaña "Combos" (separada de "Platos", "Tiempos", "Severidad").

Componente nuevo GestionCombos.tsx:
- Lista de combos existentes (con activo/inactivo, igual estilo que GestionPlatos).
- Crear/editar combo:
  - Nombre + código opcional.
  - Slots: poder AGREGAR/QUITAR slots (número variable). Cada slot tiene un nombre (ej. "Entrante") y un multi-select de platos existentes (de au_platos activos) como opciones de ese slot. Reordenar slots con flechas.
  - Asignación a locales: multi-select de locales, con toggle por marca (RIKOS/CHOLITO selecciona todos sus locales), igual que GestionPlatos.
  - Guardar: patrón delete+insert para slots, opciones y locales (no reconciliar IDs).
- Eliminar combo: igual criterio que platos — si el combo fue usado en auditorías, advertir; si no, borrar directo. (Para saber si se usó: buscar en au_auditoria_producto_items por combo_nombre. Como guardamos combo_nombre como snapshot, una heurística por nombre es aceptable; documsenta esta limitación en un comentario.)

Mini-reporte. PARA.

---

## BLOQUE 3 — Selección de combo en el formulario de auditoría

En SeccionProducto, el selector de Producto ahora muestra PLATOS y COMBOS juntos en una sola lista, con los combos distinguidos por una etiqueta/badge "COMBO" e ícono distinto. Ambos filtrados por el local elegido (platos vía au_plato_locales, combos vía au_combo_locales) y cubiertos por el buscador existente.

Al seleccionar un COMBO:
- Se despliega, por cada slot del combo, un selector para elegir UN plato de las opciones de ese slot.
- Una vez elegido el plato de un slot, se muestran sus ingredientes con la casilla "Contiene" (igual que un plato suelto), pero agrupados visualmente bajo un encabezado "{nombre del combo} · {nombre del slot}: {nombre del plato elegido}".
- El auditor califica los ingredientes de cada plato elegido.

El store (auditoriaStore) debe poder manejar ítems de producto que vienen de un combo: cada ItemProducto que provenga de un combo lleva además combo_nombre y slot_nombre (para snapshot y agrupación). Los de platos sueltos los dejan undefined/null.

Mini-reporte. PARA.

---

## BLOQUE 4 — Cálculo y guardado

- calculo.ts: NO cambia la fórmula. Los ingredientes de los platos elegidos en los slots de un combo se suman al MISMO pozo de Producto que los platos sueltos. Producto = (ingredientes con contiene=true / total ingredientes evaluados) * (20/3). Da igual si vienen de combo o de plato suelto; todos cuentan igual.
- Guardado (TrackingPage y modo edición de MisAuditoriasPage): al insertar en au_auditoria_producto_items, incluir combo_nombre y slot_nombre cuando el ítem venga de un combo (snapshot del nombre del combo y del slot); null cuando sea plato suelto. plato_nombre sigue siendo el nombre del plato concreto elegido.

Mini-reporte. PARA.

---

## BLOQUE 5 — Vista detalle (director + edición)

- DetalleAuditoria (director/admin): en la sección Producto, agrupar los ingredientes así:
  - Platos sueltos: como ahora, bajo el nombre del plato.
  - Ingredientes de combos: agrupados bajo "{combo_nombre} · {slot_nombre}: {plato_nombre}", para que se vea de qué combo y slot viene cada uno.
- Modo edición (MisAuditoriasPage): al recargar una auditoría que tenía combos, reconstruir la agrupación combo/slot desde combo_nombre/slot_nombre guardados, de modo que el auditor pueda editar igual que un plato.

Mini-reporte. Build limpio.

---

Recuerda: prefijo au_ siempre, cálculo solo en calculo.ts, no tocar tablas ajenas, y parar entre bloques.
