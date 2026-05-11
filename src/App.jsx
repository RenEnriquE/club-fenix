import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Pagos from './pages/Pagos'
import Socios from './pages/Socios'
import Comite from './pages/Comite'

async function getUserRole(userId) {
  try {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single()
    return data?.role || 'comite'
  } catch { return 'comite' }
}

export default function App() {
  const [session, setSession] = useState(undefined)
  const [role, setRole] = useState(null)
  const [page, setPage] = useState('dashboard')

  useEffect(() => {
    // Check session immediately
    supabase.auth.getSession().then(async ({ data }) => {
      const s = data?.session || null
      setSession(s)
      if (s) {
        const r = await getUserRole(s.user.id)
        setRole(r)
      }
    }).catch(() => setSession(null))

    // Listen for auth changes (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, s) => {
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

  async function handleSignOut() {
    setSession(null)
    setRole(null)
    try { await supabase.auth.signOut() } catch {}
    try { localStorage.clear() } catch {}
  }

  const TopBar = ({ showNav = true }) => (
    <div className="topbar">
      <div className="topbar-brand">
        Club Atlético Independencia Fénix
        <span>Sistema de gestión de cuotas</span>
      </div>
      {showNav && session && (
        <nav className="nav">
          <button className={`nav-btn ${page==='dashboard'?'active':''}`} onClick={() => setPage('dashboard')}>
            <i className="ti ti-layout-dashboard"></i>Dashboard
          </button>
          <button className={`nav-btn ${page==='socios'?'active':''}`} onClick={() => setPage('socios')}>
            <i className="ti ti-users"></i>Socios
          </button>
          {role === 'admin' && (
            <button className={`nav-btn ${page==='pagos'?'active':''}`} onClick={() => setPage('pagos')}>
              <i className="ti ti-cash"></i>Pagos
            </button>
          )}
          <button className={`nav-btn ${page==='comite'?'active':''}`} onClick={() => setPage('comite')}>
            <i className="ti ti-report"></i>Comité
          </button>
        </nav>
      )}
      <div style={{display:'flex',alignItems:'center',gap:10,marginLeft:8}}>
        {session && role && (
          <span style={{background:'rgba(255,255,255,.15)',color:'#fff',fontSize:12,padding:'4px 10px',borderRadius:6,display:'flex',alignItems:'center',gap:5}}>
            <i className="ti ti-shield-check"></i>
            {role === 'admin' ? 'Admin' : 'Comité'}
          </span>
        )}
        <button onClick={handleSignOut}
          style={{background:'rgba(255,255,255,.15)',border:'1px solid rgba(255,255,255,.3)',borderRadius:6,color:'#fff',cursor:'pointer',fontSize:13,display:'flex',alignItems:'center',gap:6,padding:'5px 12px',fontFamily:'inherit'}}>
          <i className="ti ti-logout"></i>Salir
        </button>
      </div>
    </div>
  )

  // Loading session
  if (session === undefined) return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column'}}>
      <TopBar showNav={false} />
      <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:12,color:'#475569'}}>
        <div style={{width:28,height:28,border:'3px solid #e2e8f0',borderTopColor:'#1a5e3a',borderRadius:'50%',animation:'spin .7s linear infinite'}}></div>
        <span style={{fontSize:14}}>Iniciando sesión...</span>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )

  if (!session) return <Login />

  // Waiting for role after login — show app immediately with what we have
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
      <TopBar showNav={true} />
      <div>{pages[page]}</div>
    </div>
  )
}
