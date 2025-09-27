"use client"
import { useEffect, useRef, useState } from 'react'
import estilos from "./luckysheet.module.css"

export default function LuckysheetComponent({ 
    datos = [], 
    sheetName = 'Sheet1', 
    onSave, 
    procesando = false 
}) {
    const containerRef = useRef(null)
    const luckysheetInstance = useRef(null)
    const [isInitialized, setIsInitialized] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        const initLuckysheet = async () => {
            try {
                setIsLoading(true)
                setError(null)

                // Verificar si ya está inicializado
                if (luckysheetInstance.current || !containerRef.current) {
                    return
                }

                // Limpiar el contenedor
                if (containerRef.current) {
                    containerRef.current.innerHTML = ''
                }

                // Cargar Luckysheet dinámicamente
                await loadLuckysheetScripts()

                // Preparar datos para Luckysheet
                const luckysheetData = convertirDatosALuckysheet(datos)

                const options = {
                    container: containerRef.current,
                    title: sheetName,
                    lang: 'es',
                    data: [{
                        name: sheetName,
                        color: "",
                        index: 0,
                        status: 1,
                        order: 0,
                        hide: 0,
                        row: Math.max(50, luckysheetData.length + 10),
                        column: Math.max(20, getMaxColumns(luckysheetData) + 5),
                        defaultRowHeight: 19,
                        defaultColWidth: 73,
                        celldata: luckysheetData,
                        config: {
                            merge: {},
                            rowlen: {},
                            columnlen: {},
                            rowhidden: {},
                            colhidden: {},
                            borderInfo: {},
                            authority: {}
                        },
                        scrollLeft: 0,
                        scrollTop: 0,
                        luckysheet_select_save: [],
                        calcChain: [],
                        isPivotTable: false,
                        pivotTable: {},
                        filter_select: {},
                        filter: null,
                        luckysheet_alternateformat_save: [],
                        luckysheet_alternateformat_save_modelCustom: [],
                        luckysheet_conditionformat_save: {},
                        frozen: {},
                        chart: [],
                        zoomRatio: 1,
                        image: [],
                        showGridLines: 1,
                        dataVerification: {}
                    }],
                    plugins: ['chart'],
                    allowCopy: true,
                    allowEdit: true,
                    allowUpdate: true,
                    showsheetbar: false,
                    showstatisticBar: true,
                    sheetFormulaBar: true,
                    enableAddRow: true,
                    enableAddCol: true,
                    userInfo: false,
                    myFolderUrl: "",
                    devicePixelRatio: window.devicePixelRatio,
                    functionButton: "",
                    showConfigWindowResize: true,
                    forceCalculation: false
                }

                // Verificar que Luckysheet esté disponible
                if (typeof window.luckysheet === 'undefined') {
                    throw new Error('Luckysheet no se cargó correctamente')
                }

                // Destruir instancia previa si existe
                if (window.luckysheet.destroy) {
                    window.luckysheet.destroy()
                }

                // Crear nueva instancia
                window.luckysheet.create(options)
                luckysheetInstance.current = window.luckysheet
                setIsInitialized(true)

                console.log('Luckysheet inicializado exitosamente')

            } catch (error) {
                console.error('Error al inicializar Luckysheet:', error)
                setError('Error al cargar el editor de Excel: ' + error.message)
            } finally {
                setIsLoading(false)
            }
        }

        const timer = setTimeout(initLuckysheet, 100)
        return () => clearTimeout(timer)
    }, [datos, sheetName])

    // Cleanup al desmontar
    useEffect(() => {
        return () => {
            if (luckysheetInstance.current && typeof luckysheetInstance.current.destroy === 'function') {
                try {
                    luckysheetInstance.current.destroy()
                } catch (error) {
                    console.log('Error al destruir Luckysheet:', error)
                }
                luckysheetInstance.current = null
            }
            setIsInitialized(false)
        }
    }, [])

    const loadLuckysheetScripts = () => {
        return new Promise((resolve, reject) => {
            // Verificar si ya está cargado
            if (typeof window.luckysheet !== 'undefined') {
                resolve()
                return
            }

            // Cargar CSS
            if (!document.querySelector('link[href*="luckysheet"]')) {
                const link = document.createElement('link')
                link.rel = 'stylesheet'
                link.href = 'https://cdn.luckysheet.com/luckysheet/0.2.61/plugins/css/pluginsCss.css'
                document.head.appendChild(link)

                const link2 = document.createElement('link')
                link2.rel = 'stylesheet'
                link2.href = 'https://cdn.luckysheet.com/luckysheet/0.2.61/plugins/plugins.css'
                document.head.appendChild(link2)

                const link3 = document.createElement('link')
                link3.rel = 'stylesheet'
                link3.href = 'https://cdn.luckysheet.com/luckysheet/0.2.61/css/luckysheet.css'
                document.head.appendChild(link3)

                const link4 = document.createElement('link')
                link4.rel = 'stylesheet'
                link4.href = 'https://cdn.luckysheet.com/luckysheet/0.2.61/assets/iconfont/iconfont.css'
                document.head.appendChild(link4)
            }

            // Cargar JS
            if (!document.querySelector('script[src*="luckysheet"]')) {
                const script = document.createElement('script')
                script.src = 'https://cdn.luckysheet.com/luckysheet/0.2.61/plugins/js/plugin.js'
                script.onload = () => {
                    const script2 = document.createElement('script')
                    script2.src = 'https://cdn.luckysheet.com/luckysheet/0.2.61/luckysheet.umd.js'
                    script2.onload = () => {
                        // Esperar un poco para asegurar que esté completamente cargado
                        setTimeout(resolve, 500)
                    }
                    script2.onerror = reject
                    document.head.appendChild(script2)
                }
                script.onerror = reject
                document.head.appendChild(script)
            } else {
                setTimeout(resolve, 100)
            }
        })
    }

    const convertirDatosALuckysheet = (datos) => {
        if (!Array.isArray(datos) || datos.length === 0) {
            return []
        }

        const celldata = []
        
        // Obtener headers del primer objeto
        const headers = Object.keys(datos[0])
        
        // Agregar headers como primera fila
        headers.forEach((header, colIndex) => {
            celldata.push({
                r: 0,
                c: colIndex,
                v: {
                    v: header,
                    ct: { fa: "General", t: "g" },
                    m: header,
                    bg: null,
                    bl: 0,
                    it: 0,
                    ff: 0,
                    fs: 11,
                    fc: "rgb(51, 51, 51)",
                    ht: 1,
                    vt: 1
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
                        bg: null,
                        bl: 0,
                        it: 0,
                        ff: 0,
                        fs: 11,
                        fc: "rgb(51, 51, 51)",
                        ht: 1,
                        vt: 1
                    }
                })
            })
        })

        return celldata
    }

    const getMaxColumns = (celldata) => {
        let maxCol = 0
        celldata.forEach(cell => {
            if (cell.c > maxCol) maxCol = cell.c
        })
        return maxCol + 1
    }

    const handleSave = async () => {
        if (!luckysheetInstance.current || !onSave) {
            console.log('No se puede guardar: instancia no disponible')
            return
        }

        try {
            // Obtener datos de Luckysheet
            const sheetData = luckysheetInstance.current.getSheetData()
            
            if (!sheetData || sheetData.length === 0) {
                console.log('No hay datos para guardar')
                return
            }

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

            console.log('Guardando datos:', datosParaGuardar.length, 'celdas')
            await onSave(datosParaGuardar)

        } catch (error) {
            console.error('Error al guardar:', error)
            setError('Error al guardar: ' + error.message)
        }
    }

    if (error) {
        return (
            <div className={estilos.excelError}>
                <ion-icon name="warning-outline"></ion-icon>
                <p>Error al cargar Excel</p>
                <span>{error}</span>
                <button 
                    onClick={() => window.location.reload()}
                    className={`${estilos.button} ${estilos.buttonSecondary}`}
                >
                    Recargar página
                </button>
            </div>
        )
    }

    if (isLoading) {
        return (
            <div className={estilos.excelLoading}>
                <div className={estilos.loadingSpinner}></div>
                <p>Cargando editor de Excel...</p>
                <span>Inicializando Luckysheet...</span>
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
                        <strong>Estado:</strong> {isInitialized ? 'Conectado' : 'Inicializando...'}
                    </span>
                </div>
                
                <div className={estilos.luckysheetActions}>
                    <button 
                        onClick={handleSave}
                        disabled={procesando || !isInitialized}
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
                    overflow: 'hidden'
                }}
            />

            {!isInitialized && !isLoading && (
                <div className={estilos.luckysheetPlaceholder}>
                    <ion-icon name="document-outline"></ion-icon>
                    <p>Preparando editor de Excel...</p>
                </div>
            )}
        </div>
    )
}