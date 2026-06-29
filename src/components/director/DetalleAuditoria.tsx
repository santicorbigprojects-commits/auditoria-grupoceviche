import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import type {
  AuAuditoria,
  AuAuditoriaProductoItem,
  AuAuditoriaServicio,
  AuAuditoriaLocal,
  AuObservacion,
  AuEvidencia,
  AuConfigTiempos,
  Area,
  Severidad,
} from '../../types'

type TimeKey = 'entrante' | 'principal' | 'bebida' | 'postre'

const TIEMPOS_DEFAULT: Record<TimeKey, number> = {
  entrante: 10, principal: 20, bebida: 5, postre: 10,
}

const SEV_BADGE: Record<Severidad, string> = {
  NINGUNA: 'bg-navy/10 text-navy/40',
  LEVE:    'bg-ambar/15 text-ambar',
  MEDIA:   'bg-naranja/15 text-naranja',
  GRAVE:   'bg-terranova/10 text-terranova',
}

function semColor(nota: number) {
  if (nota >= 16) return { badge: 'bg-green-100 text-green-700', bar: 'bg-green-400', text: 'text-green-600' }
  if (nota >= 12) return { badge: 'bg-ambar/15 text-ambar',      bar: 'bg-ambar',     text: 'text-ambar'    }
  return               { badge: 'bg-terranova/10 text-terranova', bar: 'bg-terranova', text: 'text-terranova' }
}

/* ── Props ─────────────────────────────────────────────────────────────── */

interface Props {
  auditoria:   AuAuditoria
  localNombre: string
  obs:         AuObservacion[]
  onClose:     () => void
}

/* ══════════════════════════════════════════════════════════════════════════
   Componente principal
══════════════════════════════════════════════════════════════════════════ */

export default function DetalleAuditoria({ auditoria, localNombre, obs, onClose }: Props) {
  const [loading,    setLoading]    = useState(true)
  const [items,      setItems]      = useState<AuAuditoriaProductoItem[]>([])
  const [servicio,   setServicio]   = useState<AuAuditoriaServicio | null>(null)
  const [localData,  setLocalData]  = useState<AuAuditoriaLocal | null>(null)
  const [evidencias, setEvidencias] = useState<AuEvidencia[]>([])
  const [tiemposMax, setTiemposMax] = useState<Record<TimeKey, number>>({ ...TIEMPOS_DEFAULT })
  const [lightbox,   setLightbox]   = useState<string | null>(null)

  /* ── Carga ─────────────────────────────────────────────────────────── */
  useEffect(() => {
    async function loadAll() {
      setLoading(true)
      const aid = auditoria.id
      const lid = auditoria.local_id

      const [
        { data: itemsData },
        { data: servData  },
        { data: locData   },
        { data: evidData  },
        tiemposResult,
      ] = await Promise.all([
        supabase.from('au_auditoria_producto_items').select('*').eq('auditoria_id', aid).range(0, 9999),
        supabase.from('au_auditoria_servicio').select('*').eq('auditoria_id', aid).maybeSingle(),
        supabase.from('au_auditoria_local').select('*').eq('auditoria_id', aid).maybeSingle(),
        supabase.from('au_evidencias').select('*').eq('auditoria_id', aid).range(0, 9999),
        loadTiempos(lid),
      ])

      setItems(itemsData ?? [])
      setServicio(servData)
      setLocalData(locData)
      setEvidencias(evidData ?? [])
      setTiemposMax(tiemposResult)
      setLoading(false)
    }
    loadAll()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auditoria.id])

  async function loadTiempos(lid: string): Promise<Record<TimeKey, number>> {
    const { data } = await supabase
      .from('au_config_tiempos')
      .select('*')
      .or(`local_id.is.null,local_id.eq.${lid}`)
    const rows: AuConfigTiempos[] = data ?? []
    const merged = { ...TIEMPOS_DEFAULT }
    const tipoMap: Record<string, TimeKey> = {
      ENTRANTE: 'entrante', PRINCIPAL: 'principal', BEBIDA: 'bebida', POSTRE: 'postre',
    }
    rows.filter(r => r.local_id === null).forEach(r => {
      const k = tipoMap[r.tipo]; if (k) merged[k] = r.max_min
    })
    rows.filter(r => r.local_id === lid).forEach(r => {
      const k = tipoMap[r.tipo]; if (k) merged[k] = r.max_min
    })
    return merged
  }

  /* ── Derivados ─────────────────────────────────────────────────────── */
  const fechaLabel = (() => {
    try {
      return new Date(auditoria.fecha + 'T12:00:00').toLocaleDateString('es-ES', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      })
    } catch { return auditoria.fecha }
  })()

  const total = auditoria.nota_total ?? 0
  const col   = semColor(total)

  const platoGroups = items.reduce((acc, item) => {
    if (!acc[item.plato_id]) acc[item.plato_id] = { nombre: item.plato_nombre, rows: [] }
    acc[item.plato_id].rows.push(item)
    return acc
  }, {} as Record<string, { nombre: string; rows: AuAuditoriaProductoItem[] }>)

  const evidByArea = (area: Area) => evidencias.filter(e => e.area === area)
  const obsByArea  = (area: Area) => obs.filter(o => o.area === area)

  /* ── Render ─────────────────────────────────────────────────────────── */
  return (
    <>
      {/* Modal backdrop + scroll container */}
      <div
        className="fixed inset-0 z-50 bg-black/60 overflow-y-auto"
        onClick={e => { if (e.target === e.currentTarget) onClose() }}
      >
        <div className="min-h-full flex items-start justify-center p-4 sm:py-8">
          <div
            className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* ── Cabecera ─────────────────────────────────────────── */}
            <div className="px-6 pt-6 pb-4 border-b border-navy/10">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h2
                    className="text-xl font-bold text-navy"
                    style={{ fontFamily: 'Poppins, sans-serif' }}
                  >
                    {localNombre}
                  </h2>
                  <p className="text-sm text-navy/50 mt-0.5 capitalize">{fechaLabel}</p>
                  <p className="text-xs text-navy/35 font-mono mt-1">
                    Auditor: {auditoria.auditor_cut}
                    {auditoria.mesero_nombre
                      ? <span className="ml-3 font-sans not-italic text-navy/40">Mesero: {auditoria.mesero_nombre}</span>
                      : null}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-shrink-0 w-8 h-8 rounded-full bg-navy/10 text-navy/50
                             hover:bg-navy/20 hover:text-navy transition flex items-center justify-center text-sm"
                >
                  ✕
                </button>
              </div>

              {/* Notas resumen */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <NotaCard label="Producto" valor={auditoria.nota_producto} max={20 / 3} />
                <NotaCard label="Servicio" valor={auditoria.nota_servicio} max={20 / 3} />
                <NotaCard label="Local"    valor={auditoria.nota_local}    max={20 / 3} />
                <div className={`rounded-xl p-3 text-center ${col.badge}`}>
                  <p className="text-[10px] font-bold uppercase tracking-wide opacity-70 mb-0.5">Total</p>
                  <p className="text-2xl font-bold tabular-nums">{total.toFixed(2)}</p>
                  <p className="text-xs opacity-60">/ 20</p>
                  <p className="text-[10px] font-semibold mt-0.5">
                    {total >= 16 ? 'Aprobado' : total >= 12 ? 'En riesgo' : 'Crítico'}
                  </p>
                </div>
              </div>
            </div>

            {/* ── Body ─────────────────────────────────────────────── */}
            {loading ? (
              <div className="flex items-center justify-center h-40">
                <div className="animate-spin w-6 h-6 rounded-full border-4 border-naranja border-t-transparent" />
              </div>
            ) : (
              <div className="p-6 space-y-4">

                {/* ── PRODUCTO ─────────────────────────────────────── */}
                <Seccion titulo="Producto" dot="bg-naranja" borde="border-naranja/30" fondo="bg-naranja/5">
                  {Object.keys(platoGroups).length === 0 ? (
                    <p className="text-sm text-navy/40 italic mb-4">No se evaluaron platos en esta auditoría.</p>
                  ) : (
                    <div className="space-y-4 mb-4">
                      {Object.entries(platoGroups).map(([pid, g]) => (
                        <div key={pid}>
                          <p className="text-sm font-semibold text-navy mb-2">{g.nombre}</p>
                          <div className="space-y-2">
                            {g.rows.map((item, idx) => (
                              <div key={idx} className="px-3 py-2.5 rounded-xl bg-white border border-navy/10">
                                <p className="text-xs font-semibold text-navy mb-2">{item.ingrediente_nombre}</p>
                                <div className="grid grid-cols-3 gap-2">
                                  <CheckGrid label="Contiene"      val={item.contiene} />
                                  <CheckGrid label="Limpieza"      val={item.limpieza} />
                                  <CheckGrid label="Peso adecuado" val={item.peso_adecuado} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <ObsRO      obs={obsByArea('PRODUCTO')} />
                  <OportRO    texto={auditoria.oportunidad_producto} />
                  <EvidRO evids={evidByArea('PRODUCTO')} onLightbox={setLightbox} />
                </Seccion>

                {/* ── SERVICIO ─────────────────────────────────────── */}
                <Seccion titulo="Servicio" dot="bg-ambar" borde="border-ambar/40" fondo="bg-ambar/5">
                  {servicio ? (
                    <>
                      <GrupoCheck titulo="Fidelización">
                        <CheckRow label="Speech de bienvenida" val={servicio.fid_speech} />
                        <CheckRow label="Nombre del camarero"  val={servicio.fid_nombre_camarero} />
                      </GrupoCheck>

                      <GrupoCheck titulo="Upselling">
                        <CheckRow label="Oferta de bebidas"     val={servicio.ups_bebidas} />
                        <CheckRow label="Comunicó meta del día" val={servicio.ups_meta_dia} />
                      </GrupoCheck>

                      <GrupoCheck titulo="Presentación">
                        <CheckRow label="Uniformes"          val={servicio.pres_uniformes} />
                        <CheckRow label="Cabellos recogidos" val={servicio.pres_cabellos} />
                        <CheckRow label="Uñas cuidadas"      val={servicio.pres_unas} />
                        <CheckRow label="Zapatos adecuados"  val={servicio.pres_zapatos} />
                        <CheckRow label="Barba / Maquillaje" val={servicio.pres_barba_o_maquillaje} />
                      </GrupoCheck>

                      <div className="mb-4">
                        <p className="text-xs font-semibold text-navy/50 uppercase tracking-wide mb-3">
                          Tiempos de atención
                        </p>
                        <div className="space-y-2.5">
                          <TiempoRO label="Entrante"        real={servicio.tiempo_entrante_min}  max={tiemposMax.entrante}  ok={servicio.tiempo_entrante_ok} />
                          <TiempoRO label="Plato principal" real={servicio.tiempo_principal_min} max={tiemposMax.principal} ok={servicio.tiempo_principal_ok} />
                          <TiempoRO label="Bebida"          real={servicio.tiempo_bebida_min}    max={tiemposMax.bebida}   ok={servicio.tiempo_bebida_ok} />
                          <TiempoRO label="Postre"          real={servicio.tiempo_postre_min}    max={tiemposMax.postre}   ok={servicio.tiempo_postre_ok} />
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-navy/40 italic mb-4">Sin datos de servicio.</p>
                  )}
                  <ObsRO   obs={obsByArea('SERVICIO')} />
                  <OportRO texto={auditoria.oportunidad_servicio} />
                  <EvidRO  evids={evidByArea('SERVICIO')} onLightbox={setLightbox} />
                </Seccion>

                {/* ── LOCAL ────────────────────────────────────────── */}
                <Seccion titulo="Local" dot="bg-navy" borde="border-navy/20" fondo="bg-navy/5">
                  {localData ? (
                    <>
                      <GrupoCheck titulo="Cartelería">
                        <CheckRow label="Carta actualizada" val={localData.cart_actualizada} />
                        <CheckRow label="Carta completa"    val={localData.cart_completa} />
                      </GrupoCheck>

                      <GrupoCheck titulo="Limpieza">
                        <CheckRow label="Sala"   val={localData.limp_sala} />
                        <CheckRow label="Baños"  val={localData.limp_banos} />
                        <CheckRow label="Barras" val={localData.limp_barras} />
                      </GrupoCheck>
                    </>
                  ) : (
                    <p className="text-sm text-navy/40 italic mb-4">Sin datos de local.</p>
                  )}
                  <ObsRO   obs={obsByArea('LOCAL')} />
                  <OportRO texto={auditoria.oportunidad_local} />
                  <EvidRO  evids={evidByArea('LOCAL')} onLightbox={setLightbox} />
                </Seccion>

              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[60] bg-black/85 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox}
            alt="evidencia ampliada"
            className="max-w-full max-h-full rounded-2xl object-contain shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 text-white
                       flex items-center justify-center hover:bg-white/35 transition text-lg"
          >
            ✕
          </button>
        </div>
      )}
    </>
  )
}

/* ── Sub-componentes ─────────────────────────────────────────────────────── */

function Seccion({
  titulo, dot, borde, fondo, children,
}: {
  titulo: string; dot: string; borde: string; fondo: string; children: React.ReactNode
}) {
  return (
    <div className={`rounded-2xl border-2 p-5 ${borde} ${fondo}`}>
      <div className="flex items-center gap-2 mb-4">
        <div className={`w-2.5 h-2.5 rounded-full ${dot}`} />
        <h3 className="text-sm font-bold text-navy uppercase tracking-wide">{titulo}</h3>
      </div>
      {children}
    </div>
  )
}

function GrupoCheck({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="text-xs font-semibold text-navy/50 uppercase tracking-wide mb-2">{titulo}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

function CheckGrid({ label, val }: { label: string; val: boolean | null }) {
  const ok = !!val
  return (
    <div className={`flex flex-col items-center gap-1 py-2 px-1 rounded-lg text-xs text-center border ${
      ok ? 'bg-green-50 border-green-200 text-green-800' : 'bg-white border-navy/15 text-navy/40'
    }`}>
      <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
        ok ? 'bg-green-500 text-white' : 'border-2 border-navy/20'
      }`}>
        {ok && (
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </span>
      {label}
    </div>
  )
}

function CheckRow({ label, val }: { label: string; val: boolean | null }) {
  const ok = !!val
  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm border ${
      ok ? 'bg-green-50 border-green-200 text-green-800' : 'bg-white border-navy/15 text-navy/50'
    }`}>
      <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
        ok ? 'bg-green-500 text-white' : 'border-2 border-navy/20'
      }`}>
        {ok && (
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </span>
      {label}
    </div>
  )
}

function TiempoRO({
  label, real, max, ok,
}: { label: string; real: number | null; max: number; ok: boolean | null }) {
  const okBool = !!ok
  return (
    <div className="flex items-center gap-3">
      <p className="text-xs text-navy/50 w-28 flex-shrink-0">{label}</p>
      <div className="flex-1 h-1.5 rounded-full bg-navy/10 overflow-hidden">
        {real !== null && (
          <div
            className={`h-full rounded-full transition-all ${okBool ? 'bg-green-400' : 'bg-terranova'}`}
            style={{ width: `${Math.min(100, (real / (max * 1.5)) * 100)}%` }}
          />
        )}
      </div>
      <span className="text-xs tabular-nums text-navy/60 text-right w-24 flex-shrink-0">
        {real !== null
          ? <><span className={okBool ? 'text-green-600 font-semibold' : 'text-terranova font-semibold'}>{real} min</span> / {max}</>
          : <span className="text-navy/25">— / {max}</span>
        }
      </span>
      <span className={`w-6 h-6 flex-shrink-0 rounded-full flex items-center justify-center ${
        real === null
          ? 'bg-navy/10 text-navy/30'
          : okBool
          ? 'bg-green-500 text-white'
          : 'bg-terranova text-white'
      }`}>
        {real !== null && (okBool
          ? <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        )}
      </span>
    </div>
  )
}

function ObsRO({ obs }: { obs: AuObservacion[] }) {
  if (obs.length === 0) return null
  return (
    <div className="mt-4 pt-4 border-t border-navy/10">
      <p className="text-xs font-semibold text-navy/40 uppercase tracking-wide mb-2">
        Observaciones ({obs.length})
      </p>
      <div className="space-y-2">
        {obs.map(o => (
          <div key={o.id} className="flex items-start gap-2">
            <span className={`flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide mt-0.5 ${SEV_BADGE[o.severidad]}`}>
              {o.severidad}
            </span>
            <p className="text-xs text-navy/60 leading-relaxed">{o.texto}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function OportRO({ texto }: { texto: string | null }) {
  if (!texto) return null
  return (
    <div className="mt-4 pt-4 border-t border-navy/10">
      <p className="text-xs font-semibold text-navy/40 uppercase tracking-wide mb-2">
        Oportunidades de mejora
      </p>
      <p className="text-sm text-navy/60 leading-relaxed whitespace-pre-wrap">{texto}</p>
    </div>
  )
}

function EvidRO({ evids, onLightbox }: { evids: AuEvidencia[]; onLightbox: (url: string) => void }) {
  if (evids.length === 0) return null
  return (
    <div className="mt-4 pt-4 border-t border-navy/10">
      <p className="text-xs font-semibold text-navy/40 uppercase tracking-wide mb-2">
        Evidencias ({evids.length})
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {evids.map(ev => (
          <div key={ev.id} className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => onLightbox(ev.url)}
              className="aspect-square rounded-xl overflow-hidden border border-navy/10 hover:opacity-80 transition"
            >
              <img src={ev.url} alt="evidencia" className="w-full h-full object-cover" />
            </button>
            {ev.etiqueta && (
              <p className="text-[10px] text-center text-navy/50 leading-tight px-0.5 truncate"
                 title={ev.etiqueta}>
                {ev.etiqueta}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function NotaCard({ label, valor, max }: { label: string; valor: number | null; max: number }) {
  const v   = valor ?? 0
  const pct = Math.min(100, (v / max) * 100)
  const col = semColor(v * (20 / 3) / (20 / 3))
  const barColor = v >= max * 0.8 ? 'bg-green-400' : v >= max * 0.6 ? 'bg-ambar' : 'bg-terranova'
  const txtColor = v >= max * 0.8 ? 'text-green-600' : v >= max * 0.6 ? 'text-ambar' : 'text-terranova'
  void col
  return (
    <div className="rounded-xl bg-navy/5 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-navy/50 mb-1">{label}</p>
      <p className={`text-xl font-bold tabular-nums ${txtColor}`}>{v.toFixed(2)}</p>
      <p className="text-[10px] text-navy/30">/ {max.toFixed(2)}</p>
      <div className="mt-1.5 h-1.5 rounded-full bg-navy/10 overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
