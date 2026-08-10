# PROMPT: AUDITORÍAS DE OBRADORES — OPCIÓN 2 (PESOS DIFERENCIADOS)

## OBJETIVO GENERAL
Agregar módulo de auditorías independiente para 3 Obradores (Plancha/Salsa, Pastelería, Panadería) con evaluación 0-20, usando sistema de 5 aspectos con pesos diferenciados (OPCIÓN 2). Comportamiento paralelo a Seguridad Alimentaria (módulo independiente, no interfiere con Auditoría de Calidad existente).

---

## 1. CAMBIOS EN BASE DE DATOS (Migraciones SQL)

**INSTRUCCIÓN CRÍTICA:** Generar archivo `migracion_obradores_v1.sql` (NO ejecutar automáticamente). Usuario lo corre en SQL Editor de Supabase.

### 1.1 Tabla `au_obradores`
```sql
CREATE TABLE au_obradores (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL UNIQUE,
  descripcion TEXT,
  categoria VARCHAR(50), -- 'Plancha', 'Pastelería', 'Panadería'
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO au_obradores (nombre, descripcion, categoria) VALUES
('Obrador Plancha y Salsa', 'Producción de salsas, marinadas y preparados de plancha', 'Plancha'),
('Obrador Pastelería', 'Producción de postres, pasteles y preparados repostería', 'Pastelería'),
('Obrador Panadería', 'Producción de pan, bollos y productos de panadería', 'Panadería');
```

### 1.2 Tabla de configuración `au_config_obrador_aspectos`
```sql
CREATE TABLE au_config_obrador_aspectos (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  descripcion TEXT,
  puntos_maximo INT NOT NULL,  -- 3, 4, o 5
  orden INT NOT NULL,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO au_config_obrador_aspectos (nombre, descripcion, puntos_maximo, orden) VALUES
('Limpieza de zona', 'Pisos, paredes, superficies de trabajo limpias y organizadas', 4, 1),
('Limpieza de fríos', 'Congeladores y refrigeradores sin suciedad, desorden ni fugas', 4, 2),
('Uniforme', 'Personal con uniforme limpio, completo y adecuado para la zona', 3, 3),
('Rotulación', 'Productos correctamente etiquetados, fechados y almacenados', 4, 4),
('Higiene', 'Cumplimiento de prácticas de higiene personal, manipulación y desinfección', 5, 5);
```

### 1.3 Tabla de auditorías `au_auditoria_obrador`
```sql
CREATE TABLE au_auditoria_obrador (
  id SERIAL PRIMARY KEY,
  obrador_id INT NOT NULL REFERENCES au_obradores(id) ON DELETE CASCADE,
  auditor_id INT NOT NULL REFERENCES au_usuarios(id) ON DELETE SET NULL,
  fecha_auditoria DATE NOT NULL,
  nota_final DECIMAL(5,2) NOT NULL DEFAULT 0,
  observaciones_generales TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_auditoria_obrador_obrador_id ON au_auditoria_obrador(obrador_id);
CREATE INDEX idx_auditoria_obrador_auditor_id ON au_auditoria_obrador(auditor_id);
CREATE INDEX idx_auditoria_obrador_fecha ON au_auditoria_obrador(fecha_auditoria);
```

### 1.4 Tabla de aspectos por auditoría `au_auditoria_obrador_aspectos`
```sql
CREATE TABLE au_auditoria_obrador_aspectos (
  id SERIAL PRIMARY KEY,
  auditoria_id INT NOT NULL REFERENCES au_auditoria_obrador(id) ON DELETE CASCADE,
  aspecto_id INT NOT NULL REFERENCES au_config_obrador_aspectos(id) ON DELETE RESTRICT,
  respuesta INT NOT NULL, -- 0=No, 1=Masomenos, 2=Sí
  observacion TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(auditoria_id, aspecto_id)
);

CREATE INDEX idx_auditoria_obrador_aspectos_auditoria_id ON au_auditoria_obrador_aspectos(auditoria_id);
```

### 1.5 Tabla de observaciones con severidad `au_auditoria_obrador_observaciones`
```sql
CREATE TABLE au_auditoria_obrador_observaciones (
  id SERIAL PRIMARY KEY,
  auditoria_id INT NOT NULL REFERENCES au_auditoria_obrador(id) ON DELETE CASCADE,
  aspecto_id INT NOT NULL REFERENCES au_config_obrador_aspectos(id) ON DELETE SET NULL,
  descripcion TEXT NOT NULL,
  severidad VARCHAR(20) NOT NULL, -- NINGUNA, LEVE, MEDIA, GRAVE, EXTREMA
  modo_extrema VARCHAR(20), -- 'PESO' o 'PORCENTAJE' (solo si severidad=EXTREMA)
  peso_resta DECIMAL(5,2) DEFAULT 0, -- para EXTREMA en modo PESO
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_obs_obrador_auditoria_id ON au_auditoria_obrador_observaciones(auditoria_id);
```

### 1.6 Tabla de evidencias `au_auditoria_obrador_evidencias`
```sql
CREATE TABLE au_auditoria_obrador_evidencias (
  id SERIAL PRIMARY KEY,
  auditoria_id INT NOT NULL REFERENCES au_auditoria_obrador(id) ON DELETE CASCADE,
  aspecto_id INT NOT NULL REFERENCES au_config_obrador_aspectos(id) ON DELETE SET NULL,
  url_storage VARCHAR(500) NOT NULL, -- ruta en bucket au-evidencias
  archivo_nombre VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_evidencias_obrador_auditoria_id ON au_auditoria_obrador_evidencias(auditoria_id);
```

### 1.7 Tabla de acciones de mejora `au_acciones_mejora_obrador`
```sql
CREATE TABLE au_acciones_mejora_obrador (
  id SERIAL PRIMARY KEY,
  observacion_id INT NOT NULL REFERENCES au_auditoria_obrador_observaciones(id) ON DELETE CASCADE,
  auditoria_id INT NOT NULL REFERENCES au_auditoria_obrador(id) ON DELETE CASCADE,
  obrador_id INT NOT NULL REFERENCES au_obradores(id) ON DELETE CASCADE,
  accion_correctiva TEXT,
  fecha_evaluacion DATE,
  resuelto BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_acciones_mejora_obrador_obrador_id ON au_acciones_mejora_obrador(obrador_id);
```

### 1.8 Tabla de visitas separadas `au_visitas_obrador`
```sql
CREATE TABLE au_visitas_obrador (
  id SERIAL PRIMARY KEY,
  obrador_id INT NOT NULL REFERENCES au_obradores(id) ON DELETE CASCADE,
  auditor_id INT NOT NULL REFERENCES au_usuarios(id) ON DELETE SET NULL,
  fecha_programada DATE NOT NULL,
  estado VARCHAR(20) DEFAULT 'PENDIENTE', -- PENDIENTE, REALIZADA, CANCELADA
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_visitas_obrador_obrador_id ON au_visitas_obrador(obrador_id);
CREATE INDEX idx_visitas_obrador_auditor_id ON au_visitas_obrador(auditor_id);
```

### 1.9 Config de severidad para Obradores `au_config_severidad_obrador`
```sql
CREATE TABLE au_config_severidad_obrador (
  id SERIAL PRIMARY KEY,
  severidad VARCHAR(20) NOT NULL UNIQUE, -- LEVE, MEDIA, GRAVE, EXTREMA
  peso_resta DECIMAL(5,2) NOT NULL, -- puntos a restar
  descripcion TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO au_config_severidad_obrador (severidad, peso_resta, descripcion) VALUES
('LEVE', 0.5, 'Incumplimiento menor, fácil de corregir'),
('MEDIA', 1.0, 'Incumplimiento moderado, requiere acción'),
('GRAVE', 2.0, 'Incumplimiento severo, riesgo operativo'),
('EXTREMA', 4.0, 'Incumplimiento crítico, riesgo seguridad/regulatorio');
```

### 1.10 RLS (Row-Level Security)
```sql
-- Permitir anon key acceso completo (autorización en frontend por rol)
ALTER TABLE au_obradores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "obradores_anon_read" ON au_obradores FOR ALL TO anon USING (true);

ALTER TABLE au_config_obrador_aspectos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "config_obrador_aspectos_anon_read" ON au_config_obrador_aspectos FOR ALL TO anon USING (true);

-- [repetir para todas las tablas au_auditoria_obrador*, au_config_severidad_obrador, etc.]
ALTER TABLE au_auditoria_obrador ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auditoria_obrador_anon_all" ON au_auditoria_obrador FOR ALL TO anon USING (true);

-- [aplicar patrón a todas las tablas nuevas prefijo au_*]
```

---

## 2. NUEVA LÓGICA DE CÁLCULO (`src/lib/calculoObrador.ts`)

Crear archivo **nuevo y separado** (no tocar `calculo.ts` existente).

```typescript
// src/lib/calculoObrador.ts

// Mapeo: respuesta (0/1/2) → porcentaje del máximo
const MAPEO_RESPUESTA = {
  0: 0,      // No
  1: 0.5,    // Masomenos
  2: 1,      // Sí
};

interface AspectosConfig {
  id: number;
  nombre: string;
  puntos_maximo: number;
  orden: number;
}

interface RespuestaAspecto {
  aspecto_id: number;
  respuesta: number; // 0, 1, 2
}

interface ObservacionObrador {
  aspecto_id: number | null;
  severidad: string;
  peso_resta: number;
  modo_extrema?: string;
}

/**
 * Calcula nota de obrador (0-20)
 * 1. Base: suma de (respuesta × puntos_maximo) por cada aspecto
 * 2. Descuentos por observaciones con severidad
 * 3. Piso en 0
 */
export function calcularNotaObrador(
  respuestas: RespuestaAspecto[],
  configAspectos: AspectosConfig[],
  observaciones: ObservacionObrador[] = [],
  configSeveridad: Record<string, number> = {} // ej. { LEVE: 0.5, MEDIA: 1, GRAVE: 2, EXTREMA: 4 }
): number {
  // PASO 1: Calcular total máximo esperado (suma de todos los puntos_maximo)
  const totalMaximo = configAspectos.reduce((sum, a) => sum + a.puntos_maximo, 0);

  // PASO 2: Calcular suma de puntos obtenidos
  let puntosObtenidos = 0;
  respuestas.forEach((resp) => {
    const config = configAspectos.find((a) => a.id === resp.aspecto_id);
    if (config) {
      const puntos = MAPEO_RESPUESTA[resp.respuesta as keyof typeof MAPEO_RESPUESTA] * config.puntos_maximo;
      puntosObtenidos += puntos;
    }
  });

  // PASO 3: Normalizar a 0-20 (regla de tres)
  let notaBase = (puntosObtenidos / totalMaximo) * 20;

  // PASO 4: Aplicar descuentos por observaciones
  observaciones.forEach((obs) => {
    if (obs.severidad === 'EXTREMA' && obs.modo_extrema === 'PORCENTAJE') {
      // Reduce a 50% (tope no acumulable)
      notaBase *= 0.5;
    } else {
      // Resta fija por severidad
      notaBase -= obs.peso_resta;
    }
  });

  // PASO 5: Piso en 0
  return Math.max(0, notaBase);
}

/**
 * Retorna resumen de cálculo (para explicar en PDF/UI)
 */
export function obtenerDesgloceObrador(
  respuestas: RespuestaAspecto[],
  configAspectos: AspectosConfig[],
  observaciones: ObservacionObrador[] = []
): {
  puntosObtenidos: number;
  totalMaximo: number;
  notaBase: number;
  descuentoTotal: number;
  notaFinal: number;
  detalleAspectos: Array<{
    nombre: string;
    respuesta: string;
    puntos: number;
    maximo: number;
  }>;
} {
  const totalMaximo = configAspectos.reduce((sum, a) => sum + a.puntos_maximo, 0);
  let puntosObtenidos = 0;
  const detalleAspectos = [];

  respuestas.forEach((resp) => {
    const config = configAspectos.find((a) => a.id === resp.aspecto_id);
    if (config) {
      const factor = MAPEO_RESPUESTA[resp.respuesta as keyof typeof MAPEO_RESPUESTA];
      const puntos = factor * config.puntos_maximo;
      puntosObtenidos += puntos;

      const respuestaTexto = ['No', 'Masomenos', 'Sí'][resp.respuesta];
      detalleAspectos.push({
        nombre: config.nombre,
        respuesta: respuestaTexto,
        puntos,
        maximo: config.puntos_maximo,
      });
    }
  });

  const notaBase = (puntosObtenidos / totalMaximo) * 20;
  let descuentoTotal = 0;

  observaciones.forEach((obs) => {
    if (obs.severidad === 'EXTREMA' && obs.modo_extrema === 'PORCENTAJE') {
      descuentoTotal += notaBase * 0.5;
    } else {
      descuentoTotal += obs.peso_resta;
    }
  });

  const notaFinal = Math.max(0, notaBase - descuentoTotal);

  return {
    puntosObtenidos,
    totalMaximo,
    notaBase,
    descuentoTotal,
    notaFinal,
    detalleAspectos,
  };
}
```

---

## 3. ZUSTAND STORE (`src/store/obradorStore.ts`)

Crear **nuevo store separado** (no mezclar con auditoriaStore existente).

```typescript
// src/store/obradorStore.ts

import { create } from 'zustand';

export interface Obrador {
  id: number;
  nombre: string;
  descripcion: string;
  categoria: string;
  activo: boolean;
}

export interface ConfigAspectoObrador {
  id: number;
  nombre: string;
  descripcion: string;
  puntos_maximo: number;
  orden: number;
}

export interface AuditoriaObrador {
  id: number;
  obrador_id: number;
  auditor_id: number;
  fecha_auditoria: string;
  nota_final: number;
  observaciones_generales: string;
  created_at: string;
}

export interface RespuestaAspecto {
  aspecto_id: number;
  respuesta: number; // 0=No, 1=Masomenos, 2=Sí
  observacion: string;
}

export interface ObservacionObrador {
  id?: number;
  aspecto_id: number | null;
  descripcion: string;
  severidad: 'NINGUNA' | 'LEVE' | 'MEDIA' | 'GRAVE' | 'EXTREMA';
  modo_extrema?: 'PESO' | 'PORCENTAJE';
  peso_resta: number;
}

export interface EvidenciaObrador {
  id?: number;
  aspecto_id: number | null;
  archivo_nombre: string;
  url_storage: string;
}

interface ObradorStoreState {
  // Dato dinámico durante auditoría
  auditoriaEnCurso: {
    obrador_id: number | null;
    fecha_auditoria: string;
    respuestas: RespuestaAspecto[];
    observaciones: ObservacionObrador[];
    evidencias: EvidenciaObrador[];
    observaciones_generales: string;
  };

  // Métodos de mutación
  iniciarAuditoria: (obrador_id: number) => void;
  actualizarRespuesta: (aspecto_id: number, respuesta: number, observacion?: string) => void;
  agregarObservacion: (obs: ObservacionObrador) => void;
  eliminarObservacion: (index: number) => void;
  agregarEvidencia: (evidencia: EvidenciaObrador) => void;
  eliminarEvidencia: (index: number) => void;
  actualizarObservacionesGenerales: (texto: string) => void;
  limpiarAuditoria: () => void;
}

export const useObradorStore = create<ObradorStoreState>((set) => ({
  auditoriaEnCurso: {
    obrador_id: null,
    fecha_auditoria: new Date().toISOString().split('T')[0],
    respuestas: [],
    observaciones: [],
    evidencias: [],
    observaciones_generales: '',
  },

  iniciarAuditoria: (obrador_id: number) =>
    set((state) => ({
      auditoriaEnCurso: {
        ...state.auditoriaEnCurso,
        obrador_id,
        fecha_auditoria: new Date().toISOString().split('T')[0],
        respuestas: [],
        observaciones: [],
        evidencias: [],
        observaciones_generales: '',
      },
    })),

  actualizarRespuesta: (aspecto_id: number, respuesta: number, observacion?: string) =>
    set((state) => {
      const existente = state.auditoriaEnCurso.respuestas.findIndex((r) => r.aspecto_id === aspecto_id);
      let nuevasRespuestas = [...state.auditoriaEnCurso.respuestas];
      if (existente !== -1) {
        nuevasRespuestas[existente] = { aspecto_id, respuesta, observacion: observacion || '' };
      } else {
        nuevasRespuestas.push({ aspecto_id, respuesta, observacion: observacion || '' });
      }
      return { auditoriaEnCurso: { ...state.auditoriaEnCurso, respuestas: nuevasRespuestas } };
    }),

  agregarObservacion: (obs: ObservacionObrador) =>
    set((state) => ({
      auditoriaEnCurso: {
        ...state.auditoriaEnCurso,
        observaciones: [...state.auditoriaEnCurso.observaciones, obs],
      },
    })),

  eliminarObservacion: (index: number) =>
    set((state) => ({
      auditoriaEnCurso: {
        ...state.auditoriaEnCurso,
        observaciones: state.auditoriaEnCurso.observaciones.filter((_, i) => i !== index),
      },
    })),

  agregarEvidencia: (evidencia: EvidenciaObrador) =>
    set((state) => ({
      auditoriaEnCurso: {
        ...state.auditoriaEnCurso,
        evidencias: [...state.auditoriaEnCurso.evidencias, evidencia],
      },
    })),

  eliminarEvidencia: (index: number) =>
    set((state) => ({
      auditoriaEnCurso: {
        ...state.auditoriaEnCurso,
        evidencias: state.auditoriaEnCurso.evidencias.filter((_, i) => i !== index),
      },
    })),

  actualizarObservacionesGenerales: (texto: string) =>
    set((state) => ({
      auditoriaEnCurso: { ...state.auditoriaEnCurso, observaciones_generales: texto },
    })),

  limpiarAuditoria: () =>
    set({
      auditoriaEnCurso: {
        obrador_id: null,
        fecha_auditoria: new Date().toISOString().split('T')[0],
        respuestas: [],
        observaciones: [],
        evidencias: [],
        observaciones_generales: '',
      },
    }),
}));
```

---

## 4. COMPONENTES FRONTEND

### 4.1 Selector tipo-local en "Nueva Auditoría"
Modificar `src/pages/NuevaAuditoria.tsx` para agregar radio/selector:

```
[Radio] Auditoría de Calidad (Local)
[Radio] Auditoría de Obrador ← NUEVA
[Radio] Evaluación de Seguridad Alimentaria

(El flujo continúa según selección)
```

Si elige "Auditoría de Obrador":
- Selector de Obrador (Plancha/Salsa, Pastelería, Panadería)
- Fecha (prefillada hoy)
- Botón "Iniciar auditoría" → redirige a `/auditoria-obrador/:obradorId/nueva`

### 4.2 Formulario de Auditoría Obrador (`src/pages/AuditoriaObrador.tsx`)

Estructura:
```
┌─────────────────────────────────────────────┐
│ AUDITORÍA: Obrador Plancha y Salsa        │
│ Fecha: 2026-08-15                         │
├─────────────────────────────────────────────┤
│                                            │
│ ASPECTO 1: Limpieza de zona               │
│   ☐ Sí (4 puntos)                         │
│   ☐ Masomenos (2 puntos)                  │
│   ☐ No (0 puntos)                         │
│   📝 Observación: _______________          │
│   🖼️ Evidencia: [Subir foto]              │
│                                            │
│ [Agregar observación con severidad]      │
│   Descripción: __________                  │
│   Severidad: [LEVE/MEDIA/GRAVE/EXTREMA]   │
│   (si EXTREMA) Modo: [PESO / PORCENTAJE]  │
│                                            │
│ [Repetir para Aspecto 2-5]                │
│                                            │
│ Observaciones generales: ____________     │
│                                            │
│ [GUARDAR] [CANCELAR]                      │
└─────────────────────────────────────────────┘
```

Lógica:
- Cargar config de aspectos desde Supabase
- Usar `useObradorStore` para mantener estado
- Calcular nota en tiempo real usando `calcularNotaObrador()`
- Mostrar nota actualizada debajo de cada cambio
- Upload de fotos → bucket `au-evidencias` (comprimidas como en Locales)
- Guardar con transacción (cabecera + aspectos + observaciones + evidencias)

### 4.3 Vistas de Resultado

#### A. "Resultado General" (agregado a inicio)
Agregar sección:
```
OBRADORES
┌─────────────────────────────────────────────┐
│ Última auditoría cada obrador (nota 0-20) │
│                                            │
│ Obrador Plancha y Salsa    [16.5] 🟢      │
│ Obrador Pastelería         [14.2] 🟡      │
│ Obrador Panadería          [18.0] 🟢      │
└─────────────────────────────────────────────┘
```

Colores: Verde ≥ 17, Amarillo 13-16, Rojo < 13 (ajustar según criterio).

#### B. "Mis Auditorías" — pestaña OBRADORES
Adicionar pestaña separada:
```
OBRADORES
┌─────────────────────────────────────────────────┐
│ Fecha    | Obrador              | Nota | Acciones│
├──────────┼──────────────────────┼──────┼─────────┤
│ 2026-08-15 | Plancha y Salsa    │ 16.5 | 📄 📊   │
│ 2026-08-10 | Pastelería        │ 14.2 | 📄 📊   │
└─────────────────────────────────────────────────┘
```

- Botón PDF: exportar auditoría con desglose (igual a Locales)
- Botón Excel: formato largo (una fila por aspecto/observación)
- Edición: click en fila abre formulario con datos precargados

#### C. "Acciones de Mejora" — filtro por Obrador
Agregar columna "Tipo" (Local | Obrador) o pestaña separada.
- Ver observaciones de Obradores
- Registrar acción correctiva, fecha evaluación, "Resuelto"

#### D. "Calendario de Visitas" — separado
Pestaña "Visitas Obradores":
- Tabla de próximas visitas por obrador
- Export `.ics` igual a Locales

### 4.4 Configuración
Sección "Config → Severidad (Obradores)":
- Tabla editable de pesos de LEVE/MEDIA/GRAVE/EXTREMA
- Pre-poblada con defaults pero editable

---

## 5. ENDPOINTS/QUERIES SUPABASE (Patrón existente)

Usar `supabase` client desde `src/lib/supabaseClient.ts`. Ejemplos:

```typescript
// Obtener obradores activos
const { data: obradores } = await supabase
  .from('au_obradores')
  .select('*')
  .eq('activo', true)
  .order('nombre');

// Obtener config de aspectos
const { data: aspectos } = await supabase
  .from('au_config_obrador_aspectos')
  .select('*')
  .eq('activo', true)
  .order('orden');

// Guardar auditoría (transacción)
const { data: auditoria } = await supabase
  .from('au_auditoria_obrador')
  .insert([{
    obrador_id,
    auditor_id,
    fecha_auditoria,
    nota_final,
    observaciones_generales,
  }])
  .select()
  .single();

// Insertar aspectos
await supabase
  .from('au_auditoria_obrador_aspectos')
  .insert(respuestas.map(r => ({ auditoria_id: auditoria.id, ...r })));

// Insertar observaciones con severidad
await supabase
  .from('au_auditoria_obrador_observaciones')
  .insert(observaciones.map(o => ({ auditoria_id: auditoria.id, ...o })));

// Guardar evidencias
await supabase
  .from('au_auditoria_obrador_evidencias')
  .insert(evidencias.map(e => ({ auditoria_id: auditoria.id, ...e })));
```

---

## 6. CONVENCIONES INAMOVIBLES

- ✅ Todas las tablas nuevas llevan prefijo `au_` (au_obradores, au_auditoria_obrador, etc.)
- ✅ Prohibido tocar tablas `vc_*` (sistema de pagos)
- ✅ Lógica de cálculo SOLO en `src/lib/calculoObrador.ts` (nunca en componentes)
- ✅ Queries > 1000 filas usan `.range(0, 9999)`
- ✅ Migraciones SQL generadas en archivo, NO ejecutadas por Claude Code
- ✅ RLS permisiva en anon key, autorización en frontend por rol (AUDITOR, DIRECTOR, ADMIN)
- ✅ Estructura paralela a Seguridad Alimentaria (módulo independiente, sin interferencia)

---

## 7. PLAN DE ENTREGAS SUGERIDO

### **TANDA 1 (Base):**
- Migraciones SQL (archivo)
- Store Zustand (obradorStore.ts)
- Lógica de cálculo (calculoObrador.ts)
- Selector tipo-local en "Nueva Auditoría"
- Componente formulario básico (5 aspectos, respuestas, observaciones, evidencias)
- Guardar auditoría

**Entregable:** Usuario puede crear auditoría de obrador completa de principio a fin.

### **TANDA 2 (Vistas):**
- Resultado General (agregar sección Obradores)
- Mis Auditorías (pestaña Obradores)
- PDF export
- Excel export

**Entregable:** Usuario ve historial y exporta auditorías.

### **TANDA 3 (Flujo completo):**
- Acciones de Mejora (filtro Obradores)
- Calendario Visitas (separado)
- Config Severidad (Obradores)
- Edición de auditorías existentes

**Entregable:** Sistema completo, todos los roles pueden operar.

---

## 8. TESTING FUNCIONAL (Post-Delivery)

Después de cada tanda, validar:
- ✅ Crear auditoría Obrador: todos 5 aspectos, 3 opciones c/u
- ✅ Agregar observaciones con severidad
- ✅ Calcular nota correctamente (Opción 2, pesos diferenciados)
- ✅ Upload de fotos (comprimidas)
- ✅ Guardar en BD sin errores
- ✅ Ver auditoría en historial
- ✅ Exportar PDF con desglose
- ✅ Exportar Excel (formato largo)
- ✅ Crear acción de mejora desde observación
- ✅ Roles correctos (AUDITOR puede crear, DIRECTOR solo ve, ADMIN ve todo)

---

## 9. NOTAS FINALES

- **NO hardcodear criterios de color (verde/amarillo/rojo)** → guardar en config si es necesario
- **Mantener coherencia UI/UX** con el resto del sistema (Tailwind, colores, iconografía)
- **Validación en cliente** antes de guardar (p.ej. todos aspectos completados)
- **Error handling** limpio (mostrar toast si falla Supabase)
- **Revalidar** después de cada insert/update (refetch datos si es necesario)

---

**¿Listo? Copia este prompt completo a Claude Code y comparte el resultado en cada tanda.**
