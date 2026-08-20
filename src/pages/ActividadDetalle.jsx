import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { formatMoney, nombreMostrar } from '../lib/helpers'

const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export default function ActividadDetalle({ actividad, onVolver }) {
  const [inscripciones, setInscripciones] = useState([])
  const [personas, setPersonas] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState([])
  const [modalPago, setModalPago] = useState(null)
  const [alert, setAlert] = useState(null)

  // Form inscripcion
  const [formInsc, setFormInsc] = useState({ num_referencia: '', monto: actividad.monto_default || '', obs: '' })
  const [socioSel, setSocioSel] = useState(null)
  const [savingInsc, setSavingInsc] = useState(false)

  // Form pago
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().split('T')[0])
  const [savingPago, setSavingPago] = useState(false)
  const [editandoRef, setEditandoRef] = useState(null) // id_inscripcion
  const [refTemp, setRefTemp] = useState('')
  const [savingRef, setSavingRef] = useState(false)
  const [editandoFecha, setEditandoFecha] = useState(null)
  const [fechaTemp, setFechaTemp] = useState('')
  const [savingFecha, setSavingFecha] = useState(false)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const [{ data: insc }, { data: pers }] = await Promise.all([
      supabase.from('actividad_inscripciones').select('*').eq('id_actividad', actividad.id_actividad).order('created_at'),
      supabase.from('personas').select('*').order('nombre_comp')
    ])
    const inscOrdenadas = (insc || []).sort((a,b) => {
      const na = a.num_referencia || ''
      const nb = b.num_referencia || ''
      // Intentar orden numérico, sino alfabético
      const numA = parseInt(na), numB = parseInt(nb)
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB
      return na.localeCompare(nb)
    })
    setInscripciones(inscOrdenadas)
    setPersonas(pers || [])
    setLoading(false)
  }

  // Buscar socio
  useEffect(() => {
    if (busqueda.length < 2) { setResultados([]); return }
    const q = busqueda.toLowerCase()
    const res = personas.filter(p =>
      (p.nombre_comp || '').toLowerCase().includes(q) ||
      String(p.id_caif).includes(q)
    ).slice(0, 8)
    setResultados(res)
  }, [busqueda, personas])

  async function inscribir() {
    if (!socioSel) { mostrarAlert('error', 'Selecciona un socio.'); return }
    if (!formInsc.num_referencia.trim()) { mostrarAlert('error', 'El numero de referencia es obligatorio.'); return }
    if (!formInsc.monto || Number(formInsc.monto) <= 0) { mostrarAlert('error', 'El monto debe ser mayor a 0.'); return }
    setSavingInsc(true)
    try {
      // Separar por coma para manejar múltiples rifas
      const numeros = formInsc.num_referencia.split(',').map(n => n.trim()).filter(Boolean)
      const registros = numeros.map(num => ({
        id_actividad: actividad.id_actividad,
        id_socio: socioSel.id_caif,
        num_referencia: num,
        monto: Number(formInsc.monto),
        pagado: false,
        obs: formInsc.obs || null
      }))
      await supabase.from('actividad_inscripciones').insert(registros)
      setSocioSel(null)
      setBusqueda('')
      setFormInsc({ num_referencia: '', monto: actividad.monto_default || '', obs: '' })
      mostrarAlert('success', numeros.length > 1 ? `${numeros.length} rifas asignadas.` : 'Rifa asignada.')
      cargar()
    } catch (e) { mostrarAlert('error', 'Error: ' + e.message) }
    finally { setSavingInsc(false) }
  }

  async function guardarRef(id_inscripcion) {
    if (!refTemp.trim()) return
    setSavingRef(true)
    await supabase.from('actividad_inscripciones').update({ num_referencia: refTemp.trim() }).eq('id_inscripcion', id_inscripcion)
    setEditandoRef(null)
    setSavingRef(false)
    cargar()
  }

  async function guardarFechaPago(id_inscripcion) {
    if (!fechaTemp) return
    setSavingFecha(true)
    await supabase.from('actividad_inscripciones').update({ fecha_pago: fechaTemp }).eq('id_inscripcion', id_inscripcion)
    setEditandoFecha(null)
    setSavingFecha(false)
    cargar()
  }

  async function registrarPago(insc) {
    setSavingPago(true)
    try {
      // Registrar en tabla pagos
      const { data: lastPago } = await supabase.from('pagos').select('id_pago').order('id_pago', { ascending: false }).limit(1)
      const nextId = (lastPago?.[0]?.id_pago || 0) + 1
      const hoy = new Date(fechaPago+'T12:00:00-04:00')
      await supabase.from('pagos').insert([{
        id_pago: nextId,
        id_socio: insc.id_socio,
        periodo: hoy.getFullYear() * 100 + (hoy.getMonth() + 1),
        fecha_pago: fechaPago,
        monto: insc.monto,
        tipo_pago: 'Transferencia',
        cuenta: 'CAIF',
        anio: hoy.getFullYear(),
        mes: hoy.getMonth() + 1,
        id_actividad: actividad.id_actividad,
        num_transacc: insc.num_referencia
      }])
      // Marcar como pagado en inscripciones
      await supabase.from('actividad_inscripciones').update({ pagado: true, fecha_pago: fechaPago }).eq('id_inscripcion', insc.id_inscripcion)
      setModalPago(null)
      mostrarAlert('success', 'Pago registrado.')
      cargar()
    } catch (e) { mostrarAlert('error', 'Error: ' + e.message) }
    finally { setSavingPago(false) }
  }

  async function eliminarInscripcion(insc) {
    if (!confirm(`Eliminar inscripcion de ${nombreSocio(insc.id_socio)}?`)) return
    if (insc.pagado) {
      mostrarAlert('error', 'No se puede eliminar: ya tiene pago registrado.')
      return
    }
    await supabase.from('actividad_inscripciones').delete().eq('id_inscripcion', insc.id_inscripcion)
    cargar()
  }

  function nombreSocio(idSocio) {
    const p = personas.find(p => p.id_caif === idSocio)
    return p ? (p.nombre_comp || `ID ${idSocio}`) : `ID ${idSocio}`
  }

  function mostrarAlert(type, msg) {
    setAlert({ type, msg })
    setTimeout(() => setAlert(null), 4000)
  }

  const totalPagados = inscripciones.filter(i => i.pagado).length
  const totalPendientes = inscripciones.filter(i => !i.pagado).length
  const montoPagado = inscripciones.filter(i => i.pagado).reduce((a, i) => a + i.monto, 0)
  const montoPendiente = inscripciones.filter(i => !i.pagado).reduce((a, i) => a + i.monto, 0)

  return (
    <div className="content">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button className="btn" onClick={onVolver}><i className="ti ti-arrow-left"></i>Volver</button>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, color: '#1a5e3a' }}>{actividad.nombre}</h2>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            Actividad de pago unico {actividad.monto_default ? `- ${formatMoney(actividad.monto_default)} por unidad` : ''}
          </div>
        </div>
      </div>

      {alert && <div className={`alert ${alert.type}`} style={{ marginBottom: 12 }}>{alert.msg}</div>}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Total asignados', val: inscripciones.length, color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
          { label: 'Pagaron', val: totalPagados, color: '#16a34a', bg: '#f0fdf4', border: '#a7f3d0' },
          { label: 'Pendientes', val: totalPendientes, color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
          { label: 'Recaudado', val: formatMoney(montoPagado), color: '#16a34a', bg: '#f0fdf4', border: '#a7f3d0' },
          { label: 'Por cobrar', val: formatMoney(montoPendiente), color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
        ].map((k, i) => (
          <div key={i} style={{ background: k.bg, border: `0.5px solid ${k.border}`, borderRadius: 10, padding: '10px 14px' }}>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: k.color }}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Formulario inscribir */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title"><i className="ti ti-user-plus"></i>Asignar a socio</div>
        <div className="form-grid">
          {/* Buscar socio */}
          <div className="form-group full" style={{ position: 'relative' }}>
            <label>Buscar socio *</label>
            {socioSel ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f0fdf4', border: '1.5px solid #1a5e3a', borderRadius: 8, padding: '8px 12px' }}>
                <span style={{ flex: 1, fontWeight: 600 }}>{nombreMostrar(socioSel)}</span>
                <button onClick={() => { setSocioSel(null); setBusqueda('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}>
                  <i className="ti ti-x"></i>
                </button>
              </div>
            ) : (
              <>
                <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Nombre o ID del socio..." />
                {resultados.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '0.5px solid #e2e8f0', borderRadius: 8, zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,.1)', maxHeight: 220, overflowY: 'auto' }}>
                    {resultados.map(p => (
                      <div key={p.id_caif} onClick={() => { setSocioSel(p); setBusqueda(''); setResultados([]) }}
                        style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '0.5px solid #f1f5f9' }}
                        className="hoverable">
                        <div style={{ fontWeight: 500 }}>{nombreMostrar(p)}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>ID {p.id_caif} · {p.atleta}</div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <div className="form-group">
            <label>N referencia (N rifa) *</label>
            <input value={formInsc.num_referencia} onChange={e => setFormInsc(f => ({ ...f, num_referencia: e.target.value }))}
              placeholder="Ej: 001  o  16, 51, 52 para varias" />
            <span style={{fontSize:11,color:'#64748b',marginTop:3,display:'block'}}>
              Para varias rifas separa con coma: <strong>16, 51, 52</strong>
            </span>
          </div>
          <div className="form-group">
            <label>Monto ($) *</label>
            <input type="number" value={formInsc.monto} onChange={e => setFormInsc(f => ({ ...f, monto: e.target.value }))} placeholder="0" />
          </div>
          <div className="form-group full">
            <label>Observaciones</label>
            <input value={formInsc.obs} onChange={e => setFormInsc(f => ({ ...f, obs: e.target.value }))} placeholder="Opcional" />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <button className="btn primary" onClick={inscribir} disabled={savingInsc || !socioSel}>
            {savingInsc ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }}></div>Guardando...</> : <><i className="ti ti-plus"></i>Asignar</>}
          </button>
        </div>
      </div>

      {/* Lista de inscripciones */}
      <div className="card">
        <div className="card-title"><i className="ti ti-list"></i>Listado de asignados</div>
        {loading ? (
          <div className="loading-center"><div className="spinner"></div></div>
        ) : inscripciones.length === 0 ? (
          <div className="empty"><i className="ti ti-ticket-off"></i>Sin asignaciones aun</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl" style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{minWidth:160}}>Socio</th>
                  <th style={{ width: 80, textAlign: 'right' }}>Monto</th>
                  <th style={{ width: 80 }}>Estado</th>
                  <th style={{ width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {inscripciones.map(insc => (
                  <tr key={insc.id_inscripcion}>
                    {/* Celda principal: nombre + numero + fecha + obs */}
                    <td>
                      <div style={{fontWeight:600,fontSize:13}}>{nombreSocio(insc.id_socio)}</div>
                      <div style={{display:'flex',gap:6,alignItems:'center',marginTop:3,flexWrap:'wrap'}}>
                        {editandoRef === insc.id_inscripcion ? (
                          <div style={{display:'flex',gap:4,alignItems:'center'}}>
                            <input value={refTemp} onChange={e=>setRefTemp(e.target.value)}
                              onKeyDown={e=>{if(e.key==='Enter')guardarRef(insc.id_inscripcion);if(e.key==='Escape')setEditandoRef(null)}}
                              autoFocus style={{width:70,padding:'3px 6px',border:'1.5px solid #1a5e3a',borderRadius:6,fontSize:12,fontFamily:'monospace'}}/>
                            <button className="btn sm" onClick={()=>guardarRef(insc.id_inscripcion)} disabled={savingRef}
                              style={{padding:'3px 6px',background:'#1a5e3a',color:'#fff',borderColor:'#1a5e3a'}}>
                              {savingRef?'...':<i className="ti ti-check"></i>}
                            </button>
                            <button className="btn sm" onClick={()=>setEditandoRef(null)} style={{padding:'3px 6px'}}>
                              <i className="ti ti-x"></i>
                            </button>
                          </div>
                        ) : (
                          <div style={{display:'flex',alignItems:'center',gap:4}}>
                            <span style={{fontFamily:'monospace',fontWeight:700,color:'#1d4ed8',fontSize:13}}>#{insc.num_referencia}</span>
                            <button className="btn sm" onClick={()=>{setEditandoRef(insc.id_inscripcion);setRefTemp(insc.num_referencia)}}
                              title="Editar numero" style={{padding:'1px 4px',fontSize:10,color:'#64748b',borderColor:'#e2e8f0',background:'#f8fafc'}}>
                              <i className="ti ti-pencil"></i>
                            </button>
                          </div>
                        )}
                        {insc.fecha_pago && (
                          editandoFecha === insc.id_inscripcion ? (
                            <div style={{display:'flex',gap:4,alignItems:'center'}}>
                              <input type="date" value={fechaTemp} onChange={e=>setFechaTemp(e.target.value)}
                                onKeyDown={e=>{if(e.key==='Enter')guardarFechaPago(insc.id_inscripcion);if(e.key==='Escape')setEditandoFecha(null)}}
                                autoFocus style={{width:120,padding:'3px 6px',border:'1.5px solid #1a5e3a',borderRadius:6,fontSize:11}}/>
                              <button className="btn sm" onClick={()=>guardarFechaPago(insc.id_inscripcion)} disabled={savingFecha}
                                style={{padding:'3px 6px',background:'#1a5e3a',color:'#fff',borderColor:'#1a5e3a'}}>
                                {savingFecha?'...':<i className="ti ti-check"></i>}
                              </button>
                              <button className="btn sm" onClick={()=>setEditandoFecha(null)} style={{padding:'3px 6px'}}>
                                <i className="ti ti-x"></i>
                              </button>
                            </div>
                          ) : (
                            <span style={{fontSize:11,color:'var(--text-3)',cursor:'pointer'}}
                              onClick={()=>{setEditandoFecha(insc.id_inscripcion);setFechaTemp(insc.fecha_pago||'')}}
                              title="Editar fecha">
                              {insc.fecha_pago} <i className="ti ti-pencil" style={{fontSize:9}}></i>
                            </span>
                          )
                        )}
                        {insc.obs && <span style={{fontSize:11,color:'var(--text-3)',fontStyle:'italic'}}>{insc.obs}</span>}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', color: insc.pagado ? '#16a34a' : '#d97706', fontWeight: 600, whiteSpace:'nowrap' }}>{formatMoney(insc.monto)}</td>
                    <td>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 4, whiteSpace:'nowrap',
                        background: insc.pagado ? '#f0fdf4' : '#fef2f2',
                        color: insc.pagado ? '#16a34a' : '#dc2626',
                        border: `0.5px solid ${insc.pagado ? '#a7f3d0' : '#fecaca'}`
                      }}>
                        {insc.pagado ? 'Pagado' : 'Pendiente'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        {!insc.pagado && (
                          <button className="btn sm primary"
                            onClick={() => { setModalPago(insc); setFechaPago(new Date().toISOString().split('T')[0]) }}
                            title="Registrar pago" style={{ padding: '5px 10px' }}>
                            <i className="ti ti-cash"></i>
                          </button>
                        )}
                        {insc.pagado && !editandoFecha && (
                          <button className="btn sm" onClick={()=>{setEditandoFecha(insc.id_inscripcion);setFechaTemp(insc.fecha_pago||'')}}
                            title="Editar fecha de pago"
                            style={{padding:'5px 8px',color:'#16a34a',borderColor:'#a7f3d0',background:'#f0fdf4'}}>
                            <i className="ti ti-calendar-edit"></i>
                          </button>
                        )}
                        {!insc.pagado && (
                          <button className="btn sm danger"
                            onClick={() => eliminarInscripcion(insc)}
                            title="Eliminar inscripcion" style={{ padding: '5px 8px' }}>
                            <i className="ti ti-trash"></i>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal registrar pago */}
      {modalPago && (
        <div className="modal-bg open" onClick={e => e.target === e.currentTarget && setModalPago(null)}>
          <div className="modal">
            <div className="modal-header">
              <h2>Registrar pago</h2>
              <button className="modal-close" onClick={() => setModalPago(null)}>&times;</button>
            </div>
            <div style={{ background: '#f0fdf4', border: '0.5px solid #a7f3d0', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
              <div style={{ fontWeight: 600 }}>{nombreSocio(modalPago.id_socio)}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                {actividad.nombre} · N {modalPago.num_referencia} · {formatMoney(modalPago.monto)}
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label>Fecha de pago</label>
              <input type="date" value={fechaPago} onChange={e => setFechaPago(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setModalPago(null)}>Cancelar</button>
              <button className="btn primary" onClick={() => registrarPago(modalPago)} disabled={savingPago}>
                {savingPago ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }}></div>Registrando...</> : <><i className="ti ti-check"></i>Confirmar pago</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
