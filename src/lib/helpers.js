export const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
export const MESES_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
export const AÑOS = [2024, 2025, 2026]

export function estadoSocio(idSocio, pagos) {
  const hoy = new Date()
  const mesActual = hoy.getMonth() + 1
  const anioActual = hoy.getFullYear()
  const pagosSocio = pagos.filter(p => p.id_socio === idSocio && p.anio === anioActual)
  const mesesPagados = pagosSocio.map(p => p.mes)
  const mesesEsperados = Array.from({ length: mesActual }, (_, i) => i + 1)
  const pagados = mesesEsperados.filter(m => mesesPagados.includes(m))
  if (pagados.length === mesesEsperados.length) return 'al-dia'
  if (pagados.length === 0) return 'moroso'
  return 'parcial'
}

export function mesesPendientes(idSocio, pagos) {
  const hoy = new Date()
  const mesActual = hoy.getMonth() + 1
  const anioActual = hoy.getFullYear()
  const mesesPagados = pagos.filter(p => p.id_socio === idSocio && p.anio === anioActual).map(p => p.mes)
  return Array.from({ length: mesActual }, (_, i) => i + 1).filter(m => !mesesPagados.includes(m)).length
}

export function mesesAlDia(idSocio, anio, pagos) {
  return pagos.filter(p => p.id_socio === idSocio && p.anio === anio).length
}

export function estadoLabel(estado) {
  return { 'al-dia': 'Al día', 'moroso': 'Moroso', 'parcial': 'Parcial' }[estado] || estado
}

export function formatMoney(n) {
  return '$' + Math.round(n).toLocaleString('es-CL')
}

export function pagosPorSocioAnio(idSocio, anio, pagos) {
  return pagos.filter(p => p.id_socio === idSocio && p.anio === anio)
}

// Formato de nombre para mostrar
// Si apodo != nombre: "Apodo - Nombre SegNombre Apellido ApMat"
// Si apodo == nombre: "Nombre SegNombre Apellido ApMat"
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
