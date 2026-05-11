import { useState, useEffect } from 'react'
import { supabase, insertPersona, updatePersona } from '../lib/supabase'
import { estadoSocio, mesesAlDia, estadoLabel, MESES } from '../lib/helpers'

const ANIO_ACTUAL = new Date().getFullYear()

export default function Socios({ isAdmin }) {
  const [personas, setPersonas] = useState([])
  const [pagos, setPagos] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroVigente, setFiltroVigente] = useState('1') // '1'=activos, '0'=inactivos, ''=todos
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [alert, setAlert] = useState(null)
  const [saving, setSaving] = useState(false)
  const [tabModal, setTabModal] = useState('datos') // 'datos' | 'salida'

  function emptyForm() {
    return {
      nombre:'', seg_nombre:'', apellido:'', ap_mat:'', rut:'', dv:'',
      fecha_nac:'', genero:'Masculino', atleta:'Atleta Adulto',
      celular:'', email:'', apoderado:'', vigente:1,
      f_ini_vig:'', f_fin_vig:'', causa_salida:''
    }
  }

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    setLoading(true)
    try {
      const [resP, resPg] = await Promise.all([
        supabase.from('personas').select('*').order('id_caif', { ascending: false }),
        supabase.from('pagos').select('id_socio,mes,anio,monto').eq('anio', ANIO_ACTUAL)
      ])
      setPersonas(resP.data || [])
      setPagos(resPg.data || [])
    } finally {
      setLoading(false)
    }
  }

  const lista = personas.filter(p => {
    const nc = (p.nombre_comp || '').toLowerCase()
    const q = busqueda.toLowerCase()
    const matchQ = !q || nc.includes(q) || String(p.id_caif).includes(q)
    const matchT = !filtroTipo || p.atleta === filtroTipo
    const matchV = filtroVigente === '' || String(p.vigente) === filtroVigente
    const est = estadoSocio(p.id_caif, pagos)
    const matchE = !filtroEstado || est === filtroEstado
    return matchQ && matchT && matchV && matchE
  })

  function abrirModal(socio = null) {
    setTabModal('datos')
    if (socio) {
      setEditando(socio)
      setForm({
        nombre: socio.nombre || '', seg_nombre: socio.seg_nombre || '',
        apellido: socio.apellido || '', ap_mat: socio.ap_mat || '',
        rut: socio.rut || '', dv: socio.dv || '',
        fecha_nac: socio.fecha_nac || '', genero: socio.genero || 'Masculino',
        atleta: socio.atleta || 'Atleta Adulto', celular: socio.celular || '',
        email: socio.email || '', apoderado: socio.apoderado || '',
        vigente: socio.vigente ?? 1,
        f_ini_vig: socio.f_ini_vig || '',
        f_fin_vig: socio.f_fin_vig || '',
        causa_salida: socio.causa_salida || ''
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
      const nombre_comp = [form.nombre, form.seg_nombre, form.apellido, form.ap_mat].filter(Boolean).join(' ')
      const datos = {
        ...form,
        nombre_comp,
        f_fin_vig: form.f_fin_vig || null,
        causa_salida: form.causa_salida || null,
        f_ini_vig: form.f_ini_vig || null,
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
          </select>
          <select value={filtroVigente} onChange={e=>setFiltroVigente(e.target.value)}>
            <option value="1">Activos ({activos})</option>
            <option value="0">Inactivos ({inactivos})</option>
            <option value="">Todos</option>
          </select>
          {filtroVigente === '1' && (
            <select value={filtroEstado} onChange={e=>setFiltroEstado(e.target.value)}>
              <option value="">Todos los estados</option>
              <option value="al-dia">Al día</option>
              <option value="parcial">Parcial</option>
              <option value="moroso">Moroso</option>
            </select>
          )}
        </div>
        {isAdmin && (
          <button className="btn primary" onClick={() => abrirModal()}>
            <i className="ti ti-user-plus"></i>Nuevo socio
          </button>
        )}
      </div>

      <div style={{fontSize:12,color:'var(--text-3)',marginBottom:8}}>
        Mostrando {lista.length} de {personas.length} socios
      </div>

      <div className="card" style={{padding:0}}>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th style={{width:50}}>ID</th>
                <th>Nombre completo</th>
                <th style={{width:80}}>Tipo</th>
                {filtroVigente !== '0' && <th style={{width:75}}>Estado</th>}
                {filtroVigente !== '0' && <th style={{width:85}}>Meses {ANIO_ACTUAL}</th>}
                {filtroVigente === '0' && <th style={{width:100}}>Fecha salida</th>}
                {filtroVigente === '0' && <th>Causa</th>}
                {isAdmin && <th style={{width:80}}>Acción</th>}
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 ? (
                <tr><td colSpan={7} className="empty">Sin resultados</td></tr>
              ) : lista.map(s => {
                const est = estadoSocio(s.id_caif, pagos)
                const meses = mesesAlDia(s.id_caif, ANIO_ACTUAL, pagos)
                const esInactivo = s.vigente !== 1
                return (
                  <tr key={s.id_caif} style={{opacity: esInactivo ? 0.7 : 1}}>
                    <td style={{color:'var(--text-3)'}}>{s.id_caif}</td>
                    <td title={s.nombre_comp}>
                      {s.nombre_comp}
                      {esInactivo && <span className="badge" style={{marginLeft:6,background:'#f1f5f9',color:'#64748b',fontSize:10}}>Inactivo</span>}
                    </td>
                    <td><span className={`badge ${s.atleta==='Atleta Niño'?'nino':'adulto'}`}>{s.atleta==='Atleta Niño'?'Niño':'Adulto'}</span></td>
                    {filtroVigente !== '0' && <td><span className={`badge ${est}`}>{estadoLabel(est)}</span></td>}
                    {filtroVigente !== '0' && (
                      <td style={{color:meses>=(new Date().getMonth()+1)?'var(--success)':'var(--warning)',fontWeight:500}}>
                        {meses}/12
                      </td>
                    )}
                    {filtroVigente === '0' && (
                      <td style={{color:'var(--text-2)',fontSize:12}}>
                        {s.f_fin_vig ? new Date(s.f_fin_vig).toLocaleDateString('es-CL') : '—'}
                      </td>
                    )}
                    {filtroVigente === '0' && (
                      <td style={{color:'var(--text-2)',fontSize:12}}>{s.causa_salida || '—'}</td>
                    )}
                    {isAdmin && (
                      <td>
                        <button className="btn sm" onClick={() => abrirModal(s)}><i className="ti ti-edit"></i>Editar</button>
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
                <select {...f('atleta')}><option>Atleta Adulto</option><option>Atleta Niño</option></select>
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
              <div className="form-group"><label>Fecha de ingreso</label><input type="date" {...f('f_ini_vig')}/></div>
              <div className="form-group"><label>Fecha de salida</label><input type="date" {...f('f_fin_vig')}/></div>
              <div className="form-group"><label>Causa de salida</label>
                <select {...f('causa_salida')}>
                  <option value="">— Sin especificar —</option>
                  <option>Decision propia</option>
                  <option>Inf Favio</option>
                  <option>Expulsado</option>
                  <option>Traslado</option>
                  <option>Económica</option>
                  <option>Otra</option>
                </select>
              </div>
              {form.causa_salida === 'Otra' && (
                <div className="form-group full"><label>Especificar causa</label><input type="text" {...f('causa_salida')}/></div>
              )}

              {/* Resumen de pagos del socio */}
              {editando && (
                <div className="form-group full">
                  <label>Resumen de pagos {ANIO_ACTUAL}</label>
                  <div style={{background:'#f8fafc',border:'0.5px solid #e2e8f0',borderRadius:8,padding:'10px 12px',fontSize:13}}>
                    {(() => {
                      const m = mesesAlDia(editando.id_caif, ANIO_ACTUAL, pagos)
                      const est = estadoSocio(editando.id_caif, pagos)
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
    </div>
  )
}
