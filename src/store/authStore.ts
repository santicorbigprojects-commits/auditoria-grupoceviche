import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Rol } from '../types'

interface AuthState {
  cut:      string | null
  nombre:   string | null
  rol:      Rol | null
  expiresAt: number | null

  login:           (cut: string, nombre: string, rol: Rol) => void
  logout:          () => void
  isAuthenticated: () => boolean
}

const SESSION_MS = 8 * 60 * 60 * 1000  // 8 horas

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      cut:       null,
      nombre:    null,
      rol:       null,
      expiresAt: null,

      login(cut, nombre, rol) {
        set({ cut, nombre, rol, expiresAt: Date.now() + SESSION_MS })
      },

      logout() {
        set({ cut: null, nombre: null, rol: null, expiresAt: null })
      },

      isAuthenticated() {
        const { cut, expiresAt } = get()
        return !!cut && !!expiresAt && Date.now() < expiresAt
      },
    }),
    { name: 'au_session' },
  ),
)
