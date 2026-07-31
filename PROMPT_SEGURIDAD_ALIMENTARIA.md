# PROMPT CLAUDE CODE — Módulo "Evaluación de Seguridad Alimentaria"

## CONTEXTO

Proyecto EN PRODUCCIÓN (auditorías Grupo Ceviche). React + TS + Vite + Tailwind + Zustand + Supabase compartido. REGLA DE ORO: prefijo `au_`, nunca tocar `vc_` ni pagos. El cálculo de la auditoría de CALIDAD vive en calculo.ts y NO se toca. `.range(0,9999)` en tablas que crecen. Build usa `tsc && vite build` (estricto). NO hagas push; yo pruebo y subo.

Este es un MÓDULO NUEVO e independiente, paralelo a la auditoría de calidad existente. NO modifica la auditoría de calidad. Usa prefijo `au_sa_` (seguridad alimentaria) para todas sus tablas.

Trabaja en BLOQUES, mini-reporte y build limpio por bloque, PARA entre cada uno.

---

## MODELO COMPLETO (leer entero)

Segundo tipo de auditoría: "Evaluación de Seguridad Alimentaria". Calificación CUALITATIVA (sin nota numérica). El auditor la realiza; los directores la ven.

### Flujo de entrada
Al pulsar "Nueva auditoría" (hoy va directo al formulario de calidad), ahora aparecen DOS opciones:
- "Auditoría de calidad" → el flujo actual de siempre (Producto/Servicio/Local/Revisión Interna).
- "Evaluación de Seguridad Alimentaria" → el formulario nuevo de este módulo.

### Secciones y puntos (FIJOS en código, no configurables)
8 secciones. Cada punto se evalúa: CUMPLE / NO CUMPLE / NO APLICA.

1. **Higiene e indumentaria del personal** (los puntos con ▶ permiten registrar personas que NO cumplen)
   - ▶ Uso de cofia/gorro
   - ▶ Sin accesorios personales (collares, pulseras, brazaletes, anillos) — además del nombre, registrar QUÉ accesorio
   - ▶ Lockers personales limpios y ordenados
2. **Higiene del personal y vestuarios**
   - ▶ Disponibilidad de insumos de lavado (dosificador de jabón + papel de un solo uso en lavamanos)
   - Agua caliente sanitaria (lavamanos de cocina, barra y servicios)
   - ▶ Orden y limpieza en vestuarios
3. **Manejo de residuos e instalaciones higiénicas**
   - Cubos de basura operativos (tapa + pedal funcional)
   - Accionamiento higiénico en lavamanos (grifería no manual)
4. **Mantenimiento de infraestructuras y equipos**
   - Estado de suelos y paredes (lisos, lavables, sin agujeros/grietas)
   - Desagües en regla (rejilla + sifón)
   - Mantenimiento y limpieza de frío (cámaras y evaporadores sin hongos)
5. **Almacenamiento y rotulación de alimentos**
   - Aislamiento del suelo (nada de alimentos en el suelo)
   - Etiquetado e identificación (nombre, fecha de apertura/fraccionamiento, caducidad)
   - Protección de alimentos (recipientes cerrados o film, no trapos/bolsas de basura)
   - Trazabilidad de productos
6. **Prácticas de manipulación y descongelación**
   - Proceso de descongelación higiénico (en refrigeración, con rejilla)
   - Apilado y manipulación segura (recipientes tapados, sin contacto con alimento de abajo)
7. **Almacén y productos de limpieza**
   - Almacenamiento de químicos (en su armario, separados de alimentos)
   - Orden general de instalaciones (sin objetos ajenos/en desuso)
8. **Documentación y planes de autocontrol (APPCC)**
   - Plan de Limpieza y Mantenimiento (actualizado e implementado)
   - Plan de Control de Temperaturas (registros diarios)
   - Información de Alérgenos (fichas con todos los alérgenos)

Los puntos marcados con ▶ permiten registrar, cuando se marca NO CUMPLE, una o varias PERSONAS (texto libre del nombre). En "Sin accesorios personales", además del nombre se registra el accesorio (texto libre o selección: collar/pulsera/brazalete/anillo). SOLO se registran las personas que NO cumplen.

### Cálculo cualitativo (estados)
Estados: CORRECTO (verde) / MEJORA (ámbar) / DEFICIENTE (rojo). Los puntos en NO APLICA se ignoran.

Estado de una SECCIÓN (según nº de puntos aplicables en NO CUMPLE):
- 0 no cumplen → CORRECTO
- 1 o 2 no cumplen → MEJORA
- 3 o más no cumplen → DEFICIENTE

Estado GLOBAL de la evaluación:
- Todas las secciones CORRECTO → CORRECTO
- Hay MEJORA pero ninguna DEFICIENTE → MEJORA
- Al menos una sección DEFICIENTE → DEFICIENTE

(Todos los puntos pesan igual; sin criticidad por ahora.)

### Permisos
- AUDITOR: crea y edita evaluaciones de seguridad.
- DIRECTOR: solo lectura, solo sus locales.
- ADMIN: solo lectura, todos.

---

## BLOQUE 1 — Migración (genera `migracion_v9.sql`, NO la ejecutes, la reviso yo)

```sql
-- Cabecera de cada evaluación de seguridad alimentaria
CREATE TABLE IF NOT EXISTS au_sa_evaluaciones (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id      text NOT NULL REFERENCES au_locales(id),
  auditor_cut   text NOT NULL,
  fecha         date NOT NULL,
  estado_global text CHECK (estado_global IN ('CORRECTO','MEJORA','DEFICIENTE')),
  creado_en     timestamptz NOT NULL DEFAULT now()
);

-- Respuesta por cada punto evaluado (el catálogo de puntos vive en el código;
-- aquí se guarda la clave del punto como snapshot + su estado)
CREATE TABLE IF NOT EXISTS au_sa_respuestas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluacion_id uuid NOT NULL REFERENCES au_sa_evaluaciones(id) ON DELETE CASCADE,
  seccion_key   text NOT NULL,
  punto_key     text NOT NULL,
  punto_nombre  text NOT NULL,   -- snapshot legible
  seccion_nombre text NOT NULL,  -- snapshot legible
  estado        text NOT NULL CHECK (estado IN ('CUMPLE','NO_CUMPLE','NO_APLICA'))
);

-- Personas registradas en un punto que NO cumple (solo para puntos con ▶)
CREATE TABLE IF NOT EXISTS au_sa_personas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  respuesta_id  uuid NOT NULL REFERENCES au_sa_respuestas(id) ON DELETE CASCADE,
  nombre        text NOT NULL,
  accesorio     text   -- solo para el punto de accesorios; null en los demás
);

-- RLS permisivo anon en las 3 tablas
ALTER TABLE au_sa_evaluaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE au_sa_respuestas   ENABLE ROW LEVEL SECURITY;
ALTER TABLE au_sa_personas     ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON au_sa_evaluaciones FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON au_sa_respuestas   FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON au_sa_personas     FOR ALL TO anon USING (true) WITH CHECK (true);
```

Puramente aditiva (3 tablas nuevas, no toca nada existente). Muéstrame el archivo y PARA.

---

## BLOQUE 2 — Catálogo de puntos + lógica de estados (en código)

- Crear `src/lib/seguridadAlimentaria.ts` con:
  - El catálogo FIJO de las 8 secciones y sus puntos (con keys estables tipo 'higiene_cofia', 'higiene_accesorios', etc.), marcando cuáles permiten registrar personas y cuál permite accesorio.
  - `calcularEstadoSeccion(respuestas)` y `calcularEstadoGlobal(secciones)` con las reglas de arriba (0 / 1-2 / 3+; y global según haya deficientes/mejoras).
- Esta lógica cualitativa es independiente de calculo.ts (que es para la auditoría de calidad). NO tocar calculo.ts.

Mini-reporte con el catálogo y las funciones. PARA.

---

## BLOQUE 3 — Formulario de la evaluación + selección de tipo

- Pantalla de selección: al pulsar "Nueva auditoría", mostrar 2 botones/tarjetas: "Auditoría de calidad" (lleva al flujo actual) y "Evaluación de Seguridad Alimentaria" (lleva al formulario nuevo).
- Nuevo `SeguridadAlimentariaPage.tsx` (o el nombre que corresponda):
  - Selector de local (agrupado por marca, como en el formulario de calidad).
  - Las 8 secciones con sus puntos; cada punto con 3 opciones CUMPLE / NO CUMPLE / NO APLICA.
  - En los puntos con ▶: al marcar NO CUMPLE, se habilita una lista dinámica para agregar personas (nombre; y en accesorios, también el accesorio). Se pueden agregar/quitar varias.
  - Panel lateral en vivo con el estado de cada sección y el estado global (semáforo), recalculado con seguridadAlimentaria.ts.
  - Botón Guardar.
- Store propio para el borrador (nuevo slice de Zustand o store separado; NO reutilizar el de calidad para no mezclar).

Mini-reporte. Build limpio. PARA.

---

## BLOQUE 4 — Guardado, historial y detalle

- Guardado: insertar cabecera en au_sa_evaluaciones (con estado_global calculado), las respuestas en au_sa_respuestas (con snapshots de nombres), y las personas en au_sa_personas.
- Historial: en "Mis auditorías" del auditor, o una pestaña propia, listar las evaluaciones de seguridad (separadas de las de calidad), con fecha, local y estado global (semáforo). Poder abrir el detalle y editar (recargar todo y actualizar sin duplicar).
- Detalle para director/admin: ver la evaluación completa — cada sección con su estado, cada punto con su resultado, y las personas registradas en los que no cumplen. Solo lectura, respetando permisos (director solo sus locales).

Mini-reporte. Build limpio. PARA.

---

## BLOQUE 5 — Resultado General: segundo apartado

En la vista "Resultado General" (que hoy muestra el promedio de calidad), agregar un SEGUNDO APARTADO / pestaña "Seguridad Alimentaria":
- Por cada local, el estado de su ÚLTIMA evaluación de seguridad (CORRECTO/MEJORA/DEFICIENTE con semáforo) y la fecha.
- Los locales sin evaluación aparecen como "No evaluado".
- Un conteo global: "X correctos, Y mejora necesaria, Z deficientes" (de los evaluados).
- Filtro por director (como el apartado de calidad).
- El apartado de calidad existente NO se toca; este se agrega al lado (tabs o secciones).

Mini-reporte. Build limpio.

---

Recuerda: prefijo au_sa_, NO tocar calculo.ts ni la auditoría de calidad, `.range(0,9999)`, parar entre bloques, no push.
