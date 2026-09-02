import { supabase } from './supabase'
import type { Rol } from '../types'

export const CUT_EMAIL_DOMAIN = 'grupoceviche.local'

export function cutToEmail(cut: string): string {
  return `${cut.trim().toUpperCase()}@${CUT_EMAIL_DOMAIN}`
}

export function emailToCut(email: string): string {
  return email.split('@')[0].toUpperCase()
}

export async function loginConCut(
  cut: string,
  password: string
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.auth.signInWithPassword({
    email: cutToEmail(cut),
    password,
  })
  if (error) return { ok: false, error: 'CUT o contraseña incorrectos' }
  return { ok: true }
}

export interface SesionAuditoria {
  cut: string
  nombre: string
  rol: Rol
}

export async function cargarSesionDesdeAuth(): Promise<SesionAuditoria | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return null

  const cut = emailToCut(user.email)
  const { data, error } = await supabase
    .from('au_usuarios')
    .select('cut, nombre, rol, activo')
    .eq('cut', cut)
    .eq('activo', true)
    .single()

  if (error || !data) return null

  return {
    cut: data.cut,
    nombre: data.nombre,
    rol: data.rol as Rol,
  }
}

export async function cerrarSesion() {
  await supabase.auth.signOut()
}

export async function cambiarPassword(
  nuevaPassword: string
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.auth.updateUser({ password: nuevaPassword })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
