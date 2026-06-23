import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import type { Rol } from '../../types'

interface Props {
  roles: Rol[]
}

export default function ProtectedRoute({ roles }: Props) {
  const { isAuthenticated, rol } = useAuthStore()

  if (!isAuthenticated()) return <Navigate to="/login" replace />
  if (rol && !roles.includes(rol)) return <Navigate to="/login" replace />

  return <Outlet />
}
