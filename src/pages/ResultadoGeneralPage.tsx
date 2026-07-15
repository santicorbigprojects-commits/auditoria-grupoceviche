import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import type { AuLocal, AuDirectorLocal } from '../types'

/* ── Semáforo (mismos cortes que DirectorPage) ────────────────────────────── */
function semColor(nota: number) {
  if (nota >= 16) return { dot: 'bg-green-500', badge: 'bg-green-100 text-green-700' }
  if (nota >= 12) return { dot: 'bg-ambar',      badge: 'bg-ambar/15 text-ambar'     }
  return               { dot: 'bg-terranova', badge: 'bg-terranova/10 text-terranova' }
}

interface LatestAud {
  fecha:      string
  nota_total: number
  creado_en:  string
}

interface FilaLocal {
  local:          AuLocal
  directorNombre: string
  latest:         LatestAud | null
}

function fechaCorta(fecha: string): string {
  try {
    return new Date(fecha + 'T12:00:00').toLocaleDateString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    })
  } catch { return fecha }
}

export default function ResultadoGeneralPage() {
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const [locales,          setLocales]          = useState<AuLocal[]>([])
  const [directorPorLocal, setDirectorPorLocal] = useState<Record<string, string>>({})
  const [latestByLocal,    setLatestByLocal]    = useState<Record<string, LatestAud>>({})

  const [filtroDirector, setFiltroDirector] = useState<string>('TODOS')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      // 1. Locales activos
      const { data: l, error: eL } = await supabase
        .from('au_locales')
        .select('*')
        .eq('activo', true)
        .order('nombre')
      if (eL) throw eL
      const localesList = (l ?? []) as AuLocal[]
      setLocales(localesList)

      // 2. Director de cada local (au_director_locales → au_usuarios)
      const { data: dlData, error: eDl } = await supabase
        .from('au_director_locales')
        .select('*')
      if (eDl) throw eDl
      const directorLocales = (dlData ?? []) as AuDirectorLocal[]

      const directorCuts = Array.from(new Set(directorLocales.map(d => d.director_cut)))
      const directorNombreMap: Record<string, string> = {}
      if (directorCuts.length > 0) {
        const { data: usersData, error: eUs } = await supabase
          .from('au_usuarios')
          .select('cut, nombre')
          .in('cut', directorCuts)
        if (eUs) throw eUs
        ;(usersData ?? []).forEach((u: { cut: string; nombre: string }) => {
          directorNombreMap[u.cut] = u.nombre
        })
      }

      const localDirectorMap: Record<string, string> = {}
      directorLocales.forEach(dl => {
        const nombre = directorNombreMap[dl.director_cut]
        if (nombre) localDirectorMap[dl.local_id] = nombre
      })
      setDirectorPorLocal(localDirectorMap)

      // 3. Todas las auditorías, quedarse con la más reciente por local
      const { data: auds, error: eA } = await supabase
        .from('au_auditorias')
        .select('local_id, fecha, nota_total, creado_en')
        .order('fecha', { ascending: false })
        .order('creado_en', { ascending: false })
        .range(0, 9999)
      if (eA) throw eA

      const latest: Record<string, LatestAud> = {}
      for (const a of (auds ?? [])) {
        if (a.nota_total !== null && !latest[a.local_id]) {
          latest[a.local_id] = { fecha: a.fecha, nota_total: a.nota_total, creado_en: a.creado_en }
        }
      }
      setLatestByLocal(latest)
    } catch (err) {
      console.error(err)
      setError('Error cargando el resultado general. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const directores = useMemo(() => {
    return Array.from(new Set(Object.values(directorPorLocal))).sort((a, b) => a.localeCompare(b))
  }, [directorPorLocal])

  const filas: FilaLocal[] = useMemo(() => {
    return locales
      .filter(l => filtroDirector === 'TODOS' || directorPorLocal[l.id] === filtroDirector)
      .map(l => ({
        local:          l,
        directorNombre: directorPorLocal[l.id] ?? '—',
        latest:         latestByLocal[l.id] ?? null,
      }))
  }, [locales, directorPorLocal, latestByLocal, filtroDirector])

  const { promedio, auditados, total } = useMemo(() => {
    const conNota = filas.filter(f => f.latest !== null)
    const suma = conNota.reduce((acc, f) => acc + (f.latest?.nota_total ?? 0), 0)
    return {
      promedio:  conNota.length > 0 ? suma / conNota.length : null,
      auditados: conNota.length,
      total:     filas.length,
    }
  }, [filas])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 rounded-full border-4 border-naranja border-t-transparent" />
      </div>
    )
  }

  const col = promedio !== null ? semColor(promedio) : null

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-navy" style={{ fontFamily: 'Poppins, sans-serif' }}>
          Resultado general
        </h2>
        <p className="text-sm text-navy/40 mt-0.5">
          Nota promedio del grupo, calculada con la última auditoría de cada local.
        </p>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 text-sm text-terranova bg-terranova/10 rounded-xl px-4 py-3">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" clipRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm-.75-5.75a.75.75 0 001.5 0v-4a.75.75 0 00-1.5 0v4zm.75 2.5a1 1 0 100-2 1 1 0 000 2z" />
          </svg>
          {error}
        </div>
      )}

      {/* Nota general destacada */}
      <div className="bg-white rounded-2xl border border-navy/10 shadow-sm p-8 mb-6 text-center">
        {promedio === null ? (
          <>
            <p className="text-4xl font-bold text-navy/25" style={{ fontFamily: 'Poppins, sans-serif' }}>—</p>
            <p className="text-sm text-navy/40 mt-2">Aún no hay locales auditados.</p>
          </>
        ) : (
          <>
            <p
              className={`text-6xl font-bold tabular-nums ${col!.badge.split(' ')[1]}`}
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              {promedio.toFixed(2)}
              <span className="text-2xl font-normal opacity-50"> / 20</span>
            </p>
            <p className="text-sm text-navy/40 mt-3">
              Promedio de {auditados} {auditados === 1 ? 'local auditado' : 'locales auditados'} de {total}
            </p>
          </>
        )}
      </div>

      {/* Filtro por director */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select
          value={filtroDirector}
          onChange={e => setFiltroDirector(e.target.value)}
          className="px-3 py-2 rounded-xl border border-navy/20 bg-white text-navy text-sm
                     focus:outline-none focus:ring-2 focus:ring-naranja/40 focus:border-naranja transition"
        >
          <option value="TODOS">Todos los directores</option>
          {directores.map(d => <option key={d} value={d}>{d}</option>)}
        </select>

        <span className="text-xs text-navy/35 ml-auto">
          {filas.length} {filas.length === 1 ? 'local' : 'locales'}
        </span>
      </div>

      {/* Tabla de locales */}
      {filas.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-navy/15 p-10 text-center">
          <p className="text-navy/30 text-sm">No hay locales que coincidan con el filtro.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-navy/10 shadow-sm overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b border-navy/10">
                <th className="text-left px-4 py-3 text-xs font-semibold text-navy/40 uppercase tracking-wide">Local</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-navy/40 uppercase tracking-wide">Director</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-navy/40 uppercase tracking-wide whitespace-nowrap">Última nota</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-navy/40 uppercase tracking-wide whitespace-nowrap">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy/5">
              {filas.map(f => {
                const fCol = f.latest ? semColor(f.latest.nota_total) : null
                return (
                  <tr key={f.local.id} className={`hover:bg-navy/[0.03] transition-colors ${!f.latest ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3 text-navy font-medium max-w-[220px] truncate" title={f.local.nombre}>
                      {f.local.nombre}
                    </td>
                    <td className="px-4 py-3 text-navy/70 max-w-[160px] truncate" title={f.directorNombre}>
                      {f.directorNombre}
                    </td>
                    <td className="px-4 py-3">
                      {f.latest ? (
                        <span className={`inline-flex items-baseline gap-0.5 px-2.5 py-1 rounded-lg text-sm font-bold tabular-nums w-fit ${fCol!.badge}`}>
                          {f.latest.nota_total.toFixed(1)}
                          <span className="text-xs font-normal opacity-60">/20</span>
                        </span>
                      ) : (
                        <span className="inline-block text-xs font-semibold px-2.5 py-1 rounded-lg bg-navy/5 text-navy/35">
                          No auditado
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-navy/60 whitespace-nowrap">
                      {f.latest ? fechaCorta(f.latest.fecha) : <span className="text-navy/25">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
