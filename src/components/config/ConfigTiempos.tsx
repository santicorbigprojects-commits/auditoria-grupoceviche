import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import type { AuLocal, AuConfigTiempos, TipoTiempo } from '../../types'

type TimeKey = 'entrante' | 'principal' | 'bebida' | 'postre' | 'sandwich' | 'jugos'

const TIPOS: { tipo: TipoTiempo; key: TimeKey; label: string }[] = [
  { tipo: 'ENTRANTE',  key: 'entrante',  label: 'Entrante'        },
  { tipo: 'PRINCIPAL', key: 'principal', label: 'Plato principal' },
  { tipo: 'BEBIDA',    key: 'bebida',    label: 'Bebida'          },
  { tipo: 'POSTRE',    key: 'postre',    label: 'Postre'          },
  { tipo: 'SANDWICH',  key: 'sandwich',  label: 'Sándwich (Cholito)' },
  { tipo: 'JUGOS',     key: 'jugos',     label: 'Jugos (Cholito)'    },
]

type ValoresMax = Record<TimeKey, string>

const DEFAULTS_STR: ValoresMax = {
  entrante: '10', principal: '20', bebida: '5', postre: '10', sandwich: '10', jugos: '5',
}

interface LocalOverride {
  local_id:     string
  local_nombre: string
  valores:      ValoresMax
}

export default function ConfigTiempos() {
  const [locales,    setLocales]    = useState<AuLocal[]>([])
  const [globales,   setGlobales]   = useState<ValoresMax>({ ...DEFAULTS_STR })
  const [overrides,  setOverrides]  = useState<LocalOverride[]>([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)

  // Save global state
  const [savingGlobal, setSavingGlobal] = useState(false)
  const [okGlobal,     setOkGlobal]     = useState(false)

  // Per-local save/delete state
  const [savingId,   setSavingId]   = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [okId,       setOkId]       = useState<string | null>(null)

  // Add-override form state
  const [adding,          setAdding]          = useState(false)
  const [newLocalId,      setNewLocalId]      = useState('')
  const [newValores,      setNewValores]      = useState<ValoresMax>({ ...DEFAULTS_STR })
  const [savingNew,       setSavingNew]       = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setError(null)
    const [{ data: ls, error: e1 }, { data: ts, error: e2 }] = await Promise.all([
      supabase.from('au_locales').select('*').eq('activo', true).order('nombre'),
      supabase.from('au_config_tiempos').select('*').range(0, 9999),
    ])
    if (e1 || e2) { setError('Error cargando configuración'); setLoading(false); return }

    const allLocales: AuLocal[]         = ls ?? []
    const rows:       AuConfigTiempos[] = ts ?? []

    // Parse globals
    const g = { ...DEFAULTS_STR }
    rows.filter(r => r.local_id === null).forEach(r => {
      const k = toKey(r.tipo)
      if (k) g[k] = String(r.max_min)
    })
    setGlobales(g)

    // Parse overrides grouped by local_id
    const byLocal: Record<string, ValoresMax> = {}
    rows.filter(r => r.local_id !== null).forEach(r => {
      const k = toKey(r.tipo)
      if (!k) return
      if (!byLocal[r.local_id!]) byLocal[r.local_id!] = { ...g }
      byLocal[r.local_id!][k] = String(r.max_min)
    })

    const ovs: LocalOverride[] = Object.entries(byLocal)
      .map(([lid, vals]) => {
        const loc = allLocales.find(l => l.id === lid)
        return loc ? { local_id: lid, local_nombre: loc.nombre, valores: vals } : null
      })
      .filter((o): o is LocalOverride => o !== null)
      .sort((a, b) => a.local_nombre.localeCompare(b.local_nombre))

    setLocales(allLocales)
    setOverrides(ovs)
    setLoading(false)
  }

  function toKey(tipo: string): TimeKey | null {
    const m: Record<string, TimeKey> = {
      ENTRANTE: 'entrante', PRINCIPAL: 'principal', BEBIDA: 'bebida', POSTRE: 'postre',
      SANDWICH: 'sandwich', JUGOS: 'jugos',
    }
    return m[tipo] ?? null
  }

  async function guardarGlobales() {
    setSavingGlobal(true)
    setOkGlobal(false)
    // UPDATE each row (seed already inserted them; NULLs don't upsert-conflict reliably)
    const updates = TIPOS.map(({ tipo, key }) =>
      supabase
        .from('au_config_tiempos')
        .update({ max_min: Number(globales[key]) || 0 })
        .is('local_id', null)
        .eq('tipo', tipo)
    )
    const results = await Promise.all(updates)
    setSavingGlobal(false)
    if (results.some(r => r.error)) { setError('Error al guardar valores globales'); return }
    setOkGlobal(true)
    setTimeout(() => setOkGlobal(false), 2500)
  }

  async function guardarOverride(ov: LocalOverride) {
    setSavingId(ov.local_id)
    setOkId(null)
    // Delete all existing rows for this local, then insert fresh
    const { error: eD } = await supabase
      .from('au_config_tiempos')
      .delete()
      .eq('local_id', ov.local_id)
    if (eD) { setSavingId(null); setError('Error al guardar override'); return }

    const rows = TIPOS.map(({ tipo, key }) => ({
      local_id: ov.local_id,
      tipo,
      max_min:  Number(ov.valores[key]) || 0,
    }))
    const { error: eI } = await supabase.from('au_config_tiempos').insert(rows)
    setSavingId(null)
    if (eI) { setError('Error al guardar override'); return }
    setOkId(ov.local_id)
    setTimeout(() => setOkId(null), 2500)
  }

  async function eliminarOverride(localId: string) {
    setDeletingId(localId)
    const { error: e } = await supabase
      .from('au_config_tiempos')
      .delete()
      .eq('local_id', localId)
    setDeletingId(null)
    if (e) { setError('Error al eliminar override'); return }
    setOverrides(prev => prev.filter(o => o.local_id !== localId))
  }

  async function guardarNuevoOverride() {
    if (!newLocalId) return
    setSavingNew(true)
    const rows = TIPOS.map(({ tipo, key }) => ({
      local_id: newLocalId,
      tipo,
      max_min:  Number(newValores[key]) || 0,
    }))
    const { error: e } = await supabase.from('au_config_tiempos').insert(rows)
    setSavingNew(false)
    if (e) { setError('Error al guardar nuevo override'); return }
    await load()
    setAdding(false)
    setNewLocalId('')
    setNewValores({ ...globales })
  }

  function cancelarAdding() {
    setAdding(false)
    setNewLocalId('')
    setNewValores({ ...globales })
  }

  const localesSinOverride = locales.filter(l => !overrides.some(o => o.local_id === l.id))

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin w-6 h-6 rounded-full border-4 border-naranja border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-center gap-2 text-sm text-terranova bg-terranova/10 rounded-xl px-4 py-3">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" clipRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm-.75-5.75a.75.75 0 001.5 0v-4a.75.75 0 00-1.5 0v4zm.75 2.5a1 1 0 100-2 1 1 0 000 2z" />
          </svg>
          {error}
          <button type="button" className="ml-auto text-terranova/70 hover:text-terranova"
            onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* ── Valores globales ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-navy/10 shadow-sm p-6">
        <h3 className="text-base font-bold text-navy mb-0.5" style={{ fontFamily: 'Poppins, sans-serif' }}>
          Tiempos máximos globales
        </h3>
        <p className="text-xs text-navy/40 mb-5">
          Se aplican a todos los locales salvo que tengan un valor específico configurado abajo.
          Sándwich y Jugos solo se evalúan en locales de marca Cholito.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-5">
          {TIPOS.map(({ key, label }) => (
            <div key={key}>
              <label className="block text-xs font-semibold text-navy/50 uppercase tracking-wide mb-1.5">
                {label}
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={1}
                  step={0.5}
                  value={globales[key]}
                  onChange={e => setGlobales(prev => ({ ...prev, [key]: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-navy/20 bg-white text-navy text-sm
                             focus:outline-none focus:ring-2 focus:ring-naranja/40 focus:border-naranja transition"
                />
                <span className="text-xs text-navy/35 whitespace-nowrap">min</span>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={guardarGlobales}
          disabled={savingGlobal}
          className="px-5 py-2 rounded-xl text-sm font-semibold bg-naranja text-white
                     hover:bg-naranja/90 disabled:opacity-50 transition"
        >
          {savingGlobal ? 'Guardando…' : okGlobal ? '¡Guardado!' : 'Guardar valores globales'}
        </button>
      </div>

      {/* ── Overrides por local ──────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-navy/10 shadow-sm p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-navy" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Valores específicos por local
            </h3>
            <p className="text-xs text-navy/40 mt-0.5">
              Si un local necesita tiempos distintos a los globales, agrégalo aquí.
            </p>
          </div>
          {!adding && localesSinOverride.length > 0 && (
            <button
              type="button"
              onClick={() => { setAdding(true); setNewValores({ ...globales }) }}
              className="flex-shrink-0 ml-4 px-4 py-2 rounded-xl text-sm font-semibold
                         border border-naranja text-naranja hover:bg-naranja/5 transition"
            >
              + Agregar local
            </button>
          )}
        </div>

        {/* Form: nuevo override */}
        {adding && (
          <div className="mb-5 p-4 rounded-xl border-2 border-dashed border-naranja/30 bg-naranja/5">
            <div className="mb-4">
              <label className="block text-xs font-semibold text-navy/50 uppercase tracking-wide mb-1.5">
                Local
              </label>
              <select
                value={newLocalId}
                onChange={e => setNewLocalId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-navy/20 bg-white text-navy text-sm
                           focus:outline-none focus:ring-2 focus:ring-naranja/40 focus:border-naranja transition"
              >
                <option value="">Selecciona un local…</option>
                {localesSinOverride.map(l => (
                  <option key={l.id} value={l.id}>{l.nombre}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
              {TIPOS.map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-navy/50 uppercase tracking-wide mb-1">
                    {label}
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={1}
                      step={0.5}
                      value={newValores[key]}
                      onChange={e => setNewValores(prev => ({ ...prev, [key]: e.target.value }))}
                      className="w-full px-2 py-1.5 rounded-lg border border-navy/20 bg-white text-navy text-sm
                                 focus:outline-none focus:ring-2 focus:ring-naranja/30 transition"
                    />
                    <span className="text-xs text-navy/35">min</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={guardarNuevoOverride}
                disabled={!newLocalId || savingNew}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-naranja text-white
                           disabled:opacity-50 hover:bg-naranja/90 transition"
              >
                {savingNew ? 'Guardando…' : 'Guardar'}
              </button>
              <button
                type="button"
                onClick={cancelarAdding}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-navy/50 hover:text-navy transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {overrides.length === 0 && !adding && (
          <p className="text-sm text-navy/35 italic text-center py-6">
            Ningún local tiene tiempos específicos — se aplican los valores globales a todos.
          </p>
        )}

        <div className="space-y-3">
          {overrides.map(ov => (
            <div key={ov.local_id} className="border border-navy/10 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-navy">{ov.local_nombre}</p>
                <button
                  type="button"
                  onClick={() => eliminarOverride(ov.local_id)}
                  disabled={!!deletingId}
                  className="text-xs text-terranova/60 hover:text-terranova disabled:opacity-40 transition"
                >
                  {deletingId === ov.local_id ? 'Eliminando…' : 'Quitar override'}
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                {TIPOS.map(({ key, label }) => (
                  <div key={key}>
                    <label className="block text-xs font-semibold text-navy/50 uppercase tracking-wide mb-1">
                      {label}
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={1}
                        step={0.5}
                        value={ov.valores[key]}
                        onChange={e =>
                          setOverrides(prev => prev.map(o =>
                            o.local_id === ov.local_id
                              ? { ...o, valores: { ...o.valores, [key]: e.target.value } }
                              : o
                          ))
                        }
                        className="w-full px-2 py-1.5 rounded-lg border border-navy/20 bg-white text-navy text-sm
                                   focus:outline-none focus:ring-2 focus:ring-naranja/30 transition"
                      />
                      <span className="text-xs text-navy/35">min</span>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => guardarOverride(ov)}
                disabled={savingId === ov.local_id || !!deletingId}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-navy text-white
                           disabled:opacity-50 hover:bg-navy/80 transition"
              >
                {savingId === ov.local_id
                  ? 'Guardando…'
                  : okId === ov.local_id
                  ? '¡Guardado!'
                  : 'Guardar cambios'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
