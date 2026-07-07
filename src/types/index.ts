export type Rol           = 'AUDITOR' | 'DIRECTOR' | 'ADMIN'
export type Area          = 'PRODUCTO' | 'SERVICIO' | 'LOCAL'
export type Severidad     = 'NINGUNA' | 'LEVE' | 'MEDIA' | 'GRAVE' | 'EXTREMA'
export type EstadoVisita  = 'PROGRAMADA' | 'REALIZADA' | 'CANCELADA'

/** Modo de descuento cuando severidad = 'EXTREMA', solo elegible en áreas Producto/Servicio/Local. */
export type ExtremaModo   = 'PESO' | 'PORCENTAJE'

/** Los 3 aspectos del apartado 4 — Revisión Interna. */
export type AspectoRI     = 'RI_REVISION' | 'RI_ROTULACION' | 'RI_HIGIENE'

/** au_observaciones.area admite las áreas 1-3 y los 3 aspectos de Revisión Interna. */
export type AreaObservacion = Area | AspectoRI

/** au_evidencias.area admite las áreas 1-3 y 'REVISION_INTERNA' (una sola, con etiqueta por aspecto). */
export type AreaEvidencia   = Area | 'REVISION_INTERNA'

export interface AuUsuario {
  cut:    string
  nombre: string
  rol:    Rol
  activo: boolean
}

export interface AuMarca {
  id:         string
  nombre:     string
  es_carpeta: boolean
}

export interface AuLocal {
  id:                 string
  nombre:             string
  marca_id:           string
  direccion:          string | null
  encargado_nombre:   string | null
  encargado_cut:      string | null
  jefe_cocina_nombre: string | null
  jefe_cocina_cut:    string | null
  activo:             boolean
}

export interface AuDirectorLocal {
  id:           string
  director_cut: string
  local_id:     string
}

export interface AuPlato {
  id:     string
  nombre: string
  codigo: string | null
  activo: boolean
}

export interface AuPlatoLocal {
  id:       string
  plato_id: string
  local_id: string
}

export interface AuPlatoIngrediente {
  id:       string
  plato_id: string
  nombre:   string
  orden:    number
  activo:   boolean
}

export interface AuAuditoria {
  id:                   string
  local_id:             string
  auditor_cut:          string
  fecha:                string
  mesero_nombre:        string | null
  nota_producto:        number | null
  nota_servicio:        number | null
  nota_local:           number | null
  nota_total:           number | null
  oportunidad_producto: string | null
  oportunidad_servicio: string | null
  oportunidad_local:    string | null
  ri_revision_conforme:     boolean | null
  ri_rotulacion_conforme:   boolean | null
  ri_higiene_conforme:      boolean | null
  ri_revision_comentario:   string | null
  ri_rotulacion_comentario: string | null
  ri_higiene_comentario:    string | null
  descuento_ri:         number | null
  creado_en:            string
}

export interface AuAuditoriaProductoItem {
  id:                 string
  auditoria_id:       string
  plato_id:           string
  plato_nombre:       string
  ingrediente_nombre: string
  cumple:             boolean        // solo auditorías antiguas
  contiene:           boolean
  limpieza:           boolean
  peso_adecuado:      boolean
  combo_nombre:       string | null  // null = plato suelto
  slot_nombre:        string | null  // null = plato suelto
}

export type TipoTiempo = 'ENTRANTE' | 'PRINCIPAL' | 'BEBIDA' | 'POSTRE'

export interface AuConfigTiempos {
  id:       string
  local_id: string | null
  tipo:     TipoTiempo
  max_min:  number
}

export interface AuAuditoriaServicio {
  id:                      string
  auditoria_id:            string
  fid_speech:              boolean | null
  fid_nombre_camarero:     boolean | null
  fid_tarjeta:             boolean | null
  ups_bebidas:             boolean | null
  ups_meta_dia:            boolean | null
  pres_uniformes:          boolean | null
  pres_cabellos:           boolean | null
  pres_unas:               boolean | null
  pres_zapatos:            boolean | null
  pres_barba_o_maquillaje: boolean | null
  tiempo_entrante_min:     number | null
  tiempo_principal_min:    number | null
  tiempo_bebida_min:       number | null
  tiempo_postre_min:       number | null
  tiempo_entrante_ok:      boolean | null
  tiempo_principal_ok:     boolean | null
  tiempo_bebida_ok:        boolean | null
  tiempo_postre_ok:        boolean | null
}

export interface AuAuditoriaLocal {
  id:               string
  auditoria_id:     string
  cart_actualizada: boolean | null
  cart_completa:    boolean | null
  limp_sala:        boolean | null
  limp_banos:       boolean | null
  limp_barras:      boolean | null
  limp_cocina:      boolean | null
}

export interface AuObservacion {
  id:           string
  auditoria_id: string
  area:         AreaObservacion
  texto:        string
  severidad:    Severidad
  extrema_modo: ExtremaModo | null
}

export interface AuConfigSeveridad {
  severidad: Severidad
  descuento: number
}

export interface AuConfigRI {
  aspecto:       AspectoRI
  max_descuento: number
}

export interface AuEvidencia {
  id:           string
  auditoria_id: string
  area:         AreaEvidencia
  url:          string
  etiqueta:     string | null
}

export interface AuVisita {
  id:          string
  local_id:    string
  auditor_cut: string
  fecha:       string
  hora:        string | null
  hora_fin:    string | null
  estado:      EstadoVisita
  notas:       string | null
}

export interface AuCombo {
  id:     string
  nombre: string
  codigo: string | null
  activo: boolean
}

export interface AuComboSlot {
  id:       string
  combo_id: string
  nombre:   string
  orden:    number
}

export interface AuComboSlotOpcion {
  id:       string
  slot_id:  string
  plato_id: string
}

export interface AuComboLocal {
  id:       string
  combo_id: string
  local_id: string
}
