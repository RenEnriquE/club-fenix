import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { estadoSocio, estadoLabel } from '../lib/helpers'

// Trae todas las filas de una consulta, de a 1000 (limite por defecto de Supabase)
async function traerTodo(construir) {
  let todo = []
  let desde = 0
  for (;;) {
    const { data, error } = await construir().range(desde, desde + 999)
    if (error) throw error
    todo = todo.concat(data || [])
    if (!data || data.length < 1000) break
    desde += 1000
  }
  return todo
}

const fechaDe = f => (f ? new Date(f + 'T12:00:00-04:00') : null)
const fmtFecha = f => {
  const d = fechaDe(f)
  return d ? d.toLocaleDateString('es-CL') : ''
}

function edadDe(fechaNac, hoy) {
  const d = fechaDe(fechaNac)
  if (!d) return null
  let e = hoy.getFullYear() - d.getFullYear()
  const m = hoy.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && hoy.getDate() < d.getDate())) e--
  return e
}

// Meses completos entre dos fechas
function mesesEntre(desde, hasta) {
  let m = (hasta.getFullYear() - desde.getFullYear()) * 12 + (hasta.getMonth() - desde.getMonth())
  if (hasta.getDate() < desde.getDate()) m--
  return Math.max(0, m)
}

function textoTiempo(meses) {
  if (meses === null || meses === undefined) return ''
  const a = Math.floor(meses / 12)
  const m = meses % 12
  const partes = []
  if (a > 0) partes.push(a + (a === 1 ? ' a\u00f1o' : ' a\u00f1os'))
  if (m > 0 || a === 0) partes.push(m + (m === 1 ? ' mes' : ' meses'))
  return partes.join(' ')
}

function rutFormateado(p) {
  const num = p.rut ? String(p.rut).replace(/[^0-9]/g, '') : ''
  if (!num || num === '0') return ''
  const fmt = num.length >= 7 ? num.replace(/^(\d{1,2})(\d{3})(\d{3})$/, '$1.$2.$3') : num
  return fmt + (p.dv ? '-' + p.dv : '')
}

function cumple(valor, op, ref) {
  if (op === '>') return valor > ref
  if (op === '>=') return valor >= ref
  if (op === '<') return valor < ref
  if (op === '<=') return valor <= ref
  return valor === ref
}

const OP_TXT = { '>': 'mayor que', '>=': 'mayor o igual que', '<': 'menor que', '<=': 'menor o igual que' }

const FILTROS_INI = {
  vigencia: '1',
  tipo: '',
  genero: '',
  cuotas: '',
  edadOpMin: '>=', edadMin: '',
  edadOpMax: '<', edadMax: '',
  antOpMin: '>=', antMin: '',
  antOpMax: '<', antMax: '',
  antUnidad: 'meses',
  orden: 'nombre',
}

export default function Listados() {
  const [personas, setPersonas] = useState([])
  const [pagos, setPagos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [f, setF] = useState(FILTROS_INI)

  useEffect(() => {
    let activo = true
    async function cargar() {
      try {
        const [per, pag] = await Promise.all([
          traerTodo(() => supabase.from('personas').select('*').order('id_caif', { ascending: true })),
          traerTodo(() => supabase.from('pagos').select('id_pago,id_socio,anio,mes,monto,id_actividad,fecha_pago').order('id_pago', { ascending: true })),
        ])
        if (!activo) return
        setPersonas(per)
        setPagos(pag)
      } catch (e) {
        if (activo) setError(e.message || 'No se pudieron cargar los datos')
      }
      if (activo) setLoading(false)
    }
    cargar()
    return () => { activo = false }
  }, [])

  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }))

  const tiposDisponibles = useMemo(
    () => Array.from(new Set(personas.map(p => p.atleta).filter(Boolean))).sort(),
    [personas]
  )

  // Primer pago de cada socio (para estimar el ingreso si no hay fecha registrada)
  const primerPago = useMemo(() => {
    const mapa = {}
    pagos.forEach(pg => {
      if (!pg.anio || !pg.mes) return
      const per = pg.anio * 100 + pg.mes
      if (!mapa[pg.id_socio] || per < mapa[pg.id_socio].per) mapa[pg.id_socio] = { per, pg }
    })
    return mapa
  }, [pagos])

  // Una fila enriquecida por socio
  const filas = useMemo(() => {
    const hoy = new Date()
    return personas.map(p => {
      const edad = edadDe(p.fecha_nac, hoy)
      let ingresoStr = p.f_reingreso || p.f_ini_vig || ''
      let ingreso = fechaDe(ingresoStr)
      let estimada = false
      if (!ingreso && primerPago[p.id_caif]) {
        const pg = primerPago[p.id_caif].pg
        ingreso = pg.fecha_pago ? fechaDe(pg.fecha_pago) : new Date(pg.anio, pg.mes - 1, 1)
        estimada = true
      }
      const salida = p.vigente === 1 ? null : fechaDe(p.f_fin_vig)
      const fin = salida && ingreso && salida >= ingreso ? salida : hoy
      const meses = ingreso ? mesesEntre(ingreso, fin) : null
      const cuotas = p.vigente === 1 ? estadoSocio(p.id_caif, pagos, p.atleta, p) : ''
      const nombre = [p.nombre, p.seg_nombre, p.apellido, p.ap_mat].filter(x => x && String(x).trim()).join(' ')
      return {
        p, edad, meses, cuotas, estimada, ingreso,
        nombre: nombre || p.nombre_comp || '',
        ingresoTxt: ingreso ? ingreso.toLocaleDateString('es-CL') + (estimada ? ' (est.)' : '') : '',
      }
    })
  }, [personas, pagos, primerPago])

  const resultado = useMemo(() => {
    const edMin = f.edadMin === '' ? null : Number(f.edadMin)
    const edMax = f.edadMax === '' ? null : Number(f.edadMax)
    const factor = f.antUnidad === 'anios' ? 12 : 1
    const anMin = f.antMin === '' ? null : Number(f.antMin) * factor
    const anMax = f.antMax === '' ? null : Number(f.antMax) * factor

    const lista = filas.filter(r => {
      const p = r.p
      if (f.vigencia !== '' && String(p.vigente) !== f.vigencia) return false
      if (f.tipo && p.atleta !== f.tipo) return false
      if (f.genero) {
        const g = (p.genero || '').toLowerCase()
        if (f.genero === 'F' && !g.includes('fem')) return false
        if (f.genero === 'M' && !g.includes('masc')) return false
        if (f.genero === 'O' && (g.includes('fem') || g.includes('masc'))) return false
      }
      if (f.cuotas && r.cuotas !== f.cuotas) return false
      if (edMin !== null || edMax !== null) {
        if (r.edad === null) return false
        if (edMin !== null && !cumple(r.edad, f.edadOpMin, edMin)) return false
        if (edMax !== null && !cumple(r.edad, f.edadOpMax, edMax)) return false
      }
      if (anMin !== null || anMax !== null) {
        if (r.meses === null) return false
        if (anMin !== null && !cumple(r.meses, f.antOpMin, anMin)) return false
        if (anMax !== null && !cumple(r.meses, f.antOpMax, anMax)) return false
      }
      return true
    })

    const dir = f.orden.endsWith('_desc') ? -1 : 1
    const clave = f.orden.replace(/_(asc|desc)$/, '')
    lista.sort((a, b) => {
      if (clave === 'edad') return dir * ((a.edad ?? -1) - (b.edad ?? -1))
      if (clave === 'antiguedad') return dir * ((a.meses ?? -1) - (b.meses ?? -1))
      if (clave === 'id') return a.p.id_caif - b.p.id_caif
      return a.nombre.localeCompare(b.nombre, 'es')
    })
    return lista
  }, [filas, f])

  // Descripcion legible de los filtros aplicados (pantalla y hoja "Filtros" del Excel)
  const descripcion = useMemo(() => {
    const d = []
    d.push('Socios: ' + (f.vigencia === '1' ? 'vigentes' : f.vigencia === '0' ? 'no vigentes' : 'vigentes y no vigentes'))
    if (f.tipo) d.push('Tipo de socio: ' + f.tipo)
    if (f.genero) d.push('G\u00e9nero: ' + (f.genero === 'F' ? 'Femenino' : f.genero === 'M' ? 'Masculino' : 'Otro'))
    if (f.cuotas) d.push('Estado de cuotas: ' + estadoLabel(f.cuotas) + ' (solo socios vigentes)')
    if (f.edadMin !== '') d.push('Edad ' + OP_TXT[f.edadOpMin] + ' ' + f.edadMin + ' a\u00f1os')
    if (f.edadMax !== '') d.push('Edad ' + OP_TXT[f.edadOpMax] + ' ' + f.edadMax + ' a\u00f1os')
    const u = f.antUnidad === 'anios' ? ' a\u00f1os' : ' meses'
    if (f.antMin !== '') d.push('Antig\u00fcedad en el club ' + OP_TXT[f.antOpMin] + ' ' + f.antMin + u)
    if (f.antMax !== '') d.push('Antig\u00fcedad en el club ' + OP_TXT[f.antOpMax] + ' ' + f.antMax + u)
    return d
  }, [f])

  const hayFiltroExtra = JSON.stringify({ ...f, orden: '' }) !== JSON.stringify({ ...FILTROS_INI, orden: '' })

  async function descargarExcel() {
    const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs')
    const enc = [
      'ID', 'Nombre completo', 'RUT', 'G\u00e9nero', 'Fecha de nacimiento', 'Edad', 'Tipo de socio',
      'Estado', 'Estado de cuotas', 'Fecha de ingreso', 'Antig\u00fcedad (meses)', 'Antig\u00fcedad',
      'Celular', 'E-mail', 'Apoderado',
    ]
    const datos = resultado.map(r => [
      r.p.id_caif,
      r.nombre,
      rutFormateado(r.p),
      r.p.genero || '',
      fmtFecha(r.p.fecha_nac),
      r.edad === null ? '' : r.edad,
      r.p.atleta || '',
      r.p.vigente === 1 ? 'Activo' : 'Inactivo',
      r.cuotas ? estadoLabel(r.cuotas) : '-',
      r.ingresoTxt,
      r.meses === null ? '' : r.meses,
      textoTiempo(r.meses),
      r.p.celular || '',
      r.p.email || '',
      r.p.apoderado || '',
    ])
    const ws = XLSX.utils.aoa_to_sheet([enc, ...datos])
    ws['!cols'] = [
      { wch: 7 }, { wch: 38 }, { wch: 14 }, { wch: 11 }, { wch: 18 }, { wch: 6 }, { wch: 16 },
      { wch: 10 }, { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 30 }, { wch: 28 },
    ]
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: datos.length, c: enc.length - 1 } }) }
    const hoy = new Date()
    const info = [
      ['Listado de socios - Club Atl\u00e9tico Independencia F\u00e9nix'],
      ['Generado el', hoy.toLocaleDateString('es-CL') + ' ' + hoy.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })],
      ['Total de socios', datos.length],
      [],
      ['Filtros aplicados'],
      ...descripcion.map(x => [x]),
      [],
      ['La antig\u00fcedad se cuenta desde la fecha de ingreso (o reingreso) vigente; "(est.)" indica fecha estimada desde el primer pago.'],
    ]
    const wsInfo = XLSX.utils.aoa_to_sheet(info)
    wsInfo['!cols'] = [{ wch: 70 }, { wch: 22 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Socios')
    XLSX.utils.book_append_sheet(wb, wsInfo, 'Filtros')
    const pad = n => String(n).padStart(2, '0')
    XLSX.writeFile(wb, 'Listado_socios_' + hoy.getFullYear() + '-' + pad(hoy.getMonth() + 1) + '-' + pad(hoy.getDate()) + '.xlsx')
  }

  const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12, marginBottom: 12 }
  const par = { display: 'grid', gridTemplateColumns: '1fr 70px', gap: 6 }

  return (
    <div className="content">
      <div className="card">
        <div className="card-title"><i className="ti ti-list-details"></i>Listados de socios</div>
        <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 14px' }}>
          Combina los filtros que necesites y descarga el listado en Excel. Los filtros vac&iacute;os no se aplican.
        </p>

        {loading && <p style={{ color: 'var(--text-2)' }}>Cargando socios...</p>}
        {error && <div className="alert error">Error: {error}</div>}

        {!loading && !error && (
          <>
            <div style={grid}>
              <div className="form-group">
                <label>Vigencia</label>
                <select value={f.vigencia} onChange={e => set('vigencia', e.target.value)}>
                  <option value="1">Vigentes</option>
                  <option value="0">No vigentes</option>
                  <option value="">Todos</option>
                </select>
              </div>
              <div className="form-group">
                <label>Tipo de socio</label>
                <select value={f.tipo} onChange={e => set('tipo', e.target.value)}>
                  <option value="">Todos</option>
                  {tiposDisponibles.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>G&eacute;nero</label>
                <select value={f.genero} onChange={e => set('genero', e.target.value)}>
                  <option value="">Todos</option>
                  <option value="F">Femenino</option>
                  <option value="M">Masculino</option>
                  <option value="O">Otro</option>
                </select>
              </div>
              <div className="form-group">
                <label>Estado de cuotas (vigentes)</label>
                <select value={f.cuotas} onChange={e => set('cuotas', e.target.value)}>
                  <option value="">Todos</option>
                  <option value="al-dia">Al d&iacute;a</option>
                  <option value="parcial">Parcial</option>
                  <option value="moroso">Moroso</option>
                </select>
              </div>
            </div>

            <div style={grid}>
              <div className="form-group">
                <label>Edad (a&ntilde;os) - desde</label>
                <div style={par}>
                  <select value={f.edadOpMin} onChange={e => set('edadOpMin', e.target.value)}>
                    <option value=">=">mayor o igual que</option>
                    <option value=">">mayor que</option>
                  </select>
                  <input type="number" min="0" value={f.edadMin} onChange={e => set('edadMin', e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label>Edad (a&ntilde;os) - hasta</label>
                <div style={par}>
                  <select value={f.edadOpMax} onChange={e => set('edadOpMax', e.target.value)}>
                    <option value="<">menor que</option>
                    <option value="<=">menor o igual que</option>
                  </select>
                  <input type="number" min="0" value={f.edadMax} onChange={e => set('edadMax', e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label>Antig&uuml;edad en el club - desde</label>
                <div style={par}>
                  <select value={f.antOpMin} onChange={e => set('antOpMin', e.target.value)}>
                    <option value=">=">mayor o igual que</option>
                    <option value=">">mayor que</option>
                  </select>
                  <input type="number" min="0" value={f.antMin} onChange={e => set('antMin', e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label>Antig&uuml;edad en el club - hasta</label>
                <div style={par}>
                  <select value={f.antOpMax} onChange={e => set('antOpMax', e.target.value)}>
                    <option value="<">menor que</option>
                    <option value="<=">menor o igual que</option>
                  </select>
                  <input type="number" min="0" value={f.antMax} onChange={e => set('antMax', e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label>Antig&uuml;edad medida en</label>
                <select value={f.antUnidad} onChange={e => set('antUnidad', e.target.value)}>
                  <option value="meses">Meses</option>
                  <option value="anios">A&ntilde;os</option>
                </select>
              </div>
              <div className="form-group">
                <label>Ordenar por</label>
                <select value={f.orden} onChange={e => set('orden', e.target.value)}>
                  <option value="nombre">Nombre</option>
                  <option value="id">ID</option>
                  <option value="edad_asc">Edad (menor a mayor)</option>
                  <option value="edad_desc">Edad (mayor a menor)</option>
                  <option value="antiguedad_desc">Antig&uuml;edad (mayor a menor)</option>
                  <option value="antiguedad_asc">Antig&uuml;edad (menor a mayor)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
              <button className="btn primary" onClick={descargarExcel} disabled={resultado.length === 0}>
                <i className="ti ti-file-spreadsheet"></i>Descargar Excel ({resultado.length})
              </button>
              <button className="btn" onClick={() => setF(FILTROS_INI)} disabled={!hayFiltroExtra && f.orden === 'nombre'}>
                <i className="ti ti-filter-off"></i>Limpiar filtros
              </button>
            </div>
          </>
        )}
      </div>

      {!loading && !error && (
        <div className="card">
          <div className="card-title" style={{ flexWrap: 'wrap', gap: 6 }}>
            <i className="ti ti-users"></i>{resultado.length} {resultado.length === 1 ? 'socio' : 'socios'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 12, lineHeight: 1.6 }}>
            {descripcion.join(' \u00b7 ')}
          </div>

          {resultado.length === 0 ? (
            <p style={{ color: 'var(--text-2)', margin: 0 }}>Ning&uacute;n socio cumple con estos filtros.</p>
          ) : (
            <div className="tbl-wrap" style={{ border: 'var(--border)' }}>
              <table className="tbl" style={{ tableLayout: 'auto', minWidth: 760 }}>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Nombre</th>
                    <th>Edad</th>
                    <th>G&eacute;nero</th>
                    <th>Tipo</th>
                    <th>Ingreso</th>
                    <th>Antig&uuml;edad</th>
                    <th>Cuotas</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.map(r => (
                    <tr key={r.p.id_caif}>
                      <td>{r.p.id_caif}</td>
                      <td>{r.nombre}</td>
                      <td>{r.edad === null ? '-' : r.edad}</td>
                      <td>{r.p.genero || '-'}</td>
                      <td>{r.p.atleta || '-'}</td>
                      <td>{r.ingresoTxt || '-'}</td>
                      <td>{r.meses === null ? '-' : textoTiempo(r.meses)}</td>
                      <td>{r.cuotas ? <span className={'badge ' + r.cuotas}>{estadoLabel(r.cuotas)}</span> : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '10px 0 0' }}>
            La antig&uuml;edad se cuenta desde la fecha de ingreso (o reingreso) vigente; &quot;(est.)&quot; indica fecha estimada desde el primer pago. Los socios sin fecha de nacimiento o de ingreso quedan fuera cuando se filtra por edad o antig&uuml;edad.
          </p>
        </div>
      )}
    </div>
  )
}
