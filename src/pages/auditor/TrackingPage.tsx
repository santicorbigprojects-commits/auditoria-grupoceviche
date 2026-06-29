import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuditoriaStore } from '../../store/auditoriaStore'
import { useAuthStore } from '../../store/authStore'
import {
  calcularNotaProducto,
  calcularNotaServicio,
  calcularNotaLocal,
  calcularNotaTotal,
} from '../../lib/calculo'
import type { AuMarca, AuLocal, AuConfigSeveridad, AuConfigTiempos, Severidad, Area } from '../../types'
import SeccionProducto, { type PlatoConIngredientes } from '../../components/auditoria/SeccionProducto'
import SeccionServicio from '../../components/auditoria/SeccionServicio'
import SeccionLocal from '../../components/auditoria/SeccionLocal'
import PanelNotas from '../../components/auditoria/PanelNotas'

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
  const [loadingMaster, setLoadingMaster] = useState(true)

  // Platos del local seleccionado
  const [platos,        setPlatos]        = useState<PlatoConIngredientes[]>([])
  const [loadingPlatos, setLoadingPlatos] = useState(false)

  // Tiempos objetivo cargados de au_config_tiempos
  const [tiemposMax, setTiemposMax] = useState<Record<TimeKey, number>>({ ...TIEMPOS_DEFAULT })

  // Platos que el auditor eligió evaluar este turno
  const [platosSeleccionados, setPlatosSeleccionados] = useState<Set<string>>(new Set())

  // Estado de guardado
  const [guardando,    setGuardando]    = useState(false)
  const [guardadoOk,   setGuardadoOk]   = useState(false)
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null)

  /* ── Carga inicial ──────────────────────────────────────────────────── */
  useEffect(() => {
    async function load() {
      setLoadingMaster(true)
      const [{ data: m }, { data: l }, { data: s }] = await Promise.all([
        supabase.from('au_marcas').select('*').order('es_carpeta', { ascending: false }).order('nombre'),
        supabase.from('au_locales').select('*').eq('activo', true).order('nombre'),
        supabase.from('au_config_severidad').select('*'),
      ])
      if (m) setMarcas(m)
      if (l) setLocales(l)
      if (s) setConfigSev(s)
      setLoadingMaster(false)
    }
    load()
  }, [])

  /* ── Carga de platos + tiempos al cambiar local ─────────────────────── */
  useEffect(() => {
    if (!store.local_id) { setPlatos([]); return }

    async function loadPlatos() {
      setLoadingPlatos(true)
      const { data: pl } = await supabase
        .from('au_plato_locales')
        .select('plato_id')
        .eq('local_id', store.local_id)

      if (!pl || pl.length === 0) { setPlatos([]); setLoadingPlatos(false); return }

      const ids = pl.map(r => r.plato_id)
      const [{ data: platosData }, { data: ingsData }] = await Promise.all([
        supabase.from('au_platos').select('*').in('id', ids).eq('activo', true).order('nombre'),
        supabase.from('au_plato_ingredientes').select('*').in('plato_id', ids).eq('activo', true).order('orden'),
      ])

      const result: PlatoConIngredientes[] = (platosData ?? []).map(p => ({
        ...p,
        ingredientes: (ingsData ?? []).filter(i => i.plato_id === p.id),
      }))
      setPlatos(result)
      setLoadingPlatos(false)
    }

    async function loadTiempos() {
      const { data } = await supabase
        .from('au_config_tiempos')
        .select('*')
        .or(`local_id.is.null,local_id.eq.${store.local_id}`)
      const rows: AuConfigTiempos[] = data ?? []

      // Globals first, then override with local-specific values
      const merged = { ...TIEMPOS_DEFAULT }
      const tipoMap: Record<string, TimeKey> = {
        ENTRANTE: 'entrante', PRINCIPAL: 'principal', BEBIDA: 'bebida', POSTRE: 'postre',
      }
      // Apply globals
      rows.filter(r => r.local_id === null).forEach(r => {
        const k = tipoMap[r.tipo]
        if (k) merged[k] = r.max_min
      })
      // Apply local overrides
      rows.filter(r => r.local_id === store.local_id).forEach(r => {
        const k = tipoMap[r.tipo]
        if (k) merged[k] = r.max_min
      })
      setTiemposMax(merged)
    }

    loadPlatos()
    loadTiempos()
  }, [store.local_id])

  /* ── Reset de selección al cambiar local ───────────────────────────── */
  useEffect(() => {
    setPlatosSeleccionados(new Set())
    store.setProductoItems([])
    setGuardadoOk(false)
    setErrorGuardar(null)
  // Solo cuando cambia el local
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.local_id])

  /* ── Toggle plato ───────────────────────────────────────────────────── */
  function handleTogglePlato(platoId: string, plato: PlatoConIngredientes) {
    const next = new Set(platosSeleccionados)
    if (next.has(platoId)) {
      next.delete(platoId)
      store.setProductoItems(store.productoItems.filter(i => i.plato_id !== platoId))
    } else {
      next.add(platoId)
      const nuevos = plato.ingredientes
        .filter(ing => ing.activo)
        .map(ing => ({
          plato_id:           plato.id,
          plato_nombre:       plato.nombre,
          ingrediente_nombre: ing.nombre,
          contiene:           false,
          limpieza:           false,
          peso_adecuado:      false,
        }))
      store.setProductoItems([...store.productoItems, ...nuevos])
    }
    setPlatosSeleccionados(next)
  }

  /* ── Config de severidad → mapa ─────────────────────────────────────── */
  const cfgMap = (() => {
    const m: Record<string, number> = { NINGUNA: 0, LEVE: 0.25, MEDIA: 0.5, GRAVE: 1 }
    configSev.forEach(c => { m[c.severidad] = c.descuento })
    return m as Record<Severidad, number>
  })()

  /* ── Notas en vivo ──────────────────────────────────────────────────── */
  const notaP = calcularNotaProducto(store.productoItems, store.observaciones, cfgMap)
  const notaS = calcularNotaServicio(store.servicio,      store.observaciones, cfgMap)
  const notaL = calcularNotaLocal(store.localChecklist,   store.observaciones, cfgMap)
  const notaT = calcularNotaTotal(notaP, notaS, notaL)

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
            cumple:             !!i.contiene && !!i.limpieza && !!i.peso_adecuado,
            contiene:           !!i.contiene,
            limpieza:           !!i.limpieza,
            peso_adecuado:      !!i.peso_adecuado,
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

      // 5. Observaciones (batch)
      if (store.observaciones.length > 0) {
        const { error: e5 } = await supabase.from('au_observaciones').insert(
          store.observaciones.map(o => ({
            auditoria_id: aid,
            area:         o.area,
            texto:        o.texto,
            severidad:    o.severidad,
          }))
        )
        if (e5) throw e5
      }

      // 6. Evidencias (batch)
      const AREAS: Area[] = ['PRODUCTO', 'SERVICIO', 'LOCAL']
      const evidRows = AREAS.flatMap(area =>
        store.evidencias[area].map(ev => ({ auditoria_id: aid, area, url: ev.url, etiqueta: ev.etiqueta ?? null }))
      )
      if (evidRows.length > 0) {
        const { error: e6 } = await supabase.from('au_evidencias').insert(evidRows)
        if (e6) throw e6
      }

      store.reset()
      setPlatosSeleccionados(new Set())
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
                />
                <SeccionServicio tiemposMax={tiemposMax} />
                <SeccionLocal />
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
