import { useState } from 'react'
import GestionPlatos    from '../../components/config/GestionPlatos'
import GestionCombos    from '../../components/config/GestionCombos'
import ConfigSeveridad  from '../../components/config/ConfigSeveridad'
import ConfigTiempos    from '../../components/config/ConfigTiempos'
import ConfigRI         from '../../components/config/ConfigRI'

type Tab = 'platos' | 'combos' | 'severidad' | 'tiempos' | 'revision_interna'

const TABS: { key: Tab; label: string }[] = [
  { key: 'platos',           label: 'Platos'             },
  { key: 'combos',           label: 'Combos'             },
  { key: 'severidad',        label: 'Pesos de severidad' },
  { key: 'tiempos',          label: 'Tiempos objetivo'   },
  { key: 'revision_interna', label: 'Revisión Interna'   },
]

export default function ConfiguracionPage() {
  const [tab, setTab] = useState<Tab>('platos')

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-navy" style={{ fontFamily: 'Poppins, sans-serif' }}>
          Configuración
        </h2>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 mb-6 bg-navy/5 rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
              tab === t.key
                ? 'bg-white text-navy shadow-sm'
                : 'text-navy/45 hover:text-navy'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Contenido */}
      {tab === 'platos'    && <GestionPlatos />}
      {tab === 'combos'    && <GestionCombos />}
      {tab === 'severidad' && (
        <div className="bg-white rounded-2xl border border-navy/10 shadow-sm p-6">
          <h3 className="text-base font-bold text-navy mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Pesos de severidad
          </h3>
          <ConfigSeveridad />
        </div>
      )}
      {tab === 'tiempos' && <ConfigTiempos />}
      {tab === 'revision_interna' && (
        <div className="bg-white rounded-2xl border border-navy/10 shadow-sm p-6">
          <h3 className="text-base font-bold text-navy mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Topes de descuento — Revisión Interna
          </h3>
          <ConfigRI />
        </div>
      )}
    </div>
  )
}
