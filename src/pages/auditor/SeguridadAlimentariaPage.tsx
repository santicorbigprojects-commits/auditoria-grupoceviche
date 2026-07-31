import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useSeguridadAlimentariaStore, type RespuestaDraft, type PersonaDraft } from '../../store/seguridadAlimentariaStore'
import { CATALOGO_SA, calcularEstadoSeccion, calcularEstadoGlobal, type PuntoSA, type SeccionSA } from '../../lib/seguridadAlimentaria'
import type { AuMarca, AuLocal, EstadoPunto, EstadoCualitativo, AuSaRespuesta, AuSaPersona } from '../../types'

interface Grupo { marca: AuMarca; locales: AuLocal[] }

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

interface Props {
  evaluacionId?: string   // presente = modo edición
  localNombre?: string    // nombre a mostrar (solo lectura) en modo edición
  onBack?:      () => void
}

export default function SeguridadAlimentariaPage({ evaluacionId, localNombre, onBack }: Props) {
  const { cut } = useAuthStore()
  const store   = useSeguridadAlimentariaStore()
  const modoEdicion = !!evaluacionId

  const [marcas,        setMarcas]        = useState<AuMarca[]>([])
  const [locales,       setLocales]       = useState<AuLocal[]>([])
  const [loadingMaster, setLoadingMaster] = useState(true)
  const [loadingEdicion, setLoadingEdicion] = useState(modoEdicion)
  const [loadError,     setLoadError]     = useState<string | null>(null)

  const [guardando,    setGuardando]    = useState(false)
  const [guardadoOk,   setGuardadoOk]   = useState(false)
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null)

  /* ── Carga inicial: marcas + locales ──────────────────────────────────── */
  useEffect(() => {
    async function load() {
      setLoadingMaster(true)
      const [{ data: m }, { data: l }] = await Promise.all([
        supabase.from('au_marcas').select('*').order('es_carpeta', { ascending: false }).order('nombre'),
        supabase.from('au_locales').select('*').eq('activo', true).order('nombre'),
      ])
      if (m) setMarcas(m)
      if (l) setLocales(l)
      setLoadingMaster(false)
    }
    load()
  }, [])

  /* ── Modo edición: cargar evaluación existente en el store ───────────── */
  useEffect(() => {
    if (!evaluacionId) return

    async function loadEvaluacion() {
      setLoadingEdicion(true)
      setLoadError(null)
      try {
        const [{ data: cab, error: e1 }, { data: resp, error: e2 }] = await Promise.all([
          supabase.from('au_sa_evaluaciones').select('*').eq('id', evaluacionId!).single(),
          supabase.from('au_sa_respuestas').select('*').eq('evaluacion_id', evaluacionId!).range(0, 9999),
        ])
        if (e1) throw e1
        if (e2) throw e2

        const respList: AuSaRespuesta[] = resp ?? []
        const respIds = respList.map(r => r.id)
        let personas: AuSaPersona[] = []
        if (respIds.length > 0) {
          const { data: pers, error: e3 } = await supabase
            .from('au_sa_personas').select('*').in('respuesta_id', respIds).range(0, 9999)
          if (e3) throw e3
          personas = pers ?? []
        }

        const respuestas: Record<string, RespuestaDraft> = {}
        respList.forEach(r => {
          respuestas[r.punto_key] = {
            estado: r.estado,
            personas: personas
              .filter(p => p.respuesta_id === r.id)
              .map((p): PersonaDraft => ({ id: p.id, nombre: p.nombre, accesorio: p.accesorio ?? undefined })),
          }
        })

        store.loadFromDB({ local_id: cab!.local_id, fecha: cab!.fecha, respuestas })
      } catch (err) {
        console.error(err)
        setLoadError('Error cargando la evaluación. Intenta de nuevo.')
      } finally {
        setLoadingEdicion(false)
      }
    }
    loadEvaluacion()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evaluacionId])

  /* ── Estados en vivo por sección + global ─────────────────────────────── */
  const estadosPorSeccion: Record<string, EstadoCualitativo | null> = {}
  CATALOGO_SA.forEach(sec => {
    const respondidos = sec.puntos
      .map(p => ({ puntoKey: p.key, estado: store.respuestas[p.key]?.estado ?? null }))
      .filter((r): r is { puntoKey: string; estado: EstadoPunto } => r.estado !== null)
    estadosPorSeccion[sec.key] = respondidos.length > 0 ? calcularEstadoSeccion(respondidos) : null
  })
  const seccionesConEstado = Object.values(estadosPorSeccion).filter((e): e is EstadoCualitativo => e !== null)
  const estadoGlobal = seccionesConEstado.length > 0 ? calcularEstadoGlobal(seccionesConEstado) : null

  const todosRespondidos = CATALOGO_SA.every(sec => sec.puntos.every(p => store.respuestas[p.key]?.estado))
  const canGuardar = !!store.local_id && todosRespondidos
  const motivoBloqueo = !store.local_id
    ? 'Selecciona un local primero.'
    : !todosRespondidos
    ? 'Responde todos los puntos para guardar.'
    : null

  /* ── Guardar (insert en modo nuevo, update en modo edición) ───────────── */
  async function handleGuardar() {
    if (!canGuardar || !cut) return
    setGuardando(true)
    setErrorGuardar(null)

    try {
      let evalId: string

      if (modoEdicion) {
        const { error: eU } = await supabase.from('au_sa_evaluaciones').update({
          fecha:         store.fecha,
          estado_global: estadoGlobal,
        }).eq('id', evaluacionId!)
        if (eU) throw eU

        // Las respuestas hijas se eliminan y se reinsertan; au_sa_personas cae en cascada.
        const { error: eD } = await supabase.from('au_sa_respuestas').delete().eq('evaluacion_id', evaluacionId!)
        if (eD) throw eD

        evalId = evaluacionId!
      } else {
        const { data: cab, error: eI } = await supabase.from('au_sa_evaluaciones').insert({
          local_id:      store.local_id,
          auditor_cut:   cut,
          fecha:         store.fecha,
          estado_global: estadoGlobal,
        }).select('id').single()
        if (eI || !cab) throw eI ?? new Error('Sin ID de evaluación')

        evalId = cab.id
      }

      const respuestasRows = CATALOGO_SA.flatMap(sec => sec.puntos.map(p => ({
        evaluacion_id:  evalId,
        seccion_key:    sec.key,
        punto_key:      p.key,
        punto_nombre:   p.nombre,
        seccion_nombre: sec.nombre,
        estado:         store.respuestas[p.key]!.estado!,
      })))
      const { data: insertados, error: eR } = await supabase
        .from('au_sa_respuestas').insert(respuestasRows).select('id, punto_key')
      if (eR) throw eR

      const personaRows: { respuesta_id: string; nombre: string; accesorio: string | null }[] = []
      ;(insertados ?? []).forEach(r => {
        const draft = store.respuestas[r.punto_key]
        draft?.personas.forEach(p => personaRows.push({
          respuesta_id: r.id, nombre: p.nombre, accesorio: p.accesorio ?? null,
        }))
      })
      if (personaRows.length > 0) {
        const { error: eP } = await supabase.from('au_sa_personas').insert(personaRows)
        if (eP) throw eP
      }

      if (!modoEdicion) store.reset()
      setGuardadoOk(true)
    } catch (err) {
      console.error(err)
      setErrorGuardar('Error al guardar. Revisa la conexión e intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  /* ── Grupos para el selector de local (idéntico a la auditoría de calidad) ── */
  const grupos: Grupo[] = (() => {
    const carpetas = marcas.filter(m => m.es_carpeta)
    const sueltas  = marcas.filter(m => !m.es_carpeta)
    const result: Grupo[] = []
    carpetas.forEach(m => {
      const ls = locales.filter(l => l.marca_id === m.id)
      if (ls.length) result.push({ marca: m, locales: ls })
    })
    sueltas.forEach(m => {
      const ls = locales.filter(l => l.marca_id === m.id)
      if (ls.length) result.push({ marca: m, locales: ls })
    })
    return result
  })()

  /* ── Render ─────────────────────────────────────────────────────────── */
  if (loadingMaster || loadingEdicion) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 rounded-full border-4 border-naranja border-t-transparent" />
      </div>
    )
  }

  if (loadError) {
    return <div className="p-6 text-center text-terranova text-sm">{loadError}</div>
  }

  const fechaLabel = (() => {
    try {
      return new Date(store.fecha + 'T12:00:00').toLocaleDateString('es-ES', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      })
    } catch { return store.fecha }
  })()

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {onBack && (
        <button type="button" onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-navy/50 hover:text-navy mb-5 transition">
          ← Mis evaluaciones
        </button>
      )}

      <div className="mb-6">
        <h2 className="text-2xl font-bold text-navy" style={{ fontFamily: 'Poppins, sans-serif' }}>
          {modoEdicion ? 'Editar evaluación' : 'Evaluación de Seguridad Alimentaria'}
        </h2>
        <p className="text-sm text-navy/40 mt-0.5 capitalize">{fechaLabel}</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-6 items-start">

        {/* ── Columna izquierda: formulario ─────────────────────────── */}
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-4 mb-6">
            <div>
              <label className="block text-xs font-semibold text-navy/50 uppercase tracking-wide mb-1.5">
                Local
              </label>
              {modoEdicion ? (
                <div className="px-4 py-2.5 rounded-xl border border-navy/10 bg-navy/5 text-navy/60 text-sm">
                  {localNombre}
                </div>
              ) : (
                <select
                  value={store.local_id ?? ''}
                  onChange={e => store.setLocalId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-navy/20 bg-white text-navy text-sm
                             focus:outline-none focus:ring-2 focus:ring-naranja/40 focus:border-naranja transition"
                >
                  <option value="">Selecciona un local…</option>
                  {grupos.map(g =>
                    g.marca.es_carpeta ? (
                      <optgroup key={g.marca.id} label={g.marca.nombre}>
                        {g.locales.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                      </optgroup>
                    ) : (
                      g.locales.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)
                    )
                  )}
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-navy/50 uppercase tracking-wide mb-1.5">
                Fecha
              </label>
              <input
                type="date"
                value={store.fecha}
                onChange={e => store.setFecha(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-navy/20 bg-white text-navy text-sm
                           focus:outline-none focus:ring-2 focus:ring-naranja/40 focus:border-naranja transition"
              />
            </div>
          </div>

          {!store.local_id ? (
            <div className="rounded-2xl border-2 border-dashed border-navy/15 p-10 text-center">
              <p className="text-navy/30 text-sm">Selecciona un local para comenzar la evaluación.</p>
            </div>
          ) : (
            CATALOGO_SA.map(sec => (
              <SeccionCard
                key={sec.key}
                seccion={sec}
                respuestas={store.respuestas}
                estadoSeccion={estadosPorSeccion[sec.key]}
                onSetEstado={store.setEstado}
                onAddPersona={store.addPersona}
                onRemovePersona={store.removePersona}
              />
            ))
          )}

          {errorGuardar && (
            <div className="mt-3 flex items-center gap-2 text-sm text-terranova bg-terranova/10 rounded-xl px-4 py-3">
              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" clipRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm-.75-5.75a.75.75 0 001.5 0v-4a.75.75 0 00-1.5 0v4zm.75 2.5a1 1 0 100-2 1 1 0 000 2z" />
              </svg>
              {errorGuardar}
            </div>
          )}
        </div>

        {/* ── Columna derecha: panel de estados ─────────────────────── */}
        <PanelEstados
          estadosPorSeccion={estadosPorSeccion}
          estadoGlobal={estadoGlobal}
          onGuardar={handleGuardar}
          guardando={guardando}
          guardadoOk={guardadoOk}
          canGuardar={canGuardar}
          motivoBloqueo={motivoBloqueo}
        />
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   Sub-componentes
══════════════════════════════════════════════════════════════════════════ */

function SeccionCard({
  seccion, respuestas, estadoSeccion, onSetEstado, onAddPersona, onRemovePersona,
}: {
  seccion: SeccionSA
  respuestas: Record<string, RespuestaDraft>
  estadoSeccion: EstadoCualitativo | null
  onSetEstado: (puntoKey: string, estado: EstadoPunto) => void
  onAddPersona: (puntoKey: string, nombre: string, accesorio?: string) => void
  onRemovePersona: (puntoKey: string, personaId: string) => void
}) {
  return (
    <div className="rounded-2xl border-2 border-navy/20 bg-white p-5 mb-4">
      <div className="flex items-center justify-between gap-3 mb-1">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-navy" />
          <h3 className="text-sm font-bold text-navy uppercase tracking-wide">{seccion.nombre}</h3>
        </div>
        <EstadoBadge estado={estadoSeccion} />
      </div>
      <div className="mt-2">
        {seccion.puntos.map(p => (
          <PuntoRow
            key={p.key}
            punto={p}
            respuesta={respuestas[p.key]}
            onSetEstado={onSetEstado}
            onAddPersona={onAddPersona}
            onRemovePersona={onRemovePersona}
          />
        ))}
      </div>
    </div>
  )
}

function PuntoRow({
  punto, respuesta, onSetEstado, onAddPersona, onRemovePersona,
}: {
  punto: PuntoSA
  respuesta: RespuestaDraft | undefined
  onSetEstado: (puntoKey: string, estado: EstadoPunto) => void
  onAddPersona: (puntoKey: string, nombre: string, accesorio?: string) => void
  onRemovePersona: (puntoKey: string, personaId: string) => void
}) {
  const estado = respuesta?.estado ?? null
  return (
    <div className="py-3 border-b border-navy/10 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-navy/80 flex-1">{punto.nombre}</p>
        <EstadoToggle value={estado} onChange={e => onSetEstado(punto.key, e)} />
      </div>
      {punto.permitePersonas && estado === 'NO_CUMPLE' && (
        <PersonasEditor
          personas={respuesta?.personas ?? []}
          permiteAccesorio={punto.permiteAccesorio}
          onAdd={(nombre, accesorio) => onAddPersona(punto.key, nombre, accesorio)}
          onRemove={id => onRemovePersona(punto.key, id)}
        />
      )}
    </div>
  )
}

const ESTADO_OPCIONES: { value: EstadoPunto; label: string }[] = [
  { value: 'CUMPLE',    label: 'Cumple' },
  { value: 'NO_CUMPLE', label: 'No cumple' },
  { value: 'NO_APLICA', label: 'N/A' },
]

function EstadoToggle({ value, onChange }: { value: EstadoPunto | null; onChange: (e: EstadoPunto) => void }) {
  return (
    <div className="flex gap-1.5 flex-shrink-0">
      {ESTADO_OPCIONES.map(o => {
        const active = value === o.value
        const cls = !active
          ? 'bg-white border-navy/15 text-navy/50 hover:border-navy/30'
          : o.value === 'CUMPLE'
          ? 'bg-green-500 border-green-500 text-white'
          : o.value === 'NO_CUMPLE'
          ? 'bg-terranova border-terranova text-white'
          : 'bg-navy/20 border-navy/20 text-navy/70'
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${cls}`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

const ACCESORIOS = ['Collar', 'Pulsera', 'Brazalete', 'Anillo']

function PersonasEditor({
  personas, permiteAccesorio, onAdd, onRemove,
}: {
  personas: PersonaDraft[]
  permiteAccesorio: boolean
  onAdd: (nombre: string, accesorio?: string) => void
  onRemove: (id: string) => void
}) {
  const [nombre, setNombre] = useState('')
  const [accesorio, setAccesorio] = useState(ACCESORIOS[0])

  function handleAdd() {
    if (!nombre.trim()) return
    onAdd(nombre.trim(), permiteAccesorio ? accesorio : undefined)
    setNombre('')
  }

  return (
    <div className="mt-2.5 ml-1 pl-3 border-l-2 border-terranova/25">
      {personas.length > 0 && (
        <div className="space-y-1.5 mb-2">
          {personas.map(p => (
            <div key={p.id} className="flex items-center justify-between gap-2 text-xs bg-terranova/5 rounded-lg px-2.5 py-1.5">
              <span className="text-navy/70">
                {p.nombre}{p.accesorio ? <span className="text-navy/40"> · {p.accesorio}</span> : null}
              </span>
              <button type="button" onClick={() => onRemove(p.id)} className="text-navy/30 hover:text-terranova transition">
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-1.5">
        <input
          type="text"
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } }}
          placeholder="Nombre de la persona"
          className="flex-1 min-w-0 text-xs px-2.5 py-1.5 rounded-lg border border-navy/15 bg-white text-navy
                     placeholder:text-navy/25 focus:outline-none focus:ring-2 focus:ring-naranja/30 focus:border-naranja transition"
        />
        {permiteAccesorio && (
          <select
            value={accesorio}
            onChange={e => setAccesorio(e.target.value)}
            className="text-xs px-2 py-1.5 rounded-lg border border-navy/15 bg-white text-navy
                       focus:outline-none focus:ring-2 focus:ring-naranja/30 focus:border-naranja transition"
          >
            {ACCESORIOS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        )}
        <button
          type="button"
          onClick={handleAdd}
          className="text-xs px-3 py-1.5 rounded-lg bg-navy text-white font-semibold hover:bg-navy/85 transition whitespace-nowrap"
        >
          Agregar
        </button>
      </div>
    </div>
  )
}

function EstadoBadge({ estado }: { estado: EstadoCualitativo | null }) {
  if (!estado) {
    return (
      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide bg-navy/10 text-navy/35">
        Pendiente
      </span>
    )
  }
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${ESTADO_BADGE[estado]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${ESTADO_DOT[estado]}`} />
      {ESTADO_LABEL[estado]}
    </span>
  )
}

function PanelEstados({
  estadosPorSeccion, estadoGlobal, onGuardar, guardando, guardadoOk, canGuardar, motivoBloqueo,
}: {
  estadosPorSeccion: Record<string, EstadoCualitativo | null>
  estadoGlobal:      EstadoCualitativo | null
  onGuardar:  () => void
  guardando:  boolean
  guardadoOk: boolean
  canGuardar: boolean
  motivoBloqueo: string | null
}) {
  return (
    <div className="bg-white rounded-2xl shadow-lg shadow-navy/10 border border-navy/10 p-5 sticky top-6">
      <h3 className="text-xs font-bold text-navy/40 uppercase tracking-wide mb-4">
        Estado por sección
      </h3>

      <div className="space-y-2.5 mb-5">
        {CATALOGO_SA.map(sec => (
          <div key={sec.key} className="flex items-center justify-between gap-2">
            <span className="text-xs text-navy/60 flex-1">{sec.nombre}</span>
            <EstadoBadge estado={estadosPorSeccion[sec.key]} />
          </div>
        ))}
      </div>

      <div className="border-t border-navy/10 pt-4 mb-5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-navy">Estado global</span>
          <EstadoBadge estado={estadoGlobal} />
        </div>
      </div>

      {guardadoOk ? (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-xl px-4 py-3">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Evaluación guardada
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={onGuardar}
            disabled={!canGuardar || guardando}
            className="w-full py-3 rounded-xl font-semibold text-sm text-white
                       bg-naranja hover:bg-terranova active:scale-[0.98]
                       disabled:opacity-40 disabled:cursor-not-allowed
                       transition-all duration-150 focus:outline-none focus:ring-2
                       focus:ring-naranja/40 focus:ring-offset-2"
          >
            {guardando ? <Spinner label="Guardando…" /> : 'Guardar evaluación'}
          </button>
          {!canGuardar && motivoBloqueo && (
            <p className="text-xs text-navy/30 text-center mt-2">{motivoBloqueo}</p>
          )}
        </>
      )}
    </div>
  )
}

function Spinner({ label }: { label: string }) {
  return (
    <span className="flex items-center justify-center gap-2">
      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
      </svg>
      {label}
    </span>
  )
}
