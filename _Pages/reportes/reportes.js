"use client"
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import estilos from "./reportes.module.css"
import { 
    obtenerUsuarioActual,
    obtenerReporteGeneral,
    obtenerReporteConversaciones,
    obtenerReporteMensajes,
    obtenerReporteContactos,
    obtenerReportePlataformas
} from "./servidor"

export default function ReportesPage() {
    const router = useRouter()
    const [usuario, setUsuario] = useState(null)
    const [loading, setLoading] = useState(true)
    const [loadingReporte, setLoadingReporte] = useState(false)
    
    // Estados para filtros
    const [filtros, setFiltros] = useState({
        fechaInicio: '',
        fechaFin: '',
        plataforma: 'todas',
        tipoReporte: 'general'
    })
    
    // Estados para datos de reportes
    const [reporteGeneral, setReporteGeneral] = useState(null)
    const [reporteConversaciones, setReporteConversaciones] = useState(null)
    const [reporteMensajes, setReporteMensajes] = useState(null)
    const [reporteContactos, setReporteContactos] = useState(null)
    const [reportePlataformas, setReportePlataformas] = useState(null)

    useEffect(() => {
        verificarYCargarDatos()
    }, [])

    useEffect(() => {
        if (usuario) {
            // Establecer fechas por defecto (último mes)
            const fechaFin = new Date()
            const fechaInicio = new Date()
            fechaInicio.setMonth(fechaInicio.getMonth() - 1)
            
            setFiltros(prev => ({
                ...prev,
                fechaInicio: fechaInicio.toISOString().split('T')[0],
                fechaFin: fechaFin.toISOString().split('T')[0]
            }))
            
            cargarReportes({
                ...filtros,
                fechaInicio: fechaInicio.toISOString().split('T')[0],
                fechaFin: fechaFin.toISOString().split('T')[0]
            })
        }
    }, [usuario])

    const verificarYCargarDatos = async () => {
        try {
            setLoading(true)
            
            const usuarioData = await obtenerUsuarioActual()
            if (!usuarioData) {
                router.push('/login')
                return
            }

            // Solo admins y superadmins pueden acceder a reportes
            if (usuarioData.rol === 'usuario') {
                router.push('/dashboard')
                return
            }
            
            setUsuario(usuarioData)
            
        } catch (error) {
            console.log('Error al verificar usuario:', error)
            router.push('/login')
        } finally {
            setLoading(false)
        }
    }

    const cargarReportes = async (filtrosActuales = filtros) => {
        try {
            setLoadingReporte(true)
            
            const promesas = [
                obtenerReporteGeneral(filtrosActuales),
                obtenerReporteConversaciones(filtrosActuales),
                obtenerReporteMensajes(filtrosActuales),
                obtenerReporteContactos(filtrosActuales),
                obtenerReportePlataformas(filtrosActuales)
            ]
            
            const [general, conversaciones, mensajes, contactos, plataformas] = await Promise.all(promesas)
            
            setReporteGeneral(general)
            setReporteConversaciones(conversaciones)
            setReporteMensajes(mensajes)
            setReporteContactos(contactos)
            setReportePlataformas(plataformas)
            
        } catch (error) {
            console.log('Error al cargar reportes:', error)
        } finally {
            setLoadingReporte(false)
        }
    }

    const manejarFiltro = (campo, valor) => {
        const nuevosFiltros = {
            ...filtros,
            [campo]: valor
        }
        setFiltros(nuevosFiltros)
        
        // Auto-cargar reportes cuando cambian las fechas
        if (campo === 'fechaInicio' || campo === 'fechaFin') {
            if (nuevosFiltros.fechaInicio && nuevosFiltros.fechaFin) {
                cargarReportes(nuevosFiltros)
            }
        }
    }

    const exportarReporte = (tipo) => {
        // Implementar exportación de reportes
        console.log('Exportando reporte:', tipo)
    }

    const formatearNumero = (numero) => {
        return new Intl.NumberFormat('es-ES').format(numero || 0)
    }

    const formatearPorcentaje = (numero) => {
        return `${(numero || 0).toFixed(1)}%`
    }

    if (loading) {
        return (
            <div className={estilos.loadingContainer}>
                <div className={estilos.loadingSpinner}></div>
                <p>Cargando reportes...</p>
            </div>
        )
    }

    return (
        <div className={estilos.reportesContainer}>
            {/* Header de la página */}
            <div className={estilos.pageHeader}>
                <div className={estilos.pageTitle}>
                    <ion-icon name="analytics-outline"></ion-icon>
                    <h1>Reportes y Análisis</h1>
                </div>
                <div className={estilos.headerActions}>
                    <button 
                        className={estilos.botonSecundario}
                        onClick={() => exportarReporte(filtros.tipoReporte)}
                    >
                        <ion-icon name="download-outline"></ion-icon>
                        Exportar
                    </button>
                </div>
            </div>

            {/* Filtros */}
            <div className={estilos.filtrosSection}>
                <div className={estilos.filtrosGrid}>
                    <div className={estilos.formGroup}>
                        <label>Fecha Inicio</label>
                        <input
                            type="date"
                            value={filtros.fechaInicio}
                            onChange={(e) => manejarFiltro('fechaInicio', e.target.value)}
                        />
                    </div>
                    
                    <div className={estilos.formGroup}>
                        <label>Fecha Fin</label>
                        <input
                            type="date"
                            value={filtros.fechaFin}
                            onChange={(e) => manejarFiltro('fechaFin', e.target.value)}
                        />
                    </div>
                    
                    <div className={estilos.formGroup}>
                        <label>Plataforma</label>
                        <select
                            value={filtros.plataforma}
                            onChange={(e) => manejarFiltro('plataforma', e.target.value)}
                        >
                            <option value="todas">Todas las plataformas</option>
                            <option value="whatsapp">WhatsApp</option>
                            <option value="instagram">Instagram</option>
                            <option value="facebook">Facebook</option>
                        </select>
                    </div>
                    
                    <div className={estilos.formGroup}>
                        <label>Tipo de Reporte</label>
                        <select
                            value={filtros.tipoReporte}
                            onChange={(e) => manejarFiltro('tipoReporte', e.target.value)}
                        >
                            <option value="general">General</option>
                            <option value="conversaciones">Conversaciones</option>
                            <option value="mensajes">Mensajes</option>
                            <option value="contactos">Contactos</option>
                            <option value="plataformas">Por Plataforma</option>
                        </select>
                    </div>
                </div>
            </div>

            {loadingReporte ? (
                <div className={estilos.loadingReporte}>
                    <div className={estilos.loadingSpinner}></div>
                    <p>Generando reporte...</p>
                </div>
            ) : (
                <>
                    {/* Reporte General */}
                    {filtros.tipoReporte === 'general' && reporteGeneral && (
                        <div className={estilos.reporteSection}>
                            <div className={estilos.sectionHeader}>
                                <h2>
                                    <ion-icon name="stats-chart-outline"></ion-icon>
                                    Resumen General
                                </h2>
                            </div>
                            
                            <div className={estilos.statsGrid}>
                                <div className={estilos.statCard}>
                                    <div className={estilos.statIcon}>
                                        <ion-icon name="people-outline"></ion-icon>
                                    </div>
                                    <div className={estilos.statContent}>
                                        <div className={estilos.statNumber}>
                                            {formatearNumero(reporteGeneral.totalContactos)}
                                        </div>
                                        <div className={estilos.statLabel}>Total Contactos</div>
                                        <div className={estilos.statChange}>
                                            +{formatearNumero(reporteGeneral.contactosNuevos)} nuevos
                                        </div>
                                    </div>
                                </div>
                                
                                <div className={estilos.statCard}>
                                    <div className={estilos.statIcon}>
                                        <ion-icon name="chatbubbles-outline"></ion-icon>
                                    </div>
                                    <div className={estilos.statContent}>
                                        <div className={estilos.statNumber}>
                                            {formatearNumero(reporteGeneral.totalConversaciones)}
                                        </div>
                                        <div className={estilos.statLabel}>Conversaciones</div>
                                        <div className={estilos.statChange}>
                                            {formatearNumero(reporteGeneral.conversacionesActivas)} activas
                                        </div>
                                    </div>
                                </div>
                                
                                <div className={estilos.statCard}>
                                    <div className={estilos.statIcon}>
                                        <ion-icon name="mail-outline"></ion-icon>
                                    </div>
                                    <div className={estilos.statContent}>
                                        <div className={estilos.statNumber}>
                                            {formatearNumero(reporteGeneral.totalMensajes)}
                                        </div>
                                        <div className={estilos.statLabel}>Mensajes Enviados</div>
                                        <div className={estilos.statChange}>
                                            {formatearPorcentaje(reporteGeneral.tasaRespuesta)} tasa respuesta
                                        </div>
                                    </div>
                                </div>
                                
                                <div className={estilos.statCard}>
                                    <div className={estilos.statIcon}>
                                        <ion-icon name="time-outline"></ion-icon>
                                    </div>
                                    <div className={estilos.statContent}>
                                        <div className={estilos.statNumber}>
                                            {reporteGeneral.tiempoRespuestaPromedio}min
                                        </div>
                                        <div className={estilos.statLabel}>Tiempo Resp. Promedio</div>
                                        <div className={estilos.statChange}>
                                            {formatearPorcentaje(reporteGeneral.satisfaccionCliente)} satisfacción
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Gráficos y tablas adicionales */}
                            <div className={estilos.chartsGrid}>
                                <div className={estilos.chartCard}>
                                    <h3>Actividad por Día</h3>
                                    <div className={estilos.chartPlaceholder}>
                                        <ion-icon name="bar-chart-outline"></ion-icon>
                                        <p>Gráfico de actividad diaria</p>
                                    </div>
                                </div>
                                
                                <div className={estilos.chartCard}>
                                    <h3>Distribución por Plataforma</h3>
                                    <div className={estilos.chartPlaceholder}>
                                        <ion-icon name="pie-chart-outline"></ion-icon>
                                        <p>Gráfico de distribución</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Reporte de Conversaciones */}
                    {filtros.tipoReporte === 'conversaciones' && reporteConversaciones && (
                        <div className={estilos.reporteSection}>
                            <div className={estilos.sectionHeader}>
                                <h2>
                                    <ion-icon name="chatbubbles-outline"></ion-icon>
                                    Análisis de Conversaciones
                                </h2>
                            </div>
                            
                            <div className={estilos.tableCard}>
                                <div className={estilos.tableHeader}>
                                    <h3>Conversaciones por Estado</h3>
                                </div>
                                <div className={estilos.tableContent}>
                                    <table className={estilos.dataTable}>
                                        <thead>
                                            <tr>
                                                <th>Estado</th>
                                                <th>Cantidad</th>
                                                <th>Porcentaje</th>
                                                <th>Tiempo Promedio</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {reporteConversaciones.porEstado?.map((item, index) => (
                                                <tr key={index}>
                                                    <td>
                                                        <span className={estilos.estadoBadge}>
                                                            {item.estado}
                                                        </span>
                                                    </td>
                                                    <td>{formatearNumero(item.cantidad)}</td>
                                                    <td>{formatearPorcentaje(item.porcentaje)}</td>
                                                    <td>{item.tiempoPromedio}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Otros tipos de reportes */}
                    {filtros.tipoReporte === 'mensajes' && reporteMensajes && (
                        <div className={estilos.reporteSection}>
                            <div className={estilos.sectionHeader}>
                                <h2>
                                    <ion-icon name="mail-outline"></ion-icon>
                                    Análisis de Mensajes
                                </h2>
                            </div>
                            
                            <div className={estilos.statsGrid}>
                                <div className={estilos.statCard}>
                                    <div className={estilos.statContent}>
                                        <div className={estilos.statNumber}>
                                            {formatearNumero(reporteMensajes.totalEnviados)}
                                        </div>
                                        <div className={estilos.statLabel}>Mensajes Enviados</div>
                                    </div>
                                </div>
                                
                                <div className={estilos.statCard}>
                                    <div className={estilos.statContent}>
                                        <div className={estilos.statNumber}>
                                            {formatearNumero(reporteMensajes.totalRecibidos)}
                                        </div>
                                        <div className={estilos.statLabel}>Mensajes Recibidos</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {filtros.tipoReporte === 'contactos' && reporteContactos && (
                        <div className={estilos.reporteSection}>
                            <div className={estilos.sectionHeader}>
                                <h2>
                                    <ion-icon name="people-outline"></ion-icon>
                                    Análisis de Contactos
                                </h2>
                            </div>
                            
                            <div className={estilos.tableCard}>
                                <div className={estilos.tableContent}>
                                    <table className={estilos.dataTable}>
                                        <thead>
                                            <tr>
                                                <th>Origen</th>
                                                <th>Cantidad</th>
                                                <th>Porcentaje</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {reporteContactos.porOrigen?.map((item, index) => (
                                                <tr key={index}>
                                                    <td>{item.origen}</td>
                                                    <td>{formatearNumero(item.cantidad)}</td>
                                                    <td>{formatearPorcentaje(item.porcentaje)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {filtros.tipoReporte === 'plataformas' && reportePlataformas && (
                        <div className={estilos.reporteSection}>
                            <div className={estilos.sectionHeader}>
                                <h2>
                                    <ion-icon name="apps-outline"></ion-icon>
                                    Análisis por Plataforma
                                </h2>
                            </div>
                            
                            <div className={estilos.platformsGrid}>
                                {reportePlataformas.datos?.map((plataforma, index) => (
                                    <div key={index} className={estilos.platformCard}>
                                        <div className={estilos.platformHeader}>
                                            <ion-icon name={
                                                plataforma.nombre === 'whatsapp' ? 'logo-whatsapp' :
                                                plataforma.nombre === 'instagram' ? 'logo-instagram' :
                                                'logo-facebook'
                                            }></ion-icon>
                                            <h3>{plataforma.nombre}</h3>
                                        </div>
                                        <div className={estilos.platformStats}>
                                            <div className={estilos.platformStat}>
                                                <span>Contactos</span>
                                                <strong>{formatearNumero(plataforma.contactos)}</strong>
                                            </div>
                                            <div className={estilos.platformStat}>
                                                <span>Mensajes</span>
                                                <strong>{formatearNumero(plataforma.mensajes)}</strong>
                                            </div>
                                            <div className={estilos.platformStat}>
                                                <span>Conversaciones</span>
                                                <strong>{formatearNumero(plataforma.conversaciones)}</strong>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}