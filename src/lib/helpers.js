export const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
export const MESES_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
export const AÑOS = [2024, 2025, 2026]

// Calcula desde qué mes se debe cobrar en un año dado
// Considera f_reingreso (ciclo actual) o f_ini_vig (primer ingreso)
function mesDesdeCobro(persona, anio) {
  const anioActual = new Date().getFullYear()
  // Usar f_reingreso si existe y es del año en curso, sino f_ini_vig
  const fechaRef = persona?.f_reingreso || persona?.f_ini_vig
  if (!fechaRef) return 1
  const d = new Date(fechaRef + 'T12:00:00-04:00')
  const anioRef = d.getFullYear()
  const mesRef = d.getMonth() + 1
  // Si la fecha de referencia es de este año, cobrar desde ese mes
  if (anioRef === anio) return mesRef
  // Si ingresó antes de este año, cobrar desde enero
  if (anioRef < anio) return 1
  // Si ingresó después de este año (no debería pasar), no cobrar
  return 13
}

export function estadoSocio(idSocio, pagos, atleta, persona) {
  if (atleta === 'Apoderado') return 'al-dia'
  const hoy = new Date()
  const mesActual = hoy.getMonth() + 1
  const anioActual = hoy.getFullYear()
  const mesDesde = mesDesdeCobro(persona, anioActual)
  if (mesDesde > mesActual) return 'al-dia' // aun no le toca pagar
  const pagosSocio = pagos.filter(p => p.id_socio === idSocio && p.anio === anioActual && Number(p.id_actividad) === 0)
  const mesesPagados = pagosSocio.map(p => p.mes)
  const mesesEsperados = Array.from({ length: mesActual - mesDesde + 1 }, (_, i) => i + mesDesde)
  const pagados = mesesEsperados.filter(m => mesesPagados.includes(m))
  if (pagados.length === mesesEsperados.length) return 'al-dia'
  if (pagados.length === 0) return 'moroso'
  return 'parcial'
}

export function mesesPendientes(idSocio, pagos, persona) {
  const hoy = new Date()
  const mesActual = hoy.getMonth() + 1
  const anioActual = hoy.getFullYear()
  const mesDesde = mesDesdeCobro(persona, anioActual)
  if (mesDesde > mesActual) return 0
  const mesesPagados = pagos.filter(p => p.id_socio === idSocio && p.anio === anioActual && Number(p.id_actividad) === 0).map(p => p.mes)
  return Array.from({ length: mesActual - mesDesde + 1 }, (_, i) => i + mesDesde).filter(m => !mesesPagados.includes(m)).length
}

export function mesesAlDia(idSocio, anio, pagos) {
  return pagos.filter(p => p.id_socio === idSocio && p.anio === anio && Number(p.id_actividad) === 0).length
}

export function estadoLabel(estado) {
  return { 'al-dia': 'Al dia', 'moroso': 'Moroso', 'parcial': 'Parcial' }[estado] || estado
}

export function formatMoney(n) {
  return '$' + Math.round(n).toLocaleString('es-CL')
}

export function pagosPorSocioAnio(idSocio, anio, pagos) {
  return pagos.filter(p => p.id_socio === idSocio && p.anio === anio)
}

export function nombreMostrar(s) {
  if (!s) return ''
  const nombreComp = [s.nombre, s.seg_nombre, s.apellido, s.ap_mat].filter(Boolean).join(' ')
  const apodo = (s.apodo || '').trim()
  const nombre = (s.nombre || '').trim()
  if (apodo && apodo.toLowerCase() !== nombre.toLowerCase()) {
    return `${apodo} - ${nombreComp}`
  }
  return nombreComp
}
