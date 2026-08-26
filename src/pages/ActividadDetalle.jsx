import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { formatMoney } from '../lib/helpers'

export default function ActividadDetalle({ actividad, onVolver }) {
  const [inscripciones, setInscripciones] = useState([])
  const [asistentes, setAsistentes] = useState([]) // todos los asistentes
  const [personas, setPersonas] = useState([])
  const [loading, setLoading] = useState(true)
  const [alert, setAlert] = useState(null)

  // Form pagador
  const [busquedaPagador, setBusquedaPagador] = useState('')
  const [resultadosPagador, setResultadosPagador] = useState([])
  const [pagadorSel, setPagadorSel] = useState(null)

  // Lista de asistentes del pagador actual
  const [listaAsistentes, setListaAsistentes] = useState([]) // [{tipo:'socio'|'externo', socio, nombre, id_temp}]
  const [busquedaAsistente, setBusquedaAsistente] = useState('')
  const [resultadosAsistente, setResultadosAsistente] = useState([])
  const [nombreExterno, setNombreExterno] = useState('')
  const [tipoAsistente, setTipoAsistente] = useState('socio')
  const [tipoExterno, setTipoExterno] = useState('adulto')

  // Form pago
  const [monto, setMonto] = useState(actividad.monto_default ? String(actividad.monto_default) : '')
  const [numRef, setNumRef] = useState('')
  const [obs, setObs] = useState('')
  const [saving, setSaving] = useState(false)

  // Modal pago
  const [modalPago, setModalPago] = useState(null)
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().split('T')[0])
  const [savingPago, setSavingPago] = useState(false)

  // Edición inline
  const [editandoRef, setEditandoRef] = useState(null)
  const [refTemp, setRefTemp] = useState('')
  const [savingRef, setSavingRef] = useState(false)
  const [editandoFecha, setEditandoFecha] = useState(null)
  const [fechaTemp, setFechaTemp] = useState('')
  const [savingFecha, setSavingFecha] = useState(false)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const [{ data: insc }, { data: asis }, { data: pers }] = await Promise.all([
      supabase.from('actividad_inscripciones').select('*').eq('id_actividad', actividad.id_actividad).order('created_at'),
      supabase.from('actividad_asistentes').select('*'),
      supabase.from('personas').select('id_caif,nombre_comp,atleta').order('nombre_comp')
    ])
    // Ordenar por num_referencia
    const inscOrdenadas = (insc || []).sort((a, b) => {
      const na = a.num_referencia || '', nb = b.num_referencia || ''
      const numA = parseInt(na), numB = parseInt(nb)
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB
      return na.localeCompare(nb)
    })
    setInscripciones(inscOrdenadas)
    setAsistentes(asis || [])
    setPersonas(pers || [])
    setLoading(false)
  }

  // Buscar pagador
  useEffect(() => {
    if (busquedaPagador.length < 2) { setResultadosPagador([]); return }
    const q = busquedaPagador.toLowerCase()
    setResultadosPagador(personas.filter(p => (p.nombre_comp||'').toLowerCase().includes(q) || String(p.id_caif).includes(q)).slice(0, 6))
  }, [busquedaPagador, personas])

  // Buscar asistente socio
  useEffect(() => {
    if (busquedaAsistente.length < 2) { setResultadosAsistente([]); return }
    const q = busquedaAsistente.toLowerCase()
    setResultadosAsistente(personas.filter(p => (p.nombre_comp||'').toLowerCase().includes(q) || String(p.id_caif).includes(q)).slice(0, 6))
  }, [busquedaAsistente, personas])

  function agregarAsistente() {
    if (tipoAsistente === 'socio') {
      const sel = resultadosAsistente.find(p => busquedaAsistente.toLowerCase() === (p.nombre_comp||'').toLowerCase())
      return // se maneja por clic en resultados
    }
    if (tipoAsistente === 'externo' && nombreExterno.trim()) {
      const id_temp = Date.now()
      setListaAsistentes(prev => [...prev, { tipo: 'externo', nombre: nombreExterno.trim(), id_temp }])
      setNombreExterno('')
    }
  }

  function agregarSocioAsistente(p) {
    const tipoP = p.atleta && p.atleta.includes('Ni') ? 'nino' : 'adulto'
    setListaAsistentes(prev => [...prev, { tipo: 'socio', socio: p, nombre: p.nombre_comp, tipoPersona: tipoP, id_temp: Date.now() }])
    setBusquedaAsistente(''); setResultadosAsistente([])
  }

  function quitarAsistente(id_temp) {
    setListaAsistentes(prev => prev.filter(a => a.id_temp !== id_temp))
  }

  // Calcular monto total automático
  const cantAsistentes = listaAsistentes.length
  const montoDefault = actividad.monto_default || 0
  const montoTotal = cantAsistentes > 0 && montoDefault > 0 ? cantAsistentes * montoDefault : Number(monto) || 0

  async function registrar() {
    if (!pagadorSel) { mostrarAlert('error', 'Selecciona al pagador.'); return }
    if (listaAsistentes.length === 0) { mostrarAlert('error', 'Agrega al menos un asistente.'); return }
    if (montoTotal <= 0) { mostrarAlert('error', 'El monto debe ser mayor a 0.'); return }
    setSaving(true)
    try {
      // Crear inscripción para el pagador
      const { data: inscData } = await supabase.from('actividad_inscripciones').insert([{
        id_actividad: actividad.id_actividad,
        id_socio: pagadorSel.id_caif,
        id_socio_pagador: pagadorSel.id_caif,
        num_referencia: numRef || null,
        monto: montoTotal,
        pagado: false,
        obs: obs || null
      }]).select().single()

      // Registrar asistentes
      const asistentesData = listaAsistentes.map(a => ({
        id_inscripcion: inscData.id_inscripcion,
        id_socio: a.tipo === 'socio' ? a.socio.id_caif : null,
        nombre_asistente: a.tipo === 'externo' ? a.nombre : null,
        tipo: a.tipoPersona || 'adulto'
      }))
      await supabase.from('actividad_asistentes').insert(asistentesData)

      // Reset
      setPagadorSel(null); setBusquedaPagador(''); setListaAsistentes([])
      setNumRef(''); setObs(''); setMonto(actividad.monto_default ? String(actividad.monto_default) : '')
      mostrarAlert('success', `Registrado: ${pagadorSel.nombre_comp} - ${listaAsistentes.length} asistente${listaAsistentes.length!==1?'s':''} - ${formatMoney(montoTotal)}`)
      cargar()
    } catch(e) { mostrarAlert('error', 'Error: ' + e.message) }
    finally { setSaving(false) }
  }

  async function registrarPago(insc) {
    setSavingPago(true)
    try {
      const { data: lastP } = await supabase.from('pagos').select('id_pago').order('id_pago', { ascending: false }).limit(1)
      const nextId = (lastP?.[0]?.id_pago || 0) + 1
      const fp = new Date(fechaPago + 'T12:00:00-04:00')
      await supabase.from('pagos').insert([{
        id_pago: nextId, id_socio: insc.id_socio,
        periodo: fp.getFullYear() * 100 + (fp.getMonth() + 1),
        fecha_pago: fechaPago, monto: insc.monto,
        tipo_pago: 'Transferencia', cuenta: 'CAIF',
        anio: fp.getFullYear(), mes: fp.getMonth() + 1,
        id_actividad: actividad.id_actividad,
        num_transacc: insc.num_referencia
      }])
      await supabase.from('actividad_inscripciones').update({ pagado: true, fecha_pago: fechaPago }).eq('id_inscripcion', insc.id_inscripcion)
      setModalPago(null)
      mostrarAlert('success', 'Pago registrado.')
      cargar()
    } catch(e) { mostrarAlert('error', 'Error: ' + e.message) }
    finally { setSavingPago(false) }
  }

  async function eliminarInscripcion(insc) {
    if (insc.pagado) { mostrarAlert('error', 'No se puede eliminar: ya tiene pago registrado.'); return }
    if (!confirm('Eliminar este registro?')) return
    await supabase.from('actividad_asistentes').delete().eq('id_inscripcion', insc.id_inscripcion)
    await supabase.from('actividad_inscripciones').delete().eq('id_inscripcion', insc.id_inscripcion)
    cargar()
  }

  async function guardarRef(id_inscripcion) {
    if (!refTemp.trim()) return
    setSavingRef(true)
    await supabase.from('actividad_inscripciones').update({ num_referencia: refTemp.trim() }).eq('id_inscripcion', id_inscripcion)
    setEditandoRef(null); setSavingRef(false); cargar()
  }

  async function guardarFechaPago(id_inscripcion) {
    if (!fechaTemp) return
    setSavingFecha(true)
    await supabase.from('actividad_inscripciones').update({ fecha_pago: fechaTemp }).eq('id_inscripcion', id_inscripcion)
    setEditandoFecha(null); setSavingFecha(false); cargar()
  }

  function nombrePagador(insc) {
    const p = personas.find(p => p.id_caif === insc.id_socio)
    return p ? p.nombre_comp : `ID ${insc.id_socio}`
  }

  function tipoDeAsistente(a) {
    if (a.tipo) return a.tipo
    if (a.id_socio) {
      const p = personas.find(p => p.id_caif === a.id_socio)
      return p?.atleta && p.atleta.includes('Ni') ? 'nino' : 'adulto'
    }
    return 'adulto'
  }

  function asistentesDeInsc(id_inscripcion) {
    return asistentes.filter(a => a.id_inscripcion === id_inscripcion)
  }

  function mostrarAlert(type, msg) {
    setAlert({ type, msg })
    setTimeout(() => setAlert(null), 4000)
  }

  const totalPagados = inscripciones.filter(i => i.pagado).length
  const totalPendientes = inscripciones.filter(i => !i.pagado).length
  const montoPagado = inscripciones.filter(i => i.pagado).reduce((a, i) => a + i.monto, 0)
  const montoPendiente = inscripciones.filter(i => !i.pagado).reduce((a, i) => a + i.monto, 0)
  const totalAsistentes = inscripciones.reduce((a, i) => a + asistentesDeInsc(i.id_inscripcion).length, 0)
  const totalAdultos = asistentes.filter(a => tipoDeAsistente(a) === 'adulto').length
  const totalNinos = asistentes.filter(a => tipoDeAsistente(a) === 'nino').length

  return (
    <div className="content">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button className="btn" onClick={onVolver}><i className="ti ti-arrow-left"></i>Volver</button>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, color: '#1a5e3a' }}>{actividad.nombre}</h2>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            {actividad.monto_default ? `$${Number(actividad.monto_default).toLocaleString('es-CL')} por persona` : 'Actividad de pago unico'}
          </div>
        </div>
      </div>

      {alert && <div className={`alert ${alert.type}`} style={{ marginBottom: 12 }}>{alert.msg}</div>}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Pagadores', val: inscripciones.length, color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
          { label: 'Asistentes', val: totalAsistentes, color: '#7c3aed', bg: '#faf5ff', border: '#ddd6fe' },
          { label: 'Adultos', val: totalAdultos, color: '#0369a1', bg: '#f0f9ff', border: '#bae6fd' },
          { label: 'Ninos', val: totalNinos, color: '#c026d3', bg: '#fdf4ff', border: '#f5d0fe' },
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

      {/* Formulario registro */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title"><i className="ti ti-user-plus"></i>Registrar pago</div>

        {/* 1. Pagador */}
        <div className="form-group" style={{ position: 'relative', marginBottom: 12 }}>
          <label style={{ fontWeight: 700 }}>1. Quien paga *</label>
          {pagadorSel ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#eff6ff', border: '1.5px solid #1a5e3a', borderRadius: 8, padding: '8px 12px' }}>
              <span style={{ flex: 1, fontWeight: 600 }}>{pagadorSel.nombre_comp}</span>
              <button onClick={() => { setPagadorSel(null); setBusquedaPagador('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}>
                <i className="ti ti-x"></i>
              </button>
            </div>
          ) : (
            <>
              <input value={busquedaPagador} onChange={e => setBusquedaPagador(e.target.value)} placeholder="Buscar socio pagador..." />
              {resultadosPagador.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '0.5px solid #e2e8f0', borderRadius: 8, zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,.1)', maxHeight: 200, overflowY: 'auto' }}>
                  {resultadosPagador.map(p => (
                    <div key={p.id_caif} onClick={() => { setPagadorSel(p); setBusquedaPagador(''); setResultadosPagador([]) }}
                      style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '0.5px solid #f1f5f9' }} className="hoverable">
                      <div style={{ fontWeight: 500 }}>{p.nombre_comp}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{p.atleta}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* 2. Asistentes */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontWeight: 700, display: 'block', marginBottom: 8 }}>2. Asistentes que cubre *</label>

          {/* Lista de asistentes agregados */}
          {listaAsistentes.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {listaAsistentes.map(a => (
                <div key={a.id_temp} style={{ display: 'flex', alignItems: 'center', gap: 6, background: a.tipo === 'socio' ? '#f0fdf4' : '#eff6ff', border: `0.5px solid ${a.tipo === 'socio' ? '#a7f3d0' : '#bfdbfe'}`, borderRadius: 6, padding: '4px 10px', fontSize: 12 }}>
                  <i className={`ti ${a.tipo === 'socio' ? 'ti-user' : 'ti-user-question'}`} style={{ fontSize: 11, color: a.tipo === 'socio' ? '#16a34a' : '#1d4ed8' }}></i>
                  <span style={{ fontWeight: 500 }}>{a.nombre}</span>
                  <span style={{fontSize:9,color:'#94a3b8'}}>({a.tipoPersona==='nino'?'N':'A'})</span>
                  <button onClick={() => quitarAsistente(a.id_temp)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: 0, lineHeight: 1 }}>
                    <i className="ti ti-x" style={{ fontSize: 11 }}></i>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Agregar asistente */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            {['socio', 'externo'].map(t => (
              <button key={t} type="button" onClick={() => { setTipoAsistente(t); setBusquedaAsistente(''); setNombreExterno('') }}
                style={{ padding: '5px 12px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, border: `1.5px solid ${tipoAsistente === t ? '#1a5e3a' : '#e2e8f0'}`, background: tipoAsistente === t ? '#f0fdf4' : '#f8fafc', color: tipoAsistente === t ? '#1a5e3a' : '#64748b' }}>
                {t === 'socio' ? 'Socio' : 'Externo'}
              </button>
            ))}
          </div>

          {tipoAsistente === 'socio' && (
            <div style={{ position: 'relative' }}>
              <input value={busquedaAsistente} onChange={e => setBusquedaAsistente(e.target.value)} placeholder="Buscar socio asistente..." />
              {resultadosAsistente.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '0.5px solid #e2e8f0', borderRadius: 8, zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,.1)', maxHeight: 180, overflowY: 'auto' }}>
                  {resultadosAsistente.map(p => (
                    <div key={p.id_caif} onClick={() => agregarSocioAsistente(p)}
                      style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '0.5px solid #f1f5f9' }} className="hoverable">
                      <div style={{ fontWeight: 500 }}>{p.nombre_comp}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tipoAsistente === 'externo' && (
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={tipoExterno} onChange={e => setTipoExterno(e.target.value)} style={{width:100}}>
                <option value="adulto">Adulto</option>
                <option value="nino">Nino</option>
              </select>
              <input value={nombreExterno} onChange={e => setNombreExterno(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && nombreExterno.trim() && (setListaAsistentes(prev => [...prev, { tipo: 'externo', nombre: nombreExterno.trim(), tipoPersona: tipoExterno, id_temp: Date.now() }]), setNombreExterno(''))}
                placeholder="Nombre del asistente externo..." style={{ flex: 1 }} />
              <button className="btn" onClick={() => { if (nombreExterno.trim()) { setListaAsistentes(prev => [...prev, { tipo: 'externo', nombre: nombreExterno.trim(), tipoPersona: tipoExterno, id_temp: Date.now() }]); setNombreExterno('') } }}
                disabled={!nombreExterno.trim()}>
                <i className="ti ti-plus"></i>Agregar
              </button>
            </div>
          )}
        </div>

        {/* 3. Monto y referencia */}
        <div className="form-grid">
          <div className="form-group">
            <label style={{ fontWeight: 700 }}>3. Monto total ($) *</label>
            <input type="number" value={cantAsistentes > 0 && montoDefault > 0 ? montoTotal : monto}
              onChange={e => setMonto(e.target.value)}
              readOnly={cantAsistentes > 0 && montoDefault > 0}
              style={{ background: cantAsistentes > 0 && montoDefault > 0 ? '#f0fdf4' : '#fff' }} />
            {cantAsistentes > 0 && montoDefault > 0 && (
              <span style={{ fontSize: 11, color: '#16a34a', marginTop: 3, display: 'block' }}>
                {cantAsistentes} x {formatMoney(montoDefault)} = {formatMoney(montoTotal)}
              </span>
            )}
          </div>
          <div className="form-group">
            <label>N referencia <span style={{ fontSize: 11, color: '#94a3b8' }}>(opcional)</span></label>
            <input value={numRef} onChange={e => setNumRef(e.target.value)} placeholder="Ej: 001" />
          </div>
          <div className="form-group full">
            <label>Observaciones</label>
            <input value={obs} onChange={e => setObs(e.target.value)} placeholder="Opcional" />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <button className="btn primary" onClick={registrar} disabled={saving || !pagadorSel || listaAsistentes.length === 0}>
            {saving ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }}></div>Guardando...</> : <><i className="ti ti-check"></i>Registrar {listaAsistentes.length > 0 ? `(${listaAsistentes.length} asistente${listaAsistentes.length !== 1 ? 's' : ''} - ${formatMoney(montoTotal)})` : ''}</>}
          </button>
        </div>
      </div>

      {/* Lista */}
      <div className="card">
        <div className="card-title"><i className="ti ti-list"></i>Listado de registros</div>
        {loading ? (
          <div className="loading-center"><div className="spinner"></div></div>
        ) : inscripciones.length === 0 ? (
          <div className="empty"><i className="ti ti-ticket-off"></i>Sin registros aun</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl" style={{ fontSize: 12, minWidth: 500 }}>
              <thead>
                <tr>
                  <th style={{ minWidth: 160 }}>Pagador / Asistentes</th>
                  <th style={{ width: 90, textAlign: 'right' }}>Monto</th>
                  <th style={{ width: 80 }}>Estado</th>
                  <th style={{ width: 80 }}>Fecha pago</th>
                  <th style={{ width: 90 }}></th>
                </tr>
              </thead>
              <tbody>
                {inscripciones.map(insc => {
                  const asistInsc = asistentesDeInsc(insc.id_inscripcion)
                  return (
                    <tr key={insc.id_inscripcion}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{nombrePagador(insc)}</div>
                        {asistInsc.length > 0 && (
                          <div style={{ marginTop: 3, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {asistInsc.map((a, i) => {
                              const nombre = a.id_socio ? (personas.find(p => p.id_caif === a.id_socio)?.nombre_comp || `ID ${a.id_socio}`) : a.nombre_asistente
                              return (
                                <span key={i} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: a.id_socio ? '#f0fdf4' : '#eff6ff', color: a.id_socio ? '#16a34a' : '#1d4ed8', border: `0.5px solid ${a.id_socio ? '#a7f3d0' : '#bfdbfe'}` }}>
                                  {nombre}
                                </span>
                              )
                            })}
                          </div>
                        )}
                        {insc.num_referencia && (
                          <div style={{ marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                            {editandoRef === insc.id_inscripcion ? (
                              <>
                                <input value={refTemp} onChange={e => setRefTemp(e.target.value)}
                                  onKeyDown={e => { if (e.key === 'Enter') guardarRef(insc.id_inscripcion); if (e.key === 'Escape') setEditandoRef(null) }}
                                  autoFocus style={{ width: 70, padding: '2px 6px', border: '1.5px solid #1a5e3a', borderRadius: 6, fontSize: 11, fontFamily: 'monospace' }} />
                                <button className="btn sm" onClick={() => guardarRef(insc.id_inscripcion)} style={{ padding: '2px 6px', background: '#1a5e3a', color: '#fff', borderColor: '#1a5e3a' }}><i className="ti ti-check"></i></button>
                                <button className="btn sm" onClick={() => setEditandoRef(null)} style={{ padding: '2px 6px' }}><i className="ti ti-x"></i></button>
                              </>
                            ) : (
                              <span style={{ fontSize: 10, color: '#64748b', cursor: 'pointer' }} onClick={() => { setEditandoRef(insc.id_inscripcion); setRefTemp(insc.num_referencia) }}>
                                #{insc.num_referencia} <i className="ti ti-pencil" style={{ fontSize: 9 }}></i>
                              </span>
                            )}
                          </div>
                        )}
                        {insc.obs && <div style={{ fontSize: 10, color: '#94a3b8', fontStyle: 'italic', marginTop: 2 }}>{insc.obs}</div>}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: insc.pagado ? '#16a34a' : '#d97706' }}>{formatMoney(insc.monto)}</td>
                      <td>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: insc.pagado ? '#f0fdf4' : '#fef2f2', color: insc.pagado ? '#16a34a' : '#dc2626', border: `0.5px solid ${insc.pagado ? '#a7f3d0' : '#fecaca'}` }}>
                          {insc.pagado ? 'Pagado' : 'Pendiente'}
                        </span>
                      </td>
                      <td style={{ fontSize: 11 }}>
                        {editandoFecha === insc.id_inscripcion ? (
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            <input type="date" value={fechaTemp} onChange={e => setFechaTemp(e.target.value)} autoFocus
                              style={{ width: 110, padding: '2px 4px', border: '1.5px solid #1a5e3a', borderRadius: 6, fontSize: 10 }} />
                            <button className="btn sm" onClick={() => guardarFechaPago(insc.id_inscripcion)} style={{ padding: '2px 4px', background: '#1a5e3a', color: '#fff', borderColor: '#1a5e3a' }}><i className="ti ti-check"></i></button>
                            <button className="btn sm" onClick={() => setEditandoFecha(null)} style={{ padding: '2px 4px' }}><i className="ti ti-x"></i></button>
                          </div>
                        ) : (
                          <span style={{ cursor: 'pointer', color: 'var(--text-3)' }} onClick={() => { setEditandoFecha(insc.id_inscripcion); setFechaTemp(insc.fecha_pago || '') }}>
                            {insc.fecha_pago || '-'} <i className="ti ti-pencil" style={{ fontSize: 9 }}></i>
                          </span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          {!insc.pagado && (
                            <button className="btn sm primary" onClick={() => { setModalPago(insc); setFechaPago(new Date().toISOString().split('T')[0]) }}
                              title="Registrar pago" style={{ padding: '5px 8px' }}>
                              <i className="ti ti-cash"></i>
                            </button>
                          )}
                          {insc.pagado && (
                            <button className="btn sm" onClick={() => { setEditandoFecha(insc.id_inscripcion); setFechaTemp(insc.fecha_pago || '') }}
                              title="Editar fecha" style={{ padding: '5px 8px', color: '#16a34a', borderColor: '#a7f3d0', background: '#f0fdf4' }}>
                              <i className="ti ti-calendar-edit"></i>
                            </button>
                          )}
                          {!insc.pagado && (
                            <button className="btn sm danger" onClick={() => eliminarInscripcion(insc)} title="Eliminar" style={{ padding: '5px 8px' }}>
                              <i className="ti ti-trash"></i>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal pago */}
      {modalPago && (
        <div className="modal-bg open" onClick={e => e.target === e.currentTarget && setModalPago(null)}>
          <div className="modal">
            <div className="modal-header">
              <h2>Registrar pago</h2>
              <button className="modal-close" onClick={() => setModalPago(null)}>&times;</button>
            </div>
            <div style={{ background: '#f0fdf4', border: '0.5px solid #a7f3d0', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
              <div style={{ fontWeight: 600 }}>{nombrePagador(modalPago)}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{actividad.nombre} · {formatMoney(modalPago.monto)}</div>
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
