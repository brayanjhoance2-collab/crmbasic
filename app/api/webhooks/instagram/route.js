// app/api/webhooks/instagram/route.js
import { NextResponse } from 'next/server'
import db from '@/_DB/db'

// Verificación del webhook (GET)
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url)
        const mode = searchParams.get('hub.mode')
        const token = searchParams.get('hub.verify_token')
        const challenge = searchParams.get('hub.challenge')

        console.log('Verificación webhook Instagram:', { mode, token, challenge })

        if (mode === 'subscribe') {
            // Obtener configuración de Instagram
            const [configRows] = await db.execute(`
                SELECT webhook_verify_token FROM configuraciones_instagram 
                WHERE webhook_verify_token IS NOT NULL 
                LIMIT 1
            `)

            if (configRows.length === 0) {
                console.log('No hay configuración Instagram con webhook')
                return NextResponse.json({ error: 'No webhook configuration found' }, { status: 404 })
            }

            const configToken = configRows[0].webhook_verify_token

            if (token === configToken) {
                console.log('Token Instagram verificado correctamente')
                // Responder con el challenge como texto plano
                return new NextResponse(challenge, { 
                    status: 200,
                    headers: { 'Content-Type': 'text/plain' }
                })
            } else {
                console.log('Token Instagram inválido:', { expected: configToken, received: token })
                return NextResponse.json({ error: 'Invalid verification token' }, { status: 403 })
            }
        }

        return NextResponse.json({ error: 'Invalid hub mode' }, { status: 400 })

    } catch (error) {
        console.log('Error en verificación webhook Instagram:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// Recepción de mensajes (POST)
export async function POST(request) {
    try {
        const body = await request.json()
        
        console.log('Webhook Instagram recibido:', JSON.stringify(body, null, 2))

        // Verificar que la tabla webhooks_log existe, si no crear el log básico
        try {
            await db.execute(`
                INSERT INTO instagram_webhooks_log (
                    entry_id,
                    messaging_data,
                    fecha_recepcion
                ) VALUES (?, ?, NOW())
            `, [
                body.entry?.[0]?.id || 'unknown',
                JSON.stringify(body)
            ])
        } catch (logError) {
            console.log('Error guardando log webhook (tabla puede no existir):', logError.message)
        }

        // Verificar estructura del webhook
        if (!body.entry || !Array.isArray(body.entry)) {
            console.log('Estructura de webhook Instagram inválida - no hay entries')
            return NextResponse.json({ status: 'ok' }) // Meta espera 200 siempre
        }

        // Procesar cada entrada
        for (const entry of body.entry) {
            console.log('Procesando entry:', entry.id)
            
            // Instagram usa 'messaging' para mensajes directos
            if (entry.messaging && Array.isArray(entry.messaging)) {
                for (const messaging of entry.messaging) {
                    try {
                        await procesarMensajeInstagram(messaging)
                    } catch (error) {
                        console.log('Error procesando mensaje individual:', error)
                        // No fallar todo el webhook por un mensaje
                    }
                }
            }
            
            // También puede venir en 'changes' para otros eventos
            if (entry.changes && Array.isArray(entry.changes)) {
                console.log('Cambios detectados en Instagram:', entry.changes)
                // Aquí puedes manejar otros tipos de eventos si necesitas
            }
        }

        // Siempre responder OK a Meta
        return NextResponse.json({ status: 'EVENT_RECEIVED' }, { status: 200 })

    } catch (error) {
        console.log('Error crítico procesando webhook Instagram:', error)
        
        // Intentar marcar el error en log si la tabla existe
        try {
            await db.execute(`
                UPDATE instagram_webhooks_log 
                SET procesado = 0, error_procesamiento = ?, fecha_procesamiento = NOW()
                WHERE fecha_recepcion >= DATE_SUB(NOW(), INTERVAL 1 MINUTE)
                AND procesado IS NULL
                ORDER BY fecha_recepcion DESC LIMIT 1
            `, [error.message])
        } catch (logError) {
            console.log('Error actualizando log:', logError.message)
        }

        // Meta espera siempre 200, incluso con errores internos
        return NextResponse.json({ status: 'EVENT_RECEIVED' }, { status: 200 })
    }
}

async function procesarMensajeInstagram(messageData) {
    try {
        console.log('Procesando mensaje Instagram completo:', JSON.stringify(messageData, null, 2))

        // Verificar si es un mensaje entrante (no echo de nuestros propios mensajes)
        if (!messageData.message || messageData.message.is_echo) {
            console.log('No es un mensaje entrante válido o es echo, ignorando')
            return
        }

        const senderId = messageData.sender?.id
        const recipientId = messageData.recipient?.id
        const messageId = messageData.message?.mid
        const timestamp = messageData.timestamp

        if (!senderId || !messageId) {
            console.log('Datos insuficientes en el mensaje:', { senderId, messageId })
            return
        }

        // Extraer contenido del mensaje
        let contenido = ''
        let tipoMensaje = 'texto'
        let metadatos = {}

        if (messageData.message.text) {
            contenido = messageData.message.text
            tipoMensaje = 'texto'
        } else if (messageData.message.attachments && messageData.message.attachments.length > 0) {
            const attachment = messageData.message.attachments[0]
            
            switch (attachment.type) {
                case 'image':
                    contenido = 'Imagen'
                    tipoMensaje = 'imagen'
                    metadatos = { 
                        url: attachment.payload?.url,
                        size: attachment.payload?.size 
                    }
                    break
                case 'video':
                    contenido = 'Video'
                    tipoMensaje = 'video'
                    metadatos = { 
                        url: attachment.payload?.url,
                        size: attachment.payload?.size 
                    }
                    break
                case 'audio':
                    contenido = 'Audio'
                    tipoMensaje = 'audio'
                    metadatos = { 
                        url: attachment.payload?.url,
                        duration: attachment.payload?.duration 
                    }
                    break
                case 'file':
                    contenido = attachment.payload?.name || 'Archivo'
                    tipoMensaje = 'documento'
                    metadatos = { 
                        url: attachment.payload?.url,
                        filename: attachment.payload?.name,
                        size: attachment.payload?.size 
                    }
                    break
                default:
                    contenido = 'Mensaje multimedia'
                    tipoMensaje = 'multimedia'
                    metadatos = { type: attachment.type }
            }
        } else if (messageData.message.quick_reply) {
            contenido = messageData.message.quick_reply.payload
            tipoMensaje = 'quick_reply'
            metadatos = { quick_reply: messageData.message.quick_reply }
        } else {
            contenido = 'Mensaje desconocido'
            tipoMensaje = 'unknown'
        }

        console.log(`Mensaje Instagram de ${senderId}: ${contenido} (${tipoMensaje})`)

        // Buscar o crear contacto por Instagram ID
        let [contactoRows] = await db.execute(`
            SELECT id, nombre FROM contactos 
            WHERE instagram_id = ?
        `, [senderId])

        let contactoId
        if (contactoRows.length === 0) {
            // Intentar obtener información del perfil del usuario
            let nombreContacto = senderId
            
            try {
                const configuracion = await obtenerConfiguracionInstagram()
                if (configuracion?.access_token) {
                    const userInfo = await obtenerInfoUsuarioInstagram(senderId, configuracion.access_token)
                    if (userInfo?.name) {
                        nombreContacto = userInfo.name
                    }
                }
            } catch (error) {
                console.log('No se pudo obtener info del usuario:', error.message)
            }

            // Crear nuevo contacto
            const [resultado] = await db.execute(`
                INSERT INTO contactos (
                    instagram_id,
                    nombre,
                    origen,
                    estado,
                    primera_interaccion,
                    ultima_interaccion,
                    fecha_creacion
                ) VALUES (?, ?, 'instagram', 'nuevo', FROM_UNIXTIME(?), FROM_UNIXTIME(?), NOW())
            `, [senderId, nombreContacto, Math.floor(timestamp / 1000), Math.floor(timestamp / 1000)])
            
            contactoId = resultado.insertId
            console.log(`Contacto Instagram creado: ${contactoId} (${nombreContacto})`)
        } else {
            contactoId = contactoRows[0].id
            
            // Actualizar última interacción
            await db.execute(`
                UPDATE contactos 
                SET ultima_interaccion = FROM_UNIXTIME(?),
                    estado = CASE WHEN estado = 'inactivo' THEN 'activo' ELSE estado END
                WHERE id = ?
            `, [Math.floor(timestamp / 1000), contactoId])
        }

        // Buscar o crear conversación
        let [conversacionRows] = await db.execute(`
            SELECT id FROM conversaciones 
            WHERE contacto_id = ? AND plataforma = 'instagram' AND estado IN ('abierta', 'pendiente')
            ORDER BY fecha_ultima_actividad DESC
            LIMIT 1
        `, [contactoId])

        let conversacionId
        if (conversacionRows.length === 0) {
            // Crear nueva conversación
            const [resultado] = await db.execute(`
                INSERT INTO conversaciones (
                    contacto_id,
                    plataforma,
                    estado,
                    fecha_inicio,
                    fecha_ultima_actividad,
                    mensajes_contacto,
                    total_mensajes
                ) VALUES (?, 'instagram', 'abierta', FROM_UNIXTIME(?), FROM_UNIXTIME(?), 1, 1)
            `, [contactoId, Math.floor(timestamp / 1000), Math.floor(timestamp / 1000)])
            
            conversacionId = resultado.insertId
            console.log(`Conversación Instagram creada: ${conversacionId}`)
        } else {
            conversacionId = conversacionRows[0].id
        }

        // Verificar si el mensaje ya existe (evitar duplicados)
        const [mensajeExistente] = await db.execute(`
            SELECT id FROM mensajes WHERE mensaje_id_externo = ? AND plataforma = 'instagram'
        `, [messageId])

        if (mensajeExistente.length > 0) {
            console.log('Mensaje Instagram ya procesado previamente:', messageId)
            return
        }

        // Insertar mensaje
        await db.execute(`
            INSERT INTO mensajes (
                conversacion_id,
                contacto_id,
                mensaje_id_externo,
                tipo_mensaje,
                contenido,
                metadatos,
                direccion,
                estado_entrega,
                plataforma,
                fecha_envio,
                fecha_creacion
            ) VALUES (?, ?, ?, ?, ?, ?, 'entrante', 'entregado', 'instagram', FROM_UNIXTIME(?), NOW())
        `, [
            conversacionId, 
            contactoId, 
            messageId, 
            tipoMensaje, 
            contenido, 
            JSON.stringify(metadatos),
            Math.floor(timestamp / 1000)
        ])

        // Actualizar contadores de conversación
        await db.execute(`
            UPDATE conversaciones SET 
                fecha_ultima_actividad = FROM_UNIXTIME(?),
                mensajes_contacto = mensajes_contacto + 1,
                total_mensajes = total_mensajes + 1,
                estado = 'abierta'
            WHERE id = ?
        `, [Math.floor(timestamp / 1000), conversacionId])

        console.log('Mensaje Instagram procesado exitosamente')

        // Actualizar métricas si la tabla existe
        try {
            await actualizarMetricasInstagram('mensaje_recibido')
        } catch (metricsError) {
            console.log('Error actualizando métricas (tabla puede no existir):', metricsError.message)
        }

        // Ejecutar automatizaciones si están disponibles
        try {
            const { procesarMensajeParaAutomatizaciones } = await import('../../../../_Pages/automatizacion/servidor')
            
            const resultadoAuto = await procesarMensajeParaAutomatizaciones(conversacionId, {
                contenido: contenido,
                tipo_mensaje: tipoMensaje,
                direccion: 'entrante',
                plataforma: 'instagram'
            })
            
            console.log('Automatizaciones Instagram procesadas:', resultadoAuto?.success ? 'OK' : 'Error')
        } catch (autoError) {
            console.log('Error ejecutando automatizaciones Instagram:', autoError.message)
            // No fallar el procesamiento del mensaje por errores de automatización
        }

        // Marcar webhook como procesado si la tabla existe
        try {
            await db.execute(`
                UPDATE instagram_webhooks_log 
                SET procesado = 1, fecha_procesamiento = NOW()
                WHERE entry_id = ? AND procesado IS NULL
                ORDER BY fecha_recepcion DESC LIMIT 1
            `, [messageData.recipient?.id || 'unknown'])
        } catch (logError) {
            console.log('Error marcando webhook como procesado:', logError.message)
        }

    } catch (error) {
        console.log('Error procesando mensaje Instagram:', error)
        throw error
    }
}

// Funciones auxiliares
async function obtenerConfiguracionInstagram() {
    try {
        const [rows] = await db.execute(`
            SELECT * FROM configuraciones_instagram 
            ORDER BY fecha_creacion DESC LIMIT 1
        `)
        return rows.length > 0 ? rows[0] : null
    } catch (error) {
        console.log('Error obteniendo configuración Instagram:', error)
        return null
    }
}

async function obtenerInfoUsuarioInstagram(userId, accessToken) {
    try {
        // Intentar obtener información básica del usuario
        const response = await fetch(
            `https://graph.facebook.com/v18.0/${userId}?fields=name&access_token=${accessToken}`
        )
        
        if (!response.ok) {
            return null
        }
        
        const data = await response.json()
        return data.error ? null : data
    } catch (error) {
        console.log('Error obteniendo info usuario Instagram:', error.message)
        return null
    }
}

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
        }

    } catch (error) {
        console.log('Error actualizando métricas Instagram:', error)
    }
}