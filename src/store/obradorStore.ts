import { create } from 'zustand'
import type { Severidad, ExtremaModo, RespuestaObrador } from '../types'

export interface EvidenciaObradorDraft {
  path:        string           // nombre de archivo en el bucket au-evidencias (uuid.jpg)
  url:         string           // URL pública para mostrar
  aspecto_id:  string           // aspecto al que pertenece la foto
}

export interface RespuestaObradorDraft {
  respuesta:   RespuestaObrador | null   // null = aún sin responder
  observacion: string                    // comentario libre del aspecto, no puntúa
}

export interface ObservacionObradorDraft {
  id:            string   // UUID local para key de lista
  aspecto_id:    string
  descripcion:   string
  severidad:     Severidad
  extrema_modo?: ExtremaModo | null
}

interface ObradorState {
  obrador_id:               string | null
  fecha:                    string
  respuestas:               Record<string, RespuestaObradorDraft>   // key = aspecto_id
  observaciones:            ObservacionObradorDraft[]
  observaciones_generales:  string
  evidencias:               EvidenciaObradorDraft[]

  setObradorId:              (id: string) => void
  setFecha:                  (fecha: string) => void
  setRespuesta:               (aspecto_id: string, respuesta: RespuestaObrador) => void
  setRespuestaObservacion:    (aspecto_id: string, texto: string) => void
  addObservacion:             (obs: Omit<ObservacionObradorDraft, 'id'>) => void
  updateObservacion:          (id: string, patch: Partial<ObservacionObradorDraft>) => void
  removeObservacion:          (id: string) => void
  setObservacionesGenerales:  (texto: string) => void
  addEvidencia:                (ev: EvidenciaObradorDraft) => void
  removeEvidencia:             (path: string) => void
  reset:      () => void
  loadFromDB: (data: {
    obrador_id:              string
    fecha:                   string
    respuestas:              Record<string, RespuestaObradorDraft>
    observaciones:           ObservacionObradorDraft[]
    observaciones_generales: string
    evidencias:              EvidenciaObradorDraft[]
  }) => void
}

const hoy = () => new Date().toISOString().slice(0, 10)

export const useObradorStore = create<ObradorState>()((set) => ({
  obrador_id:              null,
  fecha:                   hoy(),
  respuestas:              {},
  observaciones:           [],
  observaciones_generales: '',
  evidencias:              [],

  setObradorId: (id)    => set({ obrador_id: id }),
  setFecha:     (fecha) => set({ fecha }),

  setRespuesta: (aspecto_id, respuesta) =>
    set((s) => {
      const actual = s.respuestas[aspecto_id] ?? { respuesta: null, observacion: '' }
      return { respuestas: { ...s.respuestas, [aspecto_id]: { ...actual, respuesta } } }
    }),

  setRespuestaObservacion: (aspecto_id, texto) =>
    set((s) => {
      const actual = s.respuestas[aspecto_id] ?? { respuesta: null, observacion: '' }
      return { respuestas: { ...s.respuestas, [aspecto_id]: { ...actual, observacion: texto } } }
    }),

  addObservacion: (obs) =>
    set((s) => ({
      observaciones: [...s.observaciones, { ...obs, id: crypto.randomUUID() }],
    })),

  updateObservacion: (id, patch) =>
    set((s) => ({
      observaciones: s.observaciones.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    })),

  removeObservacion: (id) =>
    set((s) => ({
      observaciones: s.observaciones.filter((o) => o.id !== id),
    })),

  setObservacionesGenerales: (texto) => set({ observaciones_generales: texto }),

  addEvidencia: (ev) =>
    set((s) => ({ evidencias: [...s.evidencias, ev] })),

  removeEvidencia: (path) =>
    set((s) => ({ evidencias: s.evidencias.filter((e) => e.path !== path) })),

  reset: () =>
    set({
      obrador_id:              null,
      fecha:                   hoy(),
      respuestas:              {},
      observaciones:           [],
      observaciones_generales: '',
      evidencias:              [],
    }),

  loadFromDB: (data) => set(data),
}))
