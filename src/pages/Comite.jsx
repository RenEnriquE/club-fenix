import { useState, useEffect } from 'react'
import { getPersonas, getPagosByAnio } from '../lib/supabase'
import { MESES, MESES_SHORT, estadoSocio, formatMoney } from '../lib/helpers'

export default function Comite() {
  const [personas, setPersonas] = useState([])
  const [pagos, setPagos] = useState([])
  const [loading, setLoading] = useState(true)
  const [anio, setAnio] = useState(new Date().getFullYear())
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')

  useEffect(() => {
    cargar()
  }, [anio])

  async function cargar() {
    setLoading(true)
    const [p, pg] = await Promise.all([
      getPersonas({ soloVigentes: true }),
      getPagosByAnio(anio)
    ])
    setPersonas(p)
    setPagos(pg)
    setLoading(false)
  }

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

  if (loading) return (
    <div className="content"><div className="loading-center"><div className="spinner"></div><span>Cargando informe...</span></div></div>
  )

  return (
    <div className="content">
      <div className="card">
        <div className="card-title"><i className="ti ti-report-analytics"></i>Informe para comité revisor</div>

        <div className="kpi-grid" style={{marginBottom:'1.5rem'}}>
          <div className="kpi"><div className="kpi-label">Total socios</div><div className="kpi-value">{total}</div></div>
          <div className="kpi green"><div className="kpi-label">Al día</div><div className="kpi-value">{alDia}</div></div>
          <div className="kpi"><div className="kpi-label">Total recaudado</div><div className="kpi-value" style={{fontSize:18}}>{formatMoney(ingTotal)}</div></div>
          <div className="kpi"><div className="kpi-label">% cumplimiento</div><div className="kpi-value">{pct}%</div></div>
        </div>

        <hr className="divider" />

        <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
          <div style={{display:'flex',gap:4}}>
            {[2024, 2025, 2026].map(a => (
              <button key={a} className={`year-tab ${a === anio ? 'active' : ''}`} onClick={() => setAnio(a)}>{a}</button>
            ))}
          </div>
          <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
            style={{padding:'6px 10px',border:'0.5px solid #e2e8f0',borderRadius:8,fontSize:13,fontFamily:'inherit',background:'#fff'}}>
            <option value="">Todos los tipos</option>
            <option value="Atleta Adulto">Adultos</option>
            <option value="Atleta Niño">Niños</option>
          </select>
          <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
            style={{padding:'6px 10px',border:'0.5px solid #e2e8f0',borderRadius:8,fontSize:13,fontFamily:'inherit',background:'#fff'}}>
            <option value="">Todos los estados</option>
            <option value="al-dia">Al día</option>
            <option value="parcial">Parcial</option>
            <option value="moroso">Moroso</option>
          </select>
          <span style={{fontSize:12,color:'var(--text-3)',marginLeft:'auto'}}>{lista.length} socios · {anio}</span>
        </div>

        <div className="tbl-wrap">
          <table className="tbl" style={{fontSize:12}}>
            <thead>
              <tr>
                <th style={{width:45}}>ID</th>
                <th style={{minWidth:160}}>Nombre</th>
                <th style={{width:60}}>Tipo</th>
                {MESES_SHORT.map((m, i) => (
                  <th key={i} style={{width:30,textAlign:'center',
                    color: anio === anioActual && i + 1 === mesActual ? 'var(--accent)' : undefined}}>
                    {m}
                  </th>
                ))}
                <th style={{width:70,textAlign:'right'}}>Total</th>
              </tr>
            </thead>
            <tbody>
              {lista.map(s => {
                const mesesPagados = pagos.filter(p => p.id_socio === s.id_caif).map(p => p.mes)
                const totalSocio = pagos.filter(p => p.id_socio === s.id_caif).reduce((a, p) => a + (p.monto || 0), 0)
                return (
                  <tr key={s.id_caif}>
                    <td style={{color:'var(--text-3)'}}>{s.id_caif}</td>
                    <td style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:180}} title={s.nombre_comp}>
                      {s.nombre_comp}
                    </td>
                    <td>
                      <span className={`badge ${s.atleta === 'Atleta Niño' ? 'nino' : 'adulto'}`} style={{fontSize:10}}>
                        {s.atleta === 'Atleta Niño' ? 'N' : 'A'}
                      </span>
                    </td>
                    {MESES.map((_, i) => {
                      const pagado = mesesPagados.includes(i + 1)
                      const esFuturo = anio === anioActual && i + 1 > mesActual
                      return (
                        <td key={i} style={{textAlign:'center'}}>
                          {esFuturo ? (
                            <span style={{color:'var(--text-3)',fontSize:10}}>—</span>
                          ) : pagado ? (
                            <i className="ti ti-check" style={{fontSize:13,color:'var(--success)'}}></i>
                          ) : (
                            <i className="ti ti-x" style={{fontSize:13,color:'var(--danger)'}}></i>
                          )}
                        </td>
                      )
                    })}
                    <td style={{textAlign:'right',fontWeight:600,color:'var(--success)'}}>{formatMoney(totalSocio)}</td>
                  </tr>
                )
              })}
              <tr style={{background:'#f8fafc',fontWeight:600}}>
                <td colSpan={3}>Total {anio}</td>
                {MESES.map((_, i) => {
                  const cnt = pagos.filter(p => p.mes === i + 1).length
                  return <td key={i} style={{textAlign:'center',fontSize:11,color:'var(--text-2)'}}>{cnt > 0 ? cnt : ''}</td>
                })}
                <td style={{textAlign:'right',color:'var(--success)'}}>{formatMoney(ingTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
