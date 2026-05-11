import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://octfpmtbijskluyyppuh.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jdGZwbXRiaWpza2x1eXlwcHVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MjYxODUsImV4cCI6MjA5NDAwMjE4NX0.FXHTIxO5ReZxOnvomQ8YPd5tLL9pVWUUS_uv4p97kqM'

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    storageKey: 'club-fenix-auth',
    storage: window.localStorage,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  }
})

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  await supabase.auth.signOut()
}

export async function getUserRole(userId) {
  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .single()
  return data?.role || 'comite'
}

export async function getPersonas({ soloVigentes = false } = {}) {
  let q = supabase.from('personas').select('*').order('id_caif', { ascending: false })
  if (soloVigentes) q = q.eq('vigente', 1)
  const { data, error } = await q
  if (error) throw error
  return data
}

export async function searchPersonas(term) {
  const isNum = !isNaN(term) && term.trim() !== ''
  let q = supabase.from('personas').select('*').eq('vigente', 1).order('nombre_comp').limit(30)
  const t = term.trim()
  if (isNum) {
    q = q.or(`nombre_comp.ilike.%${t}%,apodo.ilike.%${t}%,nombre.ilike.%${t}%,seg_nombre.ilike.%${t}%,apellido.ilike.%${t}%,ap_mat.ilike.%${t}%,id_caif.eq.${t}`)
  } else {
    q = q.or(`nombre_comp.ilike.%${t}%,apodo.ilike.%${t}%,nombre.ilike.%${t}%,seg_nombre.ilike.%${t}%,apellido.ilike.%${t}%,ap_mat.ilike.%${t}%`)
  }
  const { data, error } = await q
  if (error) throw error
  return data
}

export async function insertPersona(p) {
  const { data, error } = await supabase.from('personas').insert([p]).select().single()
  if (error) throw error
  return data
}

export async function updatePersona(id, updates) {
  const { error } = await supabase.from('personas').update(updates).eq('id_caif', id)
  if (error) throw error
}

export async function getPagosBySocio(idSocio) {
  const { data, error } = await supabase.from('pagos').select('*').eq('id_socio', idSocio).order('periodo')
  if (error) throw error
  return data
}

export async function getPagosByAnio(anio) {
  const { data, error } = await supabase.from('pagos').select('*').eq('anio', anio).order('periodo')
  if (error) throw error
  return data
}

export async function insertPago(pago) {
  const { data, error } = await supabase.from('pagos').insert([pago]).select().single()
  if (error) throw error
  return data
}

export async function deletePago(idPago) {
  const { error } = await supabase.from('pagos').delete().eq('id_pago', idPago)
  if (error) throw error
}

export async function getResumenAnio(anio) {
  const { data, error } = await supabase.from('pagos').select('mes, monto, id_socio').eq('anio', anio)
  if (error) throw error
  return data
}

export async function getNextPagoId() {
  const { data } = await supabase.from('pagos').select('id_pago').order('id_pago', { ascending: false }).limit(1)
  return (data?.[0]?.id_pago || 0) + 1
}

export async function getSociosPorApoderado(apoderado, excludeId) {
  if (!apoderado) return []
  const { data, error } = await supabase
    .from('personas').select('*').eq('vigente', 1)
    .ilike('apoderado', `%${apoderado.trim()}%`)
    .neq('id_caif', excludeId).order('nombre_comp')
  if (error) return []
  return data
}

// ── Grupos de pago frecuentes ─────────────────────────────────────────
export async function getGruposFrecuentes(socioId) {
  const { data } = await supabase
    .from('grupos_pago')
    .select('*')
    .eq('socio_id', socioId)
    .order('veces', { ascending: false })
    .limit(5)
  return data || []
}

export async function guardarGrupoPago(socioIds, fecha) {
  // Para cada socio del grupo, guarda los otros como su grupo frecuente
  for (const id of socioIds) {
    const otrosIds = socioIds.filter(x => x !== id)
    if (otrosIds.length === 0) continue

    // Buscar si ya existe este grupo exacto para este socio
    const { data: existing } = await supabase
      .from('grupos_pago')
      .select('*')
      .eq('socio_id', id)
      .contains('grupo_ids', otrosIds)
      .limit(1)

    if (existing && existing.length > 0) {
      // Actualizar contador
      await supabase
        .from('grupos_pago')
        .update({ veces: existing[0].veces + 1, ultimo_pago: fecha })
        .eq('id', existing[0].id)
    } else {
      // Crear nuevo grupo
      await supabase
        .from('grupos_pago')
        .insert([{ socio_id: id, grupo_ids: otrosIds, veces: 1, ultimo_pago: fecha }])
    }
  }
}

export async function getPersonasByIds(ids) {
  if (!ids || ids.length === 0) return []
  const { data } = await supabase
    .from('personas')
    .select('*')
    .in('id_caif', ids)
    .eq('vigente', 1)
  return data || []
}
