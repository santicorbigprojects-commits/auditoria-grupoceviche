import { create } from 'zustand'
import type { Rol } from '../types'
import { cargarSesionDesdeAuth, cerrarSesion } from '../lib/auth'

interface AuthState {
  cut: string | null
  nombre: string | null
  rol: Rol | null
  cargando: boolean

  cargarSesion: () => Promise<void>
  logout: () => Promise<void>
  isAuthenticated: () => boolean
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  cut: null,
  nombre: null,
  rol: null,
  cargando: true,

  async cargarSesion() {
    set({ cargando: true })
    const sesion = await cargarSesionDesdeAuth()
    if (sesion) {
      set({ cut: sesion.cut, nombre: sesion.nombre, rol: sesion.rol, cargando: false })
    } else {
      set({ cut: null, nombre: null, rol: null, cargando: false })
    }
  },

  async logout() {
    await cerrarSesion()
    set({ cut: null, nombre: null, rol: null })
  },

  isAuthenticated() {
    return !!get().cut
  },
}))
