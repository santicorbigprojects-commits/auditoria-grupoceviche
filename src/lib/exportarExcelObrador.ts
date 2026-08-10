import { supabase } from './supabase'
import type {
  Rol,
  Severidad,
  AuAuditoriaObrador,
  AuAuditoriaObradorAspecto,
  AuAuditoriaObradorObservacion,
  AuConfigObradorAspecto,
} from '../types'

/* ══════════════════════════════════════════════════════════════════════════
   SheetJS (xlsx) cargado desde el CDN oficial en tiempo de uso — no vía npm.
   (mismo patrón que exportarExcel.ts)
══════════════════════════════════════════════════════════════════════════ */

const XLSX_CDN_URL = 'https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js'

let xlsxPromise: Promise<XLSXModule> | null = null

interface XLSXModule {
  utils: {
    json_to_sheet: (data: Record<string, unknown>[]) => unknown
    book_new: () => unknown
    book_append_sheet: (wb: unknown, ws: unknown, nombre: string) => void
  }
  writeFile: (wb: unknown, nombre: string) => void
}

function cargarXLSX(): Promise<XLSXModule> {
  const w = window as unknown as { XLSX?: XLSXModule }
  if (w.XLSX) return Promise.resolve(w.XLSX)
  if (xlsxPromise) return xlsxPromise

  xlsxPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = XLSX_CDN_URL
    script.async = true
    script.onload = () => {
      const ww = window as unknown as { XLSX?: XLSXModule }
      if (ww.XLSX) resolve(ww.XLSX)
      else reject(new Error('SheetJS no se cargó correctamente.'))
    }
    script.onerror = () => reject(new Error('No se pudo cargar SheetJS desde el CDN.'))
    document.head.appendChild(script)
  })
  return xlsxPromise
}

const SEV_LABEL: Record<Severidad, string> = {
  NINGUNA: 'Ninguna',
  LEVE:    'Leve',
  MEDIA:   'Media',
  GRAVE:   'Grave',
  EXTREMA: 'Extremadamente grave',
}

const RESPUESTA_LABEL: Record<0 | 1 | 2, string> = { 0: 'No', 1: 'Masomenos', 2: 'Sí' }

function fechaLabel(fecha: string): string {
  try {
    return new Date(fecha + 'T12:00:00').toLocaleDateString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    })
  } catch { return fecha }
}

function groupBy<T extends { auditoria_id: string }>(rows: T[]): Map<string, T[]> {
  const m = new Map<string, T[]>()
  for (const r of rows) {
    const arr = m.get(r.auditoria_id) ?? []
    arr.push(r)
    m.set(r.auditoria_id, arr)
  }
  return m
}

interface Cabecera {
  Fecha: string
  Obrador: string
  'Auditor (nombre)': string
  'Nota Final': number | string
}

export async function exportarAuditoriasObradorExcel(cut: string, rol: Rol): Promise<void> {
  const XLSX = await cargarXLSX()

  let query = supabase
    .from('au_auditoria_obrador')
    .select('*')
    .order('fecha_auditoria', { ascending: false })
    .range(0, 9999)
  if (rol !== 'ADMIN') query = query.eq('auditor_cut', cut)

  const { data: auditoriasData, error: eAud } = await query
  if (eAud) throw eAud
  const auditorias = (auditoriasData ?? []) as AuAuditoriaObrador[]
  if (auditorias.length === 0) throw new Error('No hay auditorías de obrador para exportar.')

  const ids = auditorias.map(a => a.id)

  const [
    { data: obradores },
    { data: usuarios },
    { data: aspectosCfg },
    { data: aspectosData },
    { data: observacionesData },
  ] = await Promise.all([
    supabase.from('au_obradores').select('id, nombre').range(0, 9999),
    supabase.from('au_usuarios').select('cut, nombre').range(0, 9999),
    supabase.from('au_config_obrador_aspectos').select('*').range(0, 9999),
    supabase.from('au_auditoria_obrador_aspectos').select('*').in('auditoria_id', ids).range(0, 9999),
    supabase.from('au_auditoria_obrador_observaciones').select('*').in('auditoria_id', ids).range(0, 9999),
  ])

  const obradoresMap = new Map<string, string>((obradores ?? []).map((o: { id: string; nombre: string }) => [o.id, o.nombre]))
  const usuariosMap  = new Map<string, string>((usuarios  ?? []).map((u: { cut: string; nombre: string }) => [u.cut, u.nombre]))
  const aspectoNombreMap = new Map<string, string>((aspectosCfg as AuConfigObradorAspecto[] ?? []).map(a => [a.id, a.nombre]))

  const aspByAud = groupBy((aspectosData      ?? []) as AuAuditoriaObradorAspecto[])
  const obsByAud = groupBy((observacionesData ?? []) as AuAuditoriaObradorObservacion[])

  const filas: (Cabecera & { Aspecto: string; Ítem: string; Valor: string; Detalle: string })[] = []

  for (const a of auditorias) {
    const cabecera: Cabecera = {
      Fecha:               fechaLabel(a.fecha_auditoria),
      Obrador:              obradoresMap.get(a.obrador_id) ?? '—',
      'Auditor (nombre)':   usuariosMap.get(a.auditor_cut) ?? a.auditor_cut,
      'Nota Final':         a.nota_final,
    }

    let huboFilas = false
    const push = (aspecto: string, item: string, valor: string, detalle: string) => {
      filas.push({ ...cabecera, Aspecto: aspecto, 'Ítem': item, 'Valor': valor, 'Detalle': detalle })
      huboFilas = true
    }

    for (const asp of (aspByAud.get(a.id) ?? [])) {
      const nombre = aspectoNombreMap.get(asp.aspecto_id) ?? '—'
      push(nombre, 'Respuesta', RESPUESTA_LABEL[asp.respuesta], asp.observacion ?? '')
    }

    for (const o of (obsByAud.get(a.id) ?? [])) {
      const nombre = o.aspecto_id ? (aspectoNombreMap.get(o.aspecto_id) ?? '—') : 'General'
      const sufijo = o.extrema_modo === 'PORCENTAJE' ? ' (reduce 50% de la nota)'
                   : o.extrema_modo === 'PESO'        ? ' (peso fijo)'
                   : ''
      push(nombre, 'Observación', SEV_LABEL[o.severidad] + sufijo, o.descripcion)
    }

    if (a.observaciones_generales) push('General', 'Observaciones generales', '', a.observaciones_generales)

    if (!huboFilas) filas.push({ ...cabecera, Aspecto: '', 'Ítem': '', 'Valor': '', 'Detalle': '' })
  }

  const ws = XLSX.utils.json_to_sheet(filas as unknown as Record<string, unknown>[])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Auditorías de Obrador')
  const fechaArchivo = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `auditorias_obrador_${fechaArchivo}.xlsx`)
}
