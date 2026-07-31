import type { EstadoPunto, EstadoCualitativo } from '../types'

export interface PuntoSA {
  key:              string
  nombre:           string
  /** Permite registrar personas (texto libre) cuando el punto se marca NO_CUMPLE. */
  permitePersonas:  boolean
  /** Solo el punto de accesorios: además del nombre, se registra qué accesorio. */
  permiteAccesorio: boolean
}

export interface SeccionSA {
  key:    string
  nombre: string
  puntos: PuntoSA[]
}

function punto(key: string, nombre: string, permitePersonas = false, permiteAccesorio = false): PuntoSA {
  return { key, nombre, permitePersonas, permiteAccesorio }
}

/* ══════════════════════════════════════════════════════════════════════════
   Catálogo FIJO: 8 secciones, no configurable. Las keys son estables y se
   guardan como snapshot (junto al nombre) en au_sa_respuestas, así que no
   deben renombrarse una vez usadas en producción.
══════════════════════════════════════════════════════════════════════════ */
export const CATALOGO_SA: SeccionSA[] = [
  {
    key: 'higiene_indumentaria',
    nombre: 'Higiene e indumentaria del personal',
    puntos: [
      punto('higiene_cofia', 'Uso de cofia/gorro', true),
      punto('higiene_accesorios', 'Sin accesorios personales (collares, pulseras, brazaletes, anillos)', true, true),
      punto('higiene_lockers', 'Lockers personales limpios y ordenados', true),
    ],
  },
  {
    key: 'higiene_vestuarios',
    nombre: 'Higiene del personal y vestuarios',
    puntos: [
      punto('vestuarios_insumos_lavado', 'Disponibilidad de insumos de lavado (dosificador de jabón + papel de un solo uso en lavamanos)', true),
      punto('vestuarios_agua_caliente', 'Agua caliente sanitaria (lavamanos de cocina, barra y servicios)'),
      punto('vestuarios_orden_limpieza', 'Orden y limpieza en vestuarios', true),
    ],
  },
  {
    key: 'residuos_instalaciones',
    nombre: 'Manejo de residuos e instalaciones higiénicas',
    puntos: [
      punto('residuos_cubos_basura', 'Cubos de basura operativos (tapa + pedal funcional)'),
      punto('residuos_accionamiento_higienico', 'Accionamiento higiénico en lavamanos (grifería no manual)'),
    ],
  },
  {
    key: 'mantenimiento_infraestructura',
    nombre: 'Mantenimiento de infraestructuras y equipos',
    puntos: [
      punto('mantenimiento_suelos_paredes', 'Estado de suelos y paredes (lisos, lavables, sin agujeros/grietas)'),
      punto('mantenimiento_desagues', 'Desagües en regla (rejilla + sifón)'),
      punto('mantenimiento_frio', 'Mantenimiento y limpieza de frío (cámaras y evaporadores sin hongos)'),
    ],
  },
  {
    key: 'almacenamiento_rotulacion',
    nombre: 'Almacenamiento y rotulación de alimentos',
    puntos: [
      punto('almacenamiento_aislamiento_suelo', 'Aislamiento del suelo (nada de alimentos en el suelo)'),
      punto('almacenamiento_etiquetado', 'Etiquetado e identificación (nombre, fecha de apertura/fraccionamiento, caducidad)'),
      punto('almacenamiento_proteccion', 'Protección de alimentos (recipientes cerrados o film, no trapos/bolsas de basura)'),
      punto('almacenamiento_trazabilidad', 'Trazabilidad de productos'),
    ],
  },
  {
    key: 'manipulacion_descongelacion',
    nombre: 'Prácticas de manipulación y descongelación',
    puntos: [
      punto('manipulacion_descongelacion_proceso', 'Proceso de descongelación higiénico (en refrigeración, con rejilla)'),
      punto('manipulacion_apilado', 'Apilado y manipulación segura (recipientes tapados, sin contacto con alimento de abajo)'),
    ],
  },
  {
    key: 'almacen_limpieza',
    nombre: 'Almacén y productos de limpieza',
    puntos: [
      punto('almacen_quimicos', 'Almacenamiento de químicos (en su armario, separados de alimentos)'),
      punto('almacen_orden_general', 'Orden general de instalaciones (sin objetos ajenos/en desuso)'),
    ],
  },
  {
    key: 'documentacion_appcc',
    nombre: 'Documentación y planes de autocontrol (APPCC)',
    puntos: [
      punto('appcc_plan_limpieza', 'Plan de Limpieza y Mantenimiento (actualizado e implementado)'),
      punto('appcc_plan_temperaturas', 'Plan de Control de Temperaturas (registros diarios)'),
      punto('appcc_info_alergenos', 'Información de Alérgenos (fichas con todos los alérgenos)'),
    ],
  },
]

export interface RespuestaSA {
  puntoKey: string
  estado:   EstadoPunto
}

/**
 * Estado de una sección según el nº de puntos aplicables en NO_CUMPLE
 * (los NO_APLICA se ignoran): 0 → CORRECTO, 1-2 → MEJORA, 3+ → DEFICIENTE.
 */
export function calcularEstadoSeccion(respuestas: RespuestaSA[]): EstadoCualitativo {
  const noCumplen = respuestas.filter(r => r.estado === 'NO_CUMPLE').length
  if (noCumplen === 0) return 'CORRECTO'
  if (noCumplen <= 2) return 'MEJORA'
  return 'DEFICIENTE'
}

/** Estado global: alguna sección DEFICIENTE manda; si no, alguna MEJORA manda; si no, CORRECTO. */
export function calcularEstadoGlobal(estadosSecciones: EstadoCualitativo[]): EstadoCualitativo {
  if (estadosSecciones.some(e => e === 'DEFICIENTE')) return 'DEFICIENTE'
  if (estadosSecciones.some(e => e === 'MEJORA')) return 'MEJORA'
  return 'CORRECTO'
}
