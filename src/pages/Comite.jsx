import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { MESES, MESES_SHORT, estadoSocio, formatMoney } from '../lib/helpers'

export default function Comite() {
  const [personas, setPersonas] = useState([])
  const [pagos, setPagos] = useState([])
  const [loading, setLoading] = useState(true)
  const [anio, setAnio] = useState(new Date().getFullYear())
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      supabase.from('personas').select('id_caif,nombre_comp,atleta').eq('vigente', 1).order('nombre_comp'),
      supabase.from('pagos').select('id_socio,mes,monto,anio').eq('anio', anio)
    ]).then(([resP, resPg]) => {
      setPersonas(resP.data || [])
      setPagos(resPg.data || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [anio, intento])

  const anioActual = new Date().getFullYear()
  const mesActual = new Date().getMonth() + 1

  const lista = personas.filter(p => {
    const matchT = !filtroTipo || p.atleta === filtroTipo
    const est = estadoSocio(p.id_caif, pagos)
    const matchE = !filtroEstado || est === filtroEstado
    return matchT && matchE
  })

  const total = personas.length
  const alDia = personas.filter(p => estadoSocio(p.id_caif, pagos) === 'al-dia').length
  const ingTotal = pagos.reduce((a, p) => a + (p.monto || 0), 0)
  const pct = total > 0 ? Math.round(alDia / total * 100) : 0

  return (
    <div className="content">
      <div className="card">
        <div className="card-title"><i className="ti ti-report-analytics"></i>Informe para comité revisor</div>

        <div className="kpi-grid" style={{marginBottom:'1.5rem'}}>
          {[
            {label:'Total socios', val:total},
            {label:'Al día', val:alDia},
            {label:'Total recaudado', val:formatMoney(ingTotal), small:true},
            {label:'% cumplimiento', val:pct+'%'},
          ].map((k,i) => (
            <div key={i} className="kpi">
              <div className="kpi-label">{k.label}</div>
              <div className="kpi-value" style={k.small?{fontSize:18}:{}}>{k.val}</div>
            </div>
          ))}
        </div>

        <hr className="divider"/>

        <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
          <div style={{display:'flex',gap:4}}>
            {[2024,2025,2026].map(a => (
              <button key={a} className={`year-tab ${a===anio?'active':''}`} onClick={() => setAnio(a)}>{a}</button>
            ))}
          </div>
          <select value={filtroTipo} onChange={e=>setFiltroTipo(e.target.value)}
            style={{padding:'6px 10px',border:'0.5px solid #e2e8f0',borderRadius:8,fontSize:13,fontFamily:'inherit',background:'#fff'}}>
            <option value="">Todos los tipos</option>
            <option value="Atleta Adulto">Adultos</option>
            <option value="Atleta Niño">Niños</option>
          </select>
          <select value={filtroEstado} onChange={e=>setFiltroEstado(e.target.value)}
            style={{padding:'6px 10px',border:'0.5px solid #e2e8f0',borderRadius:8,fontSize:13,fontFamily:'inherit',background:'#fff'}}>
            <option value="">Todos los estados</option>
            <option value="al-dia">Al día</option>
            <option value="parcial">Parcial</option>
            <option value="moroso">Moroso</option>
          </select>
          <span style={{fontSize:12,color:'var(--text-3)',marginLeft:'auto'}}>{lista.length} socios · {anio}</span>
        </div>

        {loading ? (
          <div className="loading-center" style={{padding:'3rem'}}>
            <div className="spinner"></div><span style={{marginLeft:10}}>Cargando informe...</span>
          </div>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl" style={{fontSize:12}}>
              <thead>
                <tr>
                  <th style={{width:45}}>ID</th>
                  <th style={{minWidth:160}}>Nombre</th>
                  <th style={{width:50}}>Tipo</th>
                  {MESES_SHORT.map((m,i) => (
                    <th key={i} style={{width:30,textAlign:'center',
                      color: anio===anioActual && i+1===mesActual ? 'var(--accent)' : undefined}}>
                      {m}
                    </th>
                  ))}
                  <th style={{width:75,textAlign:'right'}}>Total</th>
                </tr>
              </thead>
              <tbody>
                {lista.map(s => {
                  const mesesPagados = pagos.filter(p => p.id_socio === s.id_caif).map(p => p.mes)
                  const totalSocio = pagos.filter(p => p.id_socio === s.id_caif).reduce((a,p) => a+(p.monto||0), 0)
                  return (
                    <tr key={s.id_caif}>
                      <td style={{color:'var(--text-3)'}}>{s.id_caif}</td>
                      <td style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:180}} title={s.nombre_comp}>
                        {s.nombre_comp}
                      </td>
                      <td>
                        <span className={`badge ${s.atleta==='Atleta Niño'?'nino':'adulto'}`} style={{fontSize:10}}>
                          {s.atleta==='Atleta Niño'?'N':'A'}
                        </span>
                      </td>
                      {MESES.map((_,i) => {
                        const pagado = mesesPagados.includes(i+1)
                        const esFuturo = anio===anioActual && i+1 > mesActual
                        return (
                          <td key={i} style={{textAlign:'center'}}>
                            {esFuturo
                              ? <span style={{color:'var(--text-3)',fontSize:10}}>—</span>
                              : pagado
                                ? <i className="ti ti-check" style={{fontSize:13,color:'var(--success)'}}></i>
                                : <i className="ti ti-x" style={{fontSize:13,color:'var(--danger)'}}></i>
                            }
                          </td>
                        )
                      })}
                      <td style={{textAlign:'right',fontWeight:600,color:'var(--success)'}}>{formatMoney(totalSocio)}</td>
                    </tr>
                  )
                })}
                <tr style={{background:'#f8fafc',fontWeight:600}}>
                  <td colSpan={3}>Total {anio}</td>
                  {MESES.map((_,i) => {
                    const cnt = pagos.filter(p => p.mes===i+1).length
                    return <td key={i} style={{textAlign:'center',fontSize:11,color:'var(--text-2)'}}>{cnt>0?cnt:''}</td>
                  })}
                  <td style={{textAlign:'right',color:'var(--success)'}}>{formatMoney(ingTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
