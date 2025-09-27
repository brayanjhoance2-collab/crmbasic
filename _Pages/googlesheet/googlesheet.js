"use client"
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
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
    eliminarSheet,
    crearSpreadsheetCompleto,
    guardarDatosExcel,
    actualizarDatosExcel
} from "./servidor"

// Importar el componente Luckysheet dinámicamente
const LuckysheetComponent = dynamic(() => import('./luckysheet/luckysheet'), {
    ssr: false,
    loading: () => (
        <div className={estilos.excelLoading}>
            <div className={estilos.loadingSpinner}></div>
            <p>Cargando editor de Excel...</p>
        </div>
    )
})

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
    const [mostrarModalNuevoSpreadsheet, setMostrarModalNuevoSpreadsheet] = useState(false)
    const [nombreNuevoSheet, setNombreNuevoSheet] = useState('')
    const [nombreNuevoSpreadsheet, setNombreNuevoSpreadsheet] = useState('')
    const [descripcionNuevoSpreadsheet, setDescripcionNuevoSpreadsheet] = useState('')
    const [incluirHeaders, setIncluirHeaders] = useState(true)
    const [excelKey, setExcelKey] = useState(0)
    
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
            console.log('Error al cargar configuracion:', error)
            setMensajeError('Error al cargar configuracion de Google Sheets')
        }
    }

    const manejarGuardarConfiguracion = async () => {
        if (!clientId.trim() || !clientSecret.trim() || !redirectUri.trim()) {
            setMensajeError('Todos los campos de configuracion son requeridos')
            return
        }
        
        try {
            setProcesando(true)
            setMensajeError('')
            
            await guardarConfiguracionGoogle(clientId, clientSecret, redirectUri)
            setMensajeExito('Configuracion guardada exitosamente')
            setMostrarModalConfiguracion(false)
            
            setClientId('')
            setClientSecret('')
            setRedirectUri('')
            
            await cargarConfiguracion()
            
        } catch (error) {
            console.log('Error al guardar configuracion:', error)
            setMensajeError('Error al guardar configuracion: ' + error.message)
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
                setMensajeExito('Credenciales verificadas. Redirigiendo a Google...')
                setTimeout(() => {
                    window.location.href = resultado.authUrl
                }, 1000)
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
            setMensajeError('Error al cargar hojas de calculo')
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
            setMensajeError('Error al cargar pestanas')
        } finally {
            setLoadingSheets(false)
        }
    }

    const cargarDatosSheet = async () => {
        if (!sheetSeleccionado || !spreadsheetSeleccionado) return
        
        try {
            setLoadingDatos(true)
            const datos = await obtenerDatosSheet(spreadsheetSeleccionado, sheetSeleccionado)
            console.log('Datos cargados:', datos.length, 'registros')
            setDatosSheet(datos)
            setExcelKey(prev => prev + 1)
        } catch (error) {
            console.log('Error al cargar datos:', error)
            setMensajeError('Error al cargar datos del sheet')
            setDatosSheet([])
        } finally {
            setLoadingDatos(false)
        }
    }

    const recargarExcel = () => {
        setExcelKey(prev => prev + 1)
        setMensajeExito('Excel recargado')
    }

    const actualizarExcel = async () => {
        if (!spreadsheetSeleccionado || !sheetSeleccionado) {
            setMensajeError('Selecciona una hoja de calculo y pestana')
            return
        }

        try {
            setProcesando(true)
            setMensajeError('')

            const resultado = await actualizarDatosExcel(spreadsheetSeleccionado, sheetSeleccionado)
            
            if (resultado.success) {
                setDatosSheet(resultado.datos)
                setMensajeExito('Excel actualizado desde la nube')
                setExcelKey(prev => prev + 1)
            } else {
                setMensajeError(resultado.error || 'Error al actualizar Excel')
            }

        } catch (error) {
            console.log('Error al actualizar Excel:', error)
            setMensajeError('Error al actualizar Excel')
        } finally {
            setProcesando(false)
        }
    }

    const guardarExcel = async (datosExcel) => {
        if (!spreadsheetSeleccionado || !sheetSeleccionado) {
            setMensajeError('Selecciona una hoja de calculo y pestana')
            return
        }

        try {
            setProcesando(true)
            setMensajeError('')

            const resultado = await guardarDatosExcel(
                spreadsheetSeleccionado, 
                sheetSeleccionado,
                datosExcel
            )
            
            if (resultado.success) {
                setMensajeExito('Excel guardado en la nube exitosamente')
            } else {
                setMensajeError(resultado.error || 'Error al guardar Excel')
            }

        } catch (error) {
            console.log('Error al guardar Excel:', error)
            setMensajeError('Error al guardar Excel')
        } finally {
            setProcesando(false)
        }
    }

    const manejarCrearNuevoSpreadsheet = async () => {
        if (!nombreNuevoSpreadsheet.trim()) {
            setMensajeError('Ingresa un nombre para la nueva hoja de calculo')
            return
        }
        
        try {
            setProcesando(true)
            setMensajeError('')
            
            const resultado = await crearSpreadsheetCompleto(nombreNuevoSpreadsheet, descripcionNuevoSpreadsheet)
            
            if (resultado.success) {
                setMensajeExito(`Hoja de calculo creada exitosamente: ${nombreNuevoSpreadsheet}`)
                setMostrarModalNuevoSpreadsheet(false)
                setNombreNuevoSpreadsheet('')
                setDescripcionNuevoSpreadsheet('')
                
                await cargarSpreadsheets()
                setSpreadsheetSeleccionado(resultado.spreadsheetId)
            } else {
                setMensajeError(resultado.error || 'Error al crear hoja de calculo')
            }
            
        } catch (error) {
            console.log('Error al crear spreadsheet:', error)
            setMensajeError('Error al crear hoja de calculo')
        } finally {
            setProcesando(false)
        }
    }

    const manejarExportar = async () => {
        if (!spreadsheetSeleccionado || !sheetSeleccionado) {
            setMensajeError('Selecciona una hoja de calculo y pestana')
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
            setMensajeError('Selecciona una hoja de calculo y pestana')
            return
        }
        
        if (!datosSheet || datosSheet.length === 0) {
            setMensajeError('No hay datos en la hoja seleccionada para importar. Primero agrega datos o exporta contactos.')
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

    const manejarCrearNuevoSheet = async () => {
        if (!nombreNuevoSheet.trim() || !spreadsheetSeleccionado) {
            setMensajeError('Ingresa un nombre para la nueva pestana')
            return
        }
        
        try {
            setProcesando(true)
            setMensajeError('')
            
            const resultado = await crearNuevoSheet(spreadsheetSeleccionado, nombreNuevoSheet)
            
            if (resultado.success) {
                setMensajeExito('Nueva pestana creada exitosamente')
                setMostrarModalNuevoSheet(false)
                setNombreNuevoSheet('')
                await cargarSpreadsheets()
            } else {
                setMensajeError(resultado.error || 'Error al crear pestana')
            }
            
        } catch (error) {
            console.log('Error al crear sheet:', error)
            setMensajeError('Error al crear nueva pestana')
        } finally {
            setProcesando(false)
        }
    }

    const manejarEliminarSheet = async () => {
        if (!sheetSeleccionado || !spreadsheetSeleccionado) {
            setMensajeError('Selecciona una pestana para eliminar')
            return
        }
        
        if (!confirm('Estas seguro de que quieres eliminar esta pestana? Esta accion no se puede deshacer.')) {
            return
        }
        
        try {
            setProcesando(true)
            setMensajeError('')
            
            const resultado = await eliminarSheet(spreadsheetSeleccionado, sheetSeleccionado)
            
            if (resultado.success) {
                setMensajeExito('Pestana eliminada exitosamente')
                setSheetSeleccionado('')
                setDatosSheet([])
                await cargarSpreadsheets()
            } else {
                setMensajeError(resultado.error || 'Error al eliminar pestana')
            }
            
        } catch (error) {
            console.log('Error al eliminar sheet:', error)
            setMensajeError('Error al eliminar pestana')
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
                                    {configuracion?.credenciales_validas ? ' Credenciales validas y conectado' : ' Credenciales guardadas, pendiente de verificacion'}
                                </p>
                                {configuracion?.ultima_verificacion && (
                                    <p>
                                        <strong>Ultima verificacion:</strong> {formatearFecha(configuracion.ultima_verificacion)}
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
                                <label>Hoja de calculo</label>
                                <select 
                                    value={spreadsheetSeleccionado}
                                    onChange={(e) => setSpreadsheetSeleccionado(e.target.value)}
                                    disabled={loadingSpreadsheets}
                                    className={estilos.selector}
                                >
                                    <option value="">Seleccionar hoja de calculo</option>
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
                                <label>Pestana</label>
                                <select 
                                    value={sheetSeleccionado}
                                    onChange={(e) => setSheetSeleccionado(e.target.value)}
                                    disabled={loadingSheets || !spreadsheetSeleccionado}
                                    className={estilos.selector}
                                >
                                    <option value="">Seleccionar pestana</option>
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

                        <div className={estilos.spreadsheetActions}>
                            <button 
                                onClick={() => setMostrarModalNuevoSpreadsheet(true)}
                                disabled={procesando}
                                className={`${estilos.button} ${estilos.buttonSuccess}`}
                            >
                                <ion-icon name="add-circle-outline"></ion-icon>
                                Crear Nueva Hoja de Calculo
                            </button>
                            
                            <button 
                                onClick={cargarSpreadsheets}
                                disabled={loadingSpreadsheets}
                                className={`${estilos.button} ${estilos.buttonSecondary}`}
                            >
                                <ion-icon name="refresh-outline"></ion-icon>
                                Actualizar Lista
                            </button>
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
                                        disabled={procesando || !sheetSeleccionado || datosSheet.length === 0}
                                        className={`${estilos.button} ${estilos.buttonInfo}`}
                                    >
                                        <ion-icon name="cloud-download-outline"></ion-icon>
                                        Importar contactos
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
                                <h3>Gestion de pestanas</h3>
                                <div className={estilos.buttonGrid}>
                                    <button 
                                        onClick={() => setMostrarModalNuevoSheet(true)}
                                        disabled={procesando || !spreadsheetSeleccionado}
                                        className={`${estilos.button} ${estilos.buttonPrimary}`}
                                    >
                                        <ion-icon name="add-outline"></ion-icon>
                                        Nueva pestana
                                    </button>

                                    <button 
                                        onClick={manejarEliminarSheet}
                                        disabled={procesando || !sheetSeleccionado}
                                        className={`${estilos.button} ${estilos.buttonDanger}`}
                                    >
                                        <ion-icon name="trash-outline"></ion-icon>
                                        Eliminar pestana
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className={estilos.excelSection}>
                        <div className={estilos.excelHeader}>
                            <h3>Editor de Excel</h3>
                            <div className={estilos.excelActions}>
                                <button 
                                    onClick={recargarExcel}
                                    disabled={!sheetSeleccionado}
                                    className={`${estilos.button} ${estilos.buttonWarning}`}
                                >
                                    <ion-icon name="reload-outline"></ion-icon>
                                    Recargar Excel
                                </button>
                                
                                <button 
                                    onClick={actualizarExcel}
                                    disabled={loadingDatos || !sheetSeleccionado || procesando}
                                    className={`${estilos.button} ${estilos.buttonInfo}`}
                                >
                                    <ion-icon name="refresh-outline"></ion-icon>
                                    Actualizar Excel
                                </button>
                            </div>
                        </div>

                        <div className={estilos.excelContainer}>
                            {loadingDatos ? (
                                <div className={estilos.excelLoading}>
                                    <div className={estilos.loadingSpinner}></div>
                                    <p>Cargando datos del Excel...</p>
                                </div>
                            ) : sheetSeleccionado && spreadsheetSeleccionado ? (
                                <div>
                                    <div className={estilos.excelInfo}>
                                        <p>
                                            <strong>Hoja:</strong> {spreadsheets.find(s => s.id === spreadsheetSeleccionado)?.name || 'N/A'} 
                                            &nbsp;|&nbsp; 
                                            <strong>Pestana:</strong> {sheetSeleccionado}
                                            &nbsp;|&nbsp;
                                            <strong>Registros:</strong> {datosSheet.length}
                                        </p>
                                    </div>
                                    <LuckysheetComponent 
                                        key={excelKey}
                                        datos={datosSheet}
                                        sheetName={sheetSeleccionado}
                                        onSave={guardarExcel}
                                        procesando={procesando}
                                    />
                                </div>
                            ) : (
                                <div className={estilos.emptyExcel}>
                                    <ion-icon name="document-outline"></ion-icon>
                                    <p>Selecciona una hoja de calculo y pestana para ver el Excel</p>
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
                                    <li>Copia y pega los datos aqui</li>
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
                                        Guardar Configuracion
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {mostrarModalNuevoSpreadsheet && (
                <div className={estilos.modalOverlay}>
                    <div className={estilos.modal}>
                        <div className={estilos.modalHeader}>
                            <h3>Crear Nueva Hoja de Calculo</h3>
                            <button 
                                onClick={() => setMostrarModalNuevoSpreadsheet(false)}
                                className={estilos.modalClose}
                            >
                                <ion-icon name="close-outline"></ion-icon>
                            </button>
                        </div>
                        
                        <div className={estilos.modalContent}>
                            <div className={estilos.inputGroup}>
                                <label>Nombre de la hoja de calculo</label>
                                <input 
                                    type="text"
                                    value={nombreNuevoSpreadsheet}
                                    onChange={(e) => setNombreNuevoSpreadsheet(e.target.value)}
                                    placeholder="CRM Contactos 2025"
                                    className={estilos.input}
                                />
                            </div>
                            
                            <div className={estilos.inputGroup}>
                                <label>Descripcion (opcional)</label>
                                <textarea 
                                    value={descripcionNuevoSpreadsheet}
                                    onChange={(e) => setDescripcionNuevoSpreadsheet(e.target.value)}
                                    placeholder="Hoja de calculo para gestionar contactos del CRM"
                                    className={estilos.input}
                                    rows="3"
                                />
                            </div>
                            
                            <div className={estilos.infoBox}>
                                <ion-icon name="information-circle-outline"></ion-icon>
                                <span>Se creara automaticamente con una pestana Contactos y las columnas apropiadas.</span>
                            </div>
                        </div>
                        
                        <div className={estilos.modalActions}>
                            <button 
                                onClick={() => setMostrarModalNuevoSpreadsheet(false)}
                                className={`${estilos.button} ${estilos.buttonSecondary}`}
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={manejarCrearNuevoSpreadsheet}
                                disabled={procesando || !nombreNuevoSpreadsheet.trim()}
                                className={`${estilos.button} ${estilos.buttonSuccess}`}
                            >
                                {procesando ? (
                                    <div className={estilos.loadingSpinner}></div>
                                ) : (
                                    <>
                                        <ion-icon name="add-circle-outline"></ion-icon>
                                        Crear Hoja de Calculo
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
                            <h3>Crear nueva pestana</h3>
                            <button 
                                onClick={() => setMostrarModalNuevoSheet(false)}
                                className={estilos.modalClose}
                            >
                                <ion-icon name="close-outline"></ion-icon>
                            </button>
                        </div>
                        
                        <div className={estilos.modalContent}>
                            <div className={estilos.inputGroup}>
                                <label>Nombre de la pestana</label>
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