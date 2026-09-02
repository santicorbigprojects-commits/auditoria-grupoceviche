import { useState } from 'react'
import { cambiarPassword } from '../../lib/auth'

interface Props {
  onClose: () => void
}

export function CambiarPasswordModal({ onClose }: Props) {
  const [password, setPassword] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [error, setError] = useState('')
  const [ok, setOk] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    if (password !== confirmacion) {
      setError('Las contraseñas no coinciden')
      return
    }
    setLoading(true)
    const result = await cambiarPassword(password)
    setLoading(false)
    if (!result.ok) {
      setError(result.error ?? 'No se pudo cambiar la contraseña')
      return
    }
    setOk(true)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
        <h2 className="text-lg font-semibold text-navy mb-4">Cambiar contraseña</h2>

        {ok ? (
          <div className="space-y-4">
            <p className="text-sm text-green-600">Contraseña actualizada correctamente.</p>
            <button
              onClick={onClose}
              className="w-full bg-naranja hover:bg-terranova text-white rounded-xl py-2.5 font-medium text-sm transition-colors"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-sm font-medium text-navy mb-1 block">Contraseña nueva</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                className="w-full border border-navy/20 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-naranja/40"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-navy mb-1 block">Repetir contraseña</label>
              <input
                type="password"
                value={confirmacion}
                onChange={(e) => setConfirmacion(e.target.value)}
                className="w-full border border-navy/20 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-naranja/40"
              />
            </div>
            {error && <p className="text-sm text-terranova">{error}</p>}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 border border-navy/20 text-navy rounded-xl py-2.5 text-sm hover:bg-crema transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-naranja hover:bg-terranova text-white rounded-xl py-2.5 font-medium text-sm transition-colors disabled:opacity-50"
              >
                {loading ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
