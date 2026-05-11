import { useState, useEffect } from 'react'
import { supabase, getUserRole, signOut } from './lib/supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Pagos from './pages/Pagos'
import Socios from './pages/Socios'
import Comite from './pages/Comite'

export default function App() {
  const [session, setSession] = useState(undefined)
  const [role, setRole] = useState(null)
  const [page, setPage] = useState('dashboard')

  useEffect(() => {
    let resolved = false

    supabase.auth.getSession().then(async ({ data }) => {
      if (resolved) return
      resolved = true
      const s = data?.session || null
      setSession(s)
      if (s) {
        const r = await getUserRole(s.user.id)
        setRole(r)
      }
    }).catch(() => {
      if (!resolved) { resolved = true; setSession(null) }
    })

    const fallback = setTimeout(() => {
      if (!resolved) { resolved = true; setSession(null) }
    }, 10000)

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, s) => {
      resolved = true
      clearTimeout(fallback)
      setSession(s)
      if (s) {
        const r = await getUserRole(s.user.id)
        setRole(r)
      } else {
        setRole(null)
      }
    })

    return () => { clearTimeout(fallback); subscription.unsubscribe() }
  }, [])

  if (session === undefined) return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'100vh',gap:12,fontFamily:'Inter,sans-serif',color:'#475569'}}>
      <div style={{width:28,height:28,border:'3px solid #e2e8f0',borderTopColor:'#1a5e3a',borderRadius:'50%',animation:'spin .7s linear infinite'}}></div>
      <span style={{fontSize:14}}>Iniciando...</span>
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
        <div style={{display:'flex',alignItems:'center',gap:10,marginLeft:8}}>
          <span style={{background:'rgba(255,255,255,.15)',color:'#fff',fontSize:12,padding:'4px 10px',borderRadius:6,display:'flex',alignItems:'center',gap:5}}>
            <i className="ti ti-shield-check"></i>
            {role === 'admin' ? 'Admin' : 'Comité'}
          </span>
          <button
            onClick={async () => { await signOut(); setSession(null); setRole(null) }}
            style={{background:'rgba(255,255,255,.15)',border:'1px solid rgba(255,255,255,.3)',borderRadius:6,color:'#fff',cursor:'pointer',fontSize:13,display:'flex',alignItems:'center',gap:6,padding:'5px 12px',fontFamily:'inherit'}}>
            <i className="ti ti-logout"></i>Salir
          </button>
        </div>
      </div>
      <div>{pages[page]}</div>
    </div>
  )
}
