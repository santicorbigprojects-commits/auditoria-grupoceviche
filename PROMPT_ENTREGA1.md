# PROMPT CLAUDE CODE — Entrega 1 (cambios simples, sin tocar cálculo)

## CONTEXTO

Proyecto existente en producción (sistema de auditorías Grupo Ceviche). React + TS + Vite + Tailwind + Zustand + Supabase compartido. REGLA DE ORO: todo prefijo `au_`, nunca tocar `vc_` ni pagos. Cálculo SOLO en calculo.ts (ESTA ENTREGA NO TOCA EL CÁLCULO). `.range(0,9999)` en tablas que crecen. Build usa `tsc && vite build` (estricto).

Esta entrega son 3 cambios de bajo riesgo. NO toca la lógica de notas. Hazlos en orden, mini-reporte por cambio, build limpio al final.

---

## CAMBIO 1 — Renombrar "Oportunidades de mejora" → "Comentarios"

En TODOS los textos visibles (labels, títulos, placeholders, botones, encabezados de detalle), reemplazar "Oportunidades de mejora" por "Comentarios".

- NO cambiar nombres de columnas en BD (siguen siendo oportunidad_producto/servicio/local). Solo el texto de cara al usuario.
- Revisar: SeccionProducto, SeccionServicio, SeccionLocal, TrackingPage, MisAuditoriasPage (modo edición), DetalleAuditoria, y cualquier otro lugar donde aparezca el texto.

Recordatorio de terminología para no confundir: "Observaciones" = ítems con severidad que restan (NO se tocan). "Comentarios" = el texto libre que antes se llamaba "Oportunidades de mejora" (no resta, informativo).

---

## CAMBIO 2 — Eliminar una auditoría realizada

Permitir borrar una auditoría completa.

- En MisAuditoriasPage (vista del auditor): botón "Eliminar" en cada auditoría de la lista. El auditor puede borrar las auditorías donde auditor_cut = su CUT.
- Para rol ADMIN: puede borrar CUALQUIER auditoría. (Si el admin usa la vista de director, agregar el botón eliminar ahí para admin; el DIRECTOR normal NO puede borrar, solo consultar.)
- Confirmación explícita antes de borrar: modal o confirm con texto claro tipo "Esto eliminará la auditoría y sus fotos de forma permanente. ¿Continuar?".
- Al borrar:
  1. Primero borrar los archivos de fotos del bucket au-evidencias (obtener las URLs de au_evidencias de esa auditoría, extraer el path y borrarlos del Storage con supabase.storage.from('au-evidencias').remove([...])).
  2. Luego DELETE de au_auditorias por id. El cascade borra producto_items, servicio, local, observaciones y evidencias automáticamente.
- Usar .range(0,9999) donde corresponda. Refrescar la lista tras borrar.

---

## CAMBIO 3 — Mostrar Comentarios y Observaciones en la vista del director

En DetalleAuditoria (lo que ve director/admin), asegurar que se muestren, por cada área (Producto, Servicio, Local):
- Las Observaciones con su severidad (badge de color).
- Los Comentarios (el texto libre, antes "oportunidades").

Si ya se muestran las observaciones, agregar los comentarios donde falten. Que quede claro y legible por área.

---

## CIERRE

Build limpio (`npm run build`). Mini-reporte de los 3 cambios. NO hagas push tú; yo pruebo en local y subo.
