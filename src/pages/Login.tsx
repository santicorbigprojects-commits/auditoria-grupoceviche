import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import type { AuUsuario } from '../types'

export default function Login() {
  const navigate = useNavigate()
  const { login, isAuthenticated, rol } = useAuthStore()

  const [cut, setCut]       = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  // Si ya tiene sesión activa redirige de inmediato
  useEffect(() => {
    if (isAuthenticated()) {
      navigate(rol === 'AUDITOR' ? '/auditor' : '/director', { replace: true })
    }
  // Solo al montar
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { data, error: dbErr } = await supabase
      .from('au_usuarios')
      .select('cut, nombre, rol, activo')
      .eq('cut', cut.trim().toUpperCase())
      .eq('activo', true)
      .single()

    setLoading(false)

    if (dbErr || !data) {
      setError('CUT no encontrado o usuario inactivo.')
      return
    }

    const usuario = data as AuUsuario
    login(usuario.cut, usuario.nombre, usuario.rol)
    navigate(usuario.rol === 'AUDITOR' ? '/auditor' : '/director', { replace: true })
  }

  return (
    <div className="min-h-screen bg-crema flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Cabecera de marca */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-naranja shadow-lg mb-4">
            <IconClipboard />
          </div>
          <h1 className="text-2xl font-bold text-navy leading-tight" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Auditorías
          </h1>
          <p className="text-sm text-navy/50 mt-0.5 tracking-wide uppercase font-medium">
            Grupo Ceviche
          </p>
        </div>

        {/* Tarjeta de login */}
        <div className="bg-white rounded-2xl shadow-xl shadow-navy/10 p-8">
          <h2 className="text-lg font-semibold text-navy">Iniciar sesión</h2>
          <p className="text-sm text-navy/50 mt-0.5 mb-6">
            Ingresa tu código de empleado (CUT)
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="cut"
                className="block text-sm font-medium text-navy mb-1.5"
              >
                CUT
              </label>
              <input
                id="cut"
                type="text"
                value={cut}
                onChange={(e) => { setCut(e.target.value); setError(null) }}
                placeholder="Ej. A00001"
                autoFocus
                autoComplete="off"
                spellCheck={false}
                className="
                  w-full px-4 py-2.5 rounded-xl border
                  border-navy/20 bg-crema/60
                  text-navy font-mono text-base tracking-wider
                  placeholder:text-navy/25 placeholder:font-sans placeholder:tracking-normal
                  focus:outline-none focus:ring-2 focus:ring-naranja/40 focus:border-naranja
                  transition-all duration-150
                "
              />
            </div>

            {error && (
              <div className="flex items-start gap-2.5 text-sm text-terranova bg-terranova/8 rounded-xl px-4 py-3">
                <IconError className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !cut.trim()}
              className="
                w-full py-2.5 px-4 rounded-xl font-semibold text-white text-sm
                bg-naranja hover:bg-terranova
                active:scale-[0.98]
                disabled:opacity-40 disabled:cursor-not-allowed
                transition-all duration-150
                focus:outline-none focus:ring-2 focus:ring-naranja/40 focus:ring-offset-2
              "
            >
              {loading
                ? <SpinnerRow label="Verificando…" />
                : 'Entrar'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-navy/25 mt-6">
          v0.1.0 · Sistema de Auditorías
        </p>
      </div>
    </div>
  )
}

/* ── Iconos SVG inline ─────────────────────────────────────────────────── */

function IconClipboard() {
  return (
    <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2
           M9 5a2 2 0 002 2h2a2 2 0 002-2
           M9 5a2 2 0 012-2h2a2 2 0 012 2
           m-6 9l2 2 4-4" />
    </svg>
  )
}

function IconError({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" clipRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm-.75-5.75a.75.75 0 001.5 0v-4a.75.75 0 00-1.5 0v4zm.75 2.5a1 1 0 100-2 1 1 0 000 2z" />
    </svg>
  )
}

function SpinnerRow({ label }: { label: string }) {
  return (
    <span className="flex items-center justify-center gap-2">
      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
      </svg>
      {label}
    </span>
  )
}
