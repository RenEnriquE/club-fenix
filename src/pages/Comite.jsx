import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getActividades } from '../lib/supabase'
import { formatMoney } from '../lib/helpers'

const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const MESES_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function generarPeriodos() {
  const periodos = []
  const hoy = new Date()
  let anio = 2024, mes = 1
  const finAnio = hoy.getFullYear()
  const finMes = Math.min(hoy.getMonth() + 2, 12)
  while (anio < finAnio || (anio === finAnio && mes <= finMes)) {
    periodos.push({ valor: anio * 100 + mes, label: `${MESES_ES[mes-1]} ${anio}`, anio, mes })
    mes++
    if (mes > 12) { mes = 1; anio++ }
  }
  return periodos
}

const PERIODOS = generarPeriodos()

function columnaEntre(desde, hasta) {
  const cols = []
  let anio = Math.floor(desde/100), mes = desde % 100
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
  const defaultDesde = (hoy.getFullYear() - 1) * 100 + (hoy.getMonth() + 1)
  const defaultHasta = hoy.getFullYear() * 100 + (hoy.getMonth() + 1)

  const [desde, setDesde] = useState(defaultDesde)
  const [hasta, setHasta] = useState(defaultHasta)
  const [filtroVigente, setFiltroVigente] = useState('1')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroActividades, setFiltroActividades] = useState(['0'])
  const [vistaActiva, setVistaActiva] = useState('cuotas') // 'cuotas' | 'actividades'
  const [personas, setPersonas] = useState([])
  const [pagos, setPagos] = useState([])
  const [actividades, setActividades] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getActividades().then(setActividades).catch(() => setActividades([]))
  }, [])

  useEffect(() => {
    setLoading(true)
    setPagos([])
    const anioDesde = Math.floor(desde / 100)
    const anioHasta = Math.floor(hasta / 100)
    const anios = []
    for (let a = anioDesde; a <= anioHasta; a++) anios.push(a)

    Promise.all([
      supabase.from('personas').select('id_caif,nombre_comp,rut,dv,atleta,vigente,fecha_nac').order('nombre_comp'),
      supabase.from('pagos').select('id_socio,periodo,mes,anio,monto,id_actividad').in('anio', anios)
    ]).then(([resP, resPg]) => {
      setPersonas(resP.data || [])
      const all = resPg.data || []
      setPagos(all.filter(p => Number(p.periodo) >= desde && Number(p.periodo) <= hasta))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [desde, hasta])

  const columnas = columnaEntre(desde, hasta)

  const lista = personas.filter(p => {
    const matchV = filtroVigente === '' || String(p.vigente) === filtroVigente
    const matchT = !filtroTipo || p.atleta === filtroTipo
    const noApoderado = p.atleta !== 'Apoderado'
    return matchV && matchT && noApoderado
  })

  // Pagos filtrados por actividad para vista cuotas (multiples)
  const pagosFiltrados = filtroActividades.length === 0
    ? pagos
    : pagos.filter(p => filtroActividades.includes(String(p.id_actividad)))

  const totalesCols = columnas.map(col =>
    lista.reduce((sum, p) => {
      const pago = pagosFiltrados.find(pg => Number(pg.id_socio) === Number(p.id_caif) && Number(pg.periodo) === col.periodo)
      return sum + (pago ? pago.monto : 0)
    }, 0)
  )
  const totalGeneral = totalesCols.reduce((a, b) => a + b, 0)
  const totalSocios = lista.length
  const sociosConPago = lista.filter(p => pagosFiltrados.some(pg => Number(pg.id_socio) === Number(p.id_caif))).length
  const ingTotalRango = pagosFiltrados.filter(pg => lista.some(p => Number(p.id_caif) === Number(pg.id_socio))).reduce((a,p) => a+(p.monto||0), 0)
  const nombresActividadesSel = filtroActividades.map(id => actividades.find(a => String(a.id_actividad) === id)?.nombre || '').filter(Boolean)

  // Resumen por actividad (para la vista de actividades)
  const resumenActividades = actividades.map(act => {
    const pagosAct = pagos.filter(p => Number(p.id_actividad) === act.id_actividad)
    const total = pagosAct.reduce((a, p) => a + (p.monto || 0), 0)
    const cantidad = pagosAct.length
    const sociosUnicos = new Set(pagosAct.map(p => p.id_socio)).size
    return { ...act, total, cantidad, sociosUnicos }
  }).filter(a => a.total > 0 || a.id_actividad === 0)

  const totalTodasActividades = pagos
    .filter(pg => lista.some(p => Number(p.id_caif) === Number(pg.id_socio)))
    .reduce((a, p) => a + (p.monto || 0), 0)

  function exportarExcel() {
    // Generar nombre de archivo con fecha y hora
    const ahora = new Date()
    const pad = n => String(n).padStart(2,'0')
    const nombre = `Cuotas_CAIF_${ahora.getFullYear()}${pad(ahora.getMonth()+1)}${pad(ahora.getDate())}_${pad(ahora.getHours())}${pad(ahora.getMinutes())}.xlsx`

    // Construir datos para cada hoja
    // Hoja 1: Detalle por socio
    const calcEdadExcel = fn => { if(!fn) return ''; const d=new Date(fn+'T12:00:00-04:00'); const hoy=new Date(); let e=hoy.getFullYear()-d.getFullYear(); const m=hoy.getMonth()-d.getMonth(); if(m<0||(m===0&&hoy.getDate()<d.getDate())) e--; return e }
    const encabezados = ['ID','Nombre','RUT','Fecha Nac','Edad','Tipo','Vigente',...columnas.map(c=>c.label),'Total']
    const filas = lista.map(s => {
      const pagosSocio = pagosFiltrados.filter(pg => Number(pg.id_socio) === Number(s.id_caif))
      const totalSocio = pagosSocio.reduce((a,p) => a+(p.monto||0), 0)
      return [
        s.id_caif,
        s.nombre_comp,
        `${s.rut}${s.dv?'-'+s.dv:''}`,
        s.fecha_nac ? s.fecha_nac.split('-').reverse().join('-') : '',
        calcEdadExcel(s.fecha_nac),
        s.atleta&&s.atleta.includes('Ni')?'Nino':'Adulto',
        s.vigente===1?'Vigente':'Inactivo',
        ...columnas.map(col => {
          const pago = pagosSocio.find(pg => Number(pg.periodo) === col.periodo)
          return pago ? pago.monto : 0
        }),
        totalSocio
      ]
    })
    // Fila totales
    const filaTotales = ['','TOTAL PERIODO','','','','','', ...totalesCols, totalGeneral]
    const datosDetalle = [encabezados, ...filas, filaTotales]

    // Hoja 2: Resumen por actividad
    const encabResumen = ['Actividad','Registros','Socios','Total']
    const filasResumen = resumenActividades.map(act => [act.nombre, act.cantidad, act.sociosUnicos, act.total])
    filasResumen.push(['TOTAL GENERAL','','',totalTodasActividades])
    const datosResumen = [encabResumen, ...filasResumen]

    // Crear workbook con SheetJS (importado via CDN en index.html como XLSX)
    import('https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs').then(XLSX => {
      const wb = XLSX.utils.book_new()

      // Hoja detalle
      const ws1 = XLSX.utils.aoa_to_sheet(datosDetalle)
      // Ancho de columnas
      ws1['!cols'] = [
        {wch:6},{wch:35},{wch:14},{wch:12},{wch:6},{wch:8},{wch:10},
        ...columnas.map(()=>({wch:9})),
        {wch:12}
      ]
      XLSX.utils.book_append_sheet(wb, ws1, 'Cuotas por socio')

      // Hoja resumen
      const ws2 = XLSX.utils.aoa_to_sheet(datosResumen)
      ws2['!cols'] = [{wch:30},{wch:12},{wch:10},{wch:14}]
      XLSX.utils.book_append_sheet(wb, ws2, 'Resumen actividades')

      // Hoja KPIs
      const periodo = `${MESES_ES[Math.floor(desde/100)%100===0?0:(desde%100)-1]} ${Math.floor(desde/100)} - ${MESES_ES[Math.floor(hasta/100)%100===0?0:(hasta%100)-1]} ${Math.floor(hasta/100)}`
      const datosKpi = [
        ['Informe Cuotas CAIF'],
        ['Periodo', periodo],
        ['Generado', new Date().toLocaleString('es-CL')],
        ['Actividades', nombresActividadesSel.join(', ') || 'Todas'],
        [],
        ['Indicador','Valor'],
        ['Total socios en rango', totalSocios],
        ['Socios con pago', sociosConPago],
        ['Socios sin pago', totalSocios - sociosConPago],
        ['Total recaudado', totalTodasActividades],
        ['Total filtrado', ingTotalRango],
      ]
      const ws3 = XLSX.utils.aoa_to_sheet(datosKpi)
      ws3['!cols'] = [{wch:25},{wch:40}]
      XLSX.utils.book_append_sheet(wb, ws3, 'Resumen')

      XLSX.writeFile(wb, nombre)
    })
  }

  return (
    <div className="content">
      <div className="card">
        <div className="card-title"><i className="ti ti-report-analytics"></i>Informe para comite revisor</div>

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
              <option value="">Todos (excl. apoderados)</option>
              <option value="Atleta Adulto">Adultos</option>
              <option value="Atleta Nino">Ninos</option>
              <option value="Apoderado">Solo apoderados</option>
            </select>
          </div>
          {!loading && (
            <div style={{marginLeft:'auto',fontSize:12,color:'var(--text-3)',alignSelf:'center'}}>
              {lista.length} socios &middot; {columnas.length} meses
            </div>
          )}
        </div>

        {/* KPIs */}
        {!loading && (
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:10,marginBottom:16}}>
            {[
              {label:'Socios en el rango', val:totalSocios, color:'#1a5e3a'},
              {label:'Con algun pago', val:sociosConPago, color:'#16a34a'},
              {label:'Sin pagos', val:totalSocios-sociosConPago, color:'#dc2626'},
              {label:'Total recaudado', val:formatMoney(totalTodasActividades), color:'#1d4ed8', small:true},
            ].map((k,i)=>(
              <div key={i} style={{background:'#f8fafc',border:'0.5px solid #e2e8f0',borderRadius:10,padding:'10px 14px'}}>
                <div style={{fontSize:11,color:'#64748b',fontWeight:600,textTransform:'uppercase',letterSpacing:.03,marginBottom:4}}>{k.label}</div>
                <div style={{fontSize:k.small?16:24,fontWeight:700,color:k.color}}>{k.val}</div>
              </div>
            ))}
          </div>
        )}

        <hr className="divider"/>

        {/* Tabs de vista */}
        {!loading && (
          <div style={{display:'flex',gap:8,marginBottom:16,justifyContent:'space-between',flexWrap:'wrap'}}>
            <div style={{display:'flex',gap:8}}>
              <button
                className={`btn ${vistaActiva==='cuotas'?'primary':''}`}
                onClick={()=>setVistaActiva('cuotas')}
                style={{fontSize:12}}>
                <i className="ti ti-table"></i>Cuotas por socio
              </button>
              <button
                className={`btn ${vistaActiva==='actividades'?'primary':''}`}
                onClick={()=>setVistaActiva('actividades')}
                style={{fontSize:12}}>
                <i className="ti ti-chart-bar"></i>Resumen por actividad
              </button>
            </div>
            <button className="btn" onClick={exportarExcel} style={{fontSize:12,color:'#16a34a',borderColor:'#a7f3d0',background:'#f0fdf4'}}>
              <i className="ti ti-file-spreadsheet"></i>Exportar Excel
            </button>
          </div>
        )}

        {loading ? (
          <div className="loading-center" style={{padding:'3rem'}}>
            <div className="spinner"></div><span style={{marginLeft:10}}>Cargando informe...</span>
          </div>
        ) : desde > hasta ? (
          <div className="empty"><i className="ti ti-alert-circle"></i>El periodo inicial debe ser anterior al final</div>
        ) : (
          <>
            {/* VISTA: Resumen por actividad */}
            {vistaActiva === 'actividades' && (
              <div>
                <div style={{marginBottom:12,fontSize:13,color:'var(--text-3)'}}>
                  Ingresos totales del rango agrupados por tipo de pago / actividad
                </div>
                <div style={{display:'grid',gap:8}}>
                  {resumenActividades.map(act => {
                    const esCuota = act.id_actividad === 0
                    const pct = totalTodasActividades > 0 ? (act.total / totalTodasActividades * 100) : 0
                    return (
                      <div key={act.id_actividad} style={{
                        background: esCuota ? '#f0fdf4' : '#fffbeb',
                        border: `0.5px solid ${esCuota ? '#a7f3d0' : '#fde68a'}`,
                        borderRadius: 10,
                        padding: '12px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 16
                      }}>
                        <div style={{flex: 1}}>
                          <div style={{fontWeight:600,fontSize:14,color: esCuota ? '#1a5e3a' : '#92400e'}}>
                            {act.nombre}
                          </div>
                          <div style={{fontSize:11,color:'#64748b',marginTop:2}}>
                            {act.cantidad} registro{act.cantidad!==1?'s':''} &middot; {act.sociosUnicos} socio{act.sociosUnicos!==1?'s':''} distinto{act.sociosUnicos!==1?'s':''}
                          </div>
                          {/* Barra de progreso */}
                          <div style={{marginTop:6,background:'#e2e8f0',borderRadius:4,height:4,overflow:'hidden'}}>
                            <div style={{width:`${pct}%`,height:'100%',background: esCuota ? '#16a34a' : '#f59e0b',borderRadius:4,transition:'width 0.3s'}}></div>
                          </div>
                        </div>
                        <div style={{textAlign:'right',minWidth:100}}>
                          <div style={{fontWeight:700,fontSize:17,color: esCuota ? '#1a5e3a' : '#92400e'}}>{formatMoney(act.total)}</div>
                          <div style={{fontSize:11,color:'#64748b'}}>{pct.toFixed(1)}% del total</div>
                        </div>
                      </div>
                    )
                  })}
                  {/* Total general */}
                  <div style={{background:'#1a5e3a',borderRadius:10,padding:'12px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div style={{fontWeight:700,fontSize:14,color:'#fff'}}>TOTAL GENERAL DEL RANGO</div>
                    <div style={{fontWeight:700,fontSize:20,color:'#fff'}}>{formatMoney(totalTodasActividades)}</div>
                  </div>
                </div>
              </div>
            )}

            {/* VISTA: Cuotas por socio */}
            {vistaActiva === 'cuotas' && (
              columnas.length > 24 ? (
                <div className="empty" style={{color:'var(--warning)'}}>
                  <i className="ti ti-alert-triangle"></i>
                  Rango de {columnas.length} meses. Selecciona maximo 24 meses.
                </div>
              ) : (
                <div>
                  {/* Filtro actividades multiple */}
                  <div style={{marginBottom:12}}>
                    <label style={{fontSize:12,color:'var(--text-3)',fontWeight:600,display:'block',marginBottom:6}}>Actividades a mostrar:</label>
                    <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                      {actividades.map(a => {
                        const sel = filtroActividades.includes(String(a.id_actividad))
                        return (
                          <button key={a.id_actividad}
                            onClick={() => setFiltroActividades(prev =>
                              prev.includes(String(a.id_actividad))
                                ? prev.filter(x => x !== String(a.id_actividad))
                                : [...prev, String(a.id_actividad)]
                            )}
                            style={{
                              padding:'4px 12px', borderRadius:999, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
                              background: sel ? (a.id_actividad===0?'#1a5e3a':'#92400e') : '#f8fafc',
                              color: sel ? '#fff' : '#64748b',
                              border: `1.5px solid ${sel ? (a.id_actividad===0?'#1a5e3a':'#f59e0b') : '#e2e8f0'}`,
                            }}>
                            {a.nombre}
                          </button>
                        )
                      })}
                      <button onClick={() => setFiltroActividades(actividades.map(a=>String(a.id_actividad)))}
                        style={{padding:'4px 12px',borderRadius:999,fontSize:12,cursor:'pointer',fontFamily:'inherit',background:'#f1f5f9',color:'#475569',border:'1.5px solid #e2e8f0',fontWeight:500}}>
                        Todas
                      </button>
                    </div>
                    {filtroActividades.length > 0 && (
                      <div style={{marginTop:6,fontSize:11,color:'#64748b'}}>
                        Mostrando: <strong>{nombresActividadesSel.join(', ')}</strong>
                        &nbsp;&middot;&nbsp;<strong style={{color:'#1a5e3a'}}>{formatMoney(ingTotalRango)}</strong>
                      </div>
                    )}
                  </div>

                  <div style={{overflowX:'auto',WebkitOverflowScrolling:'touch',borderRadius:8,border:'0.5px solid #e2e8f0'}}>
                    <table className="tbl" style={{fontSize:11,minWidth:`${360 + columnas.length * 68}px`}}>
                      <thead>
                        <tr>
                          <th style={{width:50,position:'sticky',left:0,background:'#f8fafc',zIndex:2}}>ID</th>
                          <th style={{minWidth:140,position:'sticky',left:50,background:'#f8fafc',zIndex:2}}>Nombre</th>
                          <th style={{width:110}}>RUT</th>
                          <th style={{width:50}}>Tipo</th>
                          {columnas.map(col=>(
                            <th key={col.periodo} style={{width:68,textAlign:'right',whiteSpace:'nowrap'}}>
                              {col.label}
                            </th>
                          ))}
                          <th style={{width:90,textAlign:'right',fontWeight:700,background:'#f0fdf4',color:'#16a34a'}}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lista.map(s => {
                          const pagosSocio = pagosFiltrados.filter(pg => Number(pg.id_socio) === Number(s.id_caif))
                          const totalSocio = pagosSocio.reduce((a,p) => a+(p.monto||0), 0)
                          return (
                            <tr key={s.id_caif} style={{opacity: s.vigente !== 1 ? 0.65 : 1}}>
                              <td style={{position:'sticky',left:0,background:s.vigente!==1?'#fafafa':'#fff',color:'var(--text-3)',zIndex:1,width:50,minWidth:50}}>{s.id_caif}</td>
                              <td style={{position:'sticky',left:50,background:s.vigente!==1?'#fafafa':'#fff',fontWeight:500,zIndex:1,maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={s.nombre_comp}>
                                {s.nombre_comp}
                                {s.vigente!==1 && <span style={{marginLeft:5,fontSize:10,color:'#94a3b8'}}>(inactivo)</span>}
                              </td>
                              <td style={{color:'var(--text-3)',fontSize:11,whiteSpace:'nowrap'}}>{s.rut}{s.dv?`-${s.dv}`:''}</td>
                              <td>
                                <span className={`badge ${s.atleta&&s.atleta.includes('Ni')?'nino':'adulto'}`} style={{fontSize:9}}>
                                  {s.atleta&&s.atleta.includes('Ni')?'N':'A'}
                                </span>
                              </td>
                              {columnas.map(col => {
                                const pago = pagosSocio.find(pg => Number(pg.periodo) === col.periodo)
                                return (
                                  <td key={col.periodo} style={{textAlign:'right',color:pago?'#16a34a':'#e2e8f0',fontSize:11}}>
                                    {pago ? formatMoney(pago.monto) : '-'}
                                  </td>
                                )
                              })}
                              <td style={{textAlign:'right',fontWeight:700,color:totalSocio>0?'#16a34a':'var(--text-3)',background:'#f0fdf4'}}>
                                {totalSocio > 0 ? formatMoney(totalSocio) : '-'}
                              </td>
                            </tr>
                          )
                        })}
                        <tr style={{background:'#f0fdf4',fontWeight:700,fontSize:12}}>
                          <td colSpan={4} style={{position:'sticky',left:0,background:'#f0fdf4',color:'#16a34a',minWidth:360}}>TOTAL PERIODO</td>
                          {totalesCols.map((t,i) => (
                            <td key={i} style={{textAlign:'right',color:t>0?'#16a34a':'var(--text-3)',fontWeight:600,fontSize:10}}>
                              {t > 0 ? formatMoney(t) : '-'}
                            </td>
                          ))}
                          <td style={{textAlign:'right',color:'#16a34a',background:'#dcfce7'}}>{formatMoney(totalGeneral)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p style={{fontSize:11,color:'var(--text-3)',marginTop:8,textAlign:'center'}}>
                    Desliza horizontalmente para ver todos los meses
                  </p>
                </div>
              )
            )}
          </>
        )}
      </div>
    </div>
  )
}
