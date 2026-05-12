import { useState } from 'react'
import { getSession, logout } from './lib/auth'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Pagos from './pages/Pagos'
import Socios from './pages/Socios'
import Comite from './pages/Comite'

export default function App() {
  const [session, setSession] = useState(() => getSession())
  const [page, setPage] = useState('dashboard')

  function handleLogin(s) { setSession(s); setPage('dashboard') }
  function handleLogout() { logout(); setSession(null) }

  if (!session) return <Login onLogin={handleLogin} />

  const isAdmin = session.role === 'admin'

  const pages = {
    dashboard: <Dashboard />,
    pagos: isAdmin ? <Pagos /> : (
      <div className="content"><div className="card"><p style={{color:'var(--text-2)'}}>Acceso restringido.</p></div></div>
    ),
    socios: <Socios isAdmin={isAdmin} />,
    comite: <Comite />,
  }

  return (
    <div>
      {/* TOPBAR: marca + salir */}
      <div style={{background:'#1a5e3a',padding:'10px 1rem',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:100,boxShadow:'0 2px 8px rgba(0,0,0,.15)'}}>
        <div>
          <div style={{color:'#fff',fontWeight:600,fontSize:14,lineHeight:1.2}}>Club Atlético Independencia Fénix</div>
          <div style={{color:'rgba(255,255,255,.65)',fontSize:11}}>Sistema de gestión de cuotas</div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{background:'rgba(255,255,255,.15)',color:'#fff',fontSize:11,padding:'3px 8px',borderRadius:6}}>
            {isAdmin ? 'Admin' : 'Comité'}
          </span>
          <button onClick={handleLogout} style={{background:'rgba(255,255,255,.15)',border:'1px solid rgba(255,255,255,.3)',borderRadius:6,color:'#fff',cursor:'pointer',fontSize:12,display:'flex',alignItems:'center',gap:5,padding:'6px 10px',fontFamily:'inherit'}}>
            <i className="ti ti-logout"></i>Salir
          </button>
        </div>
      </div>

      {/* NAV: botones de navegación en fila separada */}
      <div style={{background:'#155233',padding:'6px 8px',display:'flex',gap:4,overflowX:'auto',WebkitOverflowScrolling:'touch',position:'sticky',top:51,zIndex:99,boxShadow:'0 2px 4px rgba(0,0,0,.1)'}}>
        {[
          {key:'dashboard', icon:'ti-layout-dashboard', label:'Dashboard'},
          {key:'socios', icon:'ti-users', label:'Socios'},
          ...(isAdmin ? [{key:'pagos', icon:'ti-cash', label:'Pagos'}] : []),
          {key:'comite', icon:'ti-report', label:'Comité'},
        ].map(btn => (
          <button key={btn.key}
            onClick={() => setPage(btn.key)}
            style={{
              background: page === btn.key ? 'rgba(255,255,255,.2)' : 'transparent',
              border: page === btn.key ? '1px solid rgba(255,255,255,.4)' : '1px solid transparent',
              borderRadius: 6,
              color: page === btn.key ? '#fff' : 'rgba(255,255,255,.7)',
              cursor: 'pointer',
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '6px 12px',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}>
            <i className={`ti ${btn.icon}`}></i>{btn.label}
          </button>
        ))}
      </div>

      <div>{pages[page]}</div>
    </div>
  )
}
