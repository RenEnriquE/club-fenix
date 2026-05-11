import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { estadoSocio, mesesPendientes, MESES_SHORT, formatMoney } from '../lib/helpers'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend } from 'chart.js'
import { Bar, Doughnut } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend)

export default function Dashboard() {
  const [personas, setPersonas] = useState([])
  const [pagos, setPagos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    setLoading(true)
    setError(null)
    const anio = new Date().getFullYear()

    Promise.all([
      supabase.from('personas').select('id_caif,nombre_comp,atleta').eq('vigente', 1),
      supabase.from('pagos').select('id_socio,mes,monto,anio').eq('anio', anio)
    ]).then(([resP, resPg]) => {
      setPersonas(resP.data || [])
      setPagos(resPg.data || [])
      setLoading(false)
    }).catch(() => {
      setError(true)
      setLoading(false)
    })
  }, [intento])

  if (loading) return (
    <div className="content">
      <div className="loading-center" style={{flexDirection:'column',gap:16}}>
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
        <p style={{color:'#64748b',marginBottom:6,fontWeight:500}}>No se pudieron cargar los datos</p>
        <p style={{color:'#94a3b8',fontSize:12,marginBottom:20}}>Verifica tu conexión a internet e intenta nuevamente</p>
        <button className="btn primary" onClick={() => setIntento(i => i+1)}>
          <i className="ti ti-refresh"></i>Reintentar
        </button>
      </div>
    </div>
  )

  const anioActual = new Date().getFullYear()
  const alDia = personas.filter(p => estadoSocio(p.id_caif, pagos) === 'al-dia').length
  const morosos = personas.filter(p => estadoSocio(p.id_caif, pagos) === 'moroso').length
  const parcial = personas.filter(p => estadoSocio(p.id_caif, pagos) === 'parcial').length
  const ingTotal = pagos.reduce((a, p) => a + (p.monto || 0), 0)
  const ingrMes = MESES_SHORT.map((_, i) => pagos.filter(p => p.mes === i+1).reduce((a,p) => a+(p.monto||0), 0))
  const morososList = personas
    .filter(p => estadoSocio(p.id_caif, pagos) !== 'al-dia')
    .sort((a,b) => mesesPendientes(b.id_caif, pagos) - mesesPendientes(a.id_caif, pagos))
    .slice(0, 8)

  return (
    <div className="content">
      <div className="kpi-grid">
        {[
          {label:'Total socios activos', val:personas.length, sub:'vigentes en el sistema', icon:'ti-users', cls:''},
          {label:'Al día', val:alDia, sub:`cuota ${anioActual} al corriente`, icon:'ti-circle-check', cls:'green'},
          {label:'Morosos', val:morosos, sub:`sin pago en ${anioActual}`, icon:'ti-alert-circle', cls:'red'},
          {label:'Pago parcial', val:parcial, sub:'meses pendientes', icon:'ti-clock', cls:'amber'},
          {label:`Ingresos ${anioActual}`, val:formatMoney(ingTotal), sub:'total recaudado', icon:'ti-coin', cls:'', small:true},
        ].map((k,i) => (
          <div key={i} className={`kpi ${k.cls}`}>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={k.small?{fontSize:20}:{}}>{k.val}</div>
            <div className="kpi-sub">{k.sub}</div>
            <i className={`ti ${k.icon} kpi-icon`}></i>
          </div>
        ))}
      </div>

      <div className="two-col">
        <div className="card">
          <div className="card-title"><i className="ti ti-chart-bar"></i>Ingresos mensuales {anioActual}</div>
          <div style={{position:'relative',height:200}}>
            <Bar
              data={{labels:MESES_SHORT,datasets:[{label:'Ingresos',data:ingrMes,backgroundColor:'#2e7d52',borderRadius:4}]}}
              options={{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
                scales:{y:{ticks:{callback:v=>'$'+v.toLocaleString('es-CL')},grid:{color:'rgba(0,0,0,.05)'}},x:{grid:{display:false},ticks:{font:{size:10}}}}}}
            />
          </div>
        </div>
        <div className="card">
          <div className="card-title"><i className="ti ti-chart-pie"></i>Estado de socios</div>
          <div style={{position:'relative',height:200}}>
            <Doughnut
              data={{labels:['Al día','Moroso','Parcial'],datasets:[{data:[alDia,morosos,parcial],backgroundColor:['#16a34a','#dc2626','#d97706'],borderWidth:2}]}}
              options={{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{font:{size:12},padding:12}}},cutout:'62%'}}
            />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title"><i className="ti ti-alert-triangle"></i>Socios con pagos pendientes</div>
        {morososList.length === 0
          ? <div className="empty"><i className="ti ti-circle-check"></i>Todos los socios están al día</div>
          : morososList.map(s => {
              const pend = mesesPendientes(s.id_caif, pagos)
              const estado = estadoSocio(s.id_caif, pagos)
              return (
                <div className="moroso-row" key={s.id_caif}>
                  <span className="moroso-name">{s.nombre_comp}</span>
                  <span className={`badge ${s.atleta==='Atleta Niño'?'nino':'adulto'}`} style={{marginRight:8}}>{s.atleta==='Atleta Niño'?'Niño':'Adulto'}</span>
                  <span className={`badge ${estado}`} style={{marginRight:8}}>{estado==='parcial'?'Parcial':'Sin pago'}</span>
                  <span className="moroso-meses">{pend} mes{pend!==1?'es':''} pendiente{pend!==1?'s':''}</span>
                </div>
              )
            })
        }
      </div>
    </div>
  )
}
