import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { formatMoney } from '../lib/helpers'

const BANCOS = ['Banco Estado','Banco BCI','Banco Santander','Banco de Chile','Banco Itau','Banco BBVA','Banco Security','Coopeuch / Dale','Mercado Pago','TENPO','Otro']
const TIPOS_CUENTA = ['Cuenta Corriente','Cuenta Vista','Cuenta RUT','Cuenta Ahorro']
const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

// -- Vistas ------------------------------------------------------------
// lista -> detalle torneo -> detalle edicion

export default function Torneos() {
  const [vista, setVista] = useState('lista') // 'lista' | 'torneo' | 'edicion'
  const [torneos, setTorneos] = useState([])
  const [torneoSel, setTorneoSel] = useState(null)
  const [edicionSel, setEdicionSel] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { cargarTorneos() }, [])

  async function cargarTorneos() {
    setLoading(true)
    const { data } = await supabase.from('torneos').select('*').order('nombre')
    setTorneos(data || [])
    setLoading(false)
  }

  function irATorneo(t) { setTorneoSel(t); setVista('torneo') }
  function irAEdicion(e) { setEdicionSel(e); setVista('edicion') }
  function irALista() { setVista('lista'); setEdicionSel(null); setTorneoSel(null); cargarTorneos() }
  function irATorneoDesdeEdicion() { setVista('torneo'); setEdicionSel(null) }

  return (
    <div className="content">
      {vista === 'lista' && <ListaTorneos torneos={torneos} loading={loading} onSelect={irATorneo} onRefresh={cargarTorneos} />}
      {vista === 'torneo' && <DetalleTorneo torneo={torneoSel} onBack={irALista} onSelectEdicion={irAEdicion} onRefresh={() => {}} />}
      {vista === 'edicion' && <DetalleEdicion edicion={edicionSel} torneo={torneoSel} onBack={irATorneoDesdeEdicion} />}
    </div>
  )
}

// -- Lista de torneos --------------------------------------------------
function ListaTorneos({ torneos, loading, onSelect, onRefresh }) {
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState({ nombre:'', organizador:'', rut_organizador:'', banco:'', tipo_cuenta:'', num_cuenta:'', email_organizador:'', activo:true })
  const [saving, setSaving] = useState(false)
  const [alert, setAlert] = useState(null)

  function abrirNuevo() {
    setEditando(null)
    setForm({ nombre:'', organizador:'', rut_organizador:'', banco:'', tipo_cuenta:'', num_cuenta:'', email_organizador:'', activo:true })
    setModal(true)
  }

  function abrirEditar(t, e) {
    e.stopPropagation()
    setEditando(t)
    setForm({ nombre:t.nombre, organizador:t.organizador||'', rut_organizador:t.rut_organizador||'', banco:t.banco||'', tipo_cuenta:t.tipo_cuenta||'', num_cuenta:t.num_cuenta||'', email_organizador:t.email_organizador||'', activo:t.activo })
    setModal(true)
  }

  function cerrar() { setModal(false); setEditando(null); setAlert(null) }

  async function guardar() {
    if (!form.nombre.trim()) { setAlert({ type:'error', msg:'El nombre es obligatorio.' }); return }
    setSaving(true)
    try {
      if (editando) {
        await supabase.from('torneos').update(form).eq('id_torneo', editando.id_torneo)
      } else {
        await supabase.from('torneos').insert([form])
      }
      cerrar()
      onRefresh()
    } catch(e) { setAlert({ type:'error', msg:'Error: '+e.message }) }
    finally { setSaving(false) }
  }

  async function eliminar(t, e) {
    e.stopPropagation()
    const { count } = await supabase.from('ediciones_torneo').select('*', { count:'exact', head:true }).eq('id_torneo', t.id_torneo)
    if (count > 0) { alert(`No se puede eliminar: tiene ${count} edicion${count!==1?'es':''} registrada${count!==1?'s':''}.`); return }
    if (!confirm(`Eliminar "${t.nombre}"?`)) return
    await supabase.from('torneos').delete().eq('id_torneo', t.id_torneo)
    onRefresh()
  }

  return (
    <>
      <div className="card">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
          <div className="card-title" style={{marginBottom:0}}><i className="ti ti-trophy"></i>Torneos</div>
          <button className="btn primary" onClick={abrirNuevo}><i className="ti ti-plus"></i>Nuevo torneo</button>
        </div>
        <p style={{fontSize:12,color:'var(--text-3)',marginBottom:16}}>Gestiona los torneos en los que participan los atletas del club.</p>

        {loading ? <div className="loading-center"><div className="spinner"></div></div> :
         torneos.length === 0 ? <div className="empty"><i className="ti ti-trophy-off"></i>No hay torneos registrados</div> : (
          <div style={{display:'grid',gap:8}}>
            {torneos.map(t => (
              <div key={t.id_torneo} onClick={()=>onSelect(t)} style={{background:'#f8fafc',border:'0.5px solid #e2e8f0',borderRadius:10,padding:'12px 16px',cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center'}} className="hoverable">
                <div>
                  <div style={{fontWeight:600,fontSize:14,color:'var(--text)'}}>{t.nombre}</div>
                  <div style={{fontSize:12,color:'var(--text-3)',marginTop:2}}>
                    {t.organizador && <span>{t.organizador}</span>}
                    {t.email_organizador && <span style={{marginLeft:8}}>{t.email_organizador}</span>}
                  </div>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <span style={{fontSize:11,padding:'2px 8px',borderRadius:999,background:t.activo?'#f0fdf4':'#f8fafc',color:t.activo?'#16a34a':'#94a3b8',border:`0.5px solid ${t.activo?'#a7f3d0':'#e2e8f0'}`,fontWeight:600}}>
                    {t.activo?'Activo':'Inactivo'}
                  </span>
                  <button className="btn sm" onClick={e=>abrirEditar(t,e)}><i className="ti ti-pencil"></i></button>
                  <button className="btn sm danger" onClick={e=>eliminar(t,e)}><i className="ti ti-trash"></i></button>
                  <i className="ti ti-chevron-right" style={{color:'var(--text-3)'}}></i>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modal && (
        <div className="modal-bg open">
          <div className="modal">
            <div className="modal-header">
              <h2>{editando?'Editar torneo':'Nuevo torneo'}</h2>
              <button className="modal-close" onClick={cerrar}>&times;</button>
            </div>
            <div className="form-grid">
              <div className="form-group full"><label>Nombre del torneo *</label><input value={form.nombre} onChange={e=>setForm(f=>({...f,nombre:e.target.value}))} placeholder="Ej: Torneo La Pintana"/></div>
              <div className="form-group"><label>Organizador</label><input value={form.organizador} onChange={e=>setForm(f=>({...f,organizador:e.target.value}))}/></div>
              <div className="form-group"><label>RUT organizador</label><input value={form.rut_organizador} onChange={e=>setForm(f=>({...f,rut_organizador:e.target.value}))} placeholder="12345678-9"/></div>
              <div className="form-group"><label>Banco</label>
                <select value={form.banco} onChange={e=>setForm(f=>({...f,banco:e.target.value}))}>
                  <option value="">Seleccionar...</option>
                  {BANCOS.map(b=><option key={b}>{b}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Tipo de cuenta</label>
                <select value={form.tipo_cuenta} onChange={e=>setForm(f=>({...f,tipo_cuenta:e.target.value}))}>
                  <option value="">Seleccionar...</option>
                  {TIPOS_CUENTA.map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group"><label>N de cuenta</label><input value={form.num_cuenta} onChange={e=>setForm(f=>({...f,num_cuenta:e.target.value}))}/></div>
              <div className="form-group"><label>Email</label><input type="email" value={form.email_organizador} onChange={e=>setForm(f=>({...f,email_organizador:e.target.value}))}/></div>
              <div className="form-group"><label>Estado</label>
                <select value={form.activo} onChange={e=>setForm(f=>({...f,activo:e.target.value==='true'}))}>
                  <option value="true">Activo</option>
                  <option value="false">Inactivo</option>
                </select>
              </div>
            </div>
            {alert && <div className={`alert ${alert.type}`} style={{marginBottom:12}}>{alert.msg}</div>}
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button className="btn" onClick={cerrar}>Cancelar</button>
              <button className="btn primary" onClick={guardar} disabled={saving}>
                {saving?<><div className="spinner" style={{width:14,height:14,borderWidth:2}}></div>Guardando...</>:<><i className="ti ti-check"></i>{editando?'Guardar':'Crear'}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// -- Detalle torneo: ediciones -----------------------------------------
function DetalleTorneo({ torneo, onBack, onSelectEdicion }) {
  const [ediciones, setEdiciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState({ fecha:'', valor_atleta:'', obs:'' })
  const [saving, setSaving] = useState(false)
  const [alert, setAlert] = useState(null)

  useEffect(() => { cargar() }, [torneo])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase
      .from('ediciones_torneo')
      .select('*, inscripciones_torneo(count)')
      .eq('id_torneo', torneo.id_torneo)
      .order('fecha', { ascending: false })
    setEdiciones(data || [])
    setLoading(false)
  }

  function abrirNueva() {
    setEditando(null)
    setForm({ fecha: new Date().toISOString().split('T')[0], valor_atleta: torneo.valor_default || '', valor_organizador: torneo.valor_default || '', obs: '' })
    setModal(true)
  }

  function abrirEditar(e, ev) {
    ev.stopPropagation()
    setEditando(e)
    setForm({ fecha: e.fecha, valor_atleta: e.valor_atleta, valor_organizador: e.valor_organizador || '', obs: e.obs || '' })
    setModal(true)
  }

  function cerrar() { setModal(false); setEditando(null); setAlert(null) }

  async function guardar() {
    if (!form.fecha) { setAlert({ type:'error', msg:'La fecha es obligatoria.' }); return }
    if (!form.valor_atleta || Number(form.valor_atleta) < 0) { setAlert({ type:'error', msg:'El valor debe ser mayor o igual a 0.' }); return }
    setSaving(true)
    try {
      const payload = { id_torneo: torneo.id_torneo, fecha: form.fecha, valor_atleta: Number(form.valor_atleta), valor_organizador: Number(form.valor_organizador) || 0, obs: form.obs || null }
      if (editando) {
        await supabase.from('ediciones_torneo').update(payload).eq('id_edicion', editando.id_edicion)
      } else {
        await supabase.from('ediciones_torneo').insert([payload])
      }
      cerrar(); cargar()
    } catch(e) { setAlert({ type:'error', msg:'Error: '+e.message }) }
    finally { setSaving(false) }
  }

  async function eliminar(e, ev) {
    ev.stopPropagation()
    const { count } = await supabase.from('inscripciones_torneo').select('*', { count:'exact', head:true }).eq('id_edicion', e.id_edicion)
    if (count > 0) { alert(`No se puede eliminar: tiene ${count} inscripcion${count!==1?'es':''}.`); return }
    if (!confirm('Eliminar esta edicion?')) return
    await supabase.from('ediciones_torneo').delete().eq('id_edicion', e.id_edicion)
    cargar()
  }

  const totalRecaudado = ediciones.reduce((a, e) => a + (e.valor_atleta * (e.inscripciones_torneo?.[0]?.count || 0)), 0)

  return (
    <>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:16}}>
        <button className="btn" onClick={onBack}><i className="ti ti-arrow-left"></i>Volver</button>
        <h2 style={{fontSize:16,fontWeight:700,color:'var(--accent)'}}>{torneo.nombre}</h2>
      </div>

      {/* Datos del organizador */}
      <div className="card">
        <div className="card-title"><i className="ti ti-building"></i>Datos del organizador</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:10,fontSize:13}}>
          {[
            { label:'Organizador', val: torneo.organizador },
            { label:'RUT', val: torneo.rut_organizador },
            { label:'Banco', val: torneo.banco },
            { label:'Tipo cuenta', val: torneo.tipo_cuenta },
            { label:'N cuenta', val: torneo.num_cuenta },
            { label:'Email', val: torneo.email_organizador },
          ].filter(i => i.val).map((item, i) => (
            <div key={i}>
              <div style={{fontSize:11,color:'var(--text-3)',fontWeight:600,textTransform:'uppercase',marginBottom:2}}>{item.label}</div>
              <div style={{fontWeight:500}}>{item.val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Ediciones */}
      <div className="card">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
          <div className="card-title" style={{marginBottom:0}}><i className="ti ti-calendar-event"></i>Ediciones del torneo</div>
          <button className="btn primary" onClick={abrirNueva}><i className="ti ti-plus"></i>Nueva edicion</button>
        </div>

        {loading ? <div className="loading-center"><div className="spinner"></div></div> :
         ediciones.length === 0 ? <div className="empty"><i className="ti ti-calendar-off"></i>Sin ediciones registradas</div> : (
          <div style={{display:'grid',gap:8}}>
            {ediciones.map(e => {
              const inscritos = e.inscripciones_torneo?.[0]?.count || 0
              const fecha = new Date(e.fecha+'T12:00:00')
              const mes = MESES_ES[fecha.getMonth()]
              const anio = fecha.getFullYear()
              return (
                <div key={e.id_edicion} onClick={()=>onSelectEdicion(e)} style={{background:'#f8fafc',border:'0.5px solid #e2e8f0',borderRadius:10,padding:'12px 16px',cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div>
                    <div style={{fontWeight:600,fontSize:14}}>{mes} {anio}</div>
                    <div style={{fontSize:12,color:'var(--text-3)',marginTop:2}}>
                      Fecha: {e.fecha} &middot; Valor: {formatMoney(e.valor_atleta)}/atleta &middot; {inscritos} inscrito{inscritos!==1?'s':''}
                    </div>
                    {e.obs && <div style={{fontSize:11,color:'var(--text-3)',marginTop:2}}>{e.obs}</div>}
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontWeight:700,color:'var(--accent)',fontSize:14}}>{formatMoney(e.valor_atleta * inscritos)}</div>
                      <div style={{fontSize:11,color:'var(--text-3)'}}>potencial</div>
                    </div>
                    <button className="btn sm" onClick={ev=>abrirEditar(e,ev)}><i className="ti ti-pencil"></i></button>
                    <button className="btn sm danger" onClick={ev=>eliminar(e,ev)}><i className="ti ti-trash"></i></button>
                    <i className="ti ti-chevron-right" style={{color:'var(--text-3)'}}></i>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {modal && (
        <div className="modal-bg open">
          <div className="modal">
            <div className="modal-header">
              <h2>{editando?'Editar edicion':'Nueva edicion'} &mdash; {torneo.nombre}</h2>
              <button className="modal-close" onClick={cerrar}>&times;</button>
            </div>
            <div className="form-grid">
              <div className="form-group"><label>Fecha del torneo *</label><input type="date" value={form.fecha} onChange={e=>setForm(f=>({...f,fecha:e.target.value}))}/></div>
              <div className="form-group"><label>Valor por atleta ($) *</label><input type="number" value={form.valor_atleta} onChange={e=>setForm(f=>({...f,valor_atleta:e.target.value}))} placeholder="Lo que paga cada atleta al club"/></div>
              <div className="form-group"><label>Valor organizador por atleta ($)</label><input type="number" value={form.valor_organizador} onChange={e=>setForm(f=>({...f,valor_organizador:e.target.value}))} placeholder="Lo que cobra el organizador"/></div>
              <div className="form-group full"><label>Observaciones</label><input value={form.obs} onChange={e=>setForm(f=>({...f,obs:e.target.value}))} placeholder="Opcional"/></div>
            </div>
            {alert && <div className={`alert ${alert.type}`} style={{marginBottom:12}}>{alert.msg}</div>}
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button className="btn" onClick={cerrar}>Cancelar</button>
              <button className="btn primary" onClick={guardar} disabled={saving}>
                {saving?<><div className="spinner" style={{width:14,height:14,borderWidth:2}}></div>Guardando...</>:<><i className="ti ti-check"></i>{editando?'Guardar':'Crear'}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// -- Detalle edicion: atletas inscritos --------------------------------
function DetalleEdicion({ edicion, torneo, onBack }) {
  const [inscripciones, setInscripciones] = useState([])
  const [personas, setPersonas] = useState([])
  const [pagosPersonas, setPagosPersonas] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalInscribir, setModalInscribir] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [registrandoPago, setRegistrandoPago] = useState(null)
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().split('T')[0])
  const [metodoPago, setMetodoPago] = useState('Transferencia')
  const [numTrans, setNumTrans] = useState('')
  const [obsPago, setObsPago] = useState('')
  const [saving, setSaving] = useState(false)
  const [alert, setAlert] = useState(null)
  const [editObs, setEditObs] = useState(null)
  const [obsTemp, setObsTemp] = useState('')
  const [editFechaPago, setEditFechaPago] = useState(null)
  const [fechaPagoTemp, setFechaPagoTemp] = useState('')
  const [modalAdicional, setModalAdicional] = useState(null)
  const [montoAdicional, setMontoAdicional] = useState('')
  const [obsAdicional, setObsAdicional] = useState('')
  const [savingAdicional, setSavingAdicional] = useState(false)
  const [modalPagoOrg, setModalPagoOrg] = useState(false)
  const [edicionLocal, setEdicionLocal] = useState(edicion)
  const [fechaPagoOrg, setFechaPagoOrg] = useState(new Date().toISOString().split('T')[0])
  const [metodoPagoOrg, setMetodoPagoOrg] = useState('Transferencia')
  const [numTransOrg, setNumTransOrg] = useState('')
  const [obsPagoOrg, setObsPagoOrg] = useState('')
  const [savingPagoOrg, setSavingPagoOrg] = useState(false)
  const [valorOrgEdit, setValorOrgEdit] = useState(edicion.valor_organizador || 0)

  useEffect(() => { cargar() }, [edicion])

  useEffect(() => {
    if (busqueda.length < 2) { setResultados([]); return }
    setSearchLoading(true)
    const idsInscritos = inscripciones.map(i => i.id_socio)
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('personas')
        .select('id_caif,nombre_comp,atleta,apoderado')
        .eq('vigente', 1)
        .or(`nombre_comp.ilike.%${busqueda}%,apodo.ilike.%${busqueda}%`)
        .limit(20)
      setResultados((data || []).filter(p => !idsInscritos.includes(p.id_caif)))
      setSearchLoading(false)
    }, 300)
    return () => clearTimeout(t)
  }, [busqueda, inscripciones])

  async function cargar() {
    setLoading(true)
    const [resInsc, resPersonas] = await Promise.all([
      supabase.from('inscripciones_torneo').select('*').eq('id_edicion', edicion.id_edicion).order('id_inscripcion'),
      supabase.from('personas').select('id_caif,nombre_comp,atleta,vigente').eq('vigente', 1),
    ])
    const insc = resInsc.data || []
    const pers = resPersonas.data || []
    setInscripciones(insc)
    setPersonas(pers)

    // Cargar estado de cuotas del anio actual
    const anioActual = new Date().getFullYear()
    const ids = insc.map(i => i.id_socio)
    if (ids.length > 0) {
      const { data: pagos } = await supabase
        .from('pagos')
        .select('id_socio,mes,monto,anio')
        .in('id_socio', ids)
        .eq('anio', anioActual)
        .eq('id_actividad', 0)
      setPagosPersonas(pagos || [])
    }
    setLoading(false)
  }

  async function inscribir(socio) {
    setBusqueda(''); setResultados([])
    await supabase.from('inscripciones_torneo').insert([{ id_edicion: edicion.id_edicion, id_socio: socio.id_caif, pagado: false }])
    cargar()
  }

  async function desinscribir(insc) {
    const persona = personas.find(p => p.id_caif === insc.id_socio)
    const nombre = persona?.nombre_comp || 'este atleta'
    if (insc.pagado) {
      const confirmar = confirm(`${nombre} ya tiene pago registrado por ${formatMoney(edicion.valor_atleta)}. Se eliminara la inscripcion Y el pago. Confirmar?`)
      if (!confirmar) return
      // Eliminar pago de la tabla pagos
      if (insc.id_pago) {
        await supabase.from('pagos').delete().eq('id_pago', insc.id_pago)
      }
    } else {
      if (!confirm(`Eliminar inscripcion de ${nombre}?`)) return
    }
    await supabase.from('inscripciones_torneo').delete().eq('id_inscripcion', insc.id_inscripcion)
    cargar()
  }

  async function registrarPago(insc) {
    if (!fechaPago) { setAlert({ type:'error', msg:'La fecha es obligatoria.' }); return }
    setSaving(true)
    try {
      // Obtener siguiente id_pago
      const { data: lastPago } = await supabase.from('pagos').select('id_pago').order('id_pago', { ascending: false }).limit(1)
      const nextId = (lastPago?.[0]?.id_pago || 0) + 1
      const mesEdicion = new Date(edicion.fecha+'T12:00:00').getMonth() + 1
      const anioEdicion = new Date(edicion.fecha+'T12:00:00').getFullYear()

      // Insertar pago
      const { data: nuevoPago } = await supabase.from('pagos').insert([{
        id_pago: nextId,
        id_socio: insc.id_socio,
        periodo: anioEdicion * 100 + mesEdicion,
        fecha_pago: fechaPago,
        monto: edicion.valor_atleta,
        tipo_pago: metodoPago,
        banco: null,
        num_transacc: numTrans || null,
        cuenta: 'CAIF',
        anio: anioEdicion,
        mes: mesEdicion,
        id_actividad: 999, // actividad especial torneos - se puede cambiar por id real
      }]).select().single()

      // Marcar inscripcion como pagada
      await supabase.from('inscripciones_torneo').update({
        pagado: true,
        id_pago: nuevoPago.id_pago,
        obs: obsPago || insc.obs
      }).eq('id_inscripcion', insc.id_inscripcion)

      setRegistrandoPago(null)
      setNumTrans(''); setObsPago('')
      setAlert({ type:'success', msg:'Pago registrado correctamente.' })
      setTimeout(() => setAlert(null), 3000)
      cargar()
    } catch(e) { setAlert({ type:'error', msg:'Error: '+e.message }) }
    finally { setSaving(false) }
  }

  async function guardarFechaPago(insc) {
    if (!fechaPagoTemp) return
    // Actualizar fecha en tabla pagos
    if (insc.id_pago) {
      await supabase.from('pagos').update({ fecha_pago: fechaPagoTemp }).eq('id_pago', insc.id_pago)
    }
    setEditFechaPago(null)
    cargar()
  }

  async function guardarObs(insc) {
    await supabase.from('inscripciones_torneo').update({ obs: obsTemp }).eq('id_inscripcion', insc.id_inscripcion)
    setEditObs(null)
    cargar()
  }

  async function registrarAdicional() {
    if (!montoAdicional || Number(montoAdicional) <= 0) {
      setAlert({ type:'error', msg:'El monto debe ser mayor a 0.' }); return
    }
    setSavingAdicional(true)
    try {
      // Registrar pago adicional en tabla pagos
      const { data: lastPago } = await supabase.from('pagos').select('id_pago').order('id_pago', { ascending: false }).limit(1)
      const nextId = (lastPago?.[0]?.id_pago || 0) + 1
      const mesEdicion = new Date(edicion.fecha+'T12:00:00').getMonth() + 1
      const anioEdicion = new Date(edicion.fecha+'T12:00:00').getFullYear()
      await supabase.from('pagos').insert([{
        id_pago: nextId,
        id_socio: modalAdicional.id_socio,
        periodo: anioEdicion * 100 + mesEdicion,
        fecha_pago: new Date().toISOString().split('T')[0],
        monto: Number(montoAdicional),
        tipo_pago: 'Transferencia',
        banco: null,
        num_transacc: null,
        cuenta: 'CAIF',
        anio: anioEdicion,
        mes: mesEdicion,
        id_actividad: 999,
      }])
      // Actualizar inscripcion con monto adicional
      await supabase.from('inscripciones_torneo').update({
        monto_adicional: Number(montoAdicional),
        obs_adicional: obsAdicional || null
      }).eq('id_inscripcion', modalAdicional.id_inscripcion)
      setModalAdicional(null)
      setMontoAdicional('')
      setObsAdicional('')
      setAlert({ type:'success', msg:'Monto adicional registrado.' })
      setTimeout(() => setAlert(null), 3000)
      cargar()
    } catch(e) { setAlert({ type:'error', msg:'Error: '+e.message }) }
    finally { setSavingAdicional(false) }
  }

  async function registrarPagoOrganizador() {
    if (!fechaPagoOrg) { setAlert({ type:'error', msg:'La fecha es obligatoria.' }); return }
    const montoTotal = valorOrgEdit
    if (montoTotal <= 0) { setAlert({ type:'error', msg:'El monto debe ser mayor a 0.' }); return }
    setSavingPagoOrg(true)
    try {
      // Crear egreso en movimientos
      const { data: catData } = await supabase.from('categorias_movimiento')
        .select('id_categoria').ilike('nombre', '%orneo%').limit(1)
      const idCat = catData?.[0]?.id_categoria || null
      const mesEdicion = new Date(edicion.fecha+'T12:00:00').getMonth() + 1
      const anioEdicion = new Date(edicion.fecha+'T12:00:00').getFullYear()
      const obsDefault = `Pago organizador torneo ${torneo.nombre} - ${inscripciones.length} atletas`
      const { data: nuevoMov, error: errMov } = await supabase.from('movimientos').insert([{
        fecha: fechaPagoOrg,
        tipo: 'egreso',
        id_categoria: idCat,
        item: `Pago organizador ${torneo.nombre} ${edicion.fecha}`,
        monto: montoTotal,
        metodo_pago: metodoPagoOrg,
        num_comprobante: numTransOrg || null,
        obs: obsPagoOrg || obsDefault,
      }]).select().single()

      if (errMov) throw new Error(errMov.message)

      // Actualizar edicion con pago registrado
      await supabase.from('ediciones_torneo').update({
        pagado_organizador: true,
        fecha_pago_org: fechaPagoOrg,
        obs_pago_org: obsPagoOrg || null,
        id_movimiento_org: nuevoMov?.id_movimiento || null,
        valor_organizador: montoTotal,
      }).eq('id_edicion', edicion.id_edicion)

      setEdicionLocal(prev => ({...prev, pagado_organizador: true, fecha_pago_org: fechaPagoOrg, valor_organizador: valorOrgEdit}))
      setModalPagoOrg(false)
      setAlert({ type:'success', msg:`Pago de ${formatMoney(montoTotal)} registrado en Movimientos.` })
      setTimeout(() => setAlert(null), 4000)
    } catch(e) { setAlert({ type:'error', msg:'Error: '+e.message }) }
    finally { setSavingPagoOrg(false) }
  }

  function mesesToAlDia(idSocio) {
    const anioActual = new Date().getFullYear()
    const mesActual = new Date().getMonth() + 1
    const pagados = pagosPersonas.filter(p => p.id_socio === idSocio).map(p => p.mes)
    let pendientes = 0
    for (let m = 1; m <= mesActual; m++) {
      if (!pagados.includes(m)) pendientes++
    }
    return pendientes
  }

  const fecha = new Date(edicion.fecha+'T12:00:00')
  const totalInscritos = inscripciones.length
  const totalPagados = inscripciones.filter(i => i.pagado).length
  const totalPendientes = totalInscritos - totalPagados
  const montoAdicionalTotal = inscripciones.reduce((a,i) => a + (i.monto_adicional || 0), 0)
  const montoRecaudado = totalPagados * edicionLocal.valor_atleta + montoAdicionalTotal
  const montoPendiente = totalPendientes * edicionLocal.valor_atleta
  const montoOrganizador = edicionLocal.valor_organizador || 0
  const saldoNeto = montoRecaudado - montoOrganizador

  return (
    <>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:16}}>
        <button className="btn" onClick={onBack}><i className="ti ti-arrow-left"></i>Volver</button>
        <div>
          <h2 style={{fontSize:16,fontWeight:700,color:'var(--accent)'}}>{torneo.nombre}</h2>
          <div style={{fontSize:12,color:'var(--text-3)'}}>
            {MESES_ES[fecha.getMonth()]} {fecha.getFullYear()} &middot; {edicion.fecha} &middot; {formatMoney(edicion.valor_atleta)}/atleta
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:10,marginBottom:16}}>
        {[
          { label:'Inscritos', val:totalInscritos, color:'#1d4ed8' },
          { label:'Pagaron', val:totalPagados, color:'#16a34a' },
          { label:'Pendientes', val:totalPendientes, color:'#dc2626' },
          { label:'Recaudado', val:formatMoney(montoRecaudado), color:'#1a5e3a', small:true },
          { label:'Por cobrar', val:formatMoney(montoPendiente), color:'#d97706', small:true },
          { label:'Pago organizador', val:formatMoney(montoOrganizador), color:'#dc2626', small:true },
          { label:'Saldo neto', val:formatMoney(saldoNeto), color:saldoNeto>=0?'#1d4ed8':'#dc2626', small:true },
        ].map((k,i) => (
          <div key={i} style={{background:'#f8fafc',border:'0.5px solid #e2e8f0',borderRadius:10,padding:'10px 14px'}}>
            <div style={{fontSize:11,color:'#64748b',fontWeight:600,textTransform:'uppercase',marginBottom:4}}>{k.label}</div>
            <div style={{fontSize:k.small?15:22,fontWeight:700,color:k.color}}>{k.val}</div>
          </div>
        ))}
      </div>

      {alert && <div className={`alert ${alert.type}`} style={{marginBottom:12}}>{alert.msg}</div>}

      {/* Pago al organizador */}
      <div className="card" style={{marginBottom:12}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
          <div>
            <div className="card-title" style={{marginBottom:4}}><i className="ti ti-building"></i>Pago al organizador</div>
            <div style={{fontSize:12,color:'var(--text-3)'}}>
              {montoOrganizador > 0
                ? <>Monto registrado: <strong style={{color:'#dc2626'}}>{formatMoney(montoOrganizador)}</strong></>
                : 'Sin monto registrado aun'}
            </div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            {edicionLocal.pagado_organizador ? (
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontSize:12,background:'#f0fdf4',color:'#16a34a',padding:'4px 12px',borderRadius:6,border:'0.5px solid #a7f3d0',fontWeight:600}}>
                  <i className="ti ti-check" style={{marginRight:4}}></i>Pagado {edicionLocal.fecha_pago_org}
                </span>
              </div>
            ) : (
              <button className="btn primary" style={{background:'#dc2626',borderColor:'#dc2626'}}
                onClick={()=>{
                  setValorOrgEdit(edicionLocal.valor_organizador||0)
                  setObsPagoOrg(`Pago organizador torneo ${torneo.nombre} - ${inscripciones.length} atletas`)
                  setModalPagoOrg(true)
                }}>
                <i className="ti ti-cash"></i>Registrar pago organizador
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Lista de inscritos */}
      <div className="card">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
          <div className="card-title" style={{marginBottom:0}}><i className="ti ti-users"></i>Atletas inscritos</div>
          <button className="btn primary" onClick={()=>setModalInscribir(true)}><i className="ti ti-user-plus"></i>Inscribir atleta</button>
        </div>

        {loading ? <div className="loading-center"><div className="spinner"></div></div> :
         inscripciones.length === 0 ? <div className="empty"><i className="ti ti-users-off"></i>Sin atletas inscritos</div> : (
          <div style={{overflowX:'auto'}}>
            <table className="tbl" style={{fontSize:12}}>
              <thead>
                <tr>
                  <th style={{minWidth:160}}>Atleta</th>
                  <th style={{width:70}}>Tipo</th>
                  <th style={{width:80}}>Vigente</th>
                  <th style={{width:90}}>Cuotas</th>
                  <th style={{width:80}}>Pago</th>
                  <th style={{width:100}}>Fecha pago</th>
                  <th style={{width:90}}>Adicional</th>
                  <th>Observaciones</th>
                  <th style={{width:120}}></th>
                </tr>
              </thead>
              <tbody>
                {inscripciones.map(insc => {
                  const persona = personas.find(p => p.id_caif === insc.id_socio)
                  const pendCuotas = mesesToAlDia(insc.id_socio)
                  const alDia = pendCuotas === 0
                  return (
                    <tr key={insc.id_inscripcion}>
                      <td style={{fontWeight:500}}>{persona?.nombre_comp || `ID ${insc.id_socio}`}</td>
                      <td>
                        <span className={`badge ${persona?.atleta==='Atleta Nino'?'nino':'adulto'}`} style={{fontSize:10}}>
                          {persona?.atleta==='Atleta Nino'?'Nino':'Adulto'}
                        </span>
                      </td>
                      <td>
                        <span style={{fontSize:11,color:persona?.vigente?'#16a34a':'#dc2626',fontWeight:600}}>
                          {persona?.vigente?'Si':'No'}
                        </span>
                      </td>
                      <td>
                        <span style={{fontSize:11,color:alDia?'#16a34a':'#dc2626',fontWeight:600}}>
                          {alDia?'Al dia':`${pendCuotas} mes${pendCuotas!==1?'es':''}`}
                        </span>
                      </td>
                      <td>
                        {insc.pagado
                          ? <span style={{fontSize:11,color:'#16a34a',fontWeight:700,background:'#f0fdf4',padding:'2px 8px',borderRadius:4,border:'0.5px solid #a7f3d0'}}>Pagado</span>
                          : <span style={{fontSize:11,color:'#dc2626',fontWeight:600,background:'#fef2f2',padding:'2px 8px',borderRadius:4,border:'0.5px solid #fecaca'}}>Pendiente</span>
                        }
                      </td>
                      <td style={{fontSize:11}}>
                        {insc.pagado ? (
                          editFechaPago === insc.id_inscripcion ? (
                            <div style={{display:'flex',gap:4,alignItems:'center'}}>
                              <input type="date" value={fechaPagoTemp} onChange={e=>setFechaPagoTemp(e.target.value)}
                                style={{padding:'3px 6px',border:'0.5px solid #e2e8f0',borderRadius:4,fontSize:11,fontFamily:'inherit',width:130}}/>
                              <button className="btn sm primary" onClick={()=>guardarFechaPago(insc)} style={{padding:'3px 6px'}}><i className="ti ti-check"></i></button>
                              <button className="btn sm" onClick={()=>setEditFechaPago(null)} style={{padding:'3px 6px'}}><i className="ti ti-x"></i></button>
                            </div>
                          ) : (
                            <span onClick={()=>{setEditFechaPago(insc.id_inscripcion);setFechaPagoTemp('');}} style={{cursor:'pointer',color:'var(--text-3)',display:'flex',alignItems:'center',gap:4}} title="Editar fecha">
                              <FechaPago idPago={insc.id_pago} onLoad={f=>setFechaPagoTemp(prev=>editFechaPago===insc.id_inscripcion?f:prev)} />
                              <i className="ti ti-pencil" style={{fontSize:10,opacity:0.5}}></i>
                            </span>
                          )
                        ) : '-'}
                      </td>
                      <td style={{fontSize:11}}>
                        {insc.monto_adicional > 0 ? (
                          <div>
                            <span style={{color:'#16a34a',fontWeight:600}}>+{formatMoney(insc.monto_adicional)}</span>
                            {insc.obs_adicional && <div style={{color:'var(--text-3)',fontSize:10}}>{insc.obs_adicional}</div>}
                          </div>
                        ) : <span style={{color:'#94a3b8'}}>-</span>}
                      </td>
                      <td>
                        {editObs === insc.id_inscripcion ? (
                          <div style={{display:'flex',gap:4}}>
                            <input value={obsTemp} onChange={e=>setObsTemp(e.target.value)} style={{padding:'3px 6px',border:'0.5px solid #e2e8f0',borderRadius:4,fontSize:11,width:120,fontFamily:'inherit'}}/>
                            <button className="btn sm primary" onClick={()=>guardarObs(insc)} style={{padding:'3px 6px'}}><i className="ti ti-check"></i></button>
                            <button className="btn sm" onClick={()=>setEditObs(null)} style={{padding:'3px 6px'}}><i className="ti ti-x"></i></button>
                          </div>
                        ) : (
                          <span onClick={()=>{setEditObs(insc.id_inscripcion);setObsTemp(insc.obs||'')}} style={{cursor:'pointer',color:insc.obs?'var(--text)':'var(--text-3)',fontSize:11}}>
                            {insc.obs || <span style={{fontStyle:'italic'}}>agregar obs...</span>}
                          </span>
                        )}
                      </td>
                      <td>
                        <div style={{display:'flex',gap:4}}>
                          {!insc.pagado && (
                            <button className="btn sm primary" style={{fontSize:11,padding:'3px 8px'}} onClick={()=>setRegistrandoPago(insc)}>
                              <i className="ti ti-cash"></i>Pago
                            </button>
                          )}
                          {insc.pagado && (
                            <button className="btn sm" style={{fontSize:11,padding:'3px 8px',color:'#7c3aed',borderColor:'#ddd6fe',background:'#faf5ff'}}
                              onClick={()=>{setModalAdicional(insc);setMontoAdicional(insc.monto_adicional||'');setObsAdicional(insc.obs_adicional||'')}}>
                              <i className="ti ti-plus"></i>Adic
                            </button>
                          )}
                          <button className="btn sm danger" onClick={()=>desinscribir(insc)} style={{padding:'3px 6px'}} title={insc.pagado?'Eliminar inscripcion y pago':'Eliminar inscripcion'}>
                            <i className="ti ti-trash"></i>
                          </button>
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

      {/* Modal inscribir */}
      {modalInscribir && (
        <div className="modal-bg open" onClick={e=>e.target===e.currentTarget&&(setModalInscribir(false),setBusqueda(''),setResultados([]))}>
          <div className="modal">
            <div className="modal-header">
              <h2>Inscribir atleta &mdash; {torneo.nombre}</h2>
              <button className="modal-close" onClick={()=>{setModalInscribir(false);setBusqueda('');setResultados([])}}>&times;</button>
            </div>
            <p style={{fontSize:12,color:'var(--text-3)',marginBottom:12}}>Solo se muestran atletas vigentes no inscritos en esta edicion.</p>
            <div style={{position:'relative',marginBottom:12}}>
              <input value={busqueda} onChange={e=>setBusqueda(e.target.value)} placeholder="Buscar por nombre..."
                style={{width:'100%',padding:'9px 12px',border:'0.5px solid #e2e8f0',borderRadius:8,fontSize:13,fontFamily:'inherit'}}/>
              {searchLoading && <div className="spinner" style={{position:'absolute',right:10,top:10,width:16,height:16}}></div>}
            </div>
            {resultados.length > 0 && (
              <div className="tbl-scroll">
                <table className="tbl">
                  <thead><tr><th>Nombre</th><th style={{width:80}}>Tipo</th><th style={{width:80}}></th></tr></thead>
                  <tbody>
                    {resultados.map(p => (
                      <tr key={p.id_caif}>
                        <td>{p.nombre_comp}</td>
                        <td><span className={`badge ${p.atleta==='Atleta Nino'?'nino':'adulto'}`} style={{fontSize:10}}>{p.atleta==='Atleta Nino'?'Nino':'Adulto'}</span></td>
                        <td><button className="btn sm primary" onClick={()=>inscribir(p)}><i className="ti ti-plus"></i>Inscribir</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {busqueda.length >= 2 && resultados.length === 0 && !searchLoading && (
              <div className="empty" style={{padding:'1rem'}}><i className="ti ti-search-off"></i>Sin resultados</div>
            )}
          </div>
        </div>
      )}

      {/* Modal pago al organizador */}
      {modalPagoOrg && (
        <div className="modal-bg open" onClick={e=>e.target===e.currentTarget&&setModalPagoOrg(false)}>
          <div className="modal" style={{width:'min(580px,95vw)'}}>
            <div className="modal-header">
              <h2>Registrar pago al organizador</h2>
              <button className="modal-close" onClick={()=>setModalPagoOrg(false)}>&times;</button>
            </div>
            <div style={{background:'#fef2f2',border:'0.5px solid #fecaca',borderRadius:8,padding:'10px 14px',marginBottom:16}}>
              <div style={{fontWeight:600,fontSize:14}}>{torneo.nombre} - {edicion.fecha}</div>
              <div style={{fontSize:12,color:'#64748b',marginTop:4}}>
                Este egreso quedara registrado automaticamente en Movimientos.
              </div>
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label>Monto total a transferir ($) *</label>
                <input type="number" value={valorOrgEdit} onChange={e=>setValorOrgEdit(Number(e.target.value))}
                  placeholder="Monto total a pagar al organizador"/>
              </div>
              <div className="form-group">
                <label>Fecha de pago *</label>
                <input type="date" value={fechaPagoOrg} onChange={e=>setFechaPagoOrg(e.target.value)}/>
              </div>
              <div className="form-group">
                <label>Metodo</label>
                <select value={metodoPagoOrg} onChange={e=>setMetodoPagoOrg(e.target.value)}>
                  <option>Transferencia</option><option>Efectivo</option><option>Cheque</option>
                </select>
              </div>
              <div className="form-group">
                <label>N comprobante</label>
                <input value={numTransOrg} onChange={e=>setNumTransOrg(e.target.value)} placeholder="Opcional"/>
              </div>
              <div className="form-group full">
                <label>Observaciones</label>
                <input value={obsPagoOrg} onChange={e=>setObsPagoOrg(e.target.value)}/>
              </div>
            </div>
            <div style={{background:'#f8fafc',border:'0.5px solid #e2e8f0',borderRadius:8,padding:'10px 14px',marginBottom:12,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontSize:13,color:'var(--text-2)'}}>Total egreso a registrar</span>
              <span style={{fontWeight:700,fontSize:18,color:'#dc2626'}}>-{formatMoney(valorOrgEdit)}</span>
            </div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button className="btn" onClick={()=>setModalPagoOrg(false)}>Cancelar</button>
              <button className="btn primary" onClick={registrarPagoOrganizador} disabled={savingPagoOrg}
                style={{background:'#dc2626',borderColor:'#dc2626'}}>
                {savingPagoOrg
                  ? <><div className="spinner" style={{width:14,height:14,borderWidth:2}}></div>Registrando...</>
                  : <><i className="ti ti-check"></i>Confirmar egreso</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal monto adicional */}
      {modalAdicional && (
        <div className="modal-bg open" onClick={e=>e.target===e.currentTarget&&setModalAdicional(null)}>
          <div className="modal">
            <div className="modal-header">
              <h2>Monto adicional por competencia extra</h2>
              <button className="modal-close" onClick={()=>setModalAdicional(null)}>&times;</button>
            </div>
            <div style={{background:'#faf5ff',border:'0.5px solid #ddd6fe',borderRadius:8,padding:'10px 14px',marginBottom:16}}>
              <div style={{fontWeight:600,fontSize:14}}>{personas.find(p=>p.id_caif===modalAdicional.id_socio)?.nombre_comp}</div>
              <div style={{fontSize:12,color:'var(--text-3)',marginTop:2}}>{torneo.nombre} - {edicion.fecha}</div>
              {modalAdicional.monto_adicional > 0 && (
                <div style={{fontSize:12,color:'#7c3aed',marginTop:4,fontWeight:600}}>
                  Adicional actual: {formatMoney(modalAdicional.monto_adicional)}
                  {modalAdicional.obs_adicional && ` - ${modalAdicional.obs_adicional}`}
                </div>
              )}
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label>Monto adicional ($) *</label>
                <input type="number" value={montoAdicional} onChange={e=>setMontoAdicional(e.target.value)} placeholder="Ej: 5000"/>
              </div>
              <div className="form-group full">
                <label>Descripcion de la competencia extra</label>
                <input value={obsAdicional} onChange={e=>setObsAdicional(e.target.value)}
                  placeholder="Ej: Competencia lanzamiento de bala"/>
              </div>
            </div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:8}}>
              <button className="btn" onClick={()=>setModalAdicional(null)}>Cancelar</button>
              <button className="btn primary" onClick={registrarAdicional} disabled={savingAdicional}
                style={{background:'#7c3aed',borderColor:'#7c3aed'}}>
                {savingAdicional
                  ? <><div className="spinner" style={{width:14,height:14,borderWidth:2}}></div>Guardando...</>
                  : <><i className="ti ti-plus"></i>Registrar adicional</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal registrar pago */}
      {registrandoPago && (
        <div className="modal-bg open" onClick={e=>e.target===e.currentTarget&&setRegistrandoPago(null)}>
          <div className="modal">
            <div className="modal-header">
              <h2>Registrar pago de inscripcion</h2>
              <button className="modal-close" onClick={()=>setRegistrandoPago(null)}>&times;</button>
            </div>
            <div style={{background:'#f0fdf4',border:'0.5px solid #a7f3d0',borderRadius:8,padding:'10px 14px',marginBottom:16}}>
              <div style={{fontWeight:600,fontSize:14}}>{personas.find(p=>p.id_caif===registrandoPago.id_socio)?.nombre_comp}</div>
              <div style={{fontSize:12,color:'var(--text-3)'}}>{torneo.nombre} &middot; {edicion.fecha} &middot; {formatMoney(edicion.valor_atleta)}</div>
            </div>
            <div className="form-grid">
              <div className="form-group"><label>Fecha de pago</label><input type="date" value={fechaPago} onChange={e=>setFechaPago(e.target.value)}/></div>
              <div className="form-group"><label>Metodo</label>
                <select value={metodoPago} onChange={e=>setMetodoPago(e.target.value)}>
                  <option>Transferencia</option><option>Efectivo</option><option>Cheque</option>
                </select>
              </div>
              {metodoPago==='Transferencia' && <div className="form-group full"><label>N transaccion</label><input value={numTrans} onChange={e=>setNumTrans(e.target.value)} placeholder="Opcional"/></div>}
              <div className="form-group full"><label>Observaciones</label><input value={obsPago} onChange={e=>setObsPago(e.target.value)} placeholder="Opcional"/></div>
            </div>
            {alert && <div className={`alert ${alert.type}`} style={{marginBottom:12}}>{alert.msg}</div>}
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button className="btn" onClick={()=>setRegistrandoPago(null)}>Cancelar</button>
              <button className="btn primary" onClick={()=>registrarPago(registrandoPago)} disabled={saving}>
                {saving?<><div className="spinner" style={{width:14,height:14,borderWidth:2}}></div>Guardando...</>:<><i className="ti ti-check"></i>Confirmar {formatMoney(edicion.valor_atleta)}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// Componente auxiliar para mostrar fecha de pago
function FechaPago({ idPago, onLoad }) {
  const [fecha, setFecha] = useState(null)
  useEffect(() => {
    if (!idPago) return
    supabase.from('pagos').select('fecha_pago').eq('id_pago', idPago).single()
      .then(({ data }) => {
        const f = data?.fecha_pago || null
        setFecha(f)
        if (onLoad && f) onLoad(f)
      })
  }, [idPago])
  return fecha || '-'
}
