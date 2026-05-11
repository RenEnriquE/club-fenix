import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { formatMoney } from '../lib/helpers'

const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const MESES_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

// Generar lista de períodos desde 2024-01 hasta hoy + 6 meses
function generarPeriodos() {
  const periodos = []
  const inicio = { anio: 2024, mes: 1 }
  const hoy = new Date()
  const fin = { anio: hoy.getFullYear(), mes: Math.min(hoy.getMonth() + 2, 12) }
  let { anio, mes } = inicio
  while (anio < fin.anio || (anio === fin.anio && mes <= fin.mes)) {
    periodos.push({ valor: anio * 100 + mes, label: `${MESES_ES[mes-1]} ${anio}`, anio, mes })
    mes++
    if (mes > 12) { mes = 1; anio++ }
  }
  return periodos
}

const PERIODOS = generarPeriodos()

// Generar columnas entre dos períodos
function columnaEntre(desde, hasta) {
  const cols = []
  let { anio, mes } = { anio: Math.floor(desde/100), mes: desde % 100 }
  const finAnio = Math.floor(hasta/100), finMes = hasta % 100
  while (anio < finAnio || (anio === finAnio && mes <= finMes)) {
    cols.push({ periodo: anio * 100 + mes, anio, mes, label: `${MESES_SHORT[mes-1]} ${String(anio).slice(2)}` })
    mes++
    if (mes > 12) { mes = 1; anio++ }
  }
  return cols
}

export default function Comite() {
  const hoy = new Date()
  const defaultDesde = (hoy.getFullYear() - 1) * 100 + (hoy.getMonth() + 1) // hace 12 meses aprox
  const defaultHasta = hoy.getFullYear() * 100 + (hoy.getMonth() + 1)

  const [desde, setDesde] = useState(defaultDesde)
  const [hasta, setHasta] = useState(defaultHasta)
  const [filtroVigente, setFiltroVigente] = useState('1') // '1'=activos, '0'=inactivos, ''=todos
  const [filtroTipo, setFiltroTipo] = useState('')
  const [personas, setPersonas] = useState([])
  const [pagos, setPagos] = useState([])
  const [loading, setLoading] = useState(true)
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    setLoading(true)
    // Obtener años del rango para filtrar pagos
    const anioDesde = Math.floor(desde / 100)
    const anioHasta = Math.floor(hasta / 100)
    const anios = []
    for (let a = anioDesde; a <= anioHasta; a++) anios.push(a)

    Promise.all([
      supabase.from('personas').select('id_caif,nombre_comp,rut,atleta,vigente,fecha_nac').order('nombre_comp'),
      supabase.from('pagos').select('id_socio,periodo,mes,anio,monto')
        .gte('periodo', desde)
        .lte('periodo', hasta)
    ]).then(([resP, resPg]) => {
      setPersonas(resP.data || [])
      setPagos(resPg.data || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [intento, desde, hasta])

  const columnas = columnaEntre(desde, hasta)

  const lista = personas.filter(p => {
    const matchV = filtroVigente === '' || String(p.vigente) === filtroVigente
    const matchT = !filtroTipo || p.atleta === filtroTipo
    return matchV && matchT
  })

  // Calcular totales por columna
  const totalesCols = columnas.map(col => {
    return lista.reduce((sum, p) => {
      const pago = pagos.find(pg => pg.id_socio === p.id_caif && pg.periodo === col.periodo)
      return sum + (pago ? pago.monto : 0)
    }, 0)
  })
  const totalGeneral = totalesCols.reduce((a, b) => a + b, 0)

  // KPIs del rango
  const totalSocios = lista.length
  const sociosConPago = lista.filter(p => pagos.some(pg => pg.id_socio === p.id_caif)).length
  const ingTotalRango = pagos.filter(pg => lista.some(p => p.id_caif === pg.id_socio)).reduce((a,p) => a + (p.monto||0), 0)

  return (
    <div className="content">
      <div className="card">
        <div className="card-title"><i className="ti ti-report-analytics"></i>Informe para comité revisor</div>

        {/* Filtros */}
        <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'flex-end',marginBottom:16}}>
          <div className="form-group" style={{minWidth:160}}>
            <label>Desde</label>
            <select value={desde} onChange={e=>setDesde(Number(e.target.value))}
              style={{padding:'7px 10px',border:'0.5px solid #e2e8f0',borderRadius:8,fontSize:13,fontFamily:'inherit',background:'#fff'}}>
              {PERIODOS.map(p=><option key={p.valor} value={p.valor}>{p.label}</option>)}
            </select>
          </div>
          <div className="form-group" style={{minWidth:160}}>
            <label>Hasta</label>
            <select value={hasta} onChange={e=>setHasta(Number(e.target.value))}
              style={{padding:'7px 10px',border:'0.5px solid #e2e8f0',borderRadius:8,fontSize:13,fontFamily:'inherit',background:'#fff'}}>
              {PERIODOS.map(p=><option key={p.valor} value={p.valor}>{p.label}</option>)}
            </select>
          </div>
          <div className="form-group" style={{minWidth:140}}>
            <label>Socios</label>
            <select value={filtroVigente} onChange={e=>setFiltroVigente(e.target.value)}
              style={{padding:'7px 10px',border:'0.5px solid #e2e8f0',borderRadius:8,fontSize:13,fontFamily:'inherit',background:'#fff'}}>
              <option value="1">Solo vigentes</option>
              <option value="0">Solo inactivos</option>
              <option value="">Todos</option>
            </select>
          </div>
          <div className="form-group" style={{minWidth:140}}>
            <label>Tipo</label>
            <select value={filtroTipo} onChange={e=>setFiltroTipo(e.target.value)}
              style={{padding:'7px 10px',border:'0.5px solid #e2e8f0',borderRadius:8,fontSize:13,fontFamily:'inherit',background:'#fff'}}>
              <option value="">Todos</option>
              <option value="Atleta Adulto">Adultos</option>
              <option value="Atleta Niño">Niños</option>
            </select>
          </div>
          {!loading && (
            <div style={{marginLeft:'auto',fontSize:12,color:'var(--text-3)',alignSelf:'center'}}>
              {lista.length} socios · {columnas.length} meses
            </div>
          )}
        </div>

        {/* KPIs del rango */}
        {!loading && (
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:10,marginBottom:16}}>
            {[
              {label:'Socios en el rango', val:totalSocios, color:'#1a5e3a'},
              {label:'Con algún pago', val:sociosConPago, color:'#16a34a'},
              {label:'Sin pagos', val:totalSocios-sociosConPago, color:'#dc2626'},
              {label:'Total recaudado', val:formatMoney(ingTotalRango), color:'#1d4ed8', small:true},
            ].map((k,i)=>(
              <div key={i} style={{background:'#f8fafc',border:'0.5px solid #e2e8f0',borderRadius:10,padding:'10px 14px'}}>
                <div style={{fontSize:11,color:'#64748b',fontWeight:600,textTransform:'uppercase',letterSpacing:.03,marginBottom:4}}>{k.label}</div>
                <div style={{fontSize:k.small?16:24,fontWeight:700,color:k.color}}>{k.val}</div>
              </div>
            ))}
          </div>
        )}

        <hr className="divider"/>

        {loading ? (
          <div className="loading-center" style={{padding:'3rem'}}>
            <div className="spinner"></div><span style={{marginLeft:10}}>Cargando informe...</span>
          </div>
        ) : desde > hasta ? (
          <div className="empty"><i className="ti ti-alert-circle"></i>El período inicial debe ser anterior al final</div>
        ) : columnas.length > 24 ? (
          <div className="empty" style={{color:'var(--warning)'}}>
            <i className="ti ti-alert-triangle"></i>
            El rango seleccionado tiene {columnas.length} meses. Selecciona un rango de máximo 24 meses para mejor visualización.
          </div>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl" style={{fontSize:11}}>
              <thead>
                <tr>
                  <th style={{width:30,position:'sticky',left:0,background:'#f8fafc',zIndex:2}}>ID</th>
                  <th style={{minWidth:160,position:'sticky',left:30,background:'#f8fafc',zIndex:2}}>Nombre</th>
                  <th style={{width:55}}>RUT</th>
                  <th style={{width:50}}>Tipo</th>
                  {columnas.map(col=>(
                    <th key={col.periodo} style={{width:52,textAlign:'right',whiteSpace:'nowrap'}}>
                      {col.label}
                    </th>
                  ))}
                  <th style={{width:80,textAlign:'right',fontWeight:700,background:'#f0fdf4',color:'#16a34a'}}>
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {lista.map(s => {
                  const pagosSocio = pagos.filter(pg => pg.id_socio === s.id_caif)
                  const totalSocio = pagosSocio
                    .filter(pg => pg.periodo >= desde && pg.periodo <= hasta)
                    .reduce((a,p) => a+(p.monto||0), 0)
                  return (
                    <tr key={s.id_caif} style={{opacity: s.vigente !== 1 ? 0.65 : 1}}>
                      <td style={{position:'sticky',left:0,background: s.vigente!==1?'#fafafa':'#fff',color:'var(--text-3)',zIndex:1}}>{s.id_caif}</td>
                      <td style={{position:'sticky',left:30,background: s.vigente!==1?'#fafafa':'#fff',fontWeight:500,zIndex:1,maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={s.nombre_comp}>
                        {s.nombre_comp}
                        {s.vigente!==1 && <span style={{marginLeft:5,fontSize:10,color:'#94a3b8'}}>(inactivo)</span>}
                      </td>
                      <td style={{color:'var(--text-3)',fontSize:10}}>{s.rut}</td>
                      <td>
                        <span className={`badge ${s.atleta==='Atleta Niño'?'nino':'adulto'}`} style={{fontSize:9}}>
                          {s.atleta==='Atleta Niño'?'N':'A'}
                        </span>
                      </td>
                      {columnas.map(col => {
                        const pago = pagosSocio.find(pg => pg.periodo === col.periodo)
                        return (
                          <td key={col.periodo} style={{textAlign:'right',color: pago ? '#16a34a' : '#e2e8f0'}}>
                            {pago ? `$${(pago.monto/1000).toFixed(0)}k` : '—'}
                          </td>
                        )
                      })}
                      <td style={{textAlign:'right',fontWeight:700,color:totalSocio>0?'#16a34a':'var(--text-3)',background:'#f0fdf4'}}>
                        {totalSocio > 0 ? formatMoney(totalSocio) : '—'}
                      </td>
                    </tr>
                  )
                })}
                {/* Fila totales */}
                <tr style={{background:'#f0fdf4',fontWeight:700,fontSize:12}}>
                  <td colSpan={4} style={{position:'sticky',left:0,background:'#f0fdf4',color:'#16a34a'}}>
                    TOTAL PERÍODO
                  </td>
                  {totalesCols.map((t,i) => (
                    <td key={i} style={{textAlign:'right',color:t>0?'#16a34a':'var(--text-3)'}}>
                      {t > 0 ? `$${(t/1000).toFixed(0)}k` : '—'}
                    </td>
                  ))}
                  <td style={{textAlign:'right',color:'#16a34a',background:'#dcfce7'}}>
                    {formatMoney(totalGeneral)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
