import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import type { AuSaEvaluacion, AuSaRespuesta, AuSaPersona, EstadoCualitativo, EstadoPunto } from '../../types'
import { CATALOGO_SA, calcularEstadoSeccion } from '../../lib/seguridadAlimentaria'

const ESTADO_BADGE: Record<EstadoCualitativo, string> = {
  CORRECTO:   'bg-green-100 text-green-700',
  MEJORA:     'bg-ambar/15 text-ambar',
  DEFICIENTE: 'bg-terranova/10 text-terranova',
}
const ESTADO_DOT: Record<EstadoCualitativo, string> = {
  CORRECTO:   'bg-green-500',
  MEJORA:     'bg-ambar',
  DEFICIENTE: 'bg-terranova',
}
const ESTADO_LABEL: Record<EstadoCualitativo, string> = {
  CORRECTO:   'Correcto',
  MEJORA:     'Mejora',
  DEFICIENTE: 'Deficiente',
}
const PUNTO_BADGE: Record<EstadoPunto, string> = {
  CUMPLE:    'bg-green-100 text-green-700',
  NO_CUMPLE: 'bg-terranova/10 text-terranova',
  NO_APLICA: 'bg-navy/10 text-navy/40',
}
const PUNTO_LABEL: Record<EstadoPunto, string> = {
  CUMPLE:    'Cumple',
  NO_CUMPLE: 'No cumple',
  NO_APLICA: 'N/A',
}

// Orden de despliegue: el del catálogo actual. Los nombres mostrados vienen
// del snapshot guardado en cada respuesta, no del catálogo en vivo.
const ORDEN_PUNTOS: string[] = CATALOGO_SA.flatMap(s => s.puntos.map(p => p.key))

interface Props {
  evaluacion:  AuSaEvaluacion
  localNombre: string
  onClose:     () => void
}

export default function DetalleEvaluacionSA({ evaluacion, localNombre, onClose }: Props) {
  const [loading,     setLoading]     = useState(true)
  const [respuestas,  setRespuestas]  = useState<AuSaRespuesta[]>([])
  const [personasMap, setPersonasMap] = useState<Record<string, AuSaPersona[]>>({})

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: resp } = await supabase
        .from('au_sa_respuestas').select('*').eq('evaluacion_id', evaluacion.id).range(0, 9999)

      const respList = (resp ?? []).slice().sort((a, b) => {
        const ia = ORDEN_PUNTOS.indexOf(a.punto_key)
        const ib = ORDEN_PUNTOS.indexOf(b.punto_key)
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
      })
      setRespuestas(respList)

      const ids = respList.map(r => r.id)
      if (ids.length > 0) {
        const { data: pers } = await supabase
          .from('au_sa_personas').select('*').in('respuesta_id', ids).range(0, 9999)
        const map: Record<string, AuSaPersona[]> = {}
        ;(pers ?? []).forEach(p => {
          if (!map[p.respuesta_id]) map[p.respuesta_id] = []
          map[p.respuesta_id].push(p)
        })
        setPersonasMap(map)
      } else {
        setPersonasMap({})
      }
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evaluacion.id])

  const grupos: { seccionKey: string; seccionNombre: string; rows: AuSaRespuesta[] }[] = []
  respuestas.forEach(r => {
    let g = grupos.find(x => x.seccionKey === r.seccion_key)
    if (!g) { g = { seccionKey: r.seccion_key, seccionNombre: r.seccion_nombre, rows: [] }; grupos.push(g) }
    g.rows.push(r)
  })

  const fechaLabel = (() => {
    try {
      return new Date(evaluacion.fecha + 'T12:00:00').toLocaleDateString('es-ES', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      })
    } catch { return evaluacion.fecha }
  })()

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 overflow-y-auto"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="min-h-full flex items-start justify-center p-4 sm:py-8">
        <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>

          {/* ── Cabecera ─────────────────────────────────────────── */}
          <div className="px-6 pt-6 pb-4 border-b border-navy/10">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-navy" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  {localNombre}
                </h2>
                <p className="text-sm text-navy/50 mt-0.5 capitalize">{fechaLabel}</p>
                <p className="text-xs text-navy/35 font-mono mt-1">Auditor: {evaluacion.auditor_cut}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex-shrink-0 w-8 h-8 rounded-full bg-navy/10 text-navy/50
                           hover:bg-navy/20 hover:text-navy transition flex items-center justify-center text-sm"
              >
                ✕
              </button>
            </div>
            {evaluacion.estado_global && (
              <span className={`inline-flex items-center gap-1.5 mt-3 text-xs font-bold px-2.5 py-1 rounded-lg ${ESTADO_BADGE[evaluacion.estado_global]}`}>
                <span className={`w-2 h-2 rounded-full ${ESTADO_DOT[evaluacion.estado_global]}`} />
                {ESTADO_LABEL[evaluacion.estado_global]}
              </span>
            )}
          </div>

          {/* ── Body ─────────────────────────────────────────────── */}
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin w-6 h-6 rounded-full border-4 border-naranja border-t-transparent" />
            </div>
          ) : (
            <div className="p-6 space-y-4">
              {grupos.map(g => {
                const estadoSeccion = calcularEstadoSeccion(g.rows.map(r => ({ puntoKey: r.punto_key, estado: r.estado })))
                return (
                  <div key={g.seccionKey} className="rounded-2xl border-2 border-navy/20 bg-navy/5 p-5">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-navy" />
                        <h3 className="text-sm font-bold text-navy uppercase tracking-wide">{g.seccionNombre}</h3>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${ESTADO_BADGE[estadoSeccion]}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${ESTADO_DOT[estadoSeccion]}`} />
                        {ESTADO_LABEL[estadoSeccion]}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {g.rows.map(r => (
                        <div key={r.id} className="bg-white rounded-xl px-3.5 py-2.5">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm text-navy/80 flex-1">{r.punto_nombre}</p>
                            <span className={`flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${PUNTO_BADGE[r.estado]}`}>
                              {PUNTO_LABEL[r.estado]}
                            </span>
                          </div>
                          {(personasMap[r.id]?.length ?? 0) > 0 && (
                            <div className="mt-2 pt-2 border-t border-navy/10 space-y-1">
                              {personasMap[r.id].map(p => (
                                <p key={p.id} className="text-xs text-navy/55">
                                  · {p.nombre}
                                  {p.accesorio ? <span className="text-navy/35"> — {p.accesorio}</span> : null}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
