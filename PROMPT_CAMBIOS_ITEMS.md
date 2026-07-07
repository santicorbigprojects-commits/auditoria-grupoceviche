# PROMPT CLAUDE CODE — Cambios en ítems de Local/Servicio + Export Excel

## CONTEXTO

Proyecto EN PRODUCCIÓN (sistema de auditorías Grupo Ceviche). React + TS + Vite + Tailwind + Zustand + Supabase compartido. REGLA DE ORO: prefijo `au_`, nunca tocar `vc_` ni pagos. TODO el cálculo vive SOLO en calculo.ts. `.range(0,9999)` en tablas que crecen. Build usa `tsc && vite build` (estricto). NO hagas push; yo pruebo y subo.

IMPORTANTE — la base YA fue migrada a mano (no generes SQL): ya existen las columnas nuevas `au_auditoria_local.limp_cocina` (boolean) y `au_auditoria_servicio.fid_tarjeta` (boolean). Las auditorías existentes ya tienen esas columnas en `true`. Tu trabajo es SOLO el código (UI + cálculo + export). No toques la base.

Trabaja en bloques con mini-reporte y build limpio por bloque.

---

## BLOQUE 1 — Renombrados (solo texto visible, no tocar columnas de BD)

En la UI (SeccionLocal, DetalleAuditoria, y donde aparezcan estos textos):
- "Carta completa" → "Carta en buen estado"  (la columna en BD sigue siendo cart_completa)
- "Sala" → "Salón"  (la columna en BD sigue siendo limp_sala)

Solo cambia el label visible. NO renombres columnas ni claves de BD.

---

## BLOQUE 2 — Ítems nuevos + ajuste de cálculo

### 2a. Local — nuevo check "Cocina" (Limpieza)
- En SeccionLocal, agregar un check "Cocina" en el grupo Limpieza. Los checks de Local ahora son: Cartelería (cart_actualizada, cart_completa) + Limpieza (limp_sala=Salón, limp_banos=Baños, limp_barras=Barra, limp_cocina=Cocina). Total 6 checks.
- Guardar/leer la columna `limp_cocina` en el flujo (TrackingPage, modo edición MisAuditoriasPage, y DetalleAuditoria).
- calculo.ts: el denominador de Local pasa de 5 a 6. Actualizar LOCAL_CAMPOS para incluir 'limp_cocina'. La fórmula sigue: (checks true / 6) * (20/3).

### 2b. Servicio — nuevo check "Comunicó sobre la tarjeta de fidelización" (Fidelización)
- En SeccionServicio, agregar un check "Comunicó sobre la tarjeta de fidelización" en el grupo Fidelización. Los checks de Servicio ahora son 14 (los 13 actuales + fid_tarjeta).
- Guardar/leer la columna `fid_tarjeta` en el flujo (TrackingPage, modo edición, DetalleAuditoria).
- calculo.ts: el denominador de Servicio pasa de 13 a 14. Actualizar SERVICIO_CAMPOS para incluir 'fid_tarjeta'. La fórmula sigue: (checks true / 14) * (20/3).

NO cambies ninguna otra parte del cálculo (Producto, Revisión Interna, extrema, doble castigo, etc. quedan igual). Solo los denominadores de Local (5→6) y Servicio (13→14).

Muéstrame en el mini-reporte los LOCAL_CAMPOS y SERVICIO_CAMPOS actualizados para que verifique el conteo. PARA.

---

## BLOQUE 3 — Exportar a Excel (en "Mis auditorías")

Agregar en MisAuditoriasPage un botón "Exportar a Excel" que descargue las auditorías del auditor en un archivo .xlsx.

- Usar SheetJS (xlsx) vía el CDN oficial (no npm, por CVEs), consistente con el resto del proyecto.
- UNA SOLA HOJA, formato "largo": una fila por cada ítem de detalle, repitiendo los datos de cabecera. Es decir, por cada auditoría se generan varias filas (una por ingrediente calificado, una por cada check, etc.). Esto permite filtrar en Excel.
- Los nombres de columnas y valores deben usar los MISMOS textos que se ven en el frontend (ej. "Salón", "Carta en buen estado", "Comunicó sobre la tarjeta de fidelización", nombres de severidad en español, etc.).
- Columnas sugeridas (cabecera repetida + detalle):
  Fecha | Local | Auditor (nombre) | Mesero | Nota Producto | Nota Servicio | Nota Local | Descuento Rev.Interna | Nota Total | Sección | Ítem | Valor | Detalle
  - "Sección" = PRODUCTO / SERVICIO / LOCAL / REVISIÓN INTERNA
  - "Ítem" = el nombre del check/ingrediente/aspecto (texto frontend)
  - "Valor" = Sí/No para checks, o el nombre del plato+ingrediente para producto, o la severidad para observaciones
  - "Detalle" = texto libre cuando aplique (comentario, texto de observación, tiempo real, etc.)
- Traer los datos con .range(0,9999). Solo las auditorías del auditor logueado (auditor_cut = su CUT); si el rol es ADMIN, exportar todas.
- El archivo se llama algo como "auditorias_{fecha}.xlsx".

Mini-reporte. Build limpio.

---

Recuerda: no tocar la base (ya migrada), cálculo solo en calculo.ts, no push, parar entre bloques.
