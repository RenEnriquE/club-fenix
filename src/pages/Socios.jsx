import { useState, useEffect } from 'react'
import { supabase, insertPersona, updatePersona } from '../lib/supabase'
import { estadoSocio, mesesAlDia, mesesPendientes, estadoLabel, MESES, nombreMostrar, cuotaEsperada } from '../lib/helpers'

const ANIO_ACTUAL = new Date().getFullYear()

export default function Socios({ isAdmin }) {
  const [personas, setPersonas] = useState([])
  const [pagos, setPagos] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [ordenMorosidad, setOrdenMorosidad] = useState('') // '' | 'morosos-primero' | 'al-dia-primero'
  const [filtroVigente, setFiltroVigente] = useState('1') // '1'=activos, '0'=inactivos, ''=todos
  const [modalOpen, setModalOpen] = useState(false)
  const [modalReingreso, setModalReingreso] = useState(null)
  const [modalWA, setModalWA] = useState(null) // { socio, mensaje, numero }
  const [editCelular, setEditCelular] = useState(null) // id_caif del socio editando celular
  const [celularTemp, setCelularTemp] = useState('')
  const [savingCelular, setSavingCelular] = useState(false) // socio a reingresar
  const [fechaReingreso, setFechaReingreso] = useState('')
  const [savingReingreso, setSavingReingreso] = useState(false)
  const [modalHistorial, setModalHistorial] = useState(null) // socio a ver historial
  const [historial, setHistorial] = useState([])
  const [loadingHistorial, setLoadingHistorial] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [alert, setAlert] = useState(null)
  const [saving, setSaving] = useState(false)
  const [tabModal, setTabModal] = useState('datos')
  const [showDuplicados, setShowDuplicados] = useState(false)
  const [duplicados, setDuplicados] = useState([]) // 'datos' | 'salida'

  function emptyForm() {
    return {
      apodo:'', nombre:'', seg_nombre:'', apellido:'', ap_mat:'', rut:'', dv:'',
      fecha_nac:'', genero:'Masculino', atleta:'Atleta Adulto',
      celular:'', email:'', apoderado:'', vigente:1,
      f_ini_vig:'', f_fin_vig:'', causa_salida:'', f_reingreso:''
    }
  }

  useEffect(() => {
    cargar()
  }, [])


  function detectarDuplicados() {
    const grupos = {}
    personas.forEach(p => {
      const rut = (p.rut || '').trim()
      if (!rut || rut === '0') return
      if (!grupos[rut]) grupos[rut] = []
      grupos[rut].push(p)
    })
    const dups = Object.values(grupos).filter(g => g.length > 1)
    setDuplicados(dups)
    setShowDuplicados(true)
  }

  async function cargar() {
    setLoading(true)
    try {
      const [resP, resPg] = await Promise.all([
        supabase.from('personas').select('*').order('id_caif', { ascending: false }),
        supabase.from('pagos').select('id_socio,mes,anio,monto,id_actividad').eq('anio', ANIO_ACTUAL)
      ])
      setPersonas(resP.data || [])
      setPagos(resPg.data || [])
    } finally {
      setLoading(false)
    }
  }

  function calcMesesDeuda(p) {
    if (p.atleta === 'Apoderado') return -999 // siempre al final
    const hoyS = new Date()
    const diaS = hoyS.getDate()
    const mesVigenteS = diaS <= 5 ? hoyS.getMonth() : hoyS.getMonth() + 1
    const anioActualS = hoyS.getFullYear()
    const fechaRefS = p.f_reingreso || p.f_ini_vig
    const mesDesdeS = fechaRefS ? (() => {
      const d = new Date(fechaRefS + 'T12:00:00-04:00')
      return d.getFullYear() === anioActualS ? d.getMonth() + 1 : 1
    })() : 1
    const mesesDebidosS = Math.max(0, mesVigenteS - mesDesdeS + 1)
    const mesesPagadosS = pagos.filter(pg => pg.id_socio === p.id_caif && pg.anio === anioActualS && Number(pg.id_actividad) === 0).length
    return mesesDebidosS - mesesPagadosS // positivo = debe, negativo = pagó a futuro
  }

  const listaFiltrada = personas.filter(p => {
    const nc = (p.nombre_comp || '').toLowerCase()
    const q = busqueda.toLowerCase()
    const matchQ = !q || nc.includes(q) || String(p.id_caif).includes(q)
    const matchT = !filtroTipo || p.atleta === filtroTipo
    const matchV = filtroVigente === '' || String(p.vigente) === filtroVigente
    const est = estadoSocio(p.id_caif, pagos, p.atleta, p)
    const matchE = !filtroEstado || est === filtroEstado
    return matchQ && matchT && matchV && matchE
  })

  const lista = ordenMorosidad === ''
    ? listaFiltrada
    : [...listaFiltrada].sort((a, b) => {
        const deudaA = calcMesesDeuda(a)
        const deudaB = calcMesesDeuda(b)
        return ordenMorosidad === 'morosos-primero'
          ? deudaB - deudaA  // mayor deuda primero
          : deudaA - deudaB  // menor deuda (mas al dia) primero
      })

  async function guardarCelular(idCaif) {
    setSavingCelular(true)
    await supabase.from('personas').update({ celular: celularTemp.trim() }).eq('id_caif', idCaif)
    setPersonas(prev => prev.map(p => p.id_caif === idCaif ? {...p, celular: celularTemp.trim()} : p))
    setEditCelular(null)
    setSavingCelular(false)
  }

  function abrirModalWA(s, mesesDeuda) {
    const celular = (s.celular || '').replace(/[^0-9]/g, '')
    if (!celular) { alert('Este socio no tiene celular registrado.'); return }
    const numero = celular.startsWith('56') ? celular : '56' + celular
    const primerNombre = s.nombre || (s.nombre_comp || '').split(' ')[0]
    const mesesTexto = mesesDeuda === 1 ? '1 mes' : `${mesesDeuda} meses`
    const mensaje = `Hola ${primerNombre}! Esperamos que estes bien. Te contactamos desde el Club Atletico Independencia Fenix para informarte que, de acuerdo a nuestros registros, tienes ${mesesTexto} de cuotas pendientes de pago.

Si ya realizaste algun pago o tienes alguna consulta, no dudes en comunicarte con nosotros. Muchas gracias por ser parte de la familia Fenix!`
    setModalWA({ socio: s, mensaje, numero })
  }

  function enviarWhatsApp() {
    const url = 'https://wa.me/' + modalWA.numero + '?text=' + encodeURIComponent(modalWA.mensaje)
    const a = document.createElement('a')
    a.href = url
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setModalWA(null)
  }

  function abrirModal(socio = null) {
    setTabModal('datos')
    if (socio) {
      setEditando(socio)
      setForm({
        apodo: socio.apodo || '', nombre: socio.nombre || '', seg_nombre: socio.seg_nombre || '',
        apellido: socio.apellido || '', ap_mat: socio.ap_mat || '',
        rut: socio.rut || '', dv: socio.dv || '',
        fecha_nac: socio.fecha_nac || '', genero: socio.genero || 'Masculino',
        atleta: socio.atleta || 'Atleta Adulto', celular: socio.celular || '',
        email: socio.email || '', apoderado: socio.apoderado || '',
        vigente: socio.vigente ?? 1,
        f_ini_vig: socio.f_ini_vig || '',
        f_fin_vig: socio.f_fin_vig || '',
        causa_salida: socio.causa_salida || '',
        f_reingreso: socio.f_reingreso || ''
      })
    } else {
      setEditando(null)
      setForm(emptyForm())
    }
    setAlert(null)
    setModalOpen(true)
  }

  function f(key) {
    return { value: form[key], onChange: e => setForm(prev => ({ ...prev, [key]: e.target.value })) }
  }

  async function guardar() {
    if (!form.nombre || !form.apellido || !form.rut) {
      setAlert({ type: 'error', msg: 'Nombre, apellido y RUT son obligatorios.' }); return
    }
    setSaving(true)
    try {
      // Calcular nombre_comp con formato apodo
      const nombreBase = [form.nombre, form.seg_nombre, form.apellido, form.ap_mat].filter(Boolean).join(' ')
      const apodoVal = (form.apodo || '').trim()
      const nombreVal = (form.nombre || '').trim()
      const nombre_comp = apodoVal && apodoVal.toLowerCase() !== nombreVal.toLowerCase()
        ? `${apodoVal} - ${nombreBase}`
        : nombreBase
      const datos = {
        ...form,
        nombre_comp,
        f_fin_vig: form.f_fin_vig || null,
        causa_salida: form.causa_salida || null,
        f_ini_vig: form.f_ini_vig || null,
        f_reingreso: form.f_reingreso || null,
      }
      if (editando) {
        await updatePersona(editando.id_caif, datos)
        setPersonas(prev => prev.map(p => p.id_caif === editando.id_caif ? { ...p, ...datos } : p))
        setAlert({ type: 'success', msg: '✓ Datos actualizados.' })
      } else {
        const maxId = Math.max(...personas.map(p => p.id_caif), 330)
        const nuevo = { ...datos, id_caif: maxId + 1, f_ini_vig: new Date().toISOString().split('T')[0] }
        const res = await insertPersona(nuevo)
        setPersonas(prev => [res, ...prev])
        setAlert({ type: 'success', msg: `✓ Socio registrado con ID ${res.id_caif}.` })
        setForm(emptyForm())
      }
    } catch (e) {
      setAlert({ type: 'error', msg: 'Error: ' + e.message })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="content"><div className="loading-center"><div className="spinner"></div><span>Cargando...</span></div></div>
  )

  const activos = personas.filter(p => p.vigente === 1).length
  const inactivos = personas.filter(p => p.vigente !== 1).length

  async function abrirReingreso(socio) {
    setModalReingreso(socio)
    setFechaReingreso(new Date().toISOString().split('T')[0])
  }

  async function confirmarReingreso() {
    if (!fechaReingreso) return
    setSavingReingreso(true)
    try {
      // 1. Guardar ciclo anterior en historial_vigencia
      await supabase.from('historial_vigencia').insert([{
        id_socio: modalReingreso.id_caif,
        f_inicio: modalReingreso.f_ini_vig || null,
        f_fin: modalReingreso.f_fin_vig || null,
        causa_salida: modalReingreso.causa_salida || null
      }])
      // 2. Actualizar persona: vigente=1, f_reingreso, limpiar f_fin_vig y causa_salida
      await supabase.from('personas').update({
        vigente: 1,
        f_reingreso: fechaReingreso,
        f_ini_vig: fechaReingreso,
        f_fin_vig: null,
        causa_salida: null
      }).eq('id_caif', modalReingreso.id_caif)
      setModalReingreso(null)
      cargar()
    } catch(e) {
      alert('Error: ' + e.message)
    } finally {
      setSavingReingreso(false)
    }
  }

  async function abrirHistorial(socio) {
    setModalHistorial(socio)
    setLoadingHistorial(true)
    const { data } = await supabase
      .from('historial_vigencia')
      .select('*')
      .eq('id_socio', socio.id_caif)
      .order('f_inicio', { ascending: false })
    setHistorial(data || [])
    setLoadingHistorial(false)
  }

  return (
    <div className="content">
      {/* Filtros */}
      <div style={{display:'flex',gap:10,marginBottom:12,flexWrap:'wrap',alignItems:'center'}}>
        <div className="search-bar" style={{flex:1,margin:0}}>
          <input type="text" placeholder="Buscar por nombre o ID..." value={busqueda} onChange={e=>setBusqueda(e.target.value)}/>
          <select value={filtroTipo} onChange={e=>setFiltroTipo(e.target.value)}>
            <option value="">Todos los tipos</option>
            <option value="Atleta Adulto">Adultos</option>
            <option value="Atleta Niño">Niños</option>
            <option value="Apoderado">Apoderados</option>
          </select>
          <select value={filtroVigente} onChange={e=>setFiltroVigente(e.target.value)}>
            <option value="1">Activos ({activos})</option>
            <option value="0">Inactivos ({inactivos})</option>
            <option value="">Todos</option>
          </select>
          {filtroVigente === '1' && (
            <select value={filtroEstado} onChange={e=>setFiltroEstado(e.target.value)}>
              <option value="">Todos los estados</option>
              <option value="al-dia">Al dia</option>
              <option value="parcial">Parcial</option>
              <option value="moroso">Moroso</option>
            </select>
          )}
          {filtroVigente === '1' && (
            <select value={ordenMorosidad} onChange={e=>setOrdenMorosidad(e.target.value)}
              style={{padding:'6px 10px',border:'0.5px solid #e2e8f0',borderRadius:8,fontSize:13,fontFamily:'inherit',background:'#fff'}}>
              <option value="">Orden: nombre</option>
              <option value="morosos-primero">Orden: mas morosos primero</option>
              <option value="al-dia-primero">Orden: mas al dia primero</option>
            </select>
          )}
        </div>
        {isAdmin && (
          <div style={{display:'flex',gap:8}}>
            <button className="btn" onClick={detectarDuplicados}>
              <i className="ti ti-copy-off"></i>Ver duplicados
            </button>
            <button className="btn primary" onClick={() => abrirModal()}>
              <i className="ti ti-user-plus"></i>Nuevo socio
            </button>
          </div>
        )}
      </div>

      <div style={{fontSize:12,color:'var(--text-3)',marginBottom:8}}>
        Mostrando {lista.length} de {personas.length} socios
      </div>

      <div className="card" style={{padding:0}}>
        <div className="tbl-wrap" style={{overflowX:'auto'}}>
          <table className="tbl" style={{minWidth:320}}>
            <thead>
              <tr>
                <th style={{minWidth:200}}>Nombre</th>
                <th style={{width:22}}></th>
                {filtroVigente !== '0' && <th style={{width:40}}></th>}
                {isAdmin && <th style={{width:80}}></th>}
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 ? (
                <tr><td colSpan={7} className="empty">Sin resultados</td></tr>
              ) : lista.map(s => {
                const est = estadoSocio(s.id_caif, pagos, s.atleta, s)
                const meses = mesesAlDia(s.id_caif, ANIO_ACTUAL, pagos)
                const esInactivo = s.vigente !== 1
                // Meses que debe pagar: desde ingreso hasta mes vigente (con gracia 5 dias)
                const hoyS = new Date()
                const diaS = hoyS.getDate()
                const mesVigenteS = diaS <= 5 ? hoyS.getMonth() : hoyS.getMonth() + 1
                const fechaRefS = s.f_reingreso || s.f_ini_vig
                const mesDesdeS = fechaRefS ? (() => {
                  const d = new Date(fechaRefS + 'T12:00:00-04:00')
                  return d.getFullYear() === ANIO_ACTUAL ? d.getMonth() + 1 : 1
                })() : 1
                const mesesDebidos = Math.max(0, mesVigenteS - mesDesdeS + 1)
                return (
                  <tr key={s.id_caif} style={{opacity: esInactivo ? 0.7 : 1}}>
                    <td style={{fontWeight:500}} title={nombreMostrar(s)}>
                      <div style={{display:'flex',flexDirection:'column',gap:2}}>
                        <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:195,display:'block'}}>{nombreMostrar(s)}</span>
                        <div style={{display:'flex',gap:4,alignItems:'center'}}>
                          {esInactivo && <span style={{fontSize:10,color:'#94a3b8'}}>Inactivo</span>}
                          <span style={{fontSize:10,color:'var(--text-3)'}}>
                            {s.atleta==='Atleta Niño'?'N':s.atleta==='Apoderado'?'Apod':'A'} · ID {s.id_caif}
                          </span>
                        </div>
                        {/* Celular editable inline */}
                        {isAdmin && (
                          editCelular === s.id_caif ? (
                            <div style={{display:'flex',gap:4,alignItems:'center',marginTop:2}}>
                              <input
                                value={celularTemp}
                                onChange={e=>setCelularTemp(e.target.value)}
                                onKeyDown={e=>{ if(e.key==='Enter') guardarCelular(s.id_caif); if(e.key==='Escape') setEditCelular(null) }}
                                placeholder="9XXXXXXXX"
                                autoFocus
                                style={{width:105,padding:'3px 6px',border:'1.5px solid #1a5e3a',borderRadius:6,fontSize:11,fontFamily:'inherit'}}
                              />
                              <button className="btn sm" onClick={()=>guardarCelular(s.id_caif)} disabled={savingCelular}
                                style={{padding:'3px 6px',background:'#1a5e3a',color:'#fff',borderColor:'#1a5e3a'}}>
                                {savingCelular ? '...' : <i className="ti ti-check"></i>}
                              </button>
                              <button className="btn sm" onClick={()=>setEditCelular(null)} style={{padding:'3px 6px'}}>
                                <i className="ti ti-x"></i>
                              </button>
                            </div>
                          ) : (
                            <div style={{display:'flex',alignItems:'center',gap:4,cursor:'pointer',marginTop:1}}
                              onClick={()=>{ setEditCelular(s.id_caif); setCelularTemp(s.celular||'') }}>
                              {s.celular
                                ? <span style={{fontSize:11,color:'var(--text-3)'}}>{s.celular}</span>
                                : <span style={{fontSize:11,color:'#94a3b8',fontStyle:'italic'}}>sin celular</span>
                              }
                              <i className="ti ti-pencil" style={{fontSize:10,color:'#cbd5e1'}}></i>
                            </div>
                          )
                        )}
                      </div>
                    </td>
                    {/* Punto de color segun estado */}
                    <td style={{textAlign:'center'}}>
                      <span title={estadoLabel(est)} style={{
                        display:'inline-block', width:10, height:10, borderRadius:'50%',
                        background: est==='al-dia'?'#16a34a': est==='moroso'?'#dc2626':'#d97706'
                      }}></span>
                    </td>
                    {filtroVigente !== '0' && (
                      <td style={{color:meses>=mesesDebidos?'#16a34a':meses===0?'#dc2626':'#d97706',fontWeight:600,fontSize:12,whiteSpace:'nowrap'}}>
                        {meses}/{mesesDebidos}
                      </td>
                    )}
                    {filtroVigente === '0' && (
                      <td style={{color:'var(--text-2)',fontSize:12}}>
                        {s.f_fin_vig ? new Date(s.f_fin_vig+'T12:00:00-04:00').toLocaleDateString('es-CL') : '—'}
                      </td>
                    )}
                    {filtroVigente === '0' && (
                      <td style={{color:'var(--text-2)',fontSize:12}}>{s.causa_salida || '—'}</td>
                    )}
                    {isAdmin && (
                      <td>
                        <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                          <button className="btn sm" onClick={() => abrirModal(s)}><i className="ti ti-edit"></i>Editar</button>
                          {s.vigente !== 1 && (
                            <button className="btn sm primary" onClick={() => abrirReingreso(s)} title="Reingresar al club">
                              <i className="ti ti-user-check"></i>Reingresar
                            </button>
                          )}
                          {s.vigente === 1 && est === 'moroso' && s.atleta !== 'Apoderado' && (
                            <button className="btn sm" onClick={() => abrirModalWA(s, mesesDebidos - meses)}
                              title="Enviar mensaje WhatsApp"
                              style={{color:'#16a34a',borderColor:'#a7f3d0',background:'#f0fdf4'}}>
                              <i className="ti ti-brand-whatsapp"></i>
                            </button>
                          )}
                          <button className="btn sm" onClick={() => abrirHistorial(s)} title="Ver historial de vigencia"
                            style={{color:'#7c3aed',borderColor:'#ddd6fe',background:'#faf5ff'}}>
                            <i className="ti ti-history"></i>
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <div className={`modal-bg ${modalOpen?'open':''}`} onClick={e=>{if(e.target===e.currentTarget)setModalOpen(false)}}>
        <div className="modal">
          <div className="modal-header">
            <h2><i className="ti ti-user" style={{marginRight:8,color:'var(--accent)'}}></i>{editando?'Editar socio':'Nuevo socio'}</h2>
            <button className="modal-close" onClick={()=>setModalOpen(false)}><i className="ti ti-x"></i></button>
          </div>

          {/* Tabs del modal */}
          <div style={{display:'flex',gap:4,marginBottom:16,borderBottom:'0.5px solid #e2e8f0',paddingBottom:8}}>
            {[['datos','Datos personales'],['salida','Vigencia y salida']].map(([k,lbl])=>(
              <button key={k} onClick={()=>setTabModal(k)}
                style={{padding:'5px 14px',borderRadius:6,border:'0.5px solid #e2e8f0',fontSize:13,cursor:'pointer',fontFamily:'inherit',
                  background:tabModal===k?'var(--accent)':'#f8fafc',color:tabModal===k?'#fff':'var(--text-2)'}}>
                {lbl}
              </button>
            ))}
          </div>

          {/* Tab datos personales */}
          {tabModal === 'datos' && (
            <div className="form-grid">
              <div className="form-group full"><label>Apodo (nombre que se muestra)</label><input type="text" placeholder="Si es distinto al nombre" {...f('apodo')}/></div>
              <div className="form-group"><label>Nombre *</label><input type="text" {...f('nombre')}/></div>
              <div className="form-group"><label>Segundo nombre</label><input type="text" {...f('seg_nombre')}/></div>
              <div className="form-group"><label>Apellido *</label><input type="text" {...f('apellido')}/></div>
              <div className="form-group"><label>Segundo apellido</label><input type="text" {...f('ap_mat')}/></div>
              <div className="form-group"><label>RUT *</label><input type="text" {...f('rut')}/></div>
              <div className="form-group"><label>DV</label><input type="text" maxLength={1} {...f('dv')}/></div>
              <div className="form-group"><label>Fecha de nacimiento</label><input type="date" {...f('fecha_nac')}/></div>
              <div className="form-group"><label>Género</label>
                <select {...f('genero')}><option>Masculino</option><option>Femenino</option><option>Otro</option></select>
              </div>
              <div className="form-group"><label>Tipo de atleta</label>
                <select {...f('atleta')}><option>Atleta Adulto</option><option>Atleta Niño</option><option>Apoderado</option></select>
              </div>
              <div className="form-group"><label>Celular</label><input type="text" {...f('celular')}/></div>
              <div className="form-group full"><label>Email</label><input type="email" {...f('email')}/></div>
              <div className="form-group full"><label>Apoderado</label><input type="text" {...f('apoderado')}/></div>
            </div>
          )}

          {/* Tab vigencia y salida */}
          {tabModal === 'salida' && (
            <div className="form-grid">
              <div className="form-group"><label>Estado</label>
                <select value={form.vigente} onChange={e=>setForm(p=>({...p,vigente:Number(e.target.value)}))}>
                  <option value={1}>Activo</option>
                  <option value={0}>Inactivo</option>
                </select>
              </div>

              {/* Fecha de ingreso con alerta si esta vacia */}
              <div className="form-group">
                <label style={{display:'flex',alignItems:'center',gap:6}}>
                  Fecha de ingreso
                  {!form.f_ini_vig && <span style={{fontSize:10,background:'#fffbeb',color:'#92400e',padding:'1px 6px',borderRadius:4,border:'0.5px solid #fde68a',fontWeight:600}}>Sin fecha</span>}
                </label>
                <input type="date" {...f('f_ini_vig')}
                  style={{border:`1.5px solid ${!form.f_ini_vig?'#f59e0b':'#e2e8f0'}`,borderRadius:8,padding:'8px 10px',fontSize:13,fontFamily:'inherit',background:!form.f_ini_vig?'#fffbeb':'#fff'}}/>
              </div>

              {/* Fecha de salida con alerta si inactivo y vacia */}
              <div className="form-group">
                <label style={{display:'flex',alignItems:'center',gap:6}}>
                  Fecha de salida
                  {form.vigente===0 && !form.f_fin_vig && <span style={{fontSize:10,background:'#fef2f2',color:'#dc2626',padding:'1px 6px',borderRadius:4,border:'0.5px solid #fecaca',fontWeight:600}}>Requerida</span>}
                </label>
                <input type="date" {...f('f_fin_vig')}
                  style={{border:`1.5px solid ${form.vigente===0&&!form.f_fin_vig?'#dc2626':'#e2e8f0'}`,borderRadius:8,padding:'8px 10px',fontSize:13,fontFamily:'inherit',background:form.vigente===0&&!form.f_fin_vig?'#fef2f2':'#fff'}}/>
              </div>

              {/* Causa de salida con alerta si inactivo y vacia */}
              <div className="form-group">
                <label style={{display:'flex',alignItems:'center',gap:6}}>
                  Causa de salida
                  {form.vigente===0 && !form.causa_salida && <span style={{fontSize:10,background:'#fef2f2',color:'#dc2626',padding:'1px 6px',borderRadius:4,border:'0.5px solid #fecaca',fontWeight:600}}>Requerida</span>}
                </label>
                <select {...f('causa_salida')}
                  style={{border:`1.5px solid ${form.vigente===0&&!form.causa_salida?'#dc2626':'#e2e8f0'}`,borderRadius:8,padding:'8px 10px',fontSize:13,fontFamily:'inherit',background:form.vigente===0&&!form.causa_salida?'#fef2f2':'#fff'}}>
                  <option value="">Sin especificar</option>
                  <option>Decision propia</option>
                  <option>Inf Favio</option>
                  <option>Expulsado</option>
                  <option>Traslado</option>
                  <option>Economica</option>
                  <option>Otra</option>
                </select>
              </div>
              {form.causa_salida === 'Otra' && (
                <div className="form-group full"><label>Especificar causa</label><input type="text" {...f('causa_salida')}/></div>
              )}

              {/* Fecha de reingreso (solo lectura si existe, editable si es necesario) */}
              <div className="form-group">
                <label style={{display:'flex',alignItems:'center',gap:6}}>
                  Fecha de reingreso
                  {form.f_reingreso && <span style={{fontSize:10,background:'#f0fdf4',color:'#16a34a',padding:'1px 6px',borderRadius:4,border:'0.5px solid #a7f3d0',fontWeight:600}}>Reingresado</span>}
                </label>
                <input type="date" {...f('f_reingreso')}
                  style={{border:'1.5px solid #e2e8f0',borderRadius:8,padding:'8px 10px',fontSize:13,fontFamily:'inherit'}}/>
              </div>

              {/* Resumen de pagos del socio */}
              {editando && (
                <div className="form-group full">
                  <label>Resumen de pagos {ANIO_ACTUAL}</label>
                  <div style={{background:'#f8fafc',border:'0.5px solid #e2e8f0',borderRadius:8,padding:'10px 12px',fontSize:13}}>
                    {(() => {
                      const m = mesesAlDia(editando.id_caif, ANIO_ACTUAL, pagos)
                      const personaConForm = {...editando, f_reingreso: form.f_reingreso||editando.f_reingreso, f_ini_vig: form.f_ini_vig||editando.f_ini_vig}
                      const est = estadoSocio(editando.id_caif, pagos, editando.atleta, personaConForm)
                      return (
                        <div style={{display:'flex',gap:12,alignItems:'center'}}>
                          <span className={`badge ${est}`}>{estadoLabel(est)}</span>
                          <span style={{color:'var(--text-2)'}}>{m} meses pagados en {ANIO_ACTUAL}</span>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}

          {alert && <div className={`alert ${alert.type}`}>{alert.msg}</div>}
          <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:16}}>
            <button className="btn" onClick={()=>setModalOpen(false)}>Cancelar</button>
            <button className="btn primary" onClick={guardar} disabled={saving}>
              {saving?<><div className="spinner" style={{width:14,height:14,borderWidth:2}}></div>Guardando...</>
                :<><i className="ti ti-check"></i>{editando?'Guardar cambios':'Registrar socio'}</>}
            </button>
          </div>
        </div>
      </div>
      {/* Modal duplicados */}
      {showDuplicados && (
        <div className="modal-bg open" onClick={e=>{if(e.target===e.currentTarget)setShowDuplicados(false)}}>
          <div className="modal" style={{width:'min(700px,95vw)'}}>
            <div className="modal-header">
              <h2><i className="ti ti-copy-off" style={{marginRight:8,color:'#dc2626'}}></i>
                Socios con RUT duplicado ({duplicados.length})
              </h2>
              <button className="modal-close" onClick={()=>setShowDuplicados(false)}><i className="ti ti-x"></i></button>
            </div>
            {duplicados.length === 0 ? (
              <div className="empty"><i className="ti ti-circle-check" style={{color:'var(--success)'}}></i>No se encontraron duplicados</div>
            ) : duplicados.map((grupo, i) => (
              <div key={i} style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:8,padding:'10px 14px',marginBottom:10}}>
                <div style={{fontSize:12,fontWeight:600,color:'#dc2626',marginBottom:8}}>
                  RUT {grupo[0].rut}-{grupo[0].dv} · {grupo.length} registros
                </div>
                <table className="tbl" style={{fontSize:12}}>
                  <thead><tr>
                    <th style={{width:55}}>ID</th><th>Nombre</th>
                    <th style={{width:70}}>Estado</th><th style={{width:90}}>F. ingreso</th>
                    <th style={{width:90}}>F. salida</th>
                  </tr></thead>
                  <tbody>{grupo.map(s => (
                    <tr key={s.id_caif}>
                      <td>{s.id_caif}</td>
                      <td>{s.nombre_comp}</td>
                      <td><span className={`badge ${s.vigente===1?'al-dia':'moroso'}`}>{s.vigente===1?'Activo':'Inactivo'}</span></td>
                      <td style={{fontSize:11}}>{s.f_ini_vig ? new Date(s.f_ini_vig+'T12:00:00-04:00').toLocaleDateString('es-CL') : '—'}</td>
                      <td style={{fontSize:11}}>{s.f_fin_vig ? new Date(s.f_fin_vig+'T12:00:00-04:00').toLocaleDateString('es-CL') : '—'}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            ))}
            <div style={{fontSize:12,color:'var(--text-3)',marginTop:8}}>
              Para fusionar duplicados, ejecuta el SQL correspondiente en Supabase.
            </div>
          </div>
        </div>
      )}


      {/* Modal WhatsApp */}
      {modalWA && (
        <div className="modal-bg open" onClick={e=>e.target===e.currentTarget&&setModalWA(null)}>
          <div className="modal" style={{width:'min(560px,95vw)'}}>
            <div className="modal-header">
              <h2><i className="ti ti-brand-whatsapp" style={{color:'#16a34a',marginRight:8}}></i>Enviar mensaje WhatsApp</h2>
              <button className="modal-close" onClick={()=>setModalWA(null)}>&times;</button>
            </div>
            <div style={{background:'#f0fdf4',border:'0.5px solid #a7f3d0',borderRadius:8,padding:'10px 14px',marginBottom:14}}>
              <div style={{fontWeight:600,fontSize:14}}>{modalWA.socio.nombre_comp}</div>
              <div style={{fontSize:12,color:'#64748b',marginTop:2}}>
                <i className="ti ti-phone" style={{marginRight:4}}></i>+{modalWA.numero}
              </div>
            </div>
            <div className="form-group" style={{marginBottom:16}}>
              <label style={{fontWeight:600}}>Edita el mensaje antes de enviar</label>
              <textarea
                value={modalWA.mensaje}
                onChange={e=>setModalWA(m=>({...m, mensaje:e.target.value}))}
                rows={10}
                style={{
                  width:'100%', padding:'10px 12px', border:'1.5px solid #e2e8f0',
                  borderRadius:8, fontSize:13, fontFamily:'inherit', resize:'vertical',
                  lineHeight:1.6, boxSizing:'border-box'
                }}
              />
            </div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button className="btn" onClick={()=>setModalWA(null)}>Cancelar</button>
              <a href={'https://api.whatsapp.com/send/?phone=' + modalWA.numero + '&text=' + encodeURIComponent(modalWA.mensaje) + '&type=phone_number&app_absent=0'}
                target="_blank" rel="noopener noreferrer"
                onClick={()=>setTimeout(()=>setModalWA(null), 300)}
                className="btn primary"
                style={{background:'#16a34a',borderColor:'#16a34a',textDecoration:'none',display:'flex',alignItems:'center',gap:6}}>
                <i className="ti ti-brand-whatsapp"></i>Abrir en WhatsApp
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Modal reingreso */}
      {modalReingreso && (
        <div className="modal-bg open" onClick={e=>e.target===e.currentTarget&&setModalReingreso(null)}>
          <div className="modal">
            <div className="modal-header">
              <h2>Reingresar al club</h2>
              <button className="modal-close" onClick={()=>setModalReingreso(null)}>&times;</button>
            </div>
            <div style={{background:'#eff6ff',border:'0.5px solid #bfdbfe',borderRadius:8,padding:'10px 14px',marginBottom:16}}>
              <div style={{fontWeight:600,fontSize:14}}>{nombreMostrar(modalReingreso)}</div>
              <div style={{fontSize:12,color:'#64748b',marginTop:2}}>
                Se guardara el ciclo anterior y se activara el socio desde la fecha de reingreso.
              </div>
              {modalReingreso.f_fin_vig && (
                <div style={{fontSize:12,color:'#64748b',marginTop:4}}>
                  Fecha de salida registrada: <strong>{new Date(modalReingreso.f_fin_vig).toLocaleDateString('es-CL')}</strong>
                  {modalReingreso.causa_salida && ` (${modalReingreso.causa_salida})`}
                </div>
              )}
            </div>
            <div className="form-group" style={{marginBottom:16}}>
              <label>Fecha de reingreso *</label>
              <input type="date" value={fechaReingreso} onChange={e=>setFechaReingreso(e.target.value)}/>
              <span style={{fontSize:11,color:'#64748b',marginTop:4,display:'block'}}>
                Las cuotas se cobraran desde este mes en adelante.
              </span>
            </div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button className="btn" onClick={()=>setModalReingreso(null)}>Cancelar</button>
              <button className="btn primary" onClick={confirmarReingreso} disabled={savingReingreso||!fechaReingreso}>
                {savingReingreso
                  ? <><div className="spinner" style={{width:14,height:14,borderWidth:2}}></div>Guardando...</>
                  : <><i className="ti ti-user-check"></i>Confirmar reingreso</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal historial vigencia */}
      {modalHistorial && (
        <div className="modal-bg open" onClick={e=>e.target===e.currentTarget&&setModalHistorial(null)}>
          <div className="modal" style={{width:'min(600px,95vw)'}}>
            <div className="modal-header">
              <h2>Historial de vigencia</h2>
              <button className="modal-close" onClick={()=>setModalHistorial(null)}>&times;</button>
            </div>
            <div style={{fontWeight:600,fontSize:14,marginBottom:12}}>{nombreMostrar(modalHistorial)}</div>

            {/* Ciclo actual */}
            <div style={{background:'#f0fdf4',border:'0.5px solid #a7f3d0',borderRadius:8,padding:'10px 14px',marginBottom:12}}>
              <div style={{fontSize:11,fontWeight:600,color:'#16a34a',textTransform:'uppercase',marginBottom:4}}>Ciclo actual</div>
              <div style={{display:'flex',gap:16,fontSize:13,flexWrap:'wrap'}}>
                <span>Ingreso: <strong>{modalHistorial.f_ini_vig ? new Date(modalHistorial.f_ini_vig+'T12:00:00-04:00').toLocaleDateString('es-CL') : 'Sin fecha'}</strong></span>
                {modalHistorial.f_reingreso && <span>Reingreso: <strong>{new Date(modalHistorial.f_reingreso+'T12:00:00-04:00').toLocaleDateString('es-CL')}</strong></span>}
                <span style={{color:modalHistorial.vigente===1?'#16a34a':'#dc2626',fontWeight:600}}>{modalHistorial.vigente===1?'Activo':'Inactivo'}</span>
              </div>
            </div>

            {/* Ciclos anteriores */}
            <div style={{fontWeight:600,fontSize:12,color:'#64748b',marginBottom:8,textTransform:'uppercase'}}>Ciclos anteriores</div>
            {loadingHistorial ? (
              <div className="loading-center"><div className="spinner"></div></div>
            ) : historial.length === 0 ? (
              <div className="empty" style={{padding:'1rem'}}><i className="ti ti-history"></i>Sin ciclos anteriores registrados</div>
            ) : (
              <div className="tbl-wrap">
                <table className="tbl" style={{fontSize:12}}>
                  <thead>
                    <tr>
                      <th>Fecha ingreso</th>
                      <th>Fecha salida</th>
                      <th>Duracion</th>
                      <th>Causa salida</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historial.map((h,i) => {
                      const ini = h.f_inicio ? new Date(h.f_inicio+'T12:00:00-04:00') : null
                      const fin = h.f_fin ? new Date(h.f_fin+'T12:00:00-04:00') : null
                      const dias = ini && fin ? Math.round((fin-ini)/(1000*60*60*24)) : null
                      return (
                        <tr key={i}>
                          <td>{ini ? ini.toLocaleDateString('es-CL') : '—'}</td>
                          <td>{fin ? fin.toLocaleDateString('es-CL') : '—'}</td>
                          <td style={{color:'#64748b'}}>{dias !== null ? `${dias} dias` : '—'}</td>
                          <td style={{color:'#64748b'}}>{h.causa_salida || '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{display:'flex',justifyContent:'flex-end',marginTop:16}}>
              <button className="btn" onClick={()=>setModalHistorial(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
