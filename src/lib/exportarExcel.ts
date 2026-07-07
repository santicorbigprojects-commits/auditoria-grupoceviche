import { supabase } from './supabase'
import type {
  Rol,
  Severidad,
  AspectoRI,
  AuAuditoria,
  AuAuditoriaProductoItem,
  AuAuditoriaServicio,
  AuAuditoriaLocal,
  AuObservacion,
} from '../types'

/* ══════════════════════════════════════════════════════════════════════════
   SheetJS (xlsx) cargado desde el CDN oficial en tiempo de uso — no vía npm.
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

/* ══════════════════════════════════════════════════════════════════════════
   Textos frontend (mismos labels que la UI)
══════════════════════════════════════════════════════════════════════════ */

const SEV_LABEL: Record<Severidad, string> = {
  NINGUNA: 'Ninguna',
  LEVE:    'Leve',
  MEDIA:   'Media',
  GRAVE:   'Grave',
  EXTREMA: 'Extremadamente grave',
}

const LOCAL_LABEL: Record<keyof Omit<AuAuditoriaLocal, 'id' | 'auditoria_id'>, string> = {
  cart_actualizada: 'Carta actualizada',
  cart_completa:    'Carta en buen estado',
  limp_sala:        'Salón',
  limp_banos:       'Baños',
  limp_barras:      'Barra',
  limp_cocina:      'Cocina',
}

const SERVICIO_LABEL: Record<string, string> = {
  fid_speech:              'Speech de bienvenida',
  fid_nombre_camarero:     'Nombre del camarero',
  fid_tarjeta:             'Comunicó sobre la tarjeta de fidelización',
  ups_bebidas:             'Oferta de bebidas',
  ups_meta_dia:            'Comunicó meta del día',
  pres_uniformes:          'Uniformes',
  pres_cabellos:           'Cabellos recogidos',
  pres_unas:               'Uñas cuidadas',
  pres_zapatos:            'Zapatos adecuados',
  pres_barba_o_maquillaje: 'Barba / Maquillaje',
}

const TIEMPO_OK_LABEL: Record<string, string> = {
  tiempo_entrante_ok:  'Tiempo: Entrante',
  tiempo_principal_ok: 'Tiempo: Plato principal',
  tiempo_bebida_ok:    'Tiempo: Bebida',
  tiempo_postre_ok:    'Tiempo: Postre',
}

const TIEMPO_MIN_FIELD: Record<string, string> = {
  tiempo_entrante_ok:  'tiempo_entrante_min',
  tiempo_principal_ok: 'tiempo_principal_min',
  tiempo_bebida_ok:    'tiempo_bebida_min',
  tiempo_postre_ok:    'tiempo_postre_min',
}

const ASPECTO_TITULO: Record<AspectoRI, string> = {
  RI_REVISION:   'Revisión de productos',
  RI_ROTULACION: 'Rotulación de productos',
  RI_HIGIENE:    'Higiene de cocina',
}

function esAreaPrincipal(area: string): area is 'PRODUCTO' | 'SERVICIO' | 'LOCAL' {
  return area === 'PRODUCTO' || area === 'SERVICIO' || area === 'LOCAL'
}

function fechaLabel(fecha: string): string {
  try {
    return new Date(fecha + 'T12:00:00').toLocaleDateString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    })
  } catch { return fecha }
}

function siNo(v: boolean | null | undefined): string {
  return v ? 'Sí' : 'No'
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

/* ══════════════════════════════════════════════════════════════════════════
   Export principal
══════════════════════════════════════════════════════════════════════════ */

interface Cabecera {
  Fecha: string
  Local: string
  'Auditor (nombre)': string
  Mesero: string
  'Nota Producto': number | string
  'Nota Servicio': number | string
  'Nota Local': number | string
  'Descuento Rev.Interna': number | string
  'Nota Total': number | string
}

export async function exportarAuditoriasExcel(cut: string, rol: Rol): Promise<void> {
  const XLSX = await cargarXLSX()

  let auditoriasQuery = supabase
    .from('au_auditorias')
    .select('*')
    .order('fecha', { ascending: false })
    .range(0, 9999)
  if (rol !== 'ADMIN') auditoriasQuery = auditoriasQuery.eq('auditor_cut', cut)

  const { data: auditoriasData, error: eAud } = await auditoriasQuery
  if (eAud) throw eAud
  const auditorias = (auditoriasData ?? []) as AuAuditoria[]
  if (auditorias.length === 0) throw new Error('No hay auditorías para exportar.')

  const ids = auditorias.map(a => a.id)

  const [
    { data: locales },
    { data: usuarios },
    { data: prodItemsData },
    { data: serviciosData },
    { data: localesCheckData },
    { data: observacionesData },
  ] = await Promise.all([
    supabase.from('au_locales').select('id, nombre').range(0, 9999),
    supabase.from('au_usuarios').select('cut, nombre').range(0, 9999),
    supabase.from('au_auditoria_producto_items').select('*').in('auditoria_id', ids).range(0, 9999),
    supabase.from('au_auditoria_servicio').select('*').in('auditoria_id', ids).range(0, 9999),
    supabase.from('au_auditoria_local').select('*').in('auditoria_id', ids).range(0, 9999),
    supabase.from('au_observaciones').select('*').in('auditoria_id', ids).range(0, 9999),
  ])

  const localesMap  = new Map<string, string>((locales  ?? []).map((l: { id: string; nombre: string }) => [l.id, l.nombre]))
  const usuariosMap = new Map<string, string>((usuarios ?? []).map((u: { cut: string; nombre: string }) => [u.cut, u.nombre]))

  const prodByAud  = groupBy((prodItemsData        ?? []) as AuAuditoriaProductoItem[])
  const servByAud  = groupBy((serviciosData         ?? []) as AuAuditoriaServicio[])
  const localByAud = groupBy((localesCheckData      ?? []) as AuAuditoriaLocal[])
  const obsByAud   = groupBy((observacionesData     ?? []) as AuObservacion[])

  const filas: (Cabecera & { Sección: string; Ítem: string; Valor: string; Detalle: string })[] = []

  for (const a of auditorias) {
    const cabecera: Cabecera = {
      Fecha:                    fechaLabel(a.fecha),
      Local:                    localesMap.get(a.local_id) ?? '—',
      'Auditor (nombre)':       usuariosMap.get(a.auditor_cut) ?? a.auditor_cut,
      Mesero:                   a.mesero_nombre ?? '',
      'Nota Producto':          a.nota_producto ?? '',
      'Nota Servicio':          a.nota_servicio ?? '',
      'Nota Local':             a.nota_local    ?? '',
      'Descuento Rev.Interna':  a.descuento_ri  ?? '',
      'Nota Total':             a.nota_total    ?? '',
    }

    let huboFilas = false
    const push = (seccion: string, item: string, valor: string, detalle: string) => {
      filas.push({ ...cabecera, 'Sección': seccion, 'Ítem': item, 'Valor': valor, 'Detalle': detalle })
      huboFilas = true
    }

    // ── PRODUCTO ──────────────────────────────────────────────────────────
    for (const i of (prodByAud.get(a.id) ?? [])) {
      const valorPlato = i.combo_nombre
        ? `${i.plato_nombre} (${i.combo_nombre} · ${i.slot_nombre})`
        : i.plato_nombre
      push('PRODUCTO', i.ingrediente_nombre, valorPlato, siNo(i.contiene))
    }
    if (a.oportunidad_producto) push('PRODUCTO', 'Comentarios', '', a.oportunidad_producto)

    // ── SERVICIO ──────────────────────────────────────────────────────────
    const serv = (servByAud.get(a.id) ?? [])[0] as unknown as Record<string, unknown> | undefined
    if (serv) {
      for (const [campo, label] of Object.entries(SERVICIO_LABEL)) {
        push('SERVICIO', label, siNo(serv[campo] as boolean | null), '')
      }
      for (const [campo, label] of Object.entries(TIEMPO_OK_LABEL)) {
        const real = serv[TIEMPO_MIN_FIELD[campo]] as number | null
        push('SERVICIO', label, siNo(serv[campo] as boolean | null), real != null ? `${real} min` : '')
      }
    }
    if (a.oportunidad_servicio) push('SERVICIO', 'Comentarios', '', a.oportunidad_servicio)

    // ── LOCAL ─────────────────────────────────────────────────────────────
    const loc = (localByAud.get(a.id) ?? [])[0] as unknown as Record<string, unknown> | undefined
    if (loc) {
      for (const [campo, label] of Object.entries(LOCAL_LABEL)) {
        push('LOCAL', label, siNo(loc[campo] as boolean | null), '')
      }
    }
    if (a.oportunidad_local) push('LOCAL', 'Comentarios', '', a.oportunidad_local)

    // ── REVISIÓN INTERNA — conforme por aspecto ─────────────────────────
    const RI_CONFORME: [AspectoRI, boolean | null, string | null][] = [
      ['RI_REVISION',   a.ri_revision_conforme,   a.ri_revision_comentario],
      ['RI_ROTULACION', a.ri_rotulacion_conforme, a.ri_rotulacion_comentario],
      ['RI_HIGIENE',    a.ri_higiene_conforme,    a.ri_higiene_comentario],
    ]
    for (const [aspecto, conforme, comentario] of RI_CONFORME) {
      push('REVISIÓN INTERNA', `${ASPECTO_TITULO[aspecto]} — Conforme`, siNo(conforme), comentario ?? '')
    }

    // ── Observaciones (áreas 1-3 y aspectos de Revisión Interna) ─────────
    for (const o of (obsByAud.get(a.id) ?? [])) {
      const sevBase = SEV_LABEL[o.severidad]
      if (esAreaPrincipal(o.area)) {
        const sufijo = o.extrema_modo === 'PORCENTAJE' ? ' (reduce 50% del área)'
                     : o.extrema_modo === 'PESO'        ? ' (peso fijo)'
                     : ''
        push(o.area, 'Observación', sevBase + sufijo, o.texto ?? '')
      } else {
        const aspecto = o.area as AspectoRI
        push('REVISIÓN INTERNA', `${ASPECTO_TITULO[aspecto]} — Observación`, sevBase, o.texto ?? '')
      }
    }

    if (!huboFilas) filas.push({ ...cabecera, 'Sección': '', 'Ítem': '', 'Valor': '', 'Detalle': '' })
  }

  const ws = XLSX.utils.json_to_sheet(filas as unknown as Record<string, unknown>[])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Auditorías')
  const fechaArchivo = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `auditorias_${fechaArchivo}.xlsx`)
}
