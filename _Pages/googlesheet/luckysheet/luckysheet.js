"use client"
import { useEffect, useRef, useState, useCallback } from 'react'
import estilos from "./luckysheet.module.css"

export default function LuckysheetComponent({ 
    datos = [], 
    sheetName = 'Sheet1', 
    onSave, 
    procesando = false 
}) {
    const containerRef = useRef(null)
    const luckysheetInstance = useRef(null)
    const initTimeoutRef = useRef(null)
    const [isInitialized, setIsInitialized] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState(null)
    const [loadingMessage, setLoadingMessage] = useState('Iniciando...')

    const limpiarInstancia = useCallback(() => {
        try {
            if (luckysheetInstance.current && window.luckysheet) {
                if (typeof window.luckysheet.destroy === 'function') {
                    window.luckysheet.destroy()
                }
                luckysheetInstance.current = null
            }
        } catch (error) {
            console.log('Error al limpiar instancia:', error)
        }
    }, [])

    const convertirDatosALuckysheet = useCallback((datos) => {
        console.log('Convirtiendo datos a Luckysheet:', datos)
        
        if (!Array.isArray(datos) || datos.length === 0) {
            console.log('Datos vacios, creando estructura basica')
            return [{
                r: 0, c: 0,
                v: { v: "ID", ct: { fa: "General", t: "g" }, m: "ID" }
            }, {
                r: 0, c: 1,
                v: { v: "Nombre", ct: { fa: "General", t: "g" }, m: "Nombre" }
            }, {
                r: 0, c: 2,
                v: { v: "Email", ct: { fa: "General", t: "g" }, m: "Email" }
            }]
        }

        const celldata = []
        const headers = Object.keys(datos[0])
        
        console.log('Headers encontrados:', headers)

        // Agregar headers
        headers.forEach((header, colIndex) => {
            celldata.push({
                r: 0,
                c: colIndex,
                v: {
                    v: header,
                    ct: { fa: "General", t: "g" },
                    m: header,
                    bg: "#f0f0f0",
                    fc: "#000000",
                    bl: 1
                }
            })
        })

        // Agregar datos
        datos.forEach((fila, rowIndex) => {
            headers.forEach((header, colIndex) => {
                const valor = fila[header] || ''
                celldata.push({
                    r: rowIndex + 1,
                    c: colIndex,
                    v: {
                        v: valor,
                        ct: { fa: "General", t: "g" },
                        m: String(valor),
                        fc: "#000000"
                    }
                })
            })
        })

        console.log('Celldata generado:', celldata.length, 'celdas')
        return celldata
    }, [])

    const cargarScriptsLuckysheet = useCallback(() => {
        return new Promise((resolve, reject) => {
            setLoadingMessage('Cargando scripts de Luckysheet...')
            
            if (typeof window.luckysheet !== 'undefined') {
                console.log('Luckysheet ya cargado')
                resolve()
                return
            }

            // Usar CDN alternativo más confiable
            const baseUrl = 'https://unpkg.com/luckysheet@2.1.13/dist'
            
            // Verificar y cargar CSS
            const cssFiles = [
                `${baseUrl}/plugins/css/pluginsCss.css`,
                `${baseUrl}/plugins/plugins.css`, 
                `${baseUrl}/css/luckysheet.css`,
                `${baseUrl}/assets/iconfont/iconfont.css`
            ]

            let cssLoaded = 0
            const totalCss = cssFiles.length

            cssFiles.forEach(href => {
                if (!document.querySelector(`link[href="${href}"]`)) {
                    const link = document.createElement('link')
                    link.rel = 'stylesheet'
                    link.href = href
                    link.onload = () => {
                        cssLoaded++
                        setLoadingMessage(`Cargando estilos ${cssLoaded}/${totalCss}...`)
                    }
                    link.onerror = () => {
                        console.log('Error cargando CSS:', href)
                        cssLoaded++
                    }
                    document.head.appendChild(link)
                } else {
                    cssLoaded++
                }
            })

            // Esperar que CSS se cargue antes de cargar JS
            const waitForCss = () => {
                if (cssLoaded >= totalCss) {
                    loadJavaScript()
                } else {
                    setTimeout(waitForCss, 100)
                }
            }

            const loadJavaScript = () => {
                if (!document.querySelector('script[src*="luckysheet"]')) {
                    setLoadingMessage('Cargando plugins JS...')
                    const script1 = document.createElement('script')
                    script1.src = `${baseUrl}/plugins/js/plugin.js`
                    script1.onload = () => {
                        setLoadingMessage('Cargando Luckysheet core...')
                        const script2 = document.createElement('script')
                        script2.src = `${baseUrl}/luckysheet.umd.js`
                        script2.onload = () => {
                            console.log('Scripts cargados, esperando inicializacion...')
                            setTimeout(() => {
                                if (typeof window.luckysheet !== 'undefined') {
                                    resolve()
                                } else {
                                    reject(new Error('Luckysheet no se cargo correctamente'))
                                }
                            }, 1500)
                        }
                        script2.onerror = () => reject(new Error('Error cargando luckysheet.umd.js'))
                        document.head.appendChild(script2)
                    }
                    script1.onerror = () => reject(new Error('Error cargando plugin.js'))
                    document.head.appendChild(script1)
                } else {
                    setTimeout(resolve, 500)
                }
            }

            waitForCss()
        })
    }, [])

    const inicializarLuckysheet = useCallback(async () => {
        try {
            setLoadingMessage('Preparando contenedor...')
            
            if (!containerRef.current) {
                throw new Error('Contenedor no disponible')
            }

            // Limpiar contenedor
            containerRef.current.innerHTML = ''
            containerRef.current.id = 'luckysheet-container-' + Date.now()

            setLoadingMessage('Convirtiendo datos...')
            const celldata = convertirDatosALuckysheet(datos)

            setLoadingMessage('Configurando Luckysheet...')
            const config = {
                container: containerRef.current,
                title: sheetName,
                lang: 'es',
                allowCopy: true,
                allowEdit: true,
                allowUpdate: true,
                showsheetbar: false,
                showstatisticBar: false,
                sheetFormulaBar: true,
                enableAddRow: true,
                enableAddCol: true,
                userInfo: false,
                devicePixelRatio: window.devicePixelRatio || 1,
                functionButton: "",
                showConfigWindowResize: false,
                forceCalculation: false,
                data: [{
                    name: sheetName,
                    color: "",
                    index: 0,
                    status: 1,
                    order: 0,
                    hide: 0,
                    row: Math.max(100, celldata.length + 50),
                    column: Math.max(26, getMaxColumns(celldata) + 10),
                    defaultRowHeight: 19,
                    defaultColWidth: 73,
                    celldata: celldata,
                    config: {},
                    scrollLeft: 0,
                    scrollTop: 0,
                    luckysheet_select_save: [],
                    calcChain: [],
                    isPivotTable: false,
                    pivotTable: {},
                    filter_select: {},
                    filter: null,
                    luckysheet_alternateformat_save: [],
                    luckysheet_conditionformat_save: {},
                    frozen: {},
                    chart: [],
                    zoomRatio: 1,
                    image: [],
                    showGridLines: 1
                }]
            }

            console.log('Inicializando con config:', config)
            setLoadingMessage('Creando Luckysheet...')

            // Destruir instancia previa
            limpiarInstancia()

            // Crear nueva instancia
            window.luckysheet.create(config)
            luckysheetInstance.current = window.luckysheet

            // Verificar inicializacion exitosa
            setTimeout(() => {
                const lsContainer = containerRef.current?.querySelector('.luckysheet-wa-editor')
                if (lsContainer) {
                    console.log('Luckysheet inicializado exitosamente')
                    setIsInitialized(true)
                    setError(null)
                } else {
                    throw new Error('Luckysheet no se renderizo correctamente')
                }
                setIsLoading(false)
            }, 3000)

        } catch (error) {
            console.error('Error al inicializar Luckysheet:', error)
            setError(error.message)
            setIsLoading(false)
            setIsInitialized(false)
        }
    }, [datos, sheetName, convertirDatosALuckysheet, limpiarInstancia])

    const getMaxColumns = (celldata) => {
        let maxCol = 0
        celldata.forEach(cell => {
            if (cell.c > maxCol) maxCol = cell.c
        })
        return maxCol + 1
    }

    useEffect(() => {
        const init = async () => {
            try {
                setIsLoading(true)
                setError(null)
                setIsInitialized(false)

                await cargarScriptsLuckysheet()
                await inicializarLuckysheet()

            } catch (error) {
                console.error('Error en inicializacion:', error)
                setError(error.message)
                setIsLoading(false)
            }
        }

        // Limpiar timeout previo
        if (initTimeoutRef.current) {
            clearTimeout(initTimeoutRef.current)
        }

        // Delay para asegurar que el DOM este listo
        initTimeoutRef.current = setTimeout(init, 300)

        return () => {
            if (initTimeoutRef.current) {
                clearTimeout(initTimeoutRef.current)
            }
        }
    }, [cargarScriptsLuckysheet, inicializarLuckysheet])

    // Cleanup al desmontar
    useEffect(() => {
        return () => {
            limpiarInstancia()
            if (initTimeoutRef.current) {
                clearTimeout(initTimeoutRef.current)
            }
        }
    }, [limpiarInstancia])

    const handleSave = async () => {
        if (!luckysheetInstance.current || !onSave || !isInitialized) {
            setError('Editor no esta listo para guardar')
            return
        }

        try {
            console.log('Obteniendo datos para guardar...')
            
            // Diferentes metodos para obtener datos segun la API disponible
            let sheetData = null
            
            if (typeof window.luckysheet.getSheetData === 'function') {
                sheetData = window.luckysheet.getSheetData()
            } else if (typeof window.luckysheet.getAllSheets === 'function') {
                const sheets = window.luckysheet.getAllSheets()
                sheetData = sheets[0]?.data
            } else {
                throw new Error('No se puede obtener datos del editor')
            }

            if (!sheetData || sheetData.length === 0) {
                throw new Error('No hay datos para guardar')
            }

            console.log('Datos obtenidos:', sheetData)

            // Convertir a formato para servidor
            const datosParaGuardar = []
            
            sheetData.forEach((fila, rowIndex) => {
                if (Array.isArray(fila)) {
                    fila.forEach((celda, colIndex) => {
                        if (celda !== null && celda !== undefined && celda !== '') {
                            datosParaGuardar.push({
                                r: rowIndex,
                                c: colIndex,
                                v: celda
                            })
                        }
                    })
                }
            })

            console.log('Enviando', datosParaGuardar.length, 'celdas al servidor')
            await onSave(datosParaGuardar)

        } catch (error) {
            console.error('Error al guardar:', error)
            setError('Error al guardar: ' + error.message)
        }
    }

    const usarEditorSimple = () => {
        setError(null)
        setIsLoading(false)
        setIsInitialized(true)
        
        // Crear una tabla HTML simple como fallback
        if (containerRef.current) {
            containerRef.current.innerHTML = `
                <div class="${estilos.simpleTableContainer}">
                    <p class="${estilos.simpleTableMessage}">
                        <strong>Modo simple activado</strong><br>
                        Mostrando datos en formato tabla básica
                    </p>
                    <table class="${estilos.simpleTable}">
                        <thead>
                            <tr>
                                ${datos.length > 0 ? Object.keys(datos[0]).map(header => 
                                    `<th>${header}</th>`
                                ).join('') : '<th>Sin datos</th>'}
                            </tr>
                        </thead>
                        <tbody>
                            ${datos.map(fila => 
                                `<tr>${Object.values(fila).map(valor => 
                                    `<td contenteditable="true">${valor || ''}</td>`
                                ).join('')}</tr>`
                            ).join('')}
                        </tbody>
                    </table>
                </div>
            `
        }
    }

    if (error) {
        return (
            <div className={estilos.excelError}>
                <ion-icon name="warning-outline"></ion-icon>
                <p>Error al cargar Excel</p>
                <span>{error}</span>
                <div className={estilos.errorButtons}>
                    <button 
                        onClick={usarEditorSimple}
                        className={`${estilos.button} ${estilos.buttonInfo}`}
                    >
                        <ion-icon name="grid-outline"></ion-icon>
                        Usar editor simple
                    </button>
                    <button 
                        onClick={() => window.location.reload()}
                        className={`${estilos.button} ${estilos.buttonSecondary}`}
                    >
                        <ion-icon name="refresh-outline"></ion-icon>
                        Reintentar
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className={estilos.luckysheetWrapper}>
            <div className={estilos.luckysheetControls}>
                <div className={estilos.luckysheetInfo}>
                    <span>
                        <strong>Registros:</strong> {datos.length}
                    </span>
                    <span>
                        <strong>Estado:</strong> {
                            isLoading ? loadingMessage : 
                            isInitialized ? 'Listo' : 
                            'No inicializado'
                        }
                    </span>
                </div>
                
                <div className={estilos.luckysheetActions}>
                    <button 
                        onClick={handleSave}
                        disabled={procesando || !isInitialized || isLoading}
                        className={`${estilos.button} ${estilos.buttonSuccess}`}
                    >
                        {procesando ? (
                            <>
                                <div className={estilos.loadingSpinner}></div>
                                Guardando...
                            </>
                        ) : (
                            <>
                                <ion-icon name="save-outline"></ion-icon>
                                Guardar en la nube
                            </>
                        )}
                    </button>
                </div>
            </div>

            <div 
                ref={containerRef}
                className={estilos.luckysheetContainer}
                style={{
                    width: '100%',
                    height: '600px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    position: 'relative'
                }}
            />

            {isLoading && (
                <div className={estilos.luckysheetPlaceholder}>
                    <div className={estilos.loadingSpinner}></div>
                    <p>{loadingMessage}</p>
                </div>
            )}
        </div>
    )
}