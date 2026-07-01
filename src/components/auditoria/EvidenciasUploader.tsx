import { useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuditoriaStore, type EvidenciaDraft } from '../../store/auditoriaStore'
import type { AreaEvidencia } from '../../types'

/* ── Opciones de etiqueta por área ─────────────────────────────────────── */

const ETIQUETAS_SERVICIO = [
  'Speech de bienvenida',
  'Nombre del camarero',
  'Oferta de bebidas',
  'Meta del día',
  'Uniformes',
  'Cabellos',
  'Uñas',
  'Zapatos',
  'Barba / Maquillaje',
  'Tiempo entrante',
  'Tiempo plato principal',
  'Tiempo bebida',
  'Tiempo postre',
]

const ETIQUETAS_LOCAL = [
  'Cartelería actualizada',
  'Cartelería completa',
  'Limpieza sala',
  'Limpieza baños',
  'Limpieza barras',
]

const ETIQUETAS_REVISION_INTERNA = [
  'Revisión',
  'Rotulación',
  'Higiene de cocina',
]

/* ── Compresión de imagen ───────────────────────────────────────────────── */

async function comprimirImagen(file: File): Promise<Blob> {
  const MAX_W   = 1280
  const QUALITY = 0.7
  return new Promise((resolve, reject) => {
    const img       = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const scale   = Math.min(1, MAX_W / img.width)
      const canvas  = document.createElement('canvas')
      canvas.width  = Math.round(img.width  * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('canvas context')); return }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        blob => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
        'image/jpeg',
        QUALITY,
      )
    }
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('image load')) }
    img.src = objectUrl
  })
}

/* ── Componente ─────────────────────────────────────────────────────────── */

interface Props {
  area: AreaEvidencia
}

export default function EvidenciasUploader({ area }: Props) {
  const {
    evidencias,
    productoItems,
    addEvidencia,
    removeEvidencia,
    setEvidenciaEtiqueta,
  } = useAuditoriaStore()

  const fotos    = evidencias[area]
  const inputRef = useRef<HTMLInputElement>(null)

  const [subiendo,    setSubiendo]    = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [eliminando,  setEliminando]  = useState<string | null>(null)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  // Opciones del selector según área
  const opciones: string[] =
    area === 'PRODUCTO'
      ? [...new Set(productoItems.map(i => i.ingrediente_nombre))]
      : area === 'SERVICIO'
      ? ETIQUETAS_SERVICIO
      : area === 'LOCAL'
      ? ETIQUETAS_LOCAL
      : ETIQUETAS_REVISION_INTERNA

  const selectorDeshabilitado = area === 'PRODUCTO' && productoItems.length === 0

  async function handleFiles(files: FileList) {
    setSubiendo(true)
    setUploadError(null)
    try {
      for (const file of Array.from(files)) {
        const blob = await comprimirImagen(file)
        const path = `${crypto.randomUUID()}.jpg`
        const { error: upErr } = await supabase.storage
          .from('au-evidencias')
          .upload(path, blob, { contentType: 'image/jpeg' })
        if (upErr) throw upErr
        const { data } = supabase.storage.from('au-evidencias').getPublicUrl(path)
        addEvidencia(area, { path, url: data.publicUrl })
      }
    } catch (e) {
      console.error('upload error', e)
      setUploadError('Error al subir la foto. Verifica la conexión e intenta de nuevo.')
    } finally {
      setSubiendo(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleDelete(ev: EvidenciaDraft) {
    setEliminando(ev.path)
    try {
      await supabase.storage.from('au-evidencias').remove([ev.path])
      removeEvidencia(area, ev.path)
    } catch (e) {
      console.error('delete error', e)
    } finally {
      setEliminando(null)
    }
  }

  return (
    <div className="mt-4 pt-4 border-t border-navy/10">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-navy/40 uppercase tracking-wide">
          Evidencias
          {fotos.length > 0 && (
            <span className="ml-1.5 font-normal normal-case text-navy/30">({fotos.length})</span>
          )}
        </p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={subiendo}
          className="text-xs px-3 py-1 rounded-lg border border-navy/20 text-navy/55
                     hover:border-naranja hover:text-naranja disabled:opacity-40 transition"
        >
          {subiendo ? 'Subiendo…' : '+ Agregar foto'}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={e => e.target.files?.length && handleFiles(e.target.files)}
      />

      {uploadError && (
        <p className="text-xs text-terranova mb-2 flex items-center gap-1">
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" clipRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm-.75-5.75a.75.75 0 001.5 0v-4a.75.75 0 00-1.5 0v4zm.75 2.5a1 1 0 100-2 1 1 0 000 2z"/>
          </svg>
          {uploadError}
        </p>
      )}

      {fotos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
          {fotos.map(ev => (
            <div key={ev.path} className="flex flex-col gap-1">

              {/* Miniatura */}
              <div className="relative group aspect-square">
                <img
                  src={ev.url}
                  alt="evidencia"
                  onClick={() => setLightboxUrl(ev.url)}
                  className="w-full h-full object-cover rounded-xl cursor-zoom-in border border-navy/10"
                />
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); handleDelete(ev) }}
                  disabled={eliminando === ev.path}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-terranova text-white text-[10px]
                             flex items-center justify-center
                             opacity-0 group-hover:opacity-100 disabled:opacity-50
                             transition-opacity leading-none"
                >
                  ✕
                </button>
                {eliminando === ev.path && (
                  <div className="absolute inset-0 rounded-xl bg-white/60 flex items-center justify-center">
                    <div className="w-4 h-4 rounded-full border-2 border-terranova border-t-transparent animate-spin" />
                  </div>
                )}
              </div>

              {/* Selector de etiqueta */}
              <select
                value={ev.etiqueta ?? ''}
                onChange={e => setEvidenciaEtiqueta(area, ev.path, e.target.value || undefined)}
                disabled={selectorDeshabilitado || eliminando === ev.path}
                title={selectorDeshabilitado ? 'Selecciona platos primero' : 'Etiqueta (opcional)'}
                className="w-full text-[10px] rounded-lg border border-navy/15 bg-white text-navy/60
                           px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-naranja/30
                           focus:border-naranja transition
                           disabled:opacity-35 disabled:cursor-not-allowed"
              >
                <option value="">Sin etiqueta</option>
                {opciones.map(o => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>

            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <img
            src={lightboxUrl}
            alt="evidencia ampliada"
            className="max-w-full max-h-full rounded-2xl object-contain shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20
                       text-white flex items-center justify-center hover:bg-white/35 transition text-lg"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
