import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import {
  useObradorStore,
  type ObservacionObradorDraft,
  type EvidenciaObradorDraft,
  type RespuestaObradorDraft,
} from '../../store/obradorStore'
import {
  calcularDesgloseObrador,
  type ConfigSeveridadObrador,
} from '../../lib/calculoObrador'
import type {
  AuObrador, AuConfigObradorAspecto, Severidad, ExtremaModo, RespuestaObrador,
  AuAuditoriaObradorAspecto, AuAuditoriaObradorObservacion, AuAuditoriaObradorEvidencia,
} from '../../types'

const SEVERIDADES: Severidad[] = ['NINGUNA', 'LEVE', 'MEDIA', 'GRAVE', 'EXTREMA']

const SEV_STYLE: Record<Severidad, string> = {
  NINGUNA: 'bg-navy/10 text-navy/50',
  LEVE:    'bg-ambar/20 text-ambar',
  MEDIA:   'bg-naranja/20 text-naranja',
  GRAVE:   'bg-terranova/20 text-terranova',
  EXTREMA: 'bg-marron/20 text-marron',
}

/* ── Compresión de imagen (igual criterio que EvidenciasUploader: ~1280px, calidad 0.7) ── */
async function comprimirImagen(file: File): Promise<Blob> {
  const MAX_W   = 1280
  const QUALITY = 0.7
  return new Promise((resolve, reject) => {
    const img       = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const scale   = Math.min(1, MAX_W / img.width)
      const canvas  = document.createElement('canvas')
      canvas.width  = Math.round(img.width  * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('canvas context')); return }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        blob => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
        'image/jpeg',
        QUALITY,
      )
    }
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('image load')) }
    img.src = objectUrl
  })
}

interface Props {
  auditoriaId?:    string   // presente = modo edición
  obradorNombre?:  string   // nombre a mostrar (solo lectura) en modo edición
  onBack?:         () => void
}

export default function AuditoriaObradorPage({ auditoriaId, obradorNombre, onBack }: Props) {
  const { cut } = useAuthStore()
  const store   = useObradorStore()
  const modoEdicion = !!auditoriaId

  const [obradores,      setObradores]      = useState<AuObrador[]>([])
  const [aspectos,       setAspectos]       = useState<AuConfigObradorAspecto[]>([])
  const [configSev,      setConfigSev]      = useState<ConfigSeveridadObrador>({ NINGUNA: 0, LEVE: 0.5, MEDIA: 1, GRAVE: 2, EXTREMA: 4 })
  const [loadingMaster,  setLoadingMaster]  = useState(true)
  const [loadingEdicion, setLoadingEdicion] = useState(modoEdicion)
  const [loadError,      setLoadError]      = useState<string | null>(null)

  const [guardando,    setGuardando]    = useState(false)
  const [guardadoOk,   setGuardadoOk]   = useState(false)
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null)

  /* ── Carga inicial: obradores + aspectos + pesos de severidad ─────────── */
  useEffect(() => {
    async function load() {
      setLoadingMaster(true)
      const [{ data: ob }, { data: asp }, { data: sev }] = await Promise.all([
        supabase.from('au_obradores').select('*').eq('activo', true).order('nombre'),
        supabase.from('au_config_obrador_aspectos').select('*').eq('activo', true).order('orden'),
        supabase.from('au_config_severidad_obrador').select('*'),
      ])
      if (ob) setObradores(ob)
      if (asp) setAspectos(asp)
      if (sev) {
        const map = { ...configSev }
        sev.forEach((s: { severidad: Severidad; descuento: number }) => { map[s.severidad] = s.descuento })
        setConfigSev(map)
      }
      setLoadingMaster(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── Modo edición: cargar auditoría existente en el store ─────────────── */
  useEffect(() => {
    if (!auditoriaId) return

    async function loadAuditoria() {
      setLoadingEdicion(true)
      setLoadError(null)
      try {
        const [{ data: cab, error: e1 }, { data: asp, error: e2 }, { data: obs, error: e3 }, { data: evi, error: e4 }] = await Promise.all([
          supabase.from('au_auditoria_obrador').select('*').eq('id', auditoriaId!).single(),
          supabase.from('au_auditoria_obrador_aspectos').select('*').eq('auditoria_id', auditoriaId!).range(0, 9999),
          supabase.from('au_auditoria_obrador_observaciones').select('*').eq('auditoria_id', auditoriaId!).range(0, 9999),
          supabase.from('au_auditoria_obrador_evidencias').select('*').eq('auditoria_id', auditoriaId!).range(0, 9999),
        ])
        if (e1) throw e1
        if (e2) throw e2
        if (e3) throw e3
        if (e4) throw e4

        const respuestas: Record<string, RespuestaObradorDraft> = {}
        ;(asp as AuAuditoriaObradorAspecto[] ?? []).forEach(a => {
          respuestas[a.aspecto_id] = { respuesta: a.respuesta, observacion: a.observacion ?? '' }
        })

        const observaciones: ObservacionObradorDraft[] = (obs as AuAuditoriaObradorObservacion[] ?? []).map(o => ({
          id:           o.id,
          aspecto_id:   o.aspecto_id ?? '',
          descripcion:  o.descripcion,
          severidad:    o.severidad,
          extrema_modo: o.extrema_modo,
        }))

        const evidencias: EvidenciaObradorDraft[] = (evi as AuAuditoriaObradorEvidencia[] ?? []).map(e => ({
          path:       e.archivo_nombre ?? e.url,
          url:        e.url,
          aspecto_id: e.aspecto_id ?? '',
        }))

        store.loadFromDB({
          obrador_id:              cab!.obrador_id,
          fecha:                   cab!.fecha_auditoria,
          respuestas,
          observaciones,
          observaciones_generales: cab!.observaciones_generales ?? '',
          evidencias,
        })
      } catch (err) {
        console.error(err)
        setLoadError('Error cargando la auditoría. Intenta de nuevo.')
      } finally {
        setLoadingEdicion(false)
      }
    }
    loadAuditoria()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auditoriaId])

  /* ── Desglose en vivo ───────────────────────────────────────────────── */
  const respuestasCalc = aspectos
    .map(a => ({ aspecto_id: a.id, respuesta: store.respuestas[a.id]?.respuesta ?? null }))
    .filter((r): r is { aspecto_id: string; respuesta: RespuestaObrador } => r.respuesta !== null)

  const desglose = calcularDesgloseObrador(respuestasCalc, aspectos, store.observaciones, configSev)

  const todosRespondidos = aspectos.length > 0 && aspectos.every(a => store.respuestas[a.id]?.respuesta != null)
  const canGuardar = !!store.obrador_id && todosRespondidos
  const motivoBloqueo = !store.obrador_id
    ? 'Selecciona un obrador primero.'
    : !todosRespondidos
    ? 'Responde los 5 aspectos para guardar.'
    : null

  /* ── Guardar (insert en modo nuevo, update en modo edición) ───────────── */
  async function handleGuardar() {
    if (!canGuardar || !cut) return
    setGuardando(true)
    setErrorGuardar(null)

    try {
      const notaFinal = desglose.notaFinal
      let audId: string

      if (modoEdicion) {
        const { error: eU } = await supabase.from('au_auditoria_obrador').update({
          fecha_auditoria:         store.fecha,
          nota_final:              notaFinal,
          observaciones_generales: store.observaciones_generales || null,
          actualizado_en:          new Date().toISOString(),
        }).eq('id', auditoriaId!)
        if (eU) throw eU

        // Las tablas hijas se eliminan y se reinsertan (mismo patrón que el resto del sistema).
        await Promise.all([
          supabase.from('au_auditoria_obrador_aspectos').delete().eq('auditoria_id', auditoriaId!),
          supabase.from('au_auditoria_obrador_observaciones').delete().eq('auditoria_id', auditoriaId!),
          supabase.from('au_auditoria_obrador_evidencias').delete().eq('auditoria_id', auditoriaId!),
        ])

        audId = auditoriaId!
      } else {
        const { data: cab, error: eI } = await supabase.from('au_auditoria_obrador').insert({
          obrador_id:              store.obrador_id,
          auditor_cut:             cut,
          fecha_auditoria:         store.fecha,
          nota_final:              notaFinal,
          observaciones_generales: store.observaciones_generales || null,
        }).select('id').single()
        if (eI || !cab) throw eI ?? new Error('Sin ID de auditoría')

        audId = cab.id
      }

      const aspectosRows = aspectos.map(a => ({
        auditoria_id: audId,
        aspecto_id:   a.id,
        respuesta:    store.respuestas[a.id]!.respuesta!,
        observacion:  store.respuestas[a.id]?.observacion || null,
      }))
      const { error: eA } = await supabase.from('au_auditoria_obrador_aspectos').insert(aspectosRows)
      if (eA) throw eA

      if (store.observaciones.length > 0) {
        const obsRows = store.observaciones.map(o => ({
          auditoria_id: audId,
          aspecto_id:   o.aspecto_id || null,
          descripcion:  o.descripcion,
          severidad:    o.severidad,
          extrema_modo: o.extrema_modo ?? null,
          peso_resta:   (o.severidad === 'EXTREMA' && o.extrema_modo === 'PORCENTAJE') ? 0 : (configSev[o.severidad] ?? 0),
        }))
        const { error: eO } = await supabase.from('au_auditoria_obrador_observaciones').insert(obsRows)
        if (eO) throw eO
      }

      if (store.evidencias.length > 0) {
        const eviRows = store.evidencias.map(e => ({
          auditoria_id:   audId,
          aspecto_id:     e.aspecto_id || null,
          url:            e.url,
          archivo_nombre: e.path,
        }))
        const { error: eE } = await supabase.from('au_auditoria_obrador_evidencias').insert(eviRows)
        if (eE) throw eE
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
          ← Mis auditorías
        </button>
      )}

      <div className="mb-6">
        <h2 className="text-2xl font-bold text-navy" style={{ fontFamily: 'Poppins, sans-serif' }}>
          {modoEdicion ? 'Editar auditoría de obrador' : 'Auditoría de Obrador'}
        </h2>
        <p className="text-sm text-navy/40 mt-0.5 capitalize">{fechaLabel}</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-6 items-start">

        {/* ── Columna izquierda: formulario ─────────────────────────── */}
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-4 mb-6">
            <div>
              <label className="block text-xs font-semibold text-navy/50 uppercase tracking-wide mb-1.5">
                Obrador
              </label>
              {modoEdicion ? (
                <div className="px-4 py-2.5 rounded-xl border border-navy/10 bg-navy/5 text-navy/60 text-sm">
                  {obradorNombre}
                </div>
              ) : (
                <select
                  value={store.obrador_id ?? ''}
                  onChange={e => store.setObradorId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-navy/20 bg-white text-navy text-sm
                             focus:outline-none focus:ring-2 focus:ring-naranja/40 focus:border-naranja transition"
                >
                  <option value="">Selecciona un obrador…</option>
                  {obradores.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
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

          {!store.obrador_id ? (
            <div className="rounded-2xl border-2 border-dashed border-navy/15 p-10 text-center">
              <p className="text-navy/30 text-sm">Selecciona un obrador para comenzar la auditoría.</p>
            </div>
          ) : (
            <>
              {aspectos.map(a => (
                <AspectoCard
                  key={a.id}
                  aspecto={a}
                  respuesta={store.respuestas[a.id]}
                  observaciones={store.observaciones.filter(o => o.aspecto_id === a.id)}
                  evidencias={store.evidencias.filter(e => e.aspecto_id === a.id)}
                  onSetRespuesta={store.setRespuesta}
                  onSetComentario={store.setRespuestaObservacion}
                  onAddObservacion={store.addObservacion}
                  onUpdateObservacion={store.updateObservacion}
                  onRemoveObservacion={store.removeObservacion}
                  onAddEvidencia={store.addEvidencia}
                  onRemoveEvidencia={store.removeEvidencia}
                />
              ))}

              <div className="rounded-2xl border-2 border-navy/20 bg-white p-5 mb-4">
                <label className="block text-xs font-bold text-navy/40 uppercase tracking-wide mb-2">
                  Observaciones generales
                </label>
                <textarea
                  value={store.observaciones_generales}
                  onChange={e => store.setObservacionesGenerales(e.target.value)}
                  placeholder="Comentario general de la visita (no afecta la nota)…"
                  rows={3}
                  className="w-full text-sm px-3 py-2 rounded-xl border border-navy/15 bg-white resize-none
                             text-navy placeholder:text-navy/25
                             focus:outline-none focus:ring-2 focus:ring-naranja/30 focus:border-naranja transition"
                />
              </div>
            </>
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

        {/* ── Columna derecha: panel de nota ────────────────────────── */}
        <PanelNotaObrador
          desglose={desglose}
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

const RESPUESTA_OPCIONES: { value: RespuestaObrador; label: string }[] = [
  { value: 0, label: 'No' },
  { value: 1, label: 'Masomenos' },
  { value: 2, label: 'Sí' },
]

function RespuestaToggle({ value, onChange }: { value: RespuestaObrador | null; onChange: (v: RespuestaObrador) => void }) {
  return (
    <div className="flex gap-1.5 flex-shrink-0">
      {RESPUESTA_OPCIONES.map(o => {
        const active = value === o.value
        const cls = !active
          ? 'bg-white border-navy/15 text-navy/50 hover:border-navy/30'
          : o.value === 2
          ? 'bg-green-500 border-green-500 text-white'
          : o.value === 1
          ? 'bg-ambar border-ambar text-white'
          : 'bg-terranova border-terranova text-white'
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

function AspectoCard({
  aspecto, respuesta, observaciones, evidencias,
  onSetRespuesta, onSetComentario,
  onAddObservacion, onUpdateObservacion, onRemoveObservacion,
  onAddEvidencia, onRemoveEvidencia,
}: {
  aspecto:       AuConfigObradorAspecto
  respuesta:     RespuestaObradorDraft | undefined
  observaciones: ObservacionObradorDraft[]
  evidencias:    EvidenciaObradorDraft[]
  onSetRespuesta:       (aspecto_id: string, r: RespuestaObrador) => void
  onSetComentario:      (aspecto_id: string, texto: string) => void
  onAddObservacion:     (obs: Omit<ObservacionObradorDraft, 'id'>) => void
  onUpdateObservacion:  (id: string, patch: Partial<ObservacionObradorDraft>) => void
  onRemoveObservacion:  (id: string) => void
  onAddEvidencia:       (ev: EvidenciaObradorDraft) => void
  onRemoveEvidencia:    (path: string) => void
}) {
  return (
    <div className="rounded-2xl border-2 border-navy/20 bg-white p-5 mb-4">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-navy">{aspecto.nombre}</h3>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-navy/10 text-navy/50">
              {aspecto.puntos_maximo} pts
            </span>
          </div>
          {aspecto.descripcion && (
            <p className="text-xs text-navy/40 mt-0.5">{aspecto.descripcion}</p>
          )}
        </div>
        <RespuestaToggle value={respuesta?.respuesta ?? null} onChange={v => onSetRespuesta(aspecto.id, v)} />
      </div>

      <textarea
        value={respuesta?.observacion ?? ''}
        onChange={e => onSetComentario(aspecto.id, e.target.value)}
        placeholder="Comentario (opcional, no puntúa)…"
        rows={2}
        className="w-full mt-3 text-sm px-3 py-2 rounded-xl border border-navy/15 bg-white resize-none
                   text-navy placeholder:text-navy/25
                   focus:outline-none focus:ring-2 focus:ring-naranja/30 focus:border-naranja transition"
      />

      <EvidenciasMiniObrador
        aspectoId={aspecto.id}
        evidencias={evidencias}
        onAdd={onAddEvidencia}
        onRemove={onRemoveEvidencia}
      />

      <ObservacionesMiniObrador
        aspectoId={aspecto.id}
        observaciones={observaciones}
        onAdd={onAddObservacion}
        onUpdate={onUpdateObservacion}
        onRemove={onRemoveObservacion}
      />
    </div>
  )
}

function ObservacionesMiniObrador({
  aspectoId, observaciones, onAdd, onUpdate, onRemove,
}: {
  aspectoId:     string
  observaciones: ObservacionObradorDraft[]
  onAdd:    (obs: Omit<ObservacionObradorDraft, 'id'>) => void
  onUpdate: (id: string, patch: Partial<ObservacionObradorDraft>) => void
  onRemove: (id: string) => void
}) {
  return (
    <div className="mt-4 pt-3 border-t border-navy/10">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold text-navy/40 uppercase tracking-wide">
          Observaciones
        </span>
        <button
          type="button"
          onClick={() => onAdd({ aspecto_id: aspectoId, descripcion: '', severidad: 'LEVE' })}
          className="flex items-center gap-1 text-xs font-semibold text-naranja hover:text-terranova transition"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Agregar
        </button>
      </div>

      <div className="space-y-2">
        {observaciones.map(o => {
          const mostrarModoDual = o.severidad === 'EXTREMA'
          return (
            <div key={o.id} className="space-y-1.5">
              <div className="flex gap-2 items-start">
                <textarea
                  value={o.descripcion}
                  onChange={e => onUpdate(o.id, { descripcion: e.target.value })}
                  placeholder="Describe la observación…"
                  rows={2}
                  className="flex-1 text-sm px-3 py-2 rounded-xl border border-navy/15 bg-white resize-none
                             text-navy placeholder:text-navy/25
                             focus:outline-none focus:ring-2 focus:ring-naranja/30 focus:border-naranja transition"
                />
                <select
                  value={o.severidad}
                  onChange={e => {
                    const severidad = e.target.value as Severidad
                    const esExtrema = severidad === 'EXTREMA'
                    onUpdate(o.id, { severidad, extrema_modo: esExtrema ? (o.extrema_modo ?? 'PESO') : null })
                  }}
                  className={`text-xs font-semibold px-2 py-1.5 rounded-lg cursor-pointer border-0
                              focus:outline-none focus:ring-2 focus:ring-naranja/30 ${SEV_STYLE[o.severidad]}`}
                >
                  {SEVERIDADES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => onRemove(o.id)}
                  className="p-1.5 rounded-lg text-navy/30 hover:text-terranova hover:bg-terranova/10 transition mt-0.5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {mostrarModoDual && (
                <div className="flex items-center gap-2 pl-1">
                  <span className="text-[10px] font-semibold text-navy/40 uppercase tracking-wide">
                    Extremadamente grave:
                  </span>
                  <select
                    value={o.extrema_modo ?? 'PESO'}
                    onChange={e => onUpdate(o.id, { extrema_modo: e.target.value as ExtremaModo })}
                    className="text-xs font-medium px-2 py-1 rounded-lg border border-marron/30 bg-marron/10
                               text-marron cursor-pointer focus:outline-none focus:ring-2 focus:ring-marron/30"
                  >
                    <option value="PESO">Restar peso fijo</option>
                    <option value="PORCENTAJE">Reducir 50% de la nota</option>
                  </select>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function EvidenciasMiniObrador({
  aspectoId, evidencias, onAdd, onRemove,
}: {
  aspectoId:  string
  evidencias: EvidenciaObradorDraft[]
  onAdd:    (ev: EvidenciaObradorDraft) => void
  onRemove: (path: string) => void
}) {
  const [subiendo,    setSubiendo]    = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [eliminando,  setEliminando]  = useState<string | null>(null)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  async function handleFiles(files: FileList) {
    setSubiendo(true)
    setUploadError(null)
    try {
      for (const file of Array.from(files)) {
        const blob = await comprimirImagen(file)
        const path = `${crypto.randomUUID()}.jpg`
        const { error: upErr } = await supabase.storage
          .from('au-evidencias')
          .upload(path, blob, { contentType: 'image/jpeg' })
        if (upErr) throw upErr
        const { data } = supabase.storage.from('au-evidencias').getPublicUrl(path)
        onAdd({ path, url: data.publicUrl, aspecto_id: aspectoId })
      }
    } catch (e) {
      console.error('upload error', e)
      setUploadError('Error al subir la foto.')
    } finally {
      setSubiendo(false)
    }
  }

  async function handleDelete(path: string) {
    setEliminando(path)
    try {
      await supabase.storage.from('au-evidencias').remove([path])
      onRemove(path)
    } catch (e) {
      console.error('delete error', e)
    } finally {
      setEliminando(null)
    }
  }

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-semibold text-navy/40 uppercase tracking-wide">
          Evidencias{evidencias.length > 0 && <span className="ml-1 font-normal normal-case text-navy/30">({evidencias.length})</span>}
        </span>
        <label className="text-xs px-2.5 py-1 rounded-lg border border-navy/20 text-navy/55 cursor-pointer
                           hover:border-naranja hover:text-naranja transition">
          {subiendo ? 'Subiendo…' : '+ Foto'}
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={subiendo}
            onChange={e => { if (e.target.files?.length) handleFiles(e.target.files); e.target.value = '' }}
          />
        </label>
      </div>

      {uploadError && <p className="text-xs text-terranova mb-1.5">{uploadError}</p>}

      {evidencias.length > 0 && (
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
          {evidencias.map(ev => (
            <div key={ev.path} className="relative group aspect-square">
              <img
                src={ev.url}
                alt="evidencia"
                onClick={() => setLightboxUrl(ev.url)}
                className="w-full h-full object-cover rounded-lg cursor-zoom-in border border-navy/10"
              />
              <button
                type="button"
                onClick={e => { e.stopPropagation(); handleDelete(ev.path) }}
                disabled={eliminando === ev.path}
                className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-terranova text-white text-[9px]
                           flex items-center justify-center opacity-0 group-hover:opacity-100
                           disabled:opacity-50 transition-opacity leading-none"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {lightboxUrl && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <img src={lightboxUrl} alt="evidencia ampliada" className="max-w-full max-h-full rounded-2xl object-contain shadow-2xl" />
        </div>
      )}
    </div>
  )
}

function PanelNotaObrador({
  desglose, onGuardar, guardando, guardadoOk, canGuardar, motivoBloqueo,
}: {
  desglose:   ReturnType<typeof calcularDesgloseObrador>
  onGuardar:  () => void
  guardando:  boolean
  guardadoOk: boolean
  canGuardar: boolean
  motivoBloqueo: string | null
}) {
  const notaColor = desglose.notaFinal >= 17 ? 'text-green-600' : desglose.notaFinal >= 13 ? 'text-ambar' : 'text-terranova'

  return (
    <div className="bg-white rounded-2xl shadow-lg shadow-navy/10 border border-navy/10 p-5 sticky top-6">
      <h3 className="text-xs font-bold text-navy/40 uppercase tracking-wide mb-3">Nota en vivo</h3>

      <div className="text-center mb-4">
        <span className={`text-4xl font-black ${notaColor}`} style={{ fontFamily: 'Poppins, sans-serif' }}>
          {desglose.notaFinal.toFixed(2)}
        </span>
        <span className="text-navy/30 text-sm"> / 20</span>
      </div>

      <div className="space-y-1.5 mb-4">
        {desglose.detalleAspectos.map(d => (
          <div key={d.aspecto_id} className="flex items-center justify-between gap-2 text-xs">
            <span className="text-navy/60 flex-1">{d.nombre}</span>
            <span className="text-navy/40">{d.puntos.toFixed(1)}/{d.maximo}</span>
          </div>
        ))}
      </div>

      <div className="border-t border-navy/10 pt-3 mb-4 space-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-navy/50">Nota base</span>
          <span className="text-navy/70 font-medium">{desglose.notaBase.toFixed(2)}</span>
        </div>
        {desglose.descuentoFijo > 0 && (
          <div className="flex justify-between">
            <span className="text-navy/50">Descuento observaciones</span>
            <span className="text-terranova font-medium">−{desglose.descuentoFijo.toFixed(2)}</span>
          </div>
        )}
        {desglose.reducidoAl50 && (
          <p className="text-[11px] text-marron font-medium pt-1">
            ⚠ Reducido 50% por observación extremadamente grave
          </p>
        )}
      </div>

      {guardadoOk ? (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-xl px-4 py-3">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Auditoría guardada
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
            {guardando ? <Spinner label="Guardando…" /> : 'Guardar auditoría'}
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
