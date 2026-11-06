import { useState, useMemo, useEffect } from 'react'
import { SEDES } from '../lib/helpers'

const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const LS_KEY = 'fenix-grupos-cuotas'

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()

function titulo(s) {
  return String(s || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('es')
    .replace(/(^|[\s\-'])(\p{L})/gu, (m, sep, l) => sep + l.toLocaleUpperCase('es'))
}

const nombreCorto = p => titulo([p.nombre, p.apellido].filter(x => x && String(x).trim()).join(' '))
const nombreLargo = p => titulo([p.nombre, p.seg_nombre, p.apellido, p.ap_mat].filter(x => x && String(x).trim()).join(' '))

function leerGrupos() {
  try {
    const g = JSON.parse(localStorage.getItem(LS_KEY) || '{}')
    return g && typeof g === 'object' ? g : {}
  } catch (e) { return {} }
}

function guardarGrupos(g) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(g)) } catch (e) { /* sin almacenamiento: no se guarda */ }
}

export default function GrupoCuotas({ personas = [], pagos = [], haySede = false }) {
  const [grupos, setGrupos] = useState(() => leerGrupos())
  const [grupoSel, setGrupoSel] = useState('')
  const [nombreGrupo, setNombreGrupo] = useState('')
  const [ids, setIds] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [pegado, setPegado] = useState('')
  const [propuestas, setPropuestas] = useState(null)
  const [aviso, setAviso] = useState('')
  const [abierto, setAbierto] = useState(false)

  useEffect(() => { if (aviso) { const t = setTimeout(() => setAviso(''), 4000); return () => clearTimeout(t) } }, [aviso])

  const porId = useMemo(() => {
    const m = {}
    personas.forEach(p => { m[p.id_caif] = p })
    return m
  }, [personas])

  // Ultimo mes de cuota pagado por socio (misma regla que la ficha: pagos de cuota, id_actividad = 0)
  const ultimoPago = useMemo(() => {
    const m = {}
    pagos.forEach(pg => {
      if (Number(pg.id_actividad) !== 0 || !pg.anio || !pg.mes) return
      const k = pg.anio * 100 + pg.mes
      if (m[pg.id_socio] === undefined || k > m[pg.id_socio]) m[pg.id_socio] = k
    })
    return m
  }, [pagos])

  const textoUltimo = id => {
    const k = ultimoPago[id]
    return k ? MES_CORTO[(k % 100) - 1] + '/' + String(Math.floor(k / 100)).slice(2) : 'sin pagos'
  }

  const indice = useMemo(() => personas.map(p => ({
    p, palabras: norm([p.nombre, p.seg_nombre, p.apellido, p.ap_mat].filter(Boolean).join(' ')).split(' '),
  })), [personas])

  // Socios cuyas palabras empiezan con todos los fragmentos escritos; vigentes primero
  function buscarPersonas(texto) {
    const tokens = norm(texto).split(' ').filter(Boolean)
    if (tokens.length === 0) return []
    return indice
      .filter(x => tokens.every(t => x.palabras.some(w => w.startsWith(t))))
      .map(x => x.p)
      .sort((a, b) => (b.vigente === 1) - (a.vigente === 1))
  }

  const sugerencias = useMemo(
    () => (busqueda.trim().length >= 2 ? buscarPersonas(busqueda).filter(p => !ids.includes(p.id_caif)).slice(0, 8) : []),
    [busqueda, indice, ids]
  )

  function agregar(id) {
    setIds(prev => (prev.includes(id) ? prev : [...prev, id]))
    setBusqueda('')
  }

  function quitar(id) { setIds(prev => prev.filter(x => x !== id)) }

  function mover(id, delta) {
    setIds(prev => {
      const i = prev.indexOf(id)
      const j = i + delta
      if (i < 0 || j < 0 || j >= prev.length) return prev
      const n = [...prev]
      ;[n[i], n[j]] = [n[j], n[i]]
      return n
    })
  }

  function interpretarLista() {
    const lineas = pegado.split('\n')
      .map(l => l.replace(/:.*$/, '').replace(/^[\s\d]*[.)\-]\s*/, '').replace(/^[\s\u2022*\-]+/, '').trim())
      .filter(Boolean)
    setPropuestas(lineas.map(linea => {
      const cand = buscarPersonas(linea)
      const vig = cand.filter(p => p.vigente === 1)
      const lista = vig.length > 0 ? vig : cand
      return { linea, cand: lista, elegido: lista.length === 1 ? lista[0].id_caif : '' }
    }))
  }

  function agregarPropuestas() {
    const nuevos = propuestas.map(x => x.elegido).filter(x => x !== '')
    setIds(prev => [...prev, ...nuevos.filter(id => !prev.includes(id))])
    setPropuestas(null)
    setPegado('')
  }

  // Carga todos los socios vigentes de una sede, ordenados por nombre
  function cargarSede(sede) {
    const lista = personas
      .filter(p => p.vigente === 1 && p.sede === sede)
      .sort((a, b) => nombreCorto(a).localeCompare(nombreCorto(b), 'es'))
    setIds(lista.map(p => p.id_caif))
    setNombreGrupo(sede)
    setGrupoSel('')
    setPropuestas(null)
  }

  function guardarGrupo() {
    const nombre = nombreGrupo.trim()
    if (!nombre || ids.length === 0) return
    const g = { ...grupos, [nombre]: ids }
    setGrupos(g)
    guardarGrupos(g)
    setGrupoSel(nombre)
    setAviso('Grupo "' + nombre + '" guardado en este navegador.')
  }

  function cargarGrupo(nombre) {
    setGrupoSel(nombre)
    if (nombre && grupos[nombre]) {
      setIds(grupos[nombre].filter(id => porId[id]))
      setNombreGrupo(nombre)
    }
  }

  function eliminarGrupo() {
    if (!grupoSel) return
    const g = { ...grupos }
    delete g[grupoSel]
    setGrupos(g)
    guardarGrupos(g)
    setGrupoSel('')
    setAviso('Grupo eliminado.')
  }

  const mensaje = useMemo(() => {
    const lineas = ids.filter(id => porId[id]).map(id => '\u2022 ' + nombreCorto(porId[id]) + ': ' + textoUltimo(id))
    return ['Atleta / \u00daltimo mes pagado:', ...lineas].join('\n')
  }, [ids, porId, ultimoPago])

  function copiar() {
    const ok = () => setAviso('Copiado. Ya puedes pegarlo en WhatsApp.')
    const respaldo = () => {
      const ta = document.createElement('textarea')
      ta.value = mensaje
      ta.style.position = 'fixed'; ta.style.opacity = '0'
      document.body.appendChild(ta); ta.select()
      try { document.execCommand('copy'); ok() } catch (e) { setAviso('No se pudo copiar; selecciona el texto manualmente.') }
      document.body.removeChild(ta)
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(mensaje).then(ok, respaldo)
    else respaldo()
  }

  const nombresGrupos = Object.keys(grupos).sort()

  return (
    <div className="card">
      <div className="card-title" onClick={() => setAbierto(a => !a)} role="button" aria-expanded={abierto}
        style={{ cursor: 'pointer', userSelect: 'none', margin: abierto ? undefined : 0 }}>
        <i className="ti ti-brand-whatsapp"></i>Estado de cuotas por grupo (WhatsApp)
        <i className={'ti ' + (abierto ? 'ti-chevron-up' : 'ti-chevron-down')} style={{ marginLeft: 'auto', color: 'var(--text-3)' }}></i>
      </div>
      {abierto && (<>
      <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 14px' }}>
        Arma un grupo de socios (por ejemplo, quienes entrenan en Recoleta) y copia el nombre con su &uacute;ltimo mes de cuota pagado, listo para pegar en WhatsApp.
      </p>

      {haySede && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 500 }}>Cargar por sede (vigentes):</span>
          {SEDES.map(x => {
            const n = personas.filter(p => p.vigente === 1 && p.sede === x).length
            return (
              <button key={x} className="btn sm" onClick={() => cargarSede(x)} disabled={n === 0}>
                <i className="ti ti-map-pin"></i>{x} ({n})
              </button>
            )
          })}
        </div>
      )}

      {nombresGrupos.length > 0 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
          <select value={grupoSel} onChange={e => cargarGrupo(e.target.value)} style={{ padding: '6px 10px', border: '0.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', background: '#fff' }}>
            <option value="">Grupos guardados...</option>
            {nombresGrupos.map(n => <option key={n} value={n}>{n} ({grupos[n].length})</option>)}
          </select>
          {grupoSel && <button className="btn sm danger" onClick={eliminarGrupo}><i className="ti ti-trash"></i>Eliminar grupo</button>}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, marginBottom: 14 }}>
        <div className="form-group" style={{ position: 'relative' }}>
          <label>Agregar socio (buscar por nombre)</label>
          <input type="text" placeholder="Ej: sofia pichardo" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          {sugerencias.length > 0 && (
            <div style={{ border: '0.5px solid #e2e8f0', borderRadius: 8, background: '#fff', marginTop: 4, overflow: 'hidden' }}>
              {sugerencias.map(p => (
                <button key={p.id_caif} onClick={() => agregar(p.id_caif)}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', border: 'none', borderBottom: '0.5px solid #f1f5f9', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
                  {nombreLargo(p)} <span style={{ color: 'var(--text-3)', fontSize: 11 }}>ID {p.id_caif}{p.vigente === 1 ? '' : ' - inactivo'}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="form-group">
          <label>O pegar una lista de nombres (uno por l&iacute;nea)</label>
          <textarea rows={4} placeholder={'1. Benjamin Morales\n2. Laura Pino\n...'} value={pegado} onChange={e => setPegado(e.target.value)}
            style={{ fontFamily: 'inherit', fontSize: 13, padding: 8, border: '0.5px solid #e2e8f0', borderRadius: 8, resize: 'vertical' }} />
          <div><button className="btn sm" onClick={interpretarLista} disabled={!pegado.trim()}><i className="ti ti-search"></i>Buscar nombres</button></div>
        </div>
      </div>

      {propuestas && (
        <div style={{ border: '0.5px solid #e2e8f0', borderRadius: 10, padding: 12, marginBottom: 14, background: '#f8fafc' }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Revisa las coincidencias</div>
          {propuestas.map((x, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '4px 0', fontSize: 13 }}>
              <span style={{ minWidth: 150 }}>{x.linea}</span>
              {x.cand.length === 0 ? (
                <span style={{ color: 'var(--danger)', fontSize: 12 }}>No encontrado</span>
              ) : x.cand.length === 1 ? (
                <span style={{ color: 'var(--success)', fontSize: 12 }}>{nombreLargo(x.cand[0])} (ID {x.cand[0].id_caif})</span>
              ) : (
                <select value={x.elegido} onChange={e => setPropuestas(prev => prev.map((y, j) => j === i ? { ...y, elegido: e.target.value === '' ? '' : Number(e.target.value) } : y))}
                  style={{ padding: '4px 8px', border: '0.5px solid #fde68a', borderRadius: 6, fontSize: 12, fontFamily: 'inherit', background: '#fffbeb' }}>
                  <option value="">Hay {x.cand.length} coincidencias: elige una</option>
                  {x.cand.map(p => <option key={p.id_caif} value={p.id_caif}>{nombreLargo(p)} (ID {p.id_caif}{p.vigente === 1 ? '' : ', inactivo'})</option>)}
                </select>
              )}
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className="btn sm primary" onClick={agregarPropuestas} disabled={!propuestas.some(x => x.elegido !== '')}>
              <i className="ti ti-plus"></i>Agregar al grupo ({propuestas.filter(x => x.elegido !== '').length})
            </button>
            <button className="btn sm" onClick={() => setPropuestas(null)}>Cancelar</button>
          </div>
        </div>
      )}

      {ids.length === 0 ? (
        <p style={{ color: 'var(--text-2)', fontSize: 13, margin: '0 0 8px' }}>Todav&iacute;a no hay socios en el grupo.</p>
      ) : (
        <>
          <div className="tbl-wrap" style={{ border: 'var(--border)', marginBottom: 12 }}>
            <table className="tbl" style={{ tableLayout: 'auto' }}>
              <thead>
                <tr><th>Atleta</th><th>&Uacute;ltimo mes pagado</th><th style={{ width: 110 }}></th></tr>
              </thead>
              <tbody>
                {ids.filter(id => porId[id]).map(id => (
                  <tr key={id}>
                    <td>{nombreCorto(porId[id])}{porId[id].vigente === 1 ? '' : <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 6 }}>(inactivo)</span>}</td>
                    <td>{textoUltimo(id)}</td>
                    <td style={{ overflow: 'visible' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn sm" title="Subir" onClick={() => mover(id, -1)}><i className="ti ti-arrow-up"></i></button>
                        <button className="btn sm" title="Bajar" onClick={() => mover(id, 1)}><i className="ti ti-arrow-down"></i></button>
                        <button className="btn sm" title="Quitar" onClick={() => quitar(id)}><i className="ti ti-x"></i></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <pre style={{ background: '#f0fdf4', border: '0.5px solid #a7f3d0', borderRadius: 10, padding: 12, fontSize: 13, whiteSpace: 'pre-wrap', margin: '0 0 12px', fontFamily: 'inherit' }}>{mensaje}</pre>
        </>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn primary" onClick={copiar} disabled={ids.length === 0}><i className="ti ti-copy"></i>Copiar para WhatsApp</button>
        <input type="text" placeholder="Nombre del grupo (ej: Recoleta)" value={nombreGrupo} onChange={e => setNombreGrupo(e.target.value)}
          style={{ padding: '6px 10px', border: '0.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', width: 220 }} />
        <button className="btn" onClick={guardarGrupo} disabled={ids.length === 0 || !nombreGrupo.trim()}><i className="ti ti-device-floppy"></i>Guardar grupo</button>
        {ids.length > 0 && <button className="btn" onClick={() => { setIds([]); setGrupoSel('') }}>Vaciar</button>}
        {aviso && <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>{aviso}</span>}
      </div>
      <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '10px 0 0' }}>
        Los grupos guardados a mano quedan en este navegador; los de sede se arman solos con lo asignado en cada ficha. El &uacute;ltimo mes pagado considera solo cuotas (no actividades ni torneos).
      </p>
      </>)}
    </div>
  )
}
