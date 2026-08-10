# PROMPT CLAUDE CODE — Permitir a directores y admin editar Acciones de mejora

## CONTEXTO

Proyecto EN PRODUCCIÓN (auditorías Grupo Ceviche). React + TS + Vite + Tailwind + Zustand + Supabase compartido. REGLA DE ORO: prefijo `au_`, nunca tocar `vc_` ni pagos. NO toca el cálculo ni la base de datos (sin migración). Build usa `tsc && vite build`. NO hagas push; yo pruebo y subo.

Cambio pequeño y de permisos únicamente, en `AccionesMejoraPage.tsx`.

## SITUACIÓN ACTUAL

En la vista "Acciones de mejora", hoy SOLO el rol AUDITOR puede editar los campos (acción de mejora, fecha de evaluación, checkbox Resuelto). Para DIRECTOR y ADMIN los campos son de solo lectura. El DIRECTOR además solo ve las observaciones de sus locales (vía au_director_locales); el ADMIN ve todas.

## CAMBIO PEDIDO

Ahora TAMBIÉN el DIRECTOR y el ADMIN pueden EDITAR todos los campos editables (acción de mejora, fecha de evaluación, y el check Resuelto).

Reglas:
- La condición que hoy habilita la edición solo para `rol === 'AUDITOR'` debe pasar a habilitarla para AUDITOR, DIRECTOR y ADMIN (es decir, cualquier rol con acceso a la vista).
- **Mantener intacto el filtrado por locales del DIRECTOR**: el director sigue viendo y, por tanto, editando SOLO las observaciones de sus locales asignados (au_director_locales). Este cambio NO debe ampliar qué filas ve el director; solo permitirle editar las que ya ve.
- El ADMIN edita todas (ya ve todas).
- El guardado (upsert en au_acciones_mejora por observacion_id) ya existe y no cambia; solo se habilita para más roles.

## IMPLEMENTACIÓN

- Buscar en AccionesMejoraPage.tsx la condición de "editable" (probablemente algo como `const puedeEditar = rol === 'AUDITOR'` o comprobaciones inline `rol === 'AUDITOR' ?` en cada input/checkbox).
- Cambiarla a que sea true para los tres roles con acceso (AUDITOR, DIRECTOR, ADMIN). Si hay una sola variable central, cambiar solo esa; si está repetido inline, unificarlo en una variable `puedeEditar` para no dejar ningún campo inconsistente.
- Verificar que los 3 campos editables (acción, fecha, resuelto) queden coherentes: o todos editables o todos no, según el rol.
- No tocar la lógica de carga/filtrado por local del director.

## CIERRE

Build limpio (`tsc && vite build`). Mini-reporte indicando exactamente qué condición se cambió y en qué línea/variable. NO push.
