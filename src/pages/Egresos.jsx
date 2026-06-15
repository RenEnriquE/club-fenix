import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { formatMoney } from '../lib/helpers'

const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const METODOS = ['Transferencia','Efectivo','Cheque']
const TIPOS = ['ingreso','egreso']

function generarAnios() {
  const anios = []
  for (let a = 2024; a <= new Date().getFullYear(); a++) anios.push(a)
  return anios
}

export default function Egresos() {
  const [vista, setVista] = useState('resumen') // 'resumen' | 'detalle' | 'categorias'
  const [anio, setAnio] = useState(new Date().getFullYear())
  const [mes, setMes] = useState(null) // null = todos
  const [movimientos, setMovimientos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState(null)
  const [alert, setAlert] = useState(null)
  const [modalCat, setModalCat] = useState(false)
  const [editandoCat, setEditandoCat] = useState(null)
  const [formCat, setFormCat] = useState({ nombre: '', tipo: 'egreso', activa: true, orden: 99 })
  const [savingCat, setSavingCat] = useState(false)
  const [catExpandida, setCatExpandida] = useState(null)
  const [cuotas, setCuotas] = useState([])
  const [torneos, setTorneos] = useState([])

  useEffect(() => { cargarCategorias() }, [])
  useEffect(() => { cargar() }, [anio, mes])

  async function cargarCategorias() {
    const { data } = await supabase.from('categorias_movimiento').select('*').order('orden').order('nombre')
    setCategorias(data || [])
  }

  async function cargar() {
    setLoading(true)
    let q = supabase.from('movimientos').select('*').eq('anio', anio).order('fecha').order('id_movimiento')
    if (mes) q = q.eq('mes', mes)
    // Cargar cuotas con tipo de atleta
    // Filtrar cuotas y torneos por año/mes de fecha_pago (no del mes de la cuota)
    const fechaDesde = mes ? `${anio}-${String(mes).padStart(2,'0')}-01` : `${anio}-01-01`
    const fechaHasta = mes
      ? new Date(anio, mes, 0).toISOString().split('T')[0]  // ultimo dia del mes
      : `${anio}-12-31`
    let qc = supabase.from('pagos')
      .select('id_socio,mes,anio,monto,id_actividad,fecha_pago,personas(atleta)')
      .eq('id_actividad', 0)
      .gte('fecha_pago', fechaDesde)
      .lte('fecha_pago', fechaHasta)
    // Cargar pagos de torneos (id_actividad=999)
    let qt = supabase.from('pagos')
      .select('id_socio,mes,anio,monto,id_actividad,fecha_pago')
      .eq('id_actividad', 999)
      .gte('fecha_pago', fechaDesde)
      .lte('fecha_pago', fechaHasta)
    const [{ data }, { data: dataCuotas }, { data: dataTorneos }] = await Promise.all([q, qc, qt])
    setMovimientos(data || [])
    setCuotas(dataCuotas || [])
    setTorneos(dataTorneos || [])
    setLoading(false)
  }

  function mostrarAlert(type, msg) {
    setAlert({ type, msg })
    setTimeout(() => setAlert(null), 4000)
  }

  async function eliminar(id) {
    if (!confirm('Eliminar este movimiento?')) return
    await supabase.from('movimientos').delete().eq('id_movimiento', id)
    mostrarAlert('success', 'Movimiento eliminado.')
    cargar()
  }

  // Calculos torneos
  const totalTorneos = torneos.reduce((a, p) => a + (p.monto || 0), 0)

  // Calculos cuotas
  const cuotasAdultos = cuotas.filter(p => p.personas?.atleta === 'Atleta Adulto')
  const cuotasNinos = cuotas.filter(p => p.personas?.atleta && p.personas.atleta.includes('Ni'))
  const totalCuotasAdultos = cuotasAdultos.reduce((a, p) => a + (p.monto || 0), 0)
  const totalCuotasNinos = cuotasNinos.reduce((a, p) => a + (p.monto || 0), 0)
  const totalCuotas = totalCuotasAdultos + totalCuotasNinos

  // Calculos resumen
  const totalIngresos = movimientos.filter(m => m.tipo === 'ingreso').reduce((a, m) => a + m.monto, 0) + totalCuotas + totalTorneos
  const totalEgresos = movimientos.filter(m => m.tipo === 'egreso').reduce((a, m) => a + m.monto, 0)
  const saldo = totalIngresos - totalEgresos

  // Agrupar por categoria para resumen
  const porCategoria = categorias.map(cat => {
    const movsCat = movimientos.filter(m => m.id_categoria === cat.id_categoria)
    const ing = movsCat.filter(m => m.tipo === 'ingreso').reduce((a, m) => a + m.monto, 0)
    const egr = movsCat.filter(m => m.tipo === 'egreso').reduce((a, m) => a + m.monto, 0)
    return { ...cat, ingresos: ing, egresos: egr, saldo: ing - egr, movs: movsCat.length }
  }).filter(c => c.movs > 0)

  // Agrupar por mes para vista mensual
  const porMes = MESES_ES.map((nombre, i) => {
    const movsMes = movimientos.filter(m => m.mes === i + 1)
    const ing = movsMes.filter(m => m.tipo === 'ingreso').reduce((a, m) => a + m.monto, 0)
    const egr = movsMes.filter(m => m.tipo === 'egreso').reduce((a, m) => a + m.monto, 0)
    return { mes: i + 1, nombre, ingresos: ing, egresos: egr, saldo: ing - egr, movs: movsMes.length }
  }).filter(m => m.movs > 0)

  function abrirNuevaCat() {
    setEditandoCat(null)
    setFormCat({ nombre: '', tipo: 'egreso', activa: true })
    setModalCat(true)
  }

  function abrirEditarCat(cat) {
    setEditandoCat(cat)
    setFormCat({ nombre: cat.nombre, tipo: cat.tipo, activa: cat.activa, orden: cat.orden ?? 99 })
    setModalCat(true)
  }

  async function guardarCat() {
    if (!formCat.nombre.trim()) { mostrarAlert('error', 'El nombre es obligatorio.'); return }
    setSavingCat(true)
    try {
      if (editandoCat) {
        await supabase.from('categorias_movimiento').update(formCat).eq('id_categoria', editandoCat.id_categoria)
      } else {
        await supabase.from('categorias_movimiento').insert([formCat])
      }
      setModalCat(false)
      cargarCategorias()
      mostrarAlert('success', editandoCat ? 'Categoria actualizada.' : 'Categoria creada.')
    } catch(e) { mostrarAlert('error', 'Error: ' + e.message) }
    finally { setSavingCat(false) }
  }

  async function toggleActivaCat(cat) {
    await supabase.from('categorias_movimiento').update({ activa: !cat.activa }).eq('id_categoria', cat.id_categoria)
    cargarCategorias()
  }

  async function eliminarCat(cat) {
    const { count } = await supabase.from('movimientos').select('*', { count: 'exact', head: true }).eq('id_categoria', cat.id_categoria)
    if (count > 0) { mostrarAlert('error', `No se puede eliminar: tiene ${count} movimiento${count!==1?'s':''} asociado${count!==1?'s':''}.`); return }
    if (!confirm(`Eliminar "${cat.nombre}"?`)) return
    await supabase.from('categorias_movimiento').delete().eq('id_categoria', cat.id_categoria)
    cargarCategorias()
    mostrarAlert('success', 'Categoria eliminada.')
  }

  return (
    <div className="content">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Selector anio */}
          <select value={anio} onChange={e => setAnio(Number(e.target.value))}
            style={{ padding: '6px 10px', border: '0.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', background: '#fff' }}>
            {generarAnios().map(a => <option key={a}>{a}</option>)}
          </select>
          {/* Selector mes */}
          <select value={mes || ''} onChange={e => setMes(e.target.value ? Number(e.target.value) : null)}
            style={{ padding: '6px 10px', border: '0.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', background: '#fff' }}>
            <option value="">Todos los meses</option>
            {MESES_ES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
          {/* Tabs vista */}
          <div style={{ display: 'flex', gap: 4 }}>
            {[
              { key: 'resumen', icon: 'ti-chart-bar', label: 'Resumen' },
              { key: 'detalle', icon: 'ti-list', label: 'Detalle' },
              { key: 'categorias', icon: 'ti-tag', label: 'Categorias' },
            ].map(t => (
              <button key={t.key} className={`btn ${vista === t.key ? 'primary' : ''}`}
                onClick={() => setVista(t.key)} style={{ fontSize: 12, padding: '6px 12px' }}>
                <i className={`ti ${t.icon}`}></i>{t.label}
              </button>
            ))}
          </div>
        </div>
        <button className="btn primary" onClick={() => setEditando({})}>
          <i className="ti ti-plus"></i>Nuevo movimiento
        </button>
      </div>

      {alert && <div className={`alert ${alert.type}`} style={{ marginBottom: 12 }}>{alert.msg}</div>}

      {/* KPIs */}
      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'Total ingresos', val: formatMoney(totalIngresos), color: '#16a34a', bg: '#f0fdf4', border: '#a7f3d0' },
            { label: 'Total egresos', val: formatMoney(totalEgresos), color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
            { label: 'Saldo', val: formatMoney(saldo), color: saldo >= 0 ? '#1d4ed8' : '#dc2626', bg: saldo >= 0 ? '#eff6ff' : '#fef2f2', border: saldo >= 0 ? '#bfdbfe' : '#fecaca' },
            { label: 'Movimientos', val: movimientos.length + cuotas.length + torneos.length, color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' },
          ].map((k, i) => (
            <div key={i} style={{ background: k.bg, border: `0.5px solid ${k.border}`, borderRadius: 10, padding: '10px 14px' }}>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: k.color }}>{k.val}</div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="loading-center"><div className="spinner"></div></div>
      ) : movimientos.length === 0 && cuotas.length === 0 && torneos.length === 0 ? (
        <div className="card"><div className="empty"><i className="ti ti-receipt-off"></i>Sin movimientos en este periodo</div></div>
      ) : (
        <>
          {/* VISTA RESUMEN */}
          {vista === 'resumen' && (
            <div style={{ display: 'grid', gap: 16 }}>
              {/* Resumen por categoria */}
              <div className="card">
                <div className="card-title"><i className="ti ti-layout-list"></i>Por categoria</div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Categoria</th>
                        <th style={{ width: 110, textAlign: 'right' }}>Ingresos</th>
                        <th style={{ width: 110, textAlign: 'right' }}>Egresos</th>
                        <th style={{ width: 110, textAlign: 'right' }}>Saldo</th>
                        <th style={{ width: 60, textAlign: 'center' }}>Movs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Cuotas adultos */}
                      {totalCuotasAdultos > 0 && (
                        <tr style={{background:'#f0fdf4'}}>
                          <td style={{fontWeight:500,color:'#1a5e3a'}}>
                            <i className="ti ti-users" style={{marginRight:6,fontSize:12}}></i>
                            Ingresos Cuotas Socios Adultos
                          </td>
                          <td style={{textAlign:'right',color:'#16a34a',fontWeight:600}}>{formatMoney(totalCuotasAdultos)}</td>
                          <td style={{textAlign:'right',color:'#94a3b8'}}>-</td>
                          <td style={{textAlign:'right',fontWeight:600,color:'#1d4ed8'}}>{formatMoney(totalCuotasAdultos)}</td>
                          <td style={{textAlign:'center',color:'#64748b',fontSize:12}}>{cuotasAdultos.length}</td>
                        </tr>
                      )}
                      {/* Cuotas ninos */}
                      {totalCuotasNinos > 0 && (
                        <tr style={{background:'#f0fdf4'}}>
                          <td style={{fontWeight:500,color:'#1a5e3a'}}>
                            <i className="ti ti-users" style={{marginRight:6,fontSize:12}}></i>
                            Ingresos Cuotas Socios Ninos
                          </td>
                          <td style={{textAlign:'right',color:'#16a34a',fontWeight:600}}>{formatMoney(totalCuotasNinos)}</td>
                          <td style={{textAlign:'right',color:'#94a3b8'}}>-</td>
                          <td style={{textAlign:'right',fontWeight:600,color:'#1d4ed8'}}>{formatMoney(totalCuotasNinos)}</td>
                          <td style={{textAlign:'center',color:'#64748b',fontSize:12}}>{cuotasNinos.length}</td>
                        </tr>
                      )}
                      {/* Torneos */}
                      {totalTorneos > 0 && (
                        <tr style={{background:'#fff7ed'}}>
                          <td style={{fontWeight:500,color:'#c2410c'}}>
                            <i className="ti ti-trophy" style={{marginRight:6,fontSize:12}}></i>
                            Torneos
                          </td>
                          <td style={{textAlign:'right',color:'#16a34a',fontWeight:600}}>{formatMoney(totalTorneos)}</td>
                          <td style={{textAlign:'right',color:'#94a3b8'}}>-</td>
                          <td style={{textAlign:'right',fontWeight:600,color:'#1d4ed8'}}>{formatMoney(totalTorneos)}</td>
                          <td style={{textAlign:'center',color:'#64748b',fontSize:12}}>{torneos.length}</td>
                        </tr>
                      )}
                      {porCategoria.map(cat => {
                        const expandida = catExpandida === cat.id_categoria
                        const movsCat = movimientos.filter(m => m.id_categoria === cat.id_categoria)
                        return (
                          <>
                            <tr key={cat.id_categoria}
                              onClick={() => setCatExpandida(expandida ? null : cat.id_categoria)}
                              style={{cursor:'pointer'}}
                              className="hoverable">
                              <td style={{ fontWeight: 500 }}>
                                <i className={`ti ti-chevron-${expandida?'down':'right'}`} style={{marginRight:6,fontSize:11,color:'#94a3b8'}}></i>
                                {cat.nombre}
                              </td>
                              <td style={{ textAlign: 'right', color: cat.ingresos > 0 ? '#16a34a' : '#94a3b8' }}>
                                {cat.ingresos > 0 ? formatMoney(cat.ingresos) : '-'}
                              </td>
                              <td style={{ textAlign: 'right', color: cat.egresos > 0 ? '#dc2626' : '#94a3b8' }}>
                                {cat.egresos > 0 ? formatMoney(cat.egresos) : '-'}
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 600, color: cat.saldo >= 0 ? '#1d4ed8' : '#dc2626' }}>
                                {formatMoney(cat.saldo)}
                              </td>
                              <td style={{ textAlign: 'center', color: '#64748b', fontSize: 12 }}>{cat.movs}</td>
                            </tr>
                            {expandida && movsCat.map(m => (
                              <tr key={m.id_movimiento} style={{background:'#f8fafc'}}>
                                <td style={{paddingLeft:28,color:'var(--text-2)',fontSize:12}}>
                                  <span style={{color:'#94a3b8',marginRight:6}}>{m.fecha}</span>
                                  {m.item}
                                </td>
                                <td style={{textAlign:'right',color:'#16a34a',fontSize:12}}>
                                  {m.tipo==='ingreso'?formatMoney(m.monto):'-'}
                                </td>
                                <td style={{textAlign:'right',color:'#dc2626',fontSize:12}}>
                                  {m.tipo==='egreso'?formatMoney(m.monto):'-'}
                                </td>
                                <td style={{textAlign:'right',fontSize:11,color:'#94a3b8'}}>{m.obs||'-'}</td>
                                <td></td>
                              </tr>
                            ))}
                          </>
                        )
                      })}
                      <tr style={{ background: '#f8fafc', fontWeight: 700, fontSize: 13 }}>
                        <td>TOTAL</td>
                        <td style={{ textAlign: 'right', color: '#16a34a' }}>{formatMoney(totalIngresos)}</td>
                        <td style={{ textAlign: 'right', color: '#dc2626' }}>{formatMoney(totalEgresos)}</td>
                        <td style={{ textAlign: 'right', color: saldo >= 0 ? '#1d4ed8' : '#dc2626' }}>{formatMoney(saldo)}</td>
                        <td style={{ textAlign: 'center', color: '#64748b' }}>{movimientos.length + cuotas.length + torneos.length}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Resumen por mes */}
              {!mes && (
                <div className="card">
                  <div className="card-title"><i className="ti ti-calendar-stats"></i>Por mes</div>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="tbl">
                      <thead>
                        <tr>
                          <th>Mes</th>
                          <th style={{ width: 110, textAlign: 'right' }}>Ingresos</th>
                          <th style={{ width: 110, textAlign: 'right' }}>Egresos</th>
                          <th style={{ width: 110, textAlign: 'right' }}>Saldo</th>
                          <th style={{ width: 60, textAlign: 'center' }}>Movs</th>
                        </tr>
                      </thead>
                      <tbody>
                        {porMes.map(m => (
                          <tr key={m.mes} style={{ cursor: 'pointer' }} onClick={() => setMes(m.mes)}>
                            <td style={{ fontWeight: 500 }}>{m.nombre} {anio}</td>
                            <td style={{ textAlign: 'right', color: m.ingresos > 0 ? '#16a34a' : '#94a3b8' }}>
                              {m.ingresos > 0 ? formatMoney(m.ingresos) : '-'}
                            </td>
                            <td style={{ textAlign: 'right', color: m.egresos > 0 ? '#dc2626' : '#94a3b8' }}>
                              {m.egresos > 0 ? formatMoney(m.egresos) : '-'}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 600, color: m.saldo >= 0 ? '#1d4ed8' : '#dc2626' }}>
                              {formatMoney(m.saldo)}
                            </td>
                            <td style={{ textAlign: 'center', color: '#64748b', fontSize: 12 }}>{m.movs}</td>
                          </tr>
                        ))}
                        <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                          <td>TOTAL {anio}</td>
                          <td style={{ textAlign: 'right', color: '#16a34a' }}>{formatMoney(totalIngresos)}</td>
                          <td style={{ textAlign: 'right', color: '#dc2626' }}>{formatMoney(totalEgresos)}</td>
                          <td style={{ textAlign: 'right', color: saldo >= 0 ? '#1d4ed8' : '#dc2626' }}>{formatMoney(saldo)}</td>
                          <td style={{ textAlign: 'center', color: '#64748b' }}>{movimientos.length}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>Haz clic en un mes para filtrar el detalle</p>
                </div>
              )}
            </div>
          )}

          {/* CUOTAS POR MES */}

          {/* VISTA DETALLE */}
          {vista === 'detalle' && (
            <div className="card">
              <div className="card-title">
                <i className="ti ti-list"></i>
                Movimientos {mes ? `${MESES_ES[mes - 1]} ${anio}` : anio}
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="tbl" style={{ fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 90 }}>Fecha</th>
                      <th style={{ width: 80 }}>Tipo</th>
                      <th style={{ minWidth: 160 }}>Item</th>
                      <th style={{ minWidth: 120 }}>Categoria</th>
                      <th style={{ width: 100, textAlign: 'right' }}>Monto</th>
                      <th style={{ width: 90 }}>Metodo</th>
                      <th>Observaciones</th>
                      <th style={{ width: 70 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Combinar movimientos + cuotas + torneos, ordenados por fecha desc */}
                    {[
                      ...movimientos.map(m => ({
                        key: `mov-${m.id_movimiento}`,
                        fecha: m.fecha,
                        mes: m.mes,
                        tipo: m.tipo,
                        item: m.item,
                        categoria: categorias.find(c => c.id_categoria === m.id_categoria)?.nombre || m.item,
                        monto: m.monto,
                        metodo: m.metodo_pago,
                        obs: [m.obs, m.obs_detalle].filter(Boolean).join(' - ') || '-',
                        editable: true,
                        id: m.id_movimiento,
                        raw: m
                      })),
                      ...(() => {
                        // Agrupar cuotas por mes y tipo
                        const grupos = {}
                        cuotas.forEach(p => {
                          const esNino = p.personas?.atleta && p.personas.atleta.includes('Ni')
                          // Agrupar por mes/anio de fecha_pago real
                          const fp = p.fecha_pago ? new Date(p.fecha_pago + 'T12:00:00-04:00') : null
                          const mesPago = fp ? fp.getMonth() + 1 : p.mes
                          const anioPago = fp ? fp.getFullYear() : p.anio
                          const key = `${anioPago}-${mesPago}-${esNino?'nino':'adulto'}`
                          if (!grupos[key]) grupos[key] = { mes: mesPago, anio: anioPago, esNino, monto: 0, cant: 0, fecha: null }
                          grupos[key].monto += p.monto || 0
                          grupos[key].cant++
                        })
                        return Object.values(grupos).map(g => ({
                          key: `cuota-${g.anio}-${g.mes}-${g.esNino?'nino':'adulto'}`,
                          fecha: g.fecha,
                          mes: g.mes,
                          anio: g.anio,
                          tipo: 'ingreso',
                          item: g.esNino ? `Cuotas Socios Ninos - ${MESES_ES[g.mes-1]} ${g.anio}` : `Cuotas Socios Adultos - ${MESES_ES[g.mes-1]} ${g.anio}`,
                          categoria: g.esNino ? 'Cuotas Socios Ninos' : 'Cuotas Socios Adultos',
                          monto: g.monto,
                          metodo: '-',
                          obs: `${g.cant} pago${g.cant!==1?'s':''}`,
                          editable: false,
                          id: null
                        }))
                      })(),
                      ...(() => {
                        // Agrupar torneos por mes
                        const grupos = {}
                        torneos.forEach(p => {
                          const fp = p.fecha_pago ? new Date(p.fecha_pago + 'T12:00:00-04:00') : null
                          const mesPago = fp ? fp.getMonth() + 1 : p.mes
                          const anioPago = fp ? fp.getFullYear() : p.anio
                          const key = `${anioPago}-${mesPago}`
                          if (!grupos[key]) grupos[key] = { mes: mesPago, anio: anioPago, monto: 0, cant: 0, fecha: null }
                          grupos[key].monto += p.monto || 0
                          grupos[key].cant++
                        })
                        return Object.values(grupos).map(g => ({
                          key: `torneo-${g.anio}-${g.mes}`,
                          fecha: g.fecha,
                          mes: g.mes,
                          anio: g.anio,
                          tipo: 'ingreso',
                          item: `Torneos - ${MESES_ES[g.mes-1]} ${g.anio}`,
                          categoria: 'Torneos',
                          monto: g.monto,
                          metodo: '-',
                          obs: `${g.cant} inscripcion${g.cant!==1?'es':''}`,
                          editable: false,
                          id: null
                        }))
                      })()
                    ].sort((a,b) => {
                      const fa = a.fecha ? new Date(a.fecha) : new Date(anio, (a.mes||1)-1, 1)
                      const fb = b.fecha ? new Date(b.fecha) : new Date(anio, (b.mes||1)-1, 1)
                      return fb - fa
                    }).map(m => (
                      <tr key={m.key}>
                        <td style={{ color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{m.fecha ? m.fecha : `${MESES_ES[(m.mes||1)-1].substring(0,3)} ${m.anio||anio}`}</td>
                        <td>
                          <span style={{
                            fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                            background: m.tipo === 'ingreso' ? '#f0fdf4' : '#fef2f2',
                            color: m.tipo === 'ingreso' ? '#16a34a' : '#dc2626',
                            border: `0.5px solid ${m.tipo === 'ingreso' ? '#a7f3d0' : '#fecaca'}`
                          }}>
                            {m.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}
                          </span>
                        </td>
                        <td style={{ fontWeight: 500 }}>{m.item}</td>
                        <td style={{ color: 'var(--text-3)' }}>{m.categoria}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: m.tipo === 'ingreso' ? '#16a34a' : '#dc2626', whiteSpace: 'nowrap' }}>
                          {m.tipo === 'ingreso' ? '+' : '-'}{formatMoney(m.monto)}
                        </td>
                        <td style={{ color: 'var(--text-3)' }}>{m.metodo}</td>
                        <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-3)' }}
                          title={m.obs}>{m.obs}</td>
                        <td>
                          {m.editable && (
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button className="btn sm" onClick={() => setEditando(m.raw)} title="Editar"><i className="ti ti-pencil"></i></button>
                              <button className="btn sm danger" onClick={() => eliminar(m.id)} title="Eliminar"><i className="ti ti-trash"></i></button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {/* --- linea que reemplaza el map original --- */}
                                        {/* Totales */}
                    <tr style={{ background: '#f8fafc', fontWeight: 700, fontSize: 13 }}>
                      <td colSpan={4}>TOTAL</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ color: '#16a34a', fontSize: 11 }}>+{formatMoney(totalIngresos)}</div>
                        <div style={{ color: '#dc2626', fontSize: 11 }}>-{formatMoney(totalEgresos)}</div>
                        <div style={{ color: saldo >= 0 ? '#1d4ed8' : '#dc2626' }}>{formatMoney(saldo)}</div>
                      </td>
                      <td colSpan={3}></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* VISTA CATEGORIAS */}
      {!loading && vista === 'categorias' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div className="card-title" style={{ marginBottom: 0 }}>
              <i className="ti ti-tag"></i>Categorias de movimientos
            </div>
            <button className="btn primary" onClick={abrirNuevaCat} style={{ fontSize: 12 }}>
              <i className="ti ti-plus"></i>Nueva categoria
            </button>
          </div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 60, textAlign:'center' }}>Orden</th>
                  <th>Nombre</th>
                  <th style={{ width: 90 }}>Tipo</th>
                  <th style={{ width: 90 }}>Estado</th>
                  <th style={{ width: 110 }}></th>
                </tr>
              </thead>
              <tbody>
                {categorias.map(cat => (
                  <tr key={cat.id_categoria}>
                    <td style={{ textAlign:'center', color:'#94a3b8', fontSize:12, fontWeight:600 }}>{cat.orden ?? 99}</td>
                    <td style={{ fontWeight: 500 }}>{cat.nombre}</td>
                    <td>
                      <span style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600,
                        background: cat.tipo === 'ingreso' ? '#f0fdf4' : cat.tipo === 'egreso' ? '#fef2f2' : '#eff6ff',
                        color: cat.tipo === 'ingreso' ? '#16a34a' : cat.tipo === 'egreso' ? '#dc2626' : '#1d4ed8',
                        border: `0.5px solid ${cat.tipo === 'ingreso' ? '#a7f3d0' : cat.tipo === 'egreso' ? '#fecaca' : '#bfdbfe'}`
                      }}>
                        {cat.tipo === 'ingreso' ? 'Ingreso' : cat.tipo === 'egreso' ? 'Egreso' : 'Ambos'}
                      </span>
                    </td>
                    <td>
                      <button onClick={() => toggleActivaCat(cat)} style={{
                        background: cat.activa ? '#f0fdf4' : '#f8fafc',
                        border: `0.5px solid ${cat.activa ? '#a7f3d0' : '#e2e8f0'}`,
                        borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 600,
                        color: cat.activa ? '#16a34a' : '#94a3b8', cursor: 'pointer', fontFamily: 'inherit'
                      }}>
                        {cat.activa ? 'Activa' : 'Inactiva'}
                      </button>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn sm" onClick={() => abrirEditarCat(cat)}><i className="ti ti-pencil"></i></button>
                        <button className="btn sm danger" onClick={() => eliminarCat(cat)}><i className="ti ti-trash"></i></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal nueva / editar categoria */}
      {modalCat && (
        <div className="modal-bg open" onClick={e => e.target === e.currentTarget && setModalCat(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2>{editandoCat ? 'Editar categoria' : 'Nueva categoria'}</h2>
              <button className="modal-close" onClick={() => setModalCat(false)}>&times;</button>
            </div>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label>Nombre *</label>
              <input value={formCat.nombre} onChange={e => setFormCat(f => ({ ...f, nombre: e.target.value }))}
                placeholder="Ej: Limpieza / Articulos de aseo" autoFocus
                onKeyDown={e => e.key === 'Enter' && guardarCat()} />
            </div>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label>Tipo</label>
              <select value={formCat.tipo} onChange={e => setFormCat(f => ({ ...f, tipo: e.target.value }))}>
                <option value="egreso">Egreso</option>
                <option value="ingreso">Ingreso</option>
                <option value="ambos">Ambos</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label>Orden de visualizacion</label>
              <input type="number" value={formCat.orden} onChange={e => setFormCat(f => ({ ...f, orden: Number(e.target.value) }))}
                placeholder="Ej: 1, 2, 3..." min={1}/>
              <span style={{fontSize:11,color:'#64748b',marginTop:2,display:'block'}}>Numero menor aparece primero en el resumen</span>
            </div>
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label>Estado</label>
              <select value={formCat.activa} onChange={e => setFormCat(f => ({ ...f, activa: e.target.value === 'true' }))}>
                <option value="true">Activa</option>
                <option value="false">Inactiva</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setModalCat(false)}>Cancelar</button>
              <button className="btn primary" onClick={guardarCat} disabled={savingCat}>
                {savingCat ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }}></div>Guardando...</> : <><i className="ti ti-check"></i>{editandoCat ? 'Guardar' : 'Crear'}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal nuevo / editar movimiento */}
      {editando !== null && (
        <ModalMovimiento
          movimiento={editando}
          categorias={categorias}
          anio={anio}
          onClose={() => setEditando(null)}
          onSaved={() => { setEditando(null); cargar(); mostrarAlert('success', 'Movimiento guardado.') }}
        />
      )}
    </div>
  )
}

// ── Modal nuevo/editar movimiento ─────────────────────────────────────
function ModalMovimiento({ movimiento, categorias, anio, onClose, onSaved }) {
  const esNuevo = !movimiento.id_movimiento
  const [form, setForm] = useState({
    fecha: movimiento.fecha || new Date().toISOString().split('T')[0],
    tipo: movimiento.tipo || 'egreso',
    id_categoria: movimiento.id_categoria || '',
    item: movimiento.item || '',
    monto: movimiento.monto || '',
    metodo_pago: movimiento.metodo_pago || 'Transferencia',
    num_comprobante: movimiento.num_comprobante || '',
    obs: movimiento.obs || '',
    obs_detalle: movimiento.obs_detalle || '',
  })
  const [saving, setSaving] = useState(false)
  const [alert, setAlert] = useState(null)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function guardar() {
    if (!form.fecha) { setAlert({ type: 'error', msg: 'La fecha es obligatoria.' }); return }
    if (!form.item.trim()) { setAlert({ type: 'error', msg: 'El item es obligatorio.' }); return }
    if (!form.monto || Number(form.monto) <= 0) { setAlert({ type: 'error', msg: 'El monto debe ser mayor a 0.' }); return }
    if (!form.tipo) { setAlert({ type: 'error', msg: 'Selecciona el tipo.' }); return }

    setSaving(true)
    try {
      const payload = {
        fecha: form.fecha,
        tipo: form.tipo,
        id_categoria: form.id_categoria ? Number(form.id_categoria) : null,
        item: form.item.trim(),
        monto: Number(form.monto),
        metodo_pago: form.metodo_pago || null,
        num_comprobante: form.num_comprobante || null,
        obs: form.obs || null,
        obs_detalle: form.obs_detalle || null,
      }
      if (esNuevo) {
        await supabase.from('movimientos').insert([payload])
      } else {
        await supabase.from('movimientos').update(payload).eq('id_movimiento', movimiento.id_movimiento)
      }
      onSaved()
    } catch (e) {
      setAlert({ type: 'error', msg: 'Error: ' + e.message })
    } finally {
      setSaving(false)
    }
  }

  const catsFiltradas = categorias.filter(c => c.activa && (
    c.tipo === 'ambos' || c.tipo === form.tipo
  ))

  return (
    <div className="modal-bg open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 'min(640px,95vw)' }}>
        <div className="modal-header">
          <h2>{esNuevo ? 'Nuevo movimiento' : 'Editar movimiento'}</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="form-grid">
          {/* Tipo */}
          <div className="form-group">
            <label>Tipo *</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {TIPOS.map(t => (
                <button key={t} onClick={() => set('tipo', t)}
                  style={{
                    flex: 1, padding: '8px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
                    border: `1.5px solid ${form.tipo === t ? (t === 'ingreso' ? '#16a34a' : '#dc2626') : '#e2e8f0'}`,
                    background: form.tipo === t ? (t === 'ingreso' ? '#f0fdf4' : '#fef2f2') : '#f8fafc',
                    color: form.tipo === t ? (t === 'ingreso' ? '#16a34a' : '#dc2626') : '#64748b',
                  }}>
                  {t === 'ingreso' ? 'Ingreso' : 'Egreso'}
                </button>
              ))}
            </div>
          </div>

          {/* Fecha */}
          <div className="form-group">
            <label>Fecha *</label>
            <input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} />
          </div>

          {/* Item */}
          <div className="form-group full">
            <label>Item / Descripcion *</label>
            <input value={form.item} onChange={e => set('item', e.target.value)}
              placeholder="Ej: Remuneracion Coach, Cuotas socios adultos..." />
          </div>

          {/* Categoria */}
          <div className="form-group">
            <label>Categoria</label>
            <select value={form.id_categoria} onChange={e => set('id_categoria', e.target.value)}>
              <option value="">Sin categoria</option>
              {catsFiltradas.map(c => <option key={c.id_categoria} value={c.id_categoria}>{c.nombre}</option>)}
            </select>
          </div>

          {/* Monto */}
          <div className="form-group">
            <label>Monto ($) *</label>
            <input type="number" value={form.monto} onChange={e => set('monto', e.target.value)} placeholder="0" />
          </div>

          {/* Metodo */}
          <div className="form-group">
            <label>Metodo de pago</label>
            <select value={form.metodo_pago} onChange={e => set('metodo_pago', e.target.value)}>
              {METODOS.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>

          {/* Comprobante */}
          <div className="form-group">
            <label>N comprobante</label>
            <input value={form.num_comprobante} onChange={e => set('num_comprobante', e.target.value)} placeholder="Opcional" />
          </div>

          {/* Observaciones */}
          <div className="form-group full">
            <label>Observaciones</label>
            <input value={form.obs} onChange={e => set('obs', e.target.value)} placeholder="Ej: Pago remuneracion mensual" />
          </div>

          {/* Detalle */}
          <div className="form-group full">
            <label>Detalle adicional</label>
            <input value={form.obs_detalle} onChange={e => set('obs_detalle', e.target.value)} placeholder="Opcional" />
          </div>
        </div>

        {/* Preview monto */}
        {form.monto > 0 && (
          <div style={{
            background: form.tipo === 'ingreso' ? '#f0fdf4' : '#fef2f2',
            border: `0.5px solid ${form.tipo === 'ingreso' ? '#a7f3d0' : '#fecaca'}`,
            borderRadius: 8, padding: '10px 14px', marginBottom: 12,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{form.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'} a registrar</span>
            <span style={{ fontWeight: 700, fontSize: 16, color: form.tipo === 'ingreso' ? '#16a34a' : '#dc2626' }}>
              {form.tipo === 'ingreso' ? '+' : '-'}{formatMoney(Number(form.monto))}
            </span>
          </div>
        )}

        {alert && <div className={`alert ${alert.type}`} style={{ marginBottom: 12 }}>{alert.msg}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn primary" onClick={guardar} disabled={saving}>
            {saving
              ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }}></div>Guardando...</>
              : <><i className="ti ti-check"></i>{esNuevo ? 'Registrar' : 'Guardar cambios'}</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}
