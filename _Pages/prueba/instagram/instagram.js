"use client"
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import estilos from "./instagram.module.css"
import { 
    obtenerUsuarioActual,
    obtenerConfiguracionInstagram,
    crearConfiguracionInstagram,
    actualizarConfiguracionInstagram,
    eliminarConfiguracionInstagram,
    probarConexionInstagram,
    obtenerBusinessAccounts,
    verificarWebhookInstagram,
    obtenerMetricasInstagram
} from "./servidor"

export default function ConfiguracionInstagramPage() {
    const router = useRouter()
    const [usuario, setUsuario] = useState(null)
    const [loading, setLoading] = useState(true)
    const [configuracion, setConfiguracion] = useState(null)
    const [businessAccounts, setBusinessAccounts] = useState([])
    const [metricas, setMetricas] = useState(null)
    
    // Estados del modal
    const [modalAbierto, setModalAbierto] = useState(false)
    const [tipoModal, setTipoModal] = useState('')
    const [guardando, setGuardando] = useState(false)
    const [probandoConexion, setProbandoConexion] = useState(false)
    const [mensajeError, setMensajeError] = useState('')
    const [mensajeExito, setMensajeExito] = useState('')
    
    // Estados del formulario
    const [formulario, setFormulario] = useState({
        nombre_configuracion: '',
        access_token: '',
        instagram_business_id: '',
        webhook_verify_token: ''
    })

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
            
            if (usuarioData.rol === 'usuario') {
                router.push('/dashboard')
                return
            }
            
            setUsuario(usuarioData)
            await cargarConfiguracion()
            
        } catch (error) {
            console.log('Error al verificar usuario:', error)
            router.push('/login')
        } finally {
            setLoading(false)
        }
    }

    const cargarConfiguracion = async () => {
        try {
            const config = await obtenerConfiguracionInstagram()
            setConfiguracion(config)
            
            if (config) {
                await cargarBusinessAccounts(config.access_token)
                await cargarMetricas()
            }
        } catch (error) {
            console.log('Error al cargar configuración:', error)
            setMensajeError('Error al cargar configuración de Instagram')
        }
    }

    const cargarBusinessAccounts = async (token) => {
        try {
            const accounts = await obtenerBusinessAccounts(token)
            setBusinessAccounts(accounts)
        } catch (error) {
            console.log('Error al cargar business accounts:', error)
        }
    }

    const cargarMetricas = async () => {
        try {
            const metricas = await obtenerMetricasInstagram()
            setMetricas(metricas)
        } catch (error) {
            console.log('Error al cargar métricas:', error)
        }
    }

    const abrirModal = (tipo) => {
        setTipoModal(tipo)
        setMensajeError('')
        setMensajeExito('')
        
        if (tipo === 'editar' && configuracion) {
            setFormulario({
                nombre_configuracion: configuracion.nombre_configuracion || '',
                access_token: configuracion.access_token || '',
                instagram_business_id: configuracion.instagram_business_id || '',
                webhook_verify_token: configuracion.webhook_verify_token || ''
            })
        } else {
            limpiarFormulario()
        }
        
        setModalAbierto(true)
    }

    const cerrarModal = () => {
        setModalAbierto(false)
        setTipoModal('')
        setMensajeError('')
        setMensajeExito('')
        limpiarFormulario()
    }

    const limpiarFormulario = () => {
        setFormulario({
            nombre_configuracion: '',
            access_token: '',
            instagram_business_id: '',
            webhook_verify_token: ''
        })
    }

    const manejarCambioFormulario = (campo, valor) => {
        setFormulario(prev => ({
            ...prev,
            [campo]: valor
        }))
        
        // Si cambia el token, cargar business accounts
        if (campo === 'access_token' && valor.length > 50) {
            cargarBusinessAccounts(valor)
        }
    }

    const manejarGuardar = async (e) => {
        e.preventDefault()
        
        try {
            setGuardando(true)
            setMensajeError('')
            
if (!formulario.nombre_configuracion || !formulario.access_token) {
    setMensajeError('Nombre y token de acceso son obligatorios')
    return
}
            
            let resultado
            if (tipoModal === 'nueva') {
                resultado = await crearConfiguracionInstagram(formulario)
            } else {
                resultado = await actualizarConfiguracionInstagram(formulario)
            }
            
            if (resultado.success) {
                setMensajeExito(resultado.message)
                await cargarConfiguracion()
                setTimeout(() => {
                    cerrarModal()
                }, 1500)
            } else {
                setMensajeError(resultado.message || 'Error al guardar configuración')
            }
            
        } catch (error) {
            console.log('Error al guardar:', error)
            setMensajeError(error.message || 'Error al guardar configuración')
        } finally {
            setGuardando(false)
        }
    }

    const manejarProbarConexion = async () => {
        try {
            setProbandoConexion(true)
            const resultado = await probarConexionInstagram()
            
            if (resultado.success) {
                setMensajeExito('Conexión exitosa con Instagram')
                await cargarMetricas()
            } else {
                setMensajeError(resultado.message || 'Error en la conexión')
            }
            
        } catch (error) {
            console.log('Error al probar conexión:', error)
            setMensajeError('Error al probar la conexión')
        } finally {
            setProbandoConexion(false)
        }
    }

    const manejarEliminar = async () => {
        if (!window.confirm('¿Estás seguro de que quieres eliminar la configuración de Instagram?')) {
            return
        }
        
        try {
            const resultado = await eliminarConfiguracionInstagram()
            if (resultado.success) {
                setMensajeExito('Configuración eliminada exitosamente')
                await cargarConfiguracion()
            } else {
                setMensajeError(resultado.message || 'Error al eliminar')
            }
        } catch (error) {
            console.log('Error al eliminar:', error)
            setMensajeError('Error al eliminar configuración')
        }
    }

    const manejarVerificarWebhook = async () => {
        try {
            const resultado = await verificarWebhookInstagram()
            if (resultado.success) {
                setMensajeExito('Webhook verificado correctamente')
            } else {
                setMensajeError(resultado.message || 'Error en verificación de webhook')
            }
        } catch (error) {
            console.log('Error verificando webhook:', error)
            setMensajeError('Error al verificar webhook')
        }
    }

    if (loading) {
        return (
            <div className={estilos.loadingContainer}>
                <div className={estilos.loadingSpinner}></div>
                <p>Cargando configuración de Instagram...</p>
            </div>
        )
    }

    return (
        <div className={estilos.configuracionContainer}>
            {/* Header */}
            <div className={estilos.header}>
                <div className={estilos.headerTitulo}>
                    <ion-icon name="logo-instagram"></ion-icon>
                    <div>
                        <h1>Configuración de Instagram</h1>
                        <p>Gestiona tu integración con Instagram Business</p>
                    </div>
                </div>
                
                {!configuracion && (
                    <button 
                        className={estilos.botonNueva}
                        onClick={() => abrirModal('nueva')}
                    >
                        <ion-icon name="add-outline"></ion-icon>
                        Nueva configuración
                    </button>
                )}
            </div>

            {/* Mensajes globales */}
            {mensajeError && !modalAbierto && (
                <div className={estilos.mensajeError}>
                    <ion-icon name="alert-circle-outline"></ion-icon>
                    {mensajeError}
                    <button onClick={() => setMensajeError('')}>
                        <ion-icon name="close-outline"></ion-icon>
                    </button>
                </div>
            )}

            {mensajeExito && !modalAbierto && (
                <div className={estilos.mensajeExito}>
                    <ion-icon name="checkmark-circle-outline"></ion-icon>
                    {mensajeExito}
                    <button onClick={() => setMensajeExito('')}>
                        <ion-icon name="close-outline"></ion-icon>
                    </button>
                </div>
            )}

            {/* Contenido principal */}
            {configuracion ? (
                <div className={estilos.contenidoPrincipal}>
                    {/* Card de configuración */}
                    <div className={estilos.configuracionCard}>
                        <div className={estilos.cardHeader}>
                            <div className={estilos.cardTitulo}>
                                <ion-icon name="logo-instagram"></ion-icon>
                                <div>
                                    <h3>{configuracion.nombre_configuracion}</h3>
                                    <span className={estilos.estadoBadge}>
                                        <ion-icon name="checkmark-circle"></ion-icon>
                                        Configurado
                                    </span>
                                </div>
                            </div>
                            
                            <div className={estilos.cardAcciones}>
                                <button
                                    className={estilos.botonProbar}
                                    onClick={manejarProbarConexion}
                                    disabled={probandoConexion}
                                >
                                    <ion-icon name="flash-outline"></ion-icon>
                                    {probandoConexion ? 'Probando...' : 'Probar'}
                                </button>
                                
                                <button
                                    className={estilos.botonEditar}
                                    onClick={() => abrirModal('editar')}
                                >
                                    <ion-icon name="create-outline"></ion-icon>
                                    Editar
                                </button>
                                
                                <button
                                    className={estilos.botonEliminar}
                                    onClick={manejarEliminar}
                                >
                                    <ion-icon name="trash-outline"></ion-icon>
                                    Eliminar
                                </button>
                            </div>
                        </div>
                        
                        <div className={estilos.cardContent}>
                            <div className={estilos.infoGrid}>
                                <div className={estilos.infoItem}>
                                    <span className={estilos.infoLabel}>Business Account ID</span>
                                    <span className={estilos.infoValue}>{configuracion.instagram_business_id}</span>
                                </div>
                                
                                <div className={estilos.infoItem}>
                                    <span className={estilos.infoLabel}>Token configurado</span>
                                    <span className={estilos.infoValue}>
                                        {configuracion.access_token ? 'Sí' : 'No'}
                                    </span>
                                </div>
                                
                                <div className={estilos.infoItem}>
                                    <span className={estilos.infoLabel}>Webhook</span>
                                    <span className={estilos.infoValue}>
                                        {configuracion.webhook_verify_token ? 'Configurado' : 'No configurado'}
                                    </span>
                                </div>
                                
                                <div className={estilos.infoItem}>
                                    <span className={estilos.infoLabel}>Fecha de creación</span>
                                    <span className={estilos.infoValue}>
                                        {new Date(configuracion.fecha_creacion).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Business Accounts */}
                    {businessAccounts.length > 0 && (
                        <div className={estilos.businessAccountsCard}>
                            <h3>Cuentas Business Detectadas</h3>
                            <div className={estilos.accountsGrid}>
                                {businessAccounts.map(account => (
                                    <div key={account.id} className={estilos.accountItem}>
                                        <div className={estilos.accountInfo}>
                                            <strong>{account.name}</strong>
                                            <span>@{account.username}</span>
                                            <span>ID: {account.id}</span>
                                        </div>
                                        {account.id === configuracion.instagram_business_id && (
                                            <span className={estilos.accountActiva}>
                                                <ion-icon name="checkmark-circle"></ion-icon>
                                                En uso
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Métricas */}
                    {metricas && (
                        <div className={estilos.metricasCard}>
                            <h3>Métricas de Instagram</h3>
                            <div className={estilos.metricasGrid}>
                                <div className={estilos.metricaItem}>
                                    <ion-icon name="chatbubble-outline"></ion-icon>
                                    <div>
                                        <span className={estilos.metricaNumero}>{metricas.mensajes_recibidos}</span>
                                        <span className={estilos.metricaLabel}>Mensajes recibidos</span>
                                    </div>
                                </div>
                                
                                <div className={estilos.metricaItem}>
                                    <ion-icon name="send-outline"></ion-icon>
                                    <div>
                                        <span className={estilos.metricaNumero}>{metricas.mensajes_enviados}</span>
                                        <span className={estilos.metricaLabel}>Mensajes enviados</span>
                                    </div>
                                </div>
                                
                                <div className={estilos.metricaItem}>
                                    <ion-icon name="people-outline"></ion-icon>
                                    <div>
                                        <span className={estilos.metricaNumero}>{metricas.conversaciones_nuevas}</span>
                                        <span className={estilos.metricaLabel}>Conversaciones nuevas</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Información del webhook */}
                    <div className={estilos.webhookCard}>
                        <div className={estilos.webhookHeader}>
                            <h3>Configuración de Webhook</h3>
                            <button
                                className={estilos.botonVerificar}
                                onClick={manejarVerificarWebhook}
                            >
                                <ion-icon name="shield-checkmark-outline"></ion-icon>
                                Verificar webhook
                            </button>
                        </div>
                        
                        <div className={estilos.webhookInfo}>
                            <div className={estilos.webhookItem}>
                                <span className={estilos.webhookLabel}>URL del webhook:</span>
                                <code className={estilos.webhookValue}>
                                    {window.location.origin}/api/webhooks/instagram
                                </code>
                            </div>
                            
                            <div className={estilos.webhookItem}>
                                <span className={estilos.webhookLabel}>Token de verificación:</span>
                                <code className={estilos.webhookValue}>
                                    {configuracion.webhook_verify_token || 'No configurado'}
                                </code>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className={estilos.emptyState}>
                    <ion-icon name="logo-instagram"></ion-icon>
                    <h3>No hay configuración de Instagram</h3>
                    <p>Configura tu integración con Instagram Business para comenzar a recibir mensajes</p>
                    <button 
                        className={estilos.botonCrearPrimera}
                        onClick={() => abrirModal('nueva')}
                    >
                        <ion-icon name="add-outline"></ion-icon>
                        Crear configuración
                    </button>
                </div>
            )}

            {/* Modal */}
            {modalAbierto && (
                <div className={estilos.modalOverlay} onClick={cerrarModal}>
                    <div className={estilos.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={estilos.modalHeader}>
                            <h2>
                                {tipoModal === 'nueva' ? 'Nueva configuración de Instagram' : 'Editar configuración de Instagram'}
                            </h2>
                            <button className={estilos.botonCerrarModal} onClick={cerrarModal}>
                                <ion-icon name="close-outline"></ion-icon>
                            </button>
                        </div>
                        
                        <div className={estilos.modalContent}>
                            <form onSubmit={manejarGuardar}>
                                <div className={estilos.campoFormulario}>
                                    <label>Nombre de configuración</label>
                                    <input
                                        type="text"
                                        value={formulario.nombre_configuracion}
                                        onChange={(e) => manejarCambioFormulario('nombre_configuracion', e.target.value)}
                                        required
                                        placeholder="Mi Instagram Business"
                                    />
                                </div>
                                
                                <div className={estilos.campoFormulario}>
                                    <label>Access Token</label>
                                    <textarea
                                        value={formulario.access_token}
                                        onChange={(e) => manejarCambioFormulario('access_token', e.target.value)}
                                        required
                                        placeholder="EAAL..."
                                        rows="3"
                                    />
                                    <small>Token de acceso de la aplicación de Facebook</small>
                                </div>
                                
<div className={estilos.campoFormulario}>
    <label>Instagram Business Account ID <span className={estilos.opcional}>(Opcional)</span></label>
    {businessAccounts.length > 0 ? (
        <select
            value={formulario.instagram_business_id}
            onChange={(e) => manejarCambioFormulario('instagram_business_id', e.target.value)}
        >
            <option value="">Selecciona una cuenta</option>
            {businessAccounts.map(account => (
                <option key={account.id} value={account.id}>
                    {account.name} (@{account.username})
                </option>
            ))}
        </select>
    ) : (
        <input
            type="text"
            value={formulario.instagram_business_id}
            onChange={(e) => manejarCambioFormulario('instagram_business_id', e.target.value)}
            placeholder="17841400008460056 (se detectará automáticamente)"
        />
    )}
    <small>Se intentará detectar automáticamente con el token</small>
</div>

<div className={estilos.campoFormulario}>
    <label>Webhook Verify Token <span className={estilos.opcional}>(Opcional)</span></label>
    <input
        type="text"
        value={formulario.webhook_verify_token}
        onChange={(e) => manejarCambioFormulario('webhook_verify_token', e.target.value)}
        placeholder="mi_token_secreto_instagram"
    />
    <small>Solo necesario si vas a recibir webhooks</small>
</div>
                                
                                <div className={estilos.campoFormulario}>
                                    <label>Webhook Verify Token</label>
                                    <input
                                        type="text"
                                        value={formulario.webhook_verify_token}
                                        onChange={(e) => manejarCambioFormulario('webhook_verify_token', e.target.value)}
                                        required
                                        placeholder="mi_token_secreto_instagram"
                                    />
                                    <small>Token para verificar webhooks</small>
                                </div>
                                
                                {mensajeError && (
                                    <div className={estilos.mensajeErrorModal}>
                                        <ion-icon name="alert-circle-outline"></ion-icon>
                                        {mensajeError}
                                    </div>
                                )}
                                
                                {mensajeExito && (
                                    <div className={estilos.mensajeExitoModal}>
                                        <ion-icon name="checkmark-circle-outline"></ion-icon>
                                        {mensajeExito}
                                    </div>
                                )}
                                
                                <div className={estilos.botonesFormulario}>
                                    <button type="button" onClick={cerrarModal} className={estilos.botonCancelar}>
                                        Cancelar
                                    </button>
                                    <button type="submit" disabled={guardando} className={estilos.botonGuardar}>
                                        {guardando ? 'Guardando...' : 'Guardar'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}