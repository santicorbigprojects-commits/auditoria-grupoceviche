import type { AspectoRI } from '../../types'
import { useAuditoriaStore } from '../../store/auditoriaStore'
import ObservacionesEditor from './ObservacionesEditor'
import EvidenciasUploader from './EvidenciasUploader'

const ASPECTOS: { key: AspectoRI; titulo: string }[] = [
  { key: 'RI_REVISION',   titulo: 'Revisión de productos' },
  { key: 'RI_ROTULACION', titulo: 'Rotulación de productos' },
  { key: 'RI_HIGIENE',    titulo: 'Higiene de cocina' },
]

export default function SeccionRevisionInterna() {
  const { riConforme, setRiConforme, riComentario, setRiComentario } = useAuditoriaStore()

  return (
    <div className="rounded-2xl border-2 border-marron/30 bg-marron/5 p-5 mb-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-2.5 h-2.5 rounded-full bg-marron" />
        <h3 className="text-sm font-bold text-navy uppercase tracking-wide">Revisión interna</h3>
      </div>

      {ASPECTOS.map(aspecto => (
        <div key={aspecto.key} className="mb-5 last:mb-0 pb-5 last:pb-0 border-b last:border-b-0 border-marron/15">
          <p className="text-xs font-semibold text-navy/50 uppercase tracking-wide mb-2">
            {aspecto.titulo}
          </p>

          <button
            type="button"
            onClick={() => setRiConforme(aspecto.key, !riConforme[aspecto.key])}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-left border transition ${
              riConforme[aspecto.key]
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-white border-navy/15 text-navy/60 hover:border-navy/30'
            }`}
          >
            <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
              riConforme[aspecto.key] ? 'bg-green-500 text-white' : 'border-2 border-navy/20'
            }`}>
              {riConforme[aspecto.key] && (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </span>
            Conforme
          </button>

          <ObservacionesEditor area={aspecto.key} />

          <div className="mt-4 pt-4 border-t border-navy/10">
            <p className="text-xs font-semibold text-navy/40 uppercase tracking-wide mb-2">
              Comentarios
            </p>
            <textarea
              value={riComentario[aspecto.key]}
              onChange={e => setRiComentario(aspecto.key, e.target.value)}
              placeholder={`Comentarios para ${aspecto.titulo}…`}
              rows={2}
              className="w-full text-sm px-3 py-2 rounded-xl border border-navy/15 bg-white resize-none
                         text-navy placeholder:text-navy/25
                         focus:outline-none focus:ring-2 focus:ring-marron/30 focus:border-marron transition"
            />
          </div>
        </div>
      ))}

      <EvidenciasUploader area="REVISION_INTERNA" />
    </div>
  )
}
