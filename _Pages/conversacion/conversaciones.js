"use client"
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import estilos from "./conversaciones.module.css"
import { 
    obtenerUsuarioActual,
    obtenerConversaciones,
    obtenerMensajesConversacion,
    marcarConversacionLeida,
    asignarConversacion,
    cambiarEstadoConversacion,
    obtenerUsuarios
} from "./servidor"

export default function ConversacionesPage() {
    const router = useRouter()
    const [usuario, setUsuario] = useState(null)
    const [loading, setLoading] = useState(true)
    const [conversaciones, setConversaciones] = useState([])
    const [conversacionActiva, setConversacionActiva] = useState(null)
    const [mensajes, setMensajes] = useState([])
    const [nuevoMensaje, setNuevoMensaje] = useState('')
    const [plataformaFiltro, setPlataformaFiltro] = useState('todas')
    const [estadoFiltro, setEstadoFiltro] = useState('todas')
    const [usuarios, setUsuarios] = useState([])
    const [loadingMensajes, setLoadingMensajes] = useState(false)
    const [enviandoMensaje, setEnviandoMensaje] = useState(false)
    const [busqueda, setBusqueda] = useState('')
    const [mensajeError, setMensajeError] = useState('')

    // Estados para envío directo
    const [showEnvioDirecto, setShowEnvioDirecto] = useState(false)
    const [plataformaDirecta, setPlataformaDirecta] = useState('whatsapp')
    const [recipientId, setRecipientId] = useState('')
    const [numeroTelefono, setNumeroTelefono] = useState('')
    const [mensajeDirecto, setMensajeDirecto] = useState('')

    const mensajesRef = useRef(null)
    const inputRef = useRef(null)

    useEffect(() => {
        verificarYCargarDatos()
        
        const interval = setInterval(cargarConversaciones, 30000)
        return () => clearInterval(interval)
    }, [])

    useEffect(() => {
        if (conversacionActiva) {
            cargarMensajesConversacion()
            
            setTimeout(() => {
                scrollToBottom()
            }, 100)
        }
    }, [conversacionActiva])

    useEffect(() => {
        cargarConversaciones()
    }, [plataformaFiltro, estadoFiltro, busqueda])

    useEffect(() => {
        scrollToBottom()
    }, [mensajes])

    const scrollToBottom = () => {
        if (mensajesRef.current) {
            mensajesRef.current.scrollTop = mensajesRef.current.scrollHeight
        }
    }

    const verificarYCargarDatos = async () => {
        try {
            setLoading(true)
            
            const usuarioData = await obtenerUsuarioActual()
            if (!usuarioData) {
                router.push('/login')
                return
            }
            
            setUsuario(usuarioData)
            
            await Promise.all([
                cargarConversaciones(),
                cargarUsuarios()
            ])
            
        } catch (error) {
            console.log('Error al verificar usuario:', error)
            router.push('/login')
        } finally {
            setLoading(false)
        }
    }

    const cargarConversaciones = async () => {
        try {
            const filtros = {
                plataforma: plataformaFiltro !== 'todas' ? plataformaFiltro : null,
                estado: estadoFiltro !== 'todas' ? estadoFiltro : null,
                busqueda: busqueda.trim() || null
            }
            
            const data = await obtenerConversaciones(filtros)
            setConversaciones(data)
            
            if (conversacionActiva) {
                const conversacionActualizada = data.find(c => c.id === conversacionActiva.id)
                if (conversacionActualizada) {
                    setConversacionActiva(conversacionActualizada)
                }
            }
            
        } catch (error) {
            console.log('Error al cargar conversaciones:', error)
            setMensajeError('Error al cargar conversaciones')
        }
    }

    const cargarUsuarios = async () => {
        try {
            const data = await obtenerUsuarios()
            setUsuarios(data)
        } catch (error) {
            console.log('Error al cargar usuarios:', error)
        }
    }

    const cargarMensajesConversacion = async () => {
        if (!conversacionActiva) return
        
        try {
            setLoadingMensajes(true)
            const data = await obtenerMensajesConversacion(conversacionActiva.id)
            setMensajes(data)
            
            await marcarConversacionLeida(conversacionActiva.id)
            
        } catch (error) {
            console.log('Error al cargar mensajes:', error)
            setMensajeError('Error al cargar mensajes')
        } finally {
            setLoadingMensajes(false)
        }
    }

    const manejarSeleccionarConversacion = async (conversacion) => {
        setConversacionActiva(conversacion)
        setMensajes([])
        setMensajeError('')
    }

    const enviarMensajeUnificado = async (contenido, conversacionId = null, plataforma = null, recipient = null, telefono = null) => {
        try {
            const response = await fetch('/api/messaging/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    conversacionId,
                    contenido,
                    plataforma,
                    recipientId: recipient,
                    numeroTelefono: telefono
                })
            })

            const resultado = await response.json()

            if (!response.ok) {
                throw new Error(resultado.error || 'Error al enviar mensaje')
            }

            return resultado

        } catch (error) {
            console.log('Error en envio unificado:', error)
            throw error
        }
    }

    const manejarEnviarMensaje = async (e) => {
        e.preventDefault()
        if (!nuevoMensaje.trim() || !conversacionActiva || enviandoMensaje) return

        try {
            setEnviandoMensaje(true)
            setMensajeError('')
            
            await enviarMensajeUnificado(
                nuevoMensaje.trim(),
                conversacionActiva.id
            )
            
            setNuevoMensaje('')
            
            await cargarMensajesConversacion()
            await cargarConversaciones()
            
            if (inputRef.current) {
                inputRef.current.focus()
            }
            
        } catch (error) {
            console.log('Error al enviar mensaje:', error)
            setMensajeError('Error al enviar mensaje: ' + error.message)
        } finally {
            setEnviandoMensaje(false)
        }
    }

    const manejarEnvioDirecto = async (e) => {
        e.preventDefault()
        if (!mensajeDirecto.trim() || enviandoMensaje) return

        if (plataformaDirecta === 'whatsapp' && !recipientId && !numeroTelefono) {
            setMensajeError('Para WhatsApp necesitas el numero de telefono')
            return
        }

        if ((plataformaDirecta === 'instagram' || plataformaDirecta === 'facebook') && !recipientId) {
            setMensajeError(`Para ${plataformaDirecta} necesitas el ID del usuario`)
            return
        }

        try {
            setEnviandoMensaje(true)
            setMensajeError('')
            
            await enviarMensajeUnificado(
                mensajeDirecto.trim(),
                null,
                plataformaDirecta,
                recipientId || null,
                numeroTelefono || null
            )
            
            setMensajeDirecto('')
            setRecipientId('')
            setNumeroTelefono('')
            setShowEnvioDirecto(false)
            
            setMensajeError('Mensaje enviado exitosamente')
            setTimeout(() => setMensajeError(''), 3000)
            
        } catch (error) {
            console.log('Error al enviar mensaje directo:', error)
            setMensajeError('Error al enviar mensaje: ' + error.message)
        } finally {
            setEnviandoMensaje(false)
        }
    }

    const manejarAsignarConversacion = async (usuarioId) => {
        if (!conversacionActiva) return
        
        try {
            setMensajeError('')
            await asignarConversacion(conversacionActiva.id, usuarioId)
            await cargarConversaciones()
        } catch (error) {
            console.log('Error al asignar conversacion:', error)
            setMensajeError('Error al asignar conversacion: ' + error.message)
        }
    }

    const manejarCambiarEstado = async (nuevoEstado) => {
        if (!conversacionActiva) return
        
        try {
            setMensajeError('')
            await cambiarEstadoConversacion(conversacionActiva.id, nuevoEstado)
            await cargarConversaciones()
        } catch (error) {
            console.log('Error al cambiar estado:', error)
            setMensajeError('Error al cambiar estado: ' + error.message)
        }
    }

    const formatearFecha = (fecha) => {
        if (!fecha) return ''
        
        const ahora = new Date()
        const fechaMensaje = new Date(fecha)
        const diferencia = ahora - fechaMensaje
        
        if (diferencia < 60000) {
            return 'Ahora'
        }
        
        if (diferencia < 3600000) {
            const minutos = Math.floor(diferencia / 60000)
            return `${minutos}min`
        }
        
        if (diferencia < 86400000) {
            return fechaMensaje.toLocaleTimeString('es-ES', {
                hour: '2-digit',
                minute: '2-digit'
            })
        }
        
        return fechaMensaje.toLocaleDateString('es-ES', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    const obtenerIconoPorPlataforma = (plataforma) => {
        switch(plataforma) {
            case 'whatsapp': return 'logo-whatsapp'
            case 'instagram': return 'logo-instagram'
            case 'facebook': return 'logo-facebook'
            default: return 'chatbubble-outline'
        }
    }

    const obtenerColorPorEstado = (estado) => {
        switch(estado) {
            case 'abierta': return 'success'
            case 'en_proceso': return 'warning'
            case 'cerrada': return 'secondary'
            default: return 'primary'
        }
    }

    const obtenerColorPlataforma = (plataforma) => {
        switch(plataforma) {
            case 'whatsapp': return '#25d366'
            case 'instagram': return '#e1306c'
            case 'facebook': return '#1877f2'
            default: return '#10b981'
        }
    }

    if (loading) {
        return (
            <div className={estilos.loadingContainer}>
                <div className={estilos.loadingSpinner}></div>
                <p>Cargando conversaciones...</p>
            </div>
        )
    }

    return (
        <div className={estilos.conversacionesContainer}>
            <div className={estilos.conversacionesPanel}>
                <div className={estilos.panelHeader}>
                    <div className={estilos.headerTitle}>
                        <h2>Conversaciones</h2>
                        <span className={estilos.contadorConversaciones}>
                            {conversaciones.length}
                        </span>
                    </div>
                    
                    <div className={estilos.accionesHeader}>
                        <button 
                            className={estilos.botonEnvioDirecto}
                            onClick={() => setShowEnvioDirecto(!showEnvioDirecto)}
                        >
                            <ion-icon name="send-outline"></ion-icon>
                            Envio Directo
                        </button>
                    </div>

                    {showEnvioDirecto && (
                        <div className={estilos.envioDirectoPanel}>
                            <div className={estilos.envioDirectoHeader}>
                                <h3>Envio Directo</h3>
                                <button onClick={() => setShowEnvioDirecto(false)}>
                                    <ion-icon name="close-outline"></ion-icon>
                                </button>
                            </div>
                            
                            <form onSubmit={manejarEnvioDirecto} className={estilos.envioDirectoForm}>
                                <div className={estilos.filtro}>
                                    <select 
                                        value={plataformaDirecta} 
                                        onChange={(e) => setPlataformaDirecta(e.target.value)}
                                        className={estilos.selectFiltro}
                                    >
                                        <option value="whatsapp">WhatsApp</option>
                                        <option value="instagram">Instagram</option>
                                        <option value="facebook">Facebook</option>
                                    </select>
                                </div>

                                {plataformaDirecta === 'whatsapp' && (
                                    <input
                                        type="text"
                                        placeholder="Numero de telefono (ej: 5491234567890)"
                                        value={numeroTelefono}
                                        onChange={(e) => setNumeroTelefono(e.target.value)}
                                        className={estilos.inputDirecto}
                                    />
                                )}

                                {(plataformaDirecta === 'instagram' || plataformaDirecta === 'facebook') && (
                                    <input
                                        type="text"
                                        placeholder={`ID de usuario de ${plataformaDirecta}`}
                                        value={recipientId}
                                        onChange={(e) => setRecipientId(e.target.value)}
                                        className={estilos.inputDirecto}
                                        required
                                    />
                                )}

                                <textarea
                                    placeholder="Escribe tu mensaje..."
                                    value={mensajeDirecto}
                                    onChange={(e) => setMensajeDirecto(e.target.value)}
                                    className={estilos.textareaDirecto}
                                    required
                                />

                                <button 
                                    type="submit" 
                                    disabled={enviandoMensaje}
                                    className={estilos.botonEnviarDirecto}
                                >
                                    {enviandoMensaje ? (
                                        <div className={estilos.loadingSpinner}></div>
                                    ) : (
                                        <>
                                            <ion-icon name="send-outline"></ion-icon>
                                            Enviar
                                        </>
                                    )}
                                </button>
                            </form>
                        </div>
                    )}
                    
                    <div className={estilos.filtrosContainer}>
                        <div className={estilos.filtro}>
                            <select 
                                value={plataformaFiltro} 
                                onChange={(e) => setPlataformaFiltro(e.target.value)}
                                className={estilos.selectFiltro}
                            >
                                <option value="todas">Todas las plataformas</option>
                                <option value="whatsapp">WhatsApp</option>
                                <option value="instagram">Instagram</option>
                                <option value="facebook">Facebook</option>
                            </select>
                        </div>
                        
                        <div className={estilos.filtro}>
                            <select 
                                value={estadoFiltro} 
                                onChange={(e) => setEstadoFiltro(e.target.value)}
                                className={estilos.selectFiltro}
                            >
                                <option value="todas">Todos los estados</option>
                                <option value="abierta">Abiertas</option>
                                <option value="en_proceso">En proceso</option>
                                <option value="cerrada">Cerradas</option>
                            </select>
                        </div>
                    </div>
                    
                    <div className={estilos.buscadorContainer}>
                        <div className={estilos.buscadorInput}>
                            <ion-icon name="search-outline"></ion-icon>
                            <input
                                type="text"
                                placeholder="Buscar conversaciones..."
                                value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <div className={estilos.conversacionesList}>
                    {conversaciones.length > 0 ? conversaciones.map((conversacion) => (
                        <div 
                            key={conversacion.id}
                            className={`${estilos.conversacionItem} ${
                                conversacionActiva?.id === conversacion.id ? estilos.active : ''
                            }`}
                            onClick={() => manejarSeleccionarConversacion(conversacion)}
                        >
                            <div className={estilos.conversacionAvatar}>
                                {conversacion.foto_perfil_url ? (
                                    <img src={conversacion.foto_perfil_url} alt="Avatar" />
                                ) : (
                                    <ion-icon name="person-outline"></ion-icon>
                                )}
                                <div 
                                    className={estilos.plataformaIndicador}
                                    style={{ backgroundColor: obtenerColorPlataforma(conversacion.plataforma) }}
                                >
                                    <ion-icon name={obtenerIconoPorPlataforma(conversacion.plataforma)}></ion-icon>
                                </div>
                            </div>
                            
                            <div className={estilos.conversacionInfo}>
                                <div className={estilos.conversacionHeader}>
                                    <h4 className={estilos.contactoNombre}>
                                        {conversacion.contacto_nombre || 'Sin nombre'}
                                    </h4>
                                    <span className={estilos.fechaUltima}>
                                        {formatearFecha(conversacion.fecha_ultima_actividad)}
                                    </span>
                                </div>
                                
                                <p className={estilos.ultimoMensaje}>
                                    {conversacion.ultimo_mensaje || 'Sin mensajes'}
                                </p>
                                
                                <div className={estilos.conversacionFooter}>
                                    <span className={`${estilos.estadoBadge} ${estilos[obtenerColorPorEstado(conversacion.estado)]}`}>
                                        {conversacion.estado.replace('_', ' ')}
                                    </span>
                                    
                                    {conversacion.agente_nombre && (
                                        <span className={estilos.agenteAsignado}>
                                            <ion-icon name="person-circle-outline"></ion-icon>
                                            {conversacion.agente_nombre}
                                        </span>
                                    )}
                                </div>
                            </div>
                            
                            {conversacion.mensajes_no_leidos > 0 && (
                                <div className={estilos.mensajesNoLeidos}>
                                    {conversacion.mensajes_no_leidos}
                                </div>
                            )}
                        </div>
                    )) : (
                        <div className={estilos.emptyState}>
                            <ion-icon name="chatbubbles-outline"></ion-icon>
                            <p>No se encontraron conversaciones</p>
                        </div>
                    )}
                </div>
            </div>

            <div className={estilos.chatPanel}>
                {conversacionActiva ? (
                    <>
                        <div className={estilos.chatHeader}>
                            <div className={estilos.contactoInfo}>
                                <div className={estilos.contactoAvatar}>
                                    {conversacionActiva.foto_perfil_url ? (
                                        <img src={conversacionActiva.foto_perfil_url} alt="Avatar" />
                                    ) : (
                                        <ion-icon name="person-outline"></ion-icon>
                                    )}
                                </div>
                                
                                <div className={estilos.contactoDetalles}>
                                    <h3>{conversacionActiva.contacto_nombre || 'Sin nombre'}</h3>
                                    <div className={estilos.contactoMeta}>
                                        <span 
                                            className={estilos.plataforma}
                                            style={{ color: obtenerColorPlataforma(conversacionActiva.plataforma) }}
                                        >
                                            <ion-icon name={obtenerIconoPorPlataforma(conversacionActiva.plataforma)}></ion-icon>
                                            {conversacionActiva.plataforma}
                                        </span>
                                        {conversacionActiva.contacto_telefono && (
                                            <span className={estilos.telefono}>
                                                {conversacionActiva.contacto_telefono}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            
                            <div className={estilos.chatAcciones}>
                                {(usuario.rol === 'admin' || usuario.rol === 'superadmin') && (
                                    <div className={estilos.accionGrupo}>
                                        <select
                                            value={conversacionActiva.asignada_a || ''}
                                            onChange={(e) => manejarAsignarConversacion(e.target.value || null)}
                                            className={estilos.selectAsignar}
                                        >
                                            <option value="">Sin asignar</option>
                                            {usuarios.map(u => (
                                                <option key={u.id} value={u.id}>
                                                    {u.nombre} {u.apellidos}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                
                                <div className={estilos.accionGrupo}>
                                    <select
                                        value={conversacionActiva.estado}
                                        onChange={(e) => manejarCambiarEstado(e.target.value)}
                                        className={estilos.selectEstado}
                                    >
                                        <option value="abierta">Abierta</option>
                                        <option value="en_proceso">En proceso</option>
                                        <option value="cerrada">Cerrada</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {mensajeError && (
                            <div className={estilos.mensajeError}>
                                <ion-icon name="alert-circle-outline"></ion-icon>
                                {mensajeError}
                                <button onClick={() => setMensajeError('')}>
                                    <ion-icon name="close-outline"></ion-icon>
                                </button>
                            </div>
                        )}

                        <div className={estilos.mensajesContainer} ref={mensajesRef}>
                            {loadingMensajes ? (
                                <div className={estilos.mensajesLoading}>
                                    <div className={estilos.loadingSpinner}></div>
                                </div>
                            ) : mensajes.length > 0 ? (
                                mensajes.map((mensaje) => (
                                    <div 
                                        key={mensaje.id}
                                        className={`${estilos.mensajeItem} ${
                                            mensaje.direccion === 'saliente' ? estilos.enviado : estilos.recibido
                                        }`}
                                    >
                                        <div className={estilos.mensajeContenido}>
                                            {mensaje.tipo_mensaje === 'texto' && (
                                                <p>{mensaje.contenido}</p>
                                            )}
                                            
                                            {mensaje.tipo_mensaje === 'imagen' && (
                                                <div className={estilos.mensajeImagen}>
                                                    <img src={mensaje.archivo_url} alt="Imagen" />
                                                    {mensaje.contenido && <p>{mensaje.contenido}</p>}
                                                </div>
                                            )}
                                            
                                            {['video', 'audio', 'documento'].includes(mensaje.tipo_mensaje) && (
                                                <div className={estilos.mensajeArchivo}>
                                                    <ion-icon name="document-outline"></ion-icon>
                                                    <span>{mensaje.tipo_mensaje.toUpperCase()}</span>
                                                    {mensaje.contenido && <p>{mensaje.contenido}</p>}
                                                </div>
                                            )}
                                            
                                            <div className={estilos.mensajeMeta}>
                                                <span className={estilos.mensajeFecha}>
                                                    {formatearFecha(mensaje.fecha_envio)}
                                                </span>
                                                
                                                {mensaje.direccion === 'saliente' && (
                                                    <span className={`${estilos.mensajeEstado} ${estilos[mensaje.estado_entrega]}`}>
                                                        <ion-icon name={
                                                            mensaje.estado_entrega === 'enviado' ? 'checkmark-outline' :
                                                            mensaje.estado_entrega === 'entregado' ? 'checkmark-done-outline' :
                                                            mensaje.estado_entrega === 'leido' ? 'checkmark-done-outline' :
                                                            'close-outline'
                                                        }></ion-icon>
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        
                                        {mensaje.enviado_por && mensaje.agente_nombre && (
                                            <div className={estilos.mensajeAgente}>
                                                {mensaje.agente_nombre}
                                            </div>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className={estilos.emptyMensajes}>
                                    <ion-icon name="chatbubble-outline"></ion-icon>
                                    <p>No hay mensajes en esta conversacion</p>
                                </div>
                            )}
                        </div>

                        <div className={estilos.mensajeInputContainer}>
                            <form onSubmit={manejarEnviarMensaje} className={estilos.mensajeForm}>
                                <div className={estilos.inputGroup}>
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={nuevoMensaje}
                                        onChange={(e) => setNuevoMensaje(e.target.value)}
                                        placeholder="Escribe un mensaje..."
                                        disabled={enviandoMensaje}
                                        className={estilos.mensajeInput}
                                        autoComplete="off"
                                    />
                                    
                                    <button 
                                        type="submit" 
                                        disabled={!nuevoMensaje.trim() || enviandoMensaje}
                                        className={estilos.enviarButton}
                                    >
                                        {enviandoMensaje ? (
                                            <div className={estilos.loadingSpinner}></div>
                                        ) : (
                                            <ion-icon name="send-outline"></ion-icon>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </>
                ) : (
                    <div className={estilos.noChatSelected}>
                        <ion-icon name="chatbubbles-outline"></ion-icon>
                        <h3>Selecciona una conversacion</h3>
                        <p>Elige una conversacion de la lista para comenzar a chatear</p>
                    </div>
                )}
            </div>
        </div>
    )
}