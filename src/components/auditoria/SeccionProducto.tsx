import type { ReactNode } from 'react'
import type { AuPlato, AuPlatoIngrediente } from '../../types'
import { useAuditoriaStore, type ProductoItemDraft } from '../../store/auditoriaStore'
import ObservacionesEditor from './ObservacionesEditor'

export interface PlatoConIngredientes extends AuPlato {
  ingredientes: AuPlatoIngrediente[]
}

interface Props {
  platos:              PlatoConIngredientes[]
  platosSeleccionados: Set<string>
  onTogglePlato:       (platoId: string, plato: PlatoConIngredientes) => void
}

type CheckCampo = 'contiene' | 'limpieza' | 'peso_adecuado'

const CHECKS: { campo: CheckCampo; label: string }[] = [
  { campo: 'contiene',      label: 'Contiene' },
  { campo: 'limpieza',      label: 'Limpieza' },
  { campo: 'peso_adecuado', label: 'Peso adecuado' },
]

export default function SeccionProducto({ platos, platosSeleccionados, onTogglePlato }: Props) {
  const { productoItems, toggleCheck, oportunidad_producto, setOportunidad } = useAuditoriaStore()

  return (
    <Card titulo="Producto" dot="bg-naranja" border="border-naranja/30" bg="bg-naranja/5">
      {platos.length === 0 ? (
        <p className="text-sm text-navy/40 italic mb-4">
          No hay platos configurados para este local. Agrégalos desde Configuración.
        </p>
      ) : (
        <>
          {/* Selector de platos */}
          <div className="mb-5">
            <p className="text-xs font-semibold text-navy/50 uppercase tracking-wide mb-2">
              Platos a evaluar
            </p>
            <div className="flex flex-wrap gap-2">
              {platos.map(p => {
                const sel = platosSeleccionados.has(p.id)
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onTogglePlato(p.id, p)}
                    className={`text-sm px-3 py-1.5 rounded-xl border font-medium transition ${
                      sel
                        ? 'bg-naranja text-white border-naranja'
                        : 'bg-white text-navy/60 border-navy/20 hover:border-naranja hover:text-naranja'
                    }`}
                  >
                    {p.nombre}
                    {p.codigo && <span className="ml-1 text-xs opacity-60">{p.codigo}</span>}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Ingredientes por plato seleccionado */}
          {platos
            .filter(p => platosSeleccionados.has(p.id))
            .map(plato => {
              const items   = productoItems.filter(i => i.plato_id === plato.id)
              const marcadas = items.reduce((s, i) =>
                s + (i.contiene ? 1 : 0) + (i.limpieza ? 1 : 0) + (i.peso_adecuado ? 1 : 0), 0)
              const total = items.length * 3

              return (
                <div key={plato.id} className="mb-5">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-navy">
                      {plato.nombre}
                      {plato.codigo && (
                        <span className="ml-1.5 text-xs text-navy/40 font-normal">{plato.codigo}</span>
                      )}
                    </h4>
                    {total > 0 && (
                      <span className="text-xs text-navy/40">{marcadas}/{total} checks</span>
                    )}
                  </div>

                  {plato.ingredientes.length === 0 ? (
                    <p className="text-xs text-navy/30 italic">Sin ingredientes configurados.</p>
                  ) : (
                    <div className="space-y-2">
                      {plato.ingredientes.map(ing => {
                        const item = items.find(i => i.ingrediente_nombre === ing.nombre)
                        return (
                          <div
                            key={ing.id}
                            className="px-3 py-2.5 rounded-xl bg-white border border-navy/10"
                          >
                            <p className="text-xs font-semibold text-navy mb-2">{ing.nombre}</p>
                            <div className="grid grid-cols-3 gap-2">
                              {CHECKS.map(({ campo, label }) => {
                                const val = (item?.[campo as keyof ProductoItemDraft] ?? false) as boolean
                                return (
                                  <button
                                    key={campo}
                                    type="button"
                                    onClick={() => toggleCheck(plato.id, ing.nombre, campo)}
                                    className={`flex flex-col items-center gap-1 py-2 px-1 rounded-lg text-xs text-center border transition ${
                                      val
                                        ? 'bg-green-50 border-green-200 text-green-800'
                                        : 'bg-white border-navy/15 text-navy/50 hover:border-navy/30'
                                    }`}
                                  >
                                    <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                                      val ? 'bg-green-500 text-white' : 'border-2 border-navy/20'
                                    }`}>
                                      {val && (
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                      )}
                                    </span>
                                    {label}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
        </>
      )}

      <ObservacionesEditor area="PRODUCTO" />

      {/* Oportunidades de mejora — texto libre, no puntúa */}
      <div className="mt-4 pt-4 border-t border-navy/10">
        <p className="text-xs font-semibold text-navy/40 uppercase tracking-wide mb-2">
          Oportunidades de mejora
        </p>
        <textarea
          value={oportunidad_producto}
          onChange={e => setOportunidad('PRODUCTO', e.target.value)}
          placeholder="Notas y oportunidades de mejora para Producto…"
          rows={2}
          className="w-full text-sm px-3 py-2 rounded-xl border border-navy/15 bg-white resize-none
                     text-navy placeholder:text-navy/25
                     focus:outline-none focus:ring-2 focus:ring-naranja/30 focus:border-naranja transition"
        />
      </div>
    </Card>
  )
}

function Card({
  titulo, dot, border, bg, children,
}: {
  titulo: string; dot: string; border: string; bg: string; children: ReactNode
}) {
  return (
    <div className={`rounded-2xl border-2 p-5 mb-4 ${border} ${bg}`}>
      <div className="flex items-center gap-2 mb-4">
        <div className={`w-2.5 h-2.5 rounded-full ${dot}`} />
        <h3 className="text-sm font-bold text-navy uppercase tracking-wide">{titulo}</h3>
      </div>
      {children}
    </div>
  )
}
