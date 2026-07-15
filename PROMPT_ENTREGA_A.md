# PROMPT CLAUDE CODE — Entrega A: Columna Director + Resultado General

## CONTEXTO

Proyecto EN PRODUCCIÓN (auditorías Grupo Ceviche). React + TS + Vite + Tailwind + Zustand + Supabase compartido. REGLA DE ORO: prefijo `au_`, nunca tocar `vc_` ni pagos. TODO el cálculo vive en calculo.ts — **ESTA ENTREGA NO TOCA EL CÁLCULO**. `.range(0,9999)` en tablas que crecen. Build usa `tsc && vite build`. NO hagas push; yo pruebo y subo.

Esta entrega es de SOLO LECTURA sobre los datos existentes: no hay migración, no se modifica ninguna tabla, no se recalcula nada. Riesgo mínimo.

Trabaja en bloques, mini-reporte y build limpio por bloque, PARA entre cada uno.

---

## BLOQUE 1 — Columna "Director" en Acciones de mejora + filtro

En `AccionesMejoraPage`:

- Agregar una columna **"Director"** ENTRE las columnas "Local" y "Área".
- El director de cada local NO se hardcodea: sale de la tabla existente `au_director_locales` (que mapea director_cut → local_id), cruzada con `au_usuarios` para obtener el nombre. Esa tabla ya contiene la asignación correcta (Alex Luna A00004, Vladimir Calanche A00019, Giovanna Arce A00021).
- Si un local no tuviera director asignado, mostrar "—".
- Cargar esos datos junto con las demás queries (sin N+1) y cruzar en memoria.

**Filtro por director**: agregar un dropdown "Director" junto a los filtros existentes (Local y Estado), con opción "Todos los directores" + la lista de directores. Filtra la tabla.
- Para rol DIRECTOR: el filtro solo debe ofrecer/mostrar lo que ya puede ver (sus locales). No debe permitirle ver observaciones de locales ajenos.

Mini-reporte. Build limpio. PARA.

---

## BLOQUE 2 — Nueva vista "Resultado General"

Componente nuevo `ResultadoGeneralPage.tsx`. Accesible para TODOS los roles (AUDITOR, DIRECTOR, ADMIN). Solo lectura.

### Qué muestra

1. **Nota general del grupo**, destacada y grande: el **promedio simple** de la ÚLTIMA nota_total de cada local **auditado**.
   - Los locales SIN ninguna auditoría NO se incluyen en el promedio (no cuentan como 0).
   - Mostrar también cuántos locales se están promediando (ej. "Promedio de 5 locales auditados de 19").

2. **Filtro por director**: dropdown "Todos" + los 3 directores. Al filtrar, la nota general se recalcula solo con los locales de ese director.

3. **Tabla/lista de locales** con:
   - Local (nombre)
   - Director (de `au_director_locales`)
   - Última nota (nota_total de su auditoría más reciente) con semáforo de color (mismos cortes que ya usa el sistema)
   - Fecha de esa última auditoría
   - Los locales sin auditar aparecen listados con **"No auditado"** en lugar de nota, visualmente diferenciados (gris), y NO entran en el promedio.

### Datos
- Traer todas las auditorías con `.range(0,9999)` y quedarse, por cada local, con la más reciente (por fecha, desempatando por creado_en).
- Traer `au_locales` (todos los activos), `au_director_locales` y `au_usuarios` para nombres.
- Pocas queries, cruce en memoria.

### Acceso
Por ahora, TODOS los roles ven TODOS los locales en esta vista (incluido el DIRECTOR, que aquí sí ve el grupo completo, a diferencia de las otras vistas). Es intencional.

Mini-reporte. Build limpio. PARA.

---

## BLOQUE 3 — Integrar "Resultado General" y hacerlo la pantalla de inicio

- Agregar la pestaña "Resultado General" en la navegación de AuditorPage y DirectorPage, como **primera opción** del menú.
- **Cambiar el routing post-login**: hoy el AUDITOR aterriza en "Nueva auditoría" y el DIRECTOR/ADMIN en "Historial". Ahora TODOS los roles deben aterrizar en **"Resultado General"** al iniciar sesión.
- Revisar Login.tsx / router.tsx / los estados de pestaña por defecto en AuditorPage y DirectorPage para que el default sea Resultado General.
- Las demás pestañas siguen funcionando igual.

Mini-reporte. Build limpio.

---

Recuerda: no tocar el cálculo, no migrar la BD, prefijo au_, `.range(0,9999)`, parar entre bloques, no push.
