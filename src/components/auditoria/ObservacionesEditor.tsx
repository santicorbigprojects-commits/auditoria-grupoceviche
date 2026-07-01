import type { Area, AspectoRI, Severidad, ExtremaModo } from '../../types'
import { useAuditoriaStore } from '../../store/auditoriaStore'

const SEVERIDADES: Severidad[] = ['NINGUNA', 'LEVE', 'MEDIA', 'GRAVE', 'EXTREMA']

const SEV_STYLE: Record<Severidad, string> = {
  NINGUNA: 'bg-navy/10 text-navy/50',
  LEVE:    'bg-ambar/20 text-ambar',
  MEDIA:   'bg-naranja/20 text-naranja',
  GRAVE:   'bg-terranova/20 text-terranova',
  EXTREMA: 'bg-marron/20 text-marron',
}

function esAreaPrincipal(area: Area | AspectoRI): area is Area {
  return area === 'PRODUCTO' || area === 'SERVICIO' || area === 'LOCAL'
}

interface Props {
  area: Area | AspectoRI
}

export default function ObservacionesEditor({ area }: Props) {
  const { observaciones, addObservacion, updateObservacion, removeObservacion } = useAuditoriaStore()
  const obs = observaciones.filter(o => o.area === area)
  const permiteModoDual = esAreaPrincipal(area)

  return (
    <div className="mt-5 pt-4 border-t border-navy/10">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-navy/40 uppercase tracking-wide">
          Observaciones
        </span>
        <button
          type="button"
          onClick={() => addObservacion({ area, texto: '', severidad: 'LEVE' })}
          className="flex items-center gap-1 text-xs font-semibold text-naranja hover:text-terranova transition"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Agregar
        </button>
      </div>

      {obs.length === 0 && (
        <p className="text-xs text-navy/25 italic">Sin observaciones registradas para esta área.</p>
      )}

      <div className="space-y-2">
        {obs.map(o => {
          const mostrarModoDual = permiteModoDual && o.severidad === 'EXTREMA'
          return (
            <div key={o.id} className="space-y-1.5">
              <div className="flex gap-2 items-start">
                <textarea
                  value={o.texto}
                  onChange={e => updateObservacion(o.id, { texto: e.target.value })}
                  placeholder="Describe la observación…"
                  rows={2}
                  className="flex-1 text-sm px-3 py-2 rounded-xl border border-navy/15 bg-white resize-none
                             text-navy placeholder:text-navy/25
                             focus:outline-none focus:ring-2 focus:ring-naranja/30 focus:border-naranja transition"
                />
                <select
                  value={o.severidad}
                  onChange={e => {
                    const severidad = e.target.value as Severidad
                    const esExtremaDual = permiteModoDual && severidad === 'EXTREMA'
                    updateObservacion(o.id, {
                      severidad,
                      extrema_modo: esExtremaDual ? (o.extrema_modo ?? 'PESO') : null,
                    })
                  }}
                  className={`text-xs font-semibold px-2 py-1.5 rounded-lg cursor-pointer border-0
                              focus:outline-none focus:ring-2 focus:ring-naranja/30 ${SEV_STYLE[o.severidad]}`}
                >
                  {SEVERIDADES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => removeObservacion(o.id)}
                  className="p-1.5 rounded-lg text-navy/30 hover:text-terranova hover:bg-terranova/10 transition mt-0.5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {mostrarModoDual && (
                <div className="flex items-center gap-2 pl-1">
                  <span className="text-[10px] font-semibold text-navy/40 uppercase tracking-wide">
                    Extremadamente grave:
                  </span>
                  <select
                    value={o.extrema_modo ?? 'PESO'}
                    onChange={e => updateObservacion(o.id, { extrema_modo: e.target.value as ExtremaModo })}
                    className="text-xs font-medium px-2 py-1 rounded-lg border border-marron/30 bg-marron/10
                               text-marron cursor-pointer focus:outline-none focus:ring-2 focus:ring-marron/30"
                  >
                    <option value="PESO">Restar peso fijo</option>
                    <option value="PORCENTAJE">Reducir 50% del área</option>
                  </select>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
