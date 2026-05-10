import { useState, useEffect } from 'react'
import { supabase, getSession, getUserRole, signOut } from './lib/supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Pagos from './pages/Pagos'
import Socios from './pages/Socios'
import Comite from './pages/Comite'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export default function App() {
  const [session, setSession] = useState(null)
  const [role, setRole] = useState(null)
  const [page, setPage] = useState('dashboard')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, s) => {
      setSession(s)
      if (s) {
        const r = await getUserRole(s.user.id)
        setRole(r)
      } else {
        setRole(null)
      }
      setLoading(false)
    })
    // Trigger initial session check
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!s) setLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return (
    <div className="loading-center" style={{minHeight:'100vh'}}>
      <div className="spinner"></div>
      <span>Cargando...</span>
    </div>
  )

  if (!session) return <Login />

  const isAdmin = role === 'admin'

  const pages = {
    dashboard: <Dashboard />,
    pagos: isAdmin ? <Pagos /> : <div className="content"><div className="card"><p style={{color:'var(--text-2)'}}>Acceso restringido a administradores.</p></div></div>,
    socios: <Socios isAdmin={isAdmin} />,
    comite: <Comite />,
  }

  return (
    <div>
      <div className="topbar">
        <div className="topbar-brand">
          Club Atlético Independencia Fénix
          <span>Sistema de gestión de cuotas</span>
        </div>
        <nav className="nav">
          <button className={`nav-btn ${page==='dashboard'?'active':''}`} onClick={() => setPage('dashboard')}>
            <i className="ti ti-layout-dashboard"></i>Dashboard
          </button>
          {isAdmin && (
            <button className={`nav-btn ${page==='pagos'?'active':''}`} onClick={() => setPage('pagos')}>
              <i className="ti ti-cash"></i>Pagos
            </button>
          )}
          <button className={`nav-btn ${page==='socios'?'active':''}`} onClick={() => setPage('socios')}>
            <i className="ti ti-users"></i>Socios
          </button>
          <button className={`nav-btn ${page==='comite'?'active':''}`} onClick={() => setPage('comite')}>
            <i className="ti ti-report"></i>Comité
          </button>
        </nav>
        <div className="topbar-user">
          <span className="chip" style={{background:'rgba(255,255,255,.15)',color:'#fff'}}>
            <i className="ti ti-shield-check"></i>{role === 'admin' ? 'Admin' : 'Comité'}
          </span>
          <button
            onClick={() => signOut()}
            style={{background:'transparent',border:'none',color:'rgba(255,255,255,.7)',cursor:'pointer',fontSize:'13px',display:'flex',alignItems:'center',gap:'4px'}}
          >
            <i className="ti ti-logout"></i>
          </button>
        </div>
      </div>
      <div>{pages[page]}</div>
    </div>
  )
}
