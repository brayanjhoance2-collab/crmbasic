"use client"
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import estilos from "./automatizacion.module.css"
import { 
    obtenerUsuarioActual,
    obtenerAutomatizaciones,
    crearAutomatizacion,
    actualizarAutomatizacion,
    eliminarAutomatizacion,
    activarDesactivarAutomatizacion,
    obtenerPlantillasMensajes,
    crearPlantillaMensaje,
    actualizarPlantillaMensaje,
    eliminarPlantillaMensaje,
    obtenerTriggers,
    probarAutomatizacion
} from "./servidor"

export default function AutomatizacionPage() {
    const router = useRouter()
    const [usuario, setUsuario] = useState(null)
    const [loading, setLoading] = useState(true)
    const [seccionActiva, setSeccionActiva] = useState('automatizaciones')
    
    // Estados para automatizaciones
    const [automatizaciones, setAutomatizaciones] = useState([])
    const [modalAbierto, setModalAbierto] = useState(false)
    const [tipoModal, setTipoModal] = useState('')
    const [automatizacionSeleccionada, setAutomatizacionSeleccionada] = useState(null)
    const [guardandoAutomatizacion, setGuardandoAutomatizacion] = useState(false)
    
    // Estados para plantillas
    const [plantillas, setPlantillas] = useState([])
    const [plantillaSeleccionada, setPlantillaSeleccionada] = useState(null)
    const [modalPlantilla, setModalPlantilla] = useState(false)
    const [tipoModalPlantilla, setTipoModalPlantilla] = useState('')
    const [guardandoPlantilla, setGuardandoPlantilla] = useState(false)
    
    // Estados para triggers
    const [triggers, setTriggers] = useState([])
    const [triggersFiltro, setTriggersFiltro] = useState('todos')
    
    // Estados de formularios
    const [formAutomatizacion, setFormAutomatizacion] = useState({
        nombre: '',
        descripcion: '',
        trigger_tipo: 'mensaje_recibido',
        trigger_condicion: '',
        accion_tipo: 'enviar_mensaje',
        accion_contenido: '',
        plantilla_id: '',
        plataformas: ['whatsapp'],
        activa: true,
        prioridad: 1
    })
    
    const [formPlantilla, setFormPlantilla] = useState({
        nombre: '',
        categoria: 'general',
        contenido: '',
        variables: '',
        plataforma: 'todas'
    })
    
    const [mensajeError, setMensajeError] = useState('')
    const [mensajeExito, setMensajeExito] = useState('')
    const [probandoAutomatizacion, setProbandoAutomatizacion] = useState(false)

    // Función helper para parsear plataformas
    const parsearPlataformas = (plataformas) => {
        try {
            if (typeof plataformas === 'string') {
                return JSON.parse(plataformas);
            }
            if (Array.isArray(plataformas)) {
                return plataformas;
            }
            return ['whatsapp'];
        } catch (e) {
            return ['whatsapp'];
        }
    };

    useEffect(() => {
        verificarYCargarDatos()
    }, [])

    useEffect(() => {
        if (seccionActiva === 'automatizaciones') {
            cargarAutomatizaciones()
        } else if (seccionActiva === 'plantillas') {
            cargarPlantillas()
        } else if (seccionActiva === 'triggers') {
            cargarTriggers()
        }
    }, [seccionActiva])

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
            await cargarAutomatizaciones()
            
        } catch (error) {
            console.log('Error al verificar usuario:', error)
            router.push('/login')
        } finally {
            setLoading(false)
        }
    }

    const cargarAutomatizaciones = async () => {
        try {
            const data = await obtenerAutomatizaciones()
            setAutomatizaciones(data)
        } catch (error) {
            console.log('Error al cargar automatizaciones:', error)
            setMensajeError('Error al cargar automatizaciones')
        }
    }

    const cargarPlantillas = async () => {
        try {
            const data = await obtenerPlantillasMensajes()
            setPlantillas(data)
        } catch (error) {
            console.log('Error al cargar plantillas:', error)
            setMensajeError('Error al cargar plantillas')
        }
    }

    const cargarTriggers = async () => {
        try {
            const data = await obtenerTriggers(triggersFiltro)
            setTriggers(data)
        } catch (error) {
            console.log('Error al cargar triggers:', error)
            setMensajeError('Error al cargar triggers')
        }
    }

    const abrirModal = (tipo, automatizacion = null) => {
        setTipoModal(tipo)
        setAutomatizacionSeleccionada(automatizacion)
        setMensajeError('')
        setMensajeExito('')
        
        if (automatizacion && tipo === 'editar') {
            setFormAutomatizacion({
                nombre: automatizacion.nombre || '',
                descripcion: automatizacion.descripcion || '',
                trigger_tipo: automatizacion.trigger_tipo || 'mensaje_recibido',
                trigger_condicion: automatizacion.trigger_condicion || '',
                accion_tipo: automatizacion.accion_tipo || 'enviar_mensaje',
                accion_contenido: automatizacion.accion_contenido || '',
                plantilla_id: automatizacion.plantilla_id || '',
                plataformas: parsearPlataformas(automatizacion.plataformas),
                activa: automatizacion.activa || false,
                prioridad: automatizacion.prioridad || 1
            })
        } else {
            setFormAutomatizacion({
                nombre: '',
                descripcion: '',
                trigger_tipo: 'mensaje_recibido',
                trigger_condicion: '',
                accion_tipo: 'enviar_mensaje',
                accion_contenido: '',
                plantilla_id: '',
                plataformas: ['whatsapp'],
                activa: true,
                prioridad: 1
            })
        }
        
        setModalAbierto(true)
    }

    const abrirModalPlantilla = (tipo, plantilla = null) => {
        setTipoModalPlantilla(tipo)
        setPlantillaSeleccionada(plantilla)
        setMensajeError('')
        setMensajeExito('')
        
        if (plantilla && tipo === 'editar') {
            setFormPlantilla({
                nombre: plantilla.nombre || '',
                categoria: plantilla.categoria || 'general',
                contenido: plantilla.contenido || '',
                variables: plantilla.variables ? (typeof plantilla.variables === 'string' ? plantilla.variables : JSON.stringify(plantilla.variables)) : '',
                plataforma: plantilla.plataforma || 'todas'
            })
        } else {
            setFormPlantilla({
                nombre: '',
                categoria: 'general',
                contenido: '',
                variables: '',
                plataforma: 'todas'
            })
        }
        
        setModalPlantilla(true)
    }

    const cerrarModal = () => {
        setModalAbierto(false)
        setTipoModal('')
        setAutomatizacionSeleccionada(null)
        setMensajeError('')
        setMensajeExito('')
    }

    const cerrarModalPlantilla = () => {
        setModalPlantilla(false)
        setTipoModalPlantilla('')
        setPlantillaSeleccionada(null)
        setMensajeError('')
        setMensajeExito('')
    }

    const manejarGuardarAutomatizacion = async (e) => {
        e.preventDefault()
        
        try {
            setGuardandoAutomatizacion(true)
            setMensajeError('')
            
            const datos = {
                ...formAutomatizacion,
                plataformas: JSON.stringify(formAutomatizacion.plataformas)
            }
            
            let resultado
            if (tipoModal === 'nueva') {
                resultado = await crearAutomatizacion(datos)
            } else {
                resultado = await actualizarAutomatizacion(automatizacionSeleccionada.id, datos)
            }
            
            if (resultado.success) {
                setMensajeExito(resultado.message)
                await cargarAutomatizaciones()
                setTimeout(() => {
                    cerrarModal()
                }, 1500)
            } else {
                setMensajeError(resultado.message || 'Error al guardar')
            }
            
        } catch (error) {
            console.log('Error al guardar automatización:', error)
            setMensajeError(error.message || 'Error al guardar automatización')
        } finally {
            setGuardandoAutomatizacion(false)
        }
    }

    const manejarGuardarPlantilla = async (e) => {
        e.preventDefault()
        
        try {
            setGuardandoPlantilla(true)
            setMensajeError('')
            
            let variablesParsed = null
            if (formPlantilla.variables) {
                try {
                    variablesParsed = JSON.parse(formPlantilla.variables)
                } catch (e) {
                    setMensajeError('Variables JSON no válidas')
                    return
                }
            }
            
            const datos = {
                ...formPlantilla,
                variables: variablesParsed
            }
            
            let resultado
            if (tipoModalPlantilla === 'nueva') {
                resultado = await crearPlantillaMensaje(datos)
            } else {
                resultado = await actualizarPlantillaMensaje(plantillaSeleccionada.id, datos)
            }
            
            if (resultado.success) {
                setMensajeExito(resultado.message)
                await cargarPlantillas()
                setTimeout(() => {
                    cerrarModalPlantilla()
                }, 1500)
            } else {
                setMensajeError(resultado.message || 'Error al guardar')
            }
            
        } catch (error) {
            console.log('Error al guardar plantilla:', error)
            setMensajeError(error.message || 'Error al guardar plantilla')
        } finally {
            setGuardandoPlantilla(false)
        }
    }

    const manejarEliminarAutomatizacion = async (id) => {
        if (!window.confirm('¿Estás seguro de eliminar esta automatización?')) return
        
        try {
            const resultado = await eliminarAutomatizacion(id)
            if (resultado.success) {
                setMensajeExito('Automatización eliminada')
                await cargarAutomatizaciones()
            } else {
                setMensajeError(resultado.message || 'Error al eliminar')
            }
        } catch (error) {
            console.log('Error al eliminar automatización:', error)
            setMensajeError('Error al eliminar automatización')
        }
    }

    const manejarEliminarPlantilla = async (id) => {
        if (!window.confirm('¿Estás seguro de eliminar esta plantilla?')) return
        
        try {
            const resultado = await eliminarPlantillaMensaje(id)
            if (resultado.success) {
                setMensajeExito('Plantilla eliminada')
                await cargarPlantillas()
            } else {
                setMensajeError(resultado.message || 'Error al eliminar')
            }
        } catch (error) {
            console.log('Error al eliminar plantilla:', error)
            setMensajeError('Error al eliminar plantilla')
        }
    }

    const manejarActivarDesactivar = async (id, activa) => {
        try {
            const resultado = await activarDesactivarAutomatizacion(id, !activa)
            if (resultado.success) {
                await cargarAutomatizaciones()
            } else {
                setMensajeError(resultado.message || 'Error al cambiar estado')
            }
        } catch (error) {
            console.log('Error al cambiar estado:', error)
            setMensajeError('Error al cambiar estado')
        }
    }

    const manejarProbarAutomatizacion = async (id) => {
        try {
            setProbandoAutomatizacion(true)
            const resultado = await probarAutomatizacion(id)
            
            if (resultado.success) {
                setMensajeExito('Automatización probada exitosamente: ' + resultado.message)
            } else {
                setMensajeError('Error en la prueba: ' + resultado.message)
            }
        } catch (error) {
            console.log('Error al probar automatización:', error)
            setMensajeError('Error al probar automatización')
        } finally {
            setProbandoAutomatizacion(false)
        }
    }

    const manejarCambioPlataforma = (plataforma) => {
        const plataformasActuales = formAutomatizacion.plataformas
        if (plataformasActuales.includes(plataforma)) {
            setFormAutomatizacion({
                ...formAutomatizacion,
                plataformas: plataformasActuales.filter(p => p !== plataforma)
            })
        } else {
            setFormAutomatizacion({
                ...formAutomatizacion,
                plataformas: [...plataformasActuales, plataforma]
            })
        }
    }

    const obtenerIconoTrigger = (tipo) => {
        switch(tipo) {
            case 'mensaje_recibido': return 'mail-outline'
            case 'nueva_conversacion': return 'chatbubble-outline'
            case 'palabra_clave': return 'key-outline'
            case 'tiempo_respuesta': return 'time-outline'
            case 'horario': return 'alarm-outline'
            default: return 'flash-outline'
        }
    }

    const obtenerIconoAccion = (tipo) => {
        switch(tipo) {
            case 'enviar_mensaje': return 'send-outline'
            case 'asignar_agente': return 'person-add-outline'
            case 'cambiar_estado': return 'swap-horizontal-outline'
            case 'etiquetar': return 'pricetag-outline'
            case 'webhook': return 'link-outline'
            default: return 'settings-outline'
        }
    }

    if (loading) {
        return (
            <div className={estilos.loadingContainer}>
                <div className={estilos.loadingSpinner}></div>
                <p>Cargando automatización...</p>
            </div>
        )
    }

    return (
        <div className={estilos.automatizacionContainer}>
            {/* Navegación de secciones */}
            <div className={estilos.navegacionSecciones}>
                <button
                    className={`${estilos.seccionBtn} ${seccionActiva === 'automatizaciones' ? estilos.activo : ''}`}
                    onClick={() => setSeccionActiva('automatizaciones')}
                >
                    <ion-icon name="flash-outline"></ion-icon>
                    <span>Automatizaciones</span>
                    <span className={estilos.contador}>{automatizaciones.length}</span>
                </button>
                
                <button
                    className={`${estilos.seccionBtn} ${seccionActiva === 'plantillas' ? estilos.activo : ''}`}
                    onClick={() => setSeccionActiva('plantillas')}
                >
                    <ion-icon name="document-text-outline"></ion-icon>
                    <span>Plantillas</span>
                    <span className={estilos.contador}>{plantillas.length}</span>
                </button>
                
                <button
                    className={`${estilos.seccionBtn} ${seccionActiva === 'triggers' ? estilos.activo : ''}`}
                    onClick={() => setSeccionActiva('triggers')}
                >
                    <ion-icon name="analytics-outline"></ion-icon>
                    <span>Actividad</span>
                    <span className={estilos.contador}>{triggers.length}</span>
                </button>
            </div>

            {/* Mensajes de estado */}
            {mensajeError && (
                <div className={estilos.mensajeError}>
                    <ion-icon name="alert-circle-outline"></ion-icon>
                    {mensajeError}
                    <button onClick={() => setMensajeError('')}>
                        <ion-icon name="close-outline"></ion-icon>
                    </button>
                </div>
            )}

            {mensajeExito && (
                <div className={estilos.mensajeExito}>
                    <ion-icon name="checkmark-circle-outline"></ion-icon>
                    {mensajeExito}
                    <button onClick={() => setMensajeExito('')}>
                        <ion-icon name="close-outline"></ion-icon>
                    </button>
                </div>
            )}

            {/* Contenido por sección */}
            {seccionActiva === 'automatizaciones' && (
                <div className={estilos.seccionContent}>
                    <div className={estilos.seccionHeader}>
                        <h2>Automatizaciones</h2>
                        <button 
                            className={estilos.botonNuevo}
                            onClick={() => abrirModal('nueva')}
                        >
                            <ion-icon name="add-outline"></ion-icon>
                            Nueva Automatización
                        </button>
                    </div>

                    {automatizaciones.length > 0 ? (
                        <div className={estilos.automatizacionesGrid}>
                            {automatizaciones.map(automatizacion => (
                                <div 
                                    key={automatizacion.id} 
                                    className={`${estilos.automatizacionCard} ${!automatizacion.activa ? estilos.inactiva : ''}`}
                                >
                                    <div className={estilos.cardHeader}>
                                        <div className={estilos.cardTitulo}>
                                            <h3>{automatizacion.nombre}</h3>
                                            <div className={estilos.cardEstado}>
                                                <label className={estilos.switch}>
                                                    <input
                                                        type="checkbox"
                                                        checked={automatizacion.activa}
                                                        onChange={() => manejarActivarDesactivar(automatizacion.id, automatizacion.activa)}
                                                    />
                                                    <span className={estilos.slider}></span>
                                                </label>
                                            </div>
                                        </div>
                                        {automatizacion.descripcion && (
                                            <p className={estilos.cardDescripcion}>{automatizacion.descripcion}</p>
                                        )}
                                    </div>

                                    <div className={estilos.cardContent}>
                                        <div className={estilos.triggerAccion}>
                                            <div className={estilos.triggerInfo}>
                                                <div className={estilos.iconoTrigger}>
                                                    <ion-icon name={obtenerIconoTrigger(automatizacion.trigger_tipo)}></ion-icon>
                                                </div>
                                                <div>
                                                    <span className={estilos.tipoLabel}>Trigger</span>
                                                    <span className={estilos.tipoValue}>{automatizacion.trigger_tipo}</span>
                                                </div>
                                            </div>

                                            <div className={estilos.flecha}>
                                                <ion-icon name="arrow-forward-outline"></ion-icon>
                                            </div>

                                            <div className={estilos.accionInfo}>
                                                <div className={estilos.iconoAccion}>
                                                    <ion-icon name={obtenerIconoAccion(automatizacion.accion_tipo)}></ion-icon>
                                                </div>
                                                <div>
                                                    <span className={estilos.tipoLabel}>Acción</span>
                                                    <span className={estilos.tipoValue}>{automatizacion.accion_tipo}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className={estilos.cardMeta}>
                                            <div className={estilos.plataformas}>
                                                {parsearPlataformas(automatizacion.plataformas).map(plataforma => (
                                                    <span key={plataforma} className={`${estilos.plataformaBadge} ${estilos[plataforma]}`}>
                                                        {plataforma}
                                                    </span>
                                                ))}
                                            </div>
                                            <div className={estilos.prioridad}>
                                                Prioridad: {automatizacion.prioridad}
                                            </div>
                                        </div>
                                    </div>

                                    <div className={estilos.cardAcciones}>
                                        <button
                                            className={estilos.botonProbar}
                                            onClick={() => manejarProbarAutomatizacion(automatizacion.id)}
                                            disabled={probandoAutomatizacion}
                                        >
                                            <ion-icon name="play-outline"></ion-icon>
                                            Probar
                                        </button>
                                        
                                        <button
                                            className={estilos.botonEditar}
                                            onClick={() => abrirModal('editar', automatizacion)}
                                        >
                                            <ion-icon name="create-outline"></ion-icon>
                                            Editar
                                        </button>
                                        
                                        <button
                                            className={estilos.botonEliminar}
                                            onClick={() => manejarEliminarAutomatizacion(automatizacion.id)}
                                        >
                                            <ion-icon name="trash-outline"></ion-icon>
                                            Eliminar
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className={estilos.emptyState}>
                            <ion-icon name="flash-outline"></ion-icon>
                            <h3>No hay automatizaciones</h3>
                            <p>Crea tu primera automatización para gestionar conversaciones automáticamente</p>
                            <button 
                                className={estilos.botonCrearPrimero}
                                onClick={() => abrirModal('nueva')}
                            >
                                <ion-icon name="add-outline"></ion-icon>
                                Crear Automatización
                            </button>
                        </div>
                    )}
                </div>
            )}

            {seccionActiva === 'plantillas' && (
                <div className={estilos.seccionContent}>
                    <div className={estilos.seccionHeader}>
                        <h2>Plantillas de Mensajes</h2>
                        <button 
                            className={estilos.botonNuevo}
                            onClick={() => abrirModalPlantilla('nueva')}
                        >
                            <ion-icon name="add-outline"></ion-icon>
                            Nueva Plantilla
                        </button>
                    </div>

                    {plantillas.length > 0 ? (
                        <div className={estilos.plantillasGrid}>
                            {plantillas.map(plantilla => (
                                <div key={plantilla.id} className={estilos.plantillaCard}>
                                    <div className={estilos.cardHeader}>
                                        <h3>{plantilla.nombre}</h3>
                                        <span className={estilos.categoria}>{plantilla.categoria}</span>
                                    </div>

                                    <div className={estilos.plantillaContent}>
                                        <p>{plantilla.contenido}</p>
                                    </div>

                                    <div className={estilos.plantillaMeta}>
                                        <span className={estilos.plataforma}>{plantilla.plataforma}</span>
                                        <span className={estilos.usos}>Usado {plantilla.veces_usada || 0} veces</span>
                                    </div>

                                    <div className={estilos.cardAcciones}>
                                        <button
                                            className={estilos.botonEditar}
                                            onClick={() => abrirModalPlantilla('editar', plantilla)}
                                        >
                                            <ion-icon name="create-outline"></ion-icon>
                                            Editar
                                        </button>
                                        
                                        <button
                                            className={estilos.botonEliminar}
                                            onClick={() => manejarEliminarPlantilla(plantilla.id)}
                                        >
                                            <ion-icon name="trash-outline"></ion-icon>
                                            Eliminar
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className={estilos.emptyState}>
                            <ion-icon name="document-text-outline"></ion-icon>
                            <h3>No hay plantillas</h3>
                            <p>Crea plantillas de mensajes para usar en automatizaciones</p>
                            <button 
                                className={estilos.botonCrearPrimero}
                                onClick={() => abrirModalPlantilla('nueva')}
                            >
                                <ion-icon name="add-outline"></ion-icon>
                                Crear Plantilla
                            </button>
                        </div>
                    )}
                </div>
            )}

            {seccionActiva === 'triggers' && (
                <div className={estilos.seccionContent}>
                    <div className={estilos.seccionHeader}>
                        <h2>Actividad de Automatizaciones</h2>
                        <select
                            value={triggersFiltro}
                            onChange={(e) => setTriggersFiltro(e.target.value)}
                            className={estilos.filtroSelect}
                        >
                            <option value="todos">Todos</option>
                            <option value="ejecutados">Ejecutados</option>
                            <option value="fallidos">Fallidos</option>
                        </select>
                    </div>

                    {triggers.length > 0 ? (
                        <div className={estilos.triggersList}>
                            {triggers.map(trigger => (
                                <div 
                                    key={trigger.id} 
                                    className={`${estilos.triggerItem} ${trigger.estado === 'fallido' ? estilos.fallido : ''}`}
                                >
                                    <div className={estilos.triggerInfo}>
                                        <div className={estilos.triggerIcono}>
                                            <ion-icon name={trigger.estado === 'ejecutado' ? 'checkmark-circle' : 'close-circle'}></ion-icon>
                                        </div>
                                        <div className={estilos.triggerDetalles}>
                                            <h4>{trigger.automatizacion_nombre}</h4>
                                            <p>Trigger: {trigger.trigger_tipo} → Acción: {trigger.accion_ejecutada}</p>
                                            <span className={estilos.fecha}>{new Date(trigger.fecha_ejecucion).toLocaleString('es-ES')}</span>
                                        </div>
                                    </div>
                                    {trigger.error_mensaje && (
                                        <div className={estilos.errorMensaje}>
                                            <ion-icon name="warning-outline"></ion-icon>
                                            {trigger.error_mensaje}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className={estilos.emptyState}>
                            <ion-icon name="analytics-outline"></ion-icon>
                            <h3>No hay actividad</h3>
                            <p>La actividad de automatizaciones aparecerá aquí</p>
                        </div>
                    )}
                </div>
            )}

            {/* Modal Automatización */}
            {modalAbierto && (
                <div className={estilos.modalOverlay} onClick={cerrarModal}>
                    <div className={estilos.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={estilos.modalHeader}>
                            <h2>
                                {tipoModal === 'nueva' ? 'Nueva Automatización' : 'Editar Automatización'}
                            </h2>
                            <button className={estilos.botonCerrarModal} onClick={cerrarModal}>
                                <ion-icon name="close-outline"></ion-icon>
                            </button>
                        </div>
                        
                        <div className={estilos.modalContent}>
                            <form onSubmit={manejarGuardarAutomatizacion} className={estilos.formulario}>
                                <div className={estilos.campoFormulario}>
                                    <label>Nombre</label>
                                    <input
                                        type="text"
                                        value={formAutomatizacion.nombre}
                                        onChange={(e) => setFormAutomatizacion({...formAutomatizacion, nombre: e.target.value})}
                                        required
                                        placeholder="Ej: Respuesta automática de saludo"
                                    />
                                </div>

                                <div className={estilos.campoFormulario}>
                                    <label>Descripción (opcional)</label>
                                    <textarea
                                        value={formAutomatizacion.descripcion}
                                        onChange={(e) => setFormAutomatizacion({...formAutomatizacion, descripcion: e.target.value})}
                                        placeholder="Describe qué hace esta automatización"
                                        rows="2"
                                    />
                                </div>

                                <div className={estilos.camposGrupo}>
                                    <div className={estilos.campoFormulario}>
                                        <label>Tipo de Trigger</label>
                                        <select
                                            value={formAutomatizacion.trigger_tipo}
                                            onChange={(e) => setFormAutomatizacion({...formAutomatizacion, trigger_tipo: e.target.value})}
                                        >
                                            <option value="mensaje_recibido">Mensaje Recibido</option>
                                            <option value="nueva_conversacion">Nueva Conversación</option>
                                            <option value="palabra_clave">Palabra Clave</option>
                                            <option value="tiempo_respuesta">Tiempo de Respuesta</option>
                                            <option value="horario">Horario Específico</option>
                                        </select>
                                    </div>

                                    <div className={estilos.campoFormulario}>
                                        <label>Condición del Trigger</label>
                                        <input
                                            type="text"
                                            value={formAutomatizacion.trigger_condicion}
                                            onChange={(e) => setFormAutomatizacion({...formAutomatizacion, trigger_condicion: e.target.value})}
                                            placeholder="Ej: hola, buenos días, precio"
                                        />
                                        <small>Para palabra clave, separa con comas. Para tiempo, usa minutos (ej: 30)</small>
                                    </div>
                                </div>

                                <div className={estilos.camposGrupo}>
                                    <div className={estilos.campoFormulario}>
                                        <label>Tipo de Acción</label>
                                        <select
                                            value={formAutomatizacion.accion_tipo}
                                            onChange={(e) => setFormAutomatizacion({...formAutomatizacion, accion_tipo: e.target.value})}
                                        >
                                            <option value="enviar_mensaje">Enviar Mensaje</option>
                                            <option value="asignar_agente">Asignar Agente</option>
                                            <option value="cambiar_estado">Cambiar Estado</option>
                                            <option value="etiquetar">Agregar Etiqueta</option>
                                            <option value="webhook">Llamar Webhook</option>
                                        </select>
                                    </div>

                                    <div className={estilos.campoFormulario}>
                                        <label>Prioridad</label>
                                        <select
                                            value={formAutomatizacion.prioridad}
                                            onChange={(e) => setFormAutomatizacion({...formAutomatizacion, prioridad: parseInt(e.target.value)})}
                                        >
                                            <option value={1}>Alta (1)</option>
                                            <option value={2}>Media (2)</option>
                                            <option value={3}>Baja (3)</option>
                                        </select>
                                    </div>
                                </div>

                                <div className={estilos.campoFormulario}>
                                    <label>Contenido de la Acción</label>
                                    <textarea
                                        value={formAutomatizacion.accion_contenido}
                                        onChange={(e) => setFormAutomatizacion({...formAutomatizacion, accion_contenido: e.target.value})}
                                        placeholder="Mensaje a enviar, ID del agente, estado, etiqueta, URL del webhook..."
                                        rows="3"
                                        required
                                    />
                                </div>

                                <div className={estilos.campoFormulario}>
                                    <label>Plataformas</label>
                                    <div className={estilos.checkboxGroup}>
                                        {['whatsapp', 'instagram', 'facebook'].map(plataforma => (
                                            <label key={plataforma} className={estilos.checkboxLabel}>
                                                <input
                                                    type="checkbox"
                                                    checked={formAutomatizacion.plataformas.includes(plataforma)}
                                                    onChange={() => manejarCambioPlataforma(plataforma)}
                                                />
                                                <span className={estilos.checkboxText}>{plataforma}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div className={estilos.campoFormulario}>
                                    <label className={estilos.switchLabel}>
                                        <input
                                            type="checkbox"
                                            checked={formAutomatizacion.activa}
                                            onChange={(e) => setFormAutomatizacion({...formAutomatizacion, activa: e.target.checked})}
                                        />
                                        <span className={estilos.switchSlider}></span>
                                        Automatización activa
                                    </label>
                                </div>

                                {mensajeError && (
                                    <div className={estilos.mensajeError}>
                                        <ion-icon name="alert-circle-outline"></ion-icon>
                                        {mensajeError}
                                    </div>
                                )}

                                {mensajeExito && (
                                    <div className={estilos.mensajeExito}>
                                        <ion-icon name="checkmark-circle-outline"></ion-icon>
                                        {mensajeExito}
                                    </div>
                                )}

                                <div className={estilos.botonesFormulario}>
                                    <button type="button" onClick={cerrarModal} className={estilos.botonCancelar}>
                                        Cancelar
                                    </button>
                                    <button 
                                        type="submit" 
                                        disabled={guardandoAutomatizacion} 
                                        className={estilos.botonGuardar}
                                    >
                                        {guardandoAutomatizacion ? 'Guardando...' : 'Guardar'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Plantilla */}
            {modalPlantilla && (
                <div className={estilos.modalOverlay} onClick={cerrarModalPlantilla}>
                    <div className={estilos.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={estilos.modalHeader}>
                            <h2>
                                {tipoModalPlantilla === 'nueva' ? 'Nueva Plantilla' : 'Editar Plantilla'}
                            </h2>
                            <button className={estilos.botonCerrarModal} onClick={cerrarModalPlantilla}>
                                <ion-icon name="close-outline"></ion-icon>
                            </button>
                        </div>
                        
                        <div className={estilos.modalContent}>
                            <form onSubmit={manejarGuardarPlantilla} className={estilos.formulario}>
                                <div className={estilos.campoFormulario}>
                                    <label>Nombre de la Plantilla</label>
                                    <input
                                        type="text"
                                        value={formPlantilla.nombre}
                                        onChange={(e) => setFormPlantilla({...formPlantilla, nombre: e.target.value})}
                                        required
                                        placeholder="Ej: Saludo de bienvenida"
                                    />
                                </div>

                                <div className={estilos.camposGrupo}>
                                    <div className={estilos.campoFormulario}>
                                        <label>Categoría</label>
                                        <select
                                            value={formPlantilla.categoria}
                                            onChange={(e) => setFormPlantilla({...formPlantilla, categoria: e.target.value})}
                                        >
                                            <option value="general">General</option>
                                            <option value="saludo">Saludo</option>
                                            <option value="despedida">Despedida</option>
                                            <option value="informacion">Información</option>
                                            <option value="seguimiento">Seguimiento</option>
                                            <option value="soporte">Soporte</option>
                                        </select>
                                    </div>

                                    <div className={estilos.campoFormulario}>
                                        <label>Plataforma</label>
                                        <select
                                            value={formPlantilla.plataforma}
                                            onChange={(e) => setFormPlantilla({...formPlantilla, plataforma: e.target.value})}
                                        >
                                            <option value="todas">Todas</option>
                                            <option value="whatsapp">WhatsApp</option>
                                            <option value="instagram">Instagram</option>
                                            <option value="facebook">Facebook</option>
                                        </select>
                                    </div>
                                </div>

                                <div className={estilos.campoFormulario}>
                                    <label>Contenido del Mensaje</label>
                                    <textarea
                                        value={formPlantilla.contenido}
                                        onChange={(e) => setFormPlantilla({...formPlantilla, contenido: e.target.value})}
                                        placeholder="Escribe el contenido del mensaje. Usa {nombre} para variables."
                                        rows="4"
                                        required
                                    />
                                    <small>Variables disponibles: {'{nombre}'}, {'{telefono}'}, {'{fecha}'}</small>
                                </div>

                                <div className={estilos.campoFormulario}>
                                    <label>Variables Personalizadas (JSON)</label>
                                    <textarea
                                        value={formPlantilla.variables}
                                        onChange={(e) => setFormPlantilla({...formPlantilla, variables: e.target.value})}
                                        placeholder='{"variable1": "valor1", "variable2": "valor2"}'
                                        rows="2"
                                    />
                                    <small>Formato JSON para variables adicionales (opcional)</small>
                                </div>

                                {mensajeError && (
                                    <div className={estilos.mensajeError}>
                                        <ion-icon name="alert-circle-outline"></ion-icon>
                                        {mensajeError}
                                    </div>
                                )}

                                {mensajeExito && (
                                    <div className={estilos.mensajeExito}>
                                        <ion-icon name="checkmark-circle-outline"></ion-icon>
                                        {mensajeExito}
                                    </div>
                                )}

                                <div className={estilos.botonesFormulario}>
                                    <button type="button" onClick={cerrarModalPlantilla} className={estilos.botonCancelar}>
                                        Cancelar
                                    </button>
                                    <button 
                                        type="submit" 
                                        disabled={guardandoPlantilla} 
                                        className={estilos.botonGuardar}
                                    >
                                        {guardandoPlantilla ? 'Guardando...' : 'Guardar'}
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