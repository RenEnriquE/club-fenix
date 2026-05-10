import { useState, useEffect } from 'react'
import { getPersonas, insertPersona, updatePersona, getPagosBySocio } from '../lib/supabase'
import { estadoSocio, mesesAlDia, estadoLabel, AÑOS } from '../lib/helpers'

export default function Socios({ isAdmin }) {
  const [personas, setPersonas] = useState([])
  const [pagos, setPagos] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [alert, setAlert] = useState(null)
  const [saving, setSaving] = useState(false)

  function emptyForm() {
    return { nombre: '', seg_nombre: '', apellido: '', ap_mat: '', rut: '', dv: '', fecha_nac: '', genero: 'Masculino', atleta: 'Atleta Adulto', celular: '', email: '', apoderado: '', vigente: 1 }
  }

  useEffect(() => {
    Promise.all([getPersonas(), fetchAllPagos()]).then(([p]) => {
      setPersonas(p)
      setLoading(false)
    })
  }, [])

  async function fetchAllPagos() {
    const { supabase } = await import('../lib/supabase')
    const anioActual = new Date().getFullYear()
    const { data } = await supabase.from('pagos').select('id_socio,mes,anio,monto').eq('anio', anioActual)
    setPagos(data || [])
  }

  const lista = personas.filter(p => {
    const nc = (p.nombre_comp || '').toLowerCase()
    const q = busqueda.toLowerCase()
    const matchQ = !q || nc.includes(q) || String(p.id_caif).includes(q)
    const matchT = !filtroTipo || p.atleta === filtroTipo
    const est = estadoSocio(p.id_caif, pagos)
    const matchE = !filtroEstado || est === filtroEstado
    return matchQ && matchT && matchE
  })

  function abrirModal(socio = null) {
    if (socio) {
      setEditando(socio)
      setForm({
        nombre: socio.nombre || '', seg_nombre: socio.seg_nombre || '', apellido: socio.apellido || '',
        ap_mat: socio.ap_mat || '', rut: socio.rut || '', dv: socio.dv || '',
        fecha_nac: socio.fecha_nac || '', genero: socio.genero || 'Masculino',
        atleta: socio.atleta || 'Atleta Adulto', celular: socio.celular || '',
        email: socio.email || '', apoderado: socio.apoderado || '', vigente: socio.vigente ?? 1
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
      if (editando) {
        await updatePersona(editando.id_caif, { ...form, nombre_comp })
        setPersonas(prev => prev.map(p => p.id_caif === editando.id_caif ? { ...p, ...form, nombre_comp } : p))
        setAlert({ type: 'success', msg: '✓ Datos actualizados correctamente.' })
      } else {
        const maxId = Math.max(...personas.map(p => p.id_caif), 330)
        const nuevo = { ...form, id_caif: maxId + 1, nombre_comp, f_ini_vig: new Date().toISOString().split('T')[0] }
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

  const anioActual = new Date().getFullYear()

  return (
    <div className="content">
      <div style={{display:'flex',gap:12,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
        <div className="search-bar" style={{flex:1,margin:0}}>
          <input type="text" placeholder="Buscar por nombre o ID..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
            <option value="">Todos los tipos</option>
            <option value="Atleta Adulto">Adultos</option>
            <option value="Atleta Niño">Niños</option>
          </select>
          <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
            <option value="">Todos los estados</option>
            <option value="al-dia">Al día</option>
            <option value="parcial">Parcial</option>
            <option value="moroso">Moroso</option>
          </select>
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
            <thead><tr>
              <th style={{width:50}}>ID</th>
              <th>Nombre completo</th>
              <th style={{width:85}}>Tipo</th>
              <th style={{width:75}}>Estado</th>
              <th style={{width:90}}>Meses {anioActual}</th>
              {isAdmin && <th style={{width:90}}>Acciones</th>}
            </tr></thead>
            <tbody>
              {lista.length === 0 ? (
                <tr><td colSpan={isAdmin ? 6 : 5} className="empty">Sin resultados</td></tr>
              ) : lista.map(s => {
                const est = estadoSocio(s.id_caif, pagos)
                const meses = mesesAlDia(s.id_caif, anioActual, pagos)
                return (
                  <tr key={s.id_caif}>
                    <td style={{color:'var(--text-3)'}}>{s.id_caif}</td>
                    <td title={s.nombre_comp}>{s.nombre_comp}</td>
                    <td><span className={`badge ${s.atleta === 'Atleta Niño' ? 'nino' : 'adulto'}`}>{s.atleta === 'Atleta Niño' ? 'Niño' : 'Adulto'}</span></td>
                    <td><span className={`badge ${est}`}>{estadoLabel(est)}</span></td>
                    <td style={{color: meses >= (new Date().getMonth()+1) ? 'var(--success)' : 'var(--warning)',fontWeight:500}}>{meses}/12</td>
                    {isAdmin && (
                      <td>
                        <div className="actions">
                          <button className="btn sm" onClick={() => abrirModal(s)} title="Editar">
                            <i className="ti ti-edit"></i>
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
      <div className={`modal-bg ${modalOpen ? 'open' : ''}`} onClick={e => { if (e.target === e.currentTarget) setModalOpen(false) }}>
        <div className="modal">
          <div className="modal-header">
            <h2><i className="ti ti-user" style={{marginRight:8,color:'var(--accent)'}}></i>{editando ? 'Editar socio' : 'Registrar nuevo socio'}</h2>
            <button className="modal-close" onClick={() => setModalOpen(false)}><i className="ti ti-x"></i></button>
          </div>
          <div className="form-grid">
            <div className="form-group"><label>Nombre *</label><input type="text" placeholder="Nombre" {...f('nombre')} /></div>
            <div className="form-group"><label>Segundo nombre</label><input type="text" placeholder="Seg. nombre" {...f('seg_nombre')} /></div>
            <div className="form-group"><label>Apellido *</label><input type="text" placeholder="Apellido" {...f('apellido')} /></div>
            <div className="form-group"><label>Segundo apellido</label><input type="text" placeholder="Ap. materno" {...f('ap_mat')} /></div>
            <div className="form-group"><label>RUT *</label><input type="text" placeholder="12345678" {...f('rut')} /></div>
            <div className="form-group"><label>DV</label><input type="text" placeholder="K" maxLength={1} {...f('dv')} /></div>
            <div className="form-group"><label>Fecha de nacimiento</label><input type="date" {...f('fecha_nac')} /></div>
            <div className="form-group"><label>Género</label>
              <select {...f('genero')}><option>Masculino</option><option>Femenino</option><option>Otro</option></select>
            </div>
            <div className="form-group"><label>Tipo de atleta *</label>
              <select {...f('atleta')}><option>Atleta Adulto</option><option>Atleta Niño</option></select>
            </div>
            <div className="form-group"><label>Celular</label><input type="text" placeholder="+56 9 ..." {...f('celular')} /></div>
            <div className="form-group full"><label>Email</label><input type="email" placeholder="correo@ejemplo.com" {...f('email')} /></div>
            <div className="form-group full"><label>Apoderado</label><input type="text" placeholder="Nombre del apoderado (si aplica)" {...f('apoderado')} /></div>
            {editando && (
              <div className="form-group"><label>Estado</label>
                <select value={form.vigente} onChange={e => setForm(p => ({ ...p, vigente: Number(e.target.value) }))}>
                  <option value={1}>Vigente</option>
                  <option value={0}>Inactivo</option>
                </select>
              </div>
            )}
          </div>
          {alert && <div className={`alert ${alert.type}`}>{alert.msg}</div>}
          <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:16}}>
            <button className="btn" onClick={() => setModalOpen(false)}>Cancelar</button>
            <button className="btn primary" onClick={guardar} disabled={saving}>
              {saving ? <><div className="spinner" style={{width:14,height:14,borderWidth:2}}></div>Guardando...</> : <><i className="ti ti-check"></i>{editando ? 'Guardar cambios' : 'Registrar socio'}</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
