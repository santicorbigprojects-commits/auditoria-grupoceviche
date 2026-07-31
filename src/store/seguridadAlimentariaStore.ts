import { create } from 'zustand'
import type { EstadoPunto } from '../types'

export interface PersonaDraft {
  id:         string   // UUID local para key de lista
  nombre:     string
  accesorio?: string   // solo en el punto de accesorios
}

export interface RespuestaDraft {
  estado:   EstadoPunto | null   // null = aún sin responder
  personas: PersonaDraft[]
}

interface SeguridadAlimentariaState {
  local_id:   string | null
  fecha:      string
  respuestas: Record<string, RespuestaDraft>   // key = puntoKey (único en todo el catálogo)

  setLocalId:    (id: string) => void
  setFecha:      (fecha: string) => void
  setEstado:     (puntoKey: string, estado: EstadoPunto) => void
  addPersona:    (puntoKey: string, nombre: string, accesorio?: string) => void
  removePersona: (puntoKey: string, personaId: string) => void
  reset:      () => void
  loadFromDB: (data: { local_id: string; fecha: string; respuestas: Record<string, RespuestaDraft> }) => void
}

const hoy = () => new Date().toISOString().slice(0, 10)

function respuestaVacia(): RespuestaDraft {
  return { estado: null, personas: [] }
}

export const useSeguridadAlimentariaStore = create<SeguridadAlimentariaState>()((set) => ({
  local_id:   null,
  fecha:      hoy(),
  respuestas: {},

  setLocalId: (id)    => set({ local_id: id }),
  setFecha:   (fecha) => set({ fecha }),

  // Al marcar un estado distinto de NO_CUMPLE se descartan las personas ya registradas
  // (solo tienen sentido cuando el punto no cumple).
  setEstado: (puntoKey, estado) =>
    set((s) => ({
      respuestas: {
        ...s.respuestas,
        [puntoKey]: {
          estado,
          personas: estado === 'NO_CUMPLE' ? (s.respuestas[puntoKey]?.personas ?? []) : [],
        },
      },
    })),

  addPersona: (puntoKey, nombre, accesorio) =>
    set((s) => {
      const actual = s.respuestas[puntoKey] ?? respuestaVacia()
      return {
        respuestas: {
          ...s.respuestas,
          [puntoKey]: { ...actual, personas: [...actual.personas, { id: crypto.randomUUID(), nombre, accesorio }] },
        },
      }
    }),

  removePersona: (puntoKey, personaId) =>
    set((s) => {
      const actual = s.respuestas[puntoKey]
      if (!actual) return s
      return {
        respuestas: {
          ...s.respuestas,
          [puntoKey]: { ...actual, personas: actual.personas.filter((p) => p.id !== personaId) },
        },
      }
    }),

  reset: () => set({ local_id: null, fecha: hoy(), respuestas: {} }),

  loadFromDB: (data) => set(data),
}))
