// Sistema de autenticacion - Club Atletico Independencia Fenix
// Actualizado: contrasena admin cambiada
const USERS = [
  { email: 'renenrique@gmail.com', password: 'Xktkil', role: 'admin' },
  { email: 'contactoclubcaif@gmail.com', password: 'Comite2024', role: 'comite' },
]

const SESSION_KEY = 'fenix-session'

export function login(email, password) {
  const user = USERS.find(u =>
    u.email.toLowerCase() === email.toLowerCase().trim() &&
    u.password === password.trim()
  )
  if (!user) throw new Error('Credenciales incorrectas')
  const session = { email: user.email, role: user.role, ts: Date.now() }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  return session
}

export function logout() {
  localStorage.removeItem(SESSION_KEY)
}

export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const session = JSON.parse(raw)
    if (Date.now() - session.ts > 30 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(SESSION_KEY)
      return null
    }
    return session
  } catch {
    return null
  }
}
