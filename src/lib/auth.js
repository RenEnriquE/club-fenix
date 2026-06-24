// Sistema de autenticacion - Club Atletico Independencia Fenix v2
const USERS = [
  { email: 'renenrique@gmail.com', password: 'fenix123', role: 'admin' },
  { email: 'contactoclubcaif@gmail.com', password: 'comite123', role: 'comite' },
  { email: 'faviohernan16@gmail.com', password: 'favio1234', role: 'coach' },
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
