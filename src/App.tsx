import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { supabase } from './lib/supabase'
import { useAuthStore } from './store/authStore'

export default function App() {
  useEffect(() => {
    useAuthStore.getState().cargarSesion()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        useAuthStore.setState({ cut: null, nombre: null, rol: null, cargando: false })
      }
      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        useAuthStore.getState().cargarSesion()
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return <RouterProvider router={router} />
}
