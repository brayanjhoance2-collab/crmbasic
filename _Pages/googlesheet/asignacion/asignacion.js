"use client"
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import estilos from "./asignacion.module.css"
import {
    obtenerUsuarioActual,
    obtenerAsignacionesUsuario,
    crearAsignacion,
    actualizarAsignacion,
    eliminarAsignacion,
    obtenerHistorialEnvios,
    procesarEnviosSheet,
    enviarMensajeManual,
    obtenerEstadisticasEnvios
} from "./servidor"

export default function AsignacionComponent({ 
    spreadsheetSeleccionado, 
    sheetSeleccionado, 
    datosSheet = [] 
}) {
    const router = useRouter()
    const [usuario, setUsuario] = useState(null)
    const [loading, setLoading] = useState(true)
    const [asignaciones, setAsignaciones] = useState([])
    const [historialEnvios, setHistorialEnvios] = useState([])
    const [estadisticas, setEstadisticas] = useState(null)
    const [columnasDisponibles, setColumnasDisponibles] = useState([])
    
    // Estados de modales
    const [modalAsignacion, setModalAsignacion] = useState(false)
    const [modalHistorial, setModalHistorial] = useState(false)
    const [modalEnvioManual, setModalEnvioManual] = useState(false)
    const [tipoModal, setTipoModal] = useState('')
    const [asignacionSeleccionada, setAsignacionSeleccionada] = useState(null)
    
    // Estados de formularios
    const [formAsignacion, setFormAsignacion] = useState({
        columna_telefono: '',
        columna_nombre: '',
        columna_restriccion: '',
        mensaje_bienvenida: '',
        enviar_solo_nuevos: true,
        intervalo_horas: 24,
        valor_restriccion: 'NO'
    })
    
    const [formEnvioManual, setFormEnvioManual] = useState({
        destinatarios: [],
        mensaje_personalizado: ''
    })
    
    // Estados de control
    const [procesando, setProcesando] = useState(false)
    const [enviandoMensajes, setEnviandoMensajes] = useState(false)
    const [mensajeError, setMensajeError] = useState('')
    const [mensajeExito, setMensajeExito] = useState('')
    const [seccionActiva, setSeccionActiva] = useState('asignaciones')

    useEffect(() => {
        verificarYCargarDatos()
    }, [])

    useEffect(() => {
        if (spreadsheetSeleccionado && sheetSeleccionado && datosSheet.length > 0) {
            cargarColumnasDisponibles()
            cargarDatosAsignaciones()
        }
    }, [spreadsheetSeleccionado, sheetSeleccionado, datosSheet])

    const verificarYCargarDatos = async () => {
        try {
            setLoading(true)
            
            const usuarioData = await obtenerUsuarioActual()
            if (!usuarioData) {
                router.push('/login')
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

    const cargarColumnasDisponibles = () => {
        if (datosSheet.length > 0) {
            const headers = Object.keys(datosSheet[0])
            const columnas = headers.map((header, index) => ({
                letra: String.fromCharCode(65 + index), // A, B, C, etc.
                nombre: header,
                muestra: datosSheet[0][header] || ''
            }))
            setColumnasDisponibles(columnas)
        }
    }

    const cargarDatosAsignaciones = async () => {
        if (!spreadsheetSeleccionado || !sheetSeleccionado) return
        
        try {
            const asignacionesData = await obtenerAsignacionesUsuario(spreadsheetSeleccionado, sheetSeleccionado)
            setAsignaciones(asignacionesData)
            
            if (asignacionesData.length > 0) {
                const historialData = await obtenerHistorialEnvios(asignacionesData[0].id)
                setHistorialEnvios(historialData)
                
                const estadisticasData = await obtenerEstadisticasEnvios(asignacionesData[0].id)
                setEstadisticas(estadisticasData)
            }
            
        } catch (error) {
            console.log('Error al cargar datos de asignaciones:', error)
            setMensajeError('Error al cargar configuración de mensajes')
        }
    }

    const abrirModalAsignacion = (tipo, asignacion = null) => {
        setTipoModal(tipo)
        setAsignacionSeleccionada(asignacion)
        setMensajeError('')
        setMensajeExito('')
        
        if (asignacion && tipo === 'editar') {
            setFormAsignacion({
                columna_telefono: asignacion.columna_telefono || '',
                columna_nombre: asignacion.columna_nombre || '',
                columna_restriccion: asignacion.columna_restriccion || '',
                mensaje_bienvenida: asignacion.mensaje_bienvenida || '',
                enviar_solo_nuevos: asignacion.enviar_solo_nuevos || true,
                intervalo_horas: asignacion.intervalo_horas || 24,
                valor_restriccion: asignacion.valor_restriccion || 'NO'
            })
        } else {
            setFormAsignacion({
                columna_telefono: '',
                columna_nombre: '',
                columna_restriccion: '',
                mensaje_bienvenida: 'Hola {nombre}, bienvenido a nuestro servicio. Estamos aquí para ayudarte.',
                enviar_solo_nuevos: true,
                intervalo_horas: 24,
                valor_restriccion: 'NO'
            })
        }
        
        setModalAsignacion(true)
    }

    const cerrarModales = () => {
        setModalAsignacion(false)
        setModalHistorial(false)
        setModalEnvioManual(false)
        setTipoModal('')
        setAsignacionSeleccionada(null)
        setMensajeError('')
        setMensajeExito('')
    }

    const manejarGuardarAsignacion = async (e) => {
        e.preventDefault()
        
        if (!formAsignacion.columna_telefono || !formAsignacion.mensaje_bienvenida) {
            setMensajeError('Columna de teléfono y mensaje de bienvenida son requeridos')
            return
        }
        
        try {
            setProcesando(true)
            setMensajeError('')
            
            const datos = {
                ...formAsignacion,
                spreadsheet_id: spreadsheetSeleccionado,
                sheet_name: sheetSeleccionado
            }
            
            let resultado
            if (tipoModal === 'nueva') {
                resultado = await crearAsignacion(datos)
            } else {
                resultado = await actualizarAsignacion(asignacionSeleccionada.id, datos)
            }
            
            if (resultado.success) {
                setMensajeExito(resultado.message)
                await cargarDatosAsignaciones()
                setTimeout(() => {
                    cerrarModales()
                }, 1500)
            } else {
                setMensajeError(resultado.error || 'Error al guardar asignación')
            }
            
        } catch (error) {
            console.log('Error al guardar asignación:', error)
            setMensajeError('Error al guardar asignación')
        } finally {
            setProcesando(false)
        }
    }

    const manejarEliminarAsignacion = async (id) => {
        if (!window.confirm('¿Estás seguro de eliminar esta asignación? Esto eliminará también el historial de envíos.')) return
        
        try {
            setProcesando(true)
            const resultado = await eliminarAsignacion(id)
            
            if (resultado.success) {
                setMensajeExito('Asignación eliminada exitosamente')
                await cargarDatosAsignaciones()
            } else {
                setMensajeError(resultado.error || 'Error al eliminar asignación')
            }
            
        } catch (error) {
            console.log('Error al eliminar asignación:', error)
            setMensajeError('Error al eliminar asignación')
        } finally {
            setProcesando(false)
        }
    }

    const manejarProcesarEnvios = async (asignacionId) => {
        if (!datosSheet || datosSheet.length === 0) {
            setMensajeError('No hay datos en el Excel para procesar')
            return
        }
        
        try {
            setEnviandoMensajes(true)
            setMensajeError('')
            
            const resultado = await procesarEnviosSheet(asignacionId, datosSheet)
            
            if (resultado.success) {
                setMensajeExito(`Envíos procesados: ${resultado.enviados} enviados, ${resultado.omitidos} omitidos`)
                await cargarDatosAsignaciones()
            } else {
                setMensajeError(resultado.error || 'Error al procesar envíos')
            }
            
        } catch (error) {
            console.log('Error al procesar envíos:', error)
            setMensajeError('Error al procesar envíos automáticos')
        } finally {
            setEnviandoMensajes(false)
        }
    }

    const obtenerNumerosDisponibles = () => {
        if (!datosSheet || datosSheet.length === 0) return []
        
        const asignacion = asignaciones[0]
        if (!asignacion) {
            // Si no hay asignación, mostrar todos los números disponibles
            const headers = Object.keys(datosSheet[0])
            return datosSheet.map((fila, index) => {
                const telefono = Object.values(fila).find(val => 
                    val && typeof val === 'string' && /\d{10,}/.test(val.replace(/\D/g, ''))
                ) || ''
                const nombre = Object.values(fila).find(val => 
                    val && typeof val === 'string' && !/^\d+$/.test(val)
                ) || `Usuario ${index + 1}`
                
                return {
                    index: index,
                    telefono: telefono,
                    nombre: nombre,
                    fila: fila
                }
            }).filter(item => item.telefono && item.telefono.trim() !== '')
        }
        
        const columnaHeaderTelefono = columnasDisponibles.find(col => col.letra === asignacion.columna_telefono)?.nombre
        const columnaHeaderNombre = columnasDisponibles.find(col => col.letra === asignacion.columna_nombre)?.nombre
        
        if (!columnaHeaderTelefono) return []
        
        return datosSheet.map((fila, index) => ({
            index: index,
            telefono: fila[columnaHeaderTelefono] || '',
            nombre: columnaHeaderNombre ? (fila[columnaHeaderNombre] || '') : `Usuario ${index + 1}`,
            fila: fila
        })).filter(item => item.telefono && item.telefono.trim() !== '')
    }

    const formatearTelefono = (telefono) => {
        if (!telefono) return ''
        return telefono.replace(/[^\d]/g, '').substring(0, 15)
    }

    const formatearFecha = (fecha) => {
        if (!fecha) return ''
        return new Date(fecha).toLocaleString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    if (loading) {
        return (
            <div className={estilos.loadingContainer}>
                <div className={estilos.loadingSpinner}></div>
                <p>Cargando asignación de mensajes...</p>
            </div>
        )
    }

    if (!spreadsheetSeleccionado || !sheetSeleccionado) {
        return (
            <div className={estilos.asignacionContainer}>
                <div className={estilos.emptyState}>
                    <ion-icon name="chatbubbles-outline"></ion-icon>
                    <h3>Asignación de Mensajes WhatsApp</h3>
                    <p>Selecciona una hoja de cálculo y pestaña para configurar mensajes automáticos</p>
                </div>
            </div>
        )
    }

    return (
        <div className={estilos.asignacionContainer}>
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

            <div className={estilos.headerSection}>
                <div className={estilos.titleContainer}>
                    <h2>Mensajes Automáticos WhatsApp</h2>
                    <p>Configura envío de mensajes de bienvenida desde Google Sheets a WhatsApp</p>
                </div>

                <div className={estilos.navegacionSecciones}>
                    <button
                        className={`${estilos.seccionBtn} ${seccionActiva === 'asignaciones' ? estilos.activo : ''}`}
                        onClick={() => setSeccionActiva('asignaciones')}
                    >
                        <ion-icon name="settings-outline"></ion-icon>
                        <span>Configuración</span>
                    </button>
                    
                    <button
                        className={`${estilos.seccionBtn} ${seccionActiva === 'historial' ? estilos.activo : ''}`}
                        onClick={() => setSeccionActiva('historial')}
                    >
                        <ion-icon name="time-outline"></ion-icon>
                        <span>Historial</span>
                        {historialEnvios.length > 0 && <span className={estilos.contador}>{historialEnvios.length}</span>}
                    </button>
                    
                    <button
                        className={`${estilos.seccionBtn} ${seccionActiva === 'envio-manual' ? estilos.activo : ''}`}
                        onClick={() => setSeccionActiva('envio-manual')}
                    >
                        <ion-icon name="send-outline"></ion-icon>
                        <span>Envío Manual</span>
                    </button>
                </div>
            </div>

            {seccionActiva === 'asignaciones' && (
                <div className={estilos.seccionContent}>
                    <div className={estilos.seccionHeader}>
                        <h3>Configuración de Mensajes de Bienvenida</h3>
                        <button 
                            className={estilos.botonNuevo}
                            onClick={() => abrirModalAsignacion('nueva')}
                            disabled={asignaciones.length > 0}
                        >
                            <ion-icon name="add-outline"></ion-icon>
                            Nueva Asignación
                        </button>
                    </div>

                    {asignaciones.length > 0 ? (
                        <div className={estilos.asignacionesGrid}>
                            {asignaciones.map(asignacion => (
                                <div key={asignacion.id} className={estilos.asignacionCard}>
                                    <div className={estilos.cardHeader}>
                                        <div className={estilos.cardTitulo}>
                                            <h4>Configuración de Mensajes</h4>
                                            <span className={`${estilos.estadoBadge} ${asignacion.activa ? estilos.activo : estilos.inactivo}`}>
                                                {asignacion.activa ? 'Activa' : 'Inactiva'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className={estilos.cardContent}>
                                        <div className={estilos.columnasInfo}>
                                            <div className={estilos.columnaItem}>
                                                <span className={estilos.columnaLabel}>Teléfono:</span>
                                                <span className={estilos.columnaValue}>
                                                    Columna {asignacion.columna_telefono} - {columnasDisponibles.find(col => col.letra === asignacion.columna_telefono)?.nombre || 'N/A'}
                                                </span>
                                            </div>
                                            {asignacion.columna_nombre && (
                                                <div className={estilos.columnaItem}>
                                                    <span className={estilos.columnaLabel}>Nombre:</span>
                                                    <span className={estilos.columnaValue}>
                                                        Columna {asignacion.columna_nombre} - {columnasDisponibles.find(col => col.letra === asignacion.columna_nombre)?.nombre || 'N/A'}
                                                    </span>
                                                </div>
                                            )}
                                            {asignacion.columna_restriccion && (
                                                <div className={estilos.columnaItem}>
                                                    <span className={estilos.columnaLabel}>Restricción:</span>
                                                    <span className={estilos.columnaValue}>
                                                        Columna {asignacion.columna_restriccion} - No enviar si contiene "{asignacion.valor_restriccion}"
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        <div className={estilos.mensajesPreview}>
                                            <div className={estilos.mensajeItem}>
                                                <strong>Mensaje de Bienvenida:</strong>
                                                <p>{asignacion.mensaje_bienvenida?.substring(0, 150)}...</p>
                                            </div>
                                        </div>

                                        <div className={estilos.configuracionInfo}>
                                            <span>Intervalo: <strong>{asignacion.intervalo_horas}h</strong></span>
                                            <span>Solo nuevos: <strong>{asignacion.enviar_solo_nuevos ? 'Sí' : 'No'}</strong></span>
                                        </div>

                                        {estadisticas && (
                                            <div className={estilos.estadisticasCard}>
                                                <div className={estilos.estadItem}>
                                                    <span className={estilos.estadNumero}>{estadisticas.total_enviados || 0}</span>
                                                    <span className={estilos.estadLabel}>Enviados</span>
                                                </div>
                                                <div className={estilos.estadItem}>
                                                    <span className={estilos.estadNumero}>{estadisticas.total_fallidos || 0}</span>
                                                    <span className={estilos.estadLabel}>Fallidos</span>
                                                </div>
                                                <div className={estilos.estadItem}>
                                                    <span className={estilos.estadNumero}>{obtenerNumerosDisponibles().length}</span>
                                                    <span className={estilos.estadLabel}>Disponibles</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className={estilos.cardAcciones}>
                                        <button
                                            className={estilos.botonProcesar}
                                            onClick={() => manejarProcesarEnvios(asignacion.id)}
                                            disabled={enviandoMensajes || obtenerNumerosDisponibles().length === 0}
                                        >
                                            {enviandoMensajes ? (
                                                <>
                                                    <div className={estilos.loadingSpinner}></div>
                                                    Enviando...
                                                </>
                                            ) : (
                                                <>
                                                    <ion-icon name="send-outline"></ion-icon>
                                                    Procesar Envíos
                                                </>
                                            )}
                                        </button>
                                        
                                        <button
                                            className={estilos.botonEditar}
                                            onClick={() => abrirModalAsignacion('editar', asignacion)}
                                        >
                                            <ion-icon name="create-outline"></ion-icon>
                                            Editar
                                        </button>
                                        
                                        <button
                                            className={estilos.botonEliminar}
                                            onClick={() => manejarEliminarAsignacion(asignacion.id)}
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
                            <ion-icon name="chatbubbles-outline"></ion-icon>
                            <h3>No hay asignaciones configuradas</h3>
                            <p>Crea tu primera asignación para enviar mensajes automáticos de bienvenida a WhatsApp</p>
                            <button 
                                className={estilos.botonCrearPrimero}
                                onClick={() => abrirModalAsignacion('nueva')}
                            >
                                <ion-icon name="add-outline"></ion-icon>
                                Crear Primera Asignación
                            </button>
                        </div>
                    )}
                </div>
            )}

            {seccionActiva === 'historial' && (
                <div className={estilos.seccionContent}>
                    <div className={estilos.seccionHeader}>
                        <h3>Historial de Envíos</h3>
                        <span className={estilos.totalEnvios}>
                            Total: {historialEnvios.length} envíos
                        </span>
                    </div>

                    {historialEnvios.length > 0 ? (
                        <div className={estilos.historialList}>
                            {historialEnvios.map(envio => (
                                <div key={envio.id} className={`${estilos.historialItem} ${estilos[envio.estado_envio]}`}>
                                    <div className={estilos.historialInfo}>
                                        <div className={estilos.historialIcono}>
                                            <ion-icon name={
                                                envio.estado_envio === 'enviado' ? 'checkmark-circle' :
                                                envio.estado_envio === 'fallido' ? 'close-circle' :
                                                envio.estado_envio === 'pendiente' ? 'time' : 'pause-circle'
                                            }></ion-icon>
                                        </div>
                                        <div className={estilos.historialDetalles}>
                                            <h4>{envio.nombre_destinatario || 'Sin nombre'}</h4>
                                            <p>
                                                <strong>Teléfono:</strong> {formatearTelefono(envio.numero_telefono)}
                                                <span className={estilos.separador}>|</span>
                                                <strong>Tipo:</strong> {envio.tipo_mensaje}
                                            </p>
                                            <p className={estilos.mensajePreview}>
                                                {envio.contenido_mensaje?.substring(0, 150)}...
                                            </p>
                                            <div className={estilos.fechasInfo}>
                                                <span>Programado: {formatearFecha(envio.fecha_programado)}</span>
                                                {envio.fecha_enviado && (
                                                    <span>Enviado: {formatearFecha(envio.fecha_enviado)}</span>
                                                )}
                                            </div>
                                            {envio.error_envio && (
                                                <div className={estilos.errorMensaje}>
                                                    <ion-icon name="warning-outline"></ion-icon>
                                                    {envio.error_envio}
                                                </div>
                                            )}
                                            </div>
                                    </div>
                                    <div className={estilos.historialEstado}>
                                        <span className={`${estilos.estadoBadge} ${estilos[envio.estado_envio]}`}>
                                            {envio.estado_envio}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className={estilos.emptyState}>
                            <ion-icon name="time-outline"></ion-icon>
                            <h3>No hay envíos registrados</h3>
                            <p>Los envíos de mensajes aparecerán aquí una vez que configures y proceses asignaciones</p>
                        </div>
                    )}
                </div>
            )}

            {seccionActiva === 'envio-manual' && (
                <div className={estilos.seccionContent}>
                    <div className={estilos.seccionHeader}>
                        <h3>Envío Manual de Mensajes</h3>
                        <span className={estilos.numerosDisponibles}>
                            {obtenerNumerosDisponibles().length} números disponibles
                        </span>
                    </div>

                    {obtenerNumerosDisponibles().length > 0 ? (
                        <div className={estilos.envioManualContainer}>
                            <div className={estilos.numerosGrid}>
                                <h4>Seleccionar destinatarios:</h4>
                                <div className={estilos.numerosLista}>
                                    {obtenerNumerosDisponibles().map(item => (
                                        <div key={item.index} className={estilos.numeroItemManual}>
                                            <label className={estilos.numeroCheckbox}>
                                                <input
                                                    type="checkbox"
                                                    checked={formEnvioManual.destinatarios.some(d => d.index === item.index)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setFormEnvioManual({
                                                                ...formEnvioManual,
                                                                destinatarios: [...formEnvioManual.destinatarios, {
                                                                    index: item.index,
                                                                    telefono: item.telefono,
                                                                    nombre: item.nombre
                                                                }]
                                                            })
                                                        } else {
                                                            setFormEnvioManual({
                                                                ...formEnvioManual,
                                                                destinatarios: formEnvioManual.destinatarios.filter(d => d.index !== item.index)
                                                            })
                                                        }
                                                    }}
                                                />
                                                <div className={estilos.numeroInfo}>
                                                    <span className={estilos.numeroNombre}>{item.nombre}</span>
                                                    <span className={estilos.numeroTelefono}>{formatearTelefono(item.telefono)}</span>
                                                </div>
                                            </label>
                                            
                                            <div className={estilos.numeroEditable}>
                                                <input
                                                    type="text"
                                                    value={
                                                        formEnvioManual.destinatarios.find(d => d.index === item.index)?.nombre || item.nombre
                                                    }
                                                    onChange={(e) => {
                                                        const destinatarios = formEnvioManual.destinatarios.map(d => 
                                                            d.index === item.index ? {...d, nombre: e.target.value} : d
                                                        )
                                                        if (destinatarios.some(d => d.index === item.index)) {
                                                            setFormEnvioManual({
                                                                ...formEnvioManual,
                                                                destinatarios
                                                            })
                                                        }
                                                    }}
                                                    placeholder="Nombre personalizado"
                                                    className={estilos.inputNombre}
                                                />
                                                <input
                                                    type="text"
                                                    value={
                                                        formEnvioManual.destinatarios.find(d => d.index === item.index)?.telefono || item.telefono
                                                    }
                                                    onChange={(e) => {
                                                        const destinatarios = formEnvioManual.destinatarios.map(d => 
                                                            d.index === item.index ? {...d, telefono: e.target.value} : d
                                                        )
                                                        if (destinatarios.some(d => d.index === item.index)) {
                                                            setFormEnvioManual({
                                                                ...formEnvioManual,
                                                                destinatarios
                                                            })
                                                        }
                                                    }}
                                                    placeholder="Número de teléfono"
                                                    className={estilos.inputTelefono}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                
                                <div className={estilos.seleccionAcciones}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const todosDestinataarios = obtenerNumerosDisponibles().map(item => ({
                                                index: item.index,
                                                telefono: item.telefono,
                                                nombre: item.nombre
                                            }))
                                            setFormEnvioManual({
                                                ...formEnvioManual,
                                                destinatarios: todosDestinataarios
                                            })
                                        }}
                                        className={estilos.botonSeleccionarTodos}
                                    >
                                        Seleccionar Todos
                                    </button>
                                    
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setFormEnvioManual({
                                                ...formEnvioManual,
                                                destinatarios: []
                                            })
                                        }}
                                        className={estilos.botonLimpiarSeleccion}
                                    >
                                        Limpiar Selección
                                    </button>
                                </div>
                            </div>

                            <div className={estilos.mensajePersonalizado}>
                                <h4>Mensaje personalizado:</h4>
                                <textarea
                                    value={formEnvioManual.mensaje_personalizado}
                                    onChange={(e) => setFormEnvioManual({
                                        ...formEnvioManual,
                                        mensaje_personalizado: e.target.value
                                    })}
                                    placeholder="Escribe tu mensaje personalizado aquí. Puedes usar {nombre} para personalizar."
                                    rows="6"
                                    className={estilos.textareaMensaje}
                                />
                                
                                <div className={estilos.variablesInfo}>
                                    <span>Variables disponibles: {'{nombre}'}</span>
                                    <span>Seleccionados: {formEnvioManual.destinatarios.length}</span>
                                </div>
                                
                                <button
                                    onClick={async () => {
                                        if (formEnvioManual.destinatarios.length === 0) {
                                            setMensajeError('Selecciona al menos un destinatario')
                                            return
                                        }
                                        
                                        if (!formEnvioManual.mensaje_personalizado.trim()) {
                                            setMensajeError('Escribe un mensaje personalizado')
                                            return
                                        }
                                        
                                        try {
                                            setEnviandoMensajes(true)
                                            setMensajeError('')
                                            
                                            let enviados = 0
                                            let errores = 0
                                            
                                            for (const destinatario of formEnvioManual.destinatarios) {
                                                try {
                                                    const mensajePersonalizado = formEnvioManual.mensaje_personalizado
                                                        .replace(/{nombre}/g, destinatario.nombre || 'Usuario')
                                                    
                                                    const resultado = await enviarMensajeManual(
                                                        destinatario.telefono,
                                                        mensajePersonalizado,
                                                        destinatario.nombre,
                                                        asignaciones[0]?.id
                                                    )
                                                    
                                                    if (resultado.success) {
                                                        enviados++
                                                    } else {
                                                        errores++
                                                    }
                                                } catch (error) {
                                                    errores++
                                                }
                                                
                                                // Pausa entre envíos
                                                await new Promise(resolve => setTimeout(resolve, 1000))
                                            }
                                            
                                            setMensajeExito(`Envío completado: ${enviados} enviados, ${errores} errores`)
                                            setFormEnvioManual({
                                                destinatarios: [],
                                                mensaje_personalizado: ''
                                            })
                                            
                                            await cargarDatosAsignaciones()
                                            
                                        } catch (error) {
                                            console.log('Error en envío manual:', error)
                                            setMensajeError('Error al enviar mensajes')
                                        } finally {
                                            setEnviandoMensajes(false)
                                        }
                                    }}
                                    disabled={enviandoMensajes || formEnvioManual.destinatarios.length === 0}
                                    className={estilos.botonEnviarManual}
                                >
                                    {enviandoMensajes ? (
                                        <>
                                            <div className={estilos.loadingSpinner}></div>
                                            Enviando mensajes...
                                        </>
                                    ) : (
                                        <>
                                            <ion-icon name="send-outline"></ion-icon>
                                            Enviar a {formEnvioManual.destinatarios.length} destinatarios
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className={estilos.emptyState}>
                            <ion-icon name="send-outline"></ion-icon>
                            <h3>No hay números disponibles</h3>
                            <p>Asegúrate de que el Excel tenga datos y que hayas configurado las columnas correctamente</p>
                        </div>
                    )}
                </div>
            )}

            {modalAsignacion && (
                <div className={estilos.modalOverlay} onClick={cerrarModales}>
                    <div className={estilos.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={estilos.modalHeader}>
                            <h2>
                                {tipoModal === 'nueva' ? 'Nueva Asignación' : 'Editar Asignación'}
                            </h2>
                            <button className={estilos.botonCerrarModal} onClick={cerrarModales}>
                                <ion-icon name="close-outline"></ion-icon>
                            </button>
                        </div>
                        
                        <div className={estilos.modalContent}>
                            <form onSubmit={manejarGuardarAsignacion} className={estilos.formulario}>
                                <div className={estilos.seccionFormulario}>
                                    <h3>Configuración de Columnas</h3>
                                    
                                    <div className={estilos.camposGrupo}>
                                        <div className={estilos.campoFormulario}>
                                            <label>Columna de Teléfono *</label>
                                            <select
                                                value={formAsignacion.columna_telefono}
                                                onChange={(e) => setFormAsignacion({...formAsignacion, columna_telefono: e.target.value})}
                                                required
                                                className={estilos.selector}
                                            >
                                                <option value="">Seleccionar columna</option>
                                                {columnasDisponibles.map(col => (
                                                    <option key={col.letra} value={col.letra}>
                                                        Columna {col.letra} - {col.nombre} (ej: {col.muestra})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className={estilos.campoFormulario}>
                                            <label>Columna de Nombre (opcional)</label>
                                            <select
                                                value={formAsignacion.columna_nombre}
                                                onChange={(e) => setFormAsignacion({...formAsignacion, columna_nombre: e.target.value})}
                                                className={estilos.selector}
                                            >
                                                <option value="">Sin columna de nombre</option>
                                                {columnasDisponibles.map(col => (
                                                    <option key={col.letra} value={col.letra}>
                                                        Columna {col.letra} - {col.nombre} (ej: {col.muestra})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className={estilos.camposGrupo}>
                                        <div className={estilos.campoFormulario}>
                                            <label>Columna de Restricción (opcional)</label>
                                            <select
                                                value={formAsignacion.columna_restriccion}
                                                onChange={(e) => setFormAsignacion({...formAsignacion, columna_restriccion: e.target.value})}
                                                className={estilos.selector}
                                            >
                                                <option value="">Sin restricción</option>
                                                {columnasDisponibles.map(col => (
                                                    <option key={col.letra} value={col.letra}>
                                                        Columna {col.letra} - {col.nombre} (ej: {col.muestra})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className={estilos.campoFormulario}>
                                            <label>Valor que restringe envío</label>
                                            <input
                                                type="text"
                                                value={formAsignacion.valor_restriccion}
                                                onChange={(e) => setFormAsignacion({...formAsignacion, valor_restriccion: e.target.value})}
                                                placeholder="Ej: NO, ENVIADO, BLOQUEADO"
                                                className={estilos.input}
                                            />
                                            <small>Si la celda contiene este valor, no se enviará el mensaje</small>
                                        </div>
                                    </div>
                                </div>

                                <div className={estilos.seccionFormulario}>
                                    <h3>Mensaje de Bienvenida</h3>
                                    
                                    <div className={estilos.campoFormulario}>
                                        <label>Mensaje de Bienvenida *</label>
                                        <textarea
                                            value={formAsignacion.mensaje_bienvenida}
                                            onChange={(e) => setFormAsignacion({...formAsignacion, mensaje_bienvenida: e.target.value})}
                                            placeholder="Mensaje que se enviará a nuevos contactos"
                                            rows="4"
                                            required
                                            className={estilos.textarea}
                                        />
                                    </div>
                                    
                                    <div className={estilos.variablesAyuda}>
                                        <ion-icon name="information-circle-outline"></ion-icon>
                                        <span>Puedes usar {'{nombre}'} en tu mensaje para personalizar</span>
                                    </div>
                                </div>

                                <div className={estilos.seccionFormulario}>
                                    <h3>Configuración de Envío</h3>
                                    
                                    <div className={estilos.campoFormulario}>
                                        <label>Intervalo entre Mensajes (horas)</label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="168"
                                            value={formAsignacion.intervalo_horas}
                                            onChange={(e) => setFormAsignacion({...formAsignacion, intervalo_horas: parseInt(e.target.value)})}
                                            className={estilos.input}
                                        />
                                        <small>Tiempo mínimo entre envíos al mismo número</small>
                                    </div>
                                    
                                    <div className={estilos.campoFormulario}>
                                        <label className={estilos.checkboxLabel}>
                                            <input
                                                type="checkbox"
                                                checked={formAsignacion.enviar_solo_nuevos}
                                                onChange={(e) => setFormAsignacion({...formAsignacion, enviar_solo_nuevos: e.target.checked})}
                                            />
                                            <span className={estilos.checkmark}></span>
                                            Enviar solo a contactos nuevos (que no han recibido mensajes antes)
                                        </label>
                                    </div>
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
                                    <button type="button" onClick={cerrarModales} className={estilos.botonCancelar}>
                                        Cancelar
                                    </button>
                                    <button 
                                        type="submit" 
                                        disabled={procesando} 
                                        className={estilos.botonGuardar}
                                    >
                                        {procesando ? 'Guardando...' : 'Guardar'}
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