import { useState, useEffect } from 'react'
import {
  searchPersonas, getPagosBySocio, insertPago, deletePago, getNextPagoId,
  getSociosPorApoderado, getGruposFrecuentes, guardarGrupoPago, getPersonasByIds
} from '../lib/supabase'
import { MESES, AÑOS, pagosPorSocioAnio, formatMoney } from '../lib/helpers'

const CUOTA = 3000

function SocioGrupal({ entry, anio, onRemove, onToggleMes, onChangeMonto }) {
  const { socio, pagos, mesesSel, monto } = entry
  const mesesPagados = pagosPorSocioAnio(socio.id_caif, anio, pagos).map(p => p.mes)
  return (
    <div style={{border:'0.5px solid #e2e8f0',borderRadius:10,padding:'1rem',marginBottom:10,background:'#fafafa'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
        <div>
          <div style={{fontWeight:600,fontSize:14}}>{socio.nombre_comp}</div>
          <div style={{fontSize:12,color:'#64748b'}}>ID {socio.id_caif} · {socio.atleta}{socio.apoderado?` · Apod: ${socio.apoderado}`:''}</div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <label style={{fontSize:12,color:'#64748b'}}>$/mes:</label>
            <input type="number" value={monto} onChange={e=>onChangeMonto(socio.id_caif,Number(e.target.value))}
              style={{width:85,padding:'4px 8px',border:'0.5px solid #e2e8f0',borderRadius:6,fontSize:13,fontFamily:'inherit'}}/>
          </div>
          <button onClick={()=>onRemove(socio.id_caif)}
            style={{background:'#fef2f2',border:'0.5px solid #fecaca',borderRadius:6,padding:'4px 8px',cursor:'pointer',color:'#dc2626',fontSize:12,fontFamily:'inherit'}}>
            <i className="ti ti-x"></i>
          </button>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:5}}>
        {MESES.map((m,i) => {
          const n=i+1, pagado=mesesPagados.includes(n), sel=mesesSel.includes(n)
          return (
            <button key={n} className={`mes-btn${pagado?' pagado':''}${sel?' sel':''}`}
              onClick={()=>!pagado&&onToggleMes(socio.id_caif,n)} disabled={pagado}
              style={{fontSize:11,padding:'5px 2px'}}>{m.substring(0,3)}</button>
          )
        })}
      </div>
      {mesesSel.length>0&&(
        <div style={{marginTop:8,fontSize:12,color:'#1a5e3a',fontWeight:500}}>
          → {mesesSel.map(m=>MESES[m-1]).join(', ')} · {formatMoney(monto*mesesSel.length)}
        </div>
      )}
    </div>
  )
}

export default function Pagos() {
  const [modo, setModo] = useState('individual')

  // Individual
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState([])
  const [socioSel, setSocioSel] = useState(null)
  const [pagosInd, setPagosInd] = useState([])
  const [anio, setAnio] = useState(new Date().getFullYear())
  const [mesesSel, setMesesSel] = useState([])
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [monto, setMonto] = useState(CUOTA)
  const [metodo, setMetodo] = useState('Transferencia')
  const [numTrans, setNumTrans] = useState('')
  const [alertInd, setAlertInd] = useState(null)
  const [loadingPago, setLoadingPago] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)

  // Grupal
  const [busqGrupal, setBusqGrupal] = useState('')
  const [resultadosG, setResultadosG] = useState([])
  const [searchLoadingG, setSearchLoadingG] = useState(false)
  const [entries, setEntries] = useState([])
  const [sugeridos, setSugeridos] = useState([])
  const [gruposFrecuentes, setGruposFrecuentes] = useState([]) // [{grupo_ids, veces, ultimo_pago, personas}]
  const [anioG, setAnioG] = useState(new Date().getFullYear())
  const [fechaG, setFechaG] = useState(new Date().toISOString().split('T')[0])
  const [metodoG, setMetodoG] = useState('Transferencia')
  const [numTransG, setNumTransG] = useState('')
  const [alertG, setAlertG] = useState(null)
  const [loadingG, setLoadingG] = useState(false)

  useEffect(() => {
    if (busqueda.length < 2) { setResultados([]); return }
    setSearchLoading(true)
    const t = setTimeout(async () => {
      setResultados(await searchPersonas(busqueda))
      setSearchLoading(false)
    }, 300)
    return () => clearTimeout(t)
  }, [busqueda])

  useEffect(() => {
    if (busqGrupal.length < 2) { setResultadosG([]); return }
    setSearchLoadingG(true)
    const ids = entries.map(e=>e.socio.id_caif)
    const idsS = sugeridos.map(s=>s.id_caif)
    const t = setTimeout(async () => {
      const data = await searchPersonas(busqGrupal)
      setResultadosG(data.filter(s=>!ids.includes(s.id_caif)&&!idsS.includes(s.id_caif)))
      setSearchLoadingG(false)
    }, 300)
    return () => clearTimeout(t)
  }, [busqGrupal, entries, sugeridos])

  async function seleccionarInd(s) {
    setSocioSel(s); setMesesSel([]); setBusqueda(''); setResultados([])
    setPagosInd(await getPagosBySocio(s.id_caif))
  }

  async function agregarAlGrupo(s, esSugerido=false) {
    setBusqGrupal(''); setResultadosG([])
    if (esSugerido) setSugeridos(prev=>prev.filter(x=>x.id_caif!==s.id_caif))
    const pagos = await getPagosBySocio(s.id_caif)
    setEntries(prev => {
      const nuevos = [...prev, {socio:s, pagos, mesesSel:[], monto:CUOTA}]
      // Si es el primer socio, buscar sugerencias
      if (prev.length === 0) {
        cargarSugerencias(s)
      }
      return nuevos
    })
  }

  async function cargarSugerencias(s) {
    // 1. Grupos frecuentes
    const grupos = await getGruposFrecuentes(s.id_caif)
    if (grupos.length > 0) {
      const gruposConPersonas = await Promise.all(
        grupos.map(async g => {
          const personas = await getPersonasByIds(g.grupo_ids)
          return { ...g, personas }
        })
      )
      setGruposFrecuentes(gruposConPersonas.filter(g => g.personas.length > 0))
    }
    // 2. Sugeridos por apoderado
    if (s.apoderado) {
      const familia = await getSociosPorApoderado(s.apoderado, s.id_caif)
      if (familia.length > 0) setSugeridos(familia)
    }
  }

  async function cargarGrupoFrecuente(grupo) {
    setGruposFrecuentes([])
    setSugeridos([])
    for (const persona of grupo.personas) {
      if (!entries.find(e=>e.socio.id_caif===persona.id_caif)) {
        const pagos = await getPagosBySocio(persona.id_caif)
        setEntries(prev => [...prev, {socio:persona, pagos, mesesSel:[], monto:CUOTA}])
      }
    }
  }

  function removerDelGrupo(id) {
    setEntries(prev => {
      const nuevos = prev.filter(e=>e.socio.id_caif!==id)
      if (nuevos.length===0) { setSugeridos([]); setGruposFrecuentes([]) }
      return nuevos
    })
  }

  function toggleMesGrupal(socioId, mes) {
    setEntries(prev=>prev.map(e=>e.socio.id_caif!==socioId?e:{
      ...e, mesesSel:e.mesesSel.includes(mes)?e.mesesSel.filter(m=>m!==mes):[...e.mesesSel,mes]
    }))
  }

  function cambiarMontoGrupal(socioId, val) {
    setEntries(prev=>prev.map(e=>e.socio.id_caif===socioId?{...e,monto:val}:e))
  }

  async function registrarInd() {
    if (!socioSel||mesesSel.length===0){setAlertInd({type:'error',msg:'Selecciona al menos un mes.'});return}
    setLoadingPago(true)
    try {
      let nextId = await getNextPagoId()
      const nuevos = []
      for (const mes of mesesSel) {
        const res = await insertPago({id_pago:nextId++,id_socio:socioSel.id_caif,periodo:anio*100+mes,fecha_pago:fecha,monto:Number(monto),tipo_pago:metodo,banco:null,num_transacc:numTrans||null,cuenta:'CAIF',anio,mes})
        nuevos.push(res)
      }
      setPagosInd(prev=>[...prev,...nuevos])
      setAlertInd({type:'success',msg:`✓ ${mesesSel.map(m=>MESES[m-1]).join(', ')} ${anio} — ${formatMoney(monto*mesesSel.length)}`})
      setMesesSel([]); setNumTrans('')
    } catch(e){setAlertInd({type:'error',msg:'Error: '+e.message})}
    finally{setLoadingPago(false);setTimeout(()=>setAlertInd(null),4000)}
  }

  async function registrarGrupal() {
    const conMeses = entries.filter(e=>e.mesesSel.length>0)
    if (conMeses.length===0){setAlertG({type:'error',msg:'Selecciona al menos un mes.'});return}
    setLoadingG(true)
    try {
      let nextId = await getNextPagoId()
      let total = 0
      for (const entry of conMeses) {
        for (const mes of entry.mesesSel) {
          await insertPago({id_pago:nextId++,id_socio:entry.socio.id_caif,periodo:anioG*100+mes,fecha_pago:fechaG,monto:Number(entry.monto),tipo_pago:metodoG,banco:null,num_transacc:numTransG||null,cuenta:'CAIF',anio:anioG,mes})
          total += Number(entry.monto)
        }
      }
      // Guardar grupo para sugerencias futuras
      if (entries.length > 1) {
        await guardarGrupoPago(entries.map(e=>e.socio.id_caif), fechaG)
      }
      const updated = await Promise.all(entries.map(async e=>({...e,pagos:await getPagosBySocio(e.socio.id_caif),mesesSel:[]})))
      setEntries(updated)
      setAlertG({type:'success',msg:`✓ Pagos registrados — Total: ${formatMoney(total)}`})
      setNumTransG('')
    } catch(e){setAlertG({type:'error',msg:'Error: '+e.message})}
    finally{setLoadingG(false);setTimeout(()=>setAlertG(null),5000)}
  }

  async function eliminarPagoInd(idPago) {
    if (!confirm('¿Eliminar este pago?')) return
    await deletePago(idPago)
    setPagosInd(prev=>prev.filter(p=>p.id_pago!==idPago))
  }

  const pagosAnio = socioSel ? pagosPorSocioAnio(socioSel.id_caif, anio, pagosInd) : []
  const mesesPagados = pagosAnio.map(p=>p.mes)
  const totalGrupal = entries.reduce((a,e)=>a+e.monto*e.mesesSel.length,0)
  const totalMesesGrupal = entries.reduce((a,e)=>a+e.mesesSel.length,0)
  const idsEnGrupo = entries.map(e=>e.socio.id_caif)

  return (
    <div className="content">
      <div style={{display:'flex',gap:8,marginBottom:16}}>
        <button className={`btn ${modo==='individual'?'primary':''}`} onClick={()=>setModo('individual')}><i className="ti ti-user"></i>Pago individual</button>
        <button className={`btn ${modo==='grupal'?'primary':''}`} onClick={()=>setModo('grupal')}><i className="ti ti-users"></i>Pago grupal</button>
      </div>

      {/* ── INDIVIDUAL ── */}
      {modo==='individual'&&(<>
        <div className="card">
          <div className="card-title"><i className="ti ti-search"></i>Buscar socio</div>
          <div style={{position:'relative'}}>
            <input type="text" placeholder="Nombre, apellido o ID..." value={busqueda} onChange={e=>setBusqueda(e.target.value)}
              style={{width:'100%',padding:'9px 12px',border:'0.5px solid #e2e8f0',borderRadius:8,fontSize:14,fontFamily:'inherit'}}/>
            {searchLoading&&<div className="spinner" style={{position:'absolute',right:10,top:10,width:18,height:18}}></div>}
          </div>
          {resultados.length>0&&(
            <div className="tbl-scroll" style={{marginTop:8}}>
              <table className="tbl">
                <thead><tr><th style={{width:55}}>ID</th><th>Nombre</th><th style={{width:90}}>Tipo</th></tr></thead>
                <tbody>{resultados.map(s=>(
                  <tr key={s.id_caif} style={{cursor:'pointer'}} onClick={()=>seleccionarInd(s)} className={socioSel?.id_caif===s.id_caif?'selected':''}>
                    <td>{s.id_caif}</td><td>{s.nombre_comp}</td>
                    <td><span className={`badge ${s.atleta==='Atleta Niño'?'nino':'adulto'}`}>{s.atleta==='Atleta Niño'?'Niño':'Adulto'}</span></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
        {socioSel&&(<>
          <div className="socio-panel">
            <div><h3>{socioSel.nombre_comp}</h3>
              <p>ID {socioSel.id_caif} · RUT {socioSel.rut}-{socioSel.dv} · {socioSel.atleta}{socioSel.apoderado?` · Apoderado: ${socioSel.apoderado}`:''}</p>
            </div>
            <span className={`badge ${socioSel.atleta==='Atleta Niño'?'nino':'adulto'}`}>{socioSel.atleta==='Atleta Niño'?'👦 Niño':'👤 Adulto'}</span>
          </div>
          <div className="card">
            <div className="card-title"><i className="ti ti-calendar-check"></i>Registrar pago</div>
            <div className="year-tabs">{AÑOS.map(a=><button key={a} className={`year-tab ${a===anio?'active':''}`} onClick={()=>{setAnio(a);setMesesSel([])}}>{a}</button>)}</div>
            <p style={{fontSize:12,color:'var(--text-3)',marginBottom:8}}>Verde = pagado · Selecciona los meses a registrar</p>
            <div className="mes-grid">{MESES.map((m,i)=>{const n=i+1,pg=mesesPagados.includes(n),sel=mesesSel.includes(n);return(
              <button key={n} className={`mes-btn${pg?' pagado':''}${sel?' sel':''}`} disabled={pg}
                onClick={()=>!pg&&setMesesSel(prev=>prev.includes(n)?prev.filter(x=>x!==n):[...prev,n])}>{m.substring(0,3)}</button>
            )})}</div>
            <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'flex-end'}}>
              <div className="form-group" style={{flex:'1',minWidth:150}}><label>Fecha de pago</label><input type="date" value={fecha} onChange={e=>setFecha(e.target.value)}/></div>
              <div className="form-group" style={{flex:'1',minWidth:120}}><label>Monto por mes ($)</label><input type="number" value={monto} onChange={e=>setMonto(e.target.value)}/></div>
              <div className="form-group" style={{flex:'1',minWidth:140}}><label>Método</label>
                <select value={metodo} onChange={e=>setMetodo(e.target.value)}><option>Transferencia</option><option>Efectivo</option><option>Cheque</option></select>
              </div>
              {metodo==='Transferencia'&&<div className="form-group" style={{flex:'1',minWidth:140}}><label>N° transacción</label><input type="text" value={numTrans} onChange={e=>setNumTrans(e.target.value)} placeholder="Opcional"/></div>}
              <button className="btn primary" onClick={registrarInd} disabled={loadingPago||mesesSel.length===0} style={{marginBottom:1}}>
                {loadingPago?<><div className="spinner" style={{width:14,height:14,borderWidth:2}}></div>Guardando...</>:<><i className="ti ti-check"></i>Registrar {mesesSel.length>0?`(${mesesSel.length})`:''}</>}
              </button>
            </div>
            {alertInd&&<div className={`alert ${alertInd.type}`}>{alertInd.msg}</div>}
          </div>
          <div className="card">
            <div className="card-title"><i className="ti ti-history"></i>Historial — {anio}</div>
            {pagosAnio.length===0?<div className="empty"><i className="ti ti-calendar-x"></i>Sin pagos en {anio}</div>:(
              <div className="tbl-wrap"><table className="tbl">
                <thead><tr><th style={{width:90}}>Mes</th><th style={{width:100}}>Fecha</th><th style={{width:90}}>Monto</th><th style={{width:110}}>Método</th><th>N° Trans.</th><th style={{width:60}}></th></tr></thead>
                <tbody>
                  {pagosAnio.sort((a,b)=>a.mes-b.mes).map(p=>(
                    <tr key={p.id_pago}><td>{MESES[p.mes-1]}</td><td>{p.fecha_pago||'—'}</td>
                      <td style={{color:'var(--success)',fontWeight:500}}>{formatMoney(p.monto)}</td>
                      <td>{p.tipo_pago}</td><td>{p.num_transacc||'—'}</td>
                      <td><button className="btn sm danger" onClick={()=>eliminarPagoInd(p.id_pago)}><i className="ti ti-trash"></i></button></td>
                    </tr>
                  ))}
                  <tr><td colSpan={2} style={{fontWeight:600}}>Total {anio}</td>
                    <td style={{fontWeight:600,color:'var(--success)'}}>{formatMoney(pagosAnio.reduce((a,p)=>a+p.monto,0))}</td>
                    <td colSpan={3}></td></tr>
                </tbody>
              </table></div>
            )}
          </div>
        </>)}
      </>)}

      {/* ── GRUPAL ── */}
      {modo==='grupal'&&(<>
        <div className="card">
          <div className="card-title"><i className="ti ti-user-plus"></i>Agregar socios al pago grupal</div>
          <div style={{position:'relative'}}>
            <input type="text" placeholder="Buscar socio por nombre o ID..." value={busqGrupal} onChange={e=>setBusqGrupal(e.target.value)}
              style={{width:'100%',padding:'9px 12px',border:'0.5px solid #e2e8f0',borderRadius:8,fontSize:14,fontFamily:'inherit'}}/>
            {searchLoadingG&&<div className="spinner" style={{position:'absolute',right:10,top:10,width:18,height:18}}></div>}
          </div>
          {resultadosG.length>0&&(
            <div className="tbl-scroll" style={{marginTop:8}}>
              <table className="tbl">
                <thead><tr><th style={{width:55}}>ID</th><th>Nombre</th><th style={{width:90}}>Tipo</th><th style={{width:90}}></th></tr></thead>
                <tbody>{resultadosG.map(s=>(
                  <tr key={s.id_caif}>
                    <td>{s.id_caif}</td><td>{s.nombre_comp}</td>
                    <td><span className={`badge ${s.atleta==='Atleta Niño'?'nino':'adulto'}`}>{s.atleta==='Atleta Niño'?'Niño':'Adulto'}</span></td>
                    <td><button className="btn sm primary" onClick={()=>agregarAlGrupo(s)}><i className="ti ti-plus"></i>Agregar</button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}

          {/* Grupos frecuentes */}
          {gruposFrecuentes.filter(g=>!g.personas.every(p=>idsEnGrupo.includes(p.id_caif))).length>0&&(
            <div style={{marginTop:12,background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:8,padding:'10px 14px'}}>
              <div style={{fontSize:12,fontWeight:600,color:'#1e40af',marginBottom:10}}>
                <i className="ti ti-history" style={{marginRight:4}}></i>Grupos frecuentes anteriores
              </div>
              {gruposFrecuentes.filter(g=>!g.personas.every(p=>idsEnGrupo.includes(p.id_caif))).map((g,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',background:'#fff',border:'0.5px solid #bfdbfe',borderRadius:8,padding:'8px 12px',marginBottom:6}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:500,color:'#1e3a5f'}}>
                      {g.personas.map(p=>p.nombre_comp.split(' ')[0]).join(', ')}
                    </div>
                    <div style={{fontSize:11,color:'#64748b'}}>
                      {g.veces} vez{g.veces!==1?'ces':''} · Último: {g.ultimo_pago ? new Date(g.ultimo_pago).toLocaleDateString('es-CL') : '—'}
                    </div>
                  </div>
                  <button className="btn sm primary" onClick={()=>cargarGrupoFrecuente(g)}>
                    <i className="ti ti-users"></i>Cargar grupo
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Sugeridos por apoderado */}
          {sugeridos.filter(s=>!idsEnGrupo.includes(s.id_caif)).length>0&&(
            <div style={{marginTop:12,background:'#fffbeb',border:'1px solid #fde68a',borderRadius:8,padding:'10px 14px'}}>
              <div style={{fontSize:12,fontWeight:600,color:'#92400e',marginBottom:8}}>
                <i className="ti ti-users" style={{marginRight:4}}></i>Grupo familiar detectado — ¿agregar también?
              </div>
              <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                {sugeridos.filter(s=>!idsEnGrupo.includes(s.id_caif)).map(s=>(
                  <div key={s.id_caif} style={{display:'flex',alignItems:'center',gap:8,background:'#fff',border:'0.5px solid #fde68a',borderRadius:8,padding:'6px 10px'}}>
                    <span style={{fontSize:13,fontWeight:500}}>{s.nombre_comp}</span>
                    <span className={`badge ${s.atleta==='Atleta Niño'?'nino':'adulto'}`} style={{fontSize:10}}>{s.atleta==='Atleta Niño'?'Niño':'Adulto'}</span>
                    <button className="btn sm primary" style={{padding:'3px 8px'}} onClick={()=>agregarAlGrupo(s,true)}><i className="ti ti-plus"></i>Agregar</button>
                    <button style={{background:'none',border:'none',cursor:'pointer',color:'#94a3b8',fontSize:14}} onClick={()=>setSugeridos(prev=>prev.filter(x=>x.id_caif!==s.id_caif))}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {entries.length>0&&(<>
          <div className="card">
            <div className="card-title"><i className="ti ti-calendar-check"></i>Seleccionar meses por socio</div>
            <div className="year-tabs">{AÑOS.map(a=><button key={a} className={`year-tab ${a===anioG?'active':''}`} onClick={()=>{setAnioG(a);setEntries(prev=>prev.map(e=>({...e,mesesSel:[]})))}}>{a}</button>)}</div>
            {entries.map(entry=>(
              <SocioGrupal key={entry.socio.id_caif} entry={entry} anio={anioG}
                onRemove={removerDelGrupo} onToggleMes={toggleMesGrupal} onChangeMonto={cambiarMontoGrupal}/>
            ))}
          </div>
          <div className="card">
            <div className="card-title"><i className="ti ti-receipt"></i>Datos del pago</div>
            <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'flex-end'}}>
              <div className="form-group" style={{flex:'1',minWidth:150}}><label>Fecha de pago</label><input type="date" value={fechaG} onChange={e=>setFechaG(e.target.value)}/></div>
              <div className="form-group" style={{flex:'1',minWidth:140}}><label>Método</label>
                <select value={metodoG} onChange={e=>setMetodoG(e.target.value)}><option>Transferencia</option><option>Efectivo</option><option>Cheque</option></select>
              </div>
              {metodoG==='Transferencia'&&<div className="form-group" style={{flex:'1',minWidth:140}}><label>N° transacción</label><input type="text" value={numTransG} onChange={e=>setNumTransG(e.target.value)} placeholder="Opcional"/></div>}
            </div>
            {totalMesesGrupal>0&&(
              <div style={{background:'#e8f5ee',border:'1px solid #a7f3d0',borderRadius:8,padding:'10px 14px',marginTop:12,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:13,color:'#1a5e3a'}}>
                  <strong>{totalMesesGrupal}</strong> mes{totalMesesGrupal!==1?'es':''} para <strong>{entries.filter(e=>e.mesesSel.length>0).length}</strong> socio{entries.filter(e=>e.mesesSel.length>0).length!==1?'s':''}
                </span>
                <span style={{fontWeight:700,fontSize:16,color:'#1a5e3a'}}>{formatMoney(totalGrupal)}</span>
              </div>
            )}
            <div style={{display:'flex',justifyContent:'flex-end',marginTop:12}}>
              <button className="btn primary" onClick={registrarGrupal} disabled={loadingG||totalMesesGrupal===0} style={{padding:'9px 24px'}}>
                {loadingG?<><div className="spinner" style={{width:14,height:14,borderWidth:2}}></div>Guardando...</>
                  :<><i className="ti ti-check"></i>Registrar {totalMesesGrupal>0?`${totalMesesGrupal} pagos`:''}</>}
              </button>
            </div>
            {alertG&&<div className={`alert ${alertG.type}`}>{alertG.msg}</div>}
          </div>
        </>)}

        {entries.length===0&&(
          <div className="card"><div className="empty"><i className="ti ti-users"></i>Busca y agrega los socios que comparten este pago</div></div>
        )}
      </>)}
    </div>
  )
}
