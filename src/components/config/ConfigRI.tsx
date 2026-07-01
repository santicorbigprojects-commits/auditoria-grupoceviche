import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import type { AspectoRI, AuConfigRI } from '../../types'

const FILAS: { key: AspectoRI; label: string; desc: string }[] = [
  { key: 'RI_REVISION',   label: 'Revisión de productos',   desc: 'Tope de descuento para este aspecto' },
  { key: 'RI_ROTULACION', label: 'Rotulación de productos', desc: 'Tope de descuento para este aspecto' },
  { key: 'RI_HIGIENE',    label: 'Higiene de cocina',       desc: 'Tope de descuento para este aspecto' },
]

const DEFAULTS: Record<AspectoRI, number> = { RI_REVISION: 2, RI_ROTULACION: 2, RI_HIGIENE: 3 }

export default function ConfigRI() {
  const [vals,   setVals]   = useState<Record<AspectoRI, number>>({ ...DEFAULTS })
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  useEffect(() => {
    supabase.from('au_config_ri').select('*').then(({ data }) => {
      if (data) {
        const m: Partial<Record<AspectoRI, number>> = {}
        ;(data as AuConfigRI[]).forEach(r => { m[r.aspecto] = r.max_descuento })
        setVals(v => ({ ...v, ...m }))
      }
    })
  }, [])

  async function handleSave() {
    setSaving(true); setError(null); setSaved(false)
    const rows = FILAS.map(f => ({ aspecto: f.key, max_descuento: vals[f.key] }))
    const { error: e } = await supabase
      .from('au_config_ri')
      .upsert(rows, { onConflict: 'aspecto' })
    setSaving(false)
    if (e) { setError(e.message); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="max-w-lg">
      <p className="text-xs text-navy/50 mb-5">
        Descuento máximo que puede restar cada aspecto de Revisión Interna, sin importar cuántas
        observaciones tenga. El total restado por Revisión Interna se resta directo del total, no del área.
      </p>

      <div className="space-y-3 mb-6">
        {FILAS.map(f => (
          <div key={f.key} className="flex items-center gap-4">
            <div className="w-48">
              <p className="text-sm font-semibold text-navy">{f.label}</p>
              <p className="text-xs text-navy/40">{f.desc}</p>
            </div>
            <input
              type="number"
              min={0}
              max={20}
              step={0.5}
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
        {saving ? 'Guardando…' : saved ? '✓ Guardado' : 'Guardar topes'}
      </button>
    </div>
  )
}
