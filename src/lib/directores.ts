import { supabase } from './supabase'
import type { AuDirectorLocal, Rol } from '../types'

const PARTICULAS = new Set(['DE', 'DEL', 'LA', 'LAS', 'LOS', 'SAN', 'Y'])

function capitalizar(palabra: string, i: number): string {
  const p = palabra.toLocaleLowerCase('es')
  if (i > 0 && PARTICULAS.has(palabra.toUpperCase())) return p
  return p.charAt(0).toLocaleUpperCase('es') + p.slice(1)
}

/* "LUNA GUTIERREZ, ALEX HERNAN" → "Alex Luna" (primer nombre + primer apellido).
   Respeta apellidos con partícula: "DE LA CRUZ PEREZ, JUAN" → "Juan de la Cruz". */
export function nombreCorto(nombre: string): string {
  const [apellidos, nombres] = nombre.split(',').map(s => s.trim())
  if (!nombres) return nombre.split(/\s+/).map(capitalizar).join(' ')

  const tokens = apellidos.split(/\s+/)
  const apellido: string[] = []
  for (const t of tokens) {
    apellido.push(t)
    if (!PARTICULAS.has(t.toUpperCase())) break
  }
  const primerNombre = nombres.split(/\s+/)[0]
  return [primerNombre, ...apellido].map(capitalizar).join(' ')
}

/* Locales que puede ver el usuario según au_director_locales. null = todos.
   - DIRECTOR: solo los suyos.
   - VISUALIZADOR con locales asignados (encargados): solo los suyos.
   - VISUALIZADOR sin locales asignados (visualizador general), ADMIN, AUDITOR: todos. */
export async function cargarLocalesAsignados(cut: string, rol: Rol): Promise<string[] | null> {
  if (rol !== 'DIRECTOR' && rol !== 'VISUALIZADOR') return null
  const { data, error } = await supabase
    .from('au_director_locales')
    .select('local_id')
    .eq('director_cut', cut)
  if (error) throw error
  const ids = (data ?? []).map((r: { local_id: string }) => r.local_id)
  if (rol === 'VISUALIZADOR' && ids.length === 0) return null
  return ids
}

/* Director de cada local (au_director_locales → au_usuarios).
   au_director_locales también guarda el local de los VISUALIZADOR (encargados),
   así que solo se toman los usuarios con rol DIRECTOR. */
export async function cargarDirectorPorLocal(localIds?: string[]): Promise<Record<string, string>> {
  let q = supabase.from('au_director_locales').select('*')
  if (localIds) q = q.in('local_id', localIds)
  const { data: dlData, error: eDl } = await q
  if (eDl) throw eDl
  const directorLocales = (dlData ?? []) as AuDirectorLocal[]

  const cuts = Array.from(new Set(directorLocales.map(d => d.director_cut)))
  if (cuts.length === 0) return {}

  const { data: usersData, error: eUs } = await supabase
    .from('au_usuarios')
    .select('cut, nombre')
    .eq('rol', 'DIRECTOR')
    .in('cut', cuts)
  if (eUs) throw eUs

  const nombrePorCut: Record<string, string> = {}
  ;(usersData ?? []).forEach((u: { cut: string; nombre: string }) => {
    nombrePorCut[u.cut] = nombreCorto(u.nombre)
  })

  const directorPorLocal: Record<string, string> = {}
  directorLocales.forEach(dl => {
    const nombre = nombrePorCut[dl.director_cut]
    if (nombre && !directorPorLocal[dl.local_id]) directorPorLocal[dl.local_id] = nombre
  })
  return directorPorLocal
}
