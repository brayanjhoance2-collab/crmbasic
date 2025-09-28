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
    const [tableData, setTableData] = useState([])
    const [headers, setHeaders] = useState([])
    const [editingCell, setEditingCell] = useState(null)

    // Convertir datos al formato de tabla
    useEffect(() => {
        if (Array.isArray(datos) && datos.length > 0) {
            const newHeaders = Object.keys(datos[0])
            setHeaders(newHeaders)
            setTableData(datos)
        } else {
            setHeaders(['ID', 'Nombre', 'Email', 'Telefono'])
            setTableData([])
        }
    }, [datos])

    const handleCellEdit = (rowIndex, header, value) => {
        const newData = [...tableData]
        if (!newData[rowIndex]) {
            newData[rowIndex] = {}
        }
        newData[rowIndex][header] = value
        setTableData(newData)
    }

    const addNewRow = () => {
        const newRow = {}
        headers.forEach(header => {
            newRow[header] = ''
        })
        setTableData([...tableData, newRow])
    }

    const deleteRow = (rowIndex) => {
        const newData = tableData.filter((_, index) => index !== rowIndex)
        setTableData(newData)
    }

    const addNewColumn = () => {
        const newColumnName = `Nueva_Columna_${headers.length + 1}`
        const newHeaders = [...headers, newColumnName]
        setHeaders(newHeaders)
        
        const newData = tableData.map(row => ({
            ...row,
            [newColumnName]: ''
        }))
        setTableData(newData)
    }

    const handleSave = async () => {
        if (!onSave) return

        try {
            // Convertir datos de tabla a formato esperado por el servidor
            const datosParaGuardar = []
            
            // Agregar headers como primera fila
            headers.forEach((header, colIndex) => {
                datosParaGuardar.push({
                    r: 0,
                    c: colIndex,
                    v: header
                })
            })

            // Agregar datos
            tableData.forEach((fila, rowIndex) => {
                headers.forEach((header, colIndex) => {
                    const valor = fila[header] || ''
                    if (valor !== '') {
                        datosParaGuardar.push({
                            r: rowIndex + 1,
                            c: colIndex,
                            v: valor
                        })
                    }
                })
            })

            console.log('Guardando datos:', datosParaGuardar.length, 'celdas')
            await onSave(datosParaGuardar)

        } catch (error) {
            console.error('Error al guardar:', error)
        }
    }

    const exportToCSV = () => {
        if (tableData.length === 0) return

        const csvContent = [
            headers.join(','),
            ...tableData.map(row => 
                headers.map(header => `"${(row[header] || '').toString().replace(/"/g, '""')}"`).join(',')
            )
        ].join('\n')

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `${sheetName}.csv`
        link.click()
    }

    return (
        <div className={estilos.luckysheetWrapper}>
            <div className={estilos.luckysheetControls}>
                <div className={estilos.luckysheetInfo}>
                    <span>
                        <strong>Registros:</strong> {tableData.length}
                    </span>
                    <span>
                        <strong>Columnas:</strong> {headers.length}
                    </span>
                    <span>
                        <strong>Estado:</strong> Listo
                    </span>
                </div>
                
                <div className={estilos.luckysheetActions}>
                    <button 
                        onClick={exportToCSV}
                        disabled={tableData.length === 0}
                        className={`${estilos.button} ${estilos.buttonInfo}`}
                    >
                        <ion-icon name="download-outline"></ion-icon>
                        Exportar CSV
                    </button>
                    
                    <button 
                        onClick={handleSave}
                        disabled={procesando}
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

            <div className={estilos.excelTableWrapper}>
                <div className={estilos.tableActions}>
                    <button 
                        onClick={addNewRow}
                        className={`${estilos.button} ${estilos.buttonSecondary} ${estilos.smallButton}`}
                    >
                        <ion-icon name="add-outline"></ion-icon>
                        Agregar fila
                    </button>
                    
                    <button 
                        onClick={addNewColumn}
                        className={`${estilos.button} ${estilos.buttonSecondary} ${estilos.smallButton}`}
                    >
                        <ion-icon name="add-outline"></ion-icon>
                        Agregar columna
                    </button>
                </div>

                <div className={estilos.tableContainer}>
                    <table className={estilos.excelTable}>
                        <thead>
                            <tr>
                                <th className={estilos.rowNumber}>#</th>
                                {headers.map((header, index) => (
                                    <th key={index} className={estilos.columnHeader}>
                                        <input
                                            type="text"
                                            value={header}
                                            onChange={(e) => {
                                                const newHeaders = [...headers]
                                                newHeaders[index] = e.target.value
                                                setHeaders(newHeaders)
                                            }}
                                            className={estilos.headerInput}
                                        />
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {tableData.map((row, rowIndex) => (
                                <tr key={rowIndex}>
                                    <td className={estilos.rowNumber}>
                                        <span>{rowIndex + 1}</span>
                                        <button
                                            onClick={() => deleteRow(rowIndex)}
                                            className={estilos.deleteRowButton}
                                            title="Eliminar fila"
                                        >
                                            <ion-icon name="trash-outline"></ion-icon>
                                        </button>
                                    </td>
                                    {headers.map((header, colIndex) => (
                                        <td key={colIndex} className={estilos.dataCell}>
                                            <input
                                                type="text"
                                                value={row[header] || ''}
                                                onChange={(e) => handleCellEdit(rowIndex, header, e.target.value)}
                                                className={estilos.cellInput}
                                                placeholder={`${header}...`}
                                            />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                            
                            {tableData.length === 0 && (
                                <tr>
                                    <td colSpan={headers.length + 1} className={estilos.emptyRow}>
                                        <div className={estilos.emptyMessage}>
                                            <ion-icon name="document-outline"></ion-icon>
                                            <p>No hay datos. Haz clic en "Agregar fila" para comenzar.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className={estilos.tableInfo}>
                <p>
                    <ion-icon name="information-circle-outline"></ion-icon>
                    Editor de Excel simplificado. Puedes editar celdas, agregar filas/columnas y guardar en Google Sheets.
                </p>
            </div>
        </div>
    )
}