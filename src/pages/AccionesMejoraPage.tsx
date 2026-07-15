import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import type {
  AuObservacion, AuAuditoria, AuLocal, AuAccionMejora, AuDirectorLocal,
  AreaObservacion, Severidad, ExtremaModo,
} from '../types'

/* ── Labels y colores (mismo esquema que el resto de la app) ─────────────── */

const AREA_LABEL: Record<AreaObservacion, string> = {
  PRODUCTO:      'Producto',
  SERVICIO:      'Servicio',
  LOCAL:         'Local',
  RI_REVISION:   'Revisión de productos',
  RI_ROTULACION: 'Rotulación de productos',
  RI_HIGIENE:    'Higiene de cocina',
}

const SEV_LABEL: Record<Severidad, string> = {
  NINGUNA: 'Ninguna',
  LEVE:    'Leve',
  MEDIA:   'Media',
  GRAVE:   'Grave',
  EXTREMA: 'Extremadamente grave',
}

const SEV_BADGE: Record<Severidad, string> = {
  NINGUNA: 'bg-navy/10 text-navy/40',
  LEVE:    'bg-ambar/15 text-ambar',
  MEDIA:   'bg-naranja/15 text-naranja',
  GRAVE:   'bg-terranova/10 text-terranova',
  EXTREMA: 'bg-marron/15 text-marron',
}

const MODO_LABEL: Record<ExtremaModo, string> = {
  PESO:       'Peso fijo',
  PORCENTAJE: '−50% del área',
}

type EstadoFiltro = 'TODAS' | 'PENDIENTES' | 'RESUELTAS'

interface FilaData {
  observacion:    AuObservacion
  auditoria:      AuAuditoria
  localNombre:    string
  directorNombre: string
  accion:         AuAccionMejora | null
}

function fechaCorta(fecha: string): string {
  try {
    return new Date(fecha + 'T12:00:00').toLocaleDateString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    })
  } catch { return fecha }
}

/* ══════════════════════════════════════════════════════════════════════════
   Root
══════════════════════════════════════════════════════════════════════════ */

export default function AccionesMejoraPage() {
  const { cut, rol } = useAuthStore()
  const puedeEditar = rol === 'AUDITOR'

  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [filas,   setFilas]   = useState<FilaData[]>([])
  const [locales, setLocales] = useState<AuLocal[]>([])
  const [directorPorLocal, setDirectorPorLocal] = useState<Record<string, string>>({})

  const [filtroLocal,    setFiltroLocal]    = useState<string>('TODOS')
  const [filtroEstado,   setFiltroEstado]   = useState<EstadoFiltro>('TODAS')
  const [filtroDirector, setFiltroDirector] = useState<string>('TODOS')

  useEffect(() => {
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cut, rol])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      // 1. Locales visibles según rol: director → solo los suyos; auditor/admin → todos.
      let localesList: AuLocal[] = []
      let localIds:    string[]  = []

      if (rol === 'DIRECTOR') {
        const { data: dl } = await supabase
          .from('au_director_locales')
          .select('local_id')
          .eq('director_cut', cut!)
        const ids = (dl ?? []).map((r: { local_id: string }) => r.local_id)
        if (ids.length > 0) {
          const { data: l } = await supabase.from('au_locales').select('*').in('id', ids).order('nombre')
          localesList = l ?? []
          localIds    = ids
        }
      } else {
        const { data: l } = await supabase.from('au_locales').select('*').order('nombre')
        localesList = l ?? []
        localIds    = localesList.map(x => x.id)
      }
      setLocales(localesList)

      if (localIds.length === 0) { setFilas([]); return }

      // 1b. Director de cada local (au_director_locales → au_usuarios)
      const { data: dlData, error: eDl } = await supabase
        .from('au_director_locales')
        .select('*')
        .in('local_id', localIds)
      if (eDl) throw eDl
      const directorLocales = (dlData ?? []) as AuDirectorLocal[]

      const directorCuts = Array.from(new Set(directorLocales.map(d => d.director_cut)))
      const directorNombreMap: Record<string, string> = {}
      if (directorCuts.length > 0) {
        const { data: usersData, error: eUs } = await supabase
          .from('au_usuarios')
          .select('cut, nombre')
          .in('cut', directorCuts)
        if (eUs) throw eUs
        ;(usersData ?? []).forEach((u: { cut: string; nombre: string }) => {
          directorNombreMap[u.cut] = u.nombre
        })
      }

      const localDirectorMap: Record<string, string> = {}
      directorLocales.forEach(dl => {
        const nombre = directorNombreMap[dl.director_cut]
        if (nombre) localDirectorMap[dl.local_id] = nombre
      })
      setDirectorPorLocal(localDirectorMap)

      // 2. Auditorías de esos locales
      const { data: auds, error: e1 } = await supabase
        .from('au_auditorias')
        .select('*')
        .in('local_id', localIds)
        .range(0, 9999)
      if (e1) throw e1
      const auditorias   = (auds ?? []) as AuAuditoria[]
      const auditoriaIds = auditorias.map(a => a.id)

      if (auditoriaIds.length === 0) { setFilas([]); return }

      // 3. Observaciones de esas auditorías (todas las áreas)
      const { data: obsData, error: e2 } = await supabase
        .from('au_observaciones')
        .select('*')
        .in('auditoria_id', auditoriaIds)
        .range(0, 9999)
      if (e2) throw e2
      const observaciones = (obsData ?? []) as AuObservacion[]

      if (observaciones.length === 0) { setFilas([]); return }

      // 4. Acciones de mejora ya registradas para esas observaciones
      const { data: accData, error: e3 } = await supabase
        .from('au_acciones_mejora')
        .select('*')
        .in('observacion_id', observaciones.map(o => o.id))
        .range(0, 9999)
      if (e3) throw e3
      const accionesMap: Record<string, AuAccionMejora> = {}
      ;(accData ?? []).forEach((a: AuAccionMejora) => { accionesMap[a.observacion_id] = a })

      // 5. Cruzar todo en memoria
      const auditoriaMap: Record<string, AuAuditoria> = {}
      auditorias.forEach(a => { auditoriaMap[a.id] = a })
      const localMap: Record<string, string> = {}
      localesList.forEach(l => { localMap[l.id] = l.nombre })

      const rows: FilaData[] = observaciones
        .map((o): FilaData | null => {
          const aud = auditoriaMap[o.auditoria_id]
          if (!aud) return null
          return {
            observacion:    o,
            auditoria:      aud,
            localNombre:    localMap[aud.local_id] ?? '—',
            directorNombre: localDirectorMap[aud.local_id] ?? '—',
            accion:         accionesMap[o.id] ?? null,
          }
        })
        .filter((r): r is FilaData => r !== null)
        .sort((a, b) => b.auditoria.fecha.localeCompare(a.auditoria.fecha))

      setFilas(rows)
    } catch (err) {
      console.error(err)
      setError('Error cargando las observaciones. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const directores = useMemo(() => {
    return Array.from(new Set(Object.values(directorPorLocal))).sort((a, b) => a.localeCompare(b))
  }, [directorPorLocal])

  const filasFiltradas = useMemo(() => {
    return filas.filter(f => {
      if (filtroLocal    !== 'TODOS' && f.auditoria.local_id !== filtroLocal) return false
      if (filtroDirector !== 'TODOS' && f.directorNombre     !== filtroDirector) return false
      if (filtroEstado === 'PENDIENTES' && f.accion?.resuelto) return false
      if (filtroEstado === 'RESUELTAS'  && !f.accion?.resuelto) return false
      return true
    })
  }, [filas, filtroLocal, filtroDirector, filtroEstado])

  function handleAccionGuardada(observacionId: string, accion: AuAccionMejora) {
    setFilas(prev => prev.map(f => f.observacion.id === observacionId ? { ...f, accion } : f))
  }

  /* ── Render ─────────────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 rounded-full border-4 border-naranja border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-navy" style={{ fontFamily: 'Poppins, sans-serif' }}>
          Acciones de mejora
        </h2>
        <p className="text-sm text-navy/40 mt-0.5">
          {puedeEditar
            ? 'Registra la acción correctiva y la fecha de evaluación de cada observación.'
            : rol === 'ADMIN' ? 'Todos los locales' : 'Locales asignados a tu cuenta'}
        </p>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 text-sm text-terranova bg-terranova/10 rounded-xl px-4 py-3">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" clipRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm-.75-5.75a.75.75 0 001.5 0v-4a.75.75 0 00-1.5 0v4zm.75 2.5a1 1 0 100-2 1 1 0 000 2z" />
          </svg>
          {error}
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select
          value={filtroLocal}
          onChange={e => setFiltroLocal(e.target.value)}
          className="px-3 py-2 rounded-xl border border-navy/20 bg-white text-navy text-sm
                     focus:outline-none focus:ring-2 focus:ring-naranja/40 focus:border-naranja transition"
        >
          <option value="TODOS">Todos los locales</option>
          {locales.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
        </select>

        <select
          value={filtroDirector}
          onChange={e => setFiltroDirector(e.target.value)}
          className="px-3 py-2 rounded-xl border border-navy/20 bg-white text-navy text-sm
                     focus:outline-none focus:ring-2 focus:ring-naranja/40 focus:border-naranja transition"
        >
          <option value="TODOS">Todos los directores</option>
          {directores.map(d => <option key={d} value={d}>{d}</option>)}
        </select>

        <div className="flex rounded-xl border border-navy/20 overflow-hidden">
          {(['TODAS', 'PENDIENTES', 'RESUELTAS'] as EstadoFiltro[]).map(estado => (
            <button
              key={estado}
              type="button"
              onClick={() => setFiltroEstado(estado)}
              className={`px-3.5 py-2 text-xs font-semibold transition ${
                filtroEstado === estado ? 'bg-naranja text-white' : 'text-navy/50 hover:bg-navy/5'
              }`}
            >
              {estado === 'TODAS' ? 'Todas' : estado === 'PENDIENTES' ? 'Pendientes' : 'Resueltas'}
            </button>
          ))}
        </div>

        <span className="text-xs text-navy/35 ml-auto">
          {filasFiltradas.length} {filasFiltradas.length === 1 ? 'observación' : 'observaciones'}
        </span>
      </div>

      {/* Tabla */}
      {filasFiltradas.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-navy/15 p-10 text-center">
          <p className="text-navy/30 text-sm">No hay observaciones que coincidan con los filtros.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-navy/10 shadow-sm overflow-x-auto">
          <table className="w-full text-sm min-w-[1280px]">
            <thead>
              <tr className="border-b border-navy/10">
                <th className="text-left px-4 py-3 text-xs font-semibold text-navy/40 uppercase tracking-wide whitespace-nowrap">Fecha auditoría</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-navy/40 uppercase tracking-wide">Local</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-navy/40 uppercase tracking-wide">Director</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-navy/40 uppercase tracking-wide whitespace-nowrap">Área</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-navy/40 uppercase tracking-wide min-w-[200px]">Observación</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-navy/40 uppercase tracking-wide">Severidad</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-navy/40 uppercase tracking-wide min-w-[220px]">Acción de mejora</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-navy/40 uppercase tracking-wide whitespace-nowrap">Fecha evaluación</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-navy/40 uppercase tracking-wide">Resuelto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy/5">
              {filasFiltradas.map(f => (
                <FilaObservacion
                  key={f.observacion.id}
                  data={f}
                  puedeEditar={puedeEditar}
                  onGuardado={accion => handleAccionGuardada(f.observacion.id, accion)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   Fila (guardado autónomo por fila)
══════════════════════════════════════════════════════════════════════════ */

function FilaObservacion({
  data, puedeEditar, onGuardado,
}: {
  data:        FilaData
  puedeEditar: boolean
  onGuardado:  (accion: AuAccionMejora) => void
}) {
  const { observacion: o, auditoria: a, localNombre, directorNombre, accion } = data

  const [accionTexto, setAccionTexto] = useState(accion?.accion ?? '')
  const [fechaEval,   setFechaEval]   = useState(accion?.fecha_evaluacion ?? '')
  const [resuelto,    setResuelto]    = useState(accion?.resuelto ?? false)
  const [saving, setSaving] = useState(false)
  const [ok,     setOk]     = useState(false)
  const [err,    setErr]    = useState(false)

  async function guardar(patch: {
    accion?: string
    fecha_evaluacion?: string | null
    resuelto?: boolean
  }) {
    setSaving(true)
    setOk(false)
    setErr(false)
    const payload = {
      observacion_id:   o.id,
      accion:           patch.accion !== undefined ? (patch.accion || null) : (accionTexto || null),
      fecha_evaluacion: patch.fecha_evaluacion !== undefined ? patch.fecha_evaluacion : (fechaEval || null),
      resuelto:         patch.resuelto !== undefined ? patch.resuelto : resuelto,
      actualizado_en:   new Date().toISOString(),
    }
    const { data: saved, error } = await supabase
      .from('au_acciones_mejora')
      .upsert(payload, { onConflict: 'observacion_id' })
      .select()
      .single()
    setSaving(false)
    if (error || !saved) { setErr(true); return }
    setOk(true)
    setTimeout(() => setOk(false), 2000)
    onGuardado(saved as AuAccionMejora)
  }

  function handleBlurAccion() {
    if (accionTexto === (accion?.accion ?? '')) return
    guardar({ accion: accionTexto })
  }

  function handleBlurFecha() {
    if (fechaEval === (accion?.fecha_evaluacion ?? '')) return
    guardar({ fecha_evaluacion: fechaEval || null })
  }

  function handleChangeResuelto(v: boolean) {
    setResuelto(v)
    guardar({ resuelto: v })
  }

  const modoLabel = o.severidad === 'EXTREMA' && o.extrema_modo ? MODO_LABEL[o.extrema_modo] : null

  return (
    <tr className="hover:bg-navy/[0.03] transition-colors align-top">
      <td className="px-4 py-3 text-navy/70 whitespace-nowrap">{fechaCorta(a.fecha)}</td>
      <td className="px-4 py-3 text-navy/70 max-w-[160px] truncate" title={localNombre}>{localNombre}</td>
      <td className="px-4 py-3 text-navy/70 max-w-[160px] truncate" title={directorNombre}>{directorNombre}</td>
      <td className="px-4 py-3 text-navy/70 whitespace-nowrap">{AREA_LABEL[o.area]}</td>
      <td className="px-4 py-3 text-navy/70 min-w-[200px]">
        <p className="leading-relaxed">{o.texto}</p>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide ${SEV_BADGE[o.severidad]}`}>
          {SEV_LABEL[o.severidad]}
        </span>
        {modoLabel && <p className="text-[10px] text-marron mt-1">{modoLabel}</p>}
      </td>
      <td className="px-4 py-3 min-w-[220px]">
        {puedeEditar ? (
          <textarea
            value={accionTexto}
            onChange={e => setAccionTexto(e.target.value)}
            onBlur={handleBlurAccion}
            placeholder="Describe la acción correctiva…"
            rows={2}
            className="w-full text-sm px-3 py-2 rounded-xl border border-navy/15 bg-white resize-none
                       text-navy placeholder:text-navy/25
                       focus:outline-none focus:ring-2 focus:ring-naranja/30 focus:border-naranja transition"
          />
        ) : (
          <p className="text-navy/60 leading-relaxed">
            {accionTexto || <span className="text-navy/25 italic">Sin acción registrada</span>}
          </p>
        )}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        {puedeEditar ? (
          <input
            type="date"
            value={fechaEval}
            onChange={e => setFechaEval(e.target.value)}
            onBlur={handleBlurFecha}
            className="px-2.5 py-1.5 rounded-lg border border-navy/20 bg-white text-navy text-sm
                       focus:outline-none focus:ring-2 focus:ring-naranja/30 focus:border-naranja transition"
          />
        ) : fechaEval ? (
          <span className="text-navy/60">{fechaCorta(fechaEval)}</span>
        ) : (
          <span className="text-navy/25">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-center">
        {puedeEditar ? (
          <input
            type="checkbox"
            checked={resuelto}
            onChange={e => handleChangeResuelto(e.target.checked)}
            className="w-4 h-4 rounded border-navy/30 text-naranja focus:ring-naranja/40 cursor-pointer"
          />
        ) : resuelto ? (
          <svg className="w-4 h-4 text-green-600 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <span className="text-navy/20">—</span>
        )}
        <div className="mt-1 h-3">
          {saving && <span className="text-[10px] text-navy/30">Guardando…</span>}
          {ok && !saving && <span className="text-[10px] text-green-600">Guardado</span>}
          {err && !saving && <span className="text-[10px] text-terranova">Error al guardar</span>}
        </div>
      </td>
    </tr>
  )
}
