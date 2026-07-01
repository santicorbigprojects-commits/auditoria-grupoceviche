import type { Area, Severidad, ExtremaModo, AspectoRI } from '../types'

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
  area:          Area
  severidad:     Severidad
  extrema_modo?: ExtremaModo | null
}

export type ConfigSeveridad = Record<Severidad, number>

const DEFAULT_CONFIG: ConfigSeveridad = {
  NINGUNA: 0,
  LEVE:    0.25,
  MEDIA:   0.50,
  GRAVE:   1.00,
  EXTREMA: 2.00,
}

/* ══════════════════════════════════════════════════════════════════════════
   Áreas 1-3 (Producto, Servicio, Local)

   Orden de cálculo por área (NO alterar el orden):
     1. Nota base por los checks (marcadas/total * AREA_MAX).
     2. Restar la suma de pesos fijos de las observaciones: Leve/Media/Grave
        MÁS las Extremadamente grave que estén en modo "PESO".
        (Las Extremadamente grave en modo "PORCENTAJE" NO restan peso fijo aquí,
        su efecto se aplica en el paso 3.)
     3. Si hay AL MENOS UNA observación Extremadamente grave en modo "PORCENTAJE"
        en esta área → multiplicar el resultado por 0.5. Es un tope, no acumulable:
        aunque haya varias observaciones en modo porcentaje, se aplica una sola vez.
     4. Piso en 0.

   El "doble castigo" (un check en falso baja la nota base Y además una observación
   resta encima) es intencional y se mantiene: no se compensa entre sí.
══════════════════════════════════════════════════════════════════════════ */

/** ¿Hay al menos una observación EXTREMA en modo PORCENTAJE en esta área? (paso 3) */
export function huboReduccion50PorExtrema(obs: ObservacionCalculo[], area: Area): boolean {
  return obs.some(o => o.area === area && o.severidad === 'EXTREMA' && o.extrema_modo === 'PORCENTAJE')
}

function aplicarDescuentosArea(
  base:   number,
  obs:    ObservacionCalculo[],
  area:   Area,
  config: ConfigSeveridad,
): number {
  const obsArea = obs.filter(o => o.area === area)

  // Paso 2: suma de pesos fijos (EXTREMA en modo PORCENTAJE no aporta peso fijo aquí)
  const descuentoFijo = obsArea.reduce((sum, o) => {
    if (o.severidad === 'EXTREMA' && o.extrema_modo === 'PORCENTAJE') return sum
    return sum + (config[o.severidad] ?? 0)
  }, 0)

  // Paso 3: ¿alguna EXTREMA en modo PORCENTAJE en esta área?
  const reducirAlCincuentaPorciento = huboReduccion50PorExtrema(obs, area)

  let resultado = base - descuentoFijo
  if (reducirAlCincuentaPorciento) resultado *= 0.5

  // Paso 4: piso en 0
  return Math.max(0, resultado)
}

export function calcularNotaProducto(
  items:  ItemProducto[],
  obs:    ObservacionCalculo[],
  config: ConfigSeveridad = DEFAULT_CONFIG,
): number {
  const marcadas = items.reduce((s, i) => s + (i.contiene ? 1 : 0), 0)
  const total = items.length
  // Sin platos evaluados → nota plena 6.67 (comportamiento confirmado)
  const base = total === 0 ? AREA_MAX : (marcadas / total) * AREA_MAX

  return aplicarDescuentosArea(base, obs, 'PRODUCTO', config)
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
  config: ConfigSeveridad = DEFAULT_CONFIG,
): number {
  const trues = SERVICIO_CAMPOS.filter(k => srv[k] === true).length
  const base  = (trues / 13) * AREA_MAX
  return aplicarDescuentosArea(base, obs, 'SERVICIO', config)
}

const LOCAL_CAMPOS: (keyof ItemLocal)[] = [
  'cart_actualizada', 'cart_completa', 'limp_sala', 'limp_banos', 'limp_barras',
]  // 5 ítems

export function calcularNotaLocal(
  local:  Partial<ItemLocal>,
  obs:    ObservacionCalculo[],
  config: ConfigSeveridad = DEFAULT_CONFIG,
): number {
  const trues = LOCAL_CAMPOS.filter(k => local[k] === true).length
  const base  = (trues / 5) * AREA_MAX
  return aplicarDescuentosArea(base, obs, 'LOCAL', config)
}

/* ══════════════════════════════════════════════════════════════════════════
   Apartado 4 — Revisión Interna (NO suma, solo resta del total)

   Tres aspectos: RI_REVISION, RI_ROTULACION, RI_HIGIENE. Cada uno tiene un
   descuento máximo configurable (tope). Aquí la severidad EXTREMA NO tiene
   elección de modo: siempre usa su peso fijo configurado (igual que
   Leve/Media/Grave).

   Por aspecto: sumar el peso fijo de sus observaciones, topar la suma al
   max_descuento configurado de ese aspecto.
   descuento_revision_interna = suma de los 3 topes.
══════════════════════════════════════════════════════════════════════════ */

const ASPECTOS_RI: AspectoRI[] = ['RI_REVISION', 'RI_ROTULACION', 'RI_HIGIENE']

export interface ObservacionRI {
  aspecto:   AspectoRI
  severidad: Severidad
}

export type ConfigRI = Record<AspectoRI, number>  // max_descuento por aspecto

export interface DescuentoRIAspecto {
  aspecto:   AspectoRI
  descuento: number  // ya topado al max_descuento del aspecto
}

/** Desglose del descuento de Revisión Interna, un valor (ya topado) por cada aspecto. */
export function calcularDescuentoRevisionInternaPorAspecto(
  obs:        ObservacionRI[],
  configRI:   ConfigRI,
  configSev:  ConfigSeveridad = DEFAULT_CONFIG,
): DescuentoRIAspecto[] {
  return ASPECTOS_RI.map(aspecto => {
    const sumaAspecto = obs
      .filter(o => o.aspecto === aspecto)
      .reduce((s, o) => s + (configSev[o.severidad] ?? 0), 0)
    const tope = configRI[aspecto] ?? Infinity
    return { aspecto, descuento: Math.min(sumaAspecto, tope) }
  })
}

export function calcularDescuentoRevisionInterna(
  obs:        ObservacionRI[],
  configRI:   ConfigRI,
  configSev:  ConfigSeveridad = DEFAULT_CONFIG,
): number {
  return calcularDescuentoRevisionInternaPorAspecto(obs, configRI, configSev)
    .reduce((total, d) => total + d.descuento, 0)
}

/* ══════════════════════════════════════════════════════════════════════════
   Total
   total = max(0, (nota_producto + nota_servicio + nota_local) - descuento_ri)
   (nota_producto/servicio/local ya incluyen sus propios descuentos y el
   posible 50% de reducción por área.)
══════════════════════════════════════════════════════════════════════════ */

export function calcularNotaTotal(
  notaProducto: number,
  notaServicio: number,
  notaLocal:    number,
  descuentoRI:  number = 0,
): number {
  const total = Math.max(0, notaProducto + notaServicio + notaLocal - descuentoRI)
  return Math.round(total * 100) / 100
}
