"use client"
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import estilos from "./configuraciones.module.css"
import { 
    obtenerUsuarioActual,
    obtenerConfiguracionesPlataformas,
    actualizarConfiguracionWhatsApp,
    actualizarConfiguracionInstagram,
    actualizarConfiguracionFacebook,
    actualizarConfiguracionGeneral,
    probarConexionPlataforma,
    activarDesactivarPlataforma
} from "./servidor"

export default function ConfiguracionesPage() {
    const router = useRouter()
    const [usuario, setUsuario] = useState(null)
    const [loading, setLoading] = useState(true)
    const [guardando, setGuardando] = useState(false)
    
    // Estados para configuraciones
    const [configuraciones, setConfiguraciones] = useState({
        whatsapp: {
            activa: false,
            phone_number_id: '',
            access_token: '',
            webhook_verify_token: '',
            business_account_id: ''
        },
        instagram: {
            activa: false,
            instagram_business_id: '',
            access_token: '',
            webhook_verify_token: ''
        },
        facebook: {
            activa: false,
            page_id: '',
            page_access_token: '',
            app_id: '',
            app_secret: '',
            webhook_verify_token: ''
        },
        general: {
            zona_horaria: 'America/Mexico_City',
            idioma: 'es',
            auto_asignacion: false,
            notificaciones_email: true,
            respuesta_automatica: false,
            horario_atencion_inicio: '09:00',
            horario_atencion_fin: '18:00'
        }
    })
    
    // Estados para UI
    const [seccionActiva, setSeccionActiva] = useState('whatsapp')
    const [error, setError] = useState('')
    const [mensaje, setMensaje] = useState('')
    const [probandoConexion, setProbandoConexion] = useState('')

    useEffect(() => {
        verificarYCargarDatos()
    }, [])

    const verificarYCargarDatos = async () => {
        try {
            setLoading(true)
            
            const usuarioData = await obtenerUsuarioActual()
            if (!usuarioData) {
                router.push('/login')
                return
            }

            // Solo admins y superadmins pueden acceder a configuraciones
            if (usuarioData.rol === 'usuario') {
                router.push('/dashboard')
                return
            }
            
            setUsuario(usuarioData)
            
            // Cargar configuraciones existentes
            const configData = await obtenerConfiguracionesPlataformas()
            setConfiguraciones(prev => ({
                ...prev,
                ...configData
            }))
            
        } catch (error) {
            console.log('Error al verificar usuario:', error)
            router.push('/login')
        } finally {
            setLoading(false)
        }
    }

    const manejarCambioConfiguracion = (plataforma, campo, valor) => {
        setConfiguraciones(prev => ({
            ...prev,
            [plataforma]: {
                ...prev[plataforma],
                [campo]: valor
            }
        }))
        setError('')
    }

    const guardarConfiguracion = async (plataforma) => {
        setError('')
        setMensaje('')
        setGuardando(true)
        
        try {
            const config = configuraciones[plataforma]
            
            switch (plataforma) {
                case 'whatsapp':
                    await actualizarConfiguracionWhatsApp(config)
                    break
                case 'instagram':
                    await actualizarConfiguracionInstagram(config)
                    break
                case 'facebook':
                    await actualizarConfiguracionFacebook(config)
                    break
                case 'general':
                    await actualizarConfiguracionGeneral(config)
                    break
                default:
                    throw new Error('Plataforma no válida')
            }
            
            setMensaje(`Configuración de ${plataforma} guardada exitosamente`)
            
        } catch (error) {
            setError(error.message || `Error al guardar configuración de ${plataforma}`)
        } finally {
            setGuardando(false)
        }
    }

    const probarConexion = async (plataforma) => {
        setError('')
        setMensaje('')
        setProbandoConexion(plataforma)
        
        try {
            const config = configuraciones[plataforma]
            const resultado = await probarConexionPlataforma(plataforma, config)
            
            if (resultado.exito) {
                setMensaje(`Conexión con ${plataforma} exitosa`)
            } else {
                setError(`Error en conexión con ${plataforma}: ${resultado.mensaje}`)
            }
            
        } catch (error) {
            setError(`Error al probar conexión con ${plataforma}: ${error.message}`)
        } finally {
            setProbandoConexion('')
        }
    }

    const togglePlataforma = async (plataforma) => {
        try {
            const nuevoEstado = !configuraciones[plataforma].activa
            
            await activarDesactivarPlataforma(plataforma, nuevoEstado)
            
            setConfiguraciones(prev => ({
                ...prev,
                [plataforma]: {
                    ...prev[plataforma],
                    activa: nuevoEstado
                }
            }))
            
            setMensaje(`${plataforma} ${nuevoEstado ? 'activada' : 'desactivada'} exitosamente`)
            
        } catch (error) {
            setError(`Error al cambiar estado de ${plataforma}: ${error.message}`)
        }
    }

    if (loading) {
        return (
            <div className={estilos.loadingContainer}>
                <div className={estilos.loadingSpinner}></div>
                <p>Cargando configuraciones...</p>
            </div>
        )
    }

    return (
        <div className={estilos.configuracionesContainer}>
            {/* Header de la página */}
            <div className={estilos.pageHeader}>
                <div className={estilos.pageTitle}>
                    <ion-icon name="settings-outline"></ion-icon>
                    <h1>Configuraciones</h1>
                </div>
            </div>

            {/* Mensajes */}
            {error && (
                <div className={estilos.errorMessage}>
                    <ion-icon name="alert-circle-outline"></ion-icon>
                    {error}
                </div>
            )}

            {mensaje && (
                <div className={estilos.successMessage}>
                    <ion-icon name="checkmark-circle-outline"></ion-icon>
                    {mensaje}
                </div>
            )}

            <div className={estilos.configuracionesGrid}>
                {/* Sidebar */}
                <div className={estilos.sidebar}>
                    <h3>Configuraciones</h3>
                    <nav className={estilos.sidebarNav}>
                        <button 
                            className={`${estilos.navItem} ${seccionActiva === 'whatsapp' ? estilos.activo : ''}`}
                            onClick={() => setSeccionActiva('whatsapp')}
                        >
                            <ion-icon name="logo-whatsapp"></ion-icon>
                            WhatsApp
                            <span className={`${estilos.statusBadge} ${configuraciones.whatsapp.activa ? estilos.activo : estilos.inactivo}`}>
                                {configuraciones.whatsapp.activa ? 'Activo' : 'Inactivo'}
                            </span>
                        </button>
                        
                        <button 
                            className={`${estilos.navItem} ${seccionActiva === 'instagram' ? estilos.activo : ''}`}
                            onClick={() => setSeccionActiva('instagram')}
                        >
                            <ion-icon name="logo-instagram"></ion-icon>
                            Instagram
                            <span className={`${estilos.statusBadge} ${configuraciones.instagram.activa ? estilos.activo : estilos.inactivo}`}>
                                {configuraciones.instagram.activa ? 'Activo' : 'Inactivo'}
                            </span>
                        </button>
                        
                        <button 
                            className={`${estilos.navItem} ${seccionActiva === 'facebook' ? estilos.activo : ''}`}
                            onClick={() => setSeccionActiva('facebook')}
                        >
                            <ion-icon name="logo-facebook"></ion-icon>
                            Facebook
                            <span className={`${estilos.statusBadge} ${configuraciones.facebook.activa ? estilos.activo : estilos.inactivo}`}>
                                {configuraciones.facebook.activa ? 'Activo' : 'Inactivo'}
                            </span>
                        </button>
                        
                        <button 
                            className={`${estilos.navItem} ${seccionActiva === 'general' ? estilos.activo : ''}`}
                            onClick={() => setSeccionActiva('general')}
                        >
                            <ion-icon name="cog-outline"></ion-icon>
                            General
                        </button>
                    </nav>
                </div>

                {/* Contenido Principal */}
                <div className={estilos.mainContent}>
                    {/* Configuración WhatsApp */}
                    {seccionActiva === 'whatsapp' && (
                        <div className={estilos.configSection}>
                            <div className={estilos.sectionHeader}>
                                <div className={estilos.sectionTitle}>
                                    <ion-icon name="logo-whatsapp"></ion-icon>
                                    <h2>Configuración de WhatsApp</h2>
                                </div>
                                <div className={estilos.sectionActions}>
                                    <button 
                                        className={`${estilos.toggleBtn} ${configuraciones.whatsapp.activa ? estilos.activo : ''}`}
                                        onClick={() => togglePlataforma('whatsapp')}
                                    >
                                        {configuraciones.whatsapp.activa ? 'Desactivar' : 'Activar'}
                                    </button>
                                </div>
                            </div>

                            <form onSubmit={(e) => { e.preventDefault(); guardarConfiguracion('whatsapp'); }} className={estilos.configForm}>
                                <div className={estilos.formGroup}>
                                    <label>Phone Number ID *</label>
                                    <input
                                        type="text"
                                        value={configuraciones.whatsapp.phone_number_id}
                                        onChange={(e) => manejarCambioConfiguracion('whatsapp', 'phone_number_id', e.target.value)}
                                        placeholder="Ej: 123456789012345"
                                        required
                                    />
                                </div>

                                <div className={estilos.formGroup}>
                                    <label>Access Token *</label>
                                    <input
                                        type="password"
                                        value={configuraciones.whatsapp.access_token}
                                        onChange={(e) => manejarCambioConfiguracion('whatsapp', 'access_token', e.target.value)}
                                        placeholder="Token de acceso de WhatsApp Business API"
                                        required
                                    />
                                </div>

                                <div className={estilos.formGroup}>
                                    <label>Webhook Verify Token *</label>
                                    <input
                                        type="text"
                                        value={configuraciones.whatsapp.webhook_verify_token}
                                        onChange={(e) => manejarCambioConfiguracion('whatsapp', 'webhook_verify_token', e.target.value)}
                                        placeholder="Token de verificación del webhook"
                                        required
                                    />
                                </div>

                                <div className={estilos.formGroup}>
                                    <label>Business Account ID</label>
                                    <input
                                        type="text"
                                        value={configuraciones.whatsapp.business_account_id}
                                        onChange={(e) => manejarCambioConfiguracion('whatsapp', 'business_account_id', e.target.value)}
                                        placeholder="ID de la cuenta de negocio"
                                    />
                                </div>

                                <div className={estilos.formActions}>
                                    <button 
                                        type="button"
                                        onClick={() => probarConexion('whatsapp')}
                                        disabled={probandoConexion === 'whatsapp'}
                                        className={estilos.botonSecundario}
                                    >
                                        <ion-icon name="flash-outline"></ion-icon>
                                        {probandoConexion === 'whatsapp' ? 'Probando...' : 'Probar Conexión'}
                                    </button>
                                    <button 
                                        type="submit"
                                        disabled={guardando}
                                        className={estilos.botonPrimario}
                                    >
                                        {guardando ? 'Guardando...' : 'Guardar Configuración'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* Configuración Instagram */}
                    {seccionActiva === 'instagram' && (
                        <div className={estilos.configSection}>
                            <div className={estilos.sectionHeader}>
                                <div className={estilos.sectionTitle}>
                                    <ion-icon name="logo-instagram"></ion-icon>
                                    <h2>Configuración de Instagram</h2>
                                </div>
                                <div className={estilos.sectionActions}>
                                    <button 
                                        className={`${estilos.toggleBtn} ${configuraciones.instagram.activa ? estilos.activo : ''}`}
                                        onClick={() => togglePlataforma('instagram')}
                                    >
                                        {configuraciones.instagram.activa ? 'Desactivar' : 'Activar'}
                                    </button>
                                </div>
                            </div>

                            <form onSubmit={(e) => { e.preventDefault(); guardarConfiguracion('instagram'); }} className={estilos.configForm}>
                                <div className={estilos.formGroup}>
                                    <label>Instagram Business ID *</label>
                                    <input
                                        type="text"
                                        value={configuraciones.instagram.instagram_business_id}
                                        onChange={(e) => manejarCambioConfiguracion('instagram', 'instagram_business_id', e.target.value)}
                                        placeholder="ID de la cuenta de Instagram Business"
                                        required
                                    />
                                </div>

                                <div className={estilos.formGroup}>
                                    <label>Access Token *</label>
                                    <input
                                        type="password"
                                        value={configuraciones.instagram.access_token}
                                        onChange={(e) => manejarCambioConfiguracion('instagram', 'access_token', e.target.value)}
                                        placeholder="Token de acceso de Instagram Graph API"
                                        required
                                    />
                                </div>

                                <div className={estilos.formGroup}>
                                    <label>Webhook Verify Token *</label>
                                    <input
                                        type="text"
                                        value={configuraciones.instagram.webhook_verify_token}
                                        onChange={(e) => manejarCambioConfiguracion('instagram', 'webhook_verify_token', e.target.value)}
                                        placeholder="Token de verificación del webhook"
                                        required
                                    />
                                </div>

                                <div className={estilos.formActions}>
                                    <button 
                                        type="button"
                                        onClick={() => probarConexion('instagram')}
                                        disabled={probandoConexion === 'instagram'}
                                        className={estilos.botonSecundario}
                                    >
                                        <ion-icon name="flash-outline"></ion-icon>
                                        {probandoConexion === 'instagram' ? 'Probando...' : 'Probar Conexión'}
                                    </button>
                                    <button 
                                        type="submit"
                                        disabled={guardando}
                                        className={estilos.botonPrimario}
                                    >
                                        {guardando ? 'Guardando...' : 'Guardar Configuración'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* Configuración Facebook */}
                    {seccionActiva === 'facebook' && (
                        <div className={estilos.configSection}>
                            <div className={estilos.sectionHeader}>
                                <div className={estilos.sectionTitle}>
                                    <ion-icon name="logo-facebook"></ion-icon>
                                    <h2>Configuración de Facebook</h2>
                                </div>
                                <div className={estilos.sectionActions}>
                                    <button 
                                        className={`${estilos.toggleBtn} ${configuraciones.facebook.activa ? estilos.activo : ''}`}
                                        onClick={() => togglePlataforma('facebook')}
                                    >
                                        {configuraciones.facebook.activa ? 'Desactivar' : 'Activar'}
                                    </button>
                                </div>
                            </div>

                            <form onSubmit={(e) => { e.preventDefault(); guardarConfiguracion('facebook'); }} className={estilos.configForm}>
                                <div className={estilos.formRow}>
                                    <div className={estilos.formGroup}>
                                        <label>Page ID *</label>
                                        <input
                                            type="text"
                                            value={configuraciones.facebook.page_id}
                                            onChange={(e) => manejarCambioConfiguracion('facebook', 'page_id', e.target.value)}
                                            placeholder="ID de la página de Facebook"
                                            required
                                        />
                                    </div>
                                    <div className={estilos.formGroup}>
                                        <label>App ID *</label>
                                        <input
                                            type="text"
                                            value={configuraciones.facebook.app_id}
                                            onChange={(e) => manejarCambioConfiguracion('facebook', 'app_id', e.target.value)}
                                            placeholder="ID de la aplicación de Facebook"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className={estilos.formGroup}>
                                    <label>Page Access Token *</label>
                                    <input
                                        type="password"
                                        value={configuraciones.facebook.page_access_token}
                                        onChange={(e) => manejarCambioConfiguracion('facebook', 'page_access_token', e.target.value)}
                                        placeholder="Token de acceso de la página"
                                        required
                                    />
                                </div>

                                <div className={estilos.formGroup}>
                                    <label>App Secret *</label>
                                    <input
                                        type="password"
                                        value={configuraciones.facebook.app_secret}
                                        onChange={(e) => manejarCambioConfiguracion('facebook', 'app_secret', e.target.value)}
                                        placeholder="Secreto de la aplicación"
                                        required
                                    />
                                </div>

                                <div className={estilos.formGroup}>
                                    <label>Webhook Verify Token *</label>
                                    <input
                                        type="text"
                                        value={configuraciones.facebook.webhook_verify_token}
                                        onChange={(e) => manejarCambioConfiguracion('facebook', 'webhook_verify_token', e.target.value)}
                                        placeholder="Token de verificación del webhook"
                                        required
                                    />
                                </div>

                                <div className={estilos.formActions}>
                                    <button 
                                        type="button"
                                        onClick={() => probarConexion('facebook')}
                                        disabled={probandoConexion === 'facebook'}
                                        className={estilos.botonSecundario}
                                    >
                                        <ion-icon name="flash-outline"></ion-icon>
                                        {probandoConexion === 'facebook' ? 'Probando...' : 'Probar Conexión'}
                                    </button>
                                    <button 
                                        type="submit"
                                        disabled={guardando}
                                        className={estilos.botonPrimario}
                                    >
                                        {guardando ? 'Guardando...' : 'Guardar Configuración'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* Configuración General */}
                    {seccionActiva === 'general' && (
                        <div className={estilos.configSection}>
                            <div className={estilos.sectionHeader}>
                                <div className={estilos.sectionTitle}>
                                    <ion-icon name="cog-outline"></ion-icon>
                                    <h2>Configuración General</h2>
                                </div>
                            </div>

                            <form onSubmit={(e) => { e.preventDefault(); guardarConfiguracion('general'); }} className={estilos.configForm}>
                                <div className={estilos.formRow}>
                                    <div className={estilos.formGroup}>
                                        <label>Zona Horaria</label>
                                        <select
                                            value={configuraciones.general.zona_horaria}
                                            onChange={(e) => manejarCambioConfiguracion('general', 'zona_horaria', e.target.value)}
                                        >
                                            <option value="America/Mexico_City">México (GMT-6)</option>
                                            <option value="America/Los_Angeles">Los Angeles (GMT-8)</option>
                                            <option value="America/New_York">Nueva York (GMT-5)</option>
                                            <option value="Europe/Madrid">Madrid (GMT+1)</option>
                                        </select>
                                    </div>
                                    <div className={estilos.formGroup}>
                                        <label>Idioma</label>
                                        <select
                                            value={configuraciones.general.idioma}
                                            onChange={(e) => manejarCambioConfiguracion('general', 'idioma', e.target.value)}
                                        >
                                            <option value="es">Español</option>
                                            <option value="en">English</option>
                                            <option value="pt">Português</option>
                                        </select>
                                    </div>
                                </div>

                                <div className={estilos.formRow}>
                                    <div className={estilos.formGroup}>
                                        <label>Horario de Atención - Inicio</label>
                                        <input
                                            type="time"
                                            value={configuraciones.general.horario_atencion_inicio}
                                            onChange={(e) => manejarCambioConfiguracion('general', 'horario_atencion_inicio', e.target.value)}
                                        />
                                    </div>
                                    <div className={estilos.formGroup}>
                                        <label>Horario de Atención - Fin</label>
                                        <input
                                            type="time"
                                            value={configuraciones.general.horario_atencion_fin}
                                            onChange={(e) => manejarCambioConfiguracion('general', 'horario_atencion_fin', e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className={estilos.toggleSection}>
                                    <div className={estilos.toggleItem}>
                                        <div className={estilos.toggleInfo}>
                                            <label>Auto-asignación de conversaciones</label>
                                            <span>Asignar automáticamente nuevas conversaciones a agentes disponibles</span>
                                        </div>
                                        <button
                                            type="button"
                                            className={`${estilos.toggle} ${configuraciones.general.auto_asignacion ? estilos.activo : ''}`}
                                            onClick={() => manejarCambioConfiguracion('general', 'auto_asignacion', !configuraciones.general.auto_asignacion)}
                                        >
                                            <span className={estilos.toggleSlider}></span>
                                        </button>
                                    </div>

                                    <div className={estilos.toggleItem}>
                                        <div className={estilos.toggleInfo}>
                                            <label>Notificaciones por email</label>
                                            <span>Enviar notificaciones por correo electrónico</span>
                                        </div>
                                        <button
                                            type="button"
                                            className={`${estilos.toggle} ${configuraciones.general.notificaciones_email ? estilos.activo : ''}`}
                                            onClick={() => manejarCambioConfiguracion('general', 'notificaciones_email', !configuraciones.general.notificaciones_email)}
                                        >
                                            <span className={estilos.toggleSlider}></span>
                                        </button>
                                    </div>

                                    <div className={estilos.toggleItem}>
                                        <div className={estilos.toggleInfo}>
                                            <label>Respuestas automáticas</label>
                                            <span>Enviar respuestas automáticas fuera del horario de atención</span>
                                        </div>
                                        <button
                                            type="button"
                                            className={`${estilos.toggle} ${configuraciones.general.respuesta_automatica ? estilos.activo : ''}`}
                                            onClick={() => manejarCambioConfiguracion('general', 'respuesta_automatica', !configuraciones.general.respuesta_automatica)}
                                        >
                                            <span className={estilos.toggleSlider}></span>
                                        </button>
                                    </div>
                                </div>

                                <div className={estilos.formActions}>
                                    <button 
                                        type="submit"
                                        disabled={guardando}
                                        className={estilos.botonPrimario}
                                    >
                                        {guardando ? 'Guardando...' : 'Guardar Configuración'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}