import { supabase } from './supabase'
import type {
  AuAuditoriaObrador,
  AuAuditoriaObradorAspecto,
  AuAuditoriaObradorObservacion,
  AuAuditoriaObradorEvidencia,
  AuConfigObradorAspecto,
  Severidad,
} from '../types'
import {
  calcularDesgloseObrador,
  type ConfigSeveridadObrador,
  type RespuestaObradorCalculo,
  type ObservacionObradorCalculo,
} from './calculoObrador'

/* ══════════════════════════════════════════════════════════════════════════
   jsPDF + jspdf-autotable cargados desde CDN en tiempo de uso — no vía npm.
   (mismo patrón que exportarPDF.ts)
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
const GRIS: [number, number, number]      = [150, 150, 150]
const VERDE: [number, number, number]     = [22, 163, 74]
const AMBAR: [number, number, number]     = [255, 148, 69]
const MARRON: [number, number, number]    = [78, 16, 21]

const SEV_LABEL: Record<Severidad, string> = {
  NINGUNA: 'Ninguna',
  LEVE:    'Leve',
  MEDIA:   'Media',
  GRAVE:   'Grave',
  EXTREMA: 'Extremadamente grave',
}

const RESPUESTA_LABEL: Record<0 | 1 | 2, string> = { 0: 'No', 1: 'Masomenos', 2: 'Sí' }

const DEFAULT_CONFIG_SEV: ConfigSeveridadObrador = { NINGUNA: 0, LEVE: 0.5, MEDIA: 1, GRAVE: 2, EXTREMA: 4 }

function fechaLabelLarga(fecha: string): string {
  try {
    return new Date(fecha + 'T12:00:00').toLocaleDateString('es-ES', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })
  } catch { return fecha }
}

function colorNota(v: number): [number, number, number] {
  if (v >= 17) return VERDE
  if (v >= 13) return AMBAR
  return TERRANOVA
}

function sanitizeFilePart(s: string): string {
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/* ── Carga de imágenes (fetch → dataURL) antes de incrustar ────────────── */

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

interface EvidConData extends AuAuditoriaObradorEvidencia {
  data: ImagenCargada | null
}

/* ── Helpers de maquetación ──────────────────────────────────────────────── */

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

function comentarioBlock(doc: JsPDFInstance, cursor: Cursor, titulo: string, texto: string | null | undefined) {
  if (!texto) return
  subTitulo(doc, cursor, titulo)
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
    })
    cursor.y += boxH + 7
  }
  cursor.y += 2
}

/* ══════════════════════════════════════════════════════════════════════════
   Export principal
══════════════════════════════════════════════════════════════════════════ */

export async function exportarAuditoriaObradorPDF(auditoria: AuAuditoriaObrador, obradorNombre: string): Promise<void> {
  const JsPDF = await cargarJsPDF()

  const aid = auditoria.id

  const [
    { data: aspectosCfg },
    { data: aspectosData },
    { data: obsData },
    { data: evidData },
    { data: sevData },
    { data: userData },
  ] = await Promise.all([
    supabase.from('au_config_obrador_aspectos').select('*').order('orden'),
    supabase.from('au_auditoria_obrador_aspectos').select('*').eq('auditoria_id', aid).range(0, 9999),
    supabase.from('au_auditoria_obrador_observaciones').select('*').eq('auditoria_id', aid).range(0, 9999),
    supabase.from('au_auditoria_obrador_evidencias').select('*').eq('auditoria_id', aid).range(0, 9999),
    supabase.from('au_config_severidad_obrador').select('*'),
    supabase.from('au_usuarios').select('nombre').eq('cut', auditoria.auditor_cut).maybeSingle(),
  ])

  const aspectos:      AuConfigObradorAspecto[] = aspectosCfg ?? []
  const respuestas:    AuAuditoriaObradorAspecto[] = aspectosData ?? []
  const observaciones: AuAuditoriaObradorObservacion[] = obsData ?? []
  const evidencias:    AuAuditoriaObradorEvidencia[] = evidData ?? []
  const auditorNombre = (userData as { nombre: string } | null)?.nombre ?? auditoria.auditor_cut

  const configSev = { ...DEFAULT_CONFIG_SEV }
  if (sevData) (sevData as { severidad: Severidad; descuento: number }[]).forEach(r => { configSev[r.severidad] = r.descuento })

  const respuestasCalc: RespuestaObradorCalculo[] = respuestas.map(r => ({ aspecto_id: r.aspecto_id, respuesta: r.respuesta }))
  const obsCalc: ObservacionObradorCalculo[] = observaciones.map(o => ({ severidad: o.severidad, extrema_modo: o.extrema_modo }))
  const desglose = calcularDesgloseObrador(respuestasCalc, aspectos, obsCalc, configSev)

  const aspectoNombreMap = new Map(aspectos.map(a => [a.id, a.nombre]))
  const evidConData: EvidConData[] = await Promise.all(
    evidencias.map(async ev => ({ ...ev, data: await cargarImagen(ev.url) }))
  )

  /* ── Documento ─────────────────────────────────────────────────────── */
  const doc = new JsPDF({ unit: 'mm', format: 'a4' })
  const cursor: Cursor = { y: 0 }

  drawCabecera(doc, cursor, auditoria, obradorNombre, auditorNombre)

  // ── Aspectos (uno por uno, con su comentario/observaciones/evidencias) ──
  for (const aspecto of aspectos) {
    const resp = respuestas.find(r => r.aspecto_id === aspecto.id)
    sectionHeader(doc, cursor, `${aspecto.nombre} (${aspecto.puntos_maximo} pts)`, NARANJA)
    tabla(
      doc, cursor,
      [['Respuesta']],
      [[resp ? RESPUESTA_LABEL[resp.respuesta] : 'Sin responder']],
      NARANJA,
    )
    comentarioBlock(doc, cursor, 'Comentario', resp?.observacion)
    const obsAspecto = observaciones.filter(o => o.aspecto_id === aspecto.id)
    tabla(
      doc, cursor,
      [['Severidad', 'Observación']],
      obsAspecto.map(o => [SEV_LABEL[o.severidad], o.descripcion]),
      NARANJA,
      { 0: { cellWidth: 40 } },
    )
    evidenciasGrid(doc, cursor, evidConData.filter(e => e.aspecto_id === aspecto.id))
  }

  // ── Observaciones sin aspecto (defensivo) + generales ────────────────
  const obsSinAspecto = observaciones.filter(o => !o.aspecto_id)
  if (obsSinAspecto.length > 0) {
    sectionHeader(doc, cursor, 'Observaciones generales', NAVY)
    tabla(
      doc, cursor,
      [['Severidad', 'Observación']],
      obsSinAspecto.map(o => [SEV_LABEL[o.severidad], o.descripcion]),
      NAVY,
      { 0: { cellWidth: 40 } },
    )
  }
  if (auditoria.observaciones_generales) {
    sectionHeader(doc, cursor, 'Observaciones generales de la visita', NAVY)
    doc.setFontSize(9)
    doc.setTextColor(...NAVY)
    const lines = doc.splitTextToSize(auditoria.observaciones_generales, CONTENT_W)
    ensureSpace(doc, cursor, lines.length * 4.2 + 4)
    doc.text(lines, MARGIN, cursor.y)
    cursor.y += lines.length * 4.2 + 6
  }

  // ── DESGLOSE DEL CÁLCULO ─────────────────────────────────────────────
  sectionHeader(doc, cursor, 'Desglose del cálculo', NAVY)
  drawDesglose(doc, cursor, desglose, aspectoNombreMap)

  const filename = `auditoria_obrador_${sanitizeFilePart(obradorNombre)}_${auditoria.fecha_auditoria}.pdf`
  doc.save(filename)
}

/* ══════════════════════════════════════════════════════════════════════════
   Sub-bloques de dibujo
══════════════════════════════════════════════════════════════════════════ */

function drawCabecera(doc: JsPDFInstance, cursor: Cursor, auditoria: AuAuditoriaObrador, obradorNombre: string, auditorNombre: string) {
  const pageW = doc.internal.pageSize.getWidth()
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, pageW, 30, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text('Auditoría de Obrador · Grupo Ceviche', MARGIN, 12)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(obradorNombre, MARGIN, 19)
  doc.setFontSize(8.5)
  doc.text(`${fechaLabelLarga(auditoria.fecha_auditoria)}   ·   Auditor: ${auditorNombre}`, MARGIN, 25)

  cursor.y = 37

  const v = auditoria.nota_final ?? 0
  const color = colorNota(v)
  const cardW = 60
  const cardH = 24
  doc.setDrawColor(220, 220, 220)
  doc.setFillColor(248, 248, 248)
  doc.roundedRect(MARGIN, cursor.y, cardW, cardH, 2, 2, 'FD')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...NAVY)
  doc.text('NOTA FINAL', MARGIN + 4, cursor.y + 7)
  doc.setFontSize(17)
  doc.setTextColor(...color)
  doc.text(v.toFixed(2), MARGIN + 4, cursor.y + 17)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...GRIS)
  doc.text('/ 20', MARGIN + 26, cursor.y + 17)

  cursor.y += cardH + 8
  doc.setTextColor(...NAVY)
}

function drawDesglose(
  doc: JsPDFInstance,
  cursor: Cursor,
  desglose: ReturnType<typeof calcularDesgloseObrador>,
  aspectoNombreMap: Map<string, string>,
) {
  tabla(
    doc, cursor,
    [['Aspecto', 'Respuesta', 'Puntos', 'Máximo']],
    desglose.detalleAspectos.map(d => [aspectoNombreMap.get(d.aspecto_id) ?? d.nombre, d.respuesta, d.puntos.toFixed(1), String(d.maximo)]),
    NAVY,
    { 2: { cellWidth: 22, halign: 'center' }, 3: { cellWidth: 22, halign: 'center' } },
  )

  ensureSpace(doc, cursor, 24)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...NAVY)
  doc.text('Nota base', MARGIN, cursor.y)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...GRIS)
  doc.text(`${desglose.notaBase.toFixed(2)} / 20   ·   Descuento observaciones: -${desglose.descuentoFijo.toFixed(2)}`, MARGIN + 28, cursor.y)
  cursor.y += 6

  if (desglose.reducidoAl50) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...MARRON)
    doc.text('Reducido 50% por observación extremadamente grave', MARGIN, cursor.y)
    doc.setFontSize(9)
    cursor.y += 6
  }

  ensureSpace(doc, cursor, 14)
  cursor.y += 2
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...colorNota(desglose.notaFinal))
  doc.text(`Nota final: ${desglose.notaFinal.toFixed(2)} / 20`, MARGIN, cursor.y + 2)
  cursor.y += 10
}
