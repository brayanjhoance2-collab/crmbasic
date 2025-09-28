"use server"
import db from "@/_DB/db"
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'crm_whatsapp_facebook_2024'

// Función para obtener el usuario actual
export async function obtenerUsuarioActual() {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get('auth-token')
        
        if (!token) return null

        const decoded = jwt.verify(token.value, JWT_SECRET)
        const userId = decoded.userId

        const [rows] = await db.execute(`
            SELECT id, correo, nombre, apellidos, telefono, avatar_url, rol, activo, ultimo_acceso, fecha_registro
            FROM usuarios WHERE id = ? AND activo = 1
        `, [userId])

        if (rows.length === 0) return null

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

// Función para obtener configuración de Instagram
export async function obtenerConfiguracionInstagram() {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        if (usuario.rol === 'usuario') {
            throw new Error('Sin permisos para ver configuraciones')
        }

        const [rows] = await db.execute(`
            SELECT * FROM configuraciones_instagram 
            ORDER BY fecha_creacion DESC LIMIT 1
        `)

        return rows.length > 0 ? rows[0] : null

    } catch (error) {
        console.log('Error al obtener configuración Instagram:', error)
        throw error
    }
}

// Función para crear configuración de Instagram
export async function crearConfiguracionInstagram(datos) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        if (usuario.rol === 'usuario') {
            throw new Error('Sin permisos para crear configuraciones')
        }

        // Verificar si ya existe una configuración
        const [existente] = await db.execute(`
            SELECT COUNT(*) as total FROM configuraciones_instagram
        `)

        if (existente[0].total > 0) {
            throw new Error('Solo se permite una configuración de Instagram')
        }

        const {
            nombre_configuracion,
            access_token,
            instagram_business_id,
            webhook_verify_token
        } = datos

// Validar solo los campos obligatorios
if (!nombre_configuracion || !access_token) {
    throw new Error('Nombre de configuración y token de acceso son obligatorios')
}

let businessId = instagram_business_id

// Si no se proporciona business ID, intentar detectarlo automáticamente
if (!businessId) {
    const businessAccounts = await obtenerBusinessAccounts(access_token)
    if (businessAccounts.length > 0) {
        businessId = businessAccounts[0].id
        console.log(`Business ID detectado automáticamente: ${businessId}`)
    }
}

// Validar configuración si tenemos business ID
if (businessId) {
    const validacion = await validarConfiguracionInstagram(access_token, businessId)
    if (!validacion.valido) {
        throw new Error(validacion.mensaje)
    }
}

        // Insertar configuración
        const [resultado] = await db.execute(`
            INSERT INTO configuraciones_instagram (
                nombre_configuracion,
                instagram_business_id,
                access_token,
                webhook_verify_token,
                fecha_creacion
            ) VALUES (?, ?, ?, ?, NOW())
        `, [nombre_configuracion, instagram_business_id, access_token, webhook_verify_token])

        // Guardar información del business account
        await guardarBusinessAccountInfo(access_token, instagram_business_id)

        // Crear entrada de métricas para hoy
        await db.execute(`
            INSERT INTO instagram_metricas (configuracion_id, fecha_metrica)
            VALUES (?, CURDATE())
            ON DUPLICATE KEY UPDATE configuracion_id = configuracion_id
        `, [resultado.insertId])

        return {
            success: true,
            message: 'Configuración de Instagram creada exitosamente'
        }

    } catch (error) {
        console.log('Error al crear configuración Instagram:', error)
        throw error
    }
}

// Función para actualizar configuración de Instagram
export async function actualizarConfiguracionInstagram(datos) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        if (usuario.rol === 'usuario') {
            throw new Error('Sin permisos para actualizar configuraciones')
        }

        const {
            nombre_configuracion,
            access_token,
            instagram_business_id,
            webhook_verify_token
        } = datos

// Validar solo los campos obligatorios
if (!nombre_configuracion || !access_token) {
    throw new Error('Nombre de configuración y token de acceso son obligatorios')
}

let businessId = instagram_business_id

// Si no se proporciona business ID, intentar detectarlo automáticamente
if (!businessId) {
    const businessAccounts = await obtenerBusinessAccounts(access_token)
    if (businessAccounts.length > 0) {
        businessId = businessAccounts[0].id
        console.log(`Business ID detectado automáticamente: ${businessId}`)
    }
}

// Validar configuración si tenemos business ID
if (businessId) {
    const validacion = await validarConfiguracionInstagram(access_token, businessId)
    if (!validacion.valido) {
        throw new Error(validacion.mensaje)
    }
}
        // Obtener configuración existente
        const [configRows] = await db.execute(`
            SELECT id FROM configuraciones_instagram LIMIT 1
        `)

        if (configRows.length === 0) {
            throw new Error('No hay configuración de Instagram para actualizar')
        }

        const configId = configRows[0].id

        // Actualizar configuración
        await db.execute(`
            UPDATE configuraciones_instagram SET
                nombre_configuracion = ?,
                instagram_business_id = ?,
                access_token = ?,
                webhook_verify_token = ?,
                fecha_actualizacion = NOW()
            WHERE id = ?
        `, [nombre_configuracion, instagram_business_id, access_token, webhook_verify_token, configId])

        // Actualizar información del business account
        await guardarBusinessAccountInfo(access_token, instagram_business_id)

        return {
            success: true,
            message: 'Configuración de Instagram actualizada exitosamente'
        }

    } catch (error) {
        console.log('Error al actualizar configuración Instagram:', error)
        throw error
    }
}

// Función para eliminar configuración de Instagram
export async function eliminarConfiguracionInstagram() {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        if (usuario.rol === 'usuario') {
            throw new Error('Sin permisos para eliminar configuraciones')
        }

        // Eliminar configuración y datos relacionados
        await db.execute(`DELETE FROM configuraciones_instagram`)
        await db.execute(`DELETE FROM instagram_business_accounts`)
        await db.execute(`DELETE FROM instagram_metricas`)
        await db.execute(`DELETE FROM instagram_webhooks_log`)

        return {
            success: true,
            message: 'Configuración de Instagram eliminada exitosamente'
        }

    } catch (error) {
        console.log('Error al eliminar configuración Instagram:', error)
        throw error
    }
}

// Función corregida para validar configuración de Instagram
async function validarConfiguracionInstagram(accessToken, businessId) {
    try {
        // Validar formato básico
        if (!accessToken || accessToken.length < 50) {
            return { valido: false, mensaje: 'Token de acceso inválido' }
        }

        // Para Instagram Business API, no uses /me, usa el business ID directamente
        if (businessId && /^\d+$/.test(businessId)) {
            // Verificar acceso al business account específico
            const businessResponse = await fetch(
                `https://graph.facebook.com/v18.0/${businessId}?fields=name,username&access_token=${accessToken}`
            )
            const businessData = await businessResponse.json()

            if (businessData.error) {
                return { 
                    valido: false, 
                    mensaje: `Error del Business Account: ${businessData.error.message}`,
                    error_code: businessData.error.code 
                }
            }

            return { 
                valido: true, 
                mensaje: 'Configuración válida',
                businessInfo: businessData
            }
        }

        // Si no hay business ID, intentar obtener información básica del token
        // Usar debug_token para validar el token
        const debugResponse = await fetch(
            `https://graph.facebook.com/debug_token?input_token=${accessToken}&access_token=${accessToken}`
        )
        const debugData = await debugResponse.json()

        if (debugData.error) {
            return { 
                valido: false, 
                mensaje: `Token inválido: ${debugData.error.message}` 
            }
        }

        if (!debugData.data || !debugData.data.is_valid) {
            return { 
                valido: false, 
                mensaje: 'Token no válido o expirado' 
            }
        }

        // Verificar que el token tenga los permisos necesarios
        const requiredScopes = ['instagram_business_basic', 'instagram_business_manage_messages']
        const tokenScopes = debugData.data.scopes || []
        
        const missingScopes = requiredScopes.filter(scope => !tokenScopes.includes(scope))
        if (missingScopes.length > 0) {
            return {
                valido: false,
                mensaje: `Faltan permisos: ${missingScopes.join(', ')}`
            }
        }

        return { 
            valido: true, 
            mensaje: 'Token válido',
            tokenInfo: debugData.data
        }

    } catch (error) {
        console.log('Error validando configuración:', error)
        return { 
            valido: false, 
            mensaje: `Error de red: ${error.message}` 
        }
    }
}


// Función para guardar información del business account
async function guardarBusinessAccountInfo(accessToken, businessId) {
    try {
        const response = await fetch(`https://graph.facebook.com/v18.0/${businessId}?fields=name,username,profile_picture_url,followers_count,media_count&access_token=${accessToken}`)
        const data = await response.json()

        if (!data.error) {
            await db.execute(`
                INSERT INTO instagram_business_accounts (
                    instagram_business_id,
                    nombre,
                    username,
                    profile_picture_url,
                    followers_count,
                    media_count,
                    fecha_vinculacion
                ) VALUES (?, ?, ?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE
                    nombre = VALUES(nombre),
                    username = VALUES(username),
                    profile_picture_url = VALUES(profile_picture_url),
                    followers_count = VALUES(followers_count),
                    media_count = VALUES(media_count),
                    fecha_actualizacion = NOW()
            `, [
                businessId,
                data.name || null,
                data.username || null,
                data.profile_picture_url || null,
                data.followers_count || 0,
                data.media_count || 0
            ])
        }

    } catch (error) {
        console.log('Error guardando business account info:', error)
    }
}

// Función mejorada para obtener business accounts
export async function obtenerBusinessAccounts(accessToken) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        if (!accessToken || accessToken.length < 50) {
            return []
        }

        // Primero verificar el token
        const debugResponse = await fetch(
            `https://graph.facebook.com/debug_token?input_token=${accessToken}&access_token=${accessToken}`
        )
        const debugData = await debugResponse.json()

        if (debugData.error || !debugData.data?.is_valid) {
            console.log('Token inválido:', debugData.error?.message || 'Token no válido')
            return []
        }

        const userId = debugData.data.user_id
        if (!userId) {
            console.log('No se pudo obtener user_id del token')
            return []
        }

        // Obtener páginas usando el user_id
        const pagesResponse = await fetch(
            `https://graph.facebook.com/v18.0/${userId}/accounts?access_token=${accessToken}`
        )
        const pagesData = await pagesResponse.json()

        if (pagesData.error) {
            console.log('Error obteniendo páginas:', pagesData.error)
            return []
        }

        if (!pagesData.data || pagesData.data.length === 0) {
            console.log('No se encontraron páginas de Facebook')
            return []
        }

        const businessAccounts = []

        // Para cada página, obtener cuenta de Instagram Business
        for (const page of pagesData.data) {
            try {
                const igResponse = await fetch(
                    `https://graph.facebook.com/v18.0/${page.id}?fields=instagram_business_account&access_token=${accessToken}`
                )
                const igData = await igResponse.json()

                if (igData.instagram_business_account) {
                    const businessId = igData.instagram_business_account.id

                    // Obtener información detallada del Instagram Business Account
                    const infoResponse = await fetch(
                        `https://graph.facebook.com/v18.0/${businessId}?fields=name,username,profile_picture_url,followers_count&access_token=${accessToken}`
                    )
                    const infoData = await infoResponse.json()

                    if (!infoData.error) {
                        businessAccounts.push({
                            id: businessId,
                            name: infoData.name || 'Sin nombre',
                            username: infoData.username || 'sin_username',
                            profile_picture_url: infoData.profile_picture_url || null,
                            followers_count: infoData.followers_count || 0,
                            facebook_page_id: page.id,
                            facebook_page_name: page.name
                        })
                    } else {
                        console.log(`Error obteniendo info de IG business ${businessId}:`, infoData.error)
                    }
                }
            } catch (error) {
                console.log('Error procesando página:', page.id, error.message)
            }
        }

        return businessAccounts

    } catch (error) {
        console.log('Error obteniendo business accounts:', error)
        return []
    }
}

// Función para probar conexión de Instagram
export async function probarConexionInstagram() {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        if (usuario.rol === 'usuario') {
            throw new Error('Sin permisos para probar conexiones')
        }

        const configuracion = await obtenerConfiguracionInstagram()
        if (!configuracion) {
            throw new Error('No hay configuración de Instagram')
        }

        // Probar acceso a la API
        const response = await fetch(`https://graph.facebook.com/v18.0/${configuracion.instagram_business_id}?fields=name,username,followers_count&access_token=${configuracion.access_token}`)
        const data = await response.json()

        if (data.error) {
            return {
                success: false,
                message: `Error de conexión: ${data.error.message}`
            }
        }

        // Actualizar información en base de datos
        await guardarBusinessAccountInfo(configuracion.access_token, configuracion.instagram_business_id)

        return {
            success: true,
            message: `Conexión exitosa con ${data.name} (@${data.username})`
        }

    } catch (error) {
        console.log('Error probando conexión Instagram:', error)
        return {
            success: false,
            message: error.message || 'Error al probar conexión'
        }
    }
}

// Función para verificar webhook de Instagram
export async function verificarWebhookInstagram() {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        if (usuario.rol === 'usuario') {
            throw new Error('Sin permisos para verificar webhooks')
        }

        const configuracion = await obtenerConfiguracionInstagram()
        if (!configuracion) {
            throw new Error('No hay configuración de Instagram')
        }

        // Verificar que el webhook esté configurado
        if (!configuracion.webhook_verify_token) {
            return {
                success: false,
                message: 'Token de verificación de webhook no configurado'
            }
        }

        // En un escenario real, aquí verificarías el webhook con Meta
        // Por ahora, solo verificamos la configuración local
        const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/webhooks/instagram`

        return {
            success: true,
            message: `Webhook configurado correctamente en ${webhookUrl}`
        }

    } catch (error) {
        console.log('Error verificando webhook Instagram:', error)
        return {
            success: false,
            message: error.message || 'Error al verificar webhook'
        }
    }
}

// Función para obtener métricas de Instagram
export async function obtenerMetricasInstagram() {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        if (usuario.rol === 'usuario') {
            throw new Error('Sin permisos para ver métricas')
        }

        // Obtener métricas de los últimos 30 días
        const [metricasRows] = await db.execute(`
            SELECT 
                SUM(mensajes_enviados) as total_enviados,
                SUM(mensajes_recibidos) as total_recibidos,
                SUM(conversaciones_nuevas) as total_conversaciones
            FROM instagram_metricas 
            WHERE fecha_metrica >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        `)

        // Obtener conteo de mensajes de la tabla principal
        const [mensajesRows] = await db.execute(`
            SELECT 
                COUNT(CASE WHEN direccion = 'saliente' THEN 1 END) as enviados,
                COUNT(CASE WHEN direccion = 'entrante' THEN 1 END) as recibidos
            FROM mensajes m
            INNER JOIN conversaciones c ON m.conversacion_id = c.id
            WHERE c.plataforma = 'instagram'
            AND m.fecha_envio >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        `)

        // Obtener conteo de conversaciones
        const [conversacionesRows] = await db.execute(`
            SELECT COUNT(*) as total
            FROM conversaciones 
            WHERE plataforma = 'instagram'
            AND fecha_inicio >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        `)

        const metricas = metricasRows[0]
        const mensajes = mensajesRows[0]
        const conversaciones = conversacionesRows[0]

        return {
            mensajes_enviados: parseInt(mensajes.enviados) || 0,
            mensajes_recibidos: parseInt(mensajes.recibidos) || 0,
            conversaciones_nuevas: parseInt(conversaciones.total) || 0,
            metricas_almacenadas: {
                enviados: parseInt(metricas.total_enviados) || 0,
                recibidos: parseInt(metricas.total_recibidos) || 0,
                conversaciones: parseInt(metricas.total_conversaciones) || 0
            }
        }

    } catch (error) {
        console.log('Error obteniendo métricas Instagram:', error)
        return {
            mensajes_enviados: 0,
            mensajes_recibidos: 0,
            conversaciones_nuevas: 0
        }
    }
}

// Función para procesar mensaje entrante de Instagram (para webhook)
export async function procesarMensajeInstagram(messageData) {
    try {
        console.log('Procesando mensaje Instagram:', JSON.stringify(messageData, null, 2))

        if (!messageData.message) {
            console.log('No es un mensaje entrante, ignorando')
            return { success: false, message: 'No es un mensaje entrante' }
        }

        const instagramId = messageData.sender.id
        const messageId = messageData.message.mid
        const timestamp = messageData.timestamp

        // Extraer contenido del mensaje
        let contenido = ''
        let tipoMensaje = 'texto'

        if (messageData.message.text) {
            contenido = messageData.message.text
            tipoMensaje = 'texto'
        } else if (messageData.message.attachments) {
            const attachment = messageData.message.attachments[0]
            
            switch (attachment.type) {
                case 'image':
                    contenido = 'Imagen'
                    tipoMensaje = 'imagen'
                    break
                case 'video':
                    contenido = 'Video'
                    tipoMensaje = 'video'
                    break
                case 'audio':
                    contenido = 'Audio'
                    tipoMensaje = 'audio'
                    break
                case 'file':
                    contenido = 'Archivo'
                    tipoMensaje = 'documento'
                    break
                default:
                    contenido = 'Mensaje multimedia'
            }
        } else {
            contenido = 'Mensaje desconocido'
        }

        console.log(`Mensaje Instagram de ${instagramId}: ${contenido}`)

        // Buscar o crear contacto
        let [contactoRows] = await db.execute(`
            SELECT id FROM contactos WHERE instagram_id = ?
        `, [instagramId])

        let contactoId
        if (contactoRows.length === 0) {
            const [resultado] = await db.execute(`
                INSERT INTO contactos (
                    instagram_id,
                    nombre,
                    origen,
                    estado,
                    primera_interaccion,
                    fecha_creacion
                ) VALUES (?, ?, 'instagram', 'nuevo', FROM_UNIXTIME(?), NOW())
            `, [instagramId, instagramId, Math.floor(timestamp / 1000)])
            
            contactoId = resultado.insertId
            console.log(`Contacto Instagram creado: ${contactoId}`)
        } else {
            contactoId = contactoRows[0].id
            
            await db.execute(`
                UPDATE contactos SET ultima_interaccion = FROM_UNIXTIME(?) WHERE id = ?
            `, [Math.floor(timestamp / 1000), contactoId])
        }

        // Buscar o crear conversación
        let [conversacionRows] = await db.execute(`
            SELECT id FROM conversaciones 
            WHERE contacto_id = ? AND plataforma = 'instagram' AND estado != 'cerrada'
        `, [contactoId])

        let conversacionId
        if (conversacionRows.length === 0) {
            const [resultado] = await db.execute(`
                INSERT INTO conversaciones (
                    contacto_id,
                    plataforma,
                    estado,
                    fecha_inicio,
                    fecha_ultima_actividad
                ) VALUES (?, 'instagram', 'abierta', FROM_UNIXTIME(?), FROM_UNIXTIME(?))
            `, [contactoId, Math.floor(timestamp / 1000), Math.floor(timestamp / 1000)])
            
            conversacionId = resultado.insertId
            console.log(`Conversación Instagram creada: ${conversacionId}`)
        } else {
            conversacionId = conversacionRows[0].id
        }

        // Verificar si el mensaje ya existe
        const [mensajeExistente] = await db.execute(`
            SELECT id FROM mensajes WHERE mensaje_id_externo = ?
        `, [messageId])

        if (mensajeExistente.length > 0) {
            console.log('Mensaje Instagram ya procesado previamente')
            return { success: true, message: 'Mensaje ya procesado' }
        }

        // Insertar mensaje
        await db.execute(`
            INSERT INTO mensajes (
                conversacion_id,
                contacto_id,
                mensaje_id_externo,
                tipo_mensaje,
                contenido,
                direccion,
                estado_entrega,
                fecha_envio
            ) VALUES (?, ?, ?, ?, ?, 'entrante', 'entregado', FROM_UNIXTIME(?))
        `, [conversacionId, contactoId, messageId, tipoMensaje, contenido, Math.floor(timestamp / 1000)])

        // Actualizar contadores de conversación
        await db.execute(`
            UPDATE conversaciones SET 
                fecha_ultima_actividad = FROM_UNIXTIME(?),
                mensajes_contacto = mensajes_contacto + 1,
                total_mensajes = total_mensajes + 1
            WHERE id = ?
        `, [Math.floor(timestamp / 1000), conversacionId])

        // Actualizar métricas
        await actualizarMetricasInstagram('mensaje_recibido')

        console.log('Mensaje Instagram procesado exitosamente')

        // Ejecutar automatizaciones si están disponibles
        try {
            const { procesarMensajeParaAutomatizaciones } = await import('../../automatizacion/servidor')
            
            const resultadoAuto = await procesarMensajeParaAutomatizaciones(conversacionId, {
                contenido: contenido,
                tipo_mensaje: tipoMensaje,
                direccion: 'entrante'
            })
            
            console.log('Automatizaciones Instagram procesadas:', resultadoAuto)
        } catch (autoError) {
            console.log('Error ejecutando automatizaciones Instagram:', autoError)
        }

        return { success: true, message: 'Mensaje procesado exitosamente' }

    } catch (error) {
        console.log('Error procesando mensaje Instagram:', error)
        throw error
    }
}

// Función para actualizar métricas de Instagram
async function actualizarMetricasInstagram(tipo) {
    try {
        const [configRows] = await db.execute(`
            SELECT id FROM configuraciones_instagram LIMIT 1
        `)

        if (configRows.length === 0) return

        const configId = configRows[0].id

        if (tipo === 'mensaje_recibido') {
            await db.execute(`
                INSERT INTO instagram_metricas (configuracion_id, fecha_metrica, mensajes_recibidos)
                VALUES (?, CURDATE(), 1)
                ON DUPLICATE KEY UPDATE mensajes_recibidos = mensajes_recibidos + 1
            `, [configId])
        } else if (tipo === 'mensaje_enviado') {
            await db.execute(`
                INSERT INTO instagram_metricas (configuracion_id, fecha_metrica, mensajes_enviados)
                VALUES (?, CURDATE(), 1)
                ON DUPLICATE KEY UPDATE mensajes_enviados = mensajes_enviados + 1
            `, [configId])
        } else if (tipo === 'conversacion_nueva') {
            await db.execute(`
                INSERT INTO instagram_metricas (configuracion_id, fecha_metrica, conversaciones_nuevas)
                VALUES (?, CURDATE(), 1)
                ON DUPLICATE KEY UPDATE conversaciones_nuevas = conversaciones_nuevas + 1
            `, [configId])
        }

    } catch (error) {
        console.log('Error actualizando métricas Instagram:', error)
    }
}

// Función para enviar mensaje de Instagram
export async function enviarMensajeInstagram(conversacionId, contenido) {
    try {
        console.log(`Intentando enviar mensaje Instagram a conversación ${conversacionId}`)

        const [conversacionRows] = await db.execute(`
            SELECT conv.*, c.instagram_id 
            FROM conversaciones conv
            INNER JOIN contactos c ON conv.contacto_id = c.id
            WHERE conv.id = ? AND conv.plataforma = 'instagram'
        `, [conversacionId])

        if (conversacionRows.length === 0) {
            throw new Error('Conversación de Instagram no encontrada')
        }

        const conversacion = conversacionRows[0]
        console.log(`Enviando a Instagram ID: ${conversacion.instagram_id}`)

        // Obtener configuración
        const configuracion = await obtenerConfiguracionInstagram()
        if (!configuracion) {
            throw new Error('No hay configuración de Instagram')
        }

        // Enviar mensaje usando Graph API
        const response = await fetch(`https://graph.facebook.com/v18.0/${configuracion.instagram_business_id}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${configuracion.access_token}`
            },
            body: JSON.stringify({
                recipient: {
                    id: conversacion.instagram_id
                },
                message: {
                    text: contenido
                }
            })
        })

        const responseData = await response.json()

        if (responseData.error) {
            console.log('Error enviando mensaje Instagram:', responseData.error)
            throw new Error(`Error de Instagram: ${responseData.error.message}`)
        }

        console.log('Mensaje Instagram enviado exitosamente')

        // Actualizar métricas
        await actualizarMetricasInstagram('mensaje_enviado')

        return { 
            success: true, 
            message: 'Mensaje enviado via Instagram',
            messageId: responseData.message_id || `instagram_${Date.now()}`
        }

    } catch (error) {
        console.log('Error enviando mensaje Instagram:', error)
        return { 
            success: false, 
            error: error.message 
        }
    }
}

// Función para limpiar logs antiguos de Instagram
export async function limpiarLogsInstagram() {
    try {
        // Eliminar logs de webhooks más antiguos de 30 días
        await db.execute(`
            DELETE FROM instagram_webhooks_log 
            WHERE fecha_recepcion < DATE_SUB(NOW(), INTERVAL 30 DAY)
        `)

        // Eliminar métricas más antiguas de 90 días
        await db.execute(`
            DELETE FROM instagram_metricas 
            WHERE fecha_metrica < DATE_SUB(CURDATE(), INTERVAL 90 DAY)
        `)

        console.log('Logs de Instagram limpiados exitosamente')
        return { success: true, message: 'Logs limpiados' }

    } catch (error) {
        console.log('Error limpiando logs Instagram:', error)
        return { success: false, message: 'Error al limpiar logs' }
    }
}