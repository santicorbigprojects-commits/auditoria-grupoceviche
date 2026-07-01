import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuditoriaStore } from '../../store/auditoriaStore'
import { useAuthStore } from '../../store/authStore'
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
  AuMarca, AuLocal, AuConfigSeveridad, AuConfigTiempos, AuConfigRI,
  AuCombo, AuPlato, Severidad, Area, AspectoRI,
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

const CONFIG_RI_DEFAULT: ConfigRI = { RI_REVISION: 2, RI_ROTULACION: 2, RI_HIGIENE: 3 }

function esAreaPrincipal(area: Area | AspectoRI): area is Area {
  return area === 'PRODUCTO' || area === 'SERVICIO' || area === 'LOCAL'
}

type TimeKey = 'entrante' | 'principal' | 'bebida' | 'postre'

const TIEMPOS_DEFAULT: Record<TimeKey, number> = {
  entrante: 10, principal: 20, bebida: 5, postre: 10,
}

interface Grupo { marca: AuMarca; locales: AuLocal[] }

export default function TrackingPage() {
  const { cut } = useAuthStore()
  const store   = useAuditoriaStore()

  // Master data
  const [marcas,        setMarcas]        = useState<AuMarca[]>([])
  const [locales,       setLocales]       = useState<AuLocal[]>([])
  const [configSev,     setConfigSev]     = useState<AuConfigSeveridad[]>([])
  const [configRI,      setConfigRI]      = useState<ConfigRI>(CONFIG_RI_DEFAULT)
  const [loadingMaster, setLoadingMaster] = useState(true)

  // Platos y combos del local seleccionado
  const [platos,        setPlatos]        = useState<PlatoConIngredientes[]>([])
  const [combos,        setCombos]        = useState<ComboConSlots[]>([])
  const [loadingPlatos, setLoadingPlatos] = useState(false)

  // Tiempos objetivo cargados de au_config_tiempos
  const [tiemposMax, setTiemposMax] = useState<Record<TimeKey, number>>({ ...TIEMPOS_DEFAULT })

  // Selección del auditor este turno
  const [platosSeleccionados, setPlatosSeleccionados] = useState<Set<string>>(new Set())
  const [combosSeleccionados, setCombosSeleccionados] = useState<Set<string>>(new Set())
  const [slotPlatoElegido,    setSlotPlatoElegido]    = useState<Map<string, string>>(new Map())

  // Estado de guardado
  const [guardando,    setGuardando]    = useState(false)
  const [guardadoOk,   setGuardadoOk]   = useState(false)
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null)

  /* ── Carga inicial ──────────────────────────────────────────────────── */
  useEffect(() => {
    async function load() {
      setLoadingMaster(true)
      const [{ data: m }, { data: l }, { data: s }, { data: ri }] = await Promise.all([
        supabase.from('au_marcas').select('*').order('es_carpeta', { ascending: false }).order('nombre'),
        supabase.from('au_locales').select('*').eq('activo', true).order('nombre'),
        supabase.from('au_config_severidad').select('*'),
        supabase.from('au_config_ri').select('*'),
      ])
      if (m) setMarcas(m)
      if (l) setLocales(l)
      if (s) setConfigSev(s)
      if (ri) {
        const merged = { ...CONFIG_RI_DEFAULT }
        ;(ri as AuConfigRI[]).forEach(r => { merged[r.aspecto] = r.max_descuento })
        setConfigRI(merged)
      }
      setLoadingMaster(false)
    }
    load()
  }, [])

  /* ── Carga de platos + combos + tiempos al cambiar local ──────────── */
  useEffect(() => {
    if (!store.local_id) { setPlatos([]); setCombos([]); return }

    async function loadPlatos() {
      setLoadingPlatos(true)
      const { data: pl } = await supabase
        .from('au_plato_locales')
        .select('plato_id')
        .eq('local_id', store.local_id)

      if (!pl || pl.length === 0) { setPlatos([]); }
      else {
        const ids = pl.map(r => r.plato_id)
        const [{ data: platosData }, { data: ingsData }] = await Promise.all([
          supabase.from('au_platos').select('*').in('id', ids).eq('activo', true).order('nombre'),
          supabase.from('au_plato_ingredientes').select('*').in('plato_id', ids).eq('activo', true).order('orden'),
        ])
        setPlatos((platosData ?? []).map(p => ({
          ...p,
          ingredientes: (ingsData ?? []).filter(i => i.plato_id === p.id),
        })))
      }

      const combosResult = await cargarCombos(store.local_id!)
      setCombos(combosResult)
      setLoadingPlatos(false)
    }

    async function loadTiempos() {
      const { data } = await supabase
        .from('au_config_tiempos')
        .select('*')
        .or(`local_id.is.null,local_id.eq.${store.local_id}`)
      const rows: AuConfigTiempos[] = data ?? []
      const merged = { ...TIEMPOS_DEFAULT }
      const tipoMap: Record<string, TimeKey> = {
        ENTRANTE: 'entrante', PRINCIPAL: 'principal', BEBIDA: 'bebida', POSTRE: 'postre',
      }
      rows.filter(r => r.local_id === null).forEach(r => { const k = tipoMap[r.tipo]; if (k) merged[k] = r.max_min })
      rows.filter(r => r.local_id === store.local_id).forEach(r => { const k = tipoMap[r.tipo]; if (k) merged[k] = r.max_min })
      setTiemposMax(merged)
    }

    loadPlatos()
    loadTiempos()
  }, [store.local_id])

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
      platosCat = (pd ?? []).map((p: AuPlato) => ({ ...p, ingredientes: (id ?? []).filter((i: { plato_id: string }) => i.plato_id === p.id) }))
    }
    return (combosData ?? []).map((c: AuCombo) => ({
      ...c,
      slots: (slotsData ?? [])
        .filter((s: { combo_id: string }) => s.combo_id === c.id)
        .map((s: { id: string; nombre: string; orden: number; combo_id: string }) => ({
          ...s,
          opciones: opcionesData.filter(o => o.slot_id === s.id).map(o => platosCat.find(p => p.id === o.plato_id)).filter(Boolean) as PlatoConIngredientes[],
        })),
    }))
  }

  /* ── Reset de selección al cambiar local ───────────────────────────── */
  useEffect(() => {
    setPlatosSeleccionados(new Set())
    setCombosSeleccionados(new Set())
    setSlotPlatoElegido(new Map())
    store.setProductoItems([])
    setGuardadoOk(false)
    setErrorGuardar(null)
  // Solo cuando cambia el local
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.local_id])

  /* ── Toggle plato suelto ────────────────────────────────────────────── */
  function handleTogglePlato(platoId: string, plato: PlatoConIngredientes) {
    const next = new Set(platosSeleccionados)
    if (next.has(platoId)) {
      next.delete(platoId)
      // Solo eliminar ítems de este plato suelto (no los de combos que lo usen)
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

  /* ── Toggle combo ───────────────────────────────────────────────────── */
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

  /* ── Elegir plato en slot de combo ─────────────────────────────────── */
  function handleElegirPlatoEnSlot(slotId: string, platoId: string | null, combo: ComboConSlots, slot: SlotConOpciones) {
    // Quitar ítems anteriores de este slot
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

  /* ── Config de severidad → mapa ─────────────────────────────────────── */
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

  /* ── Notas en vivo ──────────────────────────────────────────────────── */
  const notaP = calcularNotaProducto(store.productoItems, obsPrincipales, cfgMap)
  const notaS = calcularNotaServicio(store.servicio,      obsPrincipales, cfgMap)
  const notaL = calcularNotaLocal(store.localChecklist,   obsPrincipales, cfgMap)
  const descuentoRI = calcularDescuentoRevisionInterna(obsRI, configRI, cfgMap)
  const notaT = calcularNotaTotal(notaP, notaS, notaL, descuentoRI)

  /* ── Guardar ────────────────────────────────────────────────────────── */
  async function handleGuardar() {
    if (!store.local_id || !cut) return
    setGuardando(true)
    setErrorGuardar(null)

    try {
      // 1. Cabecera
      const { data: cab, error: e1 } = await supabase
        .from('au_auditorias')
        .insert({
          local_id:             store.local_id,
          auditor_cut:          cut,
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
        })
        .select('id')
        .single()

      if (e1 || !cab) throw e1 ?? new Error('Sin ID de auditoría')
      const aid = cab.id

      // 2. Producto items (batch)
      if (store.productoItems.length > 0) {
        const { error: e2 } = await supabase.from('au_auditoria_producto_items').insert(
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
        if (e2) throw e2
      }

      // 3. Servicio
      const { error: e3 } = await supabase.from('au_auditoria_servicio').insert({
        auditoria_id: aid, ...store.servicio,
      })
      if (e3) throw e3

      // 4. Local checklist
      const { error: e4 } = await supabase.from('au_auditoria_local').insert({
        auditoria_id: aid, ...store.localChecklist,
      })
      if (e4) throw e4

      // 5. Observaciones (batch) — incluye áreas 1-3 y aspectos de Revisión Interna
      if (store.observaciones.length > 0) {
        const { error: e5 } = await supabase.from('au_observaciones').insert(
          store.observaciones.map(o => ({
            auditoria_id: aid,
            area:         o.area,
            texto:        o.texto,
            severidad:    o.severidad,
            extrema_modo: o.extrema_modo ?? null,
          }))
        )
        if (e5) throw e5
      }

      // 6. Evidencias (batch) — incluye Revisión Interna
      const AREAS_EVIDENCIA: (Area | 'REVISION_INTERNA')[] = ['PRODUCTO', 'SERVICIO', 'LOCAL', 'REVISION_INTERNA']
      const evidRows = AREAS_EVIDENCIA.flatMap(area =>
        store.evidencias[area].map(ev => ({ auditoria_id: aid, area, url: ev.url, etiqueta: ev.etiqueta ?? null }))
      )
      if (evidRows.length > 0) {
        const { error: e6 } = await supabase.from('au_evidencias').insert(evidRows)
        if (e6) throw e6
      }

      store.reset()
      setPlatosSeleccionados(new Set())
      setCombosSeleccionados(new Set())
      setSlotPlatoElegido(new Map())
      setGuardadoOk(true)

    } catch (err) {
      console.error(err)
      setErrorGuardar('Error al guardar. Revisa la conexión e intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  /* ── Grupos para el selector ────────────────────────────────────────── */
  const grupos: Grupo[] = (() => {
    const carpetas  = marcas.filter(m => m.es_carpeta)
    const sueltas   = marcas.filter(m => !m.es_carpeta)
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
  if (loadingMaster) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 rounded-full border-4 border-naranja border-t-transparent" />
      </div>
    )
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
      {/* Encabezado */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-navy" style={{ fontFamily: 'Poppins, sans-serif' }}>
          Nueva auditoría
        </h2>
        <p className="text-sm text-navy/40 mt-0.5 capitalize">{fechaLabel}</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_272px] gap-6 items-start">

        {/* ── Columna izquierda: formulario ─────────────────────────── */}
        <div>
          {/* Selector local + fecha */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-4 mb-6">
            <div>
              <label className="block text-xs font-semibold text-navy/50 uppercase tracking-wide mb-1.5">
                Local
              </label>
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
                      {g.locales.map(l => (
                        <option key={l.id} value={l.id}>{l.nombre}</option>
                      ))}
                    </optgroup>
                  ) : (
                    g.locales.map(l => (
                      <option key={l.id} value={l.id}>{l.nombre}</option>
                    ))
                  )
                )}
              </select>
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

          {/* Secciones — solo visibles si hay local */}
          {!store.local_id && (
            <div className="rounded-2xl border-2 border-dashed border-navy/15 p-10 text-center">
              <p className="text-navy/30 text-sm">Selecciona un local para comenzar la auditoría.</p>
            </div>
          )}

          {store.local_id && (
            loadingPlatos ? (
              <div className="flex items-center justify-center h-40">
                <div className="animate-spin w-6 h-6 rounded-full border-4 border-naranja border-t-transparent" />
              </div>
            ) : (
              <>
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
                <SeccionServicio tiemposMax={tiemposMax} />
                <SeccionLocal />
                <SeccionRevisionInterna />
              </>
            )
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

        {/* ── Columna derecha: panel de notas ──────────────────────── */}
        <PanelNotas
          notaP={notaP}
          notaS={notaS}
          notaL={notaL}
          descuentoRI={descuentoRI}
          notaT={notaT}
          onGuardar={handleGuardar}
          guardando={guardando}
          guardadoOk={guardadoOk}
          canGuardar={!!store.local_id}
        />
      </div>
    </div>
  )
}
