export const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
export const MESES_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
export const AÑOS = [2024, 2025, 2026]

// Cuota esperada segun tipo de atleta y periodo
export function cuotaEsperada(atleta, anio, mes) {
  const esNino = atleta && atleta.includes('Ni')
  const periodo = anio * 100 + mes
  if (periodo >= 202601) {
    // Desde enero 2026: $3.000 todos
    return 3000
  } else if (periodo >= 202507) {
    // Jul 2025 - Dic 2025: nino $2.000, adulto $3.000
    return esNino ? 2000 : 3000
  } else {
    // Antes de jul 2025: nino $1.000, adulto $3.000
    return esNino ? 1000 : 3000
  }
}

// Desde qué mes se debe cobrar en un año dado (segun f_reingreso o f_ini_vig)
function mesDesdeCobro(persona, anio) {
  const fechaRef = persona?.f_reingreso || persona?.f_ini_vig
  if (!fechaRef) return 1
  const d = new Date(fechaRef + 'T12:00:00-04:00')
  const anioRef = d.getFullYear()
  const mesRef = d.getMonth() + 1
  if (anioRef === anio) return mesRef
  if (anioRef < anio) return 1
  return 13 // no corresponde cobrar en este año
}

// Mes hasta el cual se debe cobrar (considerando periodo de gracia de 5 dias)
function mesHastaCobro() {
  const hoy = new Date()
  const dia = hoy.getDate()
  const mes = hoy.getMonth() + 1
  const anio = hoy.getFullYear()
  // Si estamos en los primeros 5 dias del mes, el mes actual aun no vence
  if (dia <= 5) {
    return { mes: mes - 1 === 0 ? 12 : mes - 1, anio: mes - 1 === 0 ? anio - 1 : anio }
  }
  return { mes, anio }
}

export function estadoSocio(idSocio, pagos, atleta, persona) {
  if (atleta === 'Apoderado') return 'al-dia'

  const hoy = new Date()
  const anioActual = hoy.getFullYear()
  const { mes: mesVigente, anio: anioVigente } = mesHastaCobro()

  // Si aun no hay mes vigente (primeros 5 dias de enero), al dia
  if (mesVigente < 1) return 'al-dia'

  const mesDesde = mesDesdeCobro(persona, anioActual)
  if (mesDesde > mesVigente) return 'al-dia'

  // Pagos de cuotas del socio en el año actual
  const pagosSocio = pagos.filter(p =>
    p.id_socio === idSocio &&
    p.anio === anioActual &&
    Number(p.id_actividad) === 0
  )

  // Verificar cada mes desde el ingreso hasta el mes vigente
  let tieneParcial = false
  let tieneMoroso = false

  for (let m = mesDesde; m <= mesVigente; m++) {
    const esperado = cuotaEsperada(atleta, anioActual, m)
    const pagadoMes = pagosSocio.filter(p => p.mes === m).reduce((a, p) => a + (p.monto || 0), 0)

    if (pagadoMes === 0) {
      tieneMoroso = true
    } else if (pagadoMes < esperado) {
      tieneParcial = true
    }
  }

  if (tieneMoroso) return 'moroso'
  if (tieneParcial) return 'parcial'
  return 'al-dia'
}

export function mesesPendientes(idSocio, pagos, persona) {
  const hoy = new Date()
  const anioActual = hoy.getFullYear()
  const { mes: mesVigente } = mesHastaCobro()

  if (mesVigente < 1) return 0

  const mesDesde = mesDesdeCobro(persona, anioActual)
  if (mesDesde > mesVigente) return 0

  const mesesPagados = pagos.filter(p =>
    p.id_socio === idSocio &&
    p.anio === anioActual &&
    Number(p.id_actividad) === 0
  ).map(p => p.mes)

  return Array.from({ length: mesVigente - mesDesde + 1 }, (_, i) => i + mesDesde)
    .filter(m => !mesesPagados.includes(m)).length
}

export function mesesAlDia(idSocio, anio, pagos) {
  return pagos.filter(p =>
    p.id_socio === idSocio &&
    p.anio === anio &&
    Number(p.id_actividad) === 0
  ).length
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
