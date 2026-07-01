// Panel lateral con notas en vivo. Recibe valores ya calculados desde TrackingPage.

interface Props {
  notaP:       number
  notaS:       number
  notaL:       number
  descuentoRI?: number
  notaT:       number
  onGuardar:   () => void
  guardando:   boolean
  guardadoOk:  boolean
  canGuardar:  boolean
}

const AREA_MAX = 20 / 3   // 6.6̄

export default function PanelNotas({
  notaP, notaS, notaL, descuentoRI = 0, notaT,
  onGuardar, guardando, guardadoOk, canGuardar,
}: Props) {
  return (
    <div className="bg-white rounded-2xl shadow-lg shadow-navy/10 border border-navy/10 p-5 sticky top-6">
      <h3 className="text-xs font-bold text-navy/40 uppercase tracking-wide mb-4">
        Panel de notas
      </h3>

      {/* Notas por área */}
      <div className="space-y-3 mb-5">
        <FilaNota label="Producto" valor={notaP} max={AREA_MAX} />
        <FilaNota label="Servicio" valor={notaS} max={AREA_MAX} />
        <FilaNota label="Local"    valor={notaL} max={AREA_MAX} />
        {descuentoRI > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-navy/60">Revisión Interna</span>
            <span className="text-sm font-semibold tabular-nums text-marron">
              −{descuentoRI.toFixed(2)}
            </span>
          </div>
        )}
      </div>

      {/* Total */}
      <div className="border-t border-navy/10 pt-4 mb-5">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-bold text-navy">Total</span>
          <span className={`text-3xl font-bold tabular-nums ${colorTotal(notaT)}`}>
            {notaT.toFixed(2)}
            <span className="text-sm font-normal text-navy/30 ml-1">/ 20</span>
          </span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-navy/10 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${barTotal(notaT)}`}
            style={{ width: `${Math.min(100, (notaT / 20) * 100)}%` }}
          />
        </div>
        {/* Semáforo label — TODO Santi puede ajustar cortes */}
        <p className={`text-xs font-semibold mt-1 ${colorTotal(notaT)}`}>
          {notaT >= 16 ? 'Aprobado' : notaT >= 12 ? 'En riesgo' : 'Crítico'}
        </p>
      </div>

      {/* Acción */}
      {guardadoOk ? (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-xl px-4 py-3">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Auditoría guardada
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={onGuardar}
            disabled={!canGuardar || guardando}
            className="w-full py-3 rounded-xl font-semibold text-sm text-white
                       bg-naranja hover:bg-terranova active:scale-[0.98]
                       disabled:opacity-40 disabled:cursor-not-allowed
                       transition-all duration-150 focus:outline-none focus:ring-2
                       focus:ring-naranja/40 focus:ring-offset-2"
          >
            {guardando
              ? <Spinner label="Guardando…" />
              : 'Guardar auditoría'}
          </button>
          {!canGuardar && (
            <p className="text-xs text-navy/30 text-center mt-2">Selecciona un local primero</p>
          )}
        </>
      )}
    </div>
  )
}

/* ── Sub-components ─────────────────────────────────────────────────────── */

function FilaNota({ label, valor, max }: { label: string; valor: number; max: number }) {
  const pct   = Math.min(100, (valor / max) * 100)
  const color = valor >= max * 0.8 ? 'text-green-600' : valor >= max * 0.6 ? 'text-ambar' : 'text-terranova'
  const bar   = valor >= max * 0.8 ? 'bg-green-400'  : valor >= max * 0.6 ? 'bg-ambar'    : 'bg-terranova'

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-navy/60">{label}</span>
        <span className={`text-sm font-semibold tabular-nums ${color}`}>{valor.toFixed(2)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-navy/10 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-300 ${bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// TODO Santi: ajustar cortes de semáforo (actualmente >=16 verde, >=12 ámbar, <12 rojo)
function colorTotal(n: number) {
  if (n >= 16) return 'text-green-600'
  if (n >= 12) return 'text-ambar'
  return 'text-terranova'
}

function barTotal(n: number) {
  if (n >= 16) return 'bg-green-500'
  if (n >= 12) return 'bg-ambar'
  return 'bg-terranova'
}

function Spinner({ label }: { label: string }) {
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
