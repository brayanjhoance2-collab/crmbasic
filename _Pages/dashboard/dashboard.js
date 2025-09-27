"use client"
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import estilos from "./dashboard.module.css"
import { 
    obtenerUsuarioActual, 
    obtenerEstadisticasDashboard, 
    obtenerConversacionesActivas,
    obtenerMetricasPorPlataforma,
    exportarEstadisticasExcel
} from "./servidor"

export default function DashboardPage() {
    const router = useRouter()
    const [usuario, setUsuario] = useState(null)
    const [estadisticas, setEstadisticas] = useState(null)
    const [conversacionesActivas, setConversacionesActivas] = useState([])
    const [metricasPorPlataforma, setMetricasPorPlataforma] = useState([])
    const [loading, setLoading] = useState(true)
    const [loadingData, setLoadingData] = useState(false)
    const [exportando, setExportando] = useState(false)

    useEffect(() => {
        verificarYCargarDatos()
    }, [])

    const verificarYCargarDatos = async () => {
        try {
            setLoading(true)
            
            // Verificar autenticación
            const usuarioData = await obtenerUsuarioActual()
            if (!usuarioData) {
                router.push('/login')
                return
            }
            
            setUsuario(usuarioData)
            
            // Cargar datos del dashboard
            await cargarDatosDashboard()
            
        } catch (error) {
            console.log('Error al verificar usuario:', error)
            router.push('/login')
        } finally {
            setLoading(false)
        }
    }

    const cargarDatosDashboard = async () => {
        try {
            setLoadingData(true)
            
            const [
                statsResponse,
                conversacionesResponse,
                metricsResponse
            ] = await Promise.all([
                obtenerEstadisticasDashboard(),
                obtenerConversacionesActivas(),
                obtenerMetricasPorPlataforma(7)
            ])
            
            setEstadisticas(statsResponse)
            setConversacionesActivas(conversacionesResponse.slice(0, 8))
            setMetricasPorPlataforma(metricsResponse)
            
        } catch (error) {
            console.log('Error al cargar datos del dashboard:', error)
        } finally {
            setLoadingData(false)
        }
    }

    const manejarExportarExcel = async () => {
        try {
            setExportando(true)
            await exportarEstadisticasExcel()
        } catch (error) {
            console.log('Error al exportar Excel:', error)
        } finally {
            setExportando(false)
        }
    }

    const formatearFecha = (fecha) => {
        return new Intl.DateTimeFormat('es-ES', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(new Date(fecha))
    }

    const formatearTiempo = (segundos) => {
        if (!segundos) return 'N/A'
        if (segundos < 60) return `${Math.round(segundos)}s`
        if (segundos < 3600) return `${Math.round(segundos / 60)}min`
        return `${Math.round(segundos / 3600)}h`
    }

    const obtenerIconoPorPlataforma = (plataforma) => {
        switch(plataforma) {
            case 'whatsapp': return 'logo-whatsapp'
            case 'instagram': return 'logo-instagram'
            case 'facebook': return 'logo-facebook'
            default: return 'chatbubble-outline'
        }
    }

    if (loading) {
        return (
            <div className={estilos.loadingContainer}>
                <div className={estilos.loadingSpinner}></div>
                <p>Cargando dashboard...</p>
            </div>
        )
    }

    return (
        <div className={estilos.dashboardContainer}>
            {/* Header Simplificado */}
            <div className={estilos.welcomeSection}>
                <div className={estilos.welcomeActions}>
                    <button 
                        className={estilos.actionButton} 
                        onClick={manejarExportarExcel}
                        disabled={exportando}
                    >
                        <ion-icon name="download-outline"></ion-icon>
                        {exportando ? 'Exportando...' : 'Exportar Excel'}
                    </button>
                    <button className={estilos.actionButton} onClick={cargarDatosDashboard}>
                        <ion-icon name="refresh-outline"></ion-icon>
                        Actualizar
                    </button>
                </div>
            </div>

            {/* Estadísticas Principales */}
            <div className={estilos.statsGrid}>
                <div className={estilos.statCard}>
                    <div className={estilos.statIcon}>
                        <ion-icon name="people-outline"></ion-icon>
                    </div>
                    <div className={estilos.statContent}>
                        <h3 className={estilos.statNumber}>
                            {estadisticas?.contactos?.total_contactos || 0}
                        </h3>
                        <p className={estilos.statLabel}>Total Contactos</p>
                        <div className={estilos.statDetails}>
                            <span className={estilos.statDetail}>
                                <ion-icon name="add-circle-outline"></ion-icon>
                                {estadisticas?.contactos?.contactos_nuevos || 0} nuevos
                            </span>
                        </div>
                    </div>
                </div>

                <div className={estilos.statCard}>
                    <div className={estilos.statIcon}>
                        <ion-icon name="chatbubbles-outline"></ion-icon>
                    </div>
                    <div className={estilos.statContent}>
                        <h3 className={estilos.statNumber}>
                            {estadisticas?.conversaciones?.total_conversaciones || 0}
                        </h3>
                        <p className={estilos.statLabel}>Conversaciones</p>
                        <div className={estilos.statDetails}>
                            <span className={estilos.statDetail}>
                                <ion-icon name="radio-button-on-outline"></ion-icon>
                                {estadisticas?.conversaciones?.conversaciones_abiertas || 0} abiertas
                            </span>
                        </div>
                    </div>
                </div>

                <div className={estilos.statCard}>
                    <div className={estilos.statIcon}>
                        <ion-icon name="mail-outline"></ion-icon>
                    </div>
                    <div className={estilos.statContent}>
                        <h3 className={estilos.statNumber}>
                            {estadisticas?.mensajes?.total_mensajes || 0}
                        </h3>
                        <p className={estilos.statLabel}>Mensajes</p>
                        <div className={estilos.statDetails}>
                            <span className={estilos.statDetail}>
                                <ion-icon name="today-outline"></ion-icon>
                                {estadisticas?.mensajes?.mensajes_hoy || 0} hoy
                            </span>
                        </div>
                    </div>
                </div>

                <div className={estilos.statCard}>
                    <div className={estilos.statIcon}>
                        <ion-icon name="trophy-outline"></ion-icon>
                    </div>
                    <div className={estilos.statContent}>
                        <h3 className={estilos.statNumber}>
                            {estadisticas?.contactos?.clientes_convertidos || 0}
                        </h3>
                        <p className={estilos.statLabel}>Convertidos</p>
                        <div className={estilos.statDetails}>
                            <span className={estilos.statDetail}>
                                <ion-icon name="trending-up-outline"></ion-icon>
                                Clientes
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Métricas por Plataforma */}
            <div className={estilos.metricsSection}>
                <h2 className={estilos.sectionTitle}>Actividad por Plataforma</h2>
                <div className={estilos.platformCards}>
                    {metricasPorPlataforma.length > 0 ? metricasPorPlataforma.map((metrica, index) => (
                        <div key={index} className={estilos.platformCard}>
                            <div className={estilos.platformHeader}>
                                <div className={estilos.platformIcon}>
                                    <ion-icon name={obtenerIconoPorPlataforma(metrica.plataforma)}></ion-icon>
                                </div>
                                <h3 className={estilos.platformName}>
                                    {metrica.plataforma.charAt(0).toUpperCase() + metrica.plataforma.slice(1)}
                                </h3>
                            </div>
                            <div className={estilos.platformStats}>
                                <div className={estilos.platformStat}>
                                    <span className={estilos.platformStatNumber}>{metrica.total_conversaciones}</span>
                                    <span className={estilos.platformStatLabel}>Conversaciones</span>
                                </div>
                                <div className={estilos.platformStat}>
                                    <span className={estilos.platformStatNumber}>{metrica.total_mensajes}</span>
                                    <span className={estilos.platformStatLabel}>Mensajes</span>
                                </div>
                                <div className={estilos.platformStat}>
                                    <span className={estilos.platformStatNumber}>
                                        {formatearTiempo(metrica.tiempo_respuesta_promedio)}
                                    </span>
                                    <span className={estilos.platformStatLabel}>T. Respuesta</span>
                                </div>
                            </div>
                        </div>
                    )) : (
                        <div className={estilos.emptyState}>
                            <ion-icon name="analytics-outline"></ion-icon>
                            <p>No hay métricas disponibles</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Conversaciones Activas - Pantalla Completa */}
            <div className={estilos.conversationsSection}>
                <div className={estilos.contentCard}>
                    <div className={estilos.cardHeader}>
                        <h2 className={estilos.cardTitle}>
                            <ion-icon name="chatbubbles-outline"></ion-icon>
                            Conversaciones Activas
                        </h2>
                        <button className={estilos.viewAllButton}>
                            Ver todas
                            <ion-icon name="chevron-forward-outline"></ion-icon>
                        </button>
                    </div>
                    <div className={estilos.cardContent}>
                        {loadingData ? (
                            <div className={estilos.cardLoading}>
                                <div className={estilos.loadingSpinner}></div>
                            </div>
                        ) : conversacionesActivas.length > 0 ? (
                            <div className={estilos.conversationsList}>
                                {conversacionesActivas.map((conv) => (
                                    <div key={conv.id} className={estilos.conversationItem}>
                                        <div className={estilos.conversationAvatar}>
                                            {conv.foto_perfil_url ? (
                                                <img src={conv.foto_perfil_url} alt="Avatar" />
                                            ) : (
                                                <ion-icon name="person-outline"></ion-icon>
                                            )}
                                            <div className={estilos.conversationPlatform}>
                                                <ion-icon name={obtenerIconoPorPlataforma(conv.plataforma)}></ion-icon>
                                            </div>
                                        </div>
                                        <div className={estilos.conversationInfo}>
                                            <h4 className={estilos.conversationName}>
                                                {conv.contacto_nombre || 'Sin nombre'}
                                            </h4>
                                            <p className={estilos.conversationMessage}>
                                                {conv.ultimo_mensaje || 'Sin mensajes'}
                                            </p>
                                            <span className={estilos.conversationTime}>
                                                {conv.fecha_ultimo_mensaje ? formatearFecha(conv.fecha_ultimo_mensaje) : 'N/A'}
                                            </span>
                                        </div>
                                        <div className={estilos.conversationStatus}>
                                            <span className={`${estilos.statusBadge} ${estilos[conv.estado]}`}>
                                                {conv.estado}
                                            </span>
                                            <div className={estilos.conversationActions}>
                                                <button className={estilos.actionBtn}>
                                                    <ion-icon name="chatbubble-outline"></ion-icon>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className={estilos.emptyState}>
                                <ion-icon name="chatbubbles-outline"></ion-icon>
                                <p>No hay conversaciones activas</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}