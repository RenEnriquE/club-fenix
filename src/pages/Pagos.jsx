import { useState, useEffect, useCallback } from 'react'
import { searchPersonas, getPagosBySocio, insertPago, deletePago, getNextPagoId } from '../lib/supabase'
import { MESES, AÑOS, pagosPorSocioAnio, formatMoney } from '../lib/helpers'

export default function Pagos() {
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState([])
  const [socioSel, setSocioSel] = useState(null)
  const [pagos, setPagos] = useState([])
  const [anio, setAnio] = useState(new Date().getFullYear())
  const [mesesSel, setMesesSel] = useState([])
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [monto, setMonto] = useState(3000)
  const [metodo, setMetodo] = useState('Transferencia')
  const [banco, setBanco] = useState('')
  const [numTrans, setNumTrans] = useState('')
  const [alert, setAlert] = useState(null)
  const [loadingPago, setLoadingPago] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)

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

  async function seleccionar(s) {
    setSocioSel(s)
    setMesesSel([])
    setBusqueda('')
    setResultados([])
    const data = await getPagosBySocio(s.id_caif)
    setPagos(data)
  }

  function toggleMes(m) {
    const pagosAnio = pagosPorSocioAnio(socioSel.id_caif, anio, pagos)
    if (pagosAnio.some(p => p.mes === m)) return
    setMesesSel(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])
  }

  async function registrar() {
    if (!socioSel || mesesSel.length === 0) {
      setAlert({ type: 'error', msg: 'Selecciona al menos un mes.' }); return
    }
    setLoadingPago(true)
    try {
      let nextId = await getNextPagoId()
      const nuevos = []
      for (const mes of mesesSel) {
        const pago = {
          id_pago: nextId++,
          id_socio: socioSel.id_caif,
          periodo: anio * 100 + mes,
          fecha_pago: fecha,
          monto: Number(monto),
          tipo_pago: metodo,
          banco: banco || null,
          num_transacc: numTrans || null,
          cuenta: 'CAIF',
          anio,
          mes,
        }
        const res = await insertPago(pago)
        nuevos.push(res)
      }
      setPagos(prev => [...prev, ...nuevos])
      const nombMeses = mesesSel.map(m => MESES[m - 1]).join(', ')
      setAlert({ type: 'success', msg: `✓ Pago registrado: ${nombMeses} ${anio} — ${formatMoney(monto * mesesSel.length)}` })
      setMesesSel([])
      setNumTrans('')
    } catch (e) {
      setAlert({ type: 'error', msg: 'Error al registrar: ' + e.message })
    } finally {
      setLoadingPago(false)
      setTimeout(() => setAlert(null), 4000)
    }
  }

  async function eliminarPago(idPago) {
    if (!confirm('¿Eliminar este pago?')) return
    await deletePago(idPago)
    setPagos(prev => prev.filter(p => p.id_pago !== idPago))
  }

  const pagosAnio = socioSel ? pagosPorSocioAnio(socioSel.id_caif, anio, pagos) : []
  const mesesPagados = pagosAnio.map(p => p.mes)

  return (
    <div className="content">
      {/* Búsqueda */}
      <div className="card">
        <div className="card-title"><i className="ti ti-search"></i>Buscar socio</div>
        <div style={{position:'relative'}}>
          <input
            type="text"
            placeholder="Nombre, apellido o ID del socio..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            style={{width:'100%',padding:'9px 12px',border:'0.5px solid #e2e8f0',borderRadius:8,fontSize:14,fontFamily:'inherit'}}
          />
          {searchLoading && <div className="spinner" style={{position:'absolute',right:10,top:10,width:18,height:18}}></div>}
        </div>
        {resultados.length > 0 && (
          <div className="tbl-scroll" style={{marginTop:8}}>
            <table className="tbl">
              <thead><tr>
                <th style={{width:55}}>ID</th><th>Nombre completo</th>
                <th style={{width:90}}>Tipo</th>
              </tr></thead>
              <tbody>
                {resultados.map(s => (
                  <tr key={s.id_caif} style={{cursor:'pointer'}} onClick={() => seleccionar(s)}
                    className={socioSel?.id_caif === s.id_caif ? 'selected' : ''}>
                    <td>{s.id_caif}</td>
                    <td>{s.nombre_comp}</td>
                    <td><span className={`badge ${s.atleta === 'Atleta Niño' ? 'nino' : 'adulto'}`}>{s.atleta === 'Atleta Niño' ? 'Niño' : 'Adulto'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Panel socio seleccionado */}
      {socioSel && (
        <>
          <div className="socio-panel">
            <div>
              <h3>{socioSel.nombre_comp}</h3>
              <p>ID {socioSel.id_caif} · RUT {socioSel.rut}-{socioSel.dv} · {socioSel.atleta}
                {socioSel.apoderado ? ` · Apoderado: ${socioSel.apoderado}` : ''}
              </p>
            </div>
            <span className={`badge ${socioSel.atleta === 'Atleta Niño' ? 'nino' : 'adulto'}`}>
              {socioSel.atleta === 'Atleta Niño' ? '👦 Niño' : '👤 Adulto'}
            </span>
          </div>

          {/* Registro de pago */}
          <div className="card">
            <div className="card-title"><i className="ti ti-calendar-check"></i>Registrar pago</div>

            <div className="year-tabs">
              {AÑOS.map(a => (
                <button key={a} className={`year-tab ${a === anio ? 'active' : ''}`}
                  onClick={() => { setAnio(a); setMesesSel([]) }}>
                  {a}
                </button>
              ))}
            </div>

            <p style={{fontSize:12,color:'var(--text-3)',marginBottom:8}}>
              Verde = pagado · Selecciona los meses a registrar
            </p>

            <div className="mes-grid">
              {MESES.map((m, i) => {
                const n = i + 1
                const pagado = mesesPagados.includes(n)
                const sel = mesesSel.includes(n)
                return (
                  <button key={n} className={`mes-btn${pagado ? ' pagado' : ''}${sel ? ' sel' : ''}`}
                    onClick={() => toggleMes(n)} disabled={pagado} title={pagado ? 'Ya registrado' : ''}>
                    {m.substring(0, 3)}
                  </button>
                )
              })}
            </div>

            <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'flex-end'}}>
              <div className="form-group" style={{flex:'1',minWidth:150}}>
                <label>Fecha de pago</label>
                <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
              </div>
              <div className="form-group" style={{flex:'1',minWidth:120}}>
                <label>Monto por mes ($)</label>
                <input type="number" value={monto} onChange={e => setMonto(e.target.value)} />
              </div>
              <div className="form-group" style={{flex:'1',minWidth:140}}>
                <label>Método de pago</label>
                <select value={metodo} onChange={e => setMetodo(e.target.value)}>
                  <option>Transferencia</option>
                  <option>Efectivo</option>
                  <option>Cheque</option>
                </select>
              </div>
              {metodo === 'Transferencia' && (
                <div className="form-group" style={{flex:'1',minWidth:140}}>
                  <label>N° transacción</label>
                  <input type="text" value={numTrans} onChange={e => setNumTrans(e.target.value)} placeholder="Opcional" />
                </div>
              )}
              <button className="btn primary" onClick={registrar} disabled={loadingPago || mesesSel.length === 0}
                style={{marginBottom:1}}>
                {loadingPago ? <><div className="spinner" style={{width:14,height:14,borderWidth:2}}></div>Guardando...</> : <><i className="ti ti-check"></i>Registrar {mesesSel.length > 0 ? `(${mesesSel.length})` : ''}</>}
              </button>
            </div>

            {alert && <div className={`alert ${alert.type}`}>{alert.msg}</div>}
          </div>

          {/* Historial de pagos */}
          <div className="card">
            <div className="card-title"><i className="ti ti-history"></i>Historial de pagos — {anio}</div>
            {pagosAnio.length === 0 ? (
              <div className="empty"><i className="ti ti-calendar-x"></i>Sin pagos registrados en {anio}</div>
            ) : (
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead><tr>
                    <th style={{width:80}}>Mes</th>
                    <th style={{width:100}}>Fecha</th>
                    <th style={{width:90}}>Monto</th>
                    <th style={{width:110}}>Método</th>
                    <th>N° Trans.</th>
                    <th style={{width:60}}></th>
                  </tr></thead>
                  <tbody>
                    {pagosAnio.sort((a,b) => a.mes - b.mes).map(p => (
                      <tr key={p.id_pago}>
                        <td>{MESES[p.mes - 1]}</td>
                        <td>{p.fecha_pago || '—'}</td>
                        <td style={{color:'var(--success)',fontWeight:500}}>{formatMoney(p.monto)}</td>
                        <td>{p.tipo_pago}</td>
                        <td>{p.num_transacc || '—'}</td>
                        <td>
                          <button className="btn sm danger" onClick={() => eliminarPago(p.id_pago)} title="Eliminar pago">
                            <i className="ti ti-trash"></i>
                          </button>
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={2} style={{fontWeight:600}}>Total {anio}</td>
                      <td style={{fontWeight:600,color:'var(--success)'}}>{formatMoney(pagosAnio.reduce((a,p) => a + p.monto, 0))}</td>
                      <td colSpan={3}></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
