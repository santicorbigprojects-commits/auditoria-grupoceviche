import { supabase } from './supabase'
import type {
  AuAuditoria,
  AuAuditoriaProductoItem,
  AuAuditoriaServicio,
  AuAuditoriaLocal,
  AuObservacion,
  AuEvidencia,
  AuConfigSeveridad,
  AuConfigRI,
  Area,
  AspectoRI,
  Severidad,
} from '../types'
import {
  calcularNotaProducto,
  calcularNotaServicio,
  calcularNotaLocal,
  calcularDescuentoRevisionInternaPorAspecto,
  huboReduccion50PorExtrema,
  type ObservacionCalculo,
  type ObservacionRI,
  type ConfigRI,
  type ConfigSeveridad,
} from './calculo'

/* ══════════════════════════════════════════════════════════════════════════
   jsPDF + jspdf-autotable cargados desde CDN en tiempo de uso — no vía npm.
   (mismo patrón que exportarExcel.ts con SheetJS)
══════════════════════════════════════════════════════════════════════════ */

const JSPDF_CDN     = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'
const AUTOTABLE_CDN = 'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js'

interface AutoTableResult { finalY: number }

interface JsPDFInstance {
  internal: { pageSize: { getWidth(): number; getHeight(): number } }
  addPage(): JsPDFInstance
  setFont(font: string, style?: string): JsPDFInstance
  setFontSize(size: number): JsPDFInstance
  setTextColor(r: number, g: number, b: number): JsPDFInstance
  setFillColor(r: number, g: number, b: number): JsPDFInstance
  setDrawColor(r: number, g: number, b: number): JsPDFInstance
  text(text: string | string[], x: number, y: number): JsPDFInstance
  rect(x: number, y: number, w: number, h: number, style?: string): JsPDFInstance
  roundedRect(x: number, y: number, w: number, h: number, rx: number, ry: number, style?: string): JsPDFInstance
  addImage(data: string, format: string, x: number, y: number, w: number, h: number): JsPDFInstance
  splitTextToSize(text: string, width: number): string[]
  textWithLink(text: string, x: number, y: number, opts: { url: string }): JsPDFInstance
  save(filename: string): void
  lastAutoTable?: AutoTableResult
  autoTable(options: Record<string, unknown>): void
}

interface JsPDFCtor {
  new (opts: { unit: string; format: string }): JsPDFInstance
}

let libsPromise: Promise<JsPDFCtor> | null = null

function cargarScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`No se pudo cargar ${src}`))
    document.head.appendChild(script)
  })
}

function cargarJsPDF(): Promise<JsPDFCtor> {
  const w = window as unknown as { jspdf?: { jsPDF: JsPDFCtor } }
  if (w.jspdf?.jsPDF) return Promise.resolve(w.jspdf.jsPDF)
  if (libsPromise) return libsPromise

  libsPromise = (async () => {
    await cargarScript(JSPDF_CDN)
    await cargarScript(AUTOTABLE_CDN)
    const ww = window as unknown as { jspdf?: { jsPDF: JsPDFCtor } }
    if (!ww.jspdf?.jsPDF) throw new Error('jsPDF no se cargó correctamente.')
    return ww.jspdf.jsPDF
  })()
  return libsPromise
}

/* ══════════════════════════════════════════════════════════════════════════
   Paleta y textos (mismos nombres que el frontend)
══════════════════════════════════════════════════════════════════════════ */

const NARANJA: [number, number, number]   = [238, 81, 40]
const TERRANOVA: [number, number, number] = [213, 55, 42]
const NAVY: [number, number, number]      = [18, 22, 33]
const AMBAR: [number, number, number]     = [255, 148, 69]
const MARRON: [number, number, number]    = [78, 16, 21]
const GRIS: [number, number, number]      = [150, 150, 150]
const VERDE: [number, number, number]     = [22, 163, 74]

const AREA_MAX = 20 / 3

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

const FIDELIZACION_LABEL: Record<string, string> = {
  fid_speech:          'Speech de bienvenida',
  fid_nombre_camarero: 'Nombre del camarero',
  fid_tarjeta:         'Comunicó sobre la tarjeta de fidelización',
}
const UPSELLING_LABEL: Record<string, string> = {
  ups_bebidas:  'Oferta de bebidas',
  ups_meta_dia: 'Comunicó meta del día',
}
const PRESENTACION_LABEL: Record<string, string> = {
  pres_uniformes:          'Uniformes',
  pres_cabellos:           'Cabellos recogidos',
  pres_unas:               'Uñas cuidadas',
  pres_zapatos:            'Zapatos adecuados',
  pres_barba_o_maquillaje: 'Barba / Maquillaje',
}

const ASPECTO_TITULO: Record<AspectoRI, string> = {
  RI_REVISION:   'Revisión de productos',
  RI_ROTULACION: 'Rotulación de productos',
  RI_HIGIENE:    'Higiene de cocina',
}

const CONFIG_SEV_DEFAULT: ConfigSeveridad = {
  NINGUNA: 0, LEVE: 0.25, MEDIA: 0.50, GRAVE: 1.00, EXTREMA: 2.00,
}
const CONFIG_RI_DEFAULT: ConfigRI = { RI_REVISION: 2, RI_ROTULACION: 2, RI_HIGIENE: 3 }

type TimeKey = 'entrante' | 'principal' | 'bebida' | 'postre' | 'sandwich' | 'jugos'
const TIEMPOS_DEFAULT: Record<TimeKey, number> = {
  entrante: 10, principal: 20, bebida: 5, postre: 10, sandwich: 10, jugos: 5,
}
const TIEMPO_LABEL: Record<TimeKey, string> = {
  entrante: 'Entrante', principal: 'Plato principal', bebida: 'Bebida', postre: 'Postre',
  sandwich: 'Sándwich', jugos: 'Jugos',
}

function esAreaPrincipal(area: Area | AspectoRI): area is Area {
  return area === 'PRODUCTO' || area === 'SERVICIO' || area === 'LOCAL'
}

function siNo(v: boolean | null | undefined): string {
  return v ? 'Sí' : 'No'
}

function fechaLabelLarga(fecha: string): string {
  try {
    return new Date(fecha + 'T12:00:00').toLocaleDateString('es-ES', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })
  } catch { return fecha }
}

function colorNota(v: number, max: number): [number, number, number] {
  const pct = max > 0 ? v / max : 0
  if (pct >= 0.8) return VERDE
  if (pct >= 0.6) return AMBAR
  return TERRANOVA
}

function sanitizeFilePart(s: string): string {
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/* ══════════════════════════════════════════════════════════════════════════
   Carga de imágenes (fetch → dataURL) antes de incrustar
══════════════════════════════════════════════════════════════════════════ */

interface ImagenCargada { dataUrl: string; width: number; height: number }

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'))
    reader.readAsDataURL(blob)
  })
}

async function cargarImagen(url: string): Promise<ImagenCargada | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    const [dataUrl, bitmap] = await Promise.all([blobToDataURL(blob), createImageBitmap(blob)])
    return { dataUrl, width: bitmap.width, height: bitmap.height }
  } catch {
    return null
  }
}

function mimeToFormat(dataUrl: string): string {
  const m = /^data:image\/(\w+);/.exec(dataUrl)
  const ext = (m?.[1] ?? 'jpeg').toLowerCase()
  if (ext === 'png') return 'PNG'
  if (ext === 'webp') return 'WEBP'
  return 'JPEG'
}

interface EvidConData extends AuEvidencia {
  data: ImagenCargada | null
}

/* ══════════════════════════════════════════════════════════════════════════
   Helpers de maquetación
══════════════════════════════════════════════════════════════════════════ */

const MARGIN = 15
const CONTENT_W = 180

interface Cursor { y: number }

function ensureSpace(doc: JsPDFInstance, cursor: Cursor, needed: number) {
  const pageH = doc.internal.pageSize.getHeight()
  if (cursor.y + needed > pageH - MARGIN) {
    doc.addPage()
    cursor.y = MARGIN
  }
}

function sectionHeader(doc: JsPDFInstance, cursor: Cursor, titulo: string, color: [number, number, number]) {
  ensureSpace(doc, cursor, 14)
  doc.setFillColor(...color)
  doc.rect(MARGIN, cursor.y, CONTENT_W, 8, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(titulo.toUpperCase(), MARGIN + 3, cursor.y + 5.5)
  cursor.y += 12
  doc.setTextColor(...NAVY)
  doc.setFont('helvetica', 'normal')
}

function subTitulo(doc: JsPDFInstance, cursor: Cursor, texto: string) {
  ensureSpace(doc, cursor, 8)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...NAVY)
  doc.text(texto.toUpperCase(), MARGIN, cursor.y)
  cursor.y += 5
  doc.setFont('helvetica', 'normal')
}

function textoVacio(doc: JsPDFInstance, cursor: Cursor, texto: string) {
  ensureSpace(doc, cursor, 8)
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(9)
  doc.setTextColor(...GRIS)
  doc.text(texto, MARGIN, cursor.y)
  cursor.y += 8
  doc.setFont('helvetica', 'normal')
}

function tabla(doc: JsPDFInstance, cursor: Cursor, head: string[][], body: string[][], color: [number, number, number], columnStyles?: Record<number, Record<string, unknown>>) {
  if (body.length === 0) return
  doc.autoTable({
    startY: cursor.y,
    margin: { left: MARGIN, right: MARGIN },
    head,
    body,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2, textColor: NAVY, lineColor: [225, 225, 225], lineWidth: 0.1 },
    headStyles: { fillColor: color, textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    columnStyles: columnStyles ?? {},
  })
  cursor.y = (doc.lastAutoTable?.finalY ?? cursor.y) + 6
}

function comentarioBlock(doc: JsPDFInstance, cursor: Cursor, texto: string | null | undefined) {
  if (!texto) return
  subTitulo(doc, cursor, 'Comentarios')
  doc.setFontSize(9)
  doc.setTextColor(...NAVY)
  const lines = doc.splitTextToSize(texto, CONTENT_W)
  ensureSpace(doc, cursor, lines.length * 4.2 + 4)
  doc.text(lines, MARGIN, cursor.y)
  cursor.y += lines.length * 4.2 + 6
}

function evidenciasGrid(doc: JsPDFInstance, cursor: Cursor, evids: EvidConData[]) {
  if (evids.length === 0) return
  subTitulo(doc, cursor, `Evidencias (${evids.length})`)

  const COLS = 3
  const GAP = 4
  const boxW = (CONTENT_W - GAP * (COLS - 1)) / COLS
  const boxH = 42

  for (let i = 0; i < evids.length; i += COLS) {
    const fila = evids.slice(i, i + COLS)
    ensureSpace(doc, cursor, boxH + 8)
    fila.forEach((ev, idx) => {
      const x = MARGIN + idx * (boxW + GAP)
      const y = cursor.y
      doc.setDrawColor(210, 210, 210)
      doc.rect(x, y, boxW, boxH)

      let dibujado = false
      if (ev.data) {
        try {
          const scale = Math.min(boxW / ev.data.width, boxH / ev.data.height)
          const w = ev.data.width * scale
          const h = ev.data.height * scale
          const ix = x + (boxW - w) / 2
          const iy = y + (boxH - h) / 2
          doc.addImage(ev.data.dataUrl, mimeToFormat(ev.data.dataUrl), ix, iy, w, h)
          dibujado = true
        } catch {
          dibujado = false
        }
      }
      if (!dibujado) {
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(7)
        doc.setTextColor(...TERRANOVA)
        const msg = doc.splitTextToSize('Imagen no disponible', boxW - 4)
        doc.text(msg, x + 2, y + boxH / 2 - 4)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(6.5)
        doc.setTextColor(37, 99, 235)
        const linkLines = doc.splitTextToSize(ev.url, boxW - 4).slice(0, 2)
        doc.textWithLink(linkLines.join(' '), x + 2, y + boxH - 6, { url: ev.url })
      }

      if (ev.etiqueta) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)
        doc.setTextColor(...NAVY)
        const capt = doc.splitTextToSize(ev.etiqueta, boxW)
        doc.text(capt[0] ?? '', x, y + boxH + 4)
      }
    })
    cursor.y += boxH + 7
  }
  cursor.y += 2
}

/* ══════════════════════════════════════════════════════════════════════════
   Export principal
══════════════════════════════════════════════════════════════════════════ */

export async function exportarAuditoriaPDF(auditoria: AuAuditoria, localNombre: string): Promise<void> {
  const JsPDF = await cargarJsPDF()

  const aid = auditoria.id
  const lid = auditoria.local_id

  const [
    { data: itemsData },
    { data: servData },
    { data: locData },
    { data: obsData },
    { data: evidData },
    { data: sevData },
    { data: riData },
    { data: userData },
  ] = await Promise.all([
    supabase.from('au_auditoria_producto_items').select('*').eq('auditoria_id', aid).range(0, 9999),
    supabase.from('au_auditoria_servicio').select('*').eq('auditoria_id', aid).maybeSingle(),
    supabase.from('au_auditoria_local').select('*').eq('auditoria_id', aid).maybeSingle(),
    supabase.from('au_observaciones').select('*').eq('auditoria_id', aid).range(0, 9999),
    supabase.from('au_evidencias').select('*').eq('auditoria_id', aid).range(0, 9999),
    supabase.from('au_config_severidad').select('*'),
    supabase.from('au_config_ri').select('*'),
    supabase.from('au_usuarios').select('nombre').eq('cut', auditoria.auditor_cut).maybeSingle(),
  ])

  const items:      AuAuditoriaProductoItem[] = itemsData ?? []
  const servicio:   AuAuditoriaServicio | null = servData ?? null
  const localData:  AuAuditoriaLocal | null    = locData ?? null
  const obs:        AuObservacion[] = obsData ?? []
  const evidencias: AuEvidencia[]   = evidData ?? []
  const auditorNombre = (userData as { nombre: string } | null)?.nombre ?? auditoria.auditor_cut

  const configSev = { ...CONFIG_SEV_DEFAULT }
  if (sevData) {
    (sevData as AuConfigSeveridad[]).forEach(r => { configSev[r.severidad] = r.descuento })
  }
  const configRI = { ...CONFIG_RI_DEFAULT }
  if (riData) {
    (riData as AuConfigRI[]).forEach(r => { configRI[r.aspecto] = r.max_descuento })
  }

  // Tiempos máximos (default global + override por local)
  const { data: tiemposData } = await supabase
    .from('au_config_tiempos')
    .select('*')
    .or(`local_id.is.null,local_id.eq.${lid}`)
  const tiemposMax = { ...TIEMPOS_DEFAULT }
  const tipoMap: Record<string, TimeKey> = {
    ENTRANTE: 'entrante', PRINCIPAL: 'principal', BEBIDA: 'bebida', POSTRE: 'postre',
    SANDWICH: 'sandwich', JUGOS: 'jugos',
  }
  const tiemposRows: { local_id: string | null; tipo: string; max_min: number }[] = tiemposData ?? []
  tiemposRows.filter(r => r.local_id === null).forEach(r => { const k = tipoMap[r.tipo]; if (k) tiemposMax[k] = r.max_min })
  tiemposRows.filter(r => r.local_id === lid).forEach(r => { const k = tipoMap[r.tipo]; if (k) tiemposMax[k] = r.max_min })

  // Cargar todas las imágenes de evidencia en paralelo
  const evidConData: EvidConData[] = await Promise.all(
    evidencias.map(async ev => ({ ...ev, data: await cargarImagen(ev.url) }))
  )
  const evidByArea = (area: Area | 'REVISION_INTERNA') => evidConData.filter(e => e.area === area)
  const obsByArea = (area: Area | AspectoRI) => obs.filter(o => o.area === area)

  const obsPrincipalesCalc: ObservacionCalculo[] = obs
    .filter(o => esAreaPrincipal(o.area))
    .map(o => ({ area: o.area as Area, severidad: o.severidad, extrema_modo: o.extrema_modo }))
  const obsRICalc: ObservacionRI[] = obs
    .filter(o => !esAreaPrincipal(o.area))
    .map(o => ({ aspecto: o.area as AspectoRI, severidad: o.severidad }))

  const descuentoRIPorAspecto = calcularDescuentoRevisionInternaPorAspecto(obsRICalc, configRI, configSev)

  /* ── Documento ─────────────────────────────────────────────────────── */
  const doc = new JsPDF({ unit: 'mm', format: 'a4' })
  const cursor: Cursor = { y: 0 }

  drawCabecera(doc, cursor, auditoria, localNombre, auditorNombre)

  // ── PRODUCTO ─────────────────────────────────────────────────────────
  sectionHeader(doc, cursor, 'Producto', NARANJA)
  drawProducto(doc, cursor, items)
  tabla(
    doc, cursor,
    [['Severidad', 'Observación']],
    obsByArea('PRODUCTO').map(o => [SEV_LABEL[o.severidad], o.texto]),
    NARANJA,
    { 0: { cellWidth: 40 } },
  )
  comentarioBlock(doc, cursor, auditoria.oportunidad_producto)
  evidenciasGrid(doc, cursor, evidByArea('PRODUCTO'))

  // ── SERVICIO ─────────────────────────────────────────────────────────
  sectionHeader(doc, cursor, 'Servicio', AMBAR)
  if (servicio) {
    tabla(
      doc, cursor,
      [['Grupo', 'Ítem', 'Cumple']],
      [
        ...Object.entries(FIDELIZACION_LABEL).map(([k, l]) => ['Fidelización', l, siNo((servicio as unknown as Record<string, boolean | null>)[k])]),
        ...Object.entries(UPSELLING_LABEL).map(([k, l]) => ['Upselling', l, siNo((servicio as unknown as Record<string, boolean | null>)[k])]),
        ...Object.entries(PRESENTACION_LABEL).map(([k, l]) => ['Presentación', l, siNo((servicio as unknown as Record<string, boolean | null>)[k])]),
      ],
      AMBAR,
      { 2: { cellWidth: 22, halign: 'center' } },
    )
    const servRec = servicio as unknown as Record<string, unknown>
    if (servRec['tiempos_base_activo'] === false) {
      textoVacio(doc, cursor, 'Tiempos de atención no evaluados en esta auditoría.')
    } else {
      const tiempoRows: string[][] = (['entrante', 'principal', 'bebida', 'postre'] as TimeKey[]).map(k => {
        const real = (servicio as unknown as Record<string, number | null>)[`tiempo_${k}_min`]
        const ok   = (servicio as unknown as Record<string, boolean | null>)[`tiempo_${k}_ok`]
        return [TIEMPO_LABEL[k], real != null ? `${real} min` : '-', `${tiemposMax[k]} min`, siNo(ok)]
      })
      tabla(doc, cursor, [['Tiempo', 'Real', 'Máximo', 'Cumple']], tiempoRows, AMBAR, { 3: { cellWidth: 22, halign: 'center' } })
    }

    const cholitoKeys = (['sandwich', 'jugos'] as TimeKey[]).filter(k => servRec[`tiempo_${k}_activo`] === true)
    if (cholitoKeys.length > 0) {
      subTitulo(doc, cursor, 'Tiempos adicionales — Cholito')
      const tiempoCholitoRows: string[][] = cholitoKeys.map(k => {
        const real = (servicio as unknown as Record<string, number | null>)[`tiempo_${k}_min`]
        const ok   = (servicio as unknown as Record<string, boolean | null>)[`tiempo_${k}_ok`]
        return [TIEMPO_LABEL[k], real != null ? `${real} min` : '-', `${tiemposMax[k]} min`, siNo(ok)]
      })
      tabla(doc, cursor, [['Tiempo', 'Real', 'Máximo', 'Cumple']], tiempoCholitoRows, AMBAR, { 3: { cellWidth: 22, halign: 'center' } })
    }
  } else {
    textoVacio(doc, cursor, 'Sin datos de servicio.')
  }
  tabla(
    doc, cursor,
    [['Severidad', 'Observación']],
    obsByArea('SERVICIO').map(o => [SEV_LABEL[o.severidad], o.texto]),
    AMBAR,
    { 0: { cellWidth: 40 } },
  )
  comentarioBlock(doc, cursor, auditoria.oportunidad_servicio)
  evidenciasGrid(doc, cursor, evidByArea('SERVICIO'))

  // ── LOCAL ────────────────────────────────────────────────────────────
  sectionHeader(doc, cursor, 'Local', NAVY)
  if (localData) {
    tabla(
      doc, cursor,
      [['Grupo', 'Ítem', 'Cumple']],
      (Object.entries(LOCAL_LABEL) as [keyof typeof LOCAL_LABEL, string][]).map(([k, l]) => [
        k === 'cart_actualizada' || k === 'cart_completa' ? 'Cartelería' : 'Limpieza',
        l,
        siNo(localData[k]),
      ]),
      NAVY,
      { 2: { cellWidth: 22, halign: 'center' } },
    )
  } else {
    textoVacio(doc, cursor, 'Sin datos de local.')
  }
  tabla(
    doc, cursor,
    [['Severidad', 'Observación']],
    obsByArea('LOCAL').map(o => [SEV_LABEL[o.severidad], o.texto]),
    NAVY,
    { 0: { cellWidth: 40 } },
  )
  comentarioBlock(doc, cursor, auditoria.oportunidad_local)
  evidenciasGrid(doc, cursor, evidByArea('LOCAL'))

  // ── REVISIÓN INTERNA ─────────────────────────────────────────────────
  sectionHeader(doc, cursor, 'Revisión interna', MARRON)
  const aspectosRI: { key: AspectoRI; conforme: boolean | null; comentario: string | null }[] = [
    { key: 'RI_REVISION',   conforme: auditoria.ri_revision_conforme,   comentario: auditoria.ri_revision_comentario },
    { key: 'RI_ROTULACION', conforme: auditoria.ri_rotulacion_conforme, comentario: auditoria.ri_rotulacion_comentario },
    { key: 'RI_HIGIENE',    conforme: auditoria.ri_higiene_conforme,    comentario: auditoria.ri_higiene_comentario },
  ]
  tabla(
    doc, cursor,
    [['Aspecto', 'Estado', 'Comentario']],
    aspectosRI.map(a => [
      ASPECTO_TITULO[a.key],
      a.conforme === null ? 'Sin evaluar' : a.conforme ? 'Conforme' : 'No conforme',
      a.comentario ?? '',
    ]),
    MARRON,
    { 1: { cellWidth: 26 } },
  )
  tabla(
    doc, cursor,
    [['Aspecto', 'Severidad', 'Observación']],
    aspectosRI.flatMap(a => obsByArea(a.key).map(o => [ASPECTO_TITULO[a.key], SEV_LABEL[o.severidad], o.texto])),
    MARRON,
    { 0: { cellWidth: 44 }, 1: { cellWidth: 30 } },
  )
  evidenciasGrid(doc, cursor, evidByArea('REVISION_INTERNA'))

  // ── DESGLOSE DEL CÁLCULO ─────────────────────────────────────────────
  sectionHeader(doc, cursor, 'Desglose del cálculo', NAVY)
  drawDesglose(doc, cursor, auditoria, items, servicio, localData, obs, obsPrincipalesCalc, configSev, descuentoRIPorAspecto)

  const filename = `auditoria_${sanitizeFilePart(localNombre)}_${auditoria.fecha}.pdf`
  doc.save(filename)
}

/* ══════════════════════════════════════════════════════════════════════════
   Sub-bloques de dibujo
══════════════════════════════════════════════════════════════════════════ */

function drawCabecera(doc: JsPDFInstance, cursor: Cursor, auditoria: AuAuditoria, localNombre: string, auditorNombre: string) {
  const pageW = doc.internal.pageSize.getWidth()
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, pageW, 30, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text('Auditoría · Grupo Ceviche', MARGIN, 12)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(localNombre, MARGIN, 19)
  doc.setFontSize(8.5)
  const meseroTxt = auditoria.mesero_nombre ? `   ·   Mesero: ${auditoria.mesero_nombre}` : ''
  doc.text(`${fechaLabelLarga(auditoria.fecha)}   ·   Auditor: ${auditorNombre}${meseroTxt}`, MARGIN, 25)

  cursor.y = 37

  const notas: { label: string; val: number | null; max: number; big?: boolean }[] = [
    { label: 'Producto', val: auditoria.nota_producto, max: AREA_MAX },
    { label: 'Servicio', val: auditoria.nota_servicio, max: AREA_MAX },
    { label: 'Local',    val: auditoria.nota_local,    max: AREA_MAX },
    { label: 'Total',    val: auditoria.nota_total,    max: 20, big: true },
  ]
  const cardW = (CONTENT_W - 3 * 4) / 4
  const cardH = 22
  notas.forEach((n, i) => {
    const x = MARGIN + i * (cardW + 4)
    const v = n.val ?? 0
    const color = n.big ? colorNota(v, n.max) : NAVY
    doc.setDrawColor(220, 220, 220)
    doc.setFillColor(248, 248, 248)
    doc.roundedRect(x, cursor.y, cardW, cardH, 2, 2, 'FD')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...NAVY)
    doc.text(n.label.toUpperCase(), x + 3, cursor.y + 6)
    doc.setFontSize(n.big ? 15 : 12)
    doc.setTextColor(...color)
    doc.text(v.toFixed(2), x + 3, cursor.y + 15.5)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...GRIS)
    doc.text(`/ ${n.max.toFixed(n.big ? 0 : 2)}`, x + 3, cursor.y + 20)
  })
  cursor.y += cardH + 8
  doc.setTextColor(...NAVY)
}

function drawProducto(doc: JsPDFInstance, cursor: Cursor, items: AuAuditoriaProductoItem[]) {
  if (items.length === 0) {
    textoVacio(doc, cursor, 'No se evaluaron platos en esta auditoría.')
    return
  }
  const rows: string[][] = []

  const sueltos = items.filter(i => !i.combo_nombre)
  const sueltoGroups = sueltos.reduce((acc, item) => {
    if (!acc[item.plato_id]) acc[item.plato_id] = { nombre: item.plato_nombre, rows: [] as AuAuditoriaProductoItem[] }
    acc[item.plato_id].rows.push(item)
    return acc
  }, {} as Record<string, { nombre: string; rows: AuAuditoriaProductoItem[] }>)
  Object.values(sueltoGroups).forEach(g => {
    g.rows.forEach(item => rows.push([g.nombre, item.ingrediente_nombre, siNo(item.contiene)]))
  })

  const comboItems = items.filter(i => i.combo_nombre)
  const comboMap = new Map<string, { slotNombre: string; platoNombre: string; rows: AuAuditoriaProductoItem[] }[]>()
  comboItems.forEach(item => {
    const cn = item.combo_nombre!
    if (!comboMap.has(cn)) comboMap.set(cn, [])
    const slots = comboMap.get(cn)!
    const key = item.slot_nombre ?? ''
    let slot = slots.find(s => s.slotNombre === key)
    if (!slot) {
      slot = { slotNombre: key, platoNombre: item.plato_nombre, rows: [] }
      slots.push(slot)
    }
    slot.rows.push(item)
  })
  comboMap.forEach((slots, comboNombre) => {
    slots.forEach(slot => {
      slot.rows.forEach(item => rows.push([`${comboNombre} · ${slot.slotNombre} · ${slot.platoNombre}`, item.ingrediente_nombre, siNo(item.contiene)]))
    })
  })

  tabla(doc, cursor, [['Plato / Combo', 'Ingrediente', 'Contiene']], rows, NARANJA, { 2: { cellWidth: 22, halign: 'center' } })
}

function drawDesglose(
  doc: JsPDFInstance,
  cursor: Cursor,
  auditoria: AuAuditoria,
  items: AuAuditoriaProductoItem[],
  servicio: AuAuditoriaServicio | null,
  localData: AuAuditoriaLocal | null,
  obsAll: AuObservacion[],
  obsPrincipalesCalc: ObservacionCalculo[],
  configSev: ConfigSeveridad,
  descuentoRIPorAspecto: { aspecto: AspectoRI; descuento: number }[],
) {
  // Base (nota sin descuentos) reutilizando las mismas funciones de calculo.ts, sin observaciones
  const baseProducto = calcularNotaProducto(items, [], configSev)
  const baseServicio = calcularNotaServicio(servicio ?? {}, [], configSev)
  const baseLocal    = calcularNotaLocal(localData ?? {}, [], configSev)

  function descuentoFijo(area: Area): number {
    return obsAll
      .filter(o => o.area === area)
      .reduce((sum, o) => {
        if (o.severidad === 'EXTREMA' && o.extrema_modo === 'PORCENTAJE') return sum
        return sum + (configSev[o.severidad] ?? 0)
      }, 0)
  }

  const areas: { label: string; base: number; final: number | null; area: Area }[] = [
    { label: 'Producto', base: baseProducto, final: auditoria.nota_producto, area: 'PRODUCTO' },
    { label: 'Servicio', base: baseServicio, final: auditoria.nota_servicio, area: 'SERVICIO' },
    { label: 'Local',    base: baseLocal,    final: auditoria.nota_local,    area: 'LOCAL' },
  ]

  doc.setFontSize(9)
  areas.forEach(a => {
    const reducido = huboReduccion50PorExtrema(obsPrincipalesCalc, a.area)
    const desc = descuentoFijo(a.area)
    ensureSpace(doc, cursor, 12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...NAVY)
    doc.text(a.label, MARGIN, cursor.y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...GRIS)
    doc.text(`Base: ${a.base.toFixed(2)}   ·   Descuento observaciones: -${desc.toFixed(2)}`, MARGIN + 28, cursor.y)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...NAVY)
    doc.text(`= ${(a.final ?? 0).toFixed(2)} / ${AREA_MAX.toFixed(2)}`, MARGIN + 145, cursor.y)
    cursor.y += 5
    if (reducido) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...MARRON)
      doc.text('Reducido 50% por observación extremadamente grave', MARGIN + 4, cursor.y)
      doc.setFontSize(9)
      cursor.y += 5
    }
    cursor.y += 2
  })

  const conDescuento = descuentoRIPorAspecto.filter(d => d.descuento > 0)
  if (conDescuento.length > 0) {
    cursor.y += 2
    tabla(
      doc, cursor,
      [['Aspecto (Revisión Interna)', 'Descuento aplicado (con tope)']],
      conDescuento.map(d => [ASPECTO_TITULO[d.aspecto], `-${d.descuento.toFixed(2)}`]),
      MARRON,
      { 1: { cellWidth: 55, halign: 'center' } },
    )
  }

  ensureSpace(doc, cursor, 20)
  cursor.y += 2
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...NAVY)
  const p = auditoria.nota_producto ?? 0
  const s = auditoria.nota_servicio ?? 0
  const l = auditoria.nota_local ?? 0
  const dri = auditoria.descuento_ri ?? 0
  doc.text('Total = Producto + Servicio + Local - Descuento Rev. Interna', MARGIN, cursor.y)
  cursor.y += 5
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...GRIS)
  doc.text(
    `= ${p.toFixed(2)} + ${s.toFixed(2)} + ${l.toFixed(2)} - ${dri.toFixed(2)}`,
    MARGIN, cursor.y,
  )
  cursor.y += 6
  const totalCrudo = p + s + l - dri
  if (totalCrudo < 0) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8)
    doc.setTextColor(...GRIS)
    doc.text('(el resultado se ajusta con piso en 0)', MARGIN, cursor.y)
    cursor.y += 6
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
  }
  const total = auditoria.nota_total ?? 0
  doc.setFontSize(13)
  doc.setTextColor(...colorNota(total, 20))
  doc.text(`Total final: ${total.toFixed(2)} / 20`, MARGIN, cursor.y + 2)
  cursor.y += 10
}
