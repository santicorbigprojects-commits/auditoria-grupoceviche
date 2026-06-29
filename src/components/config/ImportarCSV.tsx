import { useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import type { AuLocal, AuMarca } from '../../types'

/* ══════════════════════════════════════════════════════════════════════════
   CSV de ejemplo descargable
══════════════════════════════════════════════════════════════════════════ */

const EJEMPLO_CSV = [
  'LOCAL;NOMBRE_PLATO;CODIGO;INGREDIENTE',
  'Rikos Centro;Ceviche clásico;R001;Limón',
  'Rikos Centro;Ceviche clásico;R001;Cebolla morada',
  'Rikos Centro;Ceviche clásico;R001;Ají amarillo',
  'Rikos Centro;Ceviche clásico;R001;Culantro',
  'RIKOS;Leche de tigre;R002;Limón',
  'RIKOS;Leche de tigre;R002;Ají limo',
  'RIKOS;Leche de tigre;R002;Cebolla china',
  'CHOLITO;Anticucho de corazón;C001;Corazón de res',
  'CHOLITO;Anticucho de corazón;C001;Ají panca',
  'CHOLITO;Anticucho de corazón;C001;Comino',
].join('\n')

function descargarEjemplo() {
  const blob = new Blob(['﻿' + EJEMPLO_CSV], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = 'ejemplo_platos.csv'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/* ══════════════════════════════════════════════════════════════════════════
   Parsing CSV
══════════════════════════════════════════════════════════════════════════ */

function detectarSep(linea: string): string {
  const nSemis  = (linea.match(/;/g) ?? []).length
  const nComas  = (linea.match(/,/g) ?? []).length
  return nSemis >= nComas ? ';' : ','
}

function parsearLinea(linea: string, sep: string): string[] {
  const result: string[] = []
  let current  = ''
  let inQuotes = false
  for (let i = 0; i < linea.length; i++) {
    const ch = linea[i]
    if (ch === '"') {
      if (inQuotes && linea[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === sep && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

/* ══════════════════════════════════════════════════════════════════════════
   Tipos del plan de importación
══════════════════════════════════════════════════════════════════════════ */

interface PlanEntry {
  nombre:        string
  codigo:        string
  ings:          string[]   // en orden de aparición
  resolvedIds:   string[]   // IDs de locales resueltos
  resolvedNames: string[]   // nombres (para preview)
  unknowns:      string[]   // valores LOCAL no encontrados
}

interface ParseResult {
  plan:  PlanEntry[]
  error: string | null
}

/* ══════════════════════════════════════════════════════════════════════════
   parsearYPlanificar
══════════════════════════════════════════════════════════════════════════ */

function resolverLocal(valor: string, locales: AuLocal[], marcas: AuMarca[]): AuLocal[] {
  const q = valor.trim().toLowerCase()
  // 1. Coincidencia con nombre de marca (case-insensitive)
  const marca = marcas.find(m => m.nombre.toLowerCase() === q)
  if (marca) return locales.filter(l => l.marca_id === marca.id)
  // 2. Coincidencia con nombre de local (case-insensitive)
  const local = locales.find(l => l.nombre.toLowerCase() === q)
  if (local) return [local]
  return []
}

function parsearYPlanificar(
  texto:   string,
  locales: AuLocal[],
  marcas:  AuMarca[],
): ParseResult {
  if (texto.startsWith('﻿')) texto = texto.slice(1)  // strip BOM

  const lineas = texto
    .split(/\r?\n/)
    .filter(l => l.trim() && !l.trim().startsWith('#'))

  if (lineas.length < 2) {
    return { plan: [], error: 'El archivo está vacío o solo contiene el encabezado.' }
  }

  const sep    = detectarSep(lineas[0])
  const header = parsearLinea(lineas[0], sep).map(h => h.trim().toUpperCase().replace(/\s+/g, '_'))

  // Localizar columnas de forma flexible
  const ci = (...tokens: string[]) =>
    header.findIndex(h => tokens.some(t => h.includes(t)))

  const colLocal  = ci('LOCAL')
  const colNombre = ci('NOMBRE_PLATO', 'NOMBRE', 'PLATO')
  const colCodigo = ci('CODIGO', 'COD')
  const colIng    = ci('INGREDIENTE', 'ING')

  if (colLocal === -1 || colNombre === -1 || colIng === -1) {
    return {
      plan:  [],
      error: 'Encabezado inválido. Se esperan columnas: LOCAL, NOMBRE_PLATO, CODIGO, INGREDIENTE.',
    }
  }

  // Agrupar por plato (nombre)
  const byPlato = new Map<string, {
    nombre:      string
    codigo:      string
    ings:        string[]
    localValues: string[]
  }>()

  for (const linea of lineas.slice(1)) {
    const cols   = parsearLinea(linea, sep)
    const local  = (cols[colLocal]  ?? '').trim()
    const nombre = (cols[colNombre] ?? '').trim()
    const codigo = colCodigo !== -1 ? (cols[colCodigo] ?? '').trim() : ''
    const ing    = (cols[colIng]    ?? '').trim()

    if (!local || !nombre) continue

    const key = nombre.toLowerCase()
    let entry = byPlato.get(key)
    if (!entry) {
      entry = { nombre, codigo, ings: [], localValues: [] }
      byPlato.set(key, entry)
    }

    if (ing && !entry.ings.includes(ing))         entry.ings.push(ing)
    if (local && !entry.localValues.includes(local)) entry.localValues.push(local)
  }

  if (byPlato.size === 0) {
    return { plan: [], error: 'No se encontraron filas válidas en el archivo.' }
  }

  // Resolver locales
  const plan: PlanEntry[] = []
  for (const [, entry] of byPlato) {
    const resolvedIds:   string[] = []
    const resolvedNames: string[] = []
    const unknowns:      string[] = []

    for (const lv of entry.localValues) {
      const found = resolverLocal(lv, locales, marcas)
      if (found.length === 0) {
        unknowns.push(lv)
      } else {
        for (const l of found) {
          if (!resolvedIds.includes(l.id)) {
            resolvedIds.push(l.id)
            resolvedNames.push(l.nombre)
          }
        }
      }
    }

    plan.push({ nombre: entry.nombre, codigo: entry.codigo, ings: entry.ings, resolvedIds, resolvedNames, unknowns })
  }

  return { plan, error: null }
}

/* ══════════════════════════════════════════════════════════════════════════
   Ejecutar importación
══════════════════════════════════════════════════════════════════════════ */

interface Resultado {
  importados:    number
  actualizados:  number
  unknownLocals: string[]
  errores:       string[]
}

async function ejecutarImport(plan: PlanEntry[]): Promise<Resultado> {
  let importados  = 0
  let actualizados = 0
  const unknownSet = new Set<string>()
  const errores: string[] = []

  // Pre-fetch platos existentes para comparación por nombre
  const { data: platosExist } = await supabase
    .from('au_platos').select('id, nombre, codigo')
  const platoMap = new Map(
    (platosExist ?? []).map(p => [
      p.nombre.toLowerCase().trim(),
      p as { id: string; nombre: string; codigo: string | null },
    ])
  )

  for (const entry of plan) {
    entry.unknowns.forEach(u => unknownSet.add(u))
    if (entry.resolvedIds.length === 0) continue

    try {
      const key     = entry.nombre.toLowerCase().trim()
      const existing = platoMap.get(key)
      let platoId: string

      if (existing) {
        platoId = existing.id
        // Actualizar código si cambió
        if (entry.codigo !== (existing.codigo ?? '')) {
          await supabase.from('au_platos')
            .update({ codigo: entry.codigo || null })
            .eq('id', platoId)
        }
        actualizados++
      } else {
        const { data: nuevo, error: eNew } = await supabase
          .from('au_platos')
          .insert({ nombre: entry.nombre, codigo: entry.codigo || null, activo: true })
          .select('id').single()
        if (eNew || !nuevo) throw eNew ?? new Error('Error al crear plato')
        platoId = nuevo.id
        platoMap.set(key, { id: platoId, nombre: entry.nombre, codigo: entry.codigo || null })
        importados++
      }

      // Reemplazar ingredientes (delete + insert)
      await supabase.from('au_plato_ingredientes').delete().eq('plato_id', platoId)
      if (entry.ings.length > 0) {
        const { error: eIngs } = await supabase.from('au_plato_ingredientes').insert(
          entry.ings.map((nombre, orden) => ({ plato_id: platoId, nombre, orden, activo: true }))
        )
        if (eIngs) throw eIngs
      }

      // Agregar locales (solo los que no existen)
      const { data: linksActuales } = await supabase
        .from('au_plato_locales').select('local_id').eq('plato_id', platoId)
      const linksSet   = new Set((linksActuales ?? []).map(l => l.local_id))
      const nuevosLinks = entry.resolvedIds.filter(id => !linksSet.has(id))
      if (nuevosLinks.length > 0) {
        const { error: eLinks } = await supabase.from('au_plato_locales').insert(
          nuevosLinks.map(local_id => ({ plato_id: platoId, local_id }))
        )
        if (eLinks) throw eLinks
      }

    } catch (err) {
      errores.push(`"${entry.nombre}": ${err instanceof Error ? err.message : 'error desconocido'}`)
    }
  }

  return {
    importados,
    actualizados,
    unknownLocals: [...unknownSet],
    errores,
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Componente principal
══════════════════════════════════════════════════════════════════════════ */

interface Props {
  open:        boolean
  onClose:     () => void
  onImportado: () => void
  locales:     AuLocal[]
  marcas:      AuMarca[]
}

type Fase = 'upload' | 'preview' | 'importando' | 'hecho'

export default function ImportarCSV({ open, onClose, onImportado, locales, marcas }: Props) {
  const [fase,       setFase]       = useState<Fase>('upload')
  const [plan,       setPlan]       = useState<PlanEntry[]>([])
  const [resultado,  setResultado]  = useState<Resultado | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function resetear() {
    setFase('upload'); setPlan([]); setResultado(null); setParseError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  function handleClose() { onClose(); resetear() }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setParseError(null)
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      const pr   = parsearYPlanificar(text, locales, marcas)
      if (pr.error) {
        setParseError(pr.error)
        if (inputRef.current) inputRef.current.value = ''
      } else {
        setPlan(pr.plan)
        setFase('preview')
      }
    }
    reader.readAsText(file, 'UTF-8')
  }

  async function handleEjecutar() {
    setFase('importando')
    try {
      const res = await ejecutarImport(plan)
      setResultado(res)
      if (res.importados > 0 || res.actualizados > 0) onImportado()
    } catch (err) {
      setResultado({
        importados: 0, actualizados: 0, unknownLocals: [],
        errores: [err instanceof Error ? err.message : 'Error inesperado'],
      })
    }
    setFase('hecho')
  }

  if (!open) return null

  const platosConLocales = plan.filter(e => e.resolvedIds.length > 0)
  const unknownsTotales  = [...new Set(plan.flatMap(e => e.unknowns))]

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 overflow-y-auto"
      onClick={e => { if (e.target === e.currentTarget) handleClose() }}
    >
      <div className="min-h-full flex items-start justify-center p-4 sm:py-8">
        <div
          className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          {/* ── Header ─────────────────────────────────────────────── */}
          <div className="px-6 pt-5 pb-4 border-b border-navy/10 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-navy" style={{ fontFamily: 'Poppins, sans-serif' }}>
                Importar platos (CSV)
              </h2>
              <p className="text-xs text-navy/40 mt-0.5">
                {fase === 'upload'     && 'Carga un CSV para agregar o actualizar platos en masa'}
                {fase === 'preview'    && `${platosConLocales.length} plato${platosConLocales.length !== 1 ? 's' : ''} listos para importar`}
                {fase === 'importando' && 'Procesando…'}
                {fase === 'hecho'      && 'Importación completada'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="flex-shrink-0 w-8 h-8 rounded-full bg-navy/10 text-navy/50
                         hover:bg-navy/20 hover:text-navy transition flex items-center justify-center text-sm"
            >
              ✕
            </button>
          </div>

          <div className="p-6">

            {/* ── FASE: UPLOAD ──────────────────────────────────────── */}
            {fase === 'upload' && (
              <div className="space-y-5">
                {/* Descripción del formato */}
                <div className="rounded-xl bg-navy/[0.04] p-4 space-y-3">
                  <p className="text-xs font-bold text-navy/50 uppercase tracking-wide">Formato esperado</p>
                  <pre className="text-[11px] font-mono bg-white rounded-lg px-3 py-2 border border-navy/10
                                  text-navy/70 overflow-x-auto leading-relaxed">
{`LOCAL;NOMBRE_PLATO;CODIGO;INGREDIENTE
Rikos Centro;Ceviche clásico;R001;Limón
Rikos Centro;Ceviche clásico;R001;Cebolla morada
RIKOS;Leche de tigre;R002;Limón
CHOLITO;Anticucho;C001;Corazón de res`}
                  </pre>
                  <ul className="text-xs text-navy/55 space-y-1 list-disc list-inside leading-relaxed">
                    <li>Separador: <code className="bg-navy/8 px-0.5 rounded">,</code> o <code className="bg-navy/8 px-0.5 rounded">;</code> — se detecta automáticamente</li>
                    <li>Cada ingrediente ocupa una fila; el orden define el orden de evaluación</li>
                    <li><strong>LOCAL</strong> acepta nombre exacto de un local <em>o</em> nombre de marca (ej. <code className="bg-navy/8 px-0.5 rounded">RIKOS</code>, <code className="bg-navy/8 px-0.5 rounded">CHOLITO</code>) para asignarlo a todos sus locales</li>
                    <li>Plato ya existente → ingredientes reemplazados; locales nuevos se agregan sin borrar los anteriores</li>
                    <li>Codificación UTF-8 (con o sin BOM); accents admitidos</li>
                  </ul>
                  <button
                    type="button"
                    onClick={descargarEjemplo}
                    className="flex items-center gap-1.5 text-xs font-semibold text-naranja hover:text-terranova transition"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Descargar CSV de ejemplo
                  </button>
                </div>

                {/* File picker */}
                <label className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2
                                  border-dashed border-navy/20 bg-navy/[0.02] hover:border-naranja/40
                                  hover:bg-naranja/5 p-8 cursor-pointer transition group">
                  <svg className="w-8 h-8 text-navy/25 group-hover:text-naranja/50 transition"
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-navy/55 group-hover:text-naranja transition">
                      Seleccionar archivo CSV
                    </p>
                    <p className="text-xs text-navy/30 mt-0.5">.csv · UTF-8</p>
                  </div>
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".csv,text/csv,text/plain"
                    onChange={handleFile}
                    className="hidden"
                  />
                </label>

                {parseError && (
                  <p className="text-sm text-terranova bg-terranova/10 rounded-xl px-4 py-2.5">
                    {parseError}
                  </p>
                )}
              </div>
            )}

            {/* ── FASE: PREVIEW ─────────────────────────────────────── */}
            {fase === 'preview' && (
              <div className="space-y-4">
                {/* Advertencia locales desconocidos */}
                {unknownsTotales.length > 0 && (
                  <div className="flex items-start gap-2.5 bg-ambar/10 border border-ambar/30 rounded-xl px-4 py-3">
                    <svg className="w-4 h-4 flex-shrink-0 text-ambar mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                      <p className="text-xs font-semibold text-ambar mb-0.5">
                        Locales no encontrados — las filas con estos valores se omitirán:
                      </p>
                      <p className="text-xs text-ambar/80">{unknownsTotales.join(', ')}</p>
                    </div>
                  </div>
                )}

                {platosConLocales.length === 0 ? (
                  <p className="text-sm text-navy/40 italic text-center py-6">
                    Ningún plato tiene locales válidos. Revisa el archivo y vuelve a intentarlo.
                  </p>
                ) : (
                  <div className="rounded-xl border border-navy/10 overflow-hidden">
                    {/* Header tabla */}
                    <div className="grid grid-cols-[1fr_64px_48px_1fr] gap-3 px-4 py-2.5
                                    bg-navy/[0.03] border-b border-navy/10">
                      {['Plato', 'Código', 'Ingr.', 'Locales'].map(h => (
                        <span key={h} className="text-[10px] font-bold text-navy/40 uppercase tracking-wide">
                          {h}
                        </span>
                      ))}
                    </div>
                    {/* Filas */}
                    <div className="divide-y divide-navy/[0.06] max-h-60 overflow-y-auto">
                      {plan.map((e, i) => (
                        <div
                          key={i}
                          className={`grid grid-cols-[1fr_64px_48px_1fr] gap-3 px-4 py-2.5 items-start ${
                            e.resolvedIds.length === 0 ? 'opacity-35' : ''
                          }`}
                        >
                          <span className="text-sm text-navy font-medium truncate" title={e.nombre}>
                            {e.nombre}
                          </span>
                          <span className="text-xs text-navy/45 tabular-nums">{e.codigo || '—'}</span>
                          <span className="text-xs text-navy/45 tabular-nums">{e.ings.length}</span>
                          <div className="min-w-0">
                            {e.resolvedNames.length > 0 && (
                              <p className="text-xs text-navy/60 leading-relaxed">
                                {e.resolvedNames.join(', ')}
                              </p>
                            )}
                            {e.unknowns.length > 0 && (
                              <p className="text-xs text-ambar mt-0.5">
                                ⚠ {e.unknowns.join(', ')}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={handleEjecutar}
                    disabled={platosConLocales.length === 0}
                    className="px-5 py-2.5 rounded-xl bg-naranja text-white text-sm font-semibold
                               hover:bg-terranova disabled:opacity-40 transition"
                  >
                    Importar {platosConLocales.length} plato{platosConLocales.length !== 1 ? 's' : ''}
                  </button>
                  <button
                    type="button"
                    onClick={resetear}
                    className="px-4 py-2.5 rounded-xl text-sm text-navy/40 hover:text-navy transition"
                  >
                    Volver
                  </button>
                </div>
              </div>
            )}

            {/* ── FASE: IMPORTANDO ──────────────────────────────────── */}
            {fase === 'importando' && (
              <div className="flex flex-col items-center justify-center gap-3 py-12">
                <div className="animate-spin w-8 h-8 rounded-full border-4 border-naranja border-t-transparent" />
                <p className="text-sm text-navy/50">Importando platos…</p>
              </div>
            )}

            {/* ── FASE: HECHO ───────────────────────────────────────── */}
            {fase === 'hecho' && resultado && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-center">
                    <p className="text-3xl font-bold text-green-600 tabular-nums">{resultado.importados}</p>
                    <p className="text-xs text-green-600/70 mt-1">Platos nuevos</p>
                  </div>
                  <div className="rounded-xl bg-navy/5 border border-navy/10 p-4 text-center">
                    <p className="text-3xl font-bold text-navy tabular-nums">{resultado.actualizados}</p>
                    <p className="text-xs text-navy/40 mt-1">Actualizados</p>
                  </div>
                </div>

                {resultado.unknownLocals.length > 0 && (
                  <div className="rounded-xl bg-ambar/10 border border-ambar/30 px-4 py-3">
                    <p className="text-xs font-semibold text-ambar mb-1">
                      Locales no encontrados ({resultado.unknownLocals.length}) — omitidos:
                    </p>
                    <p className="text-xs text-ambar/80">{resultado.unknownLocals.join(', ')}</p>
                  </div>
                )}

                {resultado.errores.length > 0 && (
                  <div className="rounded-xl bg-terranova/10 border border-terranova/20 px-4 py-3">
                    <p className="text-xs font-semibold text-terranova mb-1.5">
                      Errores ({resultado.errores.length}):
                    </p>
                    <ul className="text-xs text-terranova/80 space-y-0.5">
                      {resultado.errores.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  </div>
                )}

                {resultado.importados === 0 && resultado.actualizados === 0
                  && resultado.errores.length === 0 && (
                  <p className="text-sm text-navy/40 italic text-center">
                    No se realizaron cambios (todos los platos ya estaban actualizados).
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleClose}
                  className="w-full py-2.5 rounded-xl bg-naranja text-white text-sm font-semibold
                             hover:bg-terranova transition"
                >
                  Cerrar
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
