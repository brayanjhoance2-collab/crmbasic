"use client"
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import estilos from "./configuracionRedes.module.css"
import { 
    obtenerUsuarioActual,
    obtenerConfiguracionesPlataformas,
    guardarConfiguracionWhatsApp,
    guardarConfiguracionInstagram,
    guardarConfiguracionFacebook,
    crearConfiguracionBaileys,
    conectarWhatsAppBaileys,
    verificarEstadoConexion,
    desconectarPlataforma,
    probarConexionPlataforma,
    verificarLimiteConfiguraciones,
    activarConfiguracion,
    reiniciarBaileys
} from "./servidor"

export default function ConfiguracionRedesPage() {
    const router = useRouter()
    const [usuario, setUsuario] = useState(null)
    const [loading, setLoading] = useState(true)
    const [configuraciones, setConfiguraciones] = useState({
        whatsapp: [],
        instagram: [],
        facebook: []
    })
    const [plataformaActiva, setPlataformaActiva] = useState('whatsapp')
    const [modalAbierto, setModalAbierto] = useState(false)
    const [tipoModal, setTipoModal] = useState('')
    const [configuracionSeleccionada, setConfiguracionSeleccionada] = useState(null)
    const [tipoConfiguracionWA, setTipoConfiguracionWA] = useState('api')
    
    // Estados para formularios
    const [formWhatsApp, setFormWhatsApp] = useState({
        nombre_configuracion: '',
        phone_number_id: '',
        access_token: '',
        webhook_verify_token: '',
        business_account_id: ''
    })
    
    const [formBaileys, setFormBaileys] = useState({
        nombre_configuracion: '',
        webhook_url: '',
        webhook_token: ''
    })
    
    const [formInstagram, setFormInstagram] = useState({
        nombre_configuracion: '',
        instagram_business_id: '',
        access_token: '',
        webhook_verify_token: ''
    })
    
    const [formFacebook, setFormFacebook] = useState({
        nombre_configuracion: '',
        page_id: '',
        page_access_token: '',
        app_id: '',
        app_secret: '',
        webhook_verify_token: ''
    })

    // Estados para QR y conexión
    const [qrCode, setQrCode] = useState('')
    const [estadoConexion, setEstadoConexion] = useState({})
    const [conectandoWA, setConectandoWA] = useState(false)
    const [probandoConexion, setProbandoConexion] = useState(false)
    const [guardandoConfig, setGuardandoConfig] = useState(false)
    const [mensajeError, setMensajeError] = useState('')

    const qrIntervalRef = useRef(null)

    useEffect(() => {
        verificarYCargarDatos()
        return () => {
            if (qrIntervalRef.current) {
                clearInterval(qrIntervalRef.current)
            }
        }
    }, [])

    useEffect(() => {
        if (configuraciones.whatsapp.length > 0 || configuraciones.instagram.length > 0 || configuraciones.facebook.length > 0) {
            verificarEstadosConexion()
        }
    }, [configuraciones])

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
            await cargarConfiguraciones()
            
        } catch (error) {
            console.log('Error al verificar usuario:', error)
            router.push('/login')
        } finally {
            setLoading(false)
        }
    }

    const cargarConfiguraciones = async () => {
        try {
            const data = await obtenerConfiguracionesPlataformas()
            setConfiguraciones(data)
        } catch (error) {
            console.log('Error al cargar configuraciones:', error)
            setMensajeError('Error al cargar configuraciones')
        }
    }

    const verificarEstadosConexion = async () => {
        try {
            const estados = {}
            
            for (const config of configuraciones.whatsapp) {
                const estado = await verificarEstadoConexion('whatsapp', config.id)
                estados[`${config.tipo}_${config.id}`] = estado
            }
            
            for (const config of configuraciones.instagram) {
                const estado = await verificarEstadoConexion('instagram', config.id)
                estados[`instagram_${config.id}`] = estado
            }
            
            for (const config of configuraciones.facebook) {
                const estado = await verificarEstadoConexion('facebook', config.id)
                estados[`facebook_${config.id}`] = estado
            }
            
            setEstadoConexion(estados)
        } catch (error) {
            console.log('Error al verificar estados:', error)
        }
    }

    const abrirModalSeleccionTipo = async () => {
        try {
            const limite = await verificarLimiteConfiguraciones('whatsapp')
            if (!limite.puede) {
                setMensajeError(limite.mensaje)
                return
            }

            setTipoModal('seleccion_tipo')
            setMensajeError('')
            setModalAbierto(true)
        } catch (error) {
            console.log('Error al verificar límite:', error)
            setMensajeError('Error al verificar límite')
        }
    }

    const abrirModal = async (tipo, config = null, tipoWA = 'api') => {
        try {
            if (tipo === 'nueva' && plataformaActiva === 'whatsapp') {
                await abrirModalSeleccionTipo()
                return
            }

            if (tipo === 'nueva' && plataformaActiva !== 'whatsapp') {
                const puedeCrear = await verificarLimiteConfiguraciones(plataformaActiva)
                if (!puedeCrear.puede) {
                    setMensajeError(puedeCrear.mensaje)
                    return
                }
            }

            setTipoModal(tipo)
            setConfiguracionSeleccionada(config)
            setTipoConfiguracionWA(tipoWA)
            setMensajeError('')
            
            if (config && tipo === 'editar') {
                if (config.tipo === 'baileys') {
                    setFormBaileys({
                        nombre_configuracion: config.nombre_configuracion || '',
                        webhook_url: config.webhook_url || '',
                        webhook_token: config.webhook_token || ''
                    })
                } else if (plataformaActiva === 'whatsapp') {
                    setFormWhatsApp({
                        nombre_configuracion: config.nombre_configuracion || '',
                        phone_number_id: config.phone_number_id || '',
                        access_token: config.access_token || '',
                        webhook_verify_token: config.webhook_verify_token || '',
                        business_account_id: config.business_account_id || ''
                    })
                } else if (plataformaActiva === 'instagram') {
                    setFormInstagram({
                        nombre_configuracion: config.nombre_configuracion || '',
                        instagram_business_id: config.instagram_business_id || '',
                        access_token: config.access_token || '',
                        webhook_verify_token: config.webhook_verify_token || ''
                    })
                } else if (plataformaActiva === 'facebook') {
                    setFormFacebook({
                        nombre_configuracion: config.nombre_configuracion || '',
                        page_id: config.page_id || '',
                        page_access_token: config.page_access_token || '',
                        app_id: config.app_id || '',
                        app_secret: config.app_secret || '',
                        webhook_verify_token: config.webhook_verify_token || ''
                    })
                }
            } else {
                limpiarFormularios()
            }
            
            setModalAbierto(true)

        } catch (error) {
            console.log('Error al abrir modal:', error)
            setMensajeError('Error al abrir configuración')
        }
    }

    const cerrarModal = () => {
        setModalAbierto(false)
        setTipoModal('')
        setConfiguracionSeleccionada(null)
        setQrCode('')
        setMensajeError('')
        setTipoConfiguracionWA('api')
        limpiarFormularios()
        
        if (qrIntervalRef.current) {
            clearInterval(qrIntervalRef.current)
            qrIntervalRef.current = null
        }
    }

    const limpiarFormularios = () => {
        setFormWhatsApp({
            nombre_configuracion: '',
            phone_number_id: '',
            access_token: '',
            webhook_verify_token: '',
            business_account_id: ''
        })
        setFormBaileys({
            nombre_configuracion: '',
            webhook_url: '',
            webhook_token: ''
        })
        setFormInstagram({
            nombre_configuracion: '',
            instagram_business_id: '',
            access_token: '',
            webhook_verify_token: ''
        })
        setFormFacebook({
            nombre_configuracion: '',
            page_id: '',
            page_access_token: '',
            app_id: '',
            app_secret: '',
            webhook_verify_token: ''
        })
    }

    const manejarGuardarConfiguracion = async (e) => {
        e.preventDefault()
        
        try {
            setGuardandoConfig(true)
            setMensajeError('')
            
            let resultado

            if (tipoConfiguracionWA === 'baileys') {
                resultado = await crearConfiguracionBaileys(formBaileys)
            } else if (plataformaActiva === 'whatsapp') {
                resultado = await guardarConfiguracionWhatsApp(formWhatsApp, configuracionSeleccionada?.id)
            } else if (plataformaActiva === 'instagram') {
                resultado = await guardarConfiguracionInstagram(formInstagram, configuracionSeleccionada?.id)
            } else if (plataformaActiva === 'facebook') {
                resultado = await guardarConfiguracionFacebook(formFacebook, configuracionSeleccionada?.id)
            }
            
            if (resultado && resultado.success) {
                await cargarConfiguraciones()
                cerrarModal()
            } else {
                setMensajeError(resultado?.message || 'Error al guardar')
            }
            
        } catch (error) {
            console.log('Error al guardar configuración:', error)
            setMensajeError(error.message || 'Error al guardar la configuración')
        } finally {
            setGuardandoConfig(false)
        }
    }

    const manejarConectarBaileys = async (configId) => {
        try {
            setConectandoWA(true)
            setTipoModal('qr')
            setModalAbierto(true)
            
            const resultado = await conectarWhatsAppBaileys(configId)
            
            if (resultado.success && resultado.qr) {
                setQrCode(resultado.qr)
                
                qrIntervalRef.current = setInterval(async () => {
                    const estado = await verificarEstadoConexion('whatsapp', configId)
                    if (estado.conectado) {
                        clearInterval(qrIntervalRef.current)
                        qrIntervalRef.current = null
                        setQrCode('')
                        cerrarModal()
                        await verificarEstadosConexion()
                        await cargarConfiguraciones()
                    }
                }, 3000)
            } else {
                setMensajeError(resultado.message || 'Error al conectar Baileys')
            }
            
        } catch (error) {
            console.log('Error al conectar Baileys:', error)
            setMensajeError(error.message || 'Error al conectar con Baileys')
        } finally {
            setConectandoWA(false)
        }
    }

    const manejarActivarConfiguracion = async (plataforma, tipo, configId) => {
        try {
            await activarConfiguracion(plataforma, tipo, configId)
            await verificarEstadosConexion()
            await cargarConfiguraciones()
        } catch (error) {
            console.log('Error al activar configuración:', error)
            setMensajeError(error.message || 'Error al activar configuración')
        }
    }

    const manejarReiniciarBaileys = async (configId) => {
        try {
            setConectandoWA(true)
            await reiniciarBaileys(configId)
            await verificarEstadosConexion()
        } catch (error) {
            console.log('Error al reiniciar Baileys:', error)
            setMensajeError(error.message || 'Error al reiniciar conexión')
        } finally {
            setConectandoWA(false)
        }
    }

    const manejarDesconectar = async (plataforma, configId) => {
        try {
            const confirmar = window.confirm('¿Estás seguro de que quieres desconectar esta configuración?')
            if (!confirmar) return
            
            await desconectarPlataforma(plataforma, configId)
            await verificarEstadosConexion()
            await cargarConfiguraciones()
            
        } catch (error) {
            console.log('Error al desconectar:', error)
            setMensajeError(error.message || 'Error al desconectar')
        }
    }

    const manejarProbarConexion = async (plataforma, configId) => {
        try {
            setProbandoConexion(true)
            const resultado = await probarConexionPlataforma(plataforma, configId)
            
            if (resultado.success) {
                alert('Conexión exitosa')
            } else {
                alert('Error en la conexión: ' + resultado.message)
            }
            
        } catch (error) {
            console.log('Error al probar conexión:', error)
            alert('Error al probar la conexión')
        } finally {
            setProbandoConexion(false)
        }
    }

    const obtenerIconoPlataforma = (plataforma) => {
        switch (plataforma) {
            case 'whatsapp': return 'logo-whatsapp'
            case 'instagram': return 'logo-instagram'
            case 'facebook': return 'logo-facebook'
            default: return 'globe-outline'
        }
    }

    const renderSeleccionTipo = () => (
        <div className={estilos.seleccionTipo}>
            <h3>Selecciona el tipo de configuración para WhatsApp</h3>
            <div className={estilos.opcionesTipo}>
                <div 
                    className={estilos.opcionTipo}
                    onClick={() => {
                        setTipoConfiguracionWA('api')
                        setTipoModal('nueva')
                    }}
                >
                    <div className={estilos.iconoOpcion}>
                        <ion-icon name="cloud-outline"></ion-icon>
                    </div>
                    <h4>WhatsApp Business API</h4>
                    <p>Configuración oficial de Meta para empresas</p>
                    <ul>
                        <li>Requiere Phone Number ID</li>
                        <li>Necesita Access Token de Meta</li>
                        <li>Para uso comercial</li>
                    </ul>
                </div>
                
                <div 
                    className={estilos.opcionTipo}
                    onClick={() => {
                        setTipoConfiguracionWA('baileys')
                        setTipoModal('nueva')
                    }}
                >
                    <div className={estilos.iconoOpcion}>
                        <ion-icon name="phone-portrait-outline"></ion-icon>
                    </div>
                    <h4>WhatsApp Personal (Baileys)</h4>
                    <div className={estilos.experimentalBadge}>
                        <ion-icon name="flask-outline"></ion-icon>
                        Experimental
                    </div>
                    <p>Conexión directa con tu WhatsApp personal</p>
                    <ul>
                        <li>Escanea código QR</li>
                        <li>Usa tu número personal</li>
                        <li>Sin costos adicionales</li>
                    </ul>
                </div>
            </div>
        </div>
    )

    const renderFormularioBaileys = () => (
        <form onSubmit={manejarGuardarConfiguracion} className={estilos.formulario}>
            <div className={estilos.campoFormulario}>
                <label>Nombre de configuración</label>
                <input
                    type="text"
                    value={formBaileys.nombre_configuracion}
                    onChange={(e) => setFormBaileys({...formBaileys, nombre_configuracion: e.target.value})}
                    required
                    placeholder="Mi WhatsApp Personal"
                />
            </div>
            
            <div className={estilos.campoFormulario}>
                <label>URL de Webhook (Opcional)</label>
                <input
                    type="url"
                    value={formBaileys.webhook_url}
                    onChange={(e) => setFormBaileys({...formBaileys, webhook_url: e.target.value})}
                    placeholder="https://tudominio.com/webhook/whatsapp"
                />
                <small>Para recibir notificaciones de mensajes</small>
            </div>
            
            <div className={estilos.campoFormulario}>
                <label>Token de Webhook (Opcional)</label>
                <input
                    type="text"
                    value={formBaileys.webhook_token}
                    onChange={(e) => setFormBaileys({...formBaileys, webhook_token: e.target.value})}
                    placeholder="token_secreto_webhook"
                />
                <small>Token para validar webhooks</small>
            </div>

            <div className={estilos.alertaExperimental}>
                <ion-icon name="warning-outline"></ion-icon>
                <div>
                    <strong>Función Experimental</strong>
                    <p>Esta funcionalidad usa Baileys para conectar directamente con WhatsApp Web. Puede presentar inestabilidades.</p>
                </div>
            </div>
            
            {mensajeError && (
                <div className={estilos.mensajeError}>
                    <ion-icon name="alert-circle-outline"></ion-icon>
                    {mensajeError}
                </div>
            )}
            
            <div className={estilos.botonesFormulario}>
                <button type="button" onClick={cerrarModal} className={estilos.botonCancelar}>
                    Cancelar
                </button>
                <button type="submit" disabled={guardandoConfig} className={estilos.botonGuardar}>
                    {guardandoConfig ? 'Creando...' : 'Crear Configuración'}
                </button>
            </div>
        </form>
    )

    const renderFormularioWhatsApp = () => (
        <form onSubmit={manejarGuardarConfiguracion} className={estilos.formulario}>
            <div className={estilos.campoFormulario}>
                <label>Nombre de configuración</label>
                <input
                    type="text"
                    value={formWhatsApp.nombre_configuracion}
                    onChange={(e) => setFormWhatsApp({...formWhatsApp, nombre_configuracion: e.target.value})}
                    required
                    placeholder="Mi WhatsApp Business"
                />
            </div>
            
            <div className={estilos.campoFormulario}>
                <label>Phone Number ID</label>
                <input
                    type="text"
                    value={formWhatsApp.phone_number_id}
                    onChange={(e) => setFormWhatsApp({...formWhatsApp, phone_number_id: e.target.value})}
                    required
                    placeholder="123456789012345"
                />
            </div>
            
            <div className={estilos.campoFormulario}>
                <label>Access Token</label>
                <textarea
                    value={formWhatsApp.access_token}
                    onChange={(e) => setFormWhatsApp({...formWhatsApp, access_token: e.target.value})}
                    required
                    placeholder="EAAxxxxxxxxxxxxx..."
                    rows="3"
                />
            </div>
            
            <div className={estilos.campoFormulario}>
                <label>Webhook Verify Token</label>
                <input
                    type="text"
                    value={formWhatsApp.webhook_verify_token}
                    onChange={(e) => setFormWhatsApp({...formWhatsApp, webhook_verify_token: e.target.value})}
                    required
                    placeholder="mi_token_secreto"
                />
            </div>
            
            <div className={estilos.campoFormulario}>
                <label>Business Account ID (Opcional)</label>
                <input
                    type="text"
                    value={formWhatsApp.business_account_id}
                    onChange={(e) => setFormWhatsApp({...formWhatsApp, business_account_id: e.target.value})}
                    placeholder="123456789012345"
                />
            </div>
            
            {mensajeError && (
                <div className={estilos.mensajeError}>
                    <ion-icon name="alert-circle-outline"></ion-icon>
                    {mensajeError}
                </div>
            )}
            
            <div className={estilos.botonesFormulario}>
                <button type="button" onClick={cerrarModal} className={estilos.botonCancelar}>
                    Cancelar
                </button>
                <button type="submit" disabled={guardandoConfig} className={estilos.botonGuardar}>
                    {guardandoConfig ? 'Guardando...' : 'Guardar'}
                </button>
            </div>
        </form>
    )

    const renderFormularioInstagram = () => (
        <form onSubmit={manejarGuardarConfiguracion} className={estilos.formulario}>
            <div className={estilos.campoFormulario}>
                <label>Nombre de configuración</label>
                <input
                    type="text"
                    value={formInstagram.nombre_configuracion}
                    onChange={(e) => setFormInstagram({...formInstagram, nombre_configuracion: e.target.value})}
                    required
                    placeholder="Mi Instagram Business"
                />
            </div>
            
            <div className={estilos.campoFormulario}>
                <label>Instagram Business Account ID</label>
                <input
                    type="text"
                    value={formInstagram.instagram_business_id}
                    onChange={(e) => setFormInstagram({...formInstagram, instagram_business_id: e.target.value})}
                    required
                    placeholder="17841400008460056"
                />
            </div>
            
            <div className={estilos.campoFormulario}>
                <label>Access Token</label>
                <textarea
                    value={formInstagram.access_token}
                    onChange={(e) => setFormInstagram({...formInstagram, access_token: e.target.value})}
                    required
                    placeholder="IGQVxxxxxxxxxxxxx..."
                    rows="3"
                />
            </div>
            
            <div className={estilos.campoFormulario}>
                <label>Webhook Verify Token</label>
                <input
                    type="text"
                    value={formInstagram.webhook_verify_token}
                    onChange={(e) => setFormInstagram({...formInstagram, webhook_verify_token: e.target.value})}
                    required
                    placeholder="mi_token_secreto"
                />
            </div>
            
            {mensajeError && (
                <div className={estilos.mensajeError}>
                    <ion-icon name="alert-circle-outline"></ion-icon>
                    {mensajeError}
                </div>
            )}
            
            <div className={estilos.botonesFormulario}>
                <button type="button" onClick={cerrarModal} className={estilos.botonCancelar}>
                    Cancelar
                </button>
                <button type="submit" disabled={guardandoConfig} className={estilos.botonGuardar}>
                    {guardandoConfig ? 'Guardando...' : 'Guardar'}
                </button>
            </div>
        </form>
    )

    const renderFormularioFacebook = () => (
        <form onSubmit={manejarGuardarConfiguracion} className={estilos.formulario}>
            <div className={estilos.campoFormulario}>
                <label>Nombre de configuración</label>
                <input
                    type="text"
                    value={formFacebook.nombre_configuracion}
                    onChange={(e) => setFormFacebook({...formFacebook, nombre_configuracion: e.target.value})}
                    required
                    placeholder="Mi Página de Facebook"
                />
            </div>
            
            <div className={estilos.campoFormulario}>
                <label>Page ID</label>
                <input
                    type="text"
                    value={formFacebook.page_id}
                    onChange={(e) => setFormFacebook({...formFacebook, page_id: e.target.value})}
                    required
                    placeholder="123456789012345"
                />
            </div>
            
            <div className={estilos.campoFormulario}>
                <label>Page Access Token</label>
                <textarea
                    value={formFacebook.page_access_token}
                    onChange={(e) => setFormFacebook({...formFacebook, page_access_token: e.target.value})}
                    required
                    placeholder="EAAxxxxxxxxxxxxx..."
                    rows="3"
                />
            </div>
            
            <div className={estilos.campoFormulario}>
                <label>App ID</label>
                <input
                    type="text"
                    value={formFacebook.app_id}
                    onChange={(e) => setFormFacebook({...formFacebook, app_id: e.target.value})}
                    required
                    placeholder="123456789012345"
                />
            </div>
            
            <div className={estilos.campoFormulario}>
                <label>App Secret</label>
                <textarea
                    value={formFacebook.app_secret}
                    onChange={(e) => setFormFacebook({...formFacebook, app_secret: e.target.value})}
                    required
                    placeholder="abcdef123456789..."
                    rows="2"
                />
            </div>
            
            <div className={estilos.campoFormulario}>
                <label>Webhook Verify Token</label>
                <input
                    type="text"
                    value={formFacebook.webhook_verify_token}
                    onChange={(e) => setFormFacebook({...formFacebook, webhook_verify_token: e.target.value})}
                    required
                    placeholder="mi_token_secreto"
                />
            </div>
            
            {mensajeError && (
                <div className={estilos.mensajeError}>
                    <ion-icon name="alert-circle-outline"></ion-icon>
                    {mensajeError}
                </div>
            )}
            
            <div className={estilos.botonesFormulario}>
                <button type="button" onClick={cerrarModal} className={estilos.botonCancelar}>
                    Cancelar
                </button>
                <button type="submit" disabled={guardandoConfig} className={estilos.botonGuardar}>
                    {guardandoConfig ? 'Guardando...' : 'Guardar'}
                </button>
            </div>
        </form>
    )

    if (loading) {
        return (
            <div className={estilos.loadingContainer}>
                <div className={estilos.loadingSpinner}></div>
                <p>Cargando configuraciones...</p>
            </div>
        )
    }

    return (
        <div className={estilos.configuracionContainer}>
            {/* Pestañas */}
            <div className={estilos.pestanasContainer}>
                <div className={estilos.pestanas}>
                    {['whatsapp', 'instagram', 'facebook'].map(plataforma => (
                        <button
                            key={plataforma}
                            className={`${estilos.pestana} ${plataformaActiva === plataforma ? estilos.activa : ''} ${estilos[plataforma]}`}
                            onClick={() => setPlataformaActiva(plataforma)}
                        >
                            <ion-icon name={obtenerIconoPlataforma(plataforma)}></ion-icon>
                            <span>{plataforma.charAt(0).toUpperCase() + plataforma.slice(1)}</span>
                            <span className={estilos.contador}>
                                {configuraciones[plataforma]?.length || 0}
                            </span>
                        </button>
                    ))}
                </div>
                
                <button 
                    className={estilos.botonNueva}
                    onClick={() => abrirModal('nueva')}
                    disabled={plataformaActiva !== 'whatsapp' && configuraciones[plataformaActiva]?.length >= 1}
                >
                    <ion-icon name="add-outline"></ion-icon>
                    Nueva configuración
                </button>
            </div>

            {/* Mensaje de error global */}
            {mensajeError && !modalAbierto && (
                <div className={estilos.mensajeErrorGlobal} role="alert">
                    <ion-icon name="alert-circle-outline"></ion-icon>{mensajeError}
                    <button onClick={() => setMensajeError('')}>
                        <ion-icon name="close-outline"></ion-icon>
                    </button>
                </div>
            )}

            {/* Contenido de la plataforma activa */}
            <div className={estilos.contenidoPlatforma}>
                {configuraciones[plataformaActiva]?.length > 0 ? (
                    <div className={estilos.configuracionesGrid}>
                        {configuraciones[plataformaActiva].map(config => {
                            const keyUnica = `${config.tipo}_${config.id}`
                            const estadoKey = keyUnica
                            const estado = estadoConexion[estadoKey] || { conectado: false }
                            const esBaileys = config.tipo === 'baileys'
                            
                            return (
                                <div key={keyUnica} className={estilos.configuracionCard}>
                                    <div className={estilos.cardHeader}>
                                        <div className={estilos.cardTitulo}>
                                            <ion-icon name={obtenerIconoPlataforma(plataformaActiva)}></ion-icon>
                                            <div>
                                                <h3>{config.nombre_configuracion}</h3>
                                                <div className={estilos.badgesContainer}>
                                                    {esBaileys && (
                                                        <span className={estilos.tipoBadge}>
                                                            <ion-icon name="phone-portrait-outline"></ion-icon>
                                                            Baileys
                                                        </span>
                                                    )}
                                                    {config.tipo === 'api' && (
                                                        <span className={estilos.tipoBadge}>
                                                            <ion-icon name="cloud-outline"></ion-icon>
                                                            API
                                                        </span>
                                                    )}
                                                    {config.is_active && (
                                                        <span className={estilos.principalBadge}>
                                                            <ion-icon name="star"></ion-icon>
                                                            Activa
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className={estilos.cardEstado}>
                                            <span className={`${estilos.estadoIndicador} ${estado.conectado ? estilos.conectado : estilos.desconectado}`}>
                                                <ion-icon name={estado.conectado ? 'checkmark-circle' : 'close-circle'}></ion-icon>
                                                {estado.conectado ? 'Conectado' : 
                                                estado.estado === 'qr_generado' ? 'QR Listo' :
                                                estado.estado === 'conectando' ? 'Conectando' : 'Desconectado'}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <div className={estilos.cardContent}>
                                        <div className={estilos.cardInfo}>
                                            {esBaileys ? (
                                                <>
                                                    {estado.numero && (
                                                        <div className={estilos.infoItem}>
                                                            <span className={estilos.infoLabel}>Número:</span>
                                                            <span className={estilos.infoValue}>{estado.numero}</span>
                                                        </div>
                                                    )}
                                                    {estado.nombre && (
                                                        <div className={estilos.infoItem}>
                                                            <span className={estilos.infoLabel}>Nombre:</span>
                                                            <span className={estilos.infoValue}>{estado.nombre}</span>
                                                        </div>
                                                    )}
                                                    <div className={estilos.infoItem}>
                                                        <span className={estilos.infoLabel}>Estado:</span>
                                                        <span className={estilos.infoValue}>{estado.estado || 'desconectado'}</span>
                                                    </div>
                                                </>
                                            ) : plataformaActiva === 'whatsapp' ? (
                                                <>
                                                    <div className={estilos.infoItem}>
                                                        <span className={estilos.infoLabel}>Phone Number ID:</span>
                                                        <span className={estilos.infoValue}>{config.phone_number_id}</span>
                                                    </div>
                                                    <div className={estilos.infoItem}>
                                                        <span className={estilos.infoLabel}>Business Account:</span>
                                                        <span className={estilos.infoValue}>{config.business_account_id || 'No configurado'}</span>
                                                    </div>
                                                </>
                                            ) : plataformaActiva === 'instagram' ? (
                                                <div className={estilos.infoItem}>
                                                    <span className={estilos.infoLabel}>Business ID:</span>
                                                    <span className={estilos.infoValue}>{config.instagram_business_id}</span>
                                                </div>
                                            ) : plataformaActiva === 'facebook' ? (
                                                <>
                                                    <div className={estilos.infoItem}>
                                                        <span className={estilos.infoLabel}>Page ID:</span>
                                                        <span className={estilos.infoValue}>{config.page_id}</span>
                                                    </div>
                                                    <div className={estilos.infoItem}>
                                                        <span className={estilos.infoLabel}>App ID:</span>
                                                        <span className={estilos.infoValue}>{config.app_id}</span>
                                                    </div>
                                                </>
                                            ) : null}
                                        </div>
                                    </div>
                                    
                                    <div className={estilos.cardAcciones}>
                                        {esBaileys ? (
                                            <>
                                                {!estado.conectado && (
                                                    <button
                                                        className={estilos.botonConectar}
                                                        onClick={() => manejarConectarBaileys(config.id)}
                                                        disabled={conectandoWA}
                                                    >
                                                        <ion-icon name="qr-code-outline"></ion-icon>
                                                        {conectandoWA ? 'Conectando...' : 'Conectar'}
                                                    </button>
                                                )}
                                                
                                                {estado.conectado && !config.is_active && (
                                                    <button
                                                        className={estilos.botonActivar}
                                                        onClick={() => manejarActivarConfiguracion('whatsapp', 'baileys', config.id)}
                                                    >
                                                        <ion-icon name="star-outline"></ion-icon>
                                                        Activar
                                                    </button>
                                                )}
                                                
                                                {estado.conectado && (
                                                    <button
                                                        className={estilos.botonReiniciar}
                                                        onClick={() => manejarReiniciarBaileys(config.id)}
                                                        disabled={conectandoWA}
                                                    >
                                                        <ion-icon name="refresh-outline"></ion-icon>
                                                        Reiniciar
                                                    </button>
                                                )}
                                                
                                                {estado.conectado && (
                                                    <button
                                                        className={estilos.botonDesconectar}
                                                        onClick={() => manejarDesconectar('whatsapp', config.id)}
                                                    >
                                                        <ion-icon name="power-outline"></ion-icon>
                                                        Desconectar
                                                    </button>
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    className={estilos.botonProbar}
                                                    onClick={() => manejarProbarConexion(plataformaActiva, config.id)}
                                                    disabled={probandoConexion}
                                                >
                                                    <ion-icon name="flash-outline"></ion-icon>
                                                    Probar
                                                </button>
                                                
                                                <button
                                                    className={estilos.botonEditar}
                                                    onClick={() => abrirModal('editar', config)}
                                                >
                                                    <ion-icon name="create-outline"></ion-icon>
                                                    Editar
                                                </button>
                                                
                                                {plataformaActiva === 'whatsapp' && !config.is_active && (
                                                    <button
                                                        className={estilos.botonActivar}
                                                        onClick={() => manejarActivarConfiguracion('whatsapp', 'api', config.id)}
                                                    >
                                                        <ion-icon name="checkmark-outline"></ion-icon>
                                                        Activar
                                                    </button>
                                                )}
                                                
                                                {config.is_active && (
                                                    <button
                                                        className={estilos.botonDesconectar}
                                                        onClick={() => manejarDesconectar(plataformaActiva, config.id)}
                                                    >
                                                        <ion-icon name="power-outline"></ion-icon>
                                                        Desactivar
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <div className={estilos.emptyState}>
                        <ion-icon name={obtenerIconoPlataforma(plataformaActiva)}></ion-icon>
                        <h3>No hay configuraciones de {plataformaActiva}</h3>
                        <p>Crea tu configuración para conectar con {plataformaActiva}</p>
                        <button 
                            className={estilos.botonCrearPrimera}
                            onClick={() => abrirModal('nueva')}
                        >
                            <ion-icon name="add-outline"></ion-icon>
                            Crear configuración
                        </button>
                    </div>
                )}
            </div>

            {/* Modal */}
            {modalAbierto && (
                <div className={estilos.modalOverlay} onClick={cerrarModal}>
                    <div className={estilos.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={estilos.modalHeader}>
                            <h2>
                                {tipoModal === 'seleccion_tipo' ? 'Configurar WhatsApp' :
                                tipoModal === 'qr' ? 'Conectar WhatsApp con Baileys' :
                                tipoModal === 'nueva' && tipoConfiguracionWA === 'baileys' ? 'Nueva configuración Baileys' :
                                tipoModal === 'nueva' ? `Nueva configuración de ${plataformaActiva}` :
                                `Editar configuración de ${plataformaActiva}`}
                            </h2>
                            <button className={estilos.botonCerrarModal} onClick={cerrarModal}>
                                <ion-icon name="close-outline"></ion-icon>
                            </button>
                        </div>
                        
                        <div className={estilos.modalContent}>
                            {tipoModal === 'seleccion_tipo' ? renderSeleccionTipo() :
                            tipoModal === 'qr' ? (
                                <div className={estilos.qrContainer}>
                                    {qrCode ? (
                                        <div className={estilos.qrCode}>
                                            <img src={qrCode} alt="Código QR" />
                                            <p>Escanea este código con WhatsApp</p>
                                            <div className={estilos.qrInstrucciones}>
                                                <h4>Instrucciones:</h4>
                                                <ol>
                                                    <li>Abre WhatsApp en tu teléfono</li>
                                                    <li>Ve a Configuración → Dispositivos vinculados</li>
                                                    <li>Toca "Vincular un dispositivo"</li>
                                                    <li>Escanea este código QR</li>
                                                </ol>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className={estilos.generandoQR}>
                                            <div className={estilos.loadingSpinner}></div>
                                            <p>Generando código QR...</p>
                                            <small>Esto puede tomar unos segundos</small>
                                        </div>
                                    )}
                                </div>
                            ) : tipoModal === 'nueva' && tipoConfiguracionWA === 'baileys' ? renderFormularioBaileys() :
                              tipoModal === 'nueva' && plataformaActiva === 'whatsapp' ? renderFormularioWhatsApp() :
                              tipoModal === 'nueva' && plataformaActiva === 'instagram' ? renderFormularioInstagram() :
                              tipoModal === 'nueva' && plataformaActiva === 'facebook' ? renderFormularioFacebook() :
                              tipoModal === 'editar' && configuracionSeleccionada?.tipo === 'baileys' ? renderFormularioBaileys() :
                              tipoModal === 'editar' && plataformaActiva === 'whatsapp' ? renderFormularioWhatsApp() :
                              tipoModal === 'editar' && plataformaActiva === 'instagram' ? renderFormularioInstagram() :
                              tipoModal === 'editar' && plataformaActiva === 'facebook' ? renderFormularioFacebook() : null}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}