import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Actividades() {
  const [actividades, setActividades] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null) // null = nueva
  const [nombre, setNombre] = useState('')
  const [activa, setActiva] = useState(true)
  const [saving, setSaving] = useState(false)
  const [alert, setAlert] = useState(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase
      .from('actividades')
      .select('*')
      .order('id_actividad')
    setActividades(data || [])
    setLoading(false)
  }

  function abrirNueva() {
    setEditando(null)
    setNombre('')
    setActiva(true)
    setModal(true)
  }

  function abrirEditar(act) {
    setEditando(act)
    setNombre(act.nombre)
    setActiva(act.activa)
    setModal(true)
  }

  function cerrar() {
    setModal(false)
    setEditando(null)
    setNombre('')
    setActiva(true)
  }

  async function guardar() {
    if (!nombre.trim()) { setAlert({ type: 'error', msg: 'El nombre es obligatorio.' }); return }
    setSaving(true)
    try {
      if (editando) {
        const { error } = await supabase
          .from('actividades')
          .update({ nombre: nombre.trim(), activa })
          .eq('id_actividad', editando.id_actividad)
        if (error) throw error
        mostrarAlert('success', 'Actividad actualizada.')
      } else {
        // Calcular nuevo ID (max + 1, saltando el 0 que es Cuotas)
        const maxId = actividades.reduce((m, a) => Math.max(m, a.id_actividad), 0)
        const { error } = await supabase
          .from('actividades')
          .insert([{ id_actividad: maxId + 1, nombre: nombre.trim(), activa }])
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
    if (act.id_actividad === 0) return // Cuotas no se puede desactivar
    await supabase
      .from('actividades')
      .update({ activa: !act.activa })
      .eq('id_actividad', act.id_actividad)
    cargar()
  }

  async function eliminar(act) {
    if (act.id_actividad === 0) {
      mostrarAlert('error', 'La actividad Cuotas no se puede eliminar.')
      return
    }
    // Verificar si tiene pagos asociados
    const { count } = await supabase
      .from('pagos')
      .select('*', { count: 'exact', head: true })
      .eq('id_actividad', act.id_actividad)
    if (count > 0) {
      mostrarAlert('error', `No se puede eliminar: tiene ${count} pago${count !== 1 ? 's' : ''} asociado${count !== 1 ? 's' : ''}.`)
      return
    }
    if (!confirm(`Eliminar "${act.nombre}"?`)) return
    await supabase.from('actividades').delete().eq('id_actividad', act.id_actividad)
    mostrarAlert('success', 'Actividad eliminada.')
    cargar()
  }

  function mostrarAlert(type, msg) {
    setAlert({ type, msg })
    setTimeout(() => setAlert(null), 4000)
  }

  const totalPagos = (idAct) => 0 // placeholder, se podria cargar si se necesita

  return (
    <div className="content">
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
          Define los tipos de pago que puede recibir el club. Por defecto todos los pagos corresponden a <strong>Cuotas</strong>.
        </p>

        {alert && <div className={`alert ${alert.type}`}>{alert.msg}</div>}

        {loading ? (
          <div className="loading-center"><div className="spinner"></div></div>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>ID</th>
                  <th>Nombre</th>
                  <th style={{ width: 100 }}>Estado</th>
                  <th style={{ width: 120 }}></th>
                </tr>
              </thead>
              <tbody>
                {actividades.map(act => (
                  <tr key={act.id_actividad}>
                    <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{act.id_actividad}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: act.id_actividad === 0 ? 600 : 400 }}>
                          {act.nombre}
                        </span>
                        {act.id_actividad === 0 && (
                          <span style={{ fontSize: 10, background: '#e8f5ee', color: '#1a5e3a', padding: '2px 6px', borderRadius: 4, border: '0.5px solid #a7f3d0', fontWeight: 600 }}>
                            DEFAULT
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <button
                        onClick={() => toggleActiva(act)}
                        disabled={act.id_actividad === 0}
                        style={{
                          background: act.activa ? '#f0fdf4' : '#f8fafc',
                          border: `0.5px solid ${act.activa ? '#a7f3d0' : '#e2e8f0'}`,
                          borderRadius: 6,
                          padding: '3px 10px',
                          fontSize: 11,
                          fontWeight: 600,
                          color: act.activa ? '#16a34a' : '#94a3b8',
                          cursor: act.id_actividad === 0 ? 'default' : 'pointer',
                          fontFamily: 'inherit'
                        }}>
                        {act.activa ? 'Activa' : 'Inactiva'}
                      </button>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn sm"
                          onClick={() => abrirEditar(act)}
                          disabled={act.id_actividad === 0}
                          title={act.id_actividad === 0 ? 'No editable' : 'Editar'}>
                          <i className="ti ti-pencil"></i>
                        </button>
                        <button
                          className="btn sm danger"
                          onClick={() => eliminar(act)}
                          disabled={act.id_actividad === 0}
                          title={act.id_actividad === 0 ? 'No eliminable' : 'Eliminar'}>
                          <i className="ti ti-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal nueva / editar */}
      {modal && (
        <div className="modal-bg open" onClick={e => e.target === e.currentTarget && cerrar()}>
          <div className="modal">
            <div className="modal-header">
              <h2>{editando ? 'Editar actividad' : 'Nueva actividad'}</h2>
              <button className="modal-close" onClick={cerrar}>&times;</button>
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label>Nombre de la actividad</label>
              <input
                type="text"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Ej: Rifa CAIF 2026, Paseo anual, Torneo..."
                autoFocus
                onKeyDown={e => e.key === 'Enter' && guardar()}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 20 }}>
              <label>Estado</label>
              <select value={activa} onChange={e => setActiva(e.target.value === 'true')}>
                <option value="true">Activa (visible al registrar pagos)</option>
                <option value="false">Inactiva (oculta al registrar pagos)</option>
              </select>
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
    </div>
  )
}
