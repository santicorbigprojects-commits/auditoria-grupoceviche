import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import type { AuVisitaObrador, AuObrador, EstadoVisita } from '../../types'

const ESTADOS: EstadoVisita[] = ['PROGRAMADA', 'REALIZADA', 'CANCELADA']

const ESTADO_BADGE: Record<EstadoVisita, string> = {
  PROGRAMADA: 'bg-ambar/20 text-ambar',
  REALIZADA:  'bg-green-100 text-green-700',
  CANCELADA:  'bg-navy/10 text-navy/45',
}

function fechaCorta(fecha: string): string {
  try {
    return new Date(fecha + 'T12:00:00').toLocaleDateString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    })
  } catch { return fecha }
}

/* ── Generación de ICS (RFC 5545), eventos de día completo (sin hora) ────── */

function icsEsc(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '')
}

function foldLine(line: string): string {
  if (line.length <= 75) return line
  const chunks: string[] = []
  let i = 0
  while (i < line.length) {
    const take = i === 0 ? 75 : 74
    chunks.push(line.slice(i, i + take))
    i += take
  }
  return chunks.join('\r\n ')
}

function generarICSObrador(visitasList: AuVisitaObrador[], obradoresMap: Record<string, string>): string {
  const stamp = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z'

  const eventos = visitasList.map(v => {
    const nom    = icsEsc(obradoresMap[v.obrador_id] ?? 'Obrador')
    const notas  = v.notas ? `\\nNotas: ${icsEsc(v.notas)}` : ''
    const desc   = `Estado: ${v.estado}${notas}`
    const uid    = `${v.id}@grupoceviche-audit-obrador`
    const status = v.estado === 'PROGRAMADA' ? 'TENTATIVE'
                 : v.estado === 'REALIZADA'  ? 'CONFIRMED'
                 : 'CANCELLED'

    const dateStr  = v.fecha_programada.replace(/-/g, '')
    const nextDay  = new Date(v.fecha_programada + 'T12:00:00')
    nextDay.setDate(nextDay.getDate() + 1)
    const nextStr  = nextDay.toISOString().slice(0, 10).replace(/-/g, '')

    return [
      'BEGIN:VEVENT',
      foldLine(`UID:${uid}`),
      foldLine(`DTSTAMP:${stamp}`),
      foldLine(`DTSTART;VALUE=DATE:${dateStr}`),
      foldLine(`DTEND;VALUE=DATE:${nextStr}`),
      foldLine(`SUMMARY:Auditoría de obrador — ${nom}`),
      foldLine(`DESCRIPTION:${desc}`),
      `STATUS:${status}`,
      'END:VEVENT',
    ].join('\r\n')
  })

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Grupo Ceviche//Auditoria Obradores//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...eventos,
    'END:VCALENDAR',
  ].join('\r\n')
}

type Filtro = 'futuras' | 'todas'

export default function VisitasObradorPage() {
  const { cut } = useAuthStore()

  const [visitas,  setVisitas]  = useState<AuVisitaObrador[]>([])
  const [obradores, setObradores] = useState<AuObrador[]>([])
  const [loading,  setLoading]  = useState(true)
  const [filtro,   setFiltro]   = useState<Filtro>('futuras')

  const [showForm, setShowForm] = useState(false)
  const [fObradorId, setFObradorId] = useState('')
  const [fFecha,      setFFecha]      = useState('')
  const [fNotas,      setFNotas]      = useState('')
  const [fSaving,     setFSaving]     = useState(false)
  const [fError,      setFError]      = useState<string | null>(null)

  const [showExport, setShowExport] = useState(false)
  const [expEstados, setExpEstados] = useState<Set<EstadoVisita>>(new Set(ESTADOS))
  const [expLoading, setExpLoading] = useState(false)
  const [expMsg,     setExpMsg]     = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const [{ data: v }, { data: o }] = await Promise.all([
      supabase.from('au_visitas_obrador').select('*').order('fecha_programada').range(0, 9999),
      supabase.from('au_obradores').select('*').eq('activo', true).order('nombre'),
    ])
    setVisitas(v ?? [])
    setObradores(o ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const obradoresMap: Record<string, string> = Object.fromEntries(obradores.map(o => [o.id, o.nombre]))

  const today = new Date().toISOString().slice(0, 10)
  const visitasFiltradas = visitas.filter(v => filtro === 'todas' || v.fecha_programada >= today)

  async function handleCreate() {
    if (!fObradorId || !fFecha) { setFError('Selecciona un obrador y una fecha.'); return }
    setFSaving(true); setFError(null)
    const { error } = await supabase.from('au_visitas_obrador').insert({
      obrador_id:       fObradorId,
      auditor_cut:      cut!,
      fecha_programada: fFecha,
      estado:           'PROGRAMADA' as EstadoVisita,
      notas:            fNotas.trim() || null,
    })
    setFSaving(false)
    if (error) { setFError(error.message); return }
    setShowForm(false); setFObradorId(''); setFFecha(''); setFNotas('')
    await load()
  }

  async function handleChangeEstado(id: string, estado: EstadoVisita) {
    await supabase.from('au_visitas_obrador').update({ estado }).eq('id', id)
    await load()
  }

  async function handleDelete(id: string) {
    await supabase.from('au_visitas_obrador').delete().eq('id', id)
    await load()
  }

  function toggleExpEstado(estado: EstadoVisita) {
    setExpEstados(prev => {
      const next = new Set(prev)
      next.has(estado) ? next.delete(estado) : next.add(estado)
      return next
    })
  }

  function handleExportar() {
    if (expEstados.size === 0) { setExpMsg('Selecciona al menos un estado.'); return }
    setExpLoading(true); setExpMsg(null)

    const lista = visitas.filter(v => expEstados.has(v.estado))
    if (lista.length === 0) { setExpLoading(false); setExpMsg('No hay visitas con ese filtro.'); return }

    const ics  = generarICSObrador(lista, obradoresMap)
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `visitas-obrador-gc-${today}.ics`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setExpLoading(false)
    setShowExport(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 rounded-full border-4 border-naranja border-t-transparent" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
        <div className="flex rounded-xl border border-navy/20 overflow-hidden">
          {(['futuras', 'todas'] as Filtro[]).map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setFiltro(f)}
              className={`px-3.5 py-2 text-xs font-semibold transition ${
                filtro === f ? 'bg-naranja text-white' : 'text-navy/50 hover:bg-navy/5'
              }`}
            >
              {f === 'futuras' ? 'Próximas' : 'Todas'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { setShowExport(true); setExpMsg(null) }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-navy/20 text-sm font-medium
                       text-navy/55 hover:border-naranja/50 hover:text-naranja hover:bg-naranja/5 transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Exportar .ics
          </button>
          <button
            type="button"
            onClick={() => setShowForm(s => !s)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-naranja text-white text-sm font-semibold
                       hover:bg-terranova transition"
          >
            + Agregar visita
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-navy/10 shadow-sm p-5 mb-5">
          <p className="text-xs font-bold text-navy/40 uppercase tracking-wide mb-3">Nueva visita de obrador</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs font-semibold text-navy/50 mb-1">Obrador *</label>
              <select
                value={fObradorId}
                onChange={e => setFObradorId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-navy/20 bg-white text-sm text-navy
                           focus:outline-none focus:ring-2 focus:ring-naranja/30 focus:border-naranja transition"
              >
                <option value="">Selecciona…</option>
                {obradores.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-navy/50 mb-1">Fecha *</label>
              <input
                type="date"
                value={fFecha}
                onChange={e => setFFecha(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-navy/20 bg-white text-sm text-navy
                           focus:outline-none focus:ring-2 focus:ring-naranja/30 focus:border-naranja transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-navy/50 mb-1">Notas (opcional)</label>
              <input
                type="text"
                value={fNotas}
                onChange={e => setFNotas(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-navy/20 bg-white text-sm text-navy
                           placeholder:text-navy/25 focus:outline-none focus:ring-2 focus:ring-naranja/30 focus:border-naranja transition"
              />
            </div>
          </div>
          {fError && <p className="text-xs text-terranova mb-2">{fError}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={handleCreate} disabled={fSaving}
              className="px-4 py-2 rounded-xl bg-naranja text-white text-sm font-semibold
                         hover:bg-terranova disabled:opacity-40 transition">
              {fSaving ? 'Guardando…' : 'Crear visita'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setFError(null) }}
              className="px-4 py-2 rounded-xl border border-navy/15 text-sm text-navy/40 hover:text-navy transition">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {visitasFiltradas.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-navy/15 p-10 text-center">
          <p className="text-navy/30 text-sm">
            {filtro === 'futuras' ? 'No hay próximas visitas de obrador programadas.' : 'No hay visitas de obrador registradas.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-navy/10 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy/10">
                <th className="text-left px-5 py-3 text-xs font-semibold text-navy/40 uppercase tracking-wide">Fecha</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-navy/40 uppercase tracking-wide">Obrador</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-navy/40 uppercase tracking-wide">Notas</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-navy/40 uppercase tracking-wide">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-navy/5">
              {visitasFiltradas.map(v => (
                <tr key={v.id} className="hover:bg-navy/5 transition-colors">
                  <td className="px-5 py-3.5 text-navy font-medium whitespace-nowrap">{fechaCorta(v.fecha_programada)}</td>
                  <td className="px-5 py-3.5 text-navy/70">{obradoresMap[v.obrador_id] ?? '—'}</td>
                  <td className="px-5 py-3.5 text-navy/50 max-w-[260px] truncate italic">{v.notas ?? ''}</td>
                  <td className="px-3 py-3.5">
                    <select
                      value={v.estado}
                      onChange={e => handleChangeEstado(v.id, e.target.value as EstadoVisita)}
                      className={`text-xs font-semibold px-2 py-1 rounded-lg border-0 cursor-pointer
                                  focus:outline-none focus:ring-2 focus:ring-naranja/30 ${ESTADO_BADGE[v.estado]}`}
                    >
                      {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(v.id)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-navy/20 text-navy/55
                                 hover:border-terranova hover:text-terranova transition font-medium whitespace-nowrap"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showExport && (
        <div
          className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowExport(false) }}
        >
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="px-5 pt-5 pb-4 border-b border-navy/10 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-navy" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  Exportar calendario
                </h3>
                <p className="text-xs text-navy/35 mt-0.5">Visitas de obrador · compatible con Google/Outlook</p>
              </div>
              <button type="button" onClick={() => setShowExport(false)}
                className="flex-shrink-0 w-7 h-7 rounded-full bg-navy/10 text-navy/45
                           hover:bg-navy/20 hover:text-navy flex items-center justify-center text-sm transition">
                ✕
              </button>
            </div>
            <div className="p-5 space-y-5">
              <div>
                <p className="text-xs font-bold text-navy/45 uppercase tracking-wide mb-2.5">Estados a incluir</p>
                <div className="flex flex-wrap gap-2">
                  {ESTADOS.map(estado => {
                    const sel = expEstados.has(estado)
                    return (
                      <button
                        key={estado}
                        type="button"
                        onClick={() => { toggleExpEstado(estado); setExpMsg(null) }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition ${
                          sel
                            ? 'bg-navy/10 border-navy/25 text-navy'
                            : 'bg-white border-navy/10 text-navy/30 hover:border-navy/20 hover:text-navy/50'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${
                          estado === 'PROGRAMADA' ? 'bg-ambar' : estado === 'REALIZADA' ? 'bg-green-500' : 'bg-navy/25'
                        }`} />
                        {estado.charAt(0) + estado.slice(1).toLowerCase()}
                      </button>
                    )
                  })}
                </div>
              </div>
              {expMsg && <p className="text-sm text-terranova bg-terranova/10 rounded-xl px-3 py-2">{expMsg}</p>}
              <div className="flex items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleExportar}
                  disabled={expLoading || expEstados.size === 0}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl
                             bg-naranja text-white text-sm font-semibold
                             hover:bg-terranova disabled:opacity-40 transition"
                >
                  {expLoading ? (
                    <div className="animate-spin w-4 h-4 rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  )}
                  Descargar .ics
                </button>
                <button type="button" onClick={() => setShowExport(false)}
                  className="px-4 py-2.5 rounded-xl text-sm text-navy/35 hover:text-navy transition">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
