import type { Severidad, ExtremaModo } from '../types'

const NOTA_MAXIMA = 20

export interface AspectoConfigObrador {
  id:            string
  puntos_maximo: number
}

export interface RespuestaObradorCalculo {
  aspecto_id: string
  respuesta:  0 | 1 | 2   // 0 = No, 1 = Masomenos, 2 = Sí
}

export interface ObservacionObradorCalculo {
  severidad:     Severidad
  extrema_modo?: ExtremaModo | null
}

export type ConfigSeveridadObrador = Record<Severidad, number>

const DEFAULT_CONFIG: ConfigSeveridadObrador = {
  NINGUNA: 0,
  LEVE:    0.5,
  MEDIA:   1,
  GRAVE:   2,
  EXTREMA: 4,
}

const FACTOR_RESPUESTA: Record<0 | 1 | 2, number> = { 0: 0, 1: 0.5, 2: 1 }

/* ══════════════════════════════════════════════════════════════════════════
   Auditoría de Obrador (5 aspectos con pesos diferenciados, nota 0-20)

   Orden de cálculo (mismo patrón que calculo.ts, un solo "área" para todo
   el obrador en vez de Producto/Servicio/Local):
     1. Nota base = (suma de puntos obtenidos por aspecto / suma de
        puntos_maximo de los aspectos) * 20.
        puntos obtenidos por aspecto = factor_respuesta(0/0.5/1) * puntos_maximo.
     2. Restar la suma de pesos fijos de las observaciones: Leve/Media/Grave
        MÁS las Extremadamente grave que estén en modo "PESO".
        (Las Extremadamente grave en modo "PORCENTAJE" NO restan peso fijo
        aquí, su efecto se aplica en el paso 3.)
     3. Si hay AL MENOS UNA observación Extremadamente grave en modo
        "PORCENTAJE" → multiplicar el resultado por 0.5. Es un tope, no
        acumulable: aunque haya varias, se aplica una sola vez.
     4. Piso en 0.
══════════════════════════════════════════════════════════════════════════ */

function sumaPuntosObtenidos(
  respuestas: RespuestaObradorCalculo[],
  aspectos:   AspectoConfigObrador[],
): number {
  return respuestas.reduce((sum, r) => {
    const aspecto = aspectos.find(a => a.id === r.aspecto_id)
    if (!aspecto) return sum
    return sum + FACTOR_RESPUESTA[r.respuesta] * aspecto.puntos_maximo
  }, 0)
}

/** ¿Hay al menos una observación EXTREMA en modo PORCENTAJE? (paso 3) */
export function huboReduccion50PorExtremaObrador(obs: ObservacionObradorCalculo[]): boolean {
  return obs.some(o => o.severidad === 'EXTREMA' && o.extrema_modo === 'PORCENTAJE')
}

/** Peso a restar por una observación (snapshot a guardar en peso_resta). EXTREMA en modo PORCENTAJE no resta peso fijo. */
export function pesoDeObservacionObrador(
  o:      ObservacionObradorCalculo,
  config: ConfigSeveridadObrador = DEFAULT_CONFIG,
): number {
  if (o.severidad === 'EXTREMA' && o.extrema_modo === 'PORCENTAJE') return 0
  return config[o.severidad] ?? 0
}

export function calcularNotaObrador(
  respuestas:    RespuestaObradorCalculo[],
  aspectos:      AspectoConfigObrador[],
  observaciones: ObservacionObradorCalculo[] = [],
  config:        ConfigSeveridadObrador = DEFAULT_CONFIG,
): number {
  const totalMaximo = aspectos.reduce((s, a) => s + a.puntos_maximo, 0)
  // Defensivo: sin aspectos configurados es imposible en la práctica (siempre hay 5).
  if (totalMaximo === 0) return NOTA_MAXIMA

  const base = (sumaPuntosObtenidos(respuestas, aspectos) / totalMaximo) * NOTA_MAXIMA

  const descuentoFijo = observaciones.reduce((sum, o) => sum + pesoDeObservacionObrador(o, config), 0)

  let resultado = base - descuentoFijo
  if (huboReduccion50PorExtremaObrador(observaciones)) resultado *= 0.5

  return Math.max(0, resultado)
}

/* ══════════════════════════════════════════════════════════════════════════
   Desglose (panel en vivo del formulario / export PDF)
══════════════════════════════════════════════════════════════════════════ */

export interface DetalleAspectoObrador {
  aspecto_id: string
  nombre:     string
  respuesta:  'Sí' | 'Masomenos' | 'No' | 'Sin responder'
  puntos:     number
  maximo:     number
}

export interface DesgloseObrador {
  puntosObtenidos:  number
  totalMaximo:      number
  notaBase:         number
  descuentoFijo:    number
  reducidoAl50:     boolean
  notaFinal:        number
  detalleAspectos:  DetalleAspectoObrador[]
}

const RESPUESTA_LABEL: Record<0 | 1 | 2, DetalleAspectoObrador['respuesta']> = {
  0: 'No', 1: 'Masomenos', 2: 'Sí',
}

export function calcularDesgloseObrador(
  respuestas:    RespuestaObradorCalculo[],
  aspectos:      (AspectoConfigObrador & { nombre: string })[],
  observaciones: ObservacionObradorCalculo[] = [],
  config:        ConfigSeveridadObrador = DEFAULT_CONFIG,
): DesgloseObrador {
  const totalMaximo = aspectos.reduce((s, a) => s + a.puntos_maximo, 0)

  const detalleAspectos: DetalleAspectoObrador[] = aspectos.map(a => {
    const r = respuestas.find(x => x.aspecto_id === a.id)
    const factor = r ? FACTOR_RESPUESTA[r.respuesta] : 0
    return {
      aspecto_id: a.id,
      nombre:     a.nombre,
      respuesta:  r ? RESPUESTA_LABEL[r.respuesta] : 'Sin responder',
      puntos:     factor * a.puntos_maximo,
      maximo:     a.puntos_maximo,
    }
  })

  const puntosObtenidos = detalleAspectos.reduce((s, d) => s + d.puntos, 0)
  const notaBase = totalMaximo === 0 ? NOTA_MAXIMA : (puntosObtenidos / totalMaximo) * NOTA_MAXIMA
  const descuentoFijo = observaciones.reduce((sum, o) => sum + pesoDeObservacionObrador(o, config), 0)
  const reducidoAl50 = huboReduccion50PorExtremaObrador(observaciones)

  let notaFinal = notaBase - descuentoFijo
  if (reducidoAl50) notaFinal *= 0.5
  notaFinal = Math.max(0, notaFinal)

  return { puntosObtenidos, totalMaximo, notaBase, descuentoFijo, reducidoAl50, notaFinal, detalleAspectos }
}
