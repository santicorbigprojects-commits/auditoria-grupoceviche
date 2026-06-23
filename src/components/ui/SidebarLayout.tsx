import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

export interface NavItem {
  label:   string
  icon:    ReactNode
  onClick: () => void
  active?: boolean
}

interface Props {
  children:  ReactNode
  navItems:  NavItem[]
}

export default function SidebarLayout({ children, navItems }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const { nombre, rol, logout } = useAuthStore()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex h-screen overflow-hidden bg-crema">
      {/* Sidebar */}
      <aside
        className={`relative flex flex-col bg-navy flex-shrink-0 overflow-hidden transition-[width] duration-200 ${
          collapsed ? 'w-16' : 'w-56'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center h-16 px-4 gap-3 border-b border-white/10 flex-shrink-0">
          <div className="w-8 h-8 flex-shrink-0 rounded-lg bg-naranja flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          {!collapsed && (
            <div className="min-w-0 overflow-hidden">
              <p className="text-white font-bold text-sm leading-tight truncate" style={{ fontFamily: 'Poppins, sans-serif' }}>
                Auditorías
              </p>
              <p className="text-white/40 text-xs truncate">Grupo Ceviche</p>
            </div>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto overflow-x-hidden">
          {navItems.map((item, i) => (
            <button
              key={i}
              onClick={item.onClick}
              title={collapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-100 ${
                collapsed ? 'justify-center' : ''
              } ${
                item.active
                  ? 'bg-naranja text-white'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                {item.icon}
              </span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          ))}
        </nav>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? 'Expandir' : 'Colapsar'}
          className="absolute top-[18px] -right-3 z-10 w-6 h-6 rounded-full bg-navy border-2 border-crema flex items-center justify-center hover:bg-naranja transition-colors"
        >
          <svg
            className={`w-2.5 h-2.5 text-white transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Footer */}
        <div className="border-t border-white/10 p-2 flex-shrink-0 overflow-hidden">
          {!collapsed && (
            <div className="px-3 py-2">
              <p className="text-white text-xs font-semibold truncate">{nombre}</p>
              <p className="text-white/40 text-xs">{rol}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            title="Cerrar sesión"
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-white/50 hover:text-white hover:bg-white/10 transition-colors ${
              collapsed ? 'justify-center' : ''
            }`}
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {!collapsed && 'Cerrar sesión'}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto min-w-0">
        {children}
      </main>
    </div>
  )
}
