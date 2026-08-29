import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import ActividadDetalle from './ActividadDetalle'

export default function Actividades() {
  const [actividades, setActividades] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [nombre, setNombre] = useState('')
  const [activa, setActiva] = useState(true)
  const [tipoCobro, setTipoCobro] = useState('mensual')
  const [montoDefault, setMontoDefault] = useState('')
  const [mostrarDashboard, setMostrarDashboard] = useState(false)
  const [permiteGrupo, setPermiteGrupo] = useState(false)
  const [saving, setSaving] = useState(false)
  const [alert, setAlert] = useState(null)
  const [actividadSel, setActividadSel] = useState(null)
  const [vista, setVista] = useState('actividades') // 'actividades' | 'bancos'
  const [bancos, setBancos] = useState([])
  const [loadingBancos, setLoadingBancos] = useState(true)
  const [modalBanco, setModalBanco] = useState(false)
  const [editandoBanco, setEditandoBanco] = useState(null)
  const [nombreBanco, setNombreBanco] = useState('')
  const [activoBanco, setActivoBanco] = useState(true)
  const [ordenBanco, setOrdenBanco] = useState(99)
  const [savingBanco, setSavingBanco] = useState(false)

  useEffect(() => { cargar(); cargarBancos() }, [])

  async function cargarBancos() {
    setLoadingBancos(true)
    const { data } = await supabase.from('bancos').select('*').order('orden').order('nombre')
    setBancos(data || [])
    setLoadingBancos(false)
  }

  function abrirNuevoBanco() {
    setEditandoBanco(null)
    setNombreBanco('')
    setActivoBanco(true)
    setOrdenBanco((bancos.reduce((m,b)=>Math.max(m,b.orden||0),0))+1)
    setModalBanco(true)
  }

  function abrirEditarBanco(b) {
    setEditandoBanco(b)
    setNombreBanco(b.nombre)
    setActivoBanco(b.activo)
    setOrdenBanco(b.orden||99)
    setModalBanco(true)
  }

  async function guardarBanco() {
    if (!nombreBanco.trim()) { mostrarAlert('error', 'El nombre es obligatorio.'); return }
    setSavingBanco(true)
    try {
      const payload = { nombre: nombreBanco.trim(), activo: activoBanco, orden: Number(ordenBanco) || 99 }
      if (editandoBanco) {
        await supabase.from('bancos').update(payload).eq('id_banco', editandoBanco.id_banco)
        mostrarAlert('success', 'Banco actualizado.')
      } else {
        await supabase.from('bancos').insert([payload])
        mostrarAlert('success', 'Banco creado.')
      }
      setModalBanco(false)
      cargarBancos()
    } catch(e) { mostrarAlert('error', 'Error: '+e.message) }
    finally { setSavingBanco(false) }
  }

  async function toggleActivoBanco(b) {
    await supabase.from('bancos').update({ activo: !b.activo }).eq('id_banco', b.id_banco)
    cargarBancos()
  }

  async function eliminarBanco(b) {
    if (!confirm(`Eliminar "${b.nombre}"?`)) return
    await supabase.from('bancos').delete().eq('id_banco', b.id_banco)
    mostrarAlert('success', 'Banco eliminado.')
    cargarBancos()
  }

  async function cargar() {
    setLoading(true)
    const { data } = await supabase.from('actividades').select('*').order('id_actividad', { ascending: false })
    setActividades(data || [])
    setLoading(false)
  }

  function abrirNueva() {
    setEditando(null)
    setNombre('')
    setActiva(true)
    setTipoCobro('mensual')
    setMontoDefault('')
    setMostrarDashboard(false)
    setPermiteGrupo(false)
    setModal(true)
  }

  function abrirEditar(act) {
    setEditando(act)
    setNombre(act.nombre)
    setActiva(act.activa)
    setTipoCobro(act.tipo_cobro || 'mensual')
    setMontoDefault(act.monto_default || '')
    setMostrarDashboard(act.mostrar_dashboard || false)
    setPermiteGrupo(act.permite_grupo || false)
    setModal(true)
  }

  function cerrar() {
    setModal(false)
    setEditando(null)
    setNombre('')
    setActiva(true)
    setTipoCobro('mensual')
    setMontoDefault('')
    setMostrarDashboard(false)
  }

  async function guardar() {
    if (!nombre.trim()) { setAlert({ type: 'error', msg: 'El nombre es obligatorio.' }); return }
    setSaving(true)
    try {
      const payload = {
        nombre: nombre.trim(),
        activa,
        tipo_cobro: tipoCobro,
        monto_default: montoDefault ? Number(montoDefault) : null,
        mostrar_dashboard: mostrarDashboard,
        permite_grupo: permiteGrupo
      }
      if (editando) {
        const { error } = await supabase.from('actividades').update(payload).eq('id_actividad', editando.id_actividad)
        if (error) throw error
        mostrarAlert('success', 'Actividad actualizada.')
      } else {
        const maxId = actividades.reduce((m, a) => Math.max(m, a.id_actividad), 0)
        const { error } = await supabase.from('actividades').insert([{ id_actividad: maxId + 1, ...payload }])
        if (error) throw error
        mostrarAlert('success', 'Actividad creada.')
      }
      cerrar()
      cargar()
    } catch (e) {
      setAlert({ type: 'error', msg: 'Error: ' + e.message })
    } finally {
      setSaving(false)
    }
  }

  async function toggleActiva(act) {
    if (act.id_actividad === 0) return
    await supabase.from('actividades').update({ activa: !act.activa }).eq('id_actividad', act.id_actividad)
    cargar()
  }

  async function eliminar(act) {
    if (act.id_actividad === 0) { mostrarAlert('error', 'La actividad Cuotas no se puede eliminar.'); return }
    const { count } = await supabase.from('pagos').select('*', { count: 'exact', head: true }).eq('id_actividad', act.id_actividad)
    if (count > 0) { mostrarAlert('error', `No se puede eliminar: tiene ${count} pago${count !== 1 ? 's' : ''} asociado${count !== 1 ? 's' : ''}.`); return }
    if (!confirm(`Eliminar "${act.nombre}"?`)) return
    await supabase.from('actividades').delete().eq('id_actividad', act.id_actividad)
    mostrarAlert('success', 'Actividad eliminada.')
    cargar()
  }

  function mostrarAlert(type, msg) {
    setAlert({ type, msg })
    setTimeout(() => setAlert(null), 4000)
  }

  if (actividadSel) {
    return <ActividadDetalle actividad={actividadSel} onVolver={() => setActividadSel(null)} />
  }

  return (
    <div className="content">
      {/* Tabs */}
      <div style={{display:'flex',gap:8,marginBottom:16}}>
        <button className={`btn ${vista==='actividades'?'primary':''}`} onClick={()=>setVista('actividades')}>
          <i className="ti ti-category"></i>Actividades
        </button>
        <button className={`btn ${vista==='bancos'?'primary':''}`} onClick={()=>setVista('bancos')}>
          <i className="ti ti-building-bank"></i>Bancos
        </button>
      </div>

      {alert && <div className={`alert ${alert.type}`} style={{marginBottom:12}}>{alert.msg}</div>}

      {vista === 'bancos' ? (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div className="card-title" style={{ marginBottom: 0 }}>
              <i className="ti ti-building-bank"></i>Bancos disponibles
            </div>
            <button className="btn primary" onClick={abrirNuevoBanco}>
              <i className="ti ti-plus"></i>Nuevo banco
            </button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 16 }}>
            Estos bancos aparecen en los selectores de metodo de pago al registrar torneos y otros movimientos.
          </p>
          {loadingBancos ? (
            <div className="loading-center"><div className="spinner"></div></div>
          ) : (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th style={{width:60}}>Orden</th>
                    <th>Nombre</th>
                    <th style={{width:90}}>Estado</th>
                    <th style={{width:100}}></th>
                  </tr>
                </thead>
                <tbody>
                  {bancos.map(b => (
                    <tr key={b.id_banco}>
                      <td style={{color:'var(--text-3)',fontSize:12,textAlign:'center'}}>{b.orden}</td>
                      <td style={{fontWeight:500}}>{b.nombre}</td>
                      <td>
                        <button onClick={()=>toggleActivoBanco(b)}
                          style={{
                            background: b.activo ? '#f0fdf4' : '#f8fafc',
                            border: `0.5px solid ${b.activo ? '#a7f3d0' : '#e2e8f0'}`,
                            borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 600,
                            color: b.activo ? '#16a34a' : '#94a3b8', cursor: 'pointer', fontFamily: 'inherit'
                          }}>
                          {b.activo ? 'Activo' : 'Inactivo'}
                        </button>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn sm" onClick={() => abrirEditarBanco(b)}><i className="ti ti-pencil"></i></button>
                          <button className="btn sm danger" onClick={() => eliminarBanco(b)}><i className="ti ti-trash"></i></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="card-title" style={{ marginBottom: 0 }}>
            <i className="ti ti-category"></i>Tipos de pago / Actividades
          </div>
          <button className="btn primary" onClick={abrirNueva}>
            <i className="ti ti-plus"></i>Nueva actividad
          </button>
        </div>

        <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 16 }}>
          Define los tipos de pago del club. Las actividades <strong>mensuales</strong> permiten registrar por mes (cuotas). Las actividades de <strong>pago unico</strong> permiten asignar numeros de referencia (rifa, evento, etc).
        </p>

        {loading ? (
          <div className="loading-center"><div className="spinner"></div></div>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ minWidth: 180 }}>Nombre</th>
                  <th style={{ width: 100 }}></th>
                </tr>
              </thead>
              <tbody>
                {[
                  ...actividades.filter(a => a.id_actividad === 0),
                  ...actividades.filter(a => a.id_actividad !== 0)
                ].map(act => (
                  <tr key={act.id_actividad}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{act.nombre}</span>
                        {act.id_actividad === 0 && (
                          <span style={{ fontSize: 10, background: '#e8f5ee', color: '#1a5e3a', padding: '2px 6px', borderRadius: 4, border: '0.5px solid #a7f3d0', fontWeight: 600 }}>DEFAULT</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10, color: 'var(--text-3)' }}>ID {act.id_actividad}</span>
                        <span style={{
                          fontSize: 10, padding: '2px 7px', borderRadius: 4, fontWeight: 600,
                          background: act.tipo_cobro === 'unico' ? '#eff6ff' : '#f0fdf4',
                          color: act.tipo_cobro === 'unico' ? '#1d4ed8' : '#16a34a',
                          border: `0.5px solid ${act.tipo_cobro === 'unico' ? '#bfdbfe' : '#a7f3d0'}`
                        }}>
                          {act.tipo_cobro === 'unico' ? 'Pago unico' : 'Mensual'}
                        </span>
                        {act.monto_default && (
                          <span style={{ fontSize: 10, color: 'var(--text-3)' }}>
                            ${Number(act.monto_default).toLocaleString('es-CL')}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                        <button onClick={() => toggleActiva(act)} disabled={act.id_actividad === 0}
                          style={{
                            background: act.activa ? '#f0fdf4' : '#f8fafc',
                            border: `0.5px solid ${act.activa ? '#a7f3d0' : '#e2e8f0'}`,
                            borderRadius: 6, padding: '2px 8px', fontSize: 10, fontWeight: 600,
                            color: act.activa ? '#16a34a' : '#94a3b8',
                            cursor: act.id_actividad === 0 ? 'default' : 'pointer', fontFamily: 'inherit'
                          }}>
                          {act.activa ? 'Activa' : 'Inactiva'}
                        </button>
                        {act.tipo_cobro === 'unico' && (
                          <button onClick={async()=>{await supabase.from('actividades').update({mostrar_dashboard:!act.mostrar_dashboard}).eq('id_actividad',act.id_actividad);cargar()}}
                            style={{
                              background:act.mostrar_dashboard?'#eff6ff':'#f8fafc',
                              border:`0.5px solid ${act.mostrar_dashboard?'#bfdbfe':'#e2e8f0'}`,
                              borderRadius:6,padding:'2px 8px',fontSize:10,fontWeight:600,
                              color:act.mostrar_dashboard?'#1d4ed8':'#94a3b8',
                              cursor:'pointer',fontFamily:'inherit'
                            }}>
                            {act.mostrar_dashboard?'Dashboard: Visible':'Dashboard: Oculto'}
                          </button>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {act.tipo_cobro === 'unico' && (
                          <button className="btn sm" onClick={() => setActividadSel(act)}
                            style={{ color: '#1d4ed8', borderColor: '#bfdbfe', background: '#eff6ff' }}
                            title="Gestionar inscripciones">
                            <i className="ti ti-users"></i>
                          </button>
                        )}
                        <button className="btn sm" onClick={() => abrirEditar(act)} disabled={act.id_actividad === 0}><i className="ti ti-pencil"></i></button>
                        <button className="btn sm danger" onClick={() => eliminar(act)} disabled={act.id_actividad === 0}><i className="ti ti-trash"></i></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="modal-bg open" onClick={e => e.target === e.currentTarget && cerrar()}>
          <div className="modal" style={{ width: 'min(500px,95vw)' }}>
            <div className="modal-header">
              <h2>{editando ? 'Editar actividad' : 'Nueva actividad'}</h2>
              <button className="modal-close" onClick={cerrar}>&times;</button>
            </div>

            <div className="form-grid">
              <div className="form-group full">
                <label>Nombre de la actividad *</label>
                <input value={nombre} onChange={e => setNombre(e.target.value)}
                  placeholder="Ej: Rifa CAIF 2026, Paseo anual..." autoFocus
                  onKeyDown={e => e.key === 'Enter' && guardar()} />
              </div>

              <div className="form-group">
                <label>Tipo de cobro</label>
                <select value={tipoCobro} onChange={e => setTipoCobro(e.target.value)}>
                  <option value="mensual">Mensual (cuotas por mes)</option>
                  <option value="unico">Pago unico (rifa, evento, etc)</option>
                </select>
                <span style={{ fontSize: 11, color: '#64748b', marginTop: 3, display: 'block' }}>
                  {tipoCobro === 'unico'
                    ? 'Permite asignar numeros de referencia y registrar pagos individuales'
                    : 'Muestra selector de meses al registrar el pago'}
                </span>
              </div>

              <div className="form-group">
                <label>Monto por defecto ($)</label>
                <input type="number" value={montoDefault} onChange={e => setMontoDefault(e.target.value)}
                  placeholder={tipoCobro === 'unico' ? 'Ej: 10000' : 'Ej: 3000'} />
                <span style={{ fontSize: 11, color: '#64748b', marginTop: 3, display: 'block' }}>
                  Se precargara al registrar pagos
                </span>
              </div>

              <div className="form-group">
                <label>Estado</label>
                <select value={activa} onChange={e => setActiva(e.target.value === 'true')}>
                  <option value="true">Activa</option>
                  <option value="false">Inactiva</option>
                </select>
              </div>
              {tipoCobro === 'unico' && (
                <div className="form-group">
                  <label>Mostrar en Dashboard</label>
                  <select value={mostrarDashboard} onChange={e => setMostrarDashboard(e.target.value === 'true')}>
                    <option value="false">No mostrar</option>
                    <option value="true">Mostrar en dashboard</option>
                  </select>
                  <span style={{fontSize:11,color:'#64748b',marginTop:3,display:'block'}}>
                    Muestra resumen de pagos/pendientes en el dashboard principal
                  </span>
                </div>
              )}
              {tipoCobro === 'unico' && (
                <div className="form-group">
                  <label>Modo de inscripcion</label>
                  <select value={permiteGrupo} onChange={e => setPermiteGrupo(e.target.value === 'true')}>
                    <option value="false">Individual (1 socio activo por registro, ej: Rifa)</option>
                    <option value="true">Grupal (un pagador cubre varios asistentes, ej: Fonda, paseo)</option>
                  </select>
                  <span style={{fontSize:11,color:'#64748b',marginTop:3,display:'block'}}>
                    Individual: solo socios activos, un registro por socio. Grupal: un pagador puede cubrir a varios socios y/o externos.
                  </span>
                </div>
              )}
            </div>

            {alert && <div className={`alert ${alert.type}`} style={{ marginBottom: 12 }}>{alert.msg}</div>}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={cerrar}>Cancelar</button>
              <button className="btn primary" onClick={guardar} disabled={saving}>
                {saving ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }}></div>Guardando...</> : <><i className="ti ti-check"></i>{editando ? 'Guardar cambios' : 'Crear actividad'}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal banco */}
      {modalBanco && (
        <div className="modal-bg open" onClick={e => e.target === e.currentTarget && setModalBanco(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2>{editandoBanco ? 'Editar banco' : 'Nuevo banco'}</h2>
              <button className="modal-close" onClick={() => setModalBanco(false)}>&times;</button>
            </div>
            <div className="form-grid">
              <div className="form-group full">
                <label>Nombre del banco *</label>
                <input value={nombreBanco} onChange={e => setNombreBanco(e.target.value)}
                  placeholder="Ej: Banco Falabella" autoFocus
                  onKeyDown={e => e.key === 'Enter' && guardarBanco()} />
              </div>
              <div className="form-group">
                <label>Orden</label>
                <input type="number" value={ordenBanco} onChange={e => setOrdenBanco(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Estado</label>
                <select value={activoBanco} onChange={e => setActivoBanco(e.target.value === 'true')}>
                  <option value="true">Activo</option>
                  <option value="false">Inactivo</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setModalBanco(false)}>Cancelar</button>
              <button className="btn primary" onClick={guardarBanco} disabled={savingBanco}>
                {savingBanco ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }}></div>Guardando...</> : <><i className="ti ti-check"></i>{editandoBanco ? 'Guardar cambios' : 'Crear banco'}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
