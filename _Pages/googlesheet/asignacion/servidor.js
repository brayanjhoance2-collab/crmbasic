"use server"
import db from "@/_DB/db"
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'crm_whatsapp_facebook_2024'

export async function obtenerUsuarioActual() {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get('auth-token')
        
        if (!token) {
            return null
        }

        const decoded = jwt.verify(token.value, JWT_SECRET)
        const userId = decoded.userId

        const [rows] = await db.execute(`
            SELECT 
                id, correo, nombre, apellidos, telefono, avatar_url, rol, activo, ultimo_acceso, fecha_registro
            FROM usuarios 
            WHERE id = ? AND activo = 1
        `, [userId])

        if (rows.length === 0) {
            return null
        }

        const usuario = rows[0]
        await db.execute(`UPDATE usuarios SET ultimo_acceso = CURRENT_TIMESTAMP WHERE id = ?`, [userId])

        return {
            id: usuario.id,
            correo: usuario.correo,
            nombre: usuario.nombre,
            apellidos: usuario.apellidos,
            telefono: usuario.telefono,
            nombreCompleto: `${usuario.nombre} ${usuario.apellidos}`,
            avatarUrl: usuario.avatar_url,
            rol: usuario.rol,
            activo: usuario.activo,
            fechaRegistro: usuario.fecha_registro,
            ultimoAcceso: usuario.ultimo_acceso
        }

    } catch (error) {
        console.log('Error al obtener usuario actual:', error)
        
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            const cookieStore = await cookies()
            cookieStore.delete('auth-token')
        }
        
        return null
    }
}

export async function obtenerAsignacionesUsuario(spreadsheetId, sheetName) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        const [rows] = await db.execute(`
            SELECT 
                ga.*,
                COUNT(geh.id) as total_envios,
                SUM(CASE WHEN geh.estado_envio = 'enviado' THEN 1 ELSE 0 END) as enviados_exitosos,
                SUM(CASE WHEN geh.estado_envio = 'fallido' THEN 1 ELSE 0 END) as enviados_fallidos,
                MAX(geh.fecha_enviado) as ultimo_envio
            FROM google_sheets_asignaciones ga
            LEFT JOIN google_sheets_envios_historial geh ON ga.id = geh.asignacion_id
            WHERE ga.usuario_id = ? 
            AND ga.spreadsheet_id = ? 
            AND ga.sheet_name = ?
            GROUP BY ga.id
            ORDER BY ga.fecha_creacion DESC
        `, [usuario.id, spreadsheetId, sheetName])

        return rows

    } catch (error) {
        console.log('Error al obtener asignaciones:', error)
        throw error
    }
}

export async function crearAsignacion(datos) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        const {
            spreadsheet_id,
            sheet_name,
            columna_telefono,
            columna_nombre,
            columna_restriccion,
            mensaje_bienvenida,
            enviar_solo_nuevos,
            intervalo_horas,
            valor_restriccion
        } = datos

        const [result] = await db.execute(`
            INSERT INTO google_sheets_asignaciones (
                usuario_id,
                spreadsheet_id,
                sheet_name,
                columna_telefono,
                columna_nombre,
                columna_restriccion,
                mensaje_bienvenida,
                enviar_solo_nuevos,
                intervalo_horas,
                valor_restriccion,
                activa,
                fecha_creacion
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())
        `, [
            usuario.id,
            spreadsheet_id,
            sheet_name,
            columna_telefono,
            columna_nombre || null,
            columna_restriccion || null,
            mensaje_bienvenida,
            enviar_solo_nuevos ? 1 : 0,
            intervalo_horas || 24,
            valor_restriccion || null
        ])

        return {
            success: true,
            asignacionId: result.insertId,
            message: 'Asignación creada exitosamente'
        }

    } catch (error) {
        console.log('Error al crear asignación:', error)
        
        if (error.code === 'ER_DUP_ENTRY') {
            return {
                success: false,
                error: 'Ya existe una asignación para esta hoja de cálculo'
            }
        }
        
        return {
            success: false,
            error: error.message
        }
    }
}

export async function actualizarAsignacion(id, datos) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        const {
            columna_telefono,
            columna_nombre,
            columna_restriccion,
            mensaje_bienvenida,
            enviar_solo_nuevos,
            intervalo_horas,
            valor_restriccion
        } = datos

        await db.execute(`
            UPDATE google_sheets_asignaciones SET
                columna_telefono = ?,
                columna_nombre = ?,
                columna_restriccion = ?,
                mensaje_bienvenida = ?,
                enviar_solo_nuevos = ?,
                intervalo_horas = ?,
                valor_restriccion = ?,
                fecha_actualizacion = NOW()
            WHERE id = ? AND usuario_id = ?
        `, [
            columna_telefono,
            columna_nombre || null,
            columna_restriccion || null,
            mensaje_bienvenida,
            enviar_solo_nuevos ? 1 : 0,
            intervalo_horas || 24,
            valor_restriccion || null,
            id,
            usuario.id
        ])

        return {
            success: true,
            message: 'Asignación actualizada exitosamente'
        }

    } catch (error) {
        console.log('Error al actualizar asignación:', error)
        return {
            success: false,
            error: error.message
        }
    }
}

export async function eliminarAsignacion(id) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        await db.execute(`
            DELETE FROM google_sheets_asignaciones 
            WHERE id = ? AND usuario_id = ?
        `, [id, usuario.id])

        return {
            success: true,
            message: 'Asignación eliminada exitosamente'
        }

    } catch (error) {
        console.log('Error al eliminar asignación:', error)
        return {
            success: false,
            error: error.message
        }
    }
}

export async function obtenerHistorialEnvios(asignacionId) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        const [rows] = await db.execute(`
            SELECT 
                geh.*,
                ga.spreadsheet_id,
                ga.sheet_name
            FROM google_sheets_envios_historial geh
            JOIN google_sheets_asignaciones ga ON geh.asignacion_id = ga.id
            WHERE geh.asignacion_id = ? AND ga.usuario_id = ?
            ORDER BY geh.fecha_programado DESC
            LIMIT 100
        `, [asignacionId, usuario.id])

        return rows

    } catch (error) {
        console.log('Error al obtener historial de envíos:', error)
        throw error
    }
}

export async function obtenerEstadisticasEnvios(asignacionId) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        const [rows] = await db.execute(`
            SELECT 
                COUNT(*) as total_envios,
                SUM(CASE WHEN estado_envio = 'enviado' THEN 1 ELSE 0 END) as total_enviados,
                SUM(CASE WHEN estado_envio = 'fallido' THEN 1 ELSE 0 END) as total_fallidos,
                SUM(CASE WHEN estado_envio = 'pendiente' THEN 1 ELSE 0 END) as total_pendientes,
                MAX(fecha_enviado) as ultimo_envio_exitoso,
                COUNT(DISTINCT numero_telefono) as contactos_unicos
            FROM google_sheets_envios_historial geh
            JOIN google_sheets_asignaciones ga ON geh.asignacion_id = ga.id
            WHERE geh.asignacion_id = ? AND ga.usuario_id = ?
        `, [asignacionId, usuario.id])

        return rows[0] || {
            total_envios: 0,
            total_enviados: 0,
            total_fallidos: 0,
            total_pendientes: 0,
            ultimo_envio_exitoso: null,
            contactos_unicos: 0
        }

    } catch (error) {
        console.log('Error al obtener estadísticas:', error)
        throw error
    }
}

export async function procesarEnviosSheet(asignacionId, datosSheet) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        const [asignacionRows] = await db.execute(`
            SELECT * FROM google_sheets_asignaciones 
            WHERE id = ? AND usuario_id = ? AND activa = 1
        `, [asignacionId, usuario.id])

        if (asignacionRows.length === 0) {
            throw new Error('Asignación no encontrada o inactiva')
        }

        const asignacion = asignacionRows[0]
        
        if (!datosSheet || datosSheet.length === 0) {
            throw new Error('No hay datos en el Excel para procesar')
        }

        const headers = Object.keys(datosSheet[0])
        const columnaHeaderTelefono = headers[asignacion.columna_telefono.charCodeAt(0) - 65]
        const columnaHeaderNombre = asignacion.columna_nombre ? 
            headers[asignacion.columna_nombre.charCodeAt(0) - 65] : null
        const columnaHeaderRestriccion = asignacion.columna_restriccion ? 
            headers[asignacion.columna_restriccion.charCodeAt(0) - 65] : null

        if (!columnaHeaderTelefono) {
            throw new Error('Columna de teléfono no válida')
        }

        let enviados = 0
        let omitidos = 0

        for (let index = 0; index < datosSheet.length; index++) {
            const fila = datosSheet[index]
            const telefono = fila[columnaHeaderTelefono]
            const nombre = columnaHeaderNombre ? fila[columnaHeaderNombre] : `Usuario ${index + 1}`
            const valorRestriccion = columnaHeaderRestriccion ? fila[columnaHeaderRestriccion] : null

            if (!telefono || telefono.trim() === '') {
                omitidos++
                continue
            }

            // Verificar restricción
            if (valorRestriccion && asignacion.valor_restriccion && 
                valorRestriccion.toString().toLowerCase().includes(asignacion.valor_restriccion.toLowerCase())) {
                omitidos++
                continue
            }

            const telefonoLimpio = limpiarTelefono(telefono)
            if (!validarTelefono(telefonoLimpio)) {
                omitidos++
                continue
            }

            // Verificar si ya se envió mensaje a este número
            if (asignacion.enviar_solo_nuevos) {
                const [existeEnvio] = await db.execute(`
                    SELECT id FROM google_sheets_envios_historial 
                    WHERE asignacion_id = ? AND numero_telefono = ? AND estado_envio = 'enviado'
                    AND fecha_enviado >= DATE_SUB(NOW(), INTERVAL ? HOUR)
                `, [asignacionId, telefonoLimpio, asignacion.intervalo_horas])

                if (existeEnvio.length > 0) {
                    omitidos++
                    continue
                }
            }

            // Personalizar mensaje
            const mensajePersonalizado = asignacion.mensaje_bienvenida
                .replace(/{nombre}/g, nombre || 'Usuario')
                .replace(/{telefono}/g, telefonoLimpio)

            try {
                // Registrar en historial antes del envío
                const [historialResult] = await db.execute(`
                    INSERT INTO google_sheets_envios_historial (
                        asignacion_id,
                        usuario_id,
                        numero_telefono,
                        nombre_destinatario,
                        tipo_mensaje,
                        contenido_mensaje,
                        estado_envio,
                        spreadsheet_id,
                        sheet_name,
                        fila_sheet,
                        fecha_programado
                    ) VALUES (?, ?, ?, ?, 'bienvenida', ?, 'pendiente', ?, ?, ?, NOW())
                `, [
                    asignacionId,
                    usuario.id,
                    telefonoLimpio,
                    nombre,
                    mensajePersonalizado,
                    asignacion.spreadsheet_id,
                    asignacion.sheet_name,
                    index + 1
                ])

                // Enviar mensaje por WhatsApp
                const resultadoEnvio = await enviarMensajeWhatsApp(telefonoLimpio, mensajePersonalizado)

                if (resultadoEnvio.success) {
                    // Actualizar historial como enviado
                    await db.execute(`
                        UPDATE google_sheets_envios_historial 
                        SET estado_envio = 'enviado',
                            mensaje_id_whatsapp = ?,
                            fecha_enviado = NOW()
                        WHERE id = ?
                    `, [resultadoEnvio.messageId, historialResult.insertId])

                    enviados++
                } else {
                    // Actualizar historial como fallido
                    await db.execute(`
                        UPDATE google_sheets_envios_historial 
                        SET estado_envio = 'fallido',
                            error_envio = ?
                        WHERE id = ?
                    `, [resultadoEnvio.error, historialResult.insertId])

                    omitidos++
                }

            } catch (envioError) {
                console.log('Error al enviar mensaje individual:', envioError)
                omitidos++
            }

            // Pequeña pausa entre envíos para no saturar la API
            await new Promise(resolve => setTimeout(resolve, 1000))
        }

        return {
            success: true,
            enviados,
            omitidos,
            message: `Procesamiento completado: ${enviados} enviados, ${omitidos} omitidos`
        }

    } catch (error) {
        console.log('Error al procesar envíos:', error)
        return {
            success: false,
            error: error.message
        }
    }
}

export async function enviarMensajeManual(telefono, mensaje, nombre, asignacionId) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        const telefonoLimpio = limpiarTelefono(telefono)
        if (!validarTelefono(telefonoLimpio)) {
            throw new Error('Número de teléfono no válido')
        }

        // Registrar en historial
        const [historialResult] = await db.execute(`
            INSERT INTO google_sheets_envios_historial (
                asignacion_id,
                usuario_id,
                numero_telefono,
                nombre_destinatario,
                tipo_mensaje,
                contenido_mensaje,
                estado_envio,
                spreadsheet_id,
                sheet_name,
                fila_sheet,
                fecha_programado
            ) VALUES (?, ?, ?, ?, 'manual', ?, 'pendiente', 'manual', 'manual', 0, NOW())
        `, [
            asignacionId || null,
            usuario.id,
            telefonoLimpio,
            nombre,
            mensaje
        ])

        // Enviar mensaje
        const resultadoEnvio = await enviarMensajeWhatsApp(telefonoLimpio, mensaje)

        if (resultadoEnvio.success) {
            await db.execute(`
                UPDATE google_sheets_envios_historial 
                SET estado_envio = 'enviado',
                    mensaje_id_whatsapp = ?,
                    fecha_enviado = NOW()
                WHERE id = ?
            `, [resultadoEnvio.messageId, historialResult.insertId])

            return {
                success: true,
                messageId: resultadoEnvio.messageId,
                message: 'Mensaje enviado exitosamente'
            }
        } else {
            await db.execute(`
                UPDATE google_sheets_envios_historial 
                SET estado_envio = 'fallido',
                    error_envio = ?
                WHERE id = ?
            `, [resultadoEnvio.error, historialResult.insertId])

            return {
                success: false,
                error: resultadoEnvio.error
            }
        }

    } catch (error) {
        console.log('Error al enviar mensaje manual:', error)
        return {
            success: false,
            error: error.message
        }
    }
}

// Función para enviar mensaje por WhatsApp usando la configuración activa
async function enviarMensajeWhatsApp(telefono, mensaje) {
    try {
        // Verificar configuración activa de WhatsApp
        const [configRows] = await db.execute(`
            SELECT ca.*, 
                   cw.phone_number_id, cw.access_token,
                   cb.session_id, cb.estado_conexion
            FROM configuraciones_activas ca
            LEFT JOIN configuraciones_whatsapp cw ON ca.config_id = cw.id AND ca.tipo_config = 'api'
            LEFT JOIN configuraciones_baileys cb ON ca.config_id = cb.id AND ca.tipo_config = 'baileys'
            WHERE ca.plataforma = 'whatsapp'
            LIMIT 1
        `)

        if (configRows.length === 0) {
            throw new Error('No hay configuración activa de WhatsApp')
        }

        const config = configRows[0]
        
        if (config.tipo_config === 'api' && config.phone_number_id && config.access_token) {
            return await enviarConWhatsAppAPI(telefono, mensaje, config)
        } else if (config.tipo_config === 'baileys' && config.session_id && config.estado_conexion === 'conectado') {
            return await enviarConBaileys(telefono, mensaje, config)
        } else {
            throw new Error('Configuración de WhatsApp no disponible o inactiva')
        }

    } catch (error) {
        console.log('Error al enviar mensaje WhatsApp:', error)
        return {
            success: false,
            error: error.message
        }
    }
}

async function enviarConWhatsAppAPI(telefono, mensaje, config) {
    try {
        const url = `https://graph.facebook.com/v17.0/${config.phone_number_id}/messages`
        
        const payload = {
            messaging_product: "whatsapp",
            to: telefono,
            type: "text",
            text: {
                body: mensaje
            }
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })

        const data = await response.json()

        if (response.ok && data.messages && data.messages[0]) {
            return {
                success: true,
                messageId: data.messages[0].id,
                provider: 'whatsapp_api'
            }
        } else {
            throw new Error(data.error?.message || 'Error al enviar mensaje por API')
        }

    } catch (error) {
        console.log('Error en WhatsApp API:', error)
        return {
            success: false,
            error: error.message
        }
    }
}

async function enviarConBaileys(telefono, mensaje, config) {
    try {
        // Aquí iría la integración con Baileys
        // Por ahora simularemos el envío
        console.log('Enviando con Baileys:', { telefono, mensaje, sessionId: config.session_id })
        
        // Simulación de envío exitoso
        return {
            success: true,
            messageId: `baileys_${Date.now()}`,
            provider: 'baileys'
        }

    } catch (error) {
        console.log('Error en Baileys:', error)
        return {
            success: false,
            error: error.message
        }
    }
}

// Funciones auxiliares
function limpiarTelefono(telefono) {
    if (!telefono) return ''
    
    // Remover espacios, guiones, paréntesis
    let limpio = telefono.toString().replace(/[\s\-\(\)\+]/g, '')
    
    // Si empieza con 52 (México), mantenerlo
    if (limpio.startsWith('52') && limpio.length === 12) {
        return limpio
    }
    
    // Si es número local mexicano (10 dígitos), agregar 52
    if (limpio.length === 10) {
        return '52' + limpio
    }
    
    // Si tiene 11 dígitos y empieza con 1, puede ser de México
    if (limpio.length === 11 && limpio.startsWith('1')) {
        return '52' + limpio.substring(1)
    }
    
    return limpio
}

function validarTelefono(telefono) {
    if (!telefono) return false
    
    // Debe tener entre 10 y 15 dígitos
    if (telefono.length < 10 || telefono.length > 15) return false
    
    // Solo números
    if (!/^\d+$/.test(telefono)) return false
    
    return true
}

export async function obtenerConfiguracionWhatsAppActiva() {
    try {
        const [rows] = await db.execute(`
            SELECT ca.tipo_config,
                   cw.phone_number_id, cw.access_token,
                   cb.session_id, cb.estado_conexion, cb.numero_whatsapp
            FROM configuraciones_activas ca
            LEFT JOIN configuraciones_whatsapp cw ON ca.config_id = cw.id AND ca.tipo_config = 'api'
            LEFT JOIN configuraciones_baileys cb ON ca.config_id = cb.id AND ca.tipo_config = 'baileys'
            WHERE ca.plataforma = 'whatsapp'
            LIMIT 1
        `)

        if (rows.length === 0) {
            return {
                configurada: false,
                tipo: null,
                estado: 'no_configurada'
            }
        }

        const config = rows[0]
        
        return {
            configurada: true,
            tipo: config.tipo_config,
            estado: config.tipo_config === 'api' ? 'activa' : config.estado_conexion,
            numero: config.tipo_config === 'api' ? config.phone_number_id : config.numero_whatsapp
        }

    } catch (error) {
        console.log('Error al obtener configuración WhatsApp:', error)
        return {
            configurada: false,
            tipo: null,
            estado: 'error'
        }
    }
}

export async function probarEnvioWhatsApp(telefono, mensaje) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        if (usuario.rol === 'usuario') {
            throw new Error('Sin permisos para probar envíos')
        }

        const telefonoLimpio = limpiarTelefono(telefono)
        if (!validarTelefono(telefonoLimpio)) {
            throw new Error('Número de teléfono no válido')
        }

        const resultado = await enviarMensajeWhatsApp(telefonoLimpio, mensaje)
        
        return {
            success: resultado.success,
            message: resultado.success ? 
                `Mensaje de prueba enviado exitosamente (${resultado.provider})` : 
                `Error al enviar: ${resultado.error}`,
            provider: resultado.provider || null,
            messageId: resultado.messageId || null
        }

    } catch (error) {
        console.log('Error al probar envío:', error)
        return {
            success: false,
            message: error.message
        }
    }
}

export async function obtenerResumenAsignaciones() {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        const [resumen] = await db.execute(`
            SELECT 
                COUNT(ga.id) as total_asignaciones,
                SUM(CASE WHEN ga.activa = 1 THEN 1 ELSE 0 END) as asignaciones_activas,
                COUNT(DISTINCT geh.numero_telefono) as contactos_unicos,
                SUM(CASE WHEN geh.estado_envio = 'enviado' THEN 1 ELSE 0 END) as total_enviados,
                SUM(CASE WHEN geh.estado_envio = 'fallido' THEN 1 ELSE 0 END) as total_fallidos,
                MAX(geh.fecha_enviado) as ultimo_envio
            FROM google_sheets_asignaciones ga
            LEFT JOIN google_sheets_envios_historial geh ON ga.id = geh.asignacion_id
            WHERE ga.usuario_id = ?
        `, [usuario.id])

        const [enviosPorDia] = await db.execute(`
            SELECT 
                DATE(geh.fecha_enviado) as fecha,
                COUNT(*) as envios,
                SUM(CASE WHEN geh.estado_envio = 'enviado' THEN 1 ELSE 0 END) as exitosos,
                SUM(CASE WHEN geh.estado_envio = 'fallido' THEN 1 ELSE 0 END) as fallidos
            FROM google_sheets_envios_historial geh
            JOIN google_sheets_asignaciones ga ON geh.asignacion_id = ga.id
            WHERE ga.usuario_id = ? 
            AND geh.fecha_enviado >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            GROUP BY DATE(geh.fecha_enviado)
            ORDER BY fecha DESC
        `, [usuario.id])

        return {
            resumen: resumen[0] || {
                total_asignaciones: 0,
                asignaciones_activas: 0,
                contactos_unicos: 0,
                total_enviados: 0,
                total_fallidos: 0,
                ultimo_envio: null
            },
            envios_por_dia: enviosPorDia
        }

    } catch (error) {
        console.log('Error al obtener resumen:', error)
        throw error
    }
}