import type { AuVisita, EstadoVisita } from '../../types'

const DIA_COLS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const ESTADO_CHIP: Record<EstadoVisita, string> = {
  PROGRAMADA: 'bg-ambar     text-white',
  REALIZADA:  'bg-green-500 text-white',
  CANCELADA:  'bg-navy/25   text-navy/60',
}

interface Props {
  year:         number
  month:        number             // 0-based
  visitas:      AuVisita[]
  localesMap:   Record<string, string>
  selectedDate: string | null
  onDayClick:   (fecha: string) => void
}

export default function CalendarioVisitas({
  year, month, visitas, localesMap, selectedDate, onDayClick,
}: Props) {
  const firstDay    = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startPad    = (firstDay.getDay() + 6) % 7  // 0=Lun … 6=Dom

  // Agrupar visitas por fecha ISO para acceso O(1)
  const byDate: Record<string, AuVisita[]> = {}
  visitas.forEach(v => {
    if (!byDate[v.fecha]) byDate[v.fecha] = []
    byDate[v.fecha].push(v)
  })

  const today = new Date().toISOString().slice(0, 10)

  // Celdas: null para relleno inicial, luego días 1..daysInMonth
  const cells: (number | null)[] = [
    ...Array<null>(startPad).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  function toISO(day: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  return (
    <div>
      {/* Cabecera de días */}
      <div className="grid grid-cols-7 mb-1">
        {DIA_COLS.map(d => (
          <div key={d} className="text-center text-xs font-semibold text-navy/35 py-2 select-none">
            {d}
          </div>
        ))}
      </div>

      {/* Celdas */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={`pad-${i}`} className="min-h-[72px]" />

          const fecha = toISO(day)
          const dvs   = byDate[fecha] ?? []
          const isSel = fecha === selectedDate
          const isHoy = fecha === today

          return (
            <button
              key={fecha}
              type="button"
              onClick={() => onDayClick(fecha)}
              className={`min-h-[72px] p-1.5 rounded-xl text-left border transition-colors ${
                isSel
                  ? 'bg-naranja/10 border-naranja/40 shadow-sm'
                  : 'bg-white border-navy/10 hover:border-naranja/25 hover:bg-naranja/5'
              }`}
            >
              {/* Número del día */}
              <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold mb-1 ${
                isHoy ? 'bg-naranja text-white' : isSel ? 'text-naranja font-bold' : 'text-navy/55'
              }`}>
                {day}
              </span>

              {/* Chips de visitas */}
              <div className="space-y-0.5">
                {dvs.slice(0, 2).map(v => (
                  <div
                    key={v.id}
                    className={`text-[10px] font-medium px-1 py-0.5 rounded truncate leading-tight ${ESTADO_CHIP[v.estado]}`}
                    title={`${v.hora ? v.hora.slice(0, 5) + ' · ' : ''}${localesMap[v.local_id] ?? v.local_id}`}
                  >
                    {v.hora ? v.hora.slice(0, 5) : '·'}{' '}
                    {(localesMap[v.local_id] ?? '–').split(' ').at(-1)}
                  </div>
                ))}
                {dvs.length > 2 && (
                  <div className="text-[10px] text-navy/35 pl-1">+{dvs.length - 2} más</div>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
