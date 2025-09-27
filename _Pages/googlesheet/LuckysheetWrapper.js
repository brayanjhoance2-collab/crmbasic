"use client"
import { useEffect, useRef, useState } from 'react'
import luckysheet from 'luckysheet'
import 'luckysheet/dist/assets/css/luckysheet.css'

export default function LuckysheetWrapper({ datos, sheetName, onSave, procesando }) {
    const containerRef = useRef(null)
    const [luckysheetIniciado, setLuckysheetIniciado] = useState(false)
    const [guardarHabilitado, setGuardarHabilitado] = useState(false)

    useEffect(() => {
        if (containerRef.current && !luckysheetIniciado) {
            inicializarLuckysheet()
        }

        return () => {
            if (luckysheetIniciado) {
                try {
                    luckysheet.destroy()
                } catch (error) {
                    console.log('Error al destruir Luckysheet:', error)
                }
            }
        }
    }, [])

    useEffect(() => {
        if (luckysheetIniciado && datos) {
            recargarDatos()
        }
    }, [datos, luckysheetIniciado])

    const convertirDatosParaLuckysheet = (datos) => {
        console.log('Convirtiendo datos para Luckysheet:', datos.length, 'registros')
        
        // Si no hay datos, crear una hoja vacía con headers básicos
        if (!datos || datos.length === 0) {
            const headersBasicos = ['ID', 'Nombre', 'Apellidos', 'Telefono', 'Email', 'Ciudad', 'Pais']
            return headersBasicos.map((header, colIndex) => ({
                r: 0,
                c: colIndex,
                v: header,
                ct: { t: 's' }, // tipo string
                s: {
                    bg: '#f0f0f0', // fondo gris para headers
                    fc: '#000000', // texto negro
                    bl: 1 // negrita
                }
            }))
        }

        const headers = Object.keys(datos[0])
        const filas = [headers]

        datos.forEach(fila => {
            const valores = headers.map(header => fila[header] || '')
            filas.push(valores)
        })

        const celldata = []

        filas.forEach((fila, rowIndex) => {
            fila.forEach((valor, colIndex) => {
                const esHeader = rowIndex === 0
                celldata.push({
                    r: rowIndex,
                    c: colIndex,
                    v: valor,
                    ct: { t: 's' }, // tipo string
                    s: esHeader ? {
                        bg: '#e2e8f0', // fondo gris para headers
                        fc: '#1e293b', // texto oscuro
                        bl: 1 // negrita
                    } : undefined
                })
            })
        })

        console.log('Datos convertidos:', celldata.length, 'celdas')
        return celldata
    }

    const inicializarLuckysheet = () => {
        try {
            console.log('Inicializando Luckysheet...')
            
            const datosConvertidos = convertirDatosParaLuckysheet(datos)
            const headers = datos && datos.length > 0 ? Object.keys(datos[0]) : ['ID', 'Nombre', 'Apellidos', 'Telefono', 'Email', 'Ciudad', 'Pais']
            
            const options = {
                container: containerRef.current,
                title: sheetName || 'Excel',
                lang: 'es',
                
                // Configuración de interfaz
                showtoolbar: true,
                showinfobar: true,
                showsheetbar: false,
                showstatisticBar: true,
                
                // Configuración de edición
                allowCopy: true,
                allowEdit: true,
                enableAddRow: true,
                enableAddCol: true,
                
                // Datos
                data: [{
                    name: sheetName || 'Hoja1',
                    celldata: datosConvertidos,
                    row: Math.max(50, (datos?.length || 0) + 20),
                    column: Math.max(20, headers.length + 5),
                    
                    // Configuraciones adicionales
                    config: {
                        columnlen: headers.reduce((acc, _, index) => {
                            acc[index] = 120 // ancho de columnas
                            return acc
                        }, {}),
                        rowlen: {
                            0: 35 // altura de la fila de headers
                        }
                    }
                }],
                
                // Hooks para detectar cambios
                hook: {
                    cellUpdated: () => {
                        console.log('Celda actualizada')
                        setGuardarHabilitado(true)
                    },
                    cellEditBefore: () => {
                        console.log('Iniciando edición de celda')
                    },
                    cellEditEnd: () => {
                        console.log('Finalizando edición de celda')
                        setGuardarHabilitado(true)
                    }
                }
            }

            luckysheet.create(options)
            setLuckysheetIniciado(true)
            setGuardarHabilitado(false)
            console.log('Luckysheet inicializado correctamente')
            
        } catch (error) {
            console.error('Error al inicializar Luckysheet:', error)
        }
    }

    const recargarDatos = () => {
        try {
            if (luckysheetIniciado) {
                console.log('Recargando datos en Luckysheet...')
                const datosConvertidos = convertirDatosParaLuckysheet(datos)
                
                // Limpiar y recargar datos
                luckysheet.setSheetData(datosConvertidos)
                setGuardarHabilitado(false)
                console.log('Datos recargados exitosamente')
            }
        } catch (error) {
            console.error('Error al recargar datos:', error)
        }
    }

    const manejarGuardar = () => {
        try {
            if (!luckysheetIniciado) {
                console.log('Luckysheet no está inicializado')
                return
            }

            console.log('Obteniendo datos de Luckysheet...')
            const datosLuckysheet = luckysheet.getSheetData()
            
            if (onSave && typeof onSave === 'function') {
                onSave(datosLuckysheet)
                setGuardarHabilitado(false)
            }
        } catch (error) {
            console.error('Error al guardar:', error)
        }
    }

    return (
        <div style={{ width: '100%', height: '600px', position: 'relative' }}>
            {/* Botón de guardar flotante */}
            {guardarHabilitado && (
                <button
                    onClick={manejarGuardar}
                    disabled={procesando}
                    style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        zIndex: 1000,
                        background: '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '8px 16px',
                        cursor: 'pointer',
                        fontWeight: '500',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                    }}
                >
                    {procesando ? (
                        <>
                            <div style={{
                                width: '16px',
                                height: '16px',
                                border: '2px solid #ffffff30',
                                borderTop: '2px solid #ffffff',
                                borderRadius: '50%',
                                animation: 'spin 1s linear infinite'
                            }}></div>
                            Guardando...
                        </>
                    ) : (
                        <>
                            <span>💾</span>
                            Guardar Cambios
                        </>
                    )}
                </button>
            )}
            
            {/* Información de estado */}
            <div style={{
                position: 'absolute',
                top: '10px',
                left: '10px',
                zIndex: 999,
                background: 'rgba(0,0,0,0.7)',
                color: 'white',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '12px',
                fontFamily: 'monospace'
            }}>
                {datos ? `${datos.length} registros` : 'Sin datos'} | 
                {luckysheetIniciado ? ' ✓ Cargado' : ' ⏳ Cargando...'}
                {guardarHabilitado && ' | 🔶 Cambios pendientes'}
            </div>
            
            {/* Contenedor de Luckysheet */}
            <div 
                ref={containerRef}
                style={{ 
                    width: '100%', 
                    height: '100%',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    overflow: 'hidden',
                    background: '#ffffff'
                }}
            />
            
            {/* CSS para el spinner */}
            <style jsx>{`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    )
}