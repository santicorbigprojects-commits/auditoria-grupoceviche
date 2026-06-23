import { useState, useEffect, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import type { AuLocal, AuMarca } from '../../types'

/* ── Tipos locales ──────────────────────────────────────────────────────── */

interface IngDraft {
  id:     string | null   // null = nuevo
  nombre: string
}

interface PlatoDraft {
  id:       string | null   // null = creando
  nombre:   string
  codigo:   string
  activo:   boolean
  ings:     IngDraft[]
  localIds: Set<string>
}

interface PlatoRow {
  id:       string
  nombre:   string
  codigo:   string | null
  activo:   boolean
  ingCount: number
  locCount: number
}

interface GrupoMarca { marca: AuMarca; locales: AuLocal[] }

const VACIO: PlatoDraft = {
  id: null, nombre: '', codigo: '', activo: true, ings: [], localIds: new Set(),
}

/* ── Componente principal ───────────────────────────────────────────────── */

export default function GestionPlatos() {
  const [platos,     setPlatos]     = useState<PlatoRow[]>([])
  const [locales,    setLocales]    = useState<AuLocal[]>([])
  const [marcas,     setMarcas]     = useState<AuMarca[]>([])
  const [draft,      setDraft]      = useState<PlatoDraft | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [
      { data: pData },
      { data: iData },
      { data: plData },
      { data: lData },
      { data: mData },
    ] = await Promise.all([
      supabase.from('au_platos').select('id, nombre, codigo, activo').order('nombre'),
      supabase.from('au_plato_ingredientes').select('id, plato_id, nombre, orden').order('orden'),
      supabase.from('au_plato_locales').select('plato_id, local_id'),
      supabase.from('au_locales').select('*').eq('activo', true).order('nombre'),
      supabase.from('au_marcas').select('*').order('es_carpeta', { ascending: false }).order('nombre'),
    ])

    const rows: PlatoRow[] = (pData ?? []).map(p => ({
      id:       p.id,
      nombre:   p.nombre,
      codigo:   p.codigo,
      activo:   p.activo,
      ingCount: (iData  ?? []).filter(i => i.plato_id === p.id).length,
      locCount: (plData ?? []).filter(l => l.plato_id === p.id).length,
    }))

    setPlatos(rows)
    setLocales(lData ?? [])
    setMarcas(mData  ?? [])
    setLoading(false)
  }

  async function seleccionarPlato(row: PlatoRow) {
    setError(null); setSuccessMsg(null)
    // Carga los detalles (ingredientes + locales) del plato seleccionado
    const [{ data: ings }, { data: pls }] = await Promise.all([
      supabase.from('au_plato_ingredientes').select('id, nombre, orden').eq('plato_id', row.id).order('orden'),
      supabase.from('au_plato_locales').select('local_id').eq('plato_id', row.id),
    ])
    setDraft({
      id:       row.id,
      nombre:   row.nombre,
      codigo:   row.codigo ?? '',
      activo:   row.activo,
      ings:     (ings ?? []).map(i => ({ id: i.id, nombre: i.nombre })),
      localIds: new Set((pls ?? []).map(l => l.local_id)),
    })
  }

  function nuevoPlato() {
    setDraft({ ...VACIO, localIds: new Set() })
    setError(null); setSuccessMsg(null)
  }

  /* ── Ingredientes ───────────────────────────────────────────────────── */

  function addIng() {
    setDraft(d => d ? { ...d, ings: [...d.ings, { id: null, nombre: '' }] } : d)
  }
  function removeIng(i: number) {
    setDraft(d => d ? { ...d, ings: d.ings.filter((_, j) => j !== i) } : d)
  }
  function setIngNombre(i: number, v: string) {
    setDraft(d => {
      if (!d) return d
      const ings = [...d.ings]; ings[i] = { ...ings[i], nombre: v }
      return { ...d, ings }
    })
  }
  function moveUp(i: number) {
    if (i === 0) return
    setDraft(d => {
      if (!d) return d
      const ings = [...d.ings];[ings[i - 1], ings[i]] = [ings[i], ings[i - 1]]
      return { ...d, ings }
    })
  }
  function moveDown(i: number) {
    setDraft(d => {
      if (!d || i >= d.ings.length - 1) return d
      const ings = [...d.ings];[ings[i], ings[i + 1]] = [ings[i + 1], ings[i]]
      return { ...d, ings }
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
    if (!draft.nombre.trim()) { setError('El nombre del plato es obligatorio.'); return }
    setSaving(true); setError(null); setSuccessMsg(null)

    try {
      let pid = draft.id

      if (pid === null) {
        const { data, error: e1 } = await supabase
          .from('au_platos')
          .insert({ nombre: draft.nombre.trim(), codigo: draft.codigo.trim() || null, activo: true })
          .select('id').single()
        if (e1 || !data) throw e1 ?? new Error('Error al crear el plato')
        pid = data.id
      } else {
        const { error: e1 } = await supabase
          .from('au_platos')
          .update({ nombre: draft.nombre.trim(), codigo: draft.codigo.trim() || null })
          .eq('id', pid)
        if (e1) throw e1
      }

      // Delete + re-insert ingredientes (conserva orden por índice)
      await supabase.from('au_plato_ingredientes').delete().eq('plato_id', pid)
      const ingsOk = draft.ings.filter(i => i.nombre.trim())
      if (ingsOk.length > 0) {
        const { error: e2 } = await supabase.from('au_plato_ingredientes').insert(
          ingsOk.map((ing, idx) => ({ plato_id: pid, nombre: ing.nombre.trim(), orden: idx, activo: true }))
        )
        if (e2) throw e2
      }

      // Delete + re-insert plato_locales
      await supabase.from('au_plato_locales').delete().eq('plato_id', pid)
      if (draft.localIds.size > 0) {
        const { error: e3 } = await supabase.from('au_plato_locales').insert(
          [...draft.localIds].map(localId => ({ plato_id: pid, local_id: localId }))
        )
        if (e3) throw e3
      }

      const isNew = draft.id === null
      await loadAll()
      setSuccessMsg(isNew ? 'Plato creado correctamente.' : 'Plato actualizado correctamente.')
      if (isNew) setDraft(null)
      else setDraft(d => d ? { ...d, id: pid } : d)  // actualiza id si era nuevo

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActivo(row: PlatoRow) {
    await supabase.from('au_platos').update({ activo: !row.activo }).eq('id', row.id)
    if (draft?.id === row.id) setDraft(d => d ? { ...d, activo: !row.activo } : d)
    await loadAll()
  }

  /* ── Grupos de locales para checkboxes ─────────────────────────────── */

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
          onClick={nuevoPlato}
          className="w-full mb-3 py-2 rounded-xl border-2 border-dashed border-naranja/40 text-naranja
                     text-sm font-semibold hover:bg-naranja/5 transition flex items-center justify-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nuevo plato
        </button>

        {platos.length === 0 && (
          <p className="text-sm text-navy/35 text-center py-6 italic">Sin platos configurados.</p>
        )}

        <div className="space-y-1.5 max-h-[calc(100vh-240px)] overflow-y-auto pr-1">
          {platos.map(row => {
            const isSel = draft?.id === row.id
            return (
              <button
                key={row.id}
                type="button"
                onClick={() => seleccionarPlato(row)}
                className={`w-full text-left px-3 py-2.5 rounded-xl border transition ${
                  isSel
                    ? 'bg-naranja/10 border-naranja/40'
                    : 'bg-white border-navy/10 hover:border-naranja/20 hover:bg-naranja/5'
                } ${!row.activo ? 'opacity-50' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-navy truncate">{row.nombre}</p>
                    <p className="text-xs text-navy/40">
                      {row.ingCount} ingr. · {row.locCount} local{row.locCount !== 1 ? 'es' : ''}
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
          <p className="text-navy/30 text-sm">Selecciona un plato o crea uno nuevo.</p>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-5">

          {/* Datos básicos */}
          <Section titulo="Datos del plato">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px] gap-4">
              <Field label="Nombre *">
                <input
                  type="text"
                  value={draft.nombre}
                  onChange={e => setDraft(d => d ? { ...d, nombre: e.target.value } : d)}
                  placeholder="Ej. Ceviche clásico"
                  className={INPUT_CLS}
                />
              </Field>
              <Field label="Código (opcional)">
                <input
                  type="text"
                  value={draft.codigo}
                  onChange={e => setDraft(d => d ? { ...d, codigo: e.target.value } : d)}
                  placeholder="Ej. R/001"
                  className={INPUT_CLS}
                />
              </Field>
            </div>
          </Section>

          {/* Ingredientes */}
          <Section
            titulo="Ingredientes / elementos a evaluar"
            action={
              <button type="button" onClick={addIng}
                className="flex items-center gap-1 text-xs font-semibold text-naranja hover:text-terranova transition">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Agregar
              </button>
            }
          >
            {draft.ings.length === 0 && (
              <p className="text-xs text-navy/30 italic">Sin ingredientes. Haz clic en "Agregar".</p>
            )}
            <div className="space-y-2">
              {draft.ings.map((ing, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex flex-col gap-0.5">
                    <button type="button" onClick={() => moveUp(i)} disabled={i === 0}
                      className="p-0.5 text-navy/30 hover:text-navy disabled:opacity-20 transition">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button type="button" onClick={() => moveDown(i)} disabled={i === draft.ings.length - 1}
                      className="p-0.5 text-navy/30 hover:text-navy disabled:opacity-20 transition">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                  <span className="text-xs text-navy/30 w-4 text-right select-none">{i + 1}.</span>
                  <input
                    type="text"
                    value={ing.nombre}
                    onChange={e => setIngNombre(i, e.target.value)}
                    placeholder="Nombre del ingrediente o elemento"
                    className="flex-1 px-3 py-1.5 text-sm rounded-xl border border-navy/15 bg-crema/30 text-navy
                               placeholder:text-navy/25 focus:outline-none focus:ring-2 focus:ring-naranja/20
                               focus:border-naranja transition"
                  />
                  <button type="button" onClick={() => removeIng(i)}
                    className="p-1 rounded-lg text-navy/25 hover:text-terranova hover:bg-terranova/10 transition">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </Section>

          {/* Locales */}
          <Section titulo="Disponible en estos locales">
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
          </Section>

          {/* Mensajes */}
          {error      && <p className="text-sm text-terranova bg-terranova/10 rounded-xl px-4 py-2.5">{error}</p>}
          {successMsg && <p className="text-sm text-green-700 bg-green-50 rounded-xl px-4 py-2.5">{successMsg}</p>}

          {/* Acciones */}
          <div className="flex items-center gap-3 flex-wrap pt-1">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-naranja text-white text-sm font-semibold
                         hover:bg-terranova disabled:opacity-40 transition"
            >
              {saving ? 'Guardando…' : draft.id === null ? 'Crear plato' : 'Guardar cambios'}
            </button>

            {draft.id !== null && (
              <button
                type="button"
                onClick={() => {
                  const row = platos.find(p => p.id === draft.id)
                  if (row) handleToggleActivo(row)
                }}
                className="px-4 py-2.5 rounded-xl border border-navy/20 text-sm font-medium text-navy/55
                           hover:bg-navy/5 transition"
              >
                {draft.activo ? 'Desactivar' : 'Reactivar'}
              </button>
            )}

            <button
              type="button"
              onClick={() => { setDraft(null); setError(null); setSuccessMsg(null) }}
              className="px-4 py-2.5 rounded-xl text-sm text-navy/35 hover:text-navy transition"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

/* ── Helpers de UI ──────────────────────────────────────────────────────── */

const INPUT_CLS = `w-full px-3 py-2 rounded-xl border border-navy/20 bg-crema/40 text-sm text-navy
placeholder:text-navy/25 focus:outline-none focus:ring-2 focus:ring-naranja/30 focus:border-naranja transition`

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
