import { useState, type ReactNode } from 'react'
import { useAuditoriaStore, type ServicioDraft } from '../../store/auditoriaStore'
import ObservacionesEditor from './ObservacionesEditor'

type TimeKey = 'entrante' | 'principal' | 'bebida' | 'postre'
type Rango   = { min: number | ''; max: number | '' }

const TIEMPOS: { key: TimeKey; label: string }[] = [
  { key: 'entrante',  label: 'Entrante' },
  { key: 'principal', label: 'Plato principal' },
  { key: 'bebida',    label: 'Bebida' },
  { key: 'postre',    label: 'Postre' },
]

export default function SeccionServicio() {
  const { servicio, setServicio, mesero_nombre, setMeseroNombre } = useAuditoriaStore()

  // Rangos objetivo: solo para calcular _ok en el frontend, no se persisten en BD
  const [rangos, setRangos] = useState<Record<TimeKey, Rango>>({
    entrante:  { min: '', max: '' },
    principal: { min: '', max: '' },
    bebida:    { min: '', max: '' },
    postre:    { min: '', max: '' },
  })

  function toggle(field: keyof ServicioDraft) {
    setServicio({ [field]: !servicio[field] } as Partial<ServicioDraft>)
  }

  function setTiempoReal(key: TimeKey, val: string) {
    const n     = val === '' ? null : Number(val)
    const realK = `tiempo_${key}_min` as keyof ServicioDraft
    const okK   = `tiempo_${key}_ok`  as keyof ServicioDraft
    const { min, max } = rangos[key]
    const ok = n !== null && min !== '' && max !== ''
      ? n >= Number(min) && n <= Number(max)
      : false
    setServicio({ [realK]: n, [okK]: ok } as Partial<ServicioDraft>)
  }

  function setRango(key: TimeKey, field: 'min' | 'max', val: string) {
    const n       = val === '' ? '' : Number(val)
    const updated = { ...rangos[key], [field]: n }
    setRangos(r => ({ ...r, [key]: updated }))
    // Recalculate ok with the updated range
    const realK = `tiempo_${key}_min` as keyof ServicioDraft
    const okK   = `tiempo_${key}_ok`  as keyof ServicioDraft
    const real  = servicio[realK] as number | null
    const minV  = field === 'min' ? n : rangos[key].min
    const maxV  = field === 'max' ? n : rangos[key].max
    const ok    = real !== null && minV !== '' && maxV !== ''
      ? real >= Number(minV) && real <= Number(maxV)
      : false
    setServicio({ [okK]: ok } as Partial<ServicioDraft>)
  }

  return (
    <div className="rounded-2xl border-2 border-ambar/40 bg-ambar/5 p-5 mb-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-2.5 h-2.5 rounded-full bg-ambar" />
        <h3 className="text-sm font-bold text-navy uppercase tracking-wide">Servicio</h3>
      </div>

      {/* Mesero */}
      <div className="mb-5">
        <label className="block text-xs font-semibold text-navy/50 uppercase tracking-wide mb-1.5">
          Nombre del mesero
        </label>
        <input
          type="text"
          value={mesero_nombre}
          onChange={e => setMeseroNombre(e.target.value)}
          placeholder="Nombre del mesero auditado"
          className="w-full px-3 py-2 rounded-xl border border-navy/20 bg-white text-sm text-navy
                     placeholder:text-navy/25 focus:outline-none focus:ring-2 focus:ring-ambar/40
                     focus:border-ambar transition"
        />
      </div>

      {/* Fidelización */}
      <Group titulo="Fidelización">
        <Item label="Speech de bienvenida" checked={!!servicio.fid_speech}          onToggle={() => toggle('fid_speech')} />
        <Item label="Nombre del camarero"  checked={!!servicio.fid_nombre_camarero} onToggle={() => toggle('fid_nombre_camarero')} />
      </Group>

      {/* Upselling */}
      <Group titulo="Upselling">
        <Item label="Oferta de bebidas"      checked={!!servicio.ups_bebidas}  onToggle={() => toggle('ups_bebidas')} />
        <Item label="Comunicó meta del día"  checked={!!servicio.ups_meta_dia} onToggle={() => toggle('ups_meta_dia')} />
      </Group>

      {/* Presentación */}
      <Group titulo="Presentación">
        <Item label="Uniformes"           checked={!!servicio.pres_uniformes}          onToggle={() => toggle('pres_uniformes')} />
        <Item label="Cabellos recogidos"  checked={!!servicio.pres_cabellos}           onToggle={() => toggle('pres_cabellos')} />
        <Item label="Uñas cuidadas"       checked={!!servicio.pres_unas}               onToggle={() => toggle('pres_unas')} />
        <Item label="Zapatos adecuados"   checked={!!servicio.pres_zapatos}            onToggle={() => toggle('pres_zapatos')} />
        <Item label="Barba / Maquillaje"  checked={!!servicio.pres_barba_o_maquillaje} onToggle={() => toggle('pres_barba_o_maquillaje')} />
      </Group>

      {/* Tiempos */}
      <div className="mb-2">
        <p className="text-xs font-semibold text-navy/50 uppercase tracking-wide mb-3">
          Tiempos de atención (minutos)
        </p>
        <div className="space-y-3">
          {TIEMPOS.map(({ key, label }) => {
            const realK = `tiempo_${key}_min` as keyof ServicioDraft
            const okK   = `tiempo_${key}_ok`  as keyof ServicioDraft
            const real  = servicio[realK] as number | null
            const ok    = servicio[okK]   as boolean
            const rango = rangos[key]

            return (
              <div key={key} className="grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-2 items-end">
                <p className="text-xs text-navy/50 pb-1.5 w-24">{label}</p>
                <NumInput
                  label="Real"
                  value={real ?? ''}
                  onChange={v => setTiempoReal(key, v)}
                  placeholder="min"
                />
                <NumInput
                  label="Obj. mín"
                  value={rango.min}
                  onChange={v => setRango(key, 'min', v)}
                  placeholder="0"
                  muted
                />
                <NumInput
                  label="Obj. máx"
                  value={rango.max}
                  onChange={v => setRango(key, 'max', v)}
                  placeholder="∞"
                  muted
                />
                <div className="pb-1 flex items-center justify-center w-7">
                  {real !== null
                    ? ok
                      ? <OkIcon ok />
                      : <OkIcon ok={false} />
                    : <span className="text-navy/20 text-xs">—</span>
                  }
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <ObservacionesEditor area="SERVICIO" />
    </div>
  )
}

/* ── Sub-components ─────────────────────────────────────────────────────── */

function Group({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="mb-4">
      <p className="text-xs font-semibold text-navy/40 uppercase tracking-wide mb-2">{titulo}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

function Item({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-left border transition ${
        checked
          ? 'bg-green-50 border-green-200 text-green-800'
          : 'bg-white border-navy/15 text-navy/60 hover:border-navy/30'
      }`}
    >
      <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
        checked ? 'bg-green-500 text-white' : 'border-2 border-navy/20'
      }`}>
        {checked && (
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </span>
      {label}
    </button>
  )
}

function NumInput({
  label, value, onChange, placeholder, muted,
}: {
  label: string; value: number | ''; onChange: (v: string) => void; placeholder?: string; muted?: boolean
}) {
  return (
    <div>
      <p className="text-xs text-navy/30 mb-1">{label}</p>
      <input
        type="number"
        min={0}
        step={0.5}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-2 py-1.5 text-sm rounded-lg border focus:outline-none transition
          focus:ring-2 focus:ring-ambar/30 placeholder:text-navy/20 ${
          muted
            ? 'border-navy/15 bg-white/70 text-navy/50'
            : 'border-navy/20 bg-white text-navy'
        }`}
      />
    </div>
  )
}

function OkIcon({ ok }: { ok: boolean }) {
  return (
    <span className={`inline-flex w-6 h-6 items-center justify-center rounded-full ${
      ok ? 'bg-green-500' : 'bg-terranova'
    } text-white`}>
      {ok
        ? <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
        : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
      }
    </span>
  )
}
