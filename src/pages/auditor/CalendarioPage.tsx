import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import CalendarioVisitas from '../../components/calendario/CalendarioVisitas'
import type { AuVisita, AuLocal, AuMarca, EstadoVisita } from '../../types'

const MESES_ES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

const ESTADOS: EstadoVisita[] = ['PROGRAMADA', 'REALIZADA', 'CANCELADA']

const ESTADO_BADGE: Record<EstadoVisita, string> = {
  PROGRAMADA: 'bg-ambar/20 text-ambar',
  REALIZADA:  'bg-green-100 text-green-700',
  CANCELADA:  'bg-navy/10 text-navy/45',
}

interface GrupoMarca { marca: AuMarca; locales: AuLocal[] }

export default function CalendarioPage() {
  const { cut } = useAuthStore()

  const [mesDate,  setMesDate]  = useState(() => new Date())
  const [visitas,  setVisitas]  = useState<AuVisita[]>([])
  const [locales,  setLocales]  = useState<AuLocal[]>([])
  const [marcas,   setMarcas]   = useState<AuMarca[]>([])
  const [loading,  setLoading]  = useState(true)
  const [loadingV, setLoadingV] = useState(false)

  // Día seleccionado en el calendario
  const [selDate, setSelDate] = useState<string | null>(null)

  // Formulario de nueva visita
  const [showForm, setShowForm] = useState(false)
  const [fLocalId, setFLocalId] = useState('')
  const [fHora,    setFHora]    = useState('12:00')
  const [fNotas,   setFNotas]   = useState('')
  const [fSaving,  setFSaving]  = useState(false)
  const [fError,   setFError]   = useState<string | null>(null)

  const year  = mesDate.getFullYear()
  const month = mesDate.getMonth()  // 0-based

  /* ── Carga inicial: locales + marcas ───────────────────────────────── */
  useEffect(() => {
    async function loadMaster() {
      const [{ data: l }, { data: m }] = await Promise.all([
        supabase.from('au_locales').select('*').eq('activo', true).order('nombre'),
        supabase.from('au_marcas').select('*')
          .order('es_carpeta', { ascending: false })
          .order('nombre'),
      ])
      setLocales(l ?? [])
      setMarcas(m  ?? [])
      setLoading(false)
    }
    loadMaster()
  }, [])

  /* ── Recarga visitas al cambiar de mes ─────────────────────────────── */
  useEffect(() => {
    loadVisitas()
  // Solo se dispara cuando cambia year o month
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month])

  async function loadVisitas() {
    setLoadingV(true)
    const mm      = String(month + 1).padStart(2, '0')
    const lastDay = new Date(year, month + 1, 0).getDate()
    const { data } = await supabase
      .from('au_visitas')
      .select('*')
      .gte('fecha', `${year}-${mm}-01`)
      .lte('fecha', `${year}-${mm}-${String(lastDay).padStart(2, '0')}`)
      .order('hora')
      .range(0, 9999)
    setVisitas(data ?? [])
    setLoadingV(false)
  }

  /* ── Navegación de mes ─────────────────────────────────────────────── */
  const prevMes = () => setMesDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  const nextMes = () => setMesDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))
  const irHoy   = () => setMesDate(new Date())

  /* ── CRUD visitas ──────────────────────────────────────────────────── */
  async function handleCreate() {
    if (!fLocalId || !selDate) { setFError('Selecciona un local.'); return }
    setFSaving(true); setFError(null)
    const { error } = await supabase.from('au_visitas').insert({
      local_id:    fLocalId,
      auditor_cut: cut!,
      fecha:       selDate,
      hora:        fHora || null,
      estado:      'PROGRAMADA' as EstadoVisita,
      notas:       fNotas.trim() || null,
    })
    setFSaving(false)
    if (error) { setFError(error.message); return }
    setShowForm(false); setFLocalId(''); setFHora('12:00'); setFNotas('')
    await loadVisitas()
  }

  async function handleChangeEstado(id: string, estado: EstadoVisita) {
    await supabase.from('au_visitas').update({ estado }).eq('id', id)
    await loadVisitas()
  }

  async function handleDelete(id: string) {
    await supabase.from('au_visitas').delete().eq('id', id)
    await loadVisitas()
  }

  /* ── Derivados ─────────────────────────────────────────────────────── */
  const localesMap: Record<string, string> = Object.fromEntries(
    locales.map(l => [l.id, l.nombre])
  )

  const selVisitas = selDate
    ? visitas.filter(v => v.fecha === selDate).sort((a, b) => (a.hora ?? '').localeCompare(b.hora ?? ''))
    : []

  const grupos: GrupoMarca[] = (() => {
    const result: GrupoMarca[] = []
    marcas.filter(m => m.es_carpeta).forEach(m => {
      const ls = locales.filter(l => l.marca_id === m.id)
      if (ls.length) result.push({ marca: m, locales: ls })
    })
    marcas.filter(m => !m.es_carpeta).forEach(m => {
      const ls = locales.filter(l => l.marca_id === m.id)
      if (ls.length) result.push({ marca: m, locales: ls })
    })
    return result
  })()

  const selDateLabel = (() => {
    if (!selDate) return null
    try {
      return new Date(selDate + 'T12:00:00').toLocaleDateString('es-ES', {
        weekday: 'long', day: 'numeric', month: 'long',
      })
    } catch { return selDate }
  })()

  /* ── Render ────────────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 rounded-full border-4 border-naranja border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-navy" style={{ fontFamily: 'Poppins, sans-serif' }}>
          Calendario de visitas
        </h2>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6 items-start">

        {/* ── Cuadrícula del mes ──────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-navy/10 shadow-sm p-5">

          {/* Navegación */}
          <div className="flex items-center justify-between mb-5">
            <button type="button" onClick={prevMes}
              className="p-2 rounded-xl hover:bg-navy/5 text-navy/45 hover:text-navy transition">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="text-center">
              <h3 className="text-lg font-bold text-navy" style={{ fontFamily: 'Poppins, sans-serif' }}>
                {MESES_ES[month]} {year}
              </h3>
              {loadingV && (
                <div className="mt-1 flex justify-center">
                  <div className="animate-spin w-3 h-3 rounded-full border-2 border-naranja border-t-transparent" />
                </div>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button type="button" onClick={irHoy}
                className="px-2.5 py-1 text-xs font-semibold text-navy/45 hover:text-navy rounded-lg hover:bg-navy/5 transition">
                Hoy
              </button>
              <button type="button" onClick={nextMes}
                className="p-2 rounded-xl hover:bg-navy/5 text-navy/45 hover:text-navy transition">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Leyenda */}
          <div className="flex items-center gap-4 mb-4 text-xs text-navy/40">
            {(['PROGRAMADA', 'REALIZADA', 'CANCELADA'] as EstadoVisita[]).map(e => (
              <span key={e} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full inline-block ${
                  e === 'PROGRAMADA' ? 'bg-ambar' : e === 'REALIZADA' ? 'bg-green-500' : 'bg-navy/25'
                }`} />
                {e.charAt(0) + e.slice(1).toLowerCase()}
              </span>
            ))}
          </div>

          <CalendarioVisitas
            year={year}
            month={month}
            visitas={visitas}
            localesMap={localesMap}
            selectedDate={selDate}
            onDayClick={fecha => {
              setSelDate(s => s === fecha ? null : fecha)
              setShowForm(false)
              setFError(null)
            }}
          />
        </div>

        {/* ── Panel lateral del día ────────────────────────────────────── */}
        <div className="xl:sticky xl:top-6">
          {!selDate ? (
            <div className="bg-white rounded-2xl border border-navy/10 p-8 text-center">
              <svg className="w-10 h-10 text-navy/15 mx-auto mb-3" fill="none" viewBox="0 0 24 24"
                stroke="currentColor" strokeWidth={1.2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm text-navy/30">
                Haz clic en un día para ver o agregar visitas.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-navy/10 shadow-sm overflow-hidden">

              {/* Cabecera */}
              <div className="px-5 py-4 border-b border-navy/8 flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-navy/40 font-medium capitalize">{selDateLabel}</p>
                  <p className="text-base font-bold text-navy mt-0.5"
                    style={{ fontFamily: 'Poppins, sans-serif' }}>
                    {selVisitas.length === 0
                      ? 'Sin visitas'
                      : `${selVisitas.length} visita${selVisitas.length !== 1 ? 's' : ''}`}
                  </p>
                </div>
                <button type="button" onClick={() => setSelDate(null)}
                  className="p-1.5 rounded-lg text-navy/25 hover:text-navy transition flex-shrink-0 mt-0.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Lista de visitas */}
              {selVisitas.length > 0 && (
                <div className="divide-y divide-navy/6 max-h-80 overflow-y-auto">
                  {selVisitas.map(v => (
                    <div key={v.id} className="px-5 py-3.5">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-navy truncate">
                            {localesMap[v.local_id] ?? v.local_id}
                          </p>
                          {v.hora && (
                            <p className="text-xs text-navy/40 mt-0.5">{v.hora.slice(0, 5)}</p>
                          )}
                          {v.notas && (
                            <p className="text-xs text-navy/40 mt-1 italic leading-tight">{v.notas}</p>
                          )}
                        </div>
                        <button type="button"
                          onClick={() => handleDelete(v.id)}
                          title="Eliminar visita"
                          className="flex-shrink-0 p-1 rounded-lg text-navy/20 hover:text-terranova
                                     hover:bg-terranova/10 transition mt-0.5">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"
                            stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round"
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                      <select
                        value={v.estado}
                        onChange={e => handleChangeEstado(v.id, e.target.value as EstadoVisita)}
                        className={`text-xs font-semibold px-2 py-1 rounded-lg border-0 cursor-pointer
                                    focus:outline-none focus:ring-2 focus:ring-naranja/30 ${ESTADO_BADGE[v.estado]}`}
                      >
                        {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              )}

              {/* Agregar visita */}
              <div className="px-5 py-4 border-t border-navy/8">
                {!showForm ? (
                  <button type="button" onClick={() => setShowForm(true)}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-xl
                               border-2 border-dashed border-naranja/35 text-naranja text-sm font-semibold
                               hover:bg-naranja/5 transition">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Agregar visita
                  </button>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs font-bold text-navy/40 uppercase tracking-wide">Nueva visita</p>

                    <div>
                      <label className="block text-xs font-semibold text-navy/50 mb-1">Local *</label>
                      <select
                        value={fLocalId}
                        onChange={e => setFLocalId(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-navy/20 bg-white text-sm text-navy
                                   focus:outline-none focus:ring-2 focus:ring-naranja/30 focus:border-naranja transition"
                      >
                        <option value="">Selecciona…</option>
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
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-navy/50 mb-1">Hora</label>
                      <input
                        type="time"
                        value={fHora}
                        onChange={e => setFHora(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-navy/20 bg-white text-sm text-navy
                                   focus:outline-none focus:ring-2 focus:ring-naranja/30 focus:border-naranja transition"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-navy/50 mb-1">Notas (opcional)</label>
                      <textarea
                        value={fNotas}
                        onChange={e => setFNotas(e.target.value)}
                        rows={2}
                        placeholder="Observaciones previas…"
                        className="w-full px-3 py-2 rounded-xl border border-navy/20 bg-white text-sm text-navy
                                   placeholder:text-navy/25 resize-none
                                   focus:outline-none focus:ring-2 focus:ring-naranja/30 focus:border-naranja transition"
                      />
                    </div>

                    {fError && <p className="text-xs text-terranova">{fError}</p>}

                    <div className="flex gap-2">
                      <button type="button" onClick={handleCreate} disabled={fSaving}
                        className="flex-1 py-2 rounded-xl bg-naranja text-white text-sm font-semibold
                                   hover:bg-terranova disabled:opacity-40 transition">
                        {fSaving ? 'Guardando…' : 'Crear visita'}
                      </button>
                      <button type="button"
                        onClick={() => { setShowForm(false); setFError(null) }}
                        className="px-3 py-2 rounded-xl border border-navy/15 text-sm text-navy/40
                                   hover:text-navy transition">
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
