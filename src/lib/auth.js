// Sistema de autenticacion - Club Atletico Independencia Fenix v3
// Las cuentas viven en Supabase (tablas app_usuarios / app_sesiones, ver supabase_usuarios.sql).
// El navegador solo guarda un token de sesion; las claves nunca salen de la base de datos.
import { supabase } from './supabase'

const SESSION_KEY = 'fenix-session'
const SESSION_MAX_MS = 30 * 24 * 60 * 60 * 1000

function guardar(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export async function login(email, password) {
  const { data, error } = await supabase.rpc('app_login', {
    p_email: email.trim(),
    p_password: password.trim(),
  })
  if (error) throw new Error('No se pudo conectar. Intenta nuevamente.')
  if (!data?.ok) throw new Error(data?.error || 'Email o clave incorrectos.')
  const session = { email: data.email, role: data.role, nombre: data.nombre || null, token: data.token, ts: Date.now() }
  guardar(session)
  return session
}

export function logout() {
  const s = getSession()
  if (s?.token) supabase.rpc('app_logout', { p_token: s.token }).then(() => {}, () => {})
  localStorage.removeItem(SESSION_KEY)
}

export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const session = JSON.parse(raw)
    // Sesiones antiguas (sin token) ya no son validas: hay que volver a ingresar
    if (!session.token || Date.now() - session.ts > SESSION_MAX_MS) {
      localStorage.removeItem(SESSION_KEY)
      return null
    }
    return session
  } catch {
    return null
  }
}

// Valida la sesion contra la base de datos y registra actividad ("latido").
// Devuelve la sesion vigente (con rol actualizado) o null si ya no es valida.
// Ante un error de red conserva la sesion actual.
export async function verificarSesion() {
  const s = getSession()
  if (!s) return null
  const { data, error } = await supabase.rpc('app_session_check', { p_token: s.token })
  if (error) return s
  if (!data?.ok) {
    localStorage.removeItem(SESSION_KEY)
    return null
  }
  if (data.role !== s.role || (data.nombre || null) !== (s.nombre || null)) {
    const nueva = { ...s, role: data.role, nombre: data.nombre || null }
    guardar(nueva)
    return nueva
  }
  return s
}

// ---- Administracion de usuarios (el servidor valida que el token sea de un admin) ----
async function adminRpc(fn, params) {
  const s = getSession()
  if (!s) throw new Error('Sesion expirada')
  const { data, error } = await supabase.rpc(fn, { p_token: s.token, ...params })
  if (error) throw new Error(error.message)
  return data
}

export const listarUsuarios = () => adminRpc('app_admin_listar', {})
export const crearUsuario = ({ email, password, role, nombre }) =>
  adminRpc('app_admin_crear', { p_email: email, p_password: password, p_role: role, p_nombre: nombre || null })
export const cambiarClaveUsuario = (id, password) =>
  adminRpc('app_admin_cambiar_clave', { p_id: id, p_password: password })
export const setUsuarioActivo = (id, activo) =>
  adminRpc('app_admin_set_activo', { p_id: id, p_activo: activo })
export const cambiarRolUsuario = (id, role) =>
  adminRpc('app_admin_cambiar_rol', { p_id: id, p_role: role })
