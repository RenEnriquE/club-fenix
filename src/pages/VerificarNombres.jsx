import { useState, useMemo } from 'react'

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()

const nombreCompleto = p => [p.nombre, p.seg_nombre, p.apellido, p.ap_mat].filter(x => x && String(x).trim()).join(' ')

// Distancia de edicion (cuantas letras hay que cambiar para pasar de a a b)
function distancia(a, b) {
  if (a === b) return 0
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[b.length]
}

// Palabras casi iguales: 1 letra de diferencia desde 4 letras, 2 desde 8 letras
function similares(a, b) {
  if (a.length < 4 || b.length < 4) return false
  if (Math.abs(a.length - b.length) > 2) return false
  return distancia(a, b) <= (Math.min(a.length, b.length) >= 8 ? 2 : 1)
}

export default function VerificarNombres({ personas = [] }) {
  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState('')
  const [resultados, setResultados] = useState(null)
  const [verNo, setVerNo] = useState(false)
  const [aviso, setAviso] = useState('')

  const indice = useMemo(() => personas.map(p => ({ p, palabras: norm(nombreCompleto(p)).split(' ').filter(Boolean) })), [personas])

  function verificar() {
    const lineas = texto.split('\n')
      .map(l => l.replace(/^[\s\d]*[.)\-]\s*/, '').replace(/^[\s\u2022*\-]+/, '').trim())
      .filter(Boolean)
    const vistos = new Set()
    const res = []
    lineas.forEach(linea => {
      const clave = norm(linea)
      if (!clave || vistos.has(clave)) return
      vistos.add(clave)
      const tokens = clave.split(' ')
      // Orden de las palabras indiferente (sirve para "Apellido Apellido Nombre Nombre")
      const exactos = []
      const parecidos = []
      indice.forEach(x => {
        let exacto = 0
        let parecido = 0
        tokens.forEach(t => {
          if (x.palabras.includes(t)) exacto++
          else if (x.palabras.some(w => similares(t, w))) parecido++
        })
        const total = exacto + parecido
        if (tokens.length >= 2 && exacto === tokens.length) exactos.push(x.p)
        // Con errores de tipeo (ej: Emanuel / Emmanuel) o falta una palabra: "posible"
        else if (tokens.length >= 2 && total === tokens.length && exacto >= 1) parecidos.push({ p: x.p, hits: exacto * 2 + parecido })
        else if (tokens.length >= 3 && total / tokens.length >= 0.75 && exacto >= 2) parecidos.push({ p: x.p, hits: exacto * 2 + parecido })
      })
      if (exactos.length > 0) {
        res.push({ linea, estado: 'socio', cand: exactos.sort((a, b) => (b.vigente === 1) - (a.vigente === 1)) })
      } else if (parecidos.length > 0) {
        res.push({ linea, estado: 'posible', cand: parecidos.sort((a, b) => b.hits - a.hits).map(x => x.p).slice(0, 3) })
      } else {
        res.push({ linea, estado: 'no', cand: [] })
      }
    })
    setResultados(res)
  }

  const socios = resultados ? resultados.filter(r => r.estado === 'socio') : []
  const posibles = resultados ? resultados.filter(r => r.estado === 'posible') : []
  const noSocios = resultados ? resultados.filter(r => r.estado === 'no') : []
  const vigentes = socios.filter(r => r.cand[0].vigente === 1).length

  const etiquetaCand = p => nombreCompleto(p) + ' (ID ' + p.id_caif + ', ' + (p.vigente === 1 ? 'vigente' : 'inactivo') + ')'

  function copiar() {
    const lineas = [
      ...socios.map(r => r.linea + ': SOCIO - ' + etiquetaCand(r.cand[0])),
      ...posibles.map(r => r.linea + ': POSIBLE - ' + r.cand.map(etiquetaCand).join(' / ')),
      ...noSocios.map(r => r.linea + ': no es socio'),
    ]
    const t = lineas.join('\n')
    const ok = () => { setAviso('Copiado.'); setTimeout(() => setAviso(''), 2500) }
    const respaldo = () => {
      const ta = document.createElement('textarea')
      ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0'
      document.body.appendChild(ta); ta.select()
      try { document.execCommand('copy'); ok() } catch (e) { /* sin portapapeles */ }
      document.body.removeChild(ta)
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, respaldo)
    else respaldo()
  }

  const badge = (txt, bg, color, borde) => (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: bg, color, border: '0.5px solid ' + borde, whiteSpace: 'nowrap' }}>{txt}</span>
  )

  return (
    <div className="card">
      <div className="card-title" onClick={() => setAbierto(a => !a)} role="button" aria-expanded={abierto}
        style={{ cursor: 'pointer', userSelect: 'none', margin: abierto ? undefined : 0 }}>
        <i className="ti ti-user-search"></i>Verificar si son socios
        <i className={'ti ' + (abierto ? 'ti-chevron-up' : 'ti-chevron-down')} style={{ marginLeft: 'auto', color: 'var(--text-3)' }}></i>
      </div>
      {abierto && (
        <>
          <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 12px' }}>
            Pega una lista de nombres (uno por l&iacute;nea, en cualquier orden, con o sin tildes) y te digo cu&aacute;les est&aacute;n en el registro de socios, vigentes o inactivos.
          </p>
          <textarea rows={6} value={texto} onChange={e => setTexto(e.target.value)} placeholder={'Henriquez Contreras Fernando Javier\nTrujillo Cusi Andy Daniel\n...'}
            style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', fontSize: 13, padding: 8, border: '0.5px solid #e2e8f0', borderRadius: 8, resize: 'vertical', marginBottom: 8 }} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
            <button className="btn primary" onClick={verificar} disabled={!texto.trim()}><i className="ti ti-search"></i>Verificar</button>
            {resultados && <button className="btn" onClick={copiar}><i className="ti ti-copy"></i>Copiar resultado</button>}
            {aviso && <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>{aviso}</span>}
          </div>

          {resultados && (
            <>
              <div style={{ fontSize: 13, marginBottom: 10, lineHeight: 1.7 }}>
                <strong>{resultados.length}</strong> nombres revisados: <strong style={{ color: '#16a34a' }}>{socios.length} son socios</strong> ({vigentes} vigentes, {socios.length - vigentes} inactivos),{' '}
                <strong style={{ color: '#d97706' }}>{posibles.length} posibles</strong> para revisar y <strong style={{ color: '#64748b' }}>{noSocios.length} no son socios</strong>.
              </div>
              {(socios.length + posibles.length) > 0 && (
                <div className="tbl-wrap" style={{ border: 'var(--border)', marginBottom: 10 }}>
                  <table className="tbl" style={{ tableLayout: 'auto' }}>
                    <thead><tr><th>Nombre de la lista</th><th>Resultado</th><th>En el registro</th></tr></thead>
                    <tbody>
                      {[...socios, ...posibles].map((r, i) => (
                        <tr key={i}>
                          <td style={{ whiteSpace: 'normal' }}>{r.linea}</td>
                          <td>{r.estado === 'socio'
                            ? (r.cand[0].vigente === 1 ? badge('Socio vigente', '#f0fdf4', '#16a34a', '#a7f3d0') : badge('Socio inactivo', '#f1f5f9', '#64748b', '#e2e8f0'))
                            : badge('Posible', '#fffbeb', '#d97706', '#fde68a')}</td>
                          <td style={{ whiteSpace: 'normal' }}>{r.cand.map(p => <div key={p.id_caif}>{etiquetaCand(p)}</div>)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {noSocios.length > 0 && (
                <div>
                  <button className="btn sm" onClick={() => setVerNo(v => !v)}>
                    <i className={'ti ' + (verNo ? 'ti-chevron-up' : 'ti-chevron-down')}></i>{verNo ? 'Ocultar' : 'Ver'} los {noSocios.length} que no son socios
                  </button>
                  {verNo && (
                    <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 8, lineHeight: 1.8 }}>
                      {noSocios.map((r, i) => <div key={i}>{r.linea}</div>)}
                    </div>
                  )}
                </div>
              )}
              <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '10px 0 0' }}>
                "Socio" = todas las palabras del nombre aparecen en el registro. "Posible" = coinciden casi todas las palabras (por ejemplo, un nombre mal escrito como Emanuel/Emmanuel o que falta un nombre); conviene revisarlo a mano. Los hermanos con los mismos apellidos no se cuentan como coincidencia.
              </p>
            </>
          )}
        </>
      )}
    </div>
  )
}
