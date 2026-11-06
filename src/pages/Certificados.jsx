import { useState, useMemo } from 'react'

const MESES_TXT = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

// Tipos de certificado disponibles. Para agregar otro, basta una nueva entrada aqui.
const TIPOS_CERTIFICADO = [
  {
    key: 'permanencia',
    label: 'Certificado de Permanencia',
    archivo: 'CertPermanencia_CAIF.xlsx',
    descripcion: 'Genera el Excel con las columnas NOMBRE, RUTDV, GENERO e INI_VIGENCIA para combinar correspondencia en Word.',
  },
]

// "tomas ignacio LOPEZ" -> "Tomas Ignacio Lopez" (inicial en mayuscula en cada palabra)
function nombreTitulo(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('es')
    .replace(/(^|[\s\-'])(\p{L})/gu, (m, sep, letra) => sep + letra.toLocaleUpperCase('es'))
}

function nombreCompleto(p) {
  const partes = [p.nombre, p.seg_nombre, p.apellido, p.ap_mat].filter(x => x && String(x).trim())
  return nombreTitulo(partes.join(' ') || p.nombre_comp)
}

// 22817806 + "3" -> "22.817.806-3"
function rutConDv(p) {
  const num = p.rut ? String(p.rut).replace(/[^0-9]/g, '') : ''
  if (!num || /^0+$/.test(num)) return ''
  const miles = num.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const dv = p.dv ? String(p.dv).trim().toUpperCase() : ''
  return dv ? miles + '-' + dv : miles
}

function generoTxt(p) {
  const g = String(p.genero || '').toLowerCase()
  if (g.includes('fem')) return 'Femenino'
  if (g.includes('masc')) return 'Masculino'
  return ''
}

// "2019-01-04" -> "4 de enero de 2019"
function fechaLarga(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '')
  if (!m) return ''
  return Number(m[3]) + ' de ' + MESES_TXT[Number(m[2]) - 1] + ' de ' + m[1]
}

function fechaCorta(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '')
  return m ? m[3] + '-' + m[2] + '-' + m[1] : ''
}

export default function Certificados({ personas = [], onVolver }) {
  const [tipoCert, setTipoCert] = useState(TIPOS_CERTIFICADO[0].key)
  const [busqueda, setBusqueda] = useState('')
  const [vigencia, setVigencia] = useState('1')
  const [tipoSocio, setTipoSocio] = useState('')
  const [sel, setSel] = useState(() => new Set())
  const [aviso, setAviso] = useState('')

  const cert = TIPOS_CERTIFICADO.find(t => t.key === tipoCert) || TIPOS_CERTIFICADO[0]

  const tiposSocio = useMemo(
    () => Array.from(new Set(personas.map(p => p.atleta).filter(Boolean))).sort(),
    [personas]
  )

  // Datos finales tal como saldran en el Excel, mas lo que falte para poder emitir el certificado
  const filas = useMemo(() => personas.map(p => {
    const nombre = nombreCompleto(p)
    const rut = rutConDv(p)
    const genero = generoTxt(p)
    const ini = fechaLarga(p.f_ini_vig)
    const faltan = []
    if (!rut) faltan.push('RUT')
    if (!genero) faltan.push('g\u00e9nero')
    if (!ini) faltan.push('inicio de vigencia')
    return { p, id: p.id_caif, nombre, rut, genero, ini, faltan }
  }), [personas])

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return filas
      .filter(r => {
        if (vigencia !== '' && String(r.p.vigente) !== vigencia) return false
        if (tipoSocio && r.p.atleta !== tipoSocio) return false
        if (q) {
          const rutPlano = r.rut.replace(/[^0-9kK]/g, '').toLowerCase()
          const qPlano = q.replace(/[^0-9k]/g, '')
          const coincide = r.nombre.toLowerCase().includes(q) || String(r.id).includes(q) || (qPlano && rutPlano.includes(qPlano))
          if (!coincide) return false
        }
        return true
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }, [filas, busqueda, vigencia, tipoSocio])

  const seleccionables = visibles.filter(r => r.faltan.length === 0)
  const todosMarcados = seleccionables.length > 0 && seleccionables.every(r => sel.has(r.id))
  const seleccionados = filas.filter(r => sel.has(r.id) && r.faltan.length === 0)

  function alternar(id) {
    setSel(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  function alternarTodos() {
    setSel(prev => {
      const n = new Set(prev)
      if (todosMarcados) seleccionables.forEach(r => n.delete(r.id))
      else seleccionables.forEach(r => n.add(r.id))
      return n
    })
  }

  async function descargar() {
    if (seleccionados.length === 0) return
    const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs')
    const orden = [...seleccionados].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    // Todo como texto, tal cual debe aparecer en el certificado
    const datos = [
      ['NOMBRE', 'RUTDV', 'GENERO', 'INI_VIGENCIA'],
      ...orden.map(r => [r.nombre, r.rut, r.genero, r.ini]),
    ]
    const ws = XLSX.utils.aoa_to_sheet(datos)
    ws['!cols'] = [{ wch: 38 }, { wch: 14 }, { wch: 11 }, { wch: 22 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Hoja1')
    XLSX.writeFile(wb, cert.archivo)
    setAviso('Se descarg\u00f3 ' + cert.archivo + ' con ' + orden.length + (orden.length === 1 ? ' socio.' : ' socios.'))
    setTimeout(() => setAviso(''), 6000)
  }

  return (
    <div className="content">
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
          <div className="card-title" style={{ margin: 0 }}><i className="ti ti-certificate"></i>Certificados</div>
          <button className="btn sm" onClick={onVolver}><i className="ti ti-arrow-left"></i>Volver a socios</button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 14px' }}>{cert.descripcion}</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
          <div className="form-group">
            <label>Tipo de certificado</label>
            <select value={tipoCert} onChange={e => setTipoCert(e.target.value)}>
              {TIPOS_CERTIFICADO.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Buscar socio</label>
            <input type="text" placeholder="Nombre, RUT o ID..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Vigencia</label>
            <select value={vigencia} onChange={e => setVigencia(e.target.value)}>
              <option value="1">Vigentes</option>
              <option value="0">No vigentes</option>
              <option value="">Todos</option>
            </select>
          </div>
          <div className="form-group">
            <label>Tipo de socio</label>
            <select value={tipoSocio} onChange={e => setTipoSocio(e.target.value)}>
              <option value="">Todos</option>
              {tiposSocio.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn primary" onClick={descargar} disabled={seleccionados.length === 0}>
            <i className="ti ti-file-spreadsheet"></i>Descargar Excel ({seleccionados.length})
          </button>
          <button className="btn" onClick={() => setSel(new Set())} disabled={sel.size === 0}>
            <i className="ti ti-x"></i>Quitar selecci&oacute;n
          </button>
          {aviso && <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>{aviso}</span>}
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-2)' }}>
          Mostrando {visibles.length} socios &middot; {seleccionados.length} seleccionados. Los datos se ven tal como saldr&aacute;n en el Excel.
        </div>
        <div className="tbl-wrap">
          <table className="tbl" style={{ tableLayout: 'auto', minWidth: 640 }}>
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input type="checkbox" checked={todosMarcados} onChange={alternarTodos} disabled={seleccionables.length === 0} title="Seleccionar todos los visibles" />
                </th>
                <th>NOMBRE</th>
                <th>RUTDV</th>
                <th>GENERO</th>
                <th>INI_VIGENCIA</th>
              </tr>
            </thead>
            <tbody>
              {visibles.length === 0 ? (
                <tr><td colSpan={5} className="empty">Sin resultados</td></tr>
              ) : visibles.map(r => {
                const incompleto = r.faltan.length > 0
                return (
                  <tr key={r.id} style={{ cursor: incompleto ? 'default' : 'pointer', opacity: incompleto ? 0.7 : 1 }}
                    onClick={() => { if (!incompleto) alternar(r.id) }}>
                    <td>
                      <input type="checkbox" checked={sel.has(r.id) && !incompleto} disabled={incompleto}
                        onClick={e => e.stopPropagation()} onChange={() => alternar(r.id)} />
                    </td>
                    <td>{r.nombre}</td>
                    <td>{r.rut || '-'}</td>
                    <td>{r.genero || '-'}</td>
                    <td>
                      {r.ini || '-'}
                      {r.p.f_reingreso && r.ini && (
                        <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 6 }}>(reingres&oacute; {fechaCorta(r.p.f_reingreso)})</span>
                      )}
                      {incompleto && (
                        <span style={{ fontSize: 11, color: 'var(--danger)', marginLeft: 6 }}>Falta: {r.faltan.join(', ')}</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '10px 0 0' }}>
        INI_VIGENCIA corresponde a la fecha de inicio de vigencia original del socio. Los socios sin RUT, g&eacute;nero o fecha de inicio no se pueden seleccionar hasta completar esos datos en su ficha.
      </p>
    </div>
  )
}
