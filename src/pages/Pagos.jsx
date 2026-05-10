import { useState, useEffect } from 'react'
import { searchPersonas, getPagosBySocio, insertPago, deletePago, getNextPagoId } from '../lib/supabase'
import { MESES, AÑOS, pagosPorSocioAnio, formatMoney } from '../lib/helpers'

const CUOTA = 3000

// ── Componente fila de socio en pago grupal ──────────────────────────
function SocioGrupal({ entry, anio, onRemove, onToggleMes, onChangeMonto }) {
  const { socio, pagos, mesesSel, monto } = entry
  const pagosAnio = pagosPorSocioAnio(socio.id_caif, anio, pagos)
  const mesesPagados = pagosAnio.map(p => p.mes)

  return (
    <div style={{border:'0.5px solid #e2e8f0',borderRadius:10,padding:'1rem',marginBottom:10,background:'#fafafa'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
        <div>
          <div style={{fontWeight:600,fontSize:14}}>{socio.nombre_comp}</div>
          <div style={{fontSize:12,color:'#64748b'}}>ID {socio.id_caif} · {socio.atleta}</div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <label style={{fontSize:12,color:'#64748b'}}>Monto:</label>
            <input
              type="number"
              value={monto}
              onChange={e => onChangeMonto(socio.id_caif, Number(e.target.value))}
              style={{width:90,padding:'4px 8px',border:'0.5px solid #e2e8f0',borderRadius:6,fontSize:13,fontFamily:'inherit'}}
            />
          </div>
          <button onClick={() => onRemove(socio.id_caif)}
            style={{background:'#fef2f2',border:'0.5px solid #fecaca',borderRadius:6,padding:'4px 8px',cursor:'pointer',color:'#dc2626',fontSize:12}}>
            <i className="ti ti-x"></i> Quitar
          </button>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:5}}>
        {MESES.map((m, i) => {
          const n = i + 1
          const pagado = mesesPagados.includes(n)
          const sel = mesesSel.includes(n)
          return (
            <button key={n}
              className={`mes-btn${pagado ? ' pagado' : ''}${sel ? ' sel' : ''}`}
              onClick={() => !pagado && onToggleMes(socio.id_caif, n)}
              disabled={pagado}
              title={pagado ? 'Ya registrado' : ''}
              style={{fontSize:11,padding:'5px 2px'}}
            >
              {m.substring(0,3)}
            </button>
          )
        })}
      </div>

      {mesesSel.length > 0 && (
        <div style={{marginTop:8,fontSize:12,color:'#1a5e3a',fontWeight:500}}>
          → {mesesSel.map(m => MESES[m-1]).join(', ')} · {formatMoney(monto * mesesSel.length)}
        </div>
      )}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────
export default function Pagos() {
  const [modo, setModo] = useState('individual') // 'individual' | 'grupal'

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
  const [entries, setEntries] = useState([]) // [{socio, pagos, mesesSel, monto}]
  const [anioG, setAnioG] = useState(new Date().getFullYear())
  const [fechaG, setFechaG] = useState(new Date().toISOString().split('T')[0])
  const [metodoG, setMetodoG] = useState('Transferencia')
  const [numTransG, setNumTransG] = useState('')
  const [alertG, setAlertG] = useState(null)
  const [loadingG, setLoadingG] = useState(false)

  // ── Búsqueda individual ──
  useEffect(() => {
    if (busqueda.length < 2) { setResultados([]); return }
    setSearchLoading(true)
    const t = setTimeout(async () => {
      const data = await searchPersonas(busqueda)
      setResultados(data)
      setSearchLoading(false)
    }, 300)
    return () => clearTimeout(t)
  }, [busqueda])

  // ── Búsqueda grupal ──
  useEffect(() => {
    if (busqGrupal.length < 2) { setResultadosG([]); return }
    setSearchLoadingG(true)
    const t = setTimeout(async () => {
      const data = await searchPersonas(busqGrupal)
      // Excluir los ya agregados
      const ids = entries.map(e => e.socio.id_caif)
      setResultadosG(data.filter(s => !ids.includes(s.id_caif)))
      setSearchLoadingG(false)
    }, 300)
    return () => clearTimeout(t)
  }, [busqGrupal, entries])

  async function seleccionarInd(s) {
    setSocioSel(s)
    setMesesSel([])
    setBusqueda('')
    setResultados([])
    const data = await getPagosBySocio(s.id_caif)
    setPagosInd(data)
  }

  async function agregarAlGrupo(s) {
    setBusqGrupal('')
    setResultadosG([])
    const pagos = await getPagosBySocio(s.id_caif)
    setEntries(prev => [...prev, { socio: s, pagos, mesesSel: [], monto: CUOTA }])
  }

  function removerDelGrupo(id) {
    setEntries(prev => prev.filter(e => e.socio.id_caif !== id))
  }

  function toggleMesGrupal(socioId, mes) {
    setEntries(prev => prev.map(e => {
      if (e.socio.id_caif !== socioId) return e
      const sel = e.mesesSel.includes(mes)
        ? e.mesesSel.filter(m => m !== mes)
        : [...e.mesesSel, mes]
      return { ...e, mesesSel: sel }
    }))
  }

  function cambiarMontoGrupal(socioId, val) {
    setEntries(prev => prev.map(e =>
      e.socio.id_caif === socioId ? { ...e, monto: val } : e
    ))
  }

  // ── Registrar pago individual ──
  async function registrarInd() {
    if (!socioSel || mesesSel.length === 0) {
      setAlertInd({ type: 'error', msg: 'Selecciona al menos un mes.' }); return
    }
    setLoadingPago(true)
    try {
      let nextId = await getNextPagoId()
      const nuevos = []
      for (const mes of mesesSel) {
        const pago = {
          id_pago: nextId++, id_socio: socioSel.id_caif,
          periodo: anio * 100 + mes, fecha_pago: fecha,
          monto: Number(monto), tipo_pago: metodo,
          banco: null, num_transacc: numTrans || null,
          cuenta: 'CAIF', anio, mes,
        }
        const res = await insertPago(pago)
        nuevos.push(res)
      }
      setPagosInd(prev => [...prev, ...nuevos])
      setAlertInd({ type: 'success', msg: `✓ Pago registrado: ${mesesSel.map(m => MESES[m-1]).join(', ')} ${anio} — ${formatMoney(monto * mesesSel.length)}` })
      setMesesSel([])
      setNumTrans('')
    } catch (e) {
      setAlertInd({ type: 'error', msg: 'Error: ' + e.message })
    } finally {
      setLoadingPago(false)
      setTimeout(() => setAlertInd(null), 4000)
    }
  }

  // ── Registrar pagos grupales ──
  async function registrarGrupal() {
    const conMeses = entries.filter(e => e.mesesSel.length > 0)
    if (conMeses.length === 0) {
      setAlertG({ type: 'error', msg: 'Selecciona al menos un mes para algún socio.' }); return
    }
    setLoadingG(true)
    try {
      let nextId = await getNextPagoId()
      let totalRegistrado = 0
      for (const entry of conMeses) {
        for (const mes of entry.mesesSel) {
          const pago = {
            id_pago: nextId++, id_socio: entry.socio.id_caif,
            periodo: anioG * 100 + mes, fecha_pago: fechaG,
            monto: Number(entry.monto), tipo_pago: metodoG,
            banco: null, num_transacc: numTransG || null,
            cuenta: 'CAIF', anio: anioG, mes,
          }
          await insertPago(pago)
          totalRegistrado += Number(entry.monto)
        }
      }
      // Refrescar pagos de cada socio
      const updated = await Promise.all(
        entries.map(async e => ({
          ...e,
          pagos: await getPagosBySocio(e.socio.id_caif),
          mesesSel: []
        }))
      )
      setEntries(updated)
      const nombresStr = conMeses.map(e => e.socio.nombre_comp.split(' ')[0]).join(', ')
      setAlertG({ type: 'success', msg: `✓ Pagos registrados para: ${nombresStr} — Total: ${formatMoney(totalRegistrado)}` })
      setNumTransG('')
    } catch (e) {
      setAlertG({ type: 'error', msg: 'Error: ' + e.message })
    } finally {
      setLoadingG(false)
      setTimeout(() => setAlertG(null), 5000)
    }
  }

  async function eliminarPagoInd(idPago) {
    if (!confirm('¿Eliminar este pago?')) return
    await deletePago(idPago)
    setPagosInd(prev => prev.filter(p => p.id_pago !== idPago))
  }

  const pagosAnio = socioSel ? pagosPorSocioAnio(socioSel.id_caif, anio, pagosInd) : []
  const mesesPagados = pagosAnio.map(p => p.mes)
  const totalGrupal = entries.reduce((a, e) => a + e.monto * e.mesesSel.length, 0)
  const totalMesesGrupal = entries.reduce((a, e) => a + e.mesesSel.length, 0)

  return (
    <div className="content">
      {/* Selector de modo */}
      <div style={{display:'flex',gap:8,marginBottom:16}}>
        <button
          className={`btn ${modo==='individual'?'primary':''}`}
          onClick={() => setModo('individual')}
        >
          <i className="ti ti-user"></i>Pago individual
        </button>
        <button
          className={`btn ${modo==='grupal'?'primary':''}`}
          onClick={() => setModo('grupal')}
        >
          <i className="ti ti-users"></i>Pago grupal
        </button>
      </div>

      {/* ── MODO INDIVIDUAL ── */}
      {modo === 'individual' && (
        <>
          <div className="card">
            <div className="card-title"><i className="ti ti-search"></i>Buscar socio</div>
            <div style={{position:'relative'}}>
              <input type="text" placeholder="Nombre, apellido o ID..."
                value={busqueda} onChange={e => setBusqueda(e.target.value)}
                style={{width:'100%',padding:'9px 12px',border:'0.5px solid #e2e8f0',borderRadius:8,fontSize:14,fontFamily:'inherit'}}
              />
              {searchLoading && <div className="spinner" style={{position:'absolute',right:10,top:10,width:18,height:18}}></div>}
            </div>
            {resultados.length > 0 && (
              <div className="tbl-scroll" style={{marginTop:8}}>
                <table className="tbl">
                  <thead><tr><th style={{width:55}}>ID</th><th>Nombre</th><th style={{width:90}}>Tipo</th></tr></thead>
                  <tbody>
                    {resultados.map(s => (
                      <tr key={s.id_caif} style={{cursor:'pointer'}} onClick={() => seleccionarInd(s)}
                        className={socioSel?.id_caif === s.id_caif ? 'selected' : ''}>
                        <td>{s.id_caif}</td><td>{s.nombre_comp}</td>
                        <td><span className={`badge ${s.atleta==='Atleta Niño'?'nino':'adulto'}`}>{s.atleta==='Atleta Niño'?'Niño':'Adulto'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {socioSel && (
            <>
              <div className="socio-panel">
                <div>
                  <h3>{socioSel.nombre_comp}</h3>
                  <p>ID {socioSel.id_caif} · RUT {socioSel.rut}-{socioSel.dv} · {socioSel.atleta}{socioSel.apoderado ? ` · Apoderado: ${socioSel.apoderado}` : ''}</p>
                </div>
                <span className={`badge ${socioSel.atleta==='Atleta Niño'?'nino':'adulto'}`}>{socioSel.atleta==='Atleta Niño'?'👦 Niño':'👤 Adulto'}</span>
              </div>

              <div className="card">
                <div className="card-title"><i className="ti ti-calendar-check"></i>Registrar pago</div>
                <div className="year-tabs">
                  {AÑOS.map(a => <button key={a} className={`year-tab ${a===anio?'active':''}`} onClick={() => {setAnio(a);setMesesSel([])}}>{a}</button>)}
                </div>
                <p style={{fontSize:12,color:'var(--text-3)',marginBottom:8}}>Verde = pagado · Selecciona los meses a registrar</p>
                <div className="mes-grid">
                  {MESES.map((m,i) => {
                    const n=i+1, pagado=mesesPagados.includes(n), sel=mesesSel.includes(n)
                    return <button key={n} className={`mes-btn${pagado?' pagado':''}${sel?' sel':''}`}
                      onClick={() => !pagado && setMesesSel(prev => prev.includes(n)?prev.filter(x=>x!==n):[...prev,n])}
                      disabled={pagado}>{m.substring(0,3)}</button>
                  })}
                </div>
                <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'flex-end'}}>
                  <div className="form-group" style={{flex:'1',minWidth:150}}><label>Fecha de pago</label><input type="date" value={fecha} onChange={e=>setFecha(e.target.value)}/></div>
                  <div className="form-group" style={{flex:'1',minWidth:120}}><label>Monto por mes ($)</label><input type="number" value={monto} onChange={e=>setMonto(e.target.value)}/></div>
                  <div className="form-group" style={{flex:'1',minWidth:140}}><label>Método</label>
                    <select value={metodo} onChange={e=>setMetodo(e.target.value)}><option>Transferencia</option><option>Efectivo</option><option>Cheque</option></select>
                  </div>
                  {metodo==='Transferencia' && <div className="form-group" style={{flex:'1',minWidth:140}}><label>N° transacción</label><input type="text" value={numTrans} onChange={e=>setNumTrans(e.target.value)} placeholder="Opcional"/></div>}
                  <button className="btn primary" onClick={registrarInd} disabled={loadingPago||mesesSel.length===0} style={{marginBottom:1}}>
                    {loadingPago?<><div className="spinner" style={{width:14,height:14,borderWidth:2}}></div>Guardando...</>:<><i className="ti ti-check"></i>Registrar {mesesSel.length>0?`(${mesesSel.length})`:''}</>}
                  </button>
                </div>
                {alertInd && <div className={`alert ${alertInd.type}`}>{alertInd.msg}</div>}
              </div>

              <div className="card">
                <div className="card-title"><i className="ti ti-history"></i>Historial — {anio}</div>
                {pagosAnio.length===0 ? <div className="empty"><i className="ti ti-calendar-x"></i>Sin pagos en {anio}</div> : (
                  <div className="tbl-wrap">
                    <table className="tbl">
                      <thead><tr><th style={{width:90}}>Mes</th><th style={{width:100}}>Fecha</th><th style={{width:90}}>Monto</th><th style={{width:110}}>Método</th><th>N° Trans.</th><th style={{width:60}}></th></tr></thead>
                      <tbody>
                        {pagosAnio.sort((a,b)=>a.mes-b.mes).map(p=>(
                          <tr key={p.id_pago}>
                            <td>{MESES[p.mes-1]}</td><td>{p.fecha_pago||'—'}</td>
                            <td style={{color:'var(--success)',fontWeight:500}}>{formatMoney(p.monto)}</td>
                            <td>{p.tipo_pago}</td><td>{p.num_transacc||'—'}</td>
                            <td><button className="btn sm danger" onClick={()=>eliminarPagoInd(p.id_pago)}><i className="ti ti-trash"></i></button></td>
                          </tr>
                        ))}
                        <tr><td colSpan={2} style={{fontWeight:600}}>Total {anio}</td>
                          <td style={{fontWeight:600,color:'var(--success)'}}>{formatMoney(pagosAnio.reduce((a,p)=>a+p.monto,0))}</td>
                          <td colSpan={3}></td></tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* ── MODO GRUPAL ── */}
      {modo === 'grupal' && (
        <>
          <div className="card">
            <div className="card-title"><i className="ti ti-user-plus"></i>Agregar socios al pago grupal</div>
            <div style={{position:'relative'}}>
              <input type="text" placeholder="Buscar y agregar socios..."
                value={busqGrupal} onChange={e=>setBusqGrupal(e.target.value)}
                style={{width:'100%',padding:'9px 12px',border:'0.5px solid #e2e8f0',borderRadius:8,fontSize:14,fontFamily:'inherit'}}
              />
              {searchLoadingG && <div className="spinner" style={{position:'absolute',right:10,top:10,width:18,height:18}}></div>}
            </div>
            {resultadosG.length > 0 && (
              <div className="tbl-scroll" style={{marginTop:8}}>
                <table className="tbl">
                  <thead><tr><th style={{width:55}}>ID</th><th>Nombre</th><th style={{width:90}}>Tipo</th><th style={{width:80}}></th></tr></thead>
                  <tbody>
                    {resultadosG.map(s=>(
                      <tr key={s.id_caif}>
                        <td>{s.id_caif}</td><td>{s.nombre_comp}</td>
                        <td><span className={`badge ${s.atleta==='Atleta Niño'?'nino':'adulto'}`}>{s.atleta==='Atleta Niño'?'Niño':'Adulto'}</span></td>
                        <td><button className="btn sm primary" onClick={()=>agregarAlGrupo(s)}><i className="ti ti-plus"></i>Agregar</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {entries.length > 0 && (
            <>
              <div className="card">
                <div className="card-title"><i className="ti ti-calendar-check"></i>Seleccionar meses por socio</div>
                <div className="year-tabs">
                  {AÑOS.map(a=><button key={a} className={`year-tab ${a===anioG?'active':''}`} onClick={()=>{setAnioG(a);setEntries(prev=>prev.map(e=>({...e,mesesSel:[]})))}}>{a}</button>)}
                </div>
                {entries.map(entry=>(
                  <SocioGrupal key={entry.socio.id_caif} entry={entry} anio={anioG}
                    onRemove={removerDelGrupo} onToggleMes={toggleMesGrupal} onChangeMonto={cambiarMontoGrupal}/>
                ))}
              </div>

              <div className="card">
                <div className="card-title"><i className="ti ti-receipt"></i>Datos del pago grupal</div>
                <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'flex-end'}}>
                  <div className="form-group" style={{flex:'1',minWidth:150}}><label>Fecha de pago</label><input type="date" value={fechaG} onChange={e=>setFechaG(e.target.value)}/></div>
                  <div className="form-group" style={{flex:'1',minWidth:140}}><label>Método</label>
                    <select value={metodoG} onChange={e=>setMetodoG(e.target.value)}><option>Transferencia</option><option>Efectivo</option><option>Cheque</option></select>
                  </div>
                  {metodoG==='Transferencia' && <div className="form-group" style={{flex:'1',minWidth:140}}><label>N° transacción</label><input type="text" value={numTransG} onChange={e=>setNumTransG(e.target.value)} placeholder="Opcional"/></div>}
                </div>

                {totalMesesGrupal > 0 && (
                  <div style={{background:'#e8f5ee',border:'1px solid #a7f3d0',borderRadius:8,padding:'10px 14px',marginTop:12,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <span style={{fontSize:13,color:'#1a5e3a'}}>
                      <strong>{totalMesesGrupal}</strong> mes{totalMesesGrupal!==1?'es':''} para <strong>{entries.filter(e=>e.mesesSel.length>0).length}</strong> socio{entries.filter(e=>e.mesesSel.length>0).length!==1?'s':''}
                    </span>
                    <span style={{fontWeight:700,fontSize:16,color:'#1a5e3a'}}>{formatMoney(totalGrupal)}</span>
                  </div>
                )}

                <div style={{display:'flex',justifyContent:'flex-end',marginTop:12}}>
                  <button className="btn primary" onClick={registrarGrupal} disabled={loadingG||totalMesesGrupal===0}
                    style={{padding:'9px 24px'}}>
                    {loadingG?<><div className="spinner" style={{width:14,height:14,borderWidth:2}}></div>Guardando...</>
                      :<><i className="ti ti-check"></i>Registrar {totalMesesGrupal>0?`${totalMesesGrupal} pagos`:''}</>}
                  </button>
                </div>
                {alertG && <div className={`alert ${alertG.type}`}>{alertG.msg}</div>}
              </div>
            </>
          )}

          {entries.length === 0 && (
            <div className="card">
              <div className="empty"><i className="ti ti-users"></i>Busca y agrega los socios que comparten este pago</div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
