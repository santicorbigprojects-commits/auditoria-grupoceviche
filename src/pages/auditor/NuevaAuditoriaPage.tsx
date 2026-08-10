import { useState } from 'react'
import TrackingPage from './TrackingPage'
import SeguridadAlimentariaPage from './SeguridadAlimentariaPage'
import AuditoriaObradorPage from './AuditoriaObradorPage'

type Tipo = 'calidad' | 'seguridad' | 'obrador' | null

export default function NuevaAuditoriaPage() {
  const [tipo, setTipo] = useState<Tipo>(null)

  if (tipo) {
    return (
      <>
        <div className="px-6 pt-6 max-w-5xl mx-auto">
          <button
            type="button"
            onClick={() => setTipo(null)}
            className="flex items-center gap-1.5 text-sm text-navy/50 hover:text-navy transition"
          >
            ← Cambiar tipo de auditoría
          </button>
        </div>
        {tipo === 'calidad' ? <TrackingPage /> : tipo === 'seguridad' ? <SeguridadAlimentariaPage /> : <AuditoriaObradorPage />}
      </>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-navy" style={{ fontFamily: 'Poppins, sans-serif' }}>
          Nueva auditoría
        </h2>
        <p className="text-sm text-navy/40 mt-0.5">Elige el tipo de evaluación que vas a realizar.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
        <TipoCard
          titulo="Auditoría de calidad"
          descripcion="Producto, servicio, local y revisión interna. Nota numérica sobre 20."
          icon={<IconCalidad />}
          onClick={() => setTipo('calidad')}
        />
        <TipoCard
          titulo="Evaluación de Seguridad Alimentaria"
          descripcion="Higiene, APPCC y buenas prácticas. Resultado cualitativo por semáforo."
          icon={<IconSeguridad />}
          onClick={() => setTipo('seguridad')}
        />
        <TipoCard
          titulo="Auditoría de Obrador"
          descripcion="Plancha/Salsa, Pastelería o Panadería. 5 aspectos con pesos, nota sobre 20."
          icon={<IconObrador />}
          onClick={() => setTipo('obrador')}
        />
      </div>
    </div>
  )
}

function TipoCard({
  titulo, descripcion, icon, onClick,
}: { titulo: string; descripcion: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left bg-white rounded-2xl border-2 border-navy/10 p-6 hover:border-naranja hover:shadow-lg
                 hover:shadow-naranja/10 transition-all group"
    >
      <div className="w-12 h-12 rounded-xl bg-naranja/10 text-naranja flex items-center justify-center mb-4
                      group-hover:bg-naranja group-hover:text-white transition-colors">
        {icon}
      </div>
      <h3 className="text-base font-bold text-navy mb-1.5" style={{ fontFamily: 'Poppins, sans-serif' }}>
        {titulo}
      </h3>
      <p className="text-sm text-navy/50 leading-relaxed">{descripcion}</p>
    </button>
  )
}

function IconCalidad() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  )
}

function IconSeguridad() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6l7-3z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 12l2 2 3.5-3.5" />
    </svg>
  )
}

function IconObrador() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M4 21V9l8-6 8 6v12M4 21h16M9 21v-6h6v6" />
    </svg>
  )
}
