import { useState, useEffect } from 'react'
import { supabase, getUserRole, signOut } from './lib/supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Pagos from './pages/Pagos'
import Socios from './pages/Socios'
import Comite from './pages/Comite'

export default function App() {
  const [session, setSession] = useState(null)
  const [role, setRole] = useState(null)
  const [page, setPage] = useState('dashboard')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session directly
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s)
      if (s) {
        const r = await getUserRole(s.user.id)
        setRole(r)
      }
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, s) => {
      setSession(s)
      if (s) {
        const r = await getUserRole(s.user.id)
        setRole(r)
      } else {
        setRole(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',gap:12,fontFamily:'Inter,sans-serif',color:'#475569'}}>
      <div style={{width:20,height:20,border:'2px solid #e2e8f0',borderTopColor:'#1a5e3a',borderRadius:'50%',animation:'spin .7s linear infinite'}}></div>
      <span>Cargando...</span>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (!session) return <Login />

  const isAdmin = role === 'admin'

  const pages = {
    dashboard: <Dashboard />,
    pagos: isAdmin ? <Pagos /> : (
      <div style={{padding:'1.5rem'}}>
        <div style={{background:'#fff',border:'0.5px solid #e2e8f0',borderRadius:12,padding:'1.25rem'}}>
          <p style={{color:'#475569'}}>Acceso restringido a administradores.</p>
        </div>
      </div>
    ),
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
