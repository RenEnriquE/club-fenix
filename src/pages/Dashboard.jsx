import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { estadoSocio, mesesPendientes, MESES_SHORT, formatMoney } from '../lib/helpers'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend } from 'chart.js'
import { Bar, Doughnut } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend)

const CACHE_KEY = 'club-fenix-dashboard-v2'
const CACHE_TTL = 5 * 60 * 1000

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { data, ts } = JSON.parse(raw)
    if (Date.now() - ts > CACHE_TTL) return null
    return data
  } catch { return null }
}

function saveCache(data) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() })) } catch {}
}

const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DIAS_SEMANA = ['dom','lun','mar','mié','jue','vie','sáb']

export default function Dashboard() {
  const anio = new Date().getFullYear()
  const mesActual = new Date().getMonth() + 1
  const cached = loadCache()

  const [personas, setPersonas] = useState(cached?.personas || [])
  const [pagos, setPagos] = useState(cached?.pagos || [])
  const [loading, setLoading] = useState(!cached)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    if (!cached) setLoading(true)
    else setRefreshing(true)
    Promise.all([
      supabase.from('personas').select('id_caif,nombre_comp,atleta,fecha_nac,genero').eq('vigente', 1),
      supabase.from('pagos').select('id_socio,mes,monto,anio').eq('anio', anio)
    ]).then(([resP, resPg]) => {
      const p = resP.data || []
      const pg = resPg.data || []
      setPersonas(p); setPagos(pg)
      saveCache({ personas: p, pagos: pg })
      setLoading(false); setRefreshing(false)
    }).catch(() => {
      if (!cached) setError(true)
      setLoading(false); setRefreshing(false)
    })
  }, [intento])

  if (loading) return (
    <div className="content">
      <div className="loading-center" style={{flexDirection:'column',gap:12}}>
        <div className="spinner" style={{width:32,height:32,borderWidth:3}}></div>
        <span style={{fontSize:14,color:'var(--text-2)'}}>Cargando datos del club...</span>
        <span style={{fontSize:12,color:'var(--text-3)'}}>Esto puede tardar unos segundos</span>
      </div>
    </div>
  )

  if (error) return (
    <div className="content">
      <div className="card" style={{textAlign:'center',padding:'2.5rem'}}>
        <i className="ti ti-wifi-off" style={{fontSize:40,color:'#94a3b8',display:'block',marginBottom:12}}></i>
        <p style={{color:'#64748b',marginBottom:20}}>No se pudieron cargar los datos</p>
        <button className="btn primary" onClick={() => { setError(null); setLoading(true); setIntento(i=>i+1) }}>
          <i className="ti ti-refresh"></i>Reintentar
        </button>
      </div>
    </div>
  )

  // KPIs
  const alDia = personas.filter(p => estadoSocio(p.id_caif, pagos) === 'al-dia').length
  const morosos = personas.filter(p => estadoSocio(p.id_caif, pagos) === 'moroso').length
  const parcial = personas.filter(p => estadoSocio(p.id_caif, pagos) === 'parcial').length
  const ingTotal = pagos.reduce((a,p) => a+(p.monto||0), 0)
  const ingrMes = MESES_SHORT.map((_,i) => pagos.filter(p=>p.mes===i+1).reduce((a,p)=>a+(p.monto||0),0))

  // Morosos
  const morososList = personas
    .filter(p => estadoSocio(p.id_caif,pagos) !== 'al-dia')
    .sort((a,b) => mesesPendientes(b.id_caif,pagos)-mesesPendientes(a.id_caif,pagos))
    .slice(0,8)

  // Estadísticas
  const hoy = new Date()
  const calcEdad = fn => {
    if (!fn) return null
    const d = new Date(fn+'T12:00:00')
    let e = hoy.getFullYear()-d.getFullYear()
    const m = hoy.getMonth()-d.getMonth()
    if (m<0||(m===0&&hoy.getDate()<d.getDate())) e--
    return e
  }
  const adultos = personas.filter(p=>p.atleta==='Atleta Adulto').length
  const ninos = personas.filter(p=>p.atleta==='Atleta Niño').length
  const mujeres = personas.filter(p=>(p.genero||'').toLowerCase().includes('fem')).length
  const hombres = personas.filter(p=>(p.genero||'').toLowerCase().includes('masc')).length
  const masters = personas.filter(p=>{ const e=calcEdad(p.fecha_nac); return e!==null&&e>=40 }).length
  const pct = (n,d) => d ? Math.round(n/d*100) : 0

  // Cumpleaños
  const cumpleaneros = personas
    .filter(p => { if(!p.fecha_nac) return false; return new Date(p.fecha_nac+'T12:00:00').getMonth()+1===mesActual })
    .map(p => { const fn=new Date(p.fecha_nac+'T12:00:00'); return {...p,dia:fn.getDate(),diaSemana:DIAS_SEMANA[fn.getDay()]} })
    .sort((a,b)=>a.dia-b.dia)

  const statItems = [
    {label:'Atletas Adultos', val:adultos, pct:pct(adultos,personas.length), color:'#1d4ed8', bg:'#eff6ff', icon:'👤', sub:'del total'},
    {label:'Atletas Niños', val:ninos, pct:pct(ninos,personas.length), color:'#7c3aed', bg:'#fdf4ff', icon:'👦', sub:'del total'},
    {label:'Mujeres', val:mujeres, pct:pct(mujeres,personas.length), color:'#db2777', bg:'#fdf2f8', icon:'♀', sub:'del total'},
    {label:'Hombres', val:hombres, pct:pct(hombres,personas.length), color:'#0369a1', bg:'#f0f9ff', icon:'♂', sub:'del total'},
    {label:'Master +40 años', val:masters, pct:pct(masters,adultos), color:'#b45309', bg:'#fffbeb', icon:'🏆', sub:'de adultos'},
  ]

  return (
    <div className="content">
      {refreshing && (
        <div style={{display:'flex',alignItems:'center',gap:8,fontSize:12,color:'var(--text-3)',marginBottom:8,justifyContent:'flex-end'}}>
          <div className="spinner" style={{width:12,height:12,borderWidth:2}}></div>Actualizando...
        </div>
      )}

      {/* KPIs */}
      <div className="kpi-grid">
        {[
          {label:'Total socios activos', val:personas.length, sub:'vigentes', icon:'ti-users', cls:''},
          {label:'Al día', val:alDia, sub:`cuota ${anio} al corriente`, icon:'ti-circle-check', cls:'green'},
          {label:'Morosos', val:morosos, sub:`sin pago en ${anio}`, icon:'ti-alert-circle', cls:'red'},
          {label:'Pago parcial', val:parcial, sub:'meses pendientes', icon:'ti-clock', cls:'amber'},
          {label:`Ingresos ${anio}`, val:formatMoney(ingTotal), sub:'total recaudado', icon:'ti-coin', cls:'', small:true},
        ].map((k,i) => (
          <div key={i} className={`kpi ${k.cls}`}>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={k.small?{fontSize:20}:{}}>{k.val}</div>
            <div className="kpi-sub">{k.sub}</div>
            <i className={`ti ${k.icon} kpi-icon`}></i>
          </div>
        ))}
      </div>

      {/* Gráficos */}
      <div className="two-col">
        <div className="card">
          <div className="card-title"><i className="ti ti-chart-bar"></i>Ingresos mensuales {anio}</div>
          <div style={{position:'relative',height:200}}>
            <Bar data={{labels:MESES_SHORT,datasets:[{label:'Ingresos',data:ingrMes,backgroundColor:'#2e7d52',borderRadius:4}]}}
              options={{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
                scales:{y:{ticks:{callback:v=>'$'+v.toLocaleString('es-CL')},grid:{color:'rgba(0,0,0,.05)'}},x:{grid:{display:false},ticks:{font:{size:10}}}}}}/>
          </div>
        </div>
        <div className="card">
          <div className="card-title"><i className="ti ti-chart-pie"></i>Estado de socios</div>
          <div style={{position:'relative',height:200}}>
            <Doughnut data={{labels:['Al día','Moroso','Parcial'],datasets:[{data:[alDia,morosos,parcial],backgroundColor:['#16a34a','#dc2626','#d97706'],borderWidth:2}]}}
              options={{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{font:{size:12},padding:12}}},cutout:'62%'}}/>
          </div>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="card">
        <div className="card-title"><i className="ti ti-chart-dots"></i>Estadísticas del club</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:12}}>
          {statItems.map((s,i) => (
            <div key={i} style={{background:s.bg,borderRadius:10,padding:'12px 14px',border:`1px solid ${s.color}33`}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
                <span style={{fontSize:11,fontWeight:600,color:s.color,textTransform:'uppercase',letterSpacing:.04}}>{s.label}</span>
                <span style={{fontSize:18}}>{s.icon}</span>
              </div>
              <div style={{fontSize:28,fontWeight:700,color:s.color,lineHeight:1}}>{s.val}</div>
              <div style={{marginTop:8,height:5,borderRadius:999,background:'rgba(0,0,0,.08)',overflow:'hidden'}}>
                <div style={{height:'100%',width:`${s.pct}%`,background:s.color,borderRadius:999}}></div>
              </div>
              <div style={{fontSize:11,color:s.color,marginTop:4,fontWeight:500}}>{s.pct}% {s.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Morosos + Cumpleaños */}
      <div className="two-col">
        <div className="card">
          <div className="card-title"><i className="ti ti-alert-triangle"></i>Socios con pagos pendientes</div>
          {morososList.length===0
            ? <div className="empty"><i className="ti ti-circle-check"></i>Todos al día</div>
            : morososList.map(s => {
                const pend=mesesPendientes(s.id_caif,pagos)
                const estado=estadoSocio(s.id_caif,pagos)
                return (
                  <div className="moroso-row" key={s.id_caif}>
                    <span className="moroso-name">{s.nombre_comp}</span>
                    <span className={`badge ${s.atleta==='Atleta Niño'?'nino':'adulto'}`} style={{marginRight:6}}>{s.atleta==='Atleta Niño'?'Niño':'Adulto'}</span>
                    <span className={`badge ${estado}`} style={{marginRight:6}}>{estado==='parcial'?'Parcial':'Sin pago'}</span>
                    <span className="moroso-meses">{pend} mes{pend!==1?'es':''}</span>
                  </div>
                )
              })
          }
        </div>

        {cumpleaneros.length > 0 ? (
          <div className="card" style={{background:'linear-gradient(135deg,#fff9f0 0%,#fff0f5 50%,#f0f5ff 100%)',border:'1px solid #fde68a',position:'relative',overflow:'hidden'}}>
            <div style={{position:'absolute',top:8,right:16,fontSize:40,opacity:.08,userSelect:'none'}}>🎂</div>
            <div style={{position:'absolute',bottom:8,left:16,fontSize:30,opacity:.06,userSelect:'none'}}>🎈</div>
            <div style={{textAlign:'center',marginBottom:12}}>
              <div style={{fontSize:11,letterSpacing:2,color:'#92400e',fontWeight:700,textTransform:'uppercase',marginBottom:4}}>
                🎉 Cumpleaños Socios CAIF 🎉
              </div>
              <div style={{fontSize:16,fontWeight:700,color:'#1a5e3a'}}>
                {MESES_ES[mesActual-1]} · {anio}
              </div>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:4,maxHeight:300,overflowY:'auto'}}>
              {cumpleaneros.map(s => (
                <div key={s.id_caif} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 10px',borderRadius:7,background:'rgba(255,255,255,.75)',borderLeft:`3px solid ${s.atleta==='Atleta Niño'?'#a78bfa':'#6ee7b7'}`,fontSize:13}}>
                  <span style={{fontWeight:500,color:'#1e293b'}}>{s.nombre_comp}</span>
                  <span style={{color:'#64748b',fontSize:12,fontWeight:500,whiteSpace:'nowrap',marginLeft:8}}>
                    {s.diaSemana} {String(s.dia).padStart(2,'0')}/{String(mesActual).padStart(2,'0')}
                  </span>
                </div>
              ))}
            </div>
            <div style={{textAlign:'center',marginTop:10,fontSize:11,color:'#94a3b8'}}>
              {cumpleaneros.length} cumpleaños este mes
            </div>
          </div>
        ) : (
          <div className="card" style={{display:'flex',alignItems:'center',justifyContent:'center'}}>
            <div className="empty"><i className="ti ti-cake"></i>Sin cumpleaños este mes</div>
          </div>
        )}
      </div>
    </div>
  )
}
