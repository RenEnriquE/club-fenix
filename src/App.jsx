import { useState } from 'react'
import { getSession, logout } from './lib/auth'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Pagos from './pages/Pagos'
import Socios from './pages/Socios'
import Comite from './pages/Comite'

export default function App() {
  const [session, setSession] = useState(() => getSession()) // lee localStorage sincrónicamente
  const [page, setPage] = useState('dashboard')

  function handleLogin(s) {
    setSession(s)
    setPage('dashboard')
  }

  function handleLogout() {
    logout()
    setSession(null)
  }

  if (!session) return <Login onLogin={handleLogin} />

  const isAdmin = session.role === 'admin'

  const pages = {
    dashboard: <Dashboard />,
    pagos: isAdmin ? <Pagos /> : (
      <div className="content">
        <div className="card"><p style={{color:'var(--text-2)'}}>Acceso restringido a administradores.</p></div>
      </div>
    ),
    socios: <Socios isAdmin={isAdmin} />,
    comite: <Comite />,
  }

  return (
    <div>
      <div className="topbar" style={{flexWrap:'wrap',height:'auto',minHeight:'var(--nav-h)',padding:'8px 1.25rem',gap:8}}>
        <div className="topbar-brand" style={{flex:'1 1 auto'}}>
          Club Atlético Independencia Fénix
          <span>Sistema de gestión de cuotas</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
          <span style={{background:'rgba(255,255,255,.15)',color:'#fff',fontSize:11,padding:'3px 8px',borderRadius:6,display:'flex',alignItems:'center',gap:4}}>
            <i className="ti ti-shield-check"></i>
            {isAdmin ? 'Admin' : 'Comité'}
          </span>
          <button onClick={handleLogout}
            style={{background:'rgba(255,255,255,.15)',border:'1px solid rgba(255,255,255,.3)',borderRadius:6,color:'#fff',cursor:'pointer',fontSize:12,display:'flex',alignItems:'center',gap:5,padding:'5px 10px',fontFamily:'inherit'}}>
            <i className="ti ti-logout"></i>Salir
          </button>
        </div>
        <nav className="nav" style={{width:'100%',borderTop:'1px solid rgba(255,255,255,.15)',paddingTop:6,flexWrap:'wrap',gap:2}}>
          <button className={`nav-btn ${page==='dashboard'?'active':''}`} onClick={() => setPage('dashboard')}>
            <i className="ti ti-layout-dashboard"></i>Dashboard
          </button>
          <button className={`nav-btn ${page==='socios'?'active':''}`} onClick={() => setPage('socios')}>
            <i className="ti ti-users"></i>Socios
          </button>
          {isAdmin && (
            <button className={`nav-btn ${page==='pagos'?'active':''}`} onClick={() => setPage('pagos')}>
              <i className="ti ti-cash"></i>Pagos
            </button>
          )}
          <button className={`nav-btn ${page==='comite'?'active':''}`} onClick={() => setPage('comite')}>
            <i className="ti ti-report"></i>Comité
          </button>
        </nav>
      </div>
      <div>{pages[page]}</div>
    </div>
  )
}
