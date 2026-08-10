import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import type {
  AuAuditoriaObrador, AuAuditoriaObradorObservacion, AuAccionMejoraObrador, AuObrador,
  Severidad, ExtremaModo,
} from '../types'

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
  PORCENTAJE: '−50% de la nota',
}

type EstadoFiltro = 'TODAS' | 'PENDIENTES' | 'RESUELTAS'

interface FilaData {
  observacion:   AuAuditoriaObradorObservacion
  auditoria:     AuAuditoriaObrador
  obradorNombre: string
  aspectoNombre: string
  accion:        AuAccionMejoraObrador | null
}

function fechaCorta(fecha: string): string {
  try {
    return new Date(fecha + 'T12:00:00').toLocaleDateString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    })
  } catch { return fecha }
}

export default function AccionesMejoraObradorSection() {
  const { rol } = useAuthStore()
  const puedeEditar = rol === 'AUDITOR' || rol === 'DIRECTOR' || rol === 'ADMIN'

  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [filas,   setFilas]   = useState<FilaData[]>([])
  const [obradores, setObradores] = useState<AuObrador[]>([])

  const [filtroObrador, setFiltroObrador] = useState<string>('TODOS')
  const [filtroEstado,  setFiltroEstado]  = useState<EstadoFiltro>('TODAS')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const { data: obData, error: eOb } = await supabase.from('au_obradores').select('*').order('nombre')
      if (eOb) throw eOb
      const obradoresList = (obData ?? []) as AuObrador[]
      setObradores(obradoresList)
      const obradorNombreMap: Record<string, string> = {}
      obradoresList.forEach(o => { obradorNombreMap[o.id] = o.nombre })

      const { data: aspData, error: eAsp } = await supabase.from('au_config_obrador_aspectos').select('id, nombre')
      if (eAsp) throw eAsp
      const aspectoNombreMap: Record<string, string> = {}
      ;(aspData ?? []).forEach((a: { id: string; nombre: string }) => { aspectoNombreMap[a.id] = a.nombre })

      const { data: auds, error: e1 } = await supabase
        .from('au_auditoria_obrador')
        .select('*')
        .range(0, 9999)
      if (e1) throw e1
      const auditorias = (auds ?? []) as AuAuditoriaObrador[]
      const auditoriaIds = auditorias.map(a => a.id)

      if (auditoriaIds.length === 0) { setFilas([]); return }

      const { data: obsData, error: e2 } = await supabase
        .from('au_auditoria_obrador_observaciones')
        .select('*')
        .in('auditoria_id', auditoriaIds)
        .range(0, 9999)
      if (e2) throw e2
      const observaciones = (obsData ?? []) as AuAuditoriaObradorObservacion[]

      if (observaciones.length === 0) { setFilas([]); return }

      const { data: accData, error: e3 } = await supabase
        .from('au_acciones_mejora_obrador')
        .select('*')
        .in('observacion_id', observaciones.map(o => o.id))
        .range(0, 9999)
      if (e3) throw e3
      const accionesMap: Record<string, AuAccionMejoraObrador> = {}
      ;(accData ?? []).forEach((a: AuAccionMejoraObrador) => { accionesMap[a.observacion_id] = a })

      const auditoriaMap: Record<string, AuAuditoriaObrador> = {}
      auditorias.forEach(a => { auditoriaMap[a.id] = a })

      const rows: FilaData[] = observaciones
        .map((o): FilaData | null => {
          const aud = auditoriaMap[o.auditoria_id]
          if (!aud) return null
          return {
            observacion:   o,
            auditoria:     aud,
            obradorNombre: obradorNombreMap[aud.obrador_id] ?? '—',
            aspectoNombre: o.aspecto_id ? (aspectoNombreMap[o.aspecto_id] ?? '—') : 'General',
            accion:        accionesMap[o.id] ?? null,
          }
        })
        .filter((r): r is FilaData => r !== null)
        .sort((a, b) => b.auditoria.fecha_auditoria.localeCompare(a.auditoria.fecha_auditoria))

      setFilas(rows)
    } catch (err) {
      console.error(err)
      setError('Error cargando las observaciones. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const filasFiltradas = useMemo(() => {
    return filas.filter(f => {
      if (filtroObrador !== 'TODOS' && f.auditoria.obrador_id !== filtroObrador) return false
      if (filtroEstado === 'PENDIENTES' && f.accion?.resuelto) return false
      if (filtroEstado === 'RESUELTAS'  && !f.accion?.resuelto) return false
      return true
    })
  }, [filas, filtroObrador, filtroEstado])

  function handleAccionGuardada(observacionId: string, accion: AuAccionMejoraObrador) {
    setFilas(prev => prev.map(f => f.observacion.id === observacionId ? { ...f, accion } : f))
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
          value={filtroObrador}
          onChange={e => setFiltroObrador(e.target.value)}
          className="px-3 py-2 rounded-xl border border-navy/20 bg-white text-navy text-sm
                     focus:outline-none focus:ring-2 focus:ring-naranja/40 focus:border-naranja transition"
        >
          <option value="TODOS">Todos los obradores</option>
          {obradores.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
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
          <table className="w-full text-sm min-w-[1180px]">
            <thead>
              <tr className="border-b border-navy/10">
                <th className="text-left px-4 py-3 text-xs font-semibold text-navy/40 uppercase tracking-wide whitespace-nowrap">Fecha auditoría</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-navy/40 uppercase tracking-wide">Obrador</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-navy/40 uppercase tracking-wide whitespace-nowrap">Aspecto</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-navy/40 uppercase tracking-wide min-w-[200px]">Observación</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-navy/40 uppercase tracking-wide">Severidad</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-navy/40 uppercase tracking-wide min-w-[220px]">Acción de mejora</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-navy/40 uppercase tracking-wide whitespace-nowrap">Fecha evaluación</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-navy/40 uppercase tracking-wide">Resuelto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy/5">
              {filasFiltradas.map(f => (
                <FilaObservacionObrador
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

function FilaObservacionObrador({
  data, puedeEditar, onGuardado,
}: {
  data:        FilaData
  puedeEditar: boolean
  onGuardado:  (accion: AuAccionMejoraObrador) => void
}) {
  const { observacion: o, auditoria: a, obradorNombre, aspectoNombre, accion } = data

  const [accionTexto, setAccionTexto] = useState(accion?.accion_correctiva ?? '')
  const [fechaEval,   setFechaEval]   = useState(accion?.fecha_evaluacion ?? '')
  const [resuelto,    setResuelto]    = useState(accion?.resuelto ?? false)
  const [saving, setSaving] = useState(false)
  const [ok,     setOk]     = useState(false)
  const [err,    setErr]    = useState(false)

  async function guardar(patch: {
    accion_correctiva?: string
    fecha_evaluacion?: string | null
    resuelto?: boolean
  }) {
    setSaving(true)
    setOk(false)
    setErr(false)
    const payload = {
      observacion_id:    o.id,
      auditoria_id:       a.id,
      obrador_id:          a.obrador_id,
      accion_correctiva:  patch.accion_correctiva !== undefined ? (patch.accion_correctiva || null) : (accionTexto || null),
      fecha_evaluacion:   patch.fecha_evaluacion !== undefined ? patch.fecha_evaluacion : (fechaEval || null),
      resuelto:           patch.resuelto !== undefined ? patch.resuelto : resuelto,
      actualizado_en:     new Date().toISOString(),
    }
    const { data: saved, error } = await supabase
      .from('au_acciones_mejora_obrador')
      .upsert(payload, { onConflict: 'observacion_id' })
      .select()
      .single()
    setSaving(false)
    if (error || !saved) { setErr(true); return }
    setOk(true)
    setTimeout(() => setOk(false), 2000)
    onGuardado(saved as AuAccionMejoraObrador)
  }

  function handleBlurAccion() {
    if (accionTexto === (accion?.accion_correctiva ?? '')) return
    guardar({ accion_correctiva: accionTexto })
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
      <td className="px-4 py-3 text-navy/70 whitespace-nowrap">{fechaCorta(a.fecha_auditoria)}</td>
      <td className="px-4 py-3 text-navy/70 max-w-[160px] truncate" title={obradorNombre}>{obradorNombre}</td>
      <td className="px-4 py-3 text-navy/70 whitespace-nowrap">{aspectoNombre}</td>
      <td className="px-4 py-3 text-navy/70 min-w-[200px]">
        <p className="leading-relaxed">{o.descripcion}</p>
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
