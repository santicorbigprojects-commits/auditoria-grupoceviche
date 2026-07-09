import { useState } from 'react'
import SidebarLayout, { type NavItem } from '../../components/ui/SidebarLayout'
import TrackingPage        from './TrackingPage'
import CalendarioPage      from './CalendarioPage'
import ConfiguracionPage   from './ConfiguracionPage'
import MisAuditoriasPage   from './MisAuditoriasPage'
import AccionesMejoraPage  from '../AccionesMejoraPage'

type Tab = 'tracking' | 'historial' | 'acciones' | 'calendario' | 'config'

export default function AuditorPage() {
  const [tab, setTab] = useState<Tab>('tracking')

  const navItems: NavItem[] = [
    {
      label:   'Nueva auditoría',
      icon:    <IconTracking />,
      onClick: () => setTab('tracking'),
      active:  tab === 'tracking',
    },
    {
      label:   'Mis auditorías',
      icon:    <IconHistorial />,
      onClick: () => setTab('historial'),
      active:  tab === 'historial',
    },
    {
      label:   'Acciones de mejora',
      icon:    <IconAcciones />,
      onClick: () => setTab('acciones'),
      active:  tab === 'acciones',
    },
    {
      label:   'Calendario',
      icon:    <IconCalendar />,
      onClick: () => setTab('calendario'),
      active:  tab === 'calendario',
    },
    {
      label:   'Configuración',
      icon:    <IconConfig />,
      onClick: () => setTab('config'),
      active:  tab === 'config',
    },
  ]

  return (
    <SidebarLayout navItems={navItems}>
      {tab === 'tracking'   && <TrackingPage />}
      {tab === 'historial'  && <MisAuditoriasPage />}
      {tab === 'acciones'   && <AccionesMejoraPage />}
      {tab === 'calendario' && <CalendarioPage />}
      {tab === 'config'     && <ConfiguracionPage />}
    </SidebarLayout>
  )
}

function IconTracking() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  )
}

function IconHistorial() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function IconAcciones() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function IconCalendar() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
}

function IconConfig() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}
