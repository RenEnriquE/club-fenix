import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://octfpmtbijskluyyppuh.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jdGZwbXRiaWpza2x1eXlwcHVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MjYxODUsImV4cCI6MjA5NDAwMjE4NX0.FXHTIxO5ReZxOnvomQ8YPd5tLL9pVWUUS_uv4p97kqM'

export const supabase = createClient(supabaseUrl, supabaseKey)

// ── Auth ──────────────────────────────────────────────────────────────
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  await supabase.auth.signOut()
}

export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}

export async function getUserRole(userId) {
  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .single()
  return data?.role || 'comite'
}

// ── Personas ──────────────────────────────────────────────────────────
export async function getPersonas({ soloVigentes = false } = {}) {
  let q = supabase.from('personas').select('*').order('id_caif', { ascending: false })
  if (soloVigentes) q = q.eq('vigente', 1)
  const { data, error } = await q
  if (error) throw error
  return data
}

export async function searchPersonas(term) {
  const isNum = !isNaN(term) && term.trim() !== ''
  let q = supabase
    .from('personas')
    .select('*')
    .eq('vigente', 1)
    .order('nombre_comp')
    .limit(30)

  if (isNum) {
    q = q.or(`nombre_comp.ilike.%${term}%,apodo.ilike.%${term}%,id_caif.eq.${term}`)
  } else {
    q = q.or(`nombre_comp.ilike.%${term}%,apodo.ilike.%${term}%`)
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

// ── Pagos ─────────────────────────────────────────────────────────────
export async function getPagosBySocio(idSocio) {
  const { data, error } = await supabase
    .from('pagos')
    .select('*')
    .eq('id_socio', idSocio)
    .order('periodo')
  if (error) throw error
  return data
}

export async function getPagosByAnio(anio) {
  const { data, error } = await supabase
    .from('pagos')
    .select('*')
    .eq('anio', anio)
    .order('periodo')
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
  const { data, error } = await supabase
    .from('pagos')
    .select('mes, monto, id_socio')
    .eq('anio', anio)
  if (error) throw error
  return data
}

export async function getNextPagoId() {
  const { data } = await supabase
    .from('pagos')
    .select('id_pago')
    .order('id_pago', { ascending: false })
    .limit(1)
  return (data?.[0]?.id_pago || 0) + 1
}
