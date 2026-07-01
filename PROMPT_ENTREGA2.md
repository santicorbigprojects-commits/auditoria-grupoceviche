# PROMPT CLAUDE CODE — Entrega 2: Revisión Interna + Severidad "Extremadamente grave"

## CONTEXTO

Proyecto en producción (auditorías Grupo Ceviche). React + TS + Vite + Tailwind + Zustand + Supabase compartido. REGLA DE ORO: prefijo `au_`, nunca tocar `vc_` ni pagos. TODO el cálculo vive SOLO en calculo.ts. `.range(0,9999)` en tablas que crecen. Build usa `tsc && vite build` (estricto).

Esta entrega TOCA EL CÁLCULO (el corazón del sistema). Máxima cautela. Trabaja en BLOQUES, mini-reporte por bloque, PARA entre cada uno para que yo confirme. NO hagas push; yo pruebo y subo.

---

## MODELO COMPLETO (leer entero antes de codificar)

### Severidades (nuevo set de 5)
Ninguna, Leve, Media, Grave, Extremadamente grave.
- Ninguna/Leve/Media/Grave: restan un PESO FIJO configurable (como hoy; hoy son 0 / 0.25 / 0.50 / 1.00).
- Extremadamente grave: es DUAL. Tiene un peso fijo configurable (ej. 2.00). Al registrar una observación de este tipo EN LAS ÁREAS Producto/Servicio/Local, el auditor ELIGE entre dos modos:
  - modo "peso": resta el peso fijo configurado.
  - modo "porcentaje": reduce el área al 50% (ver orden de cálculo).
  - En el APARTADO 4 (Revisión Interna) NO hay elección: extremadamente grave usa siempre el peso fijo configurado.

### Áreas 1-3 (Producto, Servicio, Local) — orden de cálculo por área
1. Nota base por los checks (como hoy; NO cambiar esa parte).
2. Restar la suma de observaciones de peso fijo del área: Leve/Media/Grave, MÁS las Extremadamente grave que estén en modo "peso".
3. Si hay AL MENOS UNA observación Extremadamente grave en modo "porcentaje" en esa área → multiplicar el resultado por 0.5 (UNA sola vez, aunque haya varias; es un tope, no acumulable).
4. Piso en 0.
(El "doble castigo" — que un check en falso baje la nota y además una observación reste — se MANTIENE intencionalmente. No lo cambies.)

### Apartado 4 — Revisión Interna (NO suma, solo resta del total)
Tres aspectos: "Revisión de productos", "Rotulación de productos", "Higiene de cocina". Cada aspecto tiene:
- Una casilla "Conforme" (SOLO informativa/semáforo; NO afecta el puntaje).
- Observaciones con severidad (estas SÍ restan).
- Comentarios (texto libre, no resta).
- (Además el apartado 4 tiene su propia sección de Evidencias/fotos, ver Bloque 3.)

Descuento del apartado 4:
- Cada aspecto tiene un DESCUENTO MÁXIMO configurable (tope). Ej: Higiene puede restar hasta 3 puntos.
- Las observaciones de un aspecto restan según su severidad (peso fijo). Extremadamente grave en el apartado 4 = su peso fijo configurado.
- El descuento de un aspecto se TOPA a su máximo configurable (nunca resta más que el tope).
- descuento_revision_interna = suma de los descuentos (topados) de los 3 aspectos.

### Total
total = max(0, (nota_producto + nota_servicio + nota_local) - descuento_revision_interna)
(nota_producto/servicio/local ya incluyen sus propios descuentos y el posible 50%.)

---

## BLOQUE 1 — Migración (migracion_v6.sql, NO ejecutar, la reviso yo)

```sql
-- 1. Nueva severidad: agregar EXTREMA a la config. au_config_severidad ya existe (severidad PK, descuento numeric).
INSERT INTO au_config_severidad (severidad, descuento) VALUES ('EXTREMA', 2.00)
  ON CONFLICT (severidad) DO NOTHING;

-- 2. En au_observaciones: permitir la nueva severidad y el modo de extremadamente grave.
--    La columna severidad es text con CHECK. Hay que ampliar el CHECK para incluir 'EXTREMA'.
--    Como no se puede modificar un CHECK in-place fácilmente, dropear y recrear el constraint:
ALTER TABLE au_observaciones DROP CONSTRAINT IF EXISTS au_observaciones_severidad_check;
ALTER TABLE au_observaciones ADD CONSTRAINT au_observaciones_severidad_check
  CHECK (severidad IN ('NINGUNA','LEVE','MEDIA','GRAVE','EXTREMA'));
-- modo de la extremadamente grave: 'PESO' o 'PORCENTAJE' (nullable; solo aplica si severidad='EXTREMA')
ALTER TABLE au_observaciones ADD COLUMN IF NOT EXISTS extrema_modo text
  CHECK (extrema_modo IN ('PESO','PORCENTAJE'));

-- 3. Ampliar el CHECK de 'area' en au_observaciones para incluir el apartado 4 y sus 3 aspectos.
--    Hoy area IN ('PRODUCTO','SERVICIO','LOCAL'). Agregar los 3 aspectos de Revisión Interna:
ALTER TABLE au_observaciones DROP CONSTRAINT IF EXISTS au_observaciones_area_check;
ALTER TABLE au_observaciones ADD CONSTRAINT au_observaciones_area_check
  CHECK (area IN ('PRODUCTO','SERVICIO','LOCAL','RI_REVISION','RI_ROTULACION','RI_HIGIENE'));

-- 4. Revisión Interna: casilla conforme + comentarios por aspecto, en au_auditorias.
ALTER TABLE au_auditorias ADD COLUMN IF NOT EXISTS ri_revision_conforme  boolean;
ALTER TABLE au_auditorias ADD COLUMN IF NOT EXISTS ri_rotulacion_conforme boolean;
ALTER TABLE au_auditorias ADD COLUMN IF NOT EXISTS ri_higiene_conforme    boolean;
ALTER TABLE au_auditorias ADD COLUMN IF NOT EXISTS ri_revision_comentario  text;
ALTER TABLE au_auditorias ADD COLUMN IF NOT EXISTS ri_rotulacion_comentario text;
ALTER TABLE au_auditorias ADD COLUMN IF NOT EXISTS ri_higiene_comentario    text;
ALTER TABLE au_auditorias ADD COLUMN IF NOT EXISTS descuento_ri numeric(5,2);

-- 5. Config de descuento máximo por aspecto de Revisión Interna.
CREATE TABLE IF NOT EXISTS au_config_ri (
  aspecto     text PRIMARY KEY CHECK (aspecto IN ('RI_REVISION','RI_ROTULACION','RI_HIGIENE')),
  max_descuento numeric NOT NULL
);
ALTER TABLE au_config_ri ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON au_config_ri FOR ALL TO anon USING (true) WITH CHECK (true);
INSERT INTO au_config_ri (aspecto, max_descuento) VALUES
  ('RI_REVISION',2),('RI_ROTULACION',2),('RI_HIGIENE',3)
  ON CONFLICT (aspecto) DO NOTHING;

-- 6. au_evidencias.area ya permite PRODUCTO/SERVICIO/LOCAL. Ampliar para las etiquetas del apartado 4:
--    las fotos del apartado 4 usan area='REVISION_INTERNA' y la etiqueta (columna etiqueta ya existe) guarda
--    'Revisión' / 'Rotulación' / 'Higiene de cocina'.
ALTER TABLE au_evidencias DROP CONSTRAINT IF EXISTS au_evidencias_area_check;
ALTER TABLE au_evidencias ADD CONSTRAINT au_evidencias_area_check
  CHECK (area IN ('PRODUCTO','SERVICIO','LOCAL','REVISION_INTERNA'));
```

Muéstrame el archivo completo y PARA. IMPORTANTE: este SQL tiene DROP CONSTRAINT (no DROP TABLE). Es necesario para ampliar los CHECK. Adviérteme de cada DROP CONSTRAINT en tu reporte para que lo revise.

---

## BLOQUE 2 — calculo.ts (el núcleo; máxima cautela)

Actualizar calculo.ts para implementar el modelo completo de arriba:
- Ampliar el tipo Severidad a incluir 'EXTREMA'. ConfigSeveridad incluye EXTREMA.
- ObservacionCalculo ahora lleva: area, severidad, y extrema_modo ('PESO'|'PORCENTAJE'|null).
- Áreas 1-3: implementar el orden exacto (base → restar fijos incl. EXTREMA modo peso → si hay EXTREMA modo porcentaje multiplicar por 0.5 una vez → piso 0).
- Nueva función calcularDescuentoRevisionInterna(observacionesRI, configRI): por cada aspecto (RI_REVISION/RI_ROTULACION/RI_HIGIENE), sumar el peso de sus observaciones (EXTREMA usa su peso fijo), topar al max_descuento del aspecto; devolver la suma de los 3.
- calcularNotaTotal ahora recibe también el descuento_ri: total = max(0, producto+servicio+local - descuento_ri).
- NO cambiar la nota base de cada área ni el doble castigo.

Incluye comentarios claros en el código explicando el orden. Mini-reporte con la fórmula final escrita. Build limpio. PARA.

---

## BLOQUE 3 — Formulario: apartado 4 + severidad dual

- Nueva sección SeccionRevisionInterna.tsx con los 3 aspectos. Cada aspecto: casilla "Conforme" (informativa), editor de Observaciones (con severidad, incluyendo EXTREMA que en el apartado 4 NO muestra el selector peso/porcentaje), y campo Comentarios. Al final del apartado, un EvidenciasUploader con area="REVISION_INTERNA" y etiquetas = Revisión / Rotulación / Higiene de cocina.
- En el ObservacionesEditor de las áreas 1-3: cuando la severidad elegida sea EXTREMA, mostrar un selector adicional de modo: "Restar peso fijo" o "Reducir 50% del área". Guardar en extrema_modo.
- El store (auditoriaStore) maneja: las casillas/comentarios de RI, las observaciones de RI, las evidencias de RI, y el extrema_modo en observaciones de áreas 1-3.
- PanelNotas muestra el descuento de Revisión Interna y el total ya con ese descuento aplicado.
Mini-reporte. Build limpio. PARA.

---

## BLOQUE 4 — Guardado + Configuración

- Guardado (TrackingPage y modo edición MisAuditoriasPage): persistir casillas/comentarios RI en au_auditorias, observaciones RI en au_observaciones (con su area RI_*), evidencias RI en au_evidencias (area REVISION_INTERNA + etiqueta), extrema_modo en las observaciones de áreas 1-3, y descuento_ri calculado en la cabecera.
- ConfiguracionPage: nueva sub-sección para editar el peso de la severidad EXTREMA (en au_config_severidad) y los 3 max_descuento de au_config_ri.
Mini-reporte. Build limpio. PARA.

---

## BLOQUE 5 — Vista detalle (director) con DESGLOSE

En DetalleAuditoria, mostrar el apartado 4 (Revisión Interna con sus 3 aspectos: estado conforme, observaciones, comentarios, fotos) y, MUY IMPORTANTE, un DESGLOSE del cálculo para que el director entienda la nota:
- Nota de cada área (Producto/Servicio/Local).
- Si un área fue reducida al 50%, mostrarlo explícito: "⚠ Reducido 50% por observación extremadamente grave".
- El descuento de Revisión Interna (cuánto restó cada aspecto).
- El total final.
También modo edición (MisAuditoriasPage): cargar todo lo de RI y el extrema_modo al reabrir.
Mini-reporte. Build limpio.

---

Recuerda: parar entre bloques, prefijo au_, cálculo solo en calculo.ts, no push.
