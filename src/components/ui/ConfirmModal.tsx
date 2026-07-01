interface Props {
  titulo:      string
  mensaje:     string
  confirmando: boolean
  error?:      string | null
  onConfirm:   () => void
  onCancel:    () => void
}

export default function ConfirmModal({ titulo, mensaje, confirmando, error, onConfirm, onCancel }: Props) {
  return (
    <div
      className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget && !confirmando) onCancel() }}
    >
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6">
        <h3 className="text-base font-bold text-navy mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
          {titulo}
        </h3>
        <p className="text-sm text-navy/60 leading-relaxed mb-5">{mensaje}</p>

        {error && (
          <p className="text-xs text-terranova bg-terranova/10 rounded-xl px-3 py-2 mb-4">{error}</p>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={confirmando}
            className="px-4 py-2 rounded-xl text-sm font-medium text-navy/60 border border-navy/20
                       hover:border-navy/40 transition disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmando}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-terranova
                       hover:bg-terranova/90 transition disabled:opacity-50"
          >
            {confirmando ? 'Eliminando…' : 'Eliminar'}
          </button>
        </div>
      </div>
    </div>
  )
}
