# PROMPT CLAUDE CODE — Entrega B: Tiempos configurables + tiempos de Cholito

## CONTEXTO

Proyecto EN PRODUCCIÓN (auditorías Grupo Ceviche). React + TS + Vite + Tailwind + Zustand + Supabase compartido. REGLA DE ORO: prefijo `au_`, nunca tocar `vc_` ni pagos. TODO el cálculo vive SOLO en calculo.ts. `.range(0,9999)` en tablas que crecen. Build usa `tsc && vite build` (estricto). NO hagas push; yo pruebo y subo.

**ESTA ENTREGA TOCA EL CÁLCULO** (el denominador de Servicio pasa de fijo a variable). Máxima cautela. Bloques con parada entre cada uno.

---

## MODELO (leer entero antes de codificar)

Hoy el área Servicio tiene 14 checks FIJOS, de los cuales 4 son tiempos (entrante, principal, bebida, postre). El denominador es siempre 14.

Cambios:

### 1. Bloque de tiempos activable/desactivable (TODOS los locales)
- Un check "Evaluar tiempos de atención" que activa/desactiva el BLOQUE COMPLETO de los 4 tiempos base (entrante, principal, bebida, postre).
- Por defecto: ACTIVADO.
- Si se DESACTIVA: los 4 tiempos NO se evalúan y SALEN DEL DENOMINADOR de Servicio (Servicio pasaría a calcularse sobre 10 checks).

### 2. Tiempos extra SOLO para Cholito (marca_id = 'cholito')
- Cuando el local auditado pertenece a la marca 'cholito', aparecen DOS tiempos adicionales: **Sándwich** y **Jugos**.
- Cada uno tiene su PROPIO check de activación, independiente del otro (pueden evaluarse los dos, solo uno, o ninguno).
- Por defecto: DESACTIVADOS (el auditor los activa si aplican).
- Si están activados, SUMAN AL DENOMINADOR de Servicio.
- En locales de otras marcas, estos campos NO se muestran ni existen.

### 3. Denominador VARIABLE de Servicio
La fórmula pasa de `(trues / 14) * (20/3)` a `(trues / checks_aplicables) * (20/3)`, donde:
- checks_aplicables = 10 checks base (fidelización ×3, upselling ×2, presentación ×5)
  + 4 si el bloque de tiempos base está activo
  + 1 si tiempo sándwich está activo (solo Cholito)
  + 1 si tiempo jugos está activo (solo Cholito)
- Los checks NO aplicables no cuentan ni en el numerador ni en el denominador.
- Si checks_aplicables fuera 0 (caso imposible pero defensivo), devolver la nota máxima del área (20/3) para no dividir por cero.

### 4. Retrocompatibilidad con auditorías EXISTENTES (importante)
Las auditorías ya guardadas NO tienen los flags nuevos. Para ellas se asume:
- Bloque de tiempos base: ACTIVO (los 4 tiempos cuentan).
- Sándwich y jugos: NO aplican.
- Es decir, denominador 14, exactamente como se calculaban antes. **Sus notas NO deben cambiar.**
Implementa esto con defaults: si el flag es NULL/undefined → tratar como activo (tiempos base) o no aplicable (sándwich/jugos).

---

## BLOQUE 1 — Migración (genera `migracion_v8.sql`, NO la ejecutes, la reviso yo)

```sql
-- Flags de qué tiempos se evaluaron + los 2 tiempos nuevos de Cholito.
-- Todo nullable/aditivo: las auditorías existentes quedan en NULL y el código
-- las interpreta como "tiempos base activos, sándwich/jugos no aplican".
ALTER TABLE au_auditoria_servicio ADD COLUMN IF NOT EXISTS tiempos_base_activo boolean;
ALTER TABLE au_auditoria_servicio ADD COLUMN IF NOT EXISTS tiempo_sandwich_activo boolean;
ALTER TABLE au_auditoria_servicio ADD COLUMN IF NOT EXISTS tiempo_jugos_activo    boolean;
ALTER TABLE au_auditoria_servicio ADD COLUMN IF NOT EXISTS tiempo_sandwich_min numeric;
ALTER TABLE au_auditoria_servicio ADD COLUMN IF NOT EXISTS tiempo_jugos_min    numeric;
ALTER TABLE au_auditoria_servicio ADD COLUMN IF NOT EXISTS tiempo_sandwich_ok  boolean;
ALTER TABLE au_auditoria_servicio ADD COLUMN IF NOT EXISTS tiempo_jugos_ok     boolean;

-- Config de tiempo máximo para los 2 tipos nuevos. au_config_tiempos ya existe
-- (local_id nullable = global, tipo, max_min) con CHECK en tipo. Ampliar el CHECK:
ALTER TABLE au_config_tiempos DROP CONSTRAINT IF EXISTS au_config_tiempos_tipo_check;
ALTER TABLE au_config_tiempos ADD CONSTRAINT au_config_tiempos_tipo_check
  CHECK (tipo IN ('ENTRANTE','PRINCIPAL','BEBIDA','POSTRE','SANDWICH','JUGOS'));

-- Seed de los globales nuevos
INSERT INTO au_config_tiempos (local_id, tipo, max_min) VALUES
  (NULL,'SANDWICH',10),(NULL,'JUGOS',5)
ON CONFLICT (local_id, tipo) DO NOTHING;
```

ADVERTENCIA: hay 1 DROP CONSTRAINT (no DROP TABLE) para ampliar los tipos permitidos. Repórtalo. Muéstrame el archivo y PARA.

---

## BLOQUE 2 — calculo.ts (el núcleo)

- `ItemServicio` incorpora: `tiempos_base_activo`, `tiempo_sandwich_activo`, `tiempo_jugos_activo`, `tiempo_sandwich_ok`, `tiempo_jugos_ok`.
- Separar los campos de Servicio en:
  - BASE (siempre cuentan, 10): fid_speech, fid_nombre_camarero, fid_tarjeta, ups_bebidas, ups_meta_dia, pres_uniformes, pres_cabellos, pres_unas, pres_zapatos, pres_barba_o_maquillaje
  - TIEMPOS BASE (4, cuentan si tiempos_base_activo !== false): tiempo_entrante_ok, tiempo_principal_ok, tiempo_bebida_ok, tiempo_postre_ok
  - CHOLITO (cuentan solo si su flag === true): tiempo_sandwich_ok, tiempo_jugos_ok
- `calcularNotaServicio` construye dinámicamente la lista de campos aplicables según los flags, cuenta los `true`, y divide entre la cantidad de aplicables.
- **Defaults de retrocompatibilidad**: `tiempos_base_activo` NULL/undefined → se trata como `true` (activo). `tiempo_sandwich_activo`/`tiempo_jugos_activo` NULL/undefined → `false` (no aplica). Así las auditorías viejas dan exactamente lo mismo que antes (denominador 14).
- Defensivo: si aplicables === 0 → devolver AREA_MAX.
- NO cambiar nada de Producto, Local, Revisión Interna, observaciones, extremas ni el doble castigo.

En el mini-reporte, muéstrame la función completa y explica cómo queda el denominador en 3 casos: (a) auditoría vieja, (b) Rikos con tiempos desactivados, (c) Cholito con sándwich y jugos activos. PARA.

---

## BLOQUE 3 — Formulario (SeccionServicio)

- Check "Evaluar tiempos de atención" que activa/desactiva el bloque de los 4 tiempos base. Activado por defecto. Al desactivar, los inputs de tiempo se ocultan/deshabilitan y salen del cálculo (el PanelNotas debe reflejarlo en vivo).
- Si el local auditado es de marca 'cholito' (consultar `au_locales.marca_id` del local seleccionado): mostrar además dos bloques independientes, "Tiempo de sándwich" y "Tiempo de jugos", cada uno con su propio check de activación (desactivados por defecto) y su input de tiempo real. Su `_ok` se calcula contra el máximo configurado (tipos SANDWICH y JUGOS en au_config_tiempos, con la jerarquía global/override por local que ya existe).
- En locales de otras marcas, estos dos bloques NO se muestran.
- El store (auditoriaStore) debe manejar los flags y los tiempos nuevos.

Mini-reporte. Build limpio. PARA.

---

## BLOQUE 4 — Guardado, configuración y vistas

- Guardado (TrackingPage + modo edición MisAuditoriasPage): persistir los 3 flags y los 4 campos nuevos de tiempos (min y ok).
- Modo edición: recargar los flags y tiempos al reabrir una auditoría (que no se pierdan).
- ConfiguracionPage → sección de Tiempos: agregar los 2 tipos nuevos (Sándwich y Jugos) a la edición de máximos globales y overrides por local.
- DetalleAuditoria (director): mostrar los tiempos de sándwich/jugos cuando apliquen, e indicar si el bloque de tiempos base estaba desactivado (ej. "Tiempos no evaluados").
- Export a Excel y PDF: incluir los tiempos nuevos cuando apliquen.

Mini-reporte. Build limpio.

---

Recuerda: cálculo solo en calculo.ts, retrocompatibilidad de auditorías viejas (no deben cambiar sus notas), prefijo au_, parar entre bloques, no push.
