import { createBrowserRouter, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import AuditorPage from './pages/auditor/AuditorPage'
import DirectorPage from './pages/director/DirectorPage'
import ProtectedRoute from './components/ui/ProtectedRoute'

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/login" replace /> },
  { path: '/login', element: <Login /> },
  {
    path: '/auditor',
    element: <ProtectedRoute roles={['AUDITOR']} />,
    children: [{ index: true, element: <AuditorPage /> }],
  },
  {
    path: '/director',
    element: <ProtectedRoute roles={['DIRECTOR', 'ADMIN']} />,
    children: [{ index: true, element: <DirectorPage /> }],
  },
])
