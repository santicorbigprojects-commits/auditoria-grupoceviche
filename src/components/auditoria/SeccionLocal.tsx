import { useAuditoriaStore, type LocalDraft } from '../../store/auditoriaStore'
import ObservacionesEditor from './ObservacionesEditor'
import EvidenciasUploader from './EvidenciasUploader'

export default function SeccionLocal() {
  const { localChecklist, setLocalChecklist, oportunidad_local, setOportunidad } = useAuditoriaStore()

  function toggle(field: keyof LocalDraft) {
    setLocalChecklist({ [field]: !localChecklist[field] } as Partial<LocalDraft>)
  }

  return (
    <div className="rounded-2xl border-2 border-navy/20 bg-navy/5 p-5 mb-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-2.5 h-2.5 rounded-full bg-navy" />
        <h3 className="text-sm font-bold text-navy uppercase tracking-wide">Local</h3>
      </div>

      <Group titulo="Cartelería">
        <Item label="Carta actualizada"    checked={localChecklist.cart_actualizada} onToggle={() => toggle('cart_actualizada')} />
        <Item label="Carta en buen estado" checked={localChecklist.cart_completa}    onToggle={() => toggle('cart_completa')} />
      </Group>

      <Group titulo="Limpieza">
        <Item label="Salón"   checked={localChecklist.limp_sala}   onToggle={() => toggle('limp_sala')} />
        <Item label="Baños"   checked={localChecklist.limp_banos}  onToggle={() => toggle('limp_banos')} />
        <Item label="Barra"   checked={localChecklist.limp_barras} onToggle={() => toggle('limp_barras')} />
        <Item label="Cocina"  checked={localChecklist.limp_cocina} onToggle={() => toggle('limp_cocina')} />
      </Group>

      <ObservacionesEditor area="LOCAL" />

      {/* Comentarios — texto libre, no puntúa */}
      <div className="mt-4 pt-4 border-t border-navy/10">
        <p className="text-xs font-semibold text-navy/40 uppercase tracking-wide mb-2">
          Comentarios
        </p>
        <textarea
          value={oportunidad_local}
          onChange={e => setOportunidad('LOCAL', e.target.value)}
          placeholder="Comentarios para Local…"
          rows={2}
          className="w-full text-sm px-3 py-2 rounded-xl border border-navy/15 bg-white resize-none
                     text-navy placeholder:text-navy/25
                     focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy/40 transition"
        />
      </div>

      <EvidenciasUploader area="LOCAL" />
    </div>
  )
}

function Group({ titulo, children }: { titulo: string; children: React.ReactNode }) {
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
