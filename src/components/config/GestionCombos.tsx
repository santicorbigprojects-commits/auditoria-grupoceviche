import { useState, useEffect, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import type { AuLocal, AuMarca, AuPlato } from '../../types'

/* ── Tipos locales ──────────────────────────────────────────────────────── */

interface SlotDraft {
  nombre:   string
  platoIds: Set<string>
}

interface ComboDraft {
  id:       string | null
  nombre:   string
  codigo:   string
  activo:   boolean
  slots:    SlotDraft[]
  localIds: Set<string>
}

interface ComboRow {
  id:        string
  nombre:    string
  codigo:    string | null
  activo:    boolean
  slotCount: number
  locCount:  number
}

interface GrupoMarca { marca: AuMarca; locales: AuLocal[] }

const VACIO: ComboDraft = {
  id: null, nombre: '', codigo: '', activo: true, slots: [], localIds: new Set(),
}

const INPUT_CLS = `w-full px-3 py-2 rounded-xl border border-navy/20 bg-crema/40 text-sm text-navy
placeholder:text-navy/25 focus:outline-none focus:ring-2 focus:ring-naranja/30 focus:border-naranja transition`

/* ── Componente principal ───────────────────────────────────────────────── */

export default function GestionCombos() {
  const [combos,        setCombos]        = useState<ComboRow[]>([])
  const [locales,       setLocales]       = useState<AuLocal[]>([])
  const [marcas,        setMarcas]        = useState<AuMarca[]>([])
  const [platos,        setPlatos]        = useState<AuPlato[]>([])
  const [draft,         setDraft]         = useState<ComboDraft | null>(null)
  const [slotSearches,  setSlotSearches]  = useState<string[]>([])

  const [loading,       setLoading]       = useState(true)
  const [saving,        setSaving]        = useState(false)
  const [error,         setError]         = useState<string | null>(null)
  const [successMsg,    setSuccessMsg]    = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ combo: ComboRow; usedCount: number } | null>(null)
  const [deleting,      setDeleting]      = useState(false)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [
      { data: cData  },
      { data: sData  },
      { data: clData },
      { data: lData  },
      { data: mData  },
      { data: pData  },
    ] = await Promise.all([
      supabase.from('au_combos').select('id, nombre, codigo, activo').order('nombre'),
      supabase.from('au_combo_slots').select('id, combo_id'),
      supabase.from('au_combo_locales').select('combo_id, local_id'),
      supabase.from('au_locales').select('*').eq('activo', true).order('nombre'),
      supabase.from('au_marcas').select('*').order('es_carpeta', { ascending: false }).order('nombre'),
      supabase.from('au_platos').select('id, nombre, codigo, activo').eq('activo', true).order('nombre'),
    ])

    setCombos((cData ?? []).map(c => ({
      id:        c.id,
      nombre:    c.nombre,
      codigo:    c.codigo,
      activo:    c.activo,
      slotCount: (sData  ?? []).filter(s => s.combo_id === c.id).length,
      locCount:  (clData ?? []).filter(l => l.combo_id === c.id).length,
    })))
    setLocales(lData ?? [])
    setMarcas(mData  ?? [])
    setPlatos(pData  ?? [])
    setLoading(false)
  }

  async function seleccionarCombo(row: ComboRow) {
    setError(null); setSuccessMsg(null)
    const [{ data: slotsData }, { data: locData }] = await Promise.all([
      supabase.from('au_combo_slots').select('id, nombre, orden').eq('combo_id', row.id).order('orden'),
      supabase.from('au_combo_locales').select('local_id').eq('combo_id', row.id),
    ])

    let opcionesData: { slot_id: string; plato_id: string }[] = []
    const slotIds = (slotsData ?? []).map(s => s.id)
    if (slotIds.length > 0) {
      const { data: op } = await supabase
        .from('au_combo_slot_opciones')
        .select('slot_id, plato_id')
        .in('slot_id', slotIds)
      opcionesData = op ?? []
    }

    const slots: SlotDraft[] = (slotsData ?? []).map(s => ({
      nombre:   s.nombre,
      platoIds: new Set(opcionesData.filter(o => o.slot_id === s.id).map(o => o.plato_id)),
    }))

    setDraft({
      id:       row.id,
      nombre:   row.nombre,
      codigo:   row.codigo ?? '',
      activo:   row.activo,
      slots,
      localIds: new Set((locData ?? []).map(l => l.local_id)),
    })
    setSlotSearches(slots.map(() => ''))
  }

  function nuevoCombo() {
    setDraft({ ...VACIO, localIds: new Set(), slots: [] })
    setSlotSearches([])
    setError(null); setSuccessMsg(null)
  }

  /* ── Slots ──────────────────────────────────────────────────────────── */

  function addSlot() {
    setDraft(d => d ? { ...d, slots: [...d.slots, { nombre: '', platoIds: new Set() }] } : d)
    setSlotSearches(ss => [...ss, ''])
  }

  function removeSlot(i: number) {
    setDraft(d => d ? { ...d, slots: d.slots.filter((_, j) => j !== i) } : d)
    setSlotSearches(ss => ss.filter((_, j) => j !== i))
  }

  function setSlotNombre(i: number, v: string) {
    setDraft(d => {
      if (!d) return d
      const slots = [...d.slots]
      slots[i] = { ...slots[i], nombre: v }
      return { ...d, slots }
    })
  }

  function moveSlotUp(i: number) {
    if (i === 0) return
    setDraft(d => {
      if (!d) return d
      const slots = [...d.slots];[slots[i - 1], slots[i]] = [slots[i], slots[i - 1]]
      return { ...d, slots }
    })
    setSlotSearches(ss => { const n = [...ss];[n[i - 1], n[i]] = [n[i], n[i - 1]]; return n })
  }

  function moveSlotDown(i: number) {
    setDraft(d => {
      if (!d || i >= d.slots.length - 1) return d
      const slots = [...d.slots];[slots[i], slots[i + 1]] = [slots[i + 1], slots[i]]
      return { ...d, slots }
    })
    setSlotSearches(ss => {
      if (i >= ss.length - 1) return ss
      const n = [...ss];[n[i], n[i + 1]] = [n[i + 1], n[i]]; return n
    })
  }

  function togglePlatoEnSlot(slotIdx: number, platoId: string) {
    setDraft(d => {
      if (!d) return d
      const slots = [...d.slots]
      const next  = new Set(slots[slotIdx].platoIds)
      next.has(platoId) ? next.delete(platoId) : next.add(platoId)
      slots[slotIdx] = { ...slots[slotIdx], platoIds: next }
      return { ...d, slots }
    })
  }

  /* ── Locales ────────────────────────────────────────────────────────── */

  function toggleLocal(localId: string) {
    setDraft(d => {
      if (!d) return d
      const next = new Set(d.localIds)
      next.has(localId) ? next.delete(localId) : next.add(localId)
      return { ...d, localIds: next }
    })
  }

  function toggleMarca(marcaId: string) {
    const ls = locales.filter(l => l.marca_id === marcaId).map(l => l.id)
    setDraft(d => {
      if (!d) return d
      const next       = new Set(d.localIds)
      const allChecked = ls.every(id => next.has(id))
      ls.forEach(id => allChecked ? next.delete(id) : next.add(id))
      return { ...d, localIds: next }
    })
  }

  /* ── Guardar ────────────────────────────────────────────────────────── */

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    if (!draft) return
    if (!draft.nombre.trim()) { setError('El nombre del combo es obligatorio.'); return }
    setSaving(true); setError(null); setSuccessMsg(null)

    try {
      let pid = draft.id

      if (pid === null) {
        const { data, error: e1 } = await supabase
          .from('au_combos')
          .insert({ nombre: draft.nombre.trim(), codigo: draft.codigo.trim() || null, activo: true })
          .select('id').single()
        if (e1 || !data) throw e1 ?? new Error('Error al crear el combo')
        pid = data.id
      } else {
        const { error: e1 } = await supabase
          .from('au_combos')
          .update({ nombre: draft.nombre.trim(), codigo: draft.codigo.trim() || null })
          .eq('id', pid)
        if (e1) throw e1
      }

      // Borrar slots existentes (CASCADE elimina sus opciones automáticamente)
      await supabase.from('au_combo_slots').delete().eq('combo_id', pid)

      // Insertar slots con UUIDs generados en cliente, luego sus opciones
      const validSlots = draft.slots
        .map((s, idx) => ({ ...s, orden: idx }))
        .filter(s => s.nombre.trim())

      if (validSlots.length > 0) {
        const slotsRows = validSlots.map(s => ({
          id:       crypto.randomUUID(),
          combo_id: pid,
          nombre:   s.nombre.trim(),
          orden:    s.orden,
        }))
        const { error: e2 } = await supabase.from('au_combo_slots').insert(slotsRows)
        if (e2) throw e2

        const opcionesRows = slotsRows.flatMap((row, i) =>
          [...validSlots[i].platoIds].map(plato_id => ({ slot_id: row.id, plato_id }))
        )
        if (opcionesRows.length > 0) {
          const { error: e3 } = await supabase.from('au_combo_slot_opciones').insert(opcionesRows)
          if (e3) throw e3
        }
      }

      // Delete + re-insert locales
      await supabase.from('au_combo_locales').delete().eq('combo_id', pid)
      if (draft.localIds.size > 0) {
        const { error: e4 } = await supabase.from('au_combo_locales').insert(
          [...draft.localIds].map(local_id => ({ combo_id: pid, local_id }))
        )
        if (e4) throw e4
      }

      const isNew = draft.id === null
      await loadAll()
      setSuccessMsg(isNew ? 'Combo creado correctamente.' : 'Combo actualizado correctamente.')
      if (isNew) setDraft(null)
      else setDraft(d => d ? { ...d, id: pid } : d)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActivo(row: ComboRow) {
    await supabase.from('au_combos').update({ activo: !row.activo }).eq('id', row.id)
    if (draft?.id === row.id) setDraft(d => d ? { ...d, activo: !row.activo } : d)
    await loadAll()
  }

  /* ── Eliminar ───────────────────────────────────────────────────────── */

  async function handleIniciarEliminar(row: ComboRow) {
    setError(null); setSuccessMsg(null)
    // Heurística por nombre: combo_nombre es un snapshot del nombre en el momento de auditar.
    // Si el combo fue renombrado antes de eliminarse, esta búsqueda podría sub-contar.
    const { count } = await supabase
      .from('au_auditoria_producto_items')
      .select('*', { count: 'exact', head: true })
      .eq('combo_nombre', row.nombre)
    setDeleteConfirm({ combo: row, usedCount: count ?? 0 })
  }

  async function handleConfirmarEliminar() {
    if (!deleteConfirm) return
    setDeleting(true)
    try {
      const { error: err } = await supabase.from('au_combos').delete().eq('id', deleteConfirm.combo.id)
      if (err) throw err
      if (draft?.id === deleteConfirm.combo.id) setDraft(null)
      setDeleteConfirm(null)
      await loadAll()
      setSuccessMsg('Combo eliminado correctamente.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar')
      setDeleteConfirm(null)
    } finally {
      setDeleting(false)
    }
  }

  /* ── Grupos de locales ──────────────────────────────────────────────── */

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

  /* ── Render ─────────────────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin w-6 h-6 rounded-full border-4 border-naranja border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 items-start">

      {/* ── Lista ─────────────────────────────────────────────────────── */}
      <div>
        <button
          type="button"
          onClick={nuevoCombo}
          className="w-full mb-3 py-2 rounded-xl border-2 border-dashed border-naranja/40 text-naranja
                     text-sm font-semibold hover:bg-naranja/5 transition flex items-center justify-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nuevo combo
        </button>

        {combos.length === 0 && (
          <p className="text-sm text-navy/35 text-center py-6 italic">Sin combos configurados.</p>
        )}

        <div className="space-y-1.5 max-h-[calc(100vh-240px)] overflow-y-auto pr-1">
          {combos.map(row => {
            const isSel = draft?.id === row.id
            return (
              <button
                key={row.id}
                type="button"
                onClick={() => seleccionarCombo(row)}
                className={`w-full text-left px-3 py-2.5 rounded-xl border transition ${
                  isSel
                    ? 'bg-naranja/10 border-naranja/40'
                    : 'bg-white border-navy/10 hover:border-naranja/20 hover:bg-naranja/5'
                } ${!row.activo ? 'opacity-50' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <p className="text-sm font-semibold text-navy truncate">{row.nombre}</p>
                      <span className="flex-shrink-0 text-[9px] font-bold bg-ambar/15 text-ambar px-1.5 py-0.5 rounded uppercase tracking-wide">
                        COMBO
                      </span>
                    </div>
                    <p className="text-xs text-navy/40">
                      {row.slotCount} slot{row.slotCount !== 1 ? 's' : ''} · {row.locCount} local{row.locCount !== 1 ? 'es' : ''}
                    </p>
                  </div>
                  {!row.activo && (
                    <span className="flex-shrink-0 text-[10px] font-semibold bg-navy/15 text-navy/50 px-1.5 py-0.5 rounded-full mt-0.5">
                      Inactivo
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Formulario ────────────────────────────────────────────────── */}
      {!draft ? (
        <div className="rounded-2xl border-2 border-dashed border-navy/15 p-10 text-center hidden lg:block">
          <p className="text-navy/30 text-sm">Selecciona un combo o crea uno nuevo.</p>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-5">

          {/* Datos básicos */}
          <Section titulo="Datos del combo">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px] gap-4">
              <Field label="Nombre *">
                <input
                  type="text"
                  value={draft.nombre}
                  onChange={e => setDraft(d => d ? { ...d, nombre: e.target.value } : d)}
                  placeholder="Ej. Menú del día"
                  className={INPUT_CLS}
                />
              </Field>
              <Field label="Código (opcional)">
                <input
                  type="text"
                  value={draft.codigo}
                  onChange={e => setDraft(d => d ? { ...d, codigo: e.target.value } : d)}
                  placeholder="Ej. C/001"
                  className={INPUT_CLS}
                />
              </Field>
            </div>
          </Section>

          {/* Slots */}
          <Section
            titulo="Slots del combo"
            action={
              <button type="button" onClick={addSlot}
                className="flex items-center gap-1 text-xs font-semibold text-naranja hover:text-terranova transition">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Agregar slot
              </button>
            }
          >
            {draft.slots.length === 0 && (
              <p className="text-xs text-navy/30 italic">Sin slots. Haz clic en "Agregar slot".</p>
            )}
            <div className="space-y-3">
              {draft.slots.map((slot, i) => {
                const search = slotSearches[i] ?? ''
                const platosVisibles = search.trim()
                  ? platos.filter(p => p.nombre.toLowerCase().includes(search.toLowerCase()))
                  : platos

                return (
                  <div key={i} className="rounded-xl border border-navy/15 bg-crema/20 p-3">

                    {/* Encabezado de slot: flechas + nombre + borrar */}
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex flex-col gap-0.5">
                        <button type="button" onClick={() => moveSlotUp(i)} disabled={i === 0}
                          className="p-0.5 text-navy/30 hover:text-navy disabled:opacity-20 transition">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                        <button type="button" onClick={() => moveSlotDown(i)} disabled={i === draft.slots.length - 1}
                          className="p-0.5 text-navy/30 hover:text-navy disabled:opacity-20 transition">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>
                      <span className="text-xs text-navy/30 w-4 text-right select-none">{i + 1}.</span>
                      <input
                        type="text"
                        value={slot.nombre}
                        onChange={e => setSlotNombre(i, e.target.value)}
                        placeholder="Nombre del slot (ej. Entrante)"
                        className="flex-1 px-3 py-1.5 text-sm rounded-xl border border-navy/15 bg-white text-navy
                                   placeholder:text-navy/25 focus:outline-none focus:ring-2 focus:ring-naranja/20
                                   focus:border-naranja transition"
                      />
                      <button type="button" onClick={() => removeSlot(i)}
                        className="p-1 rounded-lg text-navy/25 hover:text-terranova hover:bg-terranova/10 transition">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    {/* Selector de platos del slot */}
                    <div className="pl-9">
                      <p className="text-[10px] font-semibold text-navy/40 uppercase tracking-wide mb-2">
                        Platos disponibles para este slot
                        {slot.platoIds.size > 0 && (
                          <span className="ml-1.5 text-naranja normal-case font-normal">
                            · {slot.platoIds.size} seleccionado{slot.platoIds.size !== 1 ? 's' : ''}
                          </span>
                        )}
                      </p>

                      {/* Mini-buscador por slot */}
                      <div className="relative mb-2">
                        <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-navy/30 pointer-events-none"
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round"
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                          type="search"
                          value={search}
                          onChange={e => setSlotSearches(ss => {
                            const n = [...ss]; n[i] = e.target.value; return n
                          })}
                          placeholder="Buscar plato…"
                          className="w-full pl-7 pr-3 py-1 rounded-lg border border-navy/10 bg-white text-xs
                                     text-navy placeholder:text-navy/25 focus:outline-none focus:ring-1
                                     focus:ring-naranja/30 focus:border-naranja transition"
                        />
                      </div>

                      {platosVisibles.length === 0 ? (
                        <p className="text-xs text-navy/25 italic">Sin platos que coincidan.</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                          {platosVisibles.map(p => {
                            const sel = slot.platoIds.has(p.id)
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => togglePlatoEnSlot(i, p.id)}
                                className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition ${
                                  sel
                                    ? 'bg-naranja text-white border-naranja'
                                    : 'bg-white text-navy/55 border-navy/15 hover:border-naranja/40 hover:text-naranja'
                                }`}
                              >
                                {p.nombre}
                                {p.codigo && (
                                  <span className="ml-1 opacity-55">({p.codigo})</span>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </Section>

          {/* Locales */}
          <Section titulo="Disponible en estos locales">
            {grupos.length === 0 ? (
              <p className="text-xs text-navy/30 italic">Sin locales activos.</p>
            ) : (
              <div className="space-y-5">
                {grupos.map(g => {
                  const ls      = g.locales
                  const allSel  = ls.every(l => draft.localIds.has(l.id))
                  const noneSel = ls.every(l => !draft.localIds.has(l.id))
                  return (
                    <div key={g.marca.id}>
                      <div className="flex items-center gap-2 mb-2">
                        <button
                          type="button"
                          onClick={() => toggleMarca(g.marca.id)}
                          className="text-xs font-semibold text-navy/60 hover:text-navy transition"
                          title={allSel ? 'Deseleccionar todos' : 'Seleccionar todos'}
                        >
                          {g.marca.nombre}
                          <span className="ml-1 text-naranja font-normal">
                            {allSel ? '(todos ✓)' : noneSel ? '' : '(parcial)'}
                          </span>
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {ls.map(l => (
                          <label
                            key={l.id}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border cursor-pointer transition ${
                              draft.localIds.has(l.id)
                                ? 'bg-naranja/10 border-naranja/40'
                                : 'bg-crema/30 border-navy/10 hover:border-navy/25'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={draft.localIds.has(l.id)}
                              onChange={() => toggleLocal(l.id)}
                              className="accent-naranja w-4 h-4 rounded flex-shrink-0"
                            />
                            <span className="text-sm text-navy truncate">{l.nombre}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Section>

          {/* Mensajes */}
          {error      && <p className="text-sm text-terranova bg-terranova/10 rounded-xl px-4 py-2.5">{error}</p>}
          {successMsg && <p className="text-sm text-green-700 bg-green-50 rounded-xl px-4 py-2.5">{successMsg}</p>}

          {/* Confirmación de eliminación */}
          {deleteConfirm && (
            <div className={`rounded-xl border-2 p-4 ${
              deleteConfirm.usedCount > 0
                ? 'bg-terranova/5 border-terranova/30'
                : 'bg-navy/5 border-navy/20'
            }`}>
              {deleteConfirm.usedCount > 0 ? (
                <>
                  <p className="text-sm font-semibold text-terranova mb-1">Advertencia</p>
                  <p className="text-sm text-navy/70 mb-3">
                    Este combo fue usado en <strong>{deleteConfirm.usedCount}</strong>{' '}
                    {deleteConfirm.usedCount === 1 ? 'auditoría' : 'auditorías'}.
                    Si lo eliminas, se perderá el detalle de producto de{' '}
                    {deleteConfirm.usedCount === 1 ? 'esa auditoría' : 'esas auditorías'}.
                    ¿Continuar?
                  </p>
                </>
              ) : (
                <p className="text-sm text-navy/70 mb-3">
                  ¿Eliminar el combo <strong>{deleteConfirm.combo.nombre}</strong>? Esta acción no se puede deshacer.
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleConfirmarEliminar}
                  disabled={deleting}
                  className="px-4 py-2 rounded-xl bg-terranova text-white text-sm font-semibold
                             hover:opacity-90 disabled:opacity-40 transition"
                >
                  {deleting ? 'Eliminando…' : 'Sí, eliminar'}
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(null)}
                  disabled={deleting}
                  className="px-4 py-2 rounded-xl border border-navy/20 text-sm text-navy/55
                             hover:bg-navy/5 transition"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Acciones principales */}
          {!deleteConfirm && (
            <div className="flex items-center gap-3 flex-wrap pt-1">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 rounded-xl bg-naranja text-white text-sm font-semibold
                           hover:bg-terranova disabled:opacity-40 transition"
              >
                {saving ? 'Guardando…' : draft.id === null ? 'Crear combo' : 'Guardar cambios'}
              </button>

              {draft.id !== null && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const row = combos.find(c => c.id === draft.id)
                      if (row) handleToggleActivo(row)
                    }}
                    className="px-4 py-2.5 rounded-xl border border-navy/20 text-sm font-medium text-navy/55
                               hover:bg-navy/5 transition"
                  >
                    {draft.activo ? 'Desactivar' : 'Reactivar'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const row = combos.find(c => c.id === draft.id)
                      if (row) handleIniciarEliminar(row)
                    }}
                    className="px-4 py-2.5 rounded-xl border border-terranova/30 text-sm font-medium
                               text-terranova hover:bg-terranova/5 transition"
                  >
                    Eliminar
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => { setDraft(null); setError(null); setSuccessMsg(null) }}
                className="px-4 py-2.5 rounded-xl text-sm text-navy/35 hover:text-navy transition"
              >
                Cancelar
              </button>
            </div>
          )}
        </form>
      )}
    </div>
  )
}

/* ── Helpers de UI ──────────────────────────────────────────────────────── */

function Section({ titulo, action, children }: {
  titulo: string; action?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-navy/15 bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-xs font-bold text-navy/40 uppercase tracking-wide">{titulo}</h4>
        {action}
      </div>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-navy/50 mb-1.5">{label}</label>
      {children}
    </div>
  )
}
