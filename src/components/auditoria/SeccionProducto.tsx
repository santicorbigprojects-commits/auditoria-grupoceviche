import type { ReactNode } from 'react'
import type { AuPlato, AuPlatoIngrediente } from '../../types'
import { useAuditoriaStore } from '../../store/auditoriaStore'
import ObservacionesEditor from './ObservacionesEditor'

export interface PlatoConIngredientes extends AuPlato {
  ingredientes: AuPlatoIngrediente[]
}

interface Props {
  platos:               PlatoConIngredientes[]
  platosSeleccionados:  Set<string>
  onTogglePlato:        (platoId: string, plato: PlatoConIngredientes) => void
}

export default function SeccionProducto({ platos, platosSeleccionados, onTogglePlato }: Props) {
  const { productoItems, toggleCumple } = useAuditoriaStore()

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
              const items = productoItems.filter(i => i.plato_id === plato.id)
              const ok    = items.filter(i => i.cumple).length
              const tot   = items.length
              return (
                <div key={plato.id} className="mb-5">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-navy">
                      {plato.nombre}
                      {plato.codigo && (
                        <span className="ml-1.5 text-xs text-navy/40 font-normal">{plato.codigo}</span>
                      )}
                    </h4>
                    {tot > 0 && (
                      <span className="text-xs text-navy/40">{ok}/{tot}</span>
                    )}
                  </div>

                  {plato.ingredientes.length === 0 ? (
                    <p className="text-xs text-navy/30 italic">Sin ingredientes configurados.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {plato.ingredientes.map(ing => {
                        const item   = items.find(i => i.ingrediente_nombre === ing.nombre)
                        const cumple = item?.cumple ?? false
                        return (
                          <button
                            key={ing.id}
                            type="button"
                            onClick={() => toggleCumple(plato.id, ing.nombre)}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-left border transition ${
                              cumple
                                ? 'bg-green-50 border-green-200 text-green-800'
                                : 'bg-white border-navy/15 text-navy/60 hover:border-navy/30'
                            }`}
                          >
                            <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                              cumple ? 'bg-green-500 text-white' : 'border-2 border-navy/20'
                            }`}>
                              {cumple
                                ? <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                : <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                              }
                            </span>
                            {ing.nombre}
                          </button>
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
