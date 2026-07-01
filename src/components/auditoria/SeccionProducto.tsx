import { useState, type ReactNode } from 'react'
import type { AuPlato, AuPlatoIngrediente } from '../../types'
import { useAuditoriaStore } from '../../store/auditoriaStore'
import ObservacionesEditor from './ObservacionesEditor'
import EvidenciasUploader from './EvidenciasUploader'

/* ── Tipos exportados (usados también en TrackingPage y MisAuditoriasPage) ── */

export interface PlatoConIngredientes extends AuPlato {
  ingredientes: AuPlatoIngrediente[]
}

export interface SlotConOpciones {
  id:       string
  nombre:   string
  orden:    number
  opciones: PlatoConIngredientes[]
}

export interface ComboConSlots {
  id:     string
  nombre: string
  codigo: string | null
  activo: boolean
  slots:  SlotConOpciones[]
}

/* ── Props ──────────────────────────────────────────────────────────────── */

interface Props {
  platos:              PlatoConIngredientes[]
  platosSeleccionados: Set<string>
  onTogglePlato:       (platoId: string, plato: PlatoConIngredientes) => void
  combos:              ComboConSlots[]
  combosSeleccionados: Set<string>
  onToggleCombo:       (comboId: string, combo: ComboConSlots) => void
  slotPlatoElegido:    Map<string, string>
  onElegirPlatoEnSlot: (slotId: string, platoId: string | null, combo: ComboConSlots, slot: SlotConOpciones) => void
}

/* ══════════════════════════════════════════════════════════════════════════
   Componente
══════════════════════════════════════════════════════════════════════════ */

export default function SeccionProducto({
  platos, platosSeleccionados, onTogglePlato,
  combos, combosSeleccionados, onToggleCombo,
  slotPlatoElegido, onElegirPlatoEnSlot,
}: Props) {
  const { productoItems, toggleCheck, oportunidad_producto, setOportunidad } = useAuditoriaStore()
  const [busqueda, setBusqueda] = useState('')

  const q = busqueda.trim().toLowerCase()
  const platosVisibles = q
    ? platos.filter(p => p.nombre.toLowerCase().includes(q) || (p.codigo ?? '').toLowerCase().includes(q))
    : platos
  const combosVisibles = q
    ? combos.filter(c => c.nombre.toLowerCase().includes(q) || (c.codigo ?? '').toLowerCase().includes(q))
    : combos

  const hayItems      = platos.length > 0 || combos.length > 0
  const hayResultados = platosVisibles.length > 0 || combosVisibles.length > 0

  return (
    <Card titulo="Producto" dot="bg-naranja" border="border-naranja/30" bg="bg-naranja/5">
      {!hayItems ? (
        <p className="text-sm text-navy/40 italic mb-4">
          No hay platos ni combos configurados para este local. Agrégalos desde Configuración.
        </p>
      ) : (
        <>
          {/* ── Selector ─────────────────────────────────────────────── */}
          <div className="mb-5">
            <p className="text-xs font-semibold text-navy/50 uppercase tracking-wide mb-2">
              Platos y combos a evaluar
            </p>

            {/* Buscador */}
            <div className="relative mb-3">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-navy/30 pointer-events-none"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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

            {!hayResultados ? (
              <p className="text-sm text-navy/30 italic py-1">
                Sin resultados para &ldquo;{busqueda}&rdquo;.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {/* Chips de platos sueltos */}
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

                {/* Chips de combos */}
                {combosVisibles.map(c => {
                  const sel = combosSeleccionados.has(c.id)
                  return (
                    <button
                      key={`combo-${c.id}`}
                      type="button"
                      onClick={() => onToggleCombo(c.id, c)}
                      className={`text-sm px-3 py-1.5 rounded-xl border font-medium transition flex items-center gap-1.5 ${
                        sel
                          ? 'bg-ambar text-white border-ambar'
                          : 'bg-white text-navy/60 border-navy/20 hover:border-ambar hover:text-ambar'
                      }`}
                    >
                      <span className={`text-[9px] font-bold px-1 py-0.5 rounded uppercase tracking-wide ${
                        sel ? 'bg-white/25 text-white' : 'bg-ambar/15 text-ambar'
                      }`}>
                        COMBO
                      </span>
                      {c.nombre}
                      {c.codigo && <span className="text-xs opacity-60">{c.codigo}</span>}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Platos sueltos seleccionados ─────────────────────────── */}
          {platos
            .filter(p => platosSeleccionados.has(p.id))
            .map(plato => {
              const items    = productoItems.filter(i => i.plato_id === plato.id && !i.slot_nombre)
              const marcadas = items.reduce((s, i) => s + (i.contiene ? 1 : 0), 0)
              const total    = items.length

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
                      <span className="text-xs text-navy/40">{marcadas}/{total}</span>
                    )}
                  </div>

                  {plato.ingredientes.length === 0 ? (
                    <p className="text-xs text-navy/30 italic">Sin ingredientes configurados.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {plato.ingredientes.map(ing => {
                        const item = items.find(i => i.ingrediente_nombre === ing.nombre)
                        return (
                          <IngredienteBtn
                            key={ing.id}
                            nombre={ing.nombre}
                            contiene={item?.contiene ?? false}
                            onClick={() => toggleCheck(plato.id, ing.nombre, undefined)}
                          />
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}

          {/* ── Combos seleccionados ─────────────────────────────────── */}
          {combos
            .filter(c => combosSeleccionados.has(c.id))
            .map(combo => (
              <div key={combo.id} className="mb-5 rounded-2xl border-2 border-ambar/25 bg-ambar/5 p-4">
                {/* Cabecera del combo */}
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-[9px] font-bold bg-ambar/20 text-ambar px-1.5 py-0.5 rounded uppercase tracking-wide">
                    COMBO
                  </span>
                  <h4 className="text-sm font-semibold text-navy">{combo.nombre}</h4>
                  {combo.codigo && (
                    <span className="text-xs text-navy/40">{combo.codigo}</span>
                  )}
                </div>

                {combo.slots.length === 0 ? (
                  <p className="text-xs text-navy/30 italic">Este combo no tiene slots configurados.</p>
                ) : (
                  combo.slots.map(slot => {
                    const platoElegidoId = slotPlatoElegido.get(slot.id)
                    const platoElegido   = slot.opciones.find(p => p.id === platoElegidoId)
                    const slotItems      = productoItems.filter(
                      i => i.combo_nombre === combo.nombre && i.slot_nombre === slot.nombre
                    )
                    const marcadas = slotItems.reduce((s, i) => s + (i.contiene ? 1 : 0), 0)

                    return (
                      <div key={slot.id} className="mb-4 last:mb-0">
                        {/* Slot header + selector de plato */}
                        <div className="mb-2">
                          <p className="text-[10px] font-bold text-ambar/80 uppercase tracking-wide mb-1.5">
                            {slot.nombre}
                          </p>
                          {slot.opciones.length === 0 ? (
                            <p className="text-xs text-navy/30 italic">Sin platos en este slot.</p>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {slot.opciones.map(p => {
                                const sel = platoElegidoId === p.id
                                return (
                                  <button
                                    key={p.id}
                                    type="button"
                                    onClick={() =>
                                      onElegirPlatoEnSlot(slot.id, sel ? null : p.id, combo, slot)
                                    }
                                    className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition ${
                                      sel
                                        ? 'bg-ambar text-white border-ambar'
                                        : 'bg-white text-navy/55 border-navy/15 hover:border-ambar/40 hover:text-ambar'
                                    }`}
                                  >
                                    {p.nombre}
                                  </button>
                                )
                              })}
                            </div>
                          )}
                        </div>

                        {/* Ingredientes del plato elegido en este slot */}
                        {platoElegido && (
                          <div className="ml-3 pl-3 border-l-2 border-ambar/20 space-y-1.5">
                            {slotItems.length > 0 && (
                              <p className="text-[10px] text-navy/35 mb-1">
                                {platoElegido.nombre} · {marcadas}/{slotItems.length}
                              </p>
                            )}
                            {platoElegido.ingredientes.length === 0 ? (
                              <p className="text-xs text-navy/30 italic">Sin ingredientes.</p>
                            ) : (
                              platoElegido.ingredientes.map(ing => {
                                const item = slotItems.find(i => i.ingrediente_nombre === ing.nombre)
                                return (
                                  <IngredienteBtn
                                    key={ing.id}
                                    nombre={ing.nombre}
                                    contiene={item?.contiene ?? false}
                                    onClick={() => toggleCheck(platoElegido.id, ing.nombre, slot.nombre)}
                                    accentClass="border-ambar/20 bg-ambar/5"
                                    checkClass="bg-ambar-500"
                                  />
                                )
                              })
                            )}
                          </div>
                        )}

                        {!platoElegido && slot.opciones.length > 0 && (
                          <p className="text-xs text-navy/30 italic ml-3">
                            Elige el plato para este slot.
                          </p>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            ))}
        </>
      )}

      <ObservacionesEditor area="PRODUCTO" />

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

/* ── Sub-componentes ─────────────────────────────────────────────────────── */

function IngredienteBtn({
  nombre, contiene, onClick, accentClass = '', checkClass = '',
}: {
  nombre:      string
  contiene:    boolean
  onClick:     () => void
  accentClass?: string
  checkClass?:  string
}) {
  void accentClass; void checkClass
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition ${
        contiene
          ? 'bg-green-50 border-green-200 text-green-800'
          : 'bg-white border-navy/15 text-navy/60 hover:border-navy/30'
      }`}
    >
      <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
        contiene ? 'bg-green-500 text-white' : 'border-2 border-navy/20'
      }`}>
        {contiene && (
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </span>
      <span className="text-xs font-semibold">{nombre}</span>
      <span className="ml-auto text-xs font-medium opacity-60">Contiene</span>
    </button>
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
