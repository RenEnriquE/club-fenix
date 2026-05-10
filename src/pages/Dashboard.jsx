import { useState, useEffect, useRef } from 'react'
import { getPersonas, getResumenAnio } from '../lib/supabase'
import { estadoSocio, mesesPendientes, MESES_SHORT, formatMoney } from '../lib/helpers'
import { Chart, CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend } from 'chart.js'

Chart.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend)

export default function Dashboard() {
  const [personas, setPersonas] = useState([])
  const [pagos, setPagos] = useState([])
  const [loading, setLoading] = useState(true)
  const chartBarRef = useRef(null)
  const chartPieRef = useRef(null)
  const barInstance = useRef(null)
  const pieInstance = useRef(null)

  useEffect(() => {
    Promise.all([
      getPersonas({ soloVigentes: true }),
      getResumenAnio(new Date().getFullYear())
    ]).then(([p, pg]) => {
      setPersonas(p)
      setPagos(pg)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (loading || !chartBarRef.current || !chartPieRef.current) return

    const ingrMes = MESES_SHORT.map((_, i) =>
      pagos.filter(p => p.mes === i + 1).reduce((a, p) => a + (p.monto || 0), 0)
    )

    const alDia = personas.filter(p => estadoSocio(p.id_caif, pagos) === 'al-dia').length
    const morosos = personas.filter(p => estadoSocio(p.id_caif, pagos) === 'moroso').length
    const parcial = personas.filter(p => estadoSocio(p.id_caif, pagos) === 'parcial').length

    if (barInstance.current) barInstance.current.destroy()
    barInstance.current = new Chart(chartBarRef.current, {
      type: 'bar',
      data: {
        labels: MESES_SHORT,
        datasets: [{ label: 'Ingresos', data: ingrMes, backgroundColor: '#2e7d52', borderRadius: 4 }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { ticks: { callback: v => '$' + v.toLocaleString('es-CL') }, grid: { color: 'rgba(0,0,0,.05)' } },
          x: { grid: { display: false }, ticks: { autoSkip: false, maxRotation: 0, font: { size: 10 } } }
        }
      }
    })

    if (pieInstance.current) pieInstance.current.destroy()
    pieInstance.current = new Chart(chartPieRef.current, {
      type: 'doughnut',
      data: {
        labels: ['Al día', 'Moroso', 'Parcial'],
        datasets: [{ data: [alDia, morosos, parcial], backgroundColor: ['#16a34a', '#dc2626', '#d97706'], borderWidth: 2 }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 12 }, padding: 12 } } }, cutout: '62%' }
    })

    return () => {
      barInstance.current?.destroy()
      pieInstance.current?.destroy()
    }
  }, [loading, personas, pagos])

  if (loading) return (
    <div className="content">
      <div className="loading-center"><div className="spinner"></div><span>Cargando datos...</span></div>
    </div>
  )

  const anioActual = new Date().getFullYear()
  const alDia = personas.filter(p => estadoSocio(p.id_caif, pagos) === 'al-dia').length
  const morosos = personas.filter(p => estadoSocio(p.id_caif, pagos) === 'moroso').length
  const parcial = personas.filter(p => estadoSocio(p.id_caif, pagos) === 'parcial').length
  const ingTotal = pagos.reduce((a, p) => a + (p.monto || 0), 0)
  const morososList = personas
    .filter(p => estadoSocio(p.id_caif, pagos) !== 'al-dia')
    .sort((a, b) => mesesPendientes(b.id_caif, pagos) - mesesPendientes(a.id_caif, pagos))
    .slice(0, 8)

  return (
    <div className="content">
      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-label">Total socios activos</div>
          <div className="kpi-value">{personas.length}</div>
          <div className="kpi-sub">vigentes en el sistema</div>
          <i className="ti ti-users kpi-icon"></i>
        </div>
        <div className="kpi green">
          <div className="kpi-label">Al día</div>
          <div className="kpi-value">{alDia}</div>
          <div className="kpi-sub">cuota {anioActual} al corriente</div>
          <i className="ti ti-circle-check kpi-icon"></i>
        </div>
        <div className="kpi red">
          <div className="kpi-label">Morosos</div>
          <div className="kpi-value">{morosos}</div>
          <div className="kpi-sub">sin pago en {anioActual}</div>
          <i className="ti ti-alert-circle kpi-icon"></i>
        </div>
        <div className="kpi amber">
          <div className="kpi-label">Pago parcial</div>
          <div className="kpi-value">{parcial}</div>
          <div className="kpi-sub">meses pendientes</div>
          <i className="ti ti-clock kpi-icon"></i>
        </div>
        <div className="kpi">
          <div className="kpi-label">Ingresos {anioActual}</div>
          <div className="kpi-value" style={{fontSize:20}}>{formatMoney(ingTotal)}</div>
          <div className="kpi-sub">total recaudado</div>
          <i className="ti ti-coin kpi-icon"></i>
        </div>
      </div>

      <div className="two-col">
        <div className="card">
          <div className="card-title"><i className="ti ti-chart-bar"></i>Ingresos mensuales {anioActual}</div>
          <div style={{position:'relative',height:200}}>
            <canvas ref={chartBarRef} role="img" aria-label="Gráfico de ingresos mensuales">Ingresos por mes del año actual.</canvas>
          </div>
        </div>
        <div className="card">
          <div className="card-title"><i className="ti ti-chart-pie"></i>Estado de socios</div>
          <div style={{position:'relative',height:200}}>
            <canvas ref={chartPieRef} role="img" aria-label="Estado de pagos de socios">Distribución de estado de pago.</canvas>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title"><i className="ti ti-alert-triangle"></i>Socios con pagos pendientes</div>
        {morososList.length === 0 ? (
          <div className="empty"><i className="ti ti-circle-check"></i>Todos los socios están al día</div>
        ) : morososList.map(s => {
          const pend = mesesPendientes(s.id_caif, pagos)
          const estado = estadoSocio(s.id_caif, pagos)
          return (
            <div className="moroso-row" key={s.id_caif}>
              <span className="moroso-name">{s.nombre_comp}</span>
              <span className={`badge ${s.atleta === 'Atleta Niño' ? 'nino' : 'adulto'}`} style={{marginRight:8}}>
                {s.atleta === 'Atleta Niño' ? 'Niño' : 'Adulto'}
              </span>
              <span className={`badge ${estado}`} style={{marginRight:8}}>{estado === 'parcial' ? 'Parcial' : 'Sin pago'}</span>
              <span className="moroso-meses">{pend} mes{pend !== 1 ? 'es' : ''} pendiente{pend !== 1 ? 's' : ''}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
