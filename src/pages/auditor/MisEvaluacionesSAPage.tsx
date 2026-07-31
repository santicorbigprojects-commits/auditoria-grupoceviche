import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import type { AuSaEvaluacion, EstadoCualitativo } from '../../types'
import SeguridadAlimentariaPage from './SeguridadAlimentariaPage'

type Vista = 'lista' | 'editando'

const ESTADO_BADGE: Record<EstadoCualitativo, string> = {
  CORRECTO:   'bg-green-100 text-green-700',
  MEJORA:     'bg-ambar/15 text-ambar',
  DEFICIENTE: 'bg-terranova/10 text-terranova',
}
const ESTADO_DOT: Record<EstadoCualitativo, string> = {
  CORRECTO:   'bg-green-500',
  MEJORA:     'bg-ambar',
  DEFICIENTE: 'bg-terranova',
}
const ESTADO_LABEL: Record<EstadoCualitativo, string> = {
  CORRECTO:   'Correcto',
  MEJORA:     'Mejora',
  DEFICIENTE: 'Deficiente',
}

function fechaCorta(fecha: string): string {
  try {
    return new Date(fecha + 'T12:00:00').toLocaleDateString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    })
  } catch { return fecha }
}

/* ══════════════════════════════════════════════════════════════════════════
   Root
══════════════════════════════════════════════════════════════════════════ */

export default function MisEvaluacionesSAPage() {
  const [vista,        setVista]        = useState<Vista>('lista')
  const [seleccionada, setSeleccionada] = useState<AuSaEvaluacion | null>(null)
  const [localNombre,  setLocalNombre]  = useState('')

  function handleEditar(e: AuSaEvaluacion, nombre: string) {
    setSeleccionada(e)
    setLocalNombre(nombre)
    setVista('editando')
  }

  return vista === 'lista'
    ? <ListaEvaluaciones onEditar={handleEditar} />
    : (
      <SeguridadAlimentariaPage
        evaluacionId={seleccionada!.id}
        localNombre={localNombre}
        onBack={() => setVista('lista')}
      />
    )
}

/* ══════════════════════════════════════════════════════════════════════════
   Lista
══════════════════════════════════════════════════════════════════════════ */

interface ListaProps {
  onEditar: (e: AuSaEvaluacion, localNombre: string) => void
}

function ListaEvaluaciones({ onEditar }: ListaProps) {
  const { cut } = useAuthStore()
  const [evaluaciones, setEvaluaciones] = useState<AuSaEvaluacion[]>([])
  const [localesMap,   setLocalesMap]   = useState<Record<string, string>>({})
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [{ data: evs, error: e1 }, { data: locs, error: e2 }] = await Promise.all([
          supabase
            .from('au_sa_evaluaciones')
            .select('*')
            .eq('auditor_cut', cut!)
            .order('fecha', { ascending: false })
            .order('creado_en', { ascending: false })
            .range(0, 9999),
          supabase.from('au_locales').select('id, nombre'),
        ])
        if (e1) throw e1
        if (e2) throw e2
        setEvaluaciones(evs ?? [])
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
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cut])

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
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-navy" style={{ fontFamily: 'Poppins, sans-serif' }}>
          Seguridad alimentaria
        </h2>
        <p className="text-sm text-navy/40 mt-0.5">
          {evaluaciones.length} {evaluaciones.length === 1 ? 'evaluación registrada' : 'evaluaciones registradas'}
        </p>
      </div>

      {evaluaciones.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-navy/15 p-10 text-center">
          <p className="text-navy/30 text-sm">No tienes evaluaciones de seguridad alimentaria registradas aún.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-navy/10 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy/10">
                <th className="text-left px-5 py-3 text-xs font-semibold text-navy/40 uppercase tracking-wide">Fecha</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-navy/40 uppercase tracking-wide">Local</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-navy/40 uppercase tracking-wide">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-navy/5">
              {evaluaciones.map(e => (
                <tr key={e.id} className="hover:bg-navy/5 transition-colors">
                  <td className="px-5 py-3.5 text-navy font-medium whitespace-nowrap">{fechaCorta(e.fecha)}</td>
                  <td className="px-5 py-3.5 text-navy/70 max-w-[220px] truncate">{localesMap[e.local_id] ?? '—'}</td>
                  <td className="px-3 py-3.5">
                    {e.estado_global ? (
                      <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg w-fit ${ESTADO_BADGE[e.estado_global]}`}>
                        <span className={`w-2 h-2 rounded-full ${ESTADO_DOT[e.estado_global]}`} />
                        {ESTADO_LABEL[e.estado_global]}
                      </span>
                    ) : (
                      <span className="text-navy/25">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <button
                      type="button"
                      onClick={() => onEditar(e, localesMap[e.local_id] ?? '—')}
                      className="text-xs px-3 py-1.5 rounded-lg border border-navy/20 text-navy/55
                                 hover:border-naranja hover:text-naranja transition font-medium whitespace-nowrap"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
