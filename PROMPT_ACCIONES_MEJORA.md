# PROMPT CLAUDE CODE — Nueva vista "Acciones de mejora"

## CONTEXTO

Proyecto EN PRODUCCIÓN (auditorías Grupo Ceviche). React + TS + Vite + Tailwind + Zustand + Supabase compartido. REGLA DE ORO: prefijo `au_`, nunca tocar `vc_` ni pagos. Cálculo SOLO en calculo.ts (ESTA FUNCIÓN NO TOCA EL CÁLCULO). `.range(0,9999)` en tablas que crecen. Build usa `tsc && vite build` (estricto). NO hagas push; yo pruebo y subo.

Trabaja en bloques, mini-reporte y build limpio por bloque, PARA entre cada uno.

## OBJETIVO

Nueva pestaña "Acciones de mejora" para dar seguimiento a las observaciones registradas en las auditorías. El auditor escribe una acción correctiva por observación, le pone una fecha de evaluación, y marca cuando está resuelta. Directores y admin solo visualizan.

## MODELO

- Se listan TODAS las observaciones que restan puntos (tabla `au_observaciones`), de TODAS las áreas: PRODUCTO, SERVICIO, LOCAL, y los 3 aspectos de Revisión Interna (RI_REVISION, RI_ROTULACION, RI_HIGIENE).
- NO se incluyen los "Comentarios" (los campos de texto libre que no restan puntos).
- Por cada observación, campos EDITABLES por el auditor: acción de mejora (texto), fecha de evaluación (date), y casilla "Resuelto" (boolean).
- Una observación puede no tener acción todavía: se muestra igual, con los campos vacíos listos para llenar.

## PERMISOS

- **AUDITOR**: ve todas las observaciones (de cualquier local, de cualquier auditoría, sean suyas o no) y puede EDITAR la acción, la fecha y el check de Resuelto.
- **DIRECTOR**: SOLO LECTURA. Ve únicamente las observaciones de los locales que tiene asignados en `au_director_locales`.
- **ADMIN**: SOLO LECTURA. Ve todas.

---

## BLOQUE 1 — Migración (genera `migracion_v7.sql`, NO la ejecutes, la reviso yo)

```sql
-- Acciones de mejora: una por observación (relación 1 a 1, opcional).
CREATE TABLE IF NOT EXISTS au_acciones_mejora (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  observacion_id uuid NOT NULL UNIQUE REFERENCES au_observaciones(id) ON DELETE CASCADE,
  accion         text,
  fecha_evaluacion date,
  resuelto       boolean NOT NULL DEFAULT false,
  actualizado_en timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE au_acciones_mejora ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON au_acciones_mejora FOR ALL TO anon USING (true) WITH CHECK (true);
```

Es puramente aditiva (tabla nueva, no toca nada existente). El `ON DELETE CASCADE` hace que si se borra una observación (p.ej. al borrar su auditoría), su acción se borre con ella. El `UNIQUE` en observacion_id garantiza una acción por observación.

Muéstrame el archivo y PARA.

---

## BLOQUE 2 — Página "Acciones de mejora"

Componente nuevo `AccionesMejoraPage.tsx`.

### Carga de datos
Traer con `.range(0,9999)`:
- `au_observaciones` (todas), y por cada una, su auditoría asociada (`au_auditorias`) para obtener fecha y local_id.
- `au_locales` para el nombre del local.
- `au_acciones_mejora` para las acciones ya registradas (hacer el match por observacion_id; las que no tengan, mostrar campos vacíos).
- Si el rol es DIRECTOR: filtrar por los locales de `au_director_locales` para su CUT.

Carga eficiente: trae todo en pocas queries y cruza en memoria (evita N+1).

### Tabla (columnas, en este orden)
| Fecha auditoría | Local | Área | Observación (texto) | Severidad | Acción de mejora | Fecha evaluación | Resuelto |

- Las 5 primeras columnas son AUTOMÁTICAS (de la auditoría), solo lectura para todos.
- "Área": mostrar el nombre legible (Producto / Servicio / Local / Revisión de productos / Rotulación de productos / Higiene de cocina).
- "Severidad": badge de color con el nombre en español (Ninguna / Leve / Media / Grave / Extremadamente grave). Si es EXTREMA, indicar también el modo si aplica.
- "Acción de mejora": input de texto. Editable SOLO si rol = AUDITOR; si no, texto plano.
- "Fecha evaluación": date picker. Editable SOLO si rol = AUDITOR.
- "Resuelto": checkbox. Marcable SOLO si rol = AUDITOR; para director/admin es un indicador visual (✓ / vacío).

### Filtros (arriba de la tabla)
1. **Local**: dropdown con "Todos los locales" + la lista de locales (para director, solo los suyos). Filtra la tabla.
2. **Estado**: "Todas" (default) / "Pendientes" (resuelto=false) / "Resueltas" (resuelto=true).

### Guardado
- Al editar la acción, la fecha o el check de Resuelto: hacer UPSERT en `au_acciones_mejora` por `observacion_id` (crea la fila si no existe, actualiza si existe). Actualizar `actualizado_en`.
- Guardado autónomo por fila (al salir del campo / al cambiar el check), con indicador sutil de guardado. NO un botón global de "guardar todo".
- Manejar errores con un mensaje claro, sin romper la página.

Mini-reporte. Build limpio. PARA.

---

## BLOQUE 3 — Integrar la pestaña en la navegación

- **Vista Auditor** (AuditorPage): agregar la pestaña "Acciones de mejora" junto a Nueva auditoría / Mis auditorías / Calendario / Configuración. Ícono coherente con el resto (SVG, no emoji).
- **Vista Director** (DirectorPage): agregar la pestaña "Acciones de mejora" en modo solo lectura, junto a Historial.
- Respetar los permisos descritos arriba según el rol del usuario logueado.

Mini-reporte. Build limpio.

---

Recuerda: no tocar el cálculo, prefijo au_, `.range(0,9999)`, parar entre bloques, no push.
