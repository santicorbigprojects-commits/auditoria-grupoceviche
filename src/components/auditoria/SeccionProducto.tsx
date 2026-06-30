import { useState, type ReactNode } from 'react'
import type { AuPlato, AuPlatoIngrediente } from '../../types'
import { useAuditoriaStore } from '../../store/auditoriaStore'
import ObservacionesEditor from './ObservacionesEditor'
import EvidenciasUploader from './EvidenciasUploader'

export interface PlatoConIngredientes extends AuPlato {
  ingredientes: AuPlatoIngrediente[]
}

interface Props {
  platos:              PlatoConIngredientes[]
  platosSeleccionados: Set<string>
  onTogglePlato:       (platoId: string, plato: PlatoConIngredientes) => void
}

export default function SeccionProducto({ platos, platosSeleccionados, onTogglePlato }: Props) {
  const { productoItems, toggleCheck, oportunidad_producto, setOportunidad } = useAuditoriaStore()
  const [busqueda, setBusqueda] = useState('')

  const platosVisibles = busqueda.trim()
    ? platos.filter(p => {
        const q = busqueda.toLowerCase()
        return (
          p.nombre.toLowerCase().includes(q) ||
          (p.codigo ?? '').toLowerCase().includes(q)
        )
      })
    : platos

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

            {/* Buscador */}
            <div className="relative mb-3">
              <svg
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-navy/30 pointer-events-none"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="search"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre o código…"
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-navy/15 bg-white text-sm
                           text-navy placeholder:text-navy/25 focus:outline-none focus:ring-2
                           focus:ring-naranja/30 focus:border-naranja transition"
              />
              {busqueda && (
                <button
                  type="button"
                  onClick={() => setBusqueda('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-navy/30 hover:text-navy/60 transition"
                  aria-label="Limpiar búsqueda"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {platosVisibles.length === 0 ? (
              <p className="text-sm text-navy/30 italic py-1">
                Sin platos que coincidan con &ldquo;{busqueda}&rdquo;.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {platosVisibles.map(p => {
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
            )}
          </div>

          {/* Ingredientes por plato seleccionado */}
          {platos
            .filter(p => platosSeleccionados.has(p.id))
            .map(plato => {
              const items   = productoItems.filter(i => i.plato_id === plato.id)
              const marcadas = items.reduce((s, i) => s + (i.contiene ? 1 : 0), 0)
              const total = items.length

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
                          <button
                            key={ing.id}
                            type="button"
                            onClick={() => toggleCheck(plato.id, ing.nombre)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition ${
                              item?.contiene
                                ? 'bg-green-50 border-green-200 text-green-800'
                                : 'bg-white border-navy/15 text-navy/60 hover:border-navy/30'
                            }`}
                          >
                            <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                              item?.contiene ? 'bg-green-500 text-white' : 'border-2 border-navy/20'
                            }`}>
                              {item?.contiene && (
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </span>
                            <span className="text-xs font-semibold">{ing.nombre}</span>
                            <span className="ml-auto text-xs font-medium opacity-60">Contiene</span>
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

      <EvidenciasUploader area="PRODUCTO" />
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
