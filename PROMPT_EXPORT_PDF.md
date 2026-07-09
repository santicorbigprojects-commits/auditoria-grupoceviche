# PROMPT CLAUDE CODE — Export individual de auditoría a PDF

## CONTEXTO

Proyecto EN PRODUCCIÓN (auditorías Grupo Ceviche). React + TS + Vite + Tailwind + Zustand + Supabase compartido. REGLA DE ORO: prefijo `au_`, nunca tocar `vc_` ni pagos. Cálculo SOLO en calculo.ts (NO lo modifiques; solo léelo para el desglose). `.range(0,9999)` en tablas que crecen. Build usa `tsc && vite build`. NO hagas push; yo pruebo y subo.

Este cambio es SOLO LECTURA: genera un PDF a partir de datos existentes. NO toca la base, no migra, no modifica nada. Cero riesgo para los datos.

## OBJETIVO

Botón "Exportar" (PDF) en CADA fila de "Mis auditorías", AL LADO del botón "Editar". Al pulsarlo, genera y descarga un PDF de ESA auditoría individual, bien maquetado como un informe, con las imágenes de evidencia incrustadas y un apartado que explica cómo se calculó la nota.

## FORMATO DEL PDF

Genera el PDF en el navegador. Usa una librería confiable para incrustar imágenes: recomiendo jsPDF (con jspdf-autotable para las tablas) cargada por CDN, o html2pdf/html2canvas si prefieres renderizar un layout HTML. Elige la que dé mejor control sobre imágenes y saltos de página. Las imágenes vienen de URLs públicas del bucket au-evidencias; hay que cargarlas (fetch → base64/dataURL) antes de incrustarlas en el PDF. Maneja el caso de imagen que no carga (mostrar el link como fallback).

### Orden de secciones (respetar este orden)

1. **Cabecera**: logo/título "Auditoría - Grupo Ceviche", local (nombre), fecha, auditor (nombre), mesero. Las 4 notas destacadas: Producto, Servicio, Local y Total (con el total bien visible).

2. **Producto**: por cada plato auditado, sus ingredientes con el check "Contiene" (Sí/No). Si hay combos, agrupar por combo · slot · plato. Luego las Observaciones de Producto (con severidad) y los Comentarios de Producto. Al final, las evidencias (imágenes) del área Producto, incrustadas, con su etiqueta.

3. **Servicio**: los 14 checks agrupados (Fidelización: speech, nombre camarero, tarjeta de fidelización; Upselling; Presentación; Tiempos con su valor real). Observaciones, Comentarios, y evidencias de Servicio incrustadas.

4. **Local**: los 6 checks (Cartelería: actualizada, en buen estado; Limpieza: Salón, Baños, Barra, Cocina). Observaciones, Comentarios, y evidencias de Local incrustadas.

5. **Revisión Interna**: los 3 aspectos (Revisión de productos, Rotulación, Higiene de cocina) con su estado Conforme/No conforme, sus observaciones (con severidad) y comentarios. Evidencias del apartado (area REVISION_INTERNA) incrustadas con su etiqueta.

6. **Desglose del cálculo** (IMPORTANTE): un apartado que explique de dónde sale la nota final. Debe mostrar, leyendo la lógica de calculo.ts:
   - Nota de cada área (Producto, Servicio, Local) con su base y los descuentos aplicados.
   - Si un área fue reducida al 50% por una observación Extremadamente grave en modo porcentaje, indicarlo explícito: "Reducido 50% por observación extremadamente grave".
   - El descuento de Revisión Interna, desglosado por aspecto (cuánto restó cada uno, con su tope).
   - La fórmula final: Total = Producto + Servicio + Local − Descuento Revisión Interna (con piso en 0).
   Usa los MISMOS valores que el sistema ya calculó y guardó, y explica el desglose de forma legible para un director no técnico.

### Textos
Usar los MISMOS nombres que el frontend (Salón, Barra, Carta en buen estado, Comunicó sobre la tarjeta de fidelización, severidades en español, etc.).

### Nombre del archivo
`auditoria_{local}_{fecha}.pdf` (sin caracteres problemáticos).

## DATOS
Cargar todo lo de esa auditoría (por su id): cabecera de au_auditorias, au_auditoria_producto_items, au_auditoria_servicio, au_auditoria_local, au_observaciones, au_evidencias, y au_config_severidad / au_config_ri si se necesitan para el desglose. Reusar en lo posible la lógica de carga que ya tiene DetalleAuditoria (que ya arma toda esta información para la vista del director) para no duplicar queries.

## UX
- Botón "Exportar" (o icono de descarga/PDF) junto a "Editar" en cada fila de MisAuditoriasPage.
- Spinner mientras genera (cargar e incrustar imágenes toma unos segundos).
- Mensaje de error claro si algo falla, sin romper la página.
- El botón NO debe interferir con el de Editar ni el de Eliminar (cuidar el layout de la fila).

## CIERRE
Build limpio (`tsc && vite build`). Mini-reporte. NO push.
