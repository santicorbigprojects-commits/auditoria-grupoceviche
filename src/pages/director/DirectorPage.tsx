import { useState, useEffect } from 'react'
import SidebarLayout, { type NavItem } from '../../components/ui/SidebarLayout'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import type { AuLocal, AuMarca, AuAuditoria, AuObservacion } from '../../types'
import DetalleAuditoria from '../../components/director/DetalleAuditoria'
import ConfirmModal from '../../components/ui/ConfirmModal'
import { eliminarAuditoria } from '../../lib/eliminarAuditoria'
import AccionesMejoraPage from '../AccionesMejoraPage'

type Tab = 'historial' | 'acciones'

/* ── Helpers ───────────────────────────────────────────────────────────── */
function semColor(nota: number) {
  if (nota >= 16) return { dot: 'bg-green-500',  badge: 'bg-green-100 text-green-700'    }
  if (nota >= 12) return { dot: 'bg-ambar',       badge: 'bg-ambar/15 text-ambar'        }
  return               { dot: 'bg-terranova',    badge: 'bg-terranova/10 text-terranova' }
}

interface LatestAud { fecha: string; nota_total: number }

/* ── Componente ────────────────────────────────────────────────────────── */
export default function DirectorPage() {
  const { cut, rol } = useAuthStore()

  const [tab, setTab] = useState<Tab>('historial')

  const [locales,       setLocales]       = useState<AuLocal[]>([])
  const [marcas,        setMarcas]        = useState<AuMarca[]>([])
  const [latestByLocal, setLatestByLocal] = useState<Record<string, LatestAud>>({})
  const [loading,       setLoading]       = useState(true)

  const [selLocalId, setSelLocalId] = useState<string | null>(null)
  const [auditorias, setAuditorias] = useState<AuAuditoria[]>([])
  const [obsMap,     setObsMap]     = useState<Record<string, AuObservacion[]>>({})
  const [loadingDet, setLoadingDet] = useState(false)

  const [detalleAud, setDetalleAud] = useState<AuAuditoria | null>(null)

  const [aEliminar,     setAEliminar]     = useState<AuAuditoria | null>(null)
  const [eliminando,    setEliminando]    = useState(false)
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null)

  /* ── Carga inicial ─────────────────────────────────────────────────── */
  useEffect(() => {
    async function load() {
      const { data: m } = await supabase.from('au_marcas').select('*').order('nombre')
      setMarcas(m ?? [])

      let localesList: AuLocal[] = []
      let localIds: string[]     = []

      if (rol === 'ADMIN') {
        const { data: l } = await supabase
          .from('au_locales').select('*').eq('activo', true).order('nombre')
        localesList = l ?? []
        localIds    = localesList.map(x => x.id)
      } else {
        const { data: dl } = await supabase
          .from('au_director_locales')
          .select('local_id')
          .eq('director_cut', cut!)
        const ids = (dl ?? []).map(r => r.local_id)
        if (ids.length > 0) {
          const { data: l } = await supabase
            .from('au_locales').select('*').in('id', ids).eq('activo', true).order('nombre')
          localesList = l ?? []
          localIds    = ids
        }
      }

      setLocales(localesList)

      if (localIds.length > 0) {
        const { data: auds } = await supabase
          .from('au_auditorias')
          .select('local_id, fecha, nota_total')
          .in('local_id', localIds)
          .order('fecha', { ascending: false })
          .range(0, 9999)

        const latest: Record<string, LatestAud> = {}
        for (const a of (auds ?? [])) {
          if (a.nota_total !== null && !latest[a.local_id]) {
            latest[a.local_id] = { fecha: a.fecha, nota_total: a.nota_total }
          }
        }
        setLatestByLocal(latest)
      }

      setLoading(false)
    }
    load()
  }, [cut, rol])

  /* ── Carga historial del local seleccionado ────────────────────────── */
  async function loadDetail(localId: string) {
    setLoadingDet(true)

    const { data: auds } = await supabase
      .from('au_auditorias')
      .select('*')
      .eq('local_id', localId)
      .order('fecha', { ascending: false })
      .range(0, 9999)

    const list = auds ?? []
    setAuditorias(list)

    if (list.length > 0) {
      const { data: obs } = await supabase
        .from('au_observaciones')
        .select('*')
        .in('auditoria_id', list.map(a => a.id))
        .range(0, 9999)

      const grouped: Record<string, AuObservacion[]> = {}
      for (const o of (obs ?? [])) {
        if (!grouped[o.auditoria_id]) grouped[o.auditoria_id] = []
        grouped[o.auditoria_id].push(o)
      }
      setObsMap(grouped)
    } else {
      setObsMap({})
    }

    setLoadingDet(false)
  }

  useEffect(() => {
    if (!selLocalId) return
    loadDetail(selLocalId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selLocalId])

  async function handleEliminar() {
    if (!aEliminar) return
    setEliminando(true)
    setErrorEliminar(null)
    try {
      await eliminarAuditoria(aEliminar.id)
      setAEliminar(null)
      if (selLocalId) await loadDetail(selLocalId)
    } catch (err) {
      console.error(err)
      setErrorEliminar('Error al eliminar la auditoría. Intenta de nuevo.')
    } finally {
      setEliminando(false)
    }
  }

  /* ── Derivados ─────────────────────────────────────────────────────── */
  const marcaMap: Record<string, string> = Object.fromEntries(marcas.map(m => [m.id, m.nombre]))
  const selLocal = locales.find(l => l.id === selLocalId)

  const navItems: NavItem[] = [
    {
      label:   'Historial',
      icon:    <IconHistorial />,
      onClick: () => setTab('historial'),
      active:  tab === 'historial',
    },
    {
      label:   'Acciones de mejora',
      icon:    <IconAcciones />,
      onClick: () => setTab('acciones'),
      active:  tab === 'acciones',
    },
  ]

  /* ── Render ────────────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 rounded-full border-4 border-naranja border-t-transparent" />
      </div>
    )
  }

  return (
    <SidebarLayout navItems={navItems}>
      {tab === 'acciones' ? (
        <AccionesMejoraPage />
      ) : (
      <div className="p-6 max-w-6xl mx-auto">

        <div className="mb-6">
          <h2 className="text-2xl font-bold text-navy" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Historial de auditorías
          </h2>
          <p className="text-sm text-navy/40 mt-0.5">
            {rol === 'ADMIN' ? 'Todos los locales' : 'Locales asignados a tu cuenta'}
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[260px_1fr] gap-6 items-start">

          {/* ── Lista de locales ──────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-navy/10 shadow-sm overflow-hidden xl:sticky xl:top-6">
            <div className="px-4 py-3 border-b border-navy/10">
              <p className="text-[10px] font-bold text-navy/35 uppercase tracking-wide">Locales</p>
            </div>
            <div className="divide-y divide-navy/[0.06] max-h-[600px] overflow-y-auto">
              {locales.length === 0 && (
                <p className="px-4 py-8 text-sm text-navy/30 text-center">Sin locales asignados.</p>
              )}
              {locales.map(l => {
                const latest = latestByLocal[l.id]
                const isSel  = l.id === selLocalId
                const col    = latest ? semColor(latest.nota_total) : null
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setSelLocalId(l.id)}
                    className={`w-full text-left px-4 py-3 transition ${
                      isSel ? 'bg-naranja/10' : 'hover:bg-navy/[0.03]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className={`text-sm font-semibold truncate ${isSel ? 'text-naranja' : 'text-navy'}`}>
                          {l.nombre}
                        </p>
                        <p className="text-xs text-navy/35 truncate mt-0.5">
                          {marcaMap[l.marca_id] ?? ''}
                        </p>
                      </div>
                      {col && latest ? (
                        <div className="flex-shrink-0 flex flex-col items-end gap-1">
                          <span className={`text-sm font-bold tabular-nums ${col.badge.split(' ')[1]}`}>
                            {latest.nota_total.toFixed(1)}
                          </span>
                          <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                        </div>
                      ) : (
                        <span className="flex-shrink-0 text-xs text-navy/20">–</span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Panel de historial ────────────────────────────────────── */}
          {!selLocalId ? (
            <div className="bg-white rounded-2xl border border-navy/10 p-10 text-center">
              <svg className="w-10 h-10 text-navy/15 mx-auto mb-3" fill="none" viewBox="0 0 24 24"
                stroke="currentColor" strokeWidth={1.2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-sm text-navy/30">Selecciona un local para ver su historial.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-navy/10 shadow-sm overflow-hidden">

              {/* Cabecera del local */}
              <div className="px-6 py-4 border-b border-navy/10 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-navy" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    {selLocal?.nombre}
                  </h3>
                  <p className="text-xs text-navy/40 mt-0.5">{marcaMap[selLocal?.marca_id ?? ''] ?? ''}</p>
                </div>
                {latestByLocal[selLocalId] && (() => {
                  const col = semColor(latestByLocal[selLocalId].nota_total)
                  return (
                    <div className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-sm font-bold ${col.badge}`}>
                      {latestByLocal[selLocalId].nota_total.toFixed(1)}
                      <span className="font-normal opacity-60"> / 20</span>
                    </div>
                  )
                })()}
              </div>

              {/* Cuerpo */}
              {loadingDet ? (
                <div className="flex items-center justify-center h-40">
                  <div className="animate-spin w-6 h-6 rounded-full border-4 border-naranja border-t-transparent" />
                </div>
              ) : auditorias.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <p className="text-sm text-navy/30">Sin auditorías registradas para este local.</p>
                </div>
              ) : (
                <>
                  {/* Cabecera de columnas */}
                  <div className="hidden sm:grid grid-cols-[1fr_72px_72px_72px_100px_90px] gap-3
                                  px-6 py-2.5 border-b border-navy/10 bg-navy/[0.02]">
                    {['Fecha / Auditor', 'Producto', 'Servicio', 'Local', 'Total', ''].map(h => (
                      <span key={h} className="text-[10px] font-bold text-navy/35 uppercase tracking-wide">{h}</span>
                    ))}
                  </div>

                  {/* Filas */}
                  <div className="divide-y divide-navy/[0.06]">
                    {auditorias.map(a => {
                      const total = a.nota_total ?? 0
                      const col   = semColor(total)

                      const fechaFmt = (() => {
                        try {
                          return new Date(a.fecha + 'T12:00:00').toLocaleDateString('es-ES', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })
                        } catch { return a.fecha }
                      })()

                      return (
                        <div
                          key={a.id}
                          className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_72px_72px_72px_100px_90px]
                                     gap-3 px-6 py-3.5 items-center"
                        >
                          {/* Fecha + auditor */}
                          <div>
                            <p className="text-sm font-semibold text-navy capitalize">{fechaFmt}</p>
                            <p className="text-xs text-navy/35 font-mono mt-0.5">{a.auditor_cut}</p>
                          </div>

                          {/* Notas de área */}
                          <span className="hidden sm:block text-sm tabular-nums text-navy/60 font-medium">
                            {a.nota_producto?.toFixed(2) ?? '–'}
                          </span>
                          <span className="hidden sm:block text-sm tabular-nums text-navy/60 font-medium">
                            {a.nota_servicio?.toFixed(2) ?? '–'}
                          </span>
                          <span className="hidden sm:block text-sm tabular-nums text-navy/60 font-medium">
                            {a.nota_local?.toFixed(2) ?? '–'}
                          </span>

                          {/* Total semáforo */}
                          <span className={`inline-flex items-baseline gap-0.5 px-2.5 py-1 rounded-lg
                                           text-sm font-bold tabular-nums w-fit ${col.badge}`}>
                            {total.toFixed(1)}
                            <span className="text-xs font-normal opacity-60">/20</span>
                          </span>

                          {/* Ver detalle / Eliminar */}
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setDetalleAud(a)}
                              className="text-xs px-3 py-1.5 rounded-lg border border-navy/20 text-navy/55
                                         hover:border-naranja hover:text-naranja transition font-medium whitespace-nowrap"
                            >
                              Ver detalle
                            </button>
                            {rol === 'ADMIN' && (
                              <button
                                type="button"
                                onClick={() => setAEliminar(a)}
                                className="text-xs px-3 py-1.5 rounded-lg border border-navy/20 text-navy/55
                                           hover:border-terranova hover:text-terranova transition font-medium whitespace-nowrap"
                              >
                                Eliminar
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      )}

      {/* Modal detalle */}
      {detalleAud && (
        <DetalleAuditoria
          auditoria={detalleAud}
          localNombre={selLocal?.nombre ?? ''}
          obs={obsMap[detalleAud.id] ?? []}
          onClose={() => setDetalleAud(null)}
        />
      )}

      {/* Modal confirmar eliminación (solo ADMIN) */}
      {aEliminar && (
        <ConfirmModal
          titulo="Eliminar auditoría"
          mensaje="Esto eliminará la auditoría y sus fotos de forma permanente. ¿Continuar?"
          confirmando={eliminando}
          error={errorEliminar}
          onConfirm={handleEliminar}
          onCancel={() => { setAEliminar(null); setErrorEliminar(null) }}
        />
      )}
    </SidebarLayout>
  )
}

function IconHistorial() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  )
}

function IconAcciones() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}
