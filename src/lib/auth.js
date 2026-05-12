// Sistema de autenticación simple y robusto
// Sin dependencia de Supabase Auth

const USERS = [
  { email: 'renenrique@gmail.com', password: 'admin2024Fenix!', role: 'admin' },
  { email: 'contactoclubcaif@gmail.com', password: 'comite2024Fenix!', role: 'comite' },
]

const SESSION_KEY = 'fenix-session'

export function login(email, password) {
  const user = USERS.find(u => 
    u.email.toLowerCase() === email.toLowerCase().trim() && 
    u.password === password
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
    // Sesión válida por 30 días
    if (Date.now() - session.ts > 30 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(SESSION_KEY)
      return null
    }
    return session
  } catch {
    return null
  }
}
