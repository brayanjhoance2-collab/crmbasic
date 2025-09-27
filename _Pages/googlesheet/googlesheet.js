"use client"
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import estilos from "./googlesheet.module.css"
import { 
    obtenerUsuarioActual,
    obtenerConfiguracionGoogleSheets,
    guardarConfiguracionGoogle,
    verificarCredenciales,
    obtenerSpreadsheets,
    obtenerDatosSheet,
    exportarContactosASheet,
    importarContactosDeSheet,
    sincronizarDatos,
    crearNuevoSheet,
    eliminarSheet
} from "./servidor"

export default function GoogleSheetsPage() {
    const router = useRouter()
    const [usuario, setUsuario] = useState(null)
    const [loading, setLoading] = useState(true)
    const [configuracion, setConfiguracion] = useState(null)
    const [spreadsheets, setSpreadsheets] = useState([])
    const [spreadsheetSeleccionado, setSpreadsheetSeleccionado] = useState('')
    const [sheets, setSheets] = useState([])
    const [sheetSeleccionado, setSheetSeleccionado] = useState('')
    const [datosSheet, setDatosSheet] = useState([])
    const [loadingSpreadsheets, setLoadingSpreadsheets] = useState(false)
    const [loadingSheets, setLoadingSheets] = useState(false)
    const [loadingDatos, setLoadingDatos] = useState(false)
    const [procesando, setProcesando] = useState(false)
    const [verificando, setVerificando] = useState(false)
    const [mensajeError, setMensajeError] = useState('')
    const [mensajeExito, setMensajeExito] = useState('')
    const [mostrarModalNuevoSheet, setMostrarModalNuevoSheet] = useState(false)
    const [mostrarModalConfiguracion, setMostrarModalConfiguracion] = useState(false)
    const [nombreNuevoSheet, setNombreNuevoSheet] = useState('')
    const [incluirHeaders, setIncluirHeaders] = useState(true)
    
    // Estados para configuración
    const [clientId, setClientId] = useState('')
    const [clientSecret, setClientSecret] = useState('')
    const [redirectUri, setRedirectUri] = useState('')

    useEffect(() => {
        verificarYCargarDatos()
    }, [])

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search)
        const error = urlParams.get('error')
        const success = urlParams.get('success')
        
        if (error) {
            setMensajeError(decodeURIComponent(error))
            window.history.replaceState({}, '', '/googlesheets')
        }
        
        if (success) {
            setMensajeExito(decodeURIComponent(success))
            window.history.replaceState({}, '', '/googlesheets')
            setTimeout(() => {
                cargarConfiguracion()
            }, 1000)
        }
    }, [])

    useEffect(() => {
        if (spreadsheetSeleccionado) {
            cargarSheets()
        }
    }, [spreadsheetSeleccionado])

    useEffect(() => {
        if (sheetSeleccionado && spreadsheetSeleccionado) {
            cargarDatosSheet()
        }
    }, [sheetSeleccionado])

    const verificarYCargarDatos = async () => {
        try {
            setLoading(true)
            
            const usuarioData = await obtenerUsuarioActual()
            if (!usuarioData) {
                router.push('/login')
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
            const config = await obtenerConfiguracionGoogleSheets()
            setConfiguracion(config)
            
            if (config && config.credenciales_validas) {
                await cargarSpreadsheets()
            }
        } catch (error) {
            console.log('Error al cargar configuración:', error)
            setMensajeError('Error al cargar configuración de Google Sheets')
        }
    }

    const manejarGuardarConfiguracion = async () => {
        if (!clientId.trim() || !clientSecret.trim() || !redirectUri.trim()) {
            setMensajeError('Todos los campos de configuración son requeridos')
            return
        }
        
        try {
            setProcesando(true)
            setMensajeError('')
            
            await guardarConfiguracionGoogle(clientId, clientSecret, redirectUri)
            setMensajeExito('Configuración guardada exitosamente')
            setMostrarModalConfiguracion(false)
            
            // Limpiar formulario
            setClientId('')
            setClientSecret('')
            setRedirectUri('')
            
            await cargarConfiguracion()
            
        } catch (error) {
            console.log('Error al guardar configuración:', error)
            setMensajeError('Error al guardar configuración: ' + error.message)
        } finally {
            setProcesando(false)
        }
    }

    const manejarVerificarCredenciales = async () => {
        try {
            setVerificando(true)
            setMensajeError('')
            
            const resultado = await verificarCredenciales()
            
            if (resultado.success) {
                setMensajeExito('Credenciales verificadas exitosamente. Abriendo ventana de autorización...')
                // Abrir ventana de autorización OAuth
                window.open(resultado.authUrl, '_blank', 'width=500,height=600')
            } else {
                setMensajeError(resultado.error || 'Error al verificar credenciales')
            }
            
        } catch (error) {
            console.log('Error al verificar credenciales:', error)
            setMensajeError('Error al verificar credenciales')
        } finally {
            setVerificando(false)
        }
    }

    const cargarSpreadsheets = async () => {
        try {
            setLoadingSpreadsheets(true)
            const data = await obtenerSpreadsheets()
            setSpreadsheets(data)
        } catch (error) {
            console.log('Error al cargar spreadsheets:', error)
            setMensajeError('Error al cargar hojas de cálculo')
        } finally {
            setLoadingSpreadsheets(false)
        }
    }

    const cargarSheets = async () => {
        if (!spreadsheetSeleccionado) return
        
        try {
            setLoadingSheets(true)
            const spreadsheet = spreadsheets.find(s => s.id === spreadsheetSeleccionado)
            if (spreadsheet) {
                setSheets(spreadsheet.sheets || [])
            }
        } catch (error) {
            console.log('Error al cargar sheets:', error)
            setMensajeError('Error al cargar pestañas')
        } finally {
            setLoadingSheets(false)
        }
    }

    const cargarDatosSheet = async () => {
        if (!sheetSeleccionado || !spreadsheetSeleccionado) return
        
        try {
            setLoadingDatos(true)
            const datos = await obtenerDatosSheet(spreadsheetSeleccionado, sheetSeleccionado)
            setDatosSheet(datos)
        } catch (error) {
            console.log('Error al cargar datos:', error)
            setMensajeError('Error al cargar datos del sheet')
        } finally {
            setLoadingDatos(false)
        }
    }

    const manejarExportar = async () => {
        if (!spreadsheetSeleccionado || !sheetSeleccionado) {
            setMensajeError('Selecciona una hoja de cálculo y pestaña')
            return
        }
        
        try {
            setProcesando(true)
            setMensajeError('')
            
            const resultado = await exportarContactosASheet(
                spreadsheetSeleccionado, 
                sheetSeleccionado,
                incluirHeaders
            )
            
            if (resultado.success) {
                setMensajeExito(`Contactos exportados exitosamente: ${resultado.registros} registros`)
                await cargarDatosSheet()
            } else {
                setMensajeError(resultado.error || 'Error al exportar contactos')
            }
            
        } catch (error) {
            console.log('Error al exportar:', error)
            setMensajeError('Error al exportar contactos')
        } finally {
            setProcesando(false)
        }
    }

    const manejarImportar = async () => {
        if (!spreadsheetSeleccionado || !sheetSeleccionado) {
            setMensajeError('Selecciona una hoja de cálculo y pestaña')
            return
        }
        
        try {
            setProcesando(true)
            setMensajeError('')
            
            const resultado = await importarContactosDeSheet(
                spreadsheetSeleccionado, 
                sheetSeleccionado
            )
            
            if (resultado.success) {
                setMensajeExito(`Contactos importados exitosamente: ${resultado.registros} registros`)
            } else {
                setMensajeError(resultado.error || 'Error al importar contactos')
            }
            
        } catch (error) {
            console.log('Error al importar:', error)
            setMensajeError('Error al importar contactos')
        } finally {
            setProcesando(false)
        }
    }

    const manejarSincronizar = async () => {
        if (!spreadsheetSeleccionado || !sheetSeleccionado) {
            setMensajeError('Selecciona una hoja de cálculo y pestaña')
            return
        }
        
        try {
            setProcesando(true)
            setMensajeError('')
            
            const resultado = await sincronizarDatos(spreadsheetSeleccionado, sheetSeleccionado)
            
            if (resultado.success) {
                setMensajeExito('Datos sincronizados exitosamente')
                await cargarDatosSheet()
            } else {
                setMensajeError(resultado.error || 'Error al sincronizar')
            }
            
        } catch (error) {
            console.log('Error al sincronizar:', error)
            setMensajeError('Error al sincronizar datos')
        } finally {
            setProcesando(false)
        }
    }

    const manejarCrearNuevoSheet = async () => {
        if (!nombreNuevoSheet.trim() || !spreadsheetSeleccionado) {
            setMensajeError('Ingresa un nombre para la nueva pestaña')
            return
        }
        
        try {
            setProcesando(true)
            setMensajeError('')
            
            const resultado = await crearNuevoSheet(spreadsheetSeleccionado, nombreNuevoSheet)
            
            if (resultado.success) {
                setMensajeExito('Nueva pestaña creada exitosamente')
                setMostrarModalNuevoSheet(false)
                setNombreNuevoSheet('')
                await cargarSpreadsheets()
            } else {
                setMensajeError(resultado.error || 'Error al crear pestaña')
            }
            
        } catch (error) {
            console.log('Error al crear sheet:', error)
            setMensajeError('Error al crear nueva pestaña')
        } finally {
            setProcesando(false)
        }
    }

    const manejarEliminarSheet = async () => {
        if (!sheetSeleccionado || !spreadsheetSeleccionado) {
            setMensajeError('Selecciona una pestaña para eliminar')
            return
        }
        
        if (!confirm('¿Estás seguro de que quieres eliminar esta pestaña? Esta acción no se puede deshacer.')) {
            return
        }
        
        try {
            setProcesando(true)
            setMensajeError('')
            
            const resultado = await eliminarSheet(spreadsheetSeleccionado, sheetSeleccionado)
            
            if (resultado.success) {
                setMensajeExito('Pestaña eliminada exitosamente')
                setSheetSeleccionado('')
                setDatosSheet([])
                await cargarSpreadsheets()
            } else {
                setMensajeError(resultado.error || 'Error al eliminar pestaña')
            }
            
        } catch (error) {
            console.log('Error al eliminar sheet:', error)
            setMensajeError('Error al eliminar pestaña')
        } finally {
            setProcesando(false)
        }
    }

    const limpiarMensajes = () => {
        setMensajeError('')
        setMensajeExito('')
    }

    const formatearFecha = (fecha) => {
        if (!fecha) return ''
        return new Date(fecha).toLocaleDateString('es-ES', {
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
                <p>Cargando Google Sheets...</p>
            </div>
        )
    }

    return (
        <div className={estilos.googleSheetsContainer}>
            {(mensajeError || mensajeExito) && (
                <div className={`${estilos.mensaje} ${mensajeError ? estilos.error : estilos.exito}`}>
                    <ion-icon name={mensajeError ? "alert-circle-outline" : "checkmark-circle-outline"}></ion-icon>
                    <span>{mensajeError || mensajeExito}</span>
                    <button onClick={limpiarMensajes}>
                        <ion-icon name="close-outline"></ion-icon>
                    </button>
                </div>
            )}

            <div className={estilos.headerSection}>
                <div className={estilos.titleContainer}>
                    <h1>Google Sheets</h1>
                    <p>Configura y sincroniza tus datos con Google Sheets</p>
                </div>

                <div className={estilos.connectionCard}>
                    <div className={estilos.connectionInfo}>
                        <div className={estilos.connectionStatus}>
                            <ion-icon name={configuracion?.credenciales_validas ? "checkmark-circle" : "close-circle"}></ion-icon>
                            <span className={configuracion?.credenciales_validas ? estilos.conectado : estilos.desconectado}>
                                {configuracion?.credenciales_validas ? 'Conectado' : 'Desconectado'}
                            </span>
                        </div>
                        
                        {configuracion?.configuracion_guardada && (
                            <div className={estilos.connectionDetails}>
                                <p>
                                    <strong>Estado:</strong> 
                                    {configuracion?.credenciales_validas ? ' Credenciales válidas y conectado' : ' Credenciales guardadas, pendiente de verificación'}
                                </p>
                                {configuracion?.ultima_verificacion && (
                                    <p>
                                        <strong>Última verificación:</strong> {formatearFecha(configuracion.ultima_verificacion)}
                                    </p>
                                )}
                            </div>
                        )}
                        
                        {!configuracion?.configuracion_guardada && (
                            <div className={estilos.configAlert}>
                                <ion-icon name="warning-outline"></ion-icon>
                                <span>Configure las credenciales de Google API para comenzar</span>
                            </div>
                        )}
                    </div>

                    <div className={estilos.connectionActions}>
                        {(usuario?.rol === 'superadmin' || usuario?.rol === 'admin') && (
                            <button 
                                onClick={() => setMostrarModalConfiguracion(true)}
                                className={`${estilos.button} ${estilos.buttonSecondary}`}
                            >
                                <ion-icon name="settings-outline"></ion-icon>
                                {configuracion?.configuracion_guardada ? 'Reconfigurar API' : 'Configurar API'}
                            </button>
                        )}
                        
                        {configuracion?.configuracion_guardada && !configuracion?.credenciales_validas && (
                            <button 
                                onClick={manejarVerificarCredenciales}
                                disabled={verificando}
                                className={`${estilos.button} ${estilos.buttonPrimary}`}
                            >
                                {verificando ? (
                                    <div className={estilos.loadingSpinner}></div>
                                ) : (
                                    <>
                                        <ion-icon name="checkmark-circle-outline"></ion-icon>
                                        Verificar Credenciales
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {configuracion?.credenciales_validas && (
                <div className={estilos.mainContent}>
                    <div className={estilos.controlsSection}>
                        <div className={estilos.selectorsContainer}>
                            <div className={estilos.selectorGroup}>
                                <label>Hoja de cálculo</label>
                                <select 
                                    value={spreadsheetSeleccionado}
                                    onChange={(e) => setSpreadsheetSeleccionado(e.target.value)}
                                    disabled={loadingSpreadsheets}
                                    className={estilos.selector}
                                >
                                    <option value="">Seleccionar hoja de cálculo</option>
                                    {spreadsheets.map(sheet => (
                                        <option key={sheet.id} value={sheet.id}>
                                            {sheet.name}
                                        </option>
                                    ))}
                                </select>
                                {loadingSpreadsheets && (
                                    <div className={estilos.loadingSpinner}></div>
                                )}
                            </div>

                            <div className={estilos.selectorGroup}>
                                <label>Pestaña</label>
                                <select 
                                    value={sheetSeleccionado}
                                    onChange={(e) => setSheetSeleccionado(e.target.value)}
                                    disabled={loadingSheets || !spreadsheetSeleccionado}
                                    className={estilos.selector}
                                >
                                    <option value="">Seleccionar pestaña</option>
                                    {sheets.map(sheet => (
                                        <option key={sheet.id} value={sheet.title}>
                                            {sheet.title}
                                        </option>
                                    ))}
                                </select>
                                {loadingSheets && (
                                    <div className={estilos.loadingSpinner}></div>
                                )}
                            </div>
                        </div>

                        <div className={estilos.actionsContainer}>
                            <div className={estilos.actionGroup}>
                                <h3>Operaciones de datos</h3>
                                <div className={estilos.buttonGrid}>
                                    <button 
                                        onClick={manejarExportar}
                                        disabled={procesando || !sheetSeleccionado}
                                        className={`${estilos.button} ${estilos.buttonSuccess}`}
                                    >
                                        <ion-icon name="cloud-upload-outline"></ion-icon>
                                        Exportar contactos
                                    </button>

                                    <button 
                                        onClick={manejarImportar}
                                        disabled={procesando || !sheetSeleccionado}
                                        className={`${estilos.button} ${estilos.buttonInfo}`}
                                    >
                                        <ion-icon name="cloud-download-outline"></ion-icon>
                                        Importar contactos
                                    </button>

                                    <button 
                                        onClick={manejarSincronizar}
                                        disabled={procesando || !sheetSeleccionado}
                                        className={`${estilos.button} ${estilos.buttonWarning}`}
                                    >
                                        <ion-icon name="sync-outline"></ion-icon>
                                        Sincronizar
                                    </button>
                                </div>

                                <div className={estilos.optionsContainer}>
                                    <label className={estilos.checkboxLabel}>
                                        <input 
                                            type="checkbox"
                                            checked={incluirHeaders}
                                            onChange={(e) => setIncluirHeaders(e.target.checked)}
                                        />
                                        <span className={estilos.checkmark}></span>
                                        Incluir encabezados al exportar
                                    </label>
                                </div>
                            </div>

                            <div className={estilos.actionGroup}>
                                <h3>Gestión de pestañas</h3>
                                <div className={estilos.buttonGrid}>
                                    <button 
                                        onClick={() => setMostrarModalNuevoSheet(true)}
                                        disabled={procesando || !spreadsheetSeleccionado}
                                        className={`${estilos.button} ${estilos.buttonPrimary}`}
                                    >
                                        <ion-icon name="add-outline"></ion-icon>
                                        Nueva pestaña
                                    </button>

                                    <button 
                                        onClick={manejarEliminarSheet}
                                        disabled={procesando || !sheetSeleccionado}
                                        className={`${estilos.button} ${estilos.buttonDanger}`}
                                    >
                                        <ion-icon name="trash-outline"></ion-icon>
                                        Eliminar pestaña
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className={estilos.dataSection}>
                        <div className={estilos.dataHeader}>
                            <h3>Vista previa de datos</h3>
                            <button 
                                onClick={cargarDatosSheet}
                                disabled={loadingDatos || !sheetSeleccionado}
                                className={`${estilos.button} ${estilos.buttonSecondary}`}
                            >
                                <ion-icon name="refresh-outline"></ion-icon>
                                Actualizar
                            </button>
                        </div>

                        <div className={estilos.dataContainer}>
                            {loadingDatos ? (
                                <div className={estilos.dataLoading}>
                                    <div className={estilos.loadingSpinner}></div>
                                    <p>Cargando datos...</p>
                                </div>
                            ) : datosSheet.length > 0 ? (
                                <div className={estilos.tableContainer}>
                                    <table className={estilos.dataTable}>
                                        <thead>
                                            <tr>
                                                {datosSheet[0] && Object.keys(datosSheet[0]).map(key => (
                                                    <th key={key}>{key}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {datosSheet.slice(0, 10).map((fila, index) => (
                                                <tr key={index}>
                                                    {Object.values(fila).map((valor, i) => (
                                                        <td key={i}>{valor || ''}</td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {datosSheet.length > 10 && (
                                        <div className={estilos.dataInfo}>
                                            Mostrando 10 de {datosSheet.length} registros
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className={estilos.emptyData}>
                                    <ion-icon name="document-outline"></ion-icon>
                                    <p>No hay datos para mostrar</p>
                                    <span>Selecciona una hoja de cálculo y pestaña para ver los datos</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {mostrarModalConfiguracion && (
                <div className={estilos.modalOverlay}>
                    <div className={estilos.modalConfig}>
                        <div className={estilos.modalHeader}>
                            <h3>Configurar Google Sheets API</h3>
                            <button 
                                onClick={() => setMostrarModalConfiguracion(false)}
                                className={estilos.modalClose}
                            >
                                <ion-icon name="close-outline"></ion-icon>
                            </button>
                        </div>
                        
                        <div className={estilos.modalContent}>
                            <div className={estilos.configInstructions}>
                                <p>Para conectar con Google Sheets necesitas credenciales OAuth 2.0:</p>
                                <ol>
                                    <li>Ve a <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer">Google Cloud Console</a></li>
                                    <li>Crea un proyecto o selecciona uno existente</li>
                                    <li>Habilita la API de Google Sheets y Google Drive</li>
                                    <li>Crea credenciales OAuth 2.0</li>
                                    <li>Copia y pega los datos aquí</li>
                                </ol>
                            </div>
                            
                            <div className={estilos.inputGroup}>
                                <label>Client ID</label>
                                <input 
                                    type="text"
                                    value={clientId}
                                    onChange={(e) => setClientId(e.target.value)}
                                    placeholder="1006474255515-uvejqdglkk2qdrun442qfasbmflf3d93.apps.googleusercontent.com"
                                    className={estilos.input}
                                />
                            </div>
                            
                            <div className={estilos.inputGroup}>
                                <label>Client Secret</label>
                                <input 
                                    type="password"
                                    value={clientSecret}
                                    onChange={(e) => setClientSecret(e.target.value)}
                                    placeholder="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"
                                    className={estilos.input}
                                />
                            </div>
                            
                            <div className={estilos.inputGroup}>
                                <label>Redirect URI</label>
                                <input 
                                    type="url"
                                    value={redirectUri}
                                    onChange={(e) => setRedirectUri(e.target.value)}
                                    placeholder="https://rifasbasic-production.up.railway.app/api/auth/google/callback"
                                    className={estilos.input}
                                />
                                <small className={estilos.inputHelp}>
                                    Esta URL debe estar configurada en Google Cloud Console
                                </small>
                            </div>
                        </div>
                        
                        <div className={estilos.modalActions}>
                            <button 
                                onClick={() => setMostrarModalConfiguracion(false)}
                                className={`${estilos.button} ${estilos.buttonSecondary}`}
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={manejarGuardarConfiguracion}
                                disabled={procesando || !clientId.trim() || !clientSecret.trim() || !redirectUri.trim()}
                                className={`${estilos.button} ${estilos.buttonPrimary}`}
                            >
                                {procesando ? (
                                    <div className={estilos.loadingSpinner}></div>
                                ) : (
                                    <>
                                        <ion-icon name="save-outline"></ion-icon>
                                        Guardar Configuración
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {mostrarModalNuevoSheet && (
                <div className={estilos.modalOverlay}>
                    <div className={estilos.modal}>
                        <div className={estilos.modalHeader}>
                            <h3>Crear nueva pestaña</h3>
                            <button 
                                onClick={() => setMostrarModalNuevoSheet(false)}
                                className={estilos.modalClose}
                            >
                                <ion-icon name="close-outline"></ion-icon>
                            </button>
                        </div>
                        
                        <div className={estilos.modalContent}>
                            <div className={estilos.inputGroup}>
                                <label>Nombre de la pestaña</label>
                                <input 
                                    type="text"
                                    value={nombreNuevoSheet}
                                    onChange={(e) => setNombreNuevoSheet(e.target.value)}
                                    placeholder="Ingresa el nombre..."
                                    className={estilos.input}
                                />
                            </div>
                        </div>
                        
                        <div className={estilos.modalActions}>
                            <button 
                                onClick={() => setMostrarModalNuevoSheet(false)}
                                className={`${estilos.button} ${estilos.buttonSecondary}`}
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={manejarCrearNuevoSheet}
                                disabled={procesando || !nombreNuevoSheet.trim()}
                                className={`${estilos.button} ${estilos.buttonPrimary}`}
                            >
                                {procesando ? (
                                    <div className={estilos.loadingSpinner}></div>
                                ) : (
                                    <>
                                        <ion-icon name="add-outline"></ion-icon>
                                        Crear
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}