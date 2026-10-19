import { useState, useEffect, useCallback } from 'react'
import {
  getSession, listarUsuarios, crearUsuario, cambiarClaveUsuario,
  setUsuarioActivo, cambiarRolUsuario
} from '../lib/auth'

const ROL_LABEL = { admin: 'Admin', comite: 'Comite (solo lectura)', coach: 'Coach' }

function fmtFecha(f) {
  if (!f) return 'Nunca'
  return new Date(f).toLocaleString('es-CL', {
    timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

function generarClave() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const arr = new Uint32Array(10)
  crypto.getRandomValues(arr)
  return Array.from(arr, n => chars[n % chars.length]).join('')
}

const FORM_VACIO = { email: '', nombre: '', role: 'comite', password: '' }

export default function Usuarios() {
  const miEmail = getSession()?.email
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [alert, setAlert] = useState(null)
  const [modalNuevo, setModalNuevo] = useState(false)
  const [form, setForm] = useState(FORM_VACIO)
  const [modalClave, setModalClave] = useState(null)
  const [nuevaClave, setNuevaClave] = useState('')
  const [saving, setSaving] = useState(false)

  const cargar = useCallback(async (silencioso) => {
    if (!silencioso) setLoading(true)
    try {
      const data = await listarUsuarios()
      setUsuarios(data || [])
    } catch (e) {
      setAlert({ type: 'error', msg: 'Error: ' + e.message })
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    cargar(false)
    const t = setInterval(() => cargar(true), 60000)
    return () => clearInterval(t)
  }, [cargar])

  function avisar(type, msg) {
    setAlert({ type, msg })
    setTimeout(() => setAlert(null), 5000)
  }

  async function guardarNuevo() {
    if (!form.email.trim()) { avisar('error', 'Ingresa el correo.'); return }
    if (form.password.trim().length < 8) { avisar('error', 'La clave debe tener al menos 8 caracteres.'); return }
    setSaving(true)
    try {
      await crearUsuario({
        email: form.email.trim(), password: form.password.trim(),
        role: form.role, nombre: form.nombre.trim()
      })
      setModalNuevo(false)
      setForm(FORM_VACIO)
      avisar('success', 'Usuario creado. Entrega la clave a la persona por un canal seguro.')
      cargar(true)
    } catch (e) { avisar('error', 'Error: ' + e.message) }
    setSaving(false)
  }

  async function guardarClave() {
    if (nuevaClave.trim().length < 8) { avisar('error', 'La clave debe tener al menos 8 caracteres.'); return }
    setSaving(true)
    try {
      await cambiarClaveUsuario(modalClave.id, nuevaClave.trim())
      setModalClave(null)
      setNuevaClave('')
      avisar('success', 'Clave actualizada. Las sesiones abiertas de ese usuario se cerraron.')
      cargar(true)
    } catch (e) { avisar('error', 'Error: ' + e.message) }
    setSaving(false)
  }

  async function alternarActivo(u) {
    const accion = u.activo ? 'desactivar' : 'activar'
    if (!confirm('Quieres ' + accion + ' el acceso de ' + u.email + '?')) return
    try {
      await setUsuarioActivo(u.id, !u.activo)
      avisar('success', u.activo ? 'Acceso desactivado.' : 'Acceso activado.')
      cargar(true)
    } catch (e) { avisar('error', 'Error: ' + e.message) }
  }

  async function cambiarRol(u, role) {
    try {
      await cambiarRolUsuario(u.id, role)
      avisar('success', 'Rol actualizado. Se aplica la proxima vez que el usuario abra la app.')
      cargar(true)
    } catch (e) { avisar('error', 'Error: ' + e.message) }
  }

  const activos = usuarios.filter(u => u.activo).length
  const conectados = usuarios.filter(u => u.conectado).length

  return (
    <div className="content">
      <div className="card">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,flexWrap:'wrap',gap:8}}>
          <div className="card-title" style={{marginBottom:0}}><i className="ti ti-user-cog"></i>Usuarios</div>
          <button className="btn primary" onClick={() => { setForm({ ...FORM_VACIO, password: generarClave() }); setModalNuevo(true) }}>
            <i className="ti ti-user-plus"></i>Nuevo usuario
          </button>
        </div>
        <p style={{fontSize:12,color:'var(--text-3)',marginBottom:12}}>
          Administra los accesos a la app. {activos} usuario{activos !== 1 ? 's' : ''} activo{activos !== 1 ? 's' : ''} &middot; {conectados} conectado{conectados !== 1 ? 's' : ''} ahora (actividad en los ultimos 10 minutos).
        </p>

        {alert && <div className={'alert ' + alert.type} style={{marginBottom:12}}>{alert.msg}</div>}

        {loading ? <div className="loading-center"><div className="spinner"></div></div> : (
          <div className="tbl-wrap" style={{border:'var(--border)'}}>
            <table className="tbl" style={{tableLayout:'auto'}}>
              <thead>
                <tr>
                  <th>Usuario</th><th>Rol</th><th>Estado</th><th>Conexion</th><th>Ultimo acceso</th><th></th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map(u => (
                  <tr key={u.id} style={{opacity: u.activo ? 1 : 0.55}}>
                    <td style={{overflow:'visible',whiteSpace:'normal'}}>
                      <div style={{fontWeight:600}}>{u.nombre || u.email}{u.email === miEmail && <span style={{fontWeight:400,color:'var(--text-3)'}}> (tu)</span>}</div>
                      {u.nombre && <div style={{fontSize:11,color:'var(--text-3)',wordBreak:'break-all'}}>{u.email}</div>}
                    </td>
                    <td style={{overflow:'visible',whiteSpace:'normal'}}>
                      {u.role === 'admin'
                        ? <span style={{fontSize:12,fontWeight:600,color:'#1a5e3a'}}>Admin</span>
                        : (
                          <select value={u.role} onChange={e => cambiarRol(u, e.target.value)} style={{fontSize:12,padding:'4px 6px'}}>
                            <option value="comite">{ROL_LABEL.comite}</option>
                            <option value="coach">{ROL_LABEL.coach}</option>
                          </select>
                        )}
                    </td>
                    <td>
                      <span style={{fontSize:11,padding:'2px 8px',borderRadius:999,fontWeight:600,
                        background:u.activo?'#f0fdf4':'#f8fafc',color:u.activo?'#16a34a':'#94a3b8',
                        border:'0.5px solid ' + (u.activo?'#a7f3d0':'#e2e8f0')}}>
                        {u.activo ? 'Activo' : 'Desactivado'}
                      </span>
                    </td>
                    <td style={{overflow:'visible',whiteSpace:'normal'}}>
                      <span style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:12}}>
                        <span style={{width:8,height:8,borderRadius:'50%',background:u.conectado?'#16a34a':'#cbd5e1'}}></span>
                        {u.conectado ? 'En linea' : (u.ultimo_uso ? fmtFecha(u.ultimo_uso) : 'Sin sesion')}
                      </span>
                    </td>
                    <td style={{fontSize:12}}>{fmtFecha(u.ultimo_login)}</td>
                    <td style={{overflow:'visible',whiteSpace:'normal'}}>
                      <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                        <button className="btn sm" onClick={() => { setModalClave(u); setNuevaClave(generarClave()) }}>
                          <i className="ti ti-key"></i>Cambiar clave
                        </button>
                        {u.role !== 'admin' && (
                          <button className={'btn sm' + (u.activo ? ' danger' : '')} onClick={() => alternarActivo(u)}>
                            <i className={'ti ' + (u.activo ? 'ti-user-off' : 'ti-user-check')}></i>{u.activo ? 'Desactivar' : 'Activar'}
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

      {modalNuevo && (
        <div className="modal-bg open" onClick={e => e.target === e.currentTarget && setModalNuevo(false)}>
          <div className="modal" style={{maxWidth:460}}>
            <div className="modal-header">
              <h2>Nuevo usuario</h2>
              <button className="modal-close" onClick={() => setModalNuevo(false)}>&times;</button>
            </div>
            <div className="form-grid">
              <div className="form-group full"><label>Correo *</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="correo@ejemplo.com" autoFocus/>
              </div>
              <div className="form-group"><label>Nombre</label>
                <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Opcional"/>
              </div>
              <div className="form-group"><label>Rol</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  <option value="comite">{ROL_LABEL.comite}</option>
                  <option value="coach">{ROL_LABEL.coach}</option>
                </select>
              </div>
              <div className="form-group full"><label>Clave * (minimo 8 caracteres)</label>
                <div style={{display:'flex',gap:6}}>
                  <input value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} style={{flex:1}}/>
                  <button type="button" className="btn sm" onClick={() => setForm(f => ({ ...f, password: generarClave() }))}><i className="ti ti-refresh"></i>Generar</button>
                </div>
              </div>
            </div>
            <p style={{fontSize:11,color:'var(--text-3)',margin:'8px 0 12px'}}>Anota la clave ahora: despues no se puede volver a ver, solo cambiar.</p>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button className="btn" onClick={() => setModalNuevo(false)}>Cancelar</button>
              <button className="btn primary" onClick={guardarNuevo} disabled={saving}>
                {saving ? 'Creando...' : <><i className="ti ti-check"></i>Crear usuario</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalClave && (
        <div className="modal-bg open" onClick={e => e.target === e.currentTarget && setModalClave(null)}>
          <div className="modal" style={{maxWidth:420}}>
            <div className="modal-header">
              <h2>Cambiar clave</h2>
              <button className="modal-close" onClick={() => setModalClave(null)}>&times;</button>
            </div>
            <p style={{fontSize:12,color:'var(--text-3)',marginBottom:12,wordBreak:'break-all'}}>{modalClave.nombre ? modalClave.nombre + ' - ' : ''}{modalClave.email}</p>
            <div className="form-group full" style={{marginBottom:8}}><label>Nueva clave (minimo 8 caracteres)</label>
              <div style={{display:'flex',gap:6}}>
                <input value={nuevaClave} onChange={e => setNuevaClave(e.target.value)} style={{flex:1}} autoFocus/>
                <button type="button" className="btn sm" onClick={() => setNuevaClave(generarClave())}><i className="ti ti-refresh"></i>Generar</button>
              </div>
            </div>
            <p style={{fontSize:11,color:'var(--text-3)',marginBottom:12}}>Se cerraran las sesiones abiertas de este usuario. Anota la clave para entregarla.</p>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button className="btn" onClick={() => setModalClave(null)}>Cancelar</button>
              <button className="btn primary" onClick={guardarClave} disabled={saving}>
                {saving ? 'Guardando...' : <><i className="ti ti-check"></i>Guardar clave</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
