import type { Area, Severidad } from '../types'

const AREA_MAX = 20 / 3  // 6.6̄ puntos por área

export interface ItemProducto {
  contiene: boolean
}

export interface ItemServicio {
  fid_speech:              boolean | null
  fid_nombre_camarero:     boolean | null
  ups_bebidas:             boolean | null
  ups_meta_dia:            boolean | null
  pres_uniformes:          boolean | null
  pres_cabellos:           boolean | null
  pres_unas:               boolean | null
  pres_zapatos:            boolean | null
  pres_barba_o_maquillaje: boolean | null
  tiempo_entrante_ok:      boolean | null
  tiempo_principal_ok:     boolean | null
  tiempo_bebida_ok:        boolean | null
  tiempo_postre_ok:        boolean | null
}

export interface ItemLocal {
  cart_actualizada: boolean | null
  cart_completa:    boolean | null
  limp_sala:        boolean | null
  limp_banos:       boolean | null
  limp_barras:      boolean | null
}

export interface ObservacionCalculo {
  area:      Area
  severidad: Severidad
}

export type ConfigSeveridad = Record<Severidad, number>

const DEFAULT_CONFIG: ConfigSeveridad = {
  NINGUNA: 0,
  LEVE:    0.25,
  MEDIA:   0.50,
  GRAVE:   1.00,
}

function descuento(
  obs:    ObservacionCalculo[],
  area:   Area,
  config: ConfigSeveridad = DEFAULT_CONFIG,
): number {
  return obs
    .filter(o => o.area === area)
    .reduce((sum, o) => sum + (config[o.severidad] ?? 0), 0)
}

export function calcularNotaProducto(
  items:  ItemProducto[],
  obs:    ObservacionCalculo[],
  config?: ConfigSeveridad,
): number {
  const marcadas = items.reduce((s, i) => s + (i.contiene ? 1 : 0), 0)
  const total = items.length
  // Sin platos evaluados → nota plena 6.67 (comportamiento confirmado)
  const base = total === 0 ? AREA_MAX : (marcadas / total) * AREA_MAX

  return Math.max(0, base - descuento(obs, 'PRODUCTO', config))
}

const SERVICIO_CAMPOS: (keyof ItemServicio)[] = [
  'fid_speech', 'fid_nombre_camarero',
  'ups_bebidas', 'ups_meta_dia',
  'pres_uniformes', 'pres_cabellos', 'pres_unas', 'pres_zapatos', 'pres_barba_o_maquillaje',
  'tiempo_entrante_ok', 'tiempo_principal_ok', 'tiempo_bebida_ok', 'tiempo_postre_ok',
]  // 13 ítems

export function calcularNotaServicio(
  srv:    Partial<ItemServicio>,
  obs:    ObservacionCalculo[],
  config?: ConfigSeveridad,
): number {
  const trues = SERVICIO_CAMPOS.filter(k => srv[k] === true).length
  const base  = (trues / 13) * AREA_MAX
  return Math.max(0, base - descuento(obs, 'SERVICIO', config))
}

const LOCAL_CAMPOS: (keyof ItemLocal)[] = [
  'cart_actualizada', 'cart_completa', 'limp_sala', 'limp_banos', 'limp_barras',
]  // 5 ítems

export function calcularNotaLocal(
  local:  Partial<ItemLocal>,
  obs:    ObservacionCalculo[],
  config?: ConfigSeveridad,
): number {
  const trues = LOCAL_CAMPOS.filter(k => local[k] === true).length
  const base  = (trues / 5) * AREA_MAX
  return Math.max(0, base - descuento(obs, 'LOCAL', config))
}

export function calcularNotaTotal(
  notaProducto: number,
  notaServicio: number,
  notaLocal:    number,
): number {
  return Math.round((notaProducto + notaServicio + notaLocal) * 100) / 100
}
