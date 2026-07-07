import { create } from 'zustand'
import type { Area, Severidad, ExtremaModo, AspectoRI, AreaEvidencia } from '../types'

export interface EvidenciaDraft {
  path:      string           // nombre de archivo en el bucket (uuid.jpg)
  url:       string           // URL pública para mostrar
  etiqueta?: string           // etiqueta opcional
}

export interface ProductoItemDraft {
  plato_id:           string
  plato_nombre:       string
  ingrediente_nombre: string
  contiene:           boolean
  combo_nombre?:      string   // undefined = plato suelto
  slot_nombre?:       string   // undefined = plato suelto
}

export interface ObservacionDraft {
  id:            string   // UUID local para key de lista
  area:          Area | AspectoRI
  texto:         string
  severidad:     Severidad
  extrema_modo?: ExtremaModo | null   // solo aplica en áreas 1-3 con severidad EXTREMA
}

export interface ServicioDraft {
  fid_speech:              boolean
  fid_nombre_camarero:     boolean
  fid_tarjeta:             boolean
  ups_bebidas:             boolean
  ups_meta_dia:            boolean
  pres_uniformes:          boolean
  pres_cabellos:           boolean
  pres_unas:               boolean
  pres_zapatos:            boolean
  pres_barba_o_maquillaje: boolean
  tiempo_entrante_min:     number | null
  tiempo_principal_min:    number | null
  tiempo_bebida_min:       number | null
  tiempo_postre_min:       number | null
  tiempo_entrante_ok:      boolean
  tiempo_principal_ok:     boolean
  tiempo_bebida_ok:        boolean
  tiempo_postre_ok:        boolean
}

export interface LocalDraft {
  cart_actualizada: boolean
  cart_completa:    boolean
  limp_sala:        boolean
  limp_banos:       boolean
  limp_barras:      boolean
  limp_cocina:      boolean
}

const SERVICIO_INICIAL: ServicioDraft = {
  fid_speech:              false,
  fid_nombre_camarero:     false,
  fid_tarjeta:             false,
  ups_bebidas:             false,
  ups_meta_dia:            false,
  pres_uniformes:          false,
  pres_cabellos:           false,
  pres_unas:               false,
  pres_zapatos:            false,
  pres_barba_o_maquillaje: false,
  tiempo_entrante_min:     null,
  tiempo_principal_min:    null,
  tiempo_bebida_min:       null,
  tiempo_postre_min:       null,
  tiempo_entrante_ok:      false,
  tiempo_principal_ok:     false,
  tiempo_bebida_ok:        false,
  tiempo_postre_ok:        false,
}

const LOCAL_INICIAL: LocalDraft = {
  cart_actualizada: false,
  cart_completa:    false,
  limp_sala:        false,
  limp_banos:       false,
  limp_barras:      false,
  limp_cocina:      false,
}

const EVIDENCIAS_INICIAL: Record<AreaEvidencia, EvidenciaDraft[]> = {
  PRODUCTO:         [],
  SERVICIO:         [],
  LOCAL:            [],
  REVISION_INTERNA: [],
}

const RI_CONFORME_INICIAL: Record<AspectoRI, boolean> = {
  RI_REVISION:   false,
  RI_ROTULACION: false,
  RI_HIGIENE:    false,
}

const RI_COMENTARIO_INICIAL: Record<AspectoRI, string> = {
  RI_REVISION:   '',
  RI_ROTULACION: '',
  RI_HIGIENE:    '',
}

interface AuditoriaState {
  local_id:             string | null
  fecha:                string
  mesero_nombre:        string
  productoItems:        ProductoItemDraft[]
  servicio:             ServicioDraft
  localChecklist:       LocalDraft
  observaciones:        ObservacionDraft[]
  oportunidad_producto: string
  oportunidad_servicio: string
  oportunidad_local:    string
  evidencias:           Record<AreaEvidencia, EvidenciaDraft[]>
  riConforme:           Record<AspectoRI, boolean>
  riComentario:         Record<AspectoRI, string>

  setLocalId:        (id: string) => void
  setFecha:          (fecha: string) => void
  setMeseroNombre:   (nombre: string) => void
  setProductoItems:  (items: ProductoItemDraft[]) => void
  toggleCheck:       (plato_id: string, ingrediente_nombre: string, slot_nombre?: string) => void
  setServicio:       (patch: Partial<ServicioDraft>) => void
  setLocalChecklist: (patch: Partial<LocalDraft>) => void
  addObservacion:    (obs: Omit<ObservacionDraft, 'id'>) => void
  updateObservacion: (id: string, patch: Partial<ObservacionDraft>) => void
  removeObservacion: (id: string) => void
  setOportunidad:    (area: Area, texto: string) => void
  addEvidencia:          (area: AreaEvidencia, ev: EvidenciaDraft) => void
  removeEvidencia:       (area: AreaEvidencia, path: string) => void
  setEvidenciaEtiqueta:  (area: AreaEvidencia, path: string, etiqueta: string | undefined) => void
  setRiConforme:     (aspecto: AspectoRI, val: boolean) => void
  setRiComentario:   (aspecto: AspectoRI, texto: string) => void
  reset:             () => void
  loadFromDB: (data: {
    local_id:             string
    fecha:                string
    mesero_nombre:        string
    productoItems:        ProductoItemDraft[]
    servicio:             ServicioDraft
    localChecklist:       LocalDraft
    observaciones:        ObservacionDraft[]
    oportunidad_producto: string
    oportunidad_servicio: string
    oportunidad_local:    string
    evidencias:           Record<AreaEvidencia, EvidenciaDraft[]>
    riConforme?:          Record<AspectoRI, boolean>
    riComentario?:        Record<AspectoRI, string>
  }) => void
}

const hoy = () => new Date().toISOString().slice(0, 10)

export const useAuditoriaStore = create<AuditoriaState>()((set) => ({
  local_id:             null,
  fecha:                hoy(),
  mesero_nombre:        '',
  productoItems:        [],
  servicio:             { ...SERVICIO_INICIAL },
  localChecklist:       { ...LOCAL_INICIAL },
  observaciones:        [],
  oportunidad_producto: '',
  oportunidad_servicio: '',
  oportunidad_local:    '',
  evidencias:           { ...EVIDENCIAS_INICIAL, PRODUCTO: [], SERVICIO: [], LOCAL: [], REVISION_INTERNA: [] },
  riConforme:           { ...RI_CONFORME_INICIAL },
  riComentario:         { ...RI_COMENTARIO_INICIAL },

  setLocalId:      (id)     => set({ local_id: id }),
  setFecha:        (fecha)  => set({ fecha }),
  setMeseroNombre: (nombre) => set({ mesero_nombre: nombre }),
  setProductoItems:(items)  => set({ productoItems: items }),

  toggleCheck: (plato_id, ingrediente_nombre, slot_nombre) =>
    set((s) => ({
      productoItems: s.productoItems.map((i) =>
        i.plato_id === plato_id &&
        i.ingrediente_nombre === ingrediente_nombre &&
        i.slot_nombre === slot_nombre
          ? { ...i, contiene: !i.contiene }
          : i,
      ),
    })),

  setServicio: (patch) =>
    set((s) => ({ servicio: { ...s.servicio, ...patch } })),

  setLocalChecklist: (patch) =>
    set((s) => ({ localChecklist: { ...s.localChecklist, ...patch } })),

  addObservacion: (obs) =>
    set((s) => ({
      observaciones: [...s.observaciones, { ...obs, id: crypto.randomUUID() }],
    })),

  updateObservacion: (id, patch) =>
    set((s) => ({
      observaciones: s.observaciones.map((o) =>
        o.id === id ? { ...o, ...patch } : o,
      ),
    })),

  removeObservacion: (id) =>
    set((s) => ({
      observaciones: s.observaciones.filter((o) => o.id !== id),
    })),

  setOportunidad: (area, texto) =>
    set(area === 'PRODUCTO'
      ? { oportunidad_producto: texto }
      : area === 'SERVICIO'
      ? { oportunidad_servicio: texto }
      : { oportunidad_local: texto }),

  addEvidencia: (area, ev) =>
    set((s) => ({
      evidencias: {
        ...s.evidencias,
        [area]: [...s.evidencias[area], ev],
      },
    })),

  removeEvidencia: (area, path) =>
    set((s) => ({
      evidencias: {
        ...s.evidencias,
        [area]: s.evidencias[area].filter((e) => e.path !== path),
      },
    })),

  setEvidenciaEtiqueta: (area, path, etiqueta) =>
    set((s) => ({
      evidencias: {
        ...s.evidencias,
        [area]: s.evidencias[area].map((e) =>
          e.path === path ? { ...e, etiqueta } : e
        ),
      },
    })),

  setRiConforme: (aspecto, val) =>
    set((s) => ({ riConforme: { ...s.riConforme, [aspecto]: val } })),

  setRiComentario: (aspecto, texto) =>
    set((s) => ({ riComentario: { ...s.riComentario, [aspecto]: texto } })),

  reset: () =>
    set({
      local_id:             null,
      fecha:                hoy(),
      mesero_nombre:        '',
      productoItems:        [],
      servicio:             { ...SERVICIO_INICIAL },
      localChecklist:       { ...LOCAL_INICIAL },
      observaciones:        [],
      oportunidad_producto: '',
      oportunidad_servicio: '',
      oportunidad_local:    '',
      evidencias:           { PRODUCTO: [], SERVICIO: [], LOCAL: [], REVISION_INTERNA: [] },
      riConforme:           { ...RI_CONFORME_INICIAL },
      riComentario:         { ...RI_COMENTARIO_INICIAL },
    }),

  loadFromDB: (data) => set(data),
}))
