import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import {
  useAuditoriaStore,
  type ProductoItemDraft,
  type ServicioDraft,
  type LocalDraft,
  type ObservacionDraft,
  type EvidenciaDraft,
} from '../../store/auditoriaStore'
import {
  calcularNotaProducto,
  calcularNotaServicio,
  calcularNotaLocal,
  calcularNotaTotal,
  calcularDescuentoRevisionInterna,
  type ObservacionCalculo,
  type ObservacionRI,
  type ConfigRI,
} from '../../lib/calculo'
import type {
  AuAuditoria,
  AuCombo,
  AuPlato,
  AuConfigSeveridad,
  AuConfigRI,
  AuConfigTiempos,
  Area,
  AspectoRI,
  Severidad,
} from '../../types'
import SeccionProducto, {
  type PlatoConIngredientes,
  type ComboConSlots,
  type SlotConOpciones,
} from '../../components/auditoria/SeccionProducto'
import SeccionServicio from '../../components/auditoria/SeccionServicio'
import SeccionLocal from '../../components/auditoria/SeccionLocal'
import SeccionRevisionInterna from '../../components/auditoria/SeccionRevisionInterna'
import PanelNotas from '../../components/auditoria/PanelNotas'
import ConfirmModal from '../../components/ui/ConfirmModal'
import { eliminarAuditoria } from '../../lib/eliminarAuditoria'
import { exportarAuditoriasExcel } from '../../lib/exportarExcel'
import { exportarAuditoriaPDF } from '../../lib/exportarPDF'

const CONFIG_RI_DEFAULT: ConfigRI = { RI_REVISION: 2, RI_ROTULACION: 2, RI_HIGIENE: 3 }

function esAreaPrincipal(area: Area | AspectoRI): area is Area {
  return area === 'PRODUCTO' || area === 'SERVICIO' || area === 'LOCAL'
}

type Vista = 'lista' | 'editando'
type TimeKey = 'entrante' | 'principal' | 'bebida' | 'postre'
type TimeKeyCholito = 'sandwich' | 'jugos'
type TimeKeyAll = TimeKey | TimeKeyCholito

const TIEMPOS_DEFAULT: Record<TimeKeyAll, number> = {
  entrante: 10, principal: 20, bebida: 5, postre: 10, sandwich: 10, jugos: 5,
}

function pathFromUrl(url: string): string {
  const marker = '/au-evidencias/'
  const idx = url.indexOf(marker)
  return idx >= 0 ? url.slice(idx + marker.length) : url
}

/* ══════════════════════════════════════════════════════════════════════════
   Root
══════════════════════════════════════════════════════════════════════════ */

export default function MisAuditoriasPage() {
  const [vista,       setVista]       = useState<Vista>('lista')
  const [seleccionada, setSeleccionada] = useState<AuAuditoria | null>(null)
  const [localNombre, setLocalNombre] = useState('')

  function handleEditar(a: AuAuditoria, nombre: string) {
    setSeleccionada(a)
    setLocalNombre(nombre)
    setVista('editando')
  }

  return vista === 'lista'
    ? <ListaAuditorias onEditar={handleEditar} />
    : (
      <EditarAuditoria
        auditoria={seleccionada!}
        localNombre={localNombre}
        onBack={() => setVista('lista')}
      />
    )
}

/* ══════════════════════════════════════════════════════════════════════════
   Lista
══════════════════════════════════════════════════════════════════════════ */

interface ListaProps {
  onEditar: (a: AuAuditoria, localNombre: string) => void
}

function ListaAuditorias({ onEditar }: ListaProps) {
  const { cut, rol } = useAuthStore()
  const [auditorias, setAuditorias] = useState<AuAuditoria[]>([])
  const [localesMap,  setLocalesMap]  = useState<Record<string, string>>({})
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [aEliminar,   setAEliminar]   = useState<AuAuditoria | null>(null)
  const [eliminando,  setEliminando]  = useState(false)
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null)
  const [exportando,  setExportando]  = useState(false)
  const [errorExport, setErrorExport] = useState<string | null>(null)

  async function handleExportar() {
    if (!cut || !rol) return
    setExportando(true)
    setErrorExport(null)
    try {
      await exportarAuditoriasExcel(cut, rol)
    } catch (err) {
      console.error(err)
      setErrorExport(err instanceof Error ? err.message : 'Error al exportar. Intenta de nuevo.')
    } finally {
      setExportando(false)
    }
  }

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [{ data: auds, error: e1 }, { data: locs, error: e2 }] = await Promise.all([
        supabase
          .from('au_auditorias')
          .select('*')
          .eq('auditor_cut', cut!)
          .order('fecha', { ascending: false })
          .order('creado_en', { ascending: false })
          .range(0, 9999),
        supabase.from('au_locales').select('id, nombre'),
      ])
      if (e1) throw e1
      if (e2) throw e2
      setAuditorias(auds ?? [])
      const map: Record<string, string> = {}
      ;(locs ?? []).forEach((l: { id: string; nombre: string }) => { map[l.id] = l.nombre })
      setLocalesMap(map)
    } catch (err) {
      console.error(err)
      setError('Error cargando historial. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cut])

  async function handleEliminar() {
    if (!aEliminar) return
    setEliminando(true)
    setErrorEliminar(null)
    try {
      await eliminarAuditoria(aEliminar.id)
      setAEliminar(null)
      await load()
    } catch (err) {
      console.error(err)
      setErrorEliminar('Error al eliminar la auditoría. Intenta de nuevo.')
    } finally {
      setEliminando(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 rounded-full border-4 border-naranja border-t-transparent" />
      </div>
    )
  }

  if (error) {
    return <div className="p-6 text-center text-terranova text-sm">{error}</div>
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-navy" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Mis auditorías
          </h2>
          <p className="text-sm text-navy/40 mt-0.5">
            {auditorias.length} {auditorias.length === 1 ? 'registrada' : 'registradas'}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <button
            type="button"
            onClick={handleExportar}
            disabled={exportando || auditorias.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-navy text-white text-sm font-semibold
                       hover:bg-navy/85 disabled:opacity-40 transition whitespace-nowrap"
          >
            {exportando ? (
              <span className="animate-spin w-4 h-4 rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            )}
            {exportando ? 'Exportando…' : 'Exportar a Excel'}
          </button>
          {errorExport && (
            <p className="text-xs text-terranova max-w-[240px] text-right">{errorExport}</p>
          )}
        </div>
      </div>

      {auditorias.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-navy/15 p-10 text-center">
          <p className="text-navy/30 text-sm">No tienes auditorías registradas aún.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-navy/10 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy/10">
                <th className="text-left px-5 py-3 text-xs font-semibold text-navy/40 uppercase tracking-wide">Fecha</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-navy/40 uppercase tracking-wide">Local</th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-navy/40 uppercase tracking-wide">P</th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-navy/40 uppercase tracking-wide">S</th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-navy/40 uppercase tracking-wide">L</th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-navy/40 uppercase tracking-wide">Total</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-navy/5">
              {auditorias.map(a => (
                <FilaAuditoria
                  key={a.id}
                  auditoria={a}
                  localNombre={localesMap[a.local_id] ?? '—'}
                  onEditar={() => onEditar(a, localesMap[a.local_id] ?? '—')}
                  onEliminar={() => setAEliminar(a)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

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
    </div>
  )
}

function FilaAuditoria({
  auditoria: a,
  localNombre,
  onEditar,
  onEliminar,
}: { auditoria: AuAuditoria; localNombre: string; onEditar: () => void; onEliminar: () => void }) {
  const total = a.nota_total ?? 0
  const [exportandoPDF, setExportandoPDF] = useState(false)
  const [errorPDF,      setErrorPDF]      = useState<string | null>(null)

  const fechaLabel = (() => {
    try {
      return new Date(a.fecha + 'T12:00:00').toLocaleDateString('es-ES', {
        day: '2-digit', month: '2-digit', year: 'numeric',
      })
    } catch { return a.fecha }
  })()

  const semaforoColor = total >= 16 ? 'bg-green-500' : total >= 12 ? 'bg-ambar' : 'bg-terranova'
  const totalColor    = total >= 16 ? 'text-green-600' : total >= 12 ? 'text-ambar' : 'text-terranova'

  async function handleExportarPDF() {
    setExportandoPDF(true)
    setErrorPDF(null)
    try {
      await exportarAuditoriaPDF(a, localNombre)
    } catch (err) {
      console.error(err)
      setErrorPDF('Error al generar el PDF. Intenta de nuevo.')
    } finally {
      setExportandoPDF(false)
    }
  }

  return (
    <tr className="hover:bg-navy/5 transition-colors">
      <td className="px-5 py-3.5 text-navy font-medium whitespace-nowrap">{fechaLabel}</td>
      <td className="px-5 py-3.5 text-navy/70 max-w-[200px] truncate">{localNombre}</td>
      <td className="px-3 py-3.5 text-center text-navy/55 tabular-nums">
        {a.nota_producto?.toFixed(2) ?? '—'}
      </td>
      <td className="px-3 py-3.5 text-center text-navy/55 tabular-nums">
        {a.nota_servicio?.toFixed(2) ?? '—'}
      </td>
      <td className="px-3 py-3.5 text-center text-navy/55 tabular-nums">
        {a.nota_local?.toFixed(2) ?? '—'}
      </td>
      <td className="px-3 py-3.5 text-center">
        <span className={`font-bold tabular-nums ${totalColor}`}>
          {a.nota_total?.toFixed(2) ?? '—'}
        </span>
        {a.nota_total !== null && (
          <span className={`ml-2 inline-block w-2 h-2 rounded-full align-middle ${semaforoColor}`} />
        )}
      </td>
      <td className="px-4 py-3.5">
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleExportarPDF}
            disabled={exportandoPDF}
            title="Exportar a PDF"
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-navy/20 text-navy/55
                       hover:border-navy hover:text-navy transition font-medium whitespace-nowrap disabled:opacity-40"
          >
            {exportandoPDF ? (
              <span className="animate-spin w-3 h-3 rounded-full border-2 border-navy/30 border-t-navy" />
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            )}
            Exportar
          </button>
          <button
            type="button"
            onClick={onEditar}
            className="text-xs px-3 py-1.5 rounded-lg border border-navy/20 text-navy/55
                       hover:border-naranja hover:text-naranja transition font-medium whitespace-nowrap"
          >
            Editar
          </button>
          <button
            type="button"
            onClick={onEliminar}
            className="text-xs px-3 py-1.5 rounded-lg border border-navy/20 text-navy/55
                       hover:border-terranova hover:text-terranova transition font-medium whitespace-nowrap"
          >
            Eliminar
          </button>
        </div>
        {errorPDF && (
          <p className="text-[10px] text-terranova text-right mt-1 max-w-[220px] ml-auto">{errorPDF}</p>
        )}
      </td>
    </tr>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   Editar
══════════════════════════════════════════════════════════════════════════ */

interface EditarProps {
  auditoria:   AuAuditoria
  localNombre: string
  onBack:      () => void
}

function EditarAuditoria({ auditoria, localNombre, onBack }: EditarProps) {
  const store = useAuditoriaStore()

  const [loading,   setLoading]   = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [platos,              setPlatos]              = useState<PlatoConIngredientes[]>([])
  const [combos,              setCombos]              = useState<ComboConSlots[]>([])
  const [platosSeleccionados, setPlatosSeleccionados] = useState<Set<string>>(new Set())
  const [combosSeleccionados, setCombosSeleccionados] = useState<Set<string>>(new Set())
  const [slotPlatoElegido,    setSlotPlatoElegido]    = useState<Map<string, string>>(new Map())
  const [tiemposMax,          setTiemposMax]          = useState<Record<TimeKeyAll, number>>({ ...TIEMPOS_DEFAULT })
  const [configSev,           setConfigSev]           = useState<AuConfigSeveridad[]>([])
  const [configRI,            setConfigRI]            = useState<ConfigRI>(CONFIG_RI_DEFAULT)
  const [esCholito,           setEsCholito]           = useState(false)

  const [guardando,    setGuardando]    = useState(false)
  const [guardadoOk,   setGuardadoOk]   = useState(false)
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null)

  /* ── Carga inicial ────────────────────────────────────────────────────── */
  useEffect(() => {
    async function loadAll() {
      setLoading(true)
      setLoadError(null)
      try {
        const aid = auditoria.id
        const lid = auditoria.local_id

        const [
          { data: itemsData },
          { data: servData  },
          { data: locData   },
          { data: obsData   },
          { data: evidData  },
          { data: sevData   },
          { data: riData    },
          { data: auLocalData },
          platosResult,
          combosResult,
          tiemposResult,
        ] = await Promise.all([
          supabase.from('au_auditoria_producto_items').select('*').eq('auditoria_id', aid).range(0, 9999),
          supabase.from('au_auditoria_servicio').select('*').eq('auditoria_id', aid).maybeSingle(),
          supabase.from('au_auditoria_local').select('*').eq('auditoria_id', aid).maybeSingle(),
          supabase.from('au_observaciones').select('*').eq('auditoria_id', aid).range(0, 9999),
          supabase.from('au_evidencias').select('*').eq('auditoria_id', aid).range(0, 9999),
          supabase.from('au_config_severidad').select('*'),
          supabase.from('au_config_ri').select('*'),
          supabase.from('au_locales').select('marca_id').eq('id', lid).maybeSingle(),
          cargarPlatos(lid),
          cargarCombos(lid),
          cargarTiempos(lid),
        ])

        setEsCholito(auLocalData?.marca_id === 'cholito')
        if (sevData) setConfigSev(sevData)
        if (riData) {
          const merged = { ...CONFIG_RI_DEFAULT }
          ;(riData as AuConfigRI[]).forEach(r => { merged[r.aspecto] = r.max_descuento })
          setConfigRI(merged)
        }
        setPlatos(platosResult)
        setCombos(combosResult)
        setTiemposMax(tiemposResult)

        const productoItems: ProductoItemDraft[] = (itemsData ?? []).map((i: {
          plato_id: string; plato_nombre: string; ingrediente_nombre: string;
          contiene: boolean | null; combo_nombre: string | null; slot_nombre: string | null;
        }) => ({
          plato_id:           i.plato_id,
          plato_nombre:       i.plato_nombre,
          ingrediente_nombre: i.ingrediente_nombre,
          contiene:           i.contiene ?? false,
          combo_nombre:       i.combo_nombre ?? undefined,
          slot_nombre:        i.slot_nombre  ?? undefined,
        }))

        const servicio: ServicioDraft = {
          fid_speech:              servData?.fid_speech              ?? false,
          fid_nombre_camarero:     servData?.fid_nombre_camarero     ?? false,
          fid_tarjeta:             servData?.fid_tarjeta             ?? false,
          ups_bebidas:             servData?.ups_bebidas             ?? false,
          ups_meta_dia:            servData?.ups_meta_dia            ?? false,
          pres_uniformes:          servData?.pres_uniformes          ?? false,
          pres_cabellos:           servData?.pres_cabellos           ?? false,
          pres_unas:               servData?.pres_unas               ?? false,
          pres_zapatos:            servData?.pres_zapatos            ?? false,
          pres_barba_o_maquillaje: servData?.pres_barba_o_maquillaje ?? false,
          tiempo_entrante_min:     servData?.tiempo_entrante_min     ?? null,
          tiempo_principal_min:    servData?.tiempo_principal_min    ?? null,
          tiempo_bebida_min:       servData?.tiempo_bebida_min       ?? null,
          tiempo_postre_min:       servData?.tiempo_postre_min       ?? null,
          tiempo_entrante_ok:      servData?.tiempo_entrante_ok      ?? false,
          tiempo_principal_ok:     servData?.tiempo_principal_ok     ?? false,
          tiempo_bebida_ok:        servData?.tiempo_bebida_ok        ?? false,
          tiempo_postre_ok:        servData?.tiempo_postre_ok        ?? false,
          // Retrocompatibilidad: auditorías viejas sin estos flags (NULL) →
          // tiempos base activos, sándwich/jugos no aplica. Igual que en calculo.ts.
          tiempos_base_activo:     servData?.tiempos_base_activo    !== false,
          tiempo_sandwich_activo:  servData?.tiempo_sandwich_activo === true,
          tiempo_jugos_activo:     servData?.tiempo_jugos_activo    === true,
          tiempo_sandwich_min:     servData?.tiempo_sandwich_min     ?? null,
          tiempo_jugos_min:        servData?.tiempo_jugos_min        ?? null,
          tiempo_sandwich_ok:      servData?.tiempo_sandwich_ok      ?? false,
          tiempo_jugos_ok:         servData?.tiempo_jugos_ok         ?? false,
        }

        const localChecklist: LocalDraft = {
          cart_actualizada: locData?.cart_actualizada ?? false,
          cart_completa:    locData?.cart_completa    ?? false,
          limp_sala:        locData?.limp_sala        ?? false,
          limp_banos:       locData?.limp_banos       ?? false,
          limp_barras:      locData?.limp_barras      ?? false,
          limp_cocina:      locData?.limp_cocina      ?? false,
        }

        const observaciones: ObservacionDraft[] = (obsData ?? []).map((o: {
          id: string; area: string; texto: string; severidad: string; extrema_modo: string | null
        }) => ({
          id:           o.id,
          area:         o.area      as Area | AspectoRI,
          texto:        o.texto,
          severidad:    o.severidad as Severidad,
          extrema_modo: o.extrema_modo as ObservacionDraft['extrema_modo'],
        }))

        const evidenciasMapeadas: Record<Area | 'REVISION_INTERNA', EvidenciaDraft[]> = {
          PRODUCTO: [], SERVICIO: [], LOCAL: [], REVISION_INTERNA: [],
        }
        for (const ev of (evidData ?? [])) {
          const area = ev.area as Area | 'REVISION_INTERNA'
          evidenciasMapeadas[area].push({ path: pathFromUrl(ev.url), url: ev.url, etiqueta: ev.etiqueta ?? undefined })
        }

        store.loadFromDB({
          local_id:             lid,
          fecha:                auditoria.fecha,
          mesero_nombre:        auditoria.mesero_nombre ?? '',
          productoItems,
          servicio,
          localChecklist,
          observaciones,
          oportunidad_producto: auditoria.oportunidad_producto ?? '',
          oportunidad_servicio: auditoria.oportunidad_servicio ?? '',
          oportunidad_local:    auditoria.oportunidad_local    ?? '',
          evidencias:           evidenciasMapeadas,
          riConforme: {
            RI_REVISION:   auditoria.ri_revision_conforme   ?? false,
            RI_ROTULACION: auditoria.ri_rotulacion_conforme ?? false,
            RI_HIGIENE:    auditoria.ri_higiene_conforme    ?? false,
          },
          riComentario: {
            RI_REVISION:   auditoria.ri_revision_comentario   ?? '',
            RI_ROTULACION: auditoria.ri_rotulacion_comentario ?? '',
            RI_HIGIENE:    auditoria.ri_higiene_comentario    ?? '',
          },
        })

        // Solo platos sueltos (sin slot) para platosSeleccionados
        const pids = new Set(productoItems.filter(i => !i.slot_nombre).map(i => i.plato_id))
        setPlatosSeleccionados(pids)

        // Reconstruir combosSeleccionados por nombre snapshot
        const savedComboNombres = new Set(
          productoItems.filter(i => i.combo_nombre).map(i => i.combo_nombre as string)
        )
        const selCombos = new Set<string>()
        combosResult.forEach(c => { if (savedComboNombres.has(c.nombre)) selCombos.add(c.id) })
        setCombosSeleccionados(selCombos)

        // Reconstruir slotPlatoElegido por plato_id guardado en cada slot
        const spe = new Map<string, string>()
        combosResult.forEach(combo => {
          combo.slots.forEach(slot => {
            const matchItem = productoItems.find(i => i.combo_nombre === combo.nombre && i.slot_nombre === slot.nombre)
            if (matchItem && slot.opciones.some(p => p.id === matchItem.plato_id)) {
              spe.set(slot.id, matchItem.plato_id)
            }
          })
        })
        setSlotPlatoElegido(spe)

      } catch (err) {
        console.error(err)
        setLoadError('Error cargando la auditoría. Intenta de nuevo.')
      } finally {
        setLoading(false)
      }
    }
    loadAll()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auditoria.id])

  /* ── Helpers de carga ─────────────────────────────────────────────────── */
  async function cargarPlatos(lid: string): Promise<PlatoConIngredientes[]> {
    const { data: pl } = await supabase
      .from('au_plato_locales')
      .select('plato_id')
      .eq('local_id', lid)
    if (!pl || pl.length === 0) return []
    const ids = pl.map((r: { plato_id: string }) => r.plato_id)
    const [{ data: platosData }, { data: ingsData }] = await Promise.all([
      supabase.from('au_platos').select('*').in('id', ids).eq('activo', true).order('nombre'),
      supabase.from('au_plato_ingredientes').select('*').in('plato_id', ids).eq('activo', true).order('orden'),
    ])
    return (platosData ?? []).map((p: { id: string }) => ({
      ...p,
      ingredientes: (ingsData ?? []).filter((i: { plato_id: string }) => i.plato_id === p.id),
    })) as PlatoConIngredientes[]
  }

  async function cargarCombos(lid: string): Promise<ComboConSlots[]> {
    const { data: cl } = await supabase.from('au_combo_locales').select('combo_id').eq('local_id', lid)
    if (!cl || cl.length === 0) return []
    const comboIds = cl.map((r: { combo_id: string }) => r.combo_id)
    const [{ data: combosData }, { data: slotsData }] = await Promise.all([
      supabase.from('au_combos').select('*').in('id', comboIds).eq('activo', true).order('nombre'),
      supabase.from('au_combo_slots').select('*').in('combo_id', comboIds).order('orden'),
    ])
    const slotIds = (slotsData ?? []).map((s: { id: string }) => s.id)
    let opcionesData: { slot_id: string; plato_id: string }[] = []
    if (slotIds.length > 0) {
      const { data: op } = await supabase.from('au_combo_slot_opciones').select('slot_id, plato_id').in('slot_id', slotIds)
      opcionesData = op ?? []
    }
    const platoIds = [...new Set(opcionesData.map(o => o.plato_id))]
    let platosCat: PlatoConIngredientes[] = []
    if (platoIds.length > 0) {
      const [{ data: pd }, { data: id }] = await Promise.all([
        supabase.from('au_platos').select('*').in('id', platoIds).eq('activo', true),
        supabase.from('au_plato_ingredientes').select('*').in('plato_id', platoIds).eq('activo', true).order('orden'),
      ])
      platosCat = (pd ?? []).map((p: AuPlato) => ({
        ...p,
        ingredientes: (id ?? []).filter((i: { plato_id: string }) => i.plato_id === p.id),
      }))
    }
    return (combosData ?? []).map((c: AuCombo) => ({
      ...c,
      slots: (slotsData ?? [])
        .filter((s: { combo_id: string }) => s.combo_id === c.id)
        .map((s: { id: string; nombre: string; orden: number; combo_id: string }) => ({
          ...s,
          opciones: opcionesData
            .filter(o => o.slot_id === s.id)
            .map(o => platosCat.find(p => p.id === o.plato_id))
            .filter(Boolean) as PlatoConIngredientes[],
        })),
    }))
  }

  async function cargarTiempos(lid: string): Promise<Record<TimeKeyAll, number>> {
    const { data } = await supabase
      .from('au_config_tiempos')
      .select('*')
      .or(`local_id.is.null,local_id.eq.${lid}`)
    const rows: AuConfigTiempos[] = data ?? []
    const merged = { ...TIEMPOS_DEFAULT }
    const tipoMap: Record<string, TimeKeyAll> = {
      ENTRANTE: 'entrante', PRINCIPAL: 'principal', BEBIDA: 'bebida', POSTRE: 'postre',
      SANDWICH: 'sandwich', JUGOS: 'jugos',
    }
    rows.filter(r => r.local_id === null).forEach(r => {
      const k = tipoMap[r.tipo]; if (k) merged[k] = r.max_min
    })
    rows.filter(r => r.local_id === lid).forEach(r => {
      const k = tipoMap[r.tipo]; if (k) merged[k] = r.max_min
    })
    return merged
  }

  /* ── Toggle plato suelto ──────────────────────────────────────────────── */
  function handleTogglePlato(platoId: string, plato: PlatoConIngredientes) {
    const next = new Set(platosSeleccionados)
    if (next.has(platoId)) {
      next.delete(platoId)
      store.setProductoItems(store.productoItems.filter(i => !(i.plato_id === platoId && !i.slot_nombre)))
    } else {
      next.add(platoId)
      const nuevos = plato.ingredientes
        .filter(ing => ing.activo)
        .map(ing => ({
          plato_id:           plato.id,
          plato_nombre:       plato.nombre,
          ingrediente_nombre: ing.nombre,
          contiene:           false,
        }))
      store.setProductoItems([...store.productoItems, ...nuevos])
    }
    setPlatosSeleccionados(next)
  }

  /* ── Toggle combo ─────────────────────────────────────────────────────── */
  function handleToggleCombo(comboId: string, combo: ComboConSlots) {
    const next = new Set(combosSeleccionados)
    if (next.has(comboId)) {
      next.delete(comboId)
      store.setProductoItems(store.productoItems.filter(i => i.combo_nombre !== combo.nombre))
      const nextSpe = new Map(slotPlatoElegido)
      combo.slots.forEach(s => nextSpe.delete(s.id))
      setSlotPlatoElegido(nextSpe)
    } else {
      next.add(comboId)
    }
    setCombosSeleccionados(next)
  }

  /* ── Elegir plato en slot ─────────────────────────────────────────────── */
  function handleElegirPlatoEnSlot(slotId: string, platoId: string | null, combo: ComboConSlots, slot: SlotConOpciones) {
    store.setProductoItems(
      store.productoItems.filter(i => !(i.combo_nombre === combo.nombre && i.slot_nombre === slot.nombre))
    )
    const nextSpe = new Map(slotPlatoElegido)
    if (platoId === null) {
      nextSpe.delete(slotId)
    } else {
      nextSpe.set(slotId, platoId)
      const plato = slot.opciones.find(p => p.id === platoId)
      if (plato) {
        const nuevos = plato.ingredientes
          .filter(ing => ing.activo)
          .map(ing => ({
            plato_id:           plato.id,
            plato_nombre:       plato.nombre,
            ingrediente_nombre: ing.nombre,
            contiene:           false,
            combo_nombre:       combo.nombre,
            slot_nombre:        slot.nombre,
          }))
        store.setProductoItems([...store.productoItems, ...nuevos])
      }
    }
    setSlotPlatoElegido(nextSpe)
  }

  /* ── Severidad map ────────────────────────────────────────────────────── */
  const cfgMap = (() => {
    const m: Record<string, number> = { NINGUNA: 0, LEVE: 0.25, MEDIA: 0.5, GRAVE: 1 }
    configSev.forEach(c => { m[c.severidad] = c.descuento })
    return m as Record<Severidad, number>
  })()

  /* ── Observaciones: separar áreas 1-3 de los aspectos de Revisión Interna ── */
  const obsPrincipales: ObservacionCalculo[] = store.observaciones
    .filter(o => esAreaPrincipal(o.area))
    .map(o => ({ area: o.area as Area, severidad: o.severidad, extrema_modo: o.extrema_modo }))
  const obsRI: ObservacionRI[] = store.observaciones
    .filter(o => !esAreaPrincipal(o.area))
    .map(o => ({ aspecto: o.area as AspectoRI, severidad: o.severidad }))

  /* ── Notas en vivo ────────────────────────────────────────────────────── */
  const notaP = calcularNotaProducto(store.productoItems, obsPrincipales, cfgMap)
  const notaS = calcularNotaServicio(store.servicio,      obsPrincipales, cfgMap)
  const notaL = calcularNotaLocal(store.localChecklist,   obsPrincipales, cfgMap)
  const descuentoRI = calcularDescuentoRevisionInterna(obsRI, configRI, cfgMap)
  const notaT = calcularNotaTotal(notaP, notaS, notaL, descuentoRI)

  /* ── Guardar (UPDATE + delete/insert hijas) ───────────────────────────── */
  async function handleGuardar() {
    setGuardando(true)
    setErrorGuardar(null)
    try {
      const aid = auditoria.id

      // 1. UPDATE cabecera
      const { error: e1 } = await supabase.from('au_auditorias').update({
        fecha:                store.fecha,
        mesero_nombre:        store.mesero_nombre || null,
        nota_producto:        +notaP.toFixed(2),
        nota_servicio:        +notaS.toFixed(2),
        nota_local:           +notaL.toFixed(2),
        nota_total:           +notaT.toFixed(2),
        oportunidad_producto: store.oportunidad_producto || null,
        oportunidad_servicio: store.oportunidad_servicio || null,
        oportunidad_local:    store.oportunidad_local    || null,
        ri_revision_conforme:     store.riConforme.RI_REVISION,
        ri_rotulacion_conforme:   store.riConforme.RI_ROTULACION,
        ri_higiene_conforme:      store.riConforme.RI_HIGIENE,
        ri_revision_comentario:   store.riComentario.RI_REVISION   || null,
        ri_rotulacion_comentario: store.riComentario.RI_ROTULACION || null,
        ri_higiene_comentario:    store.riComentario.RI_HIGIENE    || null,
        descuento_ri:         +descuentoRI.toFixed(2),
      }).eq('id', aid)
      if (e1) throw e1

      // 2. Producto items: delete + insert
      const { error: e2d } = await supabase.from('au_auditoria_producto_items').delete().eq('auditoria_id', aid)
      if (e2d) throw e2d
      if (store.productoItems.length > 0) {
        const { error: e2i } = await supabase.from('au_auditoria_producto_items').insert(
          store.productoItems.map(i => ({
            auditoria_id:       aid,
            plato_id:           i.plato_id,
            plato_nombre:       i.plato_nombre,
            ingrediente_nombre: i.ingrediente_nombre,
            cumple:             !!i.contiene,
            contiene:           !!i.contiene,
            limpieza:           false,
            peso_adecuado:      false,
            combo_nombre:       i.combo_nombre ?? null,
            slot_nombre:        i.slot_nombre  ?? null,
          }))
        )
        if (e2i) throw e2i
      }

      // 3. Servicio: delete + insert
      await supabase.from('au_auditoria_servicio').delete().eq('auditoria_id', aid)
      const { error: e3 } = await supabase.from('au_auditoria_servicio').insert({
        auditoria_id: aid, ...store.servicio,
      })
      if (e3) throw e3

      // 4. Local: delete + insert
      await supabase.from('au_auditoria_local').delete().eq('auditoria_id', aid)
      const { error: e4 } = await supabase.from('au_auditoria_local').insert({
        auditoria_id: aid, ...store.localChecklist,
      })
      if (e4) throw e4

      // 5. Observaciones: delete + insert (incluye áreas 1-3 y aspectos de Revisión Interna)
      const { error: e5d } = await supabase.from('au_observaciones').delete().eq('auditoria_id', aid)
      if (e5d) throw e5d
      if (store.observaciones.length > 0) {
        const { error: e5i } = await supabase.from('au_observaciones').insert(
          store.observaciones.map(o => ({
            auditoria_id: aid,
            area:         o.area,
            texto:        o.texto,
            severidad:    o.severidad,
            extrema_modo: o.extrema_modo ?? null,
          }))
        )
        if (e5i) throw e5i
      }

      // 6. Evidencias: delete DB rows + insert current (incluye Revisión Interna)
      // (storage add/remove ya fue manejado en tiempo real por EvidenciasUploader)
      const { error: e6d } = await supabase.from('au_evidencias').delete().eq('auditoria_id', aid)
      if (e6d) throw e6d
      const AREAS_EVIDENCIA: (Area | 'REVISION_INTERNA')[] = ['PRODUCTO', 'SERVICIO', 'LOCAL', 'REVISION_INTERNA']
      const evidRows = AREAS_EVIDENCIA.flatMap(area =>
        store.evidencias[area].map(ev => ({ auditoria_id: aid, area, url: ev.url, etiqueta: ev.etiqueta ?? null }))
      )
      if (evidRows.length > 0) {
        const { error: e6i } = await supabase.from('au_evidencias').insert(evidRows)
        if (e6i) throw e6i
      }

      setGuardadoOk(true)

    } catch (err) {
      console.error(err)
      setErrorGuardar('Error al guardar cambios. Verifica la conexión e intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  /* ── Render ───────────────────────────────────────────────────────────── */
  const fechaLabel = (() => {
    try {
      return new Date(auditoria.fecha + 'T12:00:00').toLocaleDateString('es-ES', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      })
    } catch { return auditoria.fecha }
  })()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 rounded-full border-4 border-naranja border-t-transparent" />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <button type="button" onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-navy/50 hover:text-navy mb-5 transition">
          ← Mis auditorías
        </button>
        <p className="text-terranova text-sm">{loadError}</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Volver */}
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-navy/50 hover:text-navy mb-5 transition"
      >
        ← Mis auditorías
      </button>

      {/* Encabezado */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-navy" style={{ fontFamily: 'Poppins, sans-serif' }}>
          Editar auditoría
        </h2>
        <p className="text-sm text-navy/40 mt-0.5 capitalize">{fechaLabel}</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_272px] gap-6 items-start">

        {/* ── Columna izquierda ────────────────────────────────────── */}
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-4 mb-6">
            {/* Local (solo lectura) */}
            <div>
              <label className="block text-xs font-semibold text-navy/50 uppercase tracking-wide mb-1.5">
                Local
              </label>
              <div className="px-4 py-2.5 rounded-xl border border-navy/10 bg-navy/5 text-navy/60 text-sm">
                {localNombre}
              </div>
            </div>

            {/* Fecha editable */}
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

          <SeccionProducto
            platos={platos}
            platosSeleccionados={platosSeleccionados}
            onTogglePlato={handleTogglePlato}
            combos={combos}
            combosSeleccionados={combosSeleccionados}
            onToggleCombo={handleToggleCombo}
            slotPlatoElegido={slotPlatoElegido}
            onElegirPlatoEnSlot={handleElegirPlatoEnSlot}
          />
          <SeccionServicio tiemposMax={tiemposMax} esCholito={esCholito} />
          <SeccionLocal />
          <SeccionRevisionInterna />

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

        {/* ── Panel notas ──────────────────────────────────────────── */}
        <div className="space-y-3">
          <PanelNotas
            notaP={notaP}
            notaS={notaS}
            notaL={notaL}
            descuentoRI={descuentoRI}
            notaT={notaT}
            onGuardar={handleGuardar}
            guardando={guardando}
            guardadoOk={guardadoOk}
            canGuardar={true}
          />
          {guardadoOk && (
            <button
              type="button"
              onClick={onBack}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-navy
                         border border-navy/20 hover:border-navy/40 transition"
            >
              ← Volver a la lista
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
