import { supabase } from './supabase'

function pathFromUrl(url: string): string {
  const marker = '/au-evidencias/'
  const idx = url.indexOf(marker)
  return idx >= 0 ? url.slice(idx + marker.length) : url
}

export async function eliminarAuditoria(auditoriaId: string): Promise<void> {
  const { data: evidencias, error: eEvid } = await supabase
    .from('au_evidencias')
    .select('url')
    .eq('auditoria_id', auditoriaId)
    .range(0, 9999)
  if (eEvid) throw eEvid

  const paths = (evidencias ?? []).map((e: { url: string }) => pathFromUrl(e.url))
  if (paths.length > 0) {
    const { error: eStorage } = await supabase.storage.from('au-evidencias').remove(paths)
    if (eStorage) throw eStorage
  }

  const { error: eDelete } = await supabase.from('au_auditorias').delete().eq('id', auditoriaId)
  if (eDelete) throw eDelete
}
