import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import type { AuAuditoriaObrador } from '../../types'
import { exportarAuditoriasObradorExcel } from '../../lib/exportarExcelObrador'
import { exportarAuditoriaObradorPDF } from '../../lib/exportarPDFObrador'
import AuditoriaObradorPage from './AuditoriaObradorPage'

type Vista = 'lista' | 'editando'

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

export default function MisAuditoriasObradorPage() {
  const [vista,        setVista]        = useState<Vista>('lista')
  const [seleccionada, setSeleccionada] = useState<AuAuditoriaObrador | null>(null)
  const [obradorNombre, setObradorNombre] = useState('')

  function handleEditar(a: AuAuditoriaObrador, nombre: string) {
    setSeleccionada(a)
    setObradorNombre(nombre)
    setVista('editando')
  }

  return vista === 'lista'
    ? <ListaAuditoriasObrador onEditar={handleEditar} />
    : (
      <AuditoriaObradorPage
        auditoriaId={seleccionada!.id}
        obradorNombre={obradorNombre}
        onBack={() => setVista('lista')}
      />
    )
}

/* ══════════════════════════════════════════════════════════════════════════
   Lista
══════════════════════════════════════════════════════════════════════════ */

interface ListaProps {
  onEditar: (a: AuAuditoriaObrador, obradorNombre: string) => void
}

function ListaAuditoriasObrador({ onEditar }: ListaProps) {
  const { cut, rol } = useAuthStore()
  const [auditorias,  setAuditorias]  = useState<AuAuditoriaObrador[]>([])
  const [obradoresMap, setObradoresMap] = useState<Record<string, string>>({})
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [exportando,  setExportando]  = useState(false)
  const [errorExport, setErrorExport] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [{ data: auds, error: e1 }, { data: obs, error: e2 }] = await Promise.all([
        supabase
          .from('au_auditoria_obrador')
          .select('*')
          .eq('auditor_cut', cut!)
          .order('fecha_auditoria', { ascending: false })
          .order('creado_en', { ascending: false })
          .range(0, 9999),
        supabase.from('au_obradores').select('id, nombre'),
      ])
      if (e1) throw e1
      if (e2) throw e2
      setAuditorias(auds ?? [])
      const map: Record<string, string> = {}
      ;(obs ?? []).forEach((o: { id: string; nombre: string }) => { map[o.id] = o.nombre })
      setObradoresMap(map)
    } catch (err) {
      console.error(err)
      setError('Error cargando historial. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cut])

  async function handleExportar() {
    if (!cut || !rol) return
    setExportando(true)
    setErrorExport(null)
    try {
      await exportarAuditoriasObradorExcel(cut, rol)
    } catch (err) {
      console.error(err)
      setErrorExport(err instanceof Error ? err.message : 'Error al exportar. Intenta de nuevo.')
    } finally {
      setExportando(false)
    }
  }

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
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-navy" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Auditorías de obrador
          </h2>
          <p className="text-sm text-navy/40 mt-0.5">
            {auditorias.length} {auditorias.length === 1 ? 'registrada' : 'registradas'}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <button
            type="button"
            onClick={handleExportar}
            disabled={exportando || auditorias.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-navy text-white text-sm font-semibold
                       hover:bg-navy/85 disabled:opacity-40 transition whitespace-nowrap"
          >
            {exportando ? (
              <span className="animate-spin w-4 h-4 rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            )}
            {exportando ? 'Exportando…' : 'Exportar a Excel'}
          </button>
          {errorExport && (
            <p className="text-xs text-terranova max-w-[240px] text-right">{errorExport}</p>
          )}
        </div>
      </div>

      {auditorias.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-navy/15 p-10 text-center">
          <p className="text-navy/30 text-sm">No tienes auditorías de obrador registradas aún.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-navy/10 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy/10">
                <th className="text-left px-5 py-3 text-xs font-semibold text-navy/40 uppercase tracking-wide">Fecha</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-navy/40 uppercase tracking-wide">Obrador</th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-navy/40 uppercase tracking-wide">Nota</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-navy/5">
              {auditorias.map(a => (
                <FilaAuditoriaObrador
                  key={a.id}
                  auditoria={a}
                  obradorNombre={obradoresMap[a.obrador_id] ?? '—'}
                  onEditar={() => onEditar(a, obradoresMap[a.obrador_id] ?? '—')}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function FilaAuditoriaObrador({
  auditoria: a,
  obradorNombre,
  onEditar,
}: { auditoria: AuAuditoriaObrador; obradorNombre: string; onEditar: () => void }) {
  const nota = a.nota_final ?? 0
  const [exportandoPDF, setExportandoPDF] = useState(false)
  const [errorPDF,      setErrorPDF]      = useState<string | null>(null)

  const notaColor = nota >= 17 ? 'text-green-600' : nota >= 13 ? 'text-ambar' : 'text-terranova'
  const semaforoColor = nota >= 17 ? 'bg-green-500' : nota >= 13 ? 'bg-ambar' : 'bg-terranova'

  async function handleExportarPDF() {
    setExportandoPDF(true)
    setErrorPDF(null)
    try {
      await exportarAuditoriaObradorPDF(a, obradorNombre)
    } catch (err) {
      console.error(err)
      setErrorPDF('Error al generar el PDF. Intenta de nuevo.')
    } finally {
      setExportandoPDF(false)
    }
  }

  return (
    <tr className="hover:bg-navy/5 transition-colors">
      <td className="px-5 py-3.5 text-navy font-medium whitespace-nowrap">{fechaCorta(a.fecha_auditoria)}</td>
      <td className="px-5 py-3.5 text-navy/70 max-w-[220px] truncate">{obradorNombre}</td>
      <td className="px-3 py-3.5 text-center">
        <span className={`font-bold tabular-nums ${notaColor}`}>{nota.toFixed(2)}</span>
        <span className={`ml-2 inline-block w-2 h-2 rounded-full align-middle ${semaforoColor}`} />
      </td>
      <td className="px-4 py-3.5">
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleExportarPDF}
            disabled={exportandoPDF}
            title="Exportar a PDF"
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-navy/20 text-navy/55
                       hover:border-navy hover:text-navy transition font-medium whitespace-nowrap disabled:opacity-40"
          >
            {exportandoPDF ? (
              <span className="animate-spin w-3 h-3 rounded-full border-2 border-navy/30 border-t-navy" />
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            )}
            Exportar
          </button>
          <button
            type="button"
            onClick={onEditar}
            className="text-xs px-3 py-1.5 rounded-lg border border-navy/20 text-navy/55
                       hover:border-naranja hover:text-naranja transition font-medium whitespace-nowrap"
          >
            Editar
          </button>
        </div>
        {errorPDF && (
          <p className="text-[10px] text-terranova text-right mt-1 max-w-[220px] ml-auto">{errorPDF}</p>
        )}
      </td>
    </tr>
  )
}
