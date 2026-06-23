import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import type { Severidad } from '../../types'

const FILAS: { key: Severidad; label: string; desc: string }[] = [
  { key: 'NINGUNA', label: 'Ninguna', desc: 'Sin descuento (informativa)' },
  { key: 'LEVE',    label: 'Leve',    desc: 'Descuento menor' },
  { key: 'MEDIA',   label: 'Media',   desc: 'Descuento moderado' },
  { key: 'GRAVE',   label: 'Grave',   desc: 'Descuento alto' },
]

export default function ConfigSeveridad() {
  const [vals,   setVals]   = useState<Record<Severidad, number>>({ NINGUNA: 0, LEVE: 0.25, MEDIA: 0.5, GRAVE: 1 })
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  useEffect(() => {
    supabase.from('au_config_severidad').select('*').then(({ data }) => {
      if (data) {
        const m: Partial<Record<Severidad, number>> = {}
        data.forEach(r => { m[r.severidad as Severidad] = r.descuento })
        setVals(v => ({ ...v, ...m }))
      }
    })
  }, [])

  async function handleSave() {
    setSaving(true); setError(null); setSaved(false)
    const rows = FILAS.map(f => ({ severidad: f.key, descuento: vals[f.key] }))
    const { error: e } = await supabase
      .from('au_config_severidad')
      .upsert(rows, { onConflict: 'severidad' })
    setSaving(false)
    if (e) { setError(e.message); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="max-w-lg">
      <p className="text-xs text-navy/50 mb-5">
        Puntos que se descuentan a la nota del área por cada observación según su severidad.
        El descuento es acumulativo y el piso es 0.
      </p>

      <div className="space-y-3 mb-6">
        {FILAS.map(f => (
          <div key={f.key} className="flex items-center gap-4">
            <div className="w-40">
              <p className="text-sm font-semibold text-navy">{f.label}</p>
              <p className="text-xs text-navy/40">{f.desc}</p>
            </div>
            <input
              type="number"
              min={0}
              max={6.67}
              step={0.05}
              value={vals[f.key]}
              onChange={e => {
                const n = parseFloat(e.target.value)
                if (!isNaN(n)) setVals(v => ({ ...v, [f.key]: n }))
              }}
              className="w-24 px-3 py-1.5 rounded-xl border border-navy/20 bg-white text-sm text-navy
                         text-right focus:outline-none focus:ring-2 focus:ring-naranja/30 focus:border-naranja transition"
            />
            <span className="text-xs text-navy/40">pts</span>
          </div>
        ))}
      </div>

      {error && <p className="text-xs text-terranova mb-3">{error}</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="px-5 py-2 rounded-xl bg-navy text-white text-sm font-semibold
                   hover:bg-marron disabled:opacity-40 transition"
      >
        {saving ? 'Guardando…' : saved ? '✓ Guardado' : 'Guardar pesos'}
      </button>
    </div>
  )
}
