// app/api/webhooks/whatsapp/route.js
import { NextResponse } from 'next/server'
import db from '@/_DB/db'

// Verificación del webhook (GET)
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url)
        const mode = searchParams.get('hub.mode')
        const token = searchParams.get('hub.verify_token')
        const challenge = searchParams.get('hub.challenge')

        console.log('Verificación webhook WhatsApp:', { mode, token, challenge })

        if (mode === 'subscribe') {
            // Obtener configuración activa de WhatsApp
            const [configRows] = await db.execute(`
                SELECT cw.webhook_verify_token 
                FROM configuraciones_activas ca
                INNER JOIN configuraciones_whatsapp cw ON ca.config_id = cw.id
                WHERE ca.plataforma = 'whatsapp' AND ca.tipo_config = 'api'
            `)

            if (configRows.length === 0) {
                console.log('No hay configuración WhatsApp activa')
                return NextResponse.json({ error: 'No active configuration' }, { status: 404 })
            }

            const configToken = configRows[0].webhook_verify_token

            if (token === configToken) {
                console.log('Token verificado correctamente')
                return new NextResponse(challenge, { status: 200 })
            } else {
                console.log('Token inválido:', { expected: configToken, received: token })
                return NextResponse.json({ error: 'Invalid token' }, { status: 403 })
            }
        }

        return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })

    } catch (error) {
        console.log('Error en verificación webhook WhatsApp:', error)
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
}

// Recepción de mensajes (POST)
export async function POST(request) {
    try {
        const body = await request.json()
        
        // Log del webhook recibido
        await db.execute(`
            INSERT INTO webhooks_log (plataforma, evento_tipo, payload, ip_origen, fecha_recepcion)
            VALUES ('whatsapp', 'mensaje_recibido', ?, ?, NOW())
        `, [JSON.stringify(body), request.headers.get('x-forwarded-for') || 'unknown'])

        console.log('Webhook WhatsApp recibido:', JSON.stringify(body, null, 2))

        // Verificar estructura del webhook
        if (!body.entry || !Array.isArray(body.entry)) {
            console.log('Estructura de webhook inválida')
            return NextResponse.json({ status: 'error', message: 'Invalid webhook structure' })
        }

        // Procesar cada entrada
        for (const entry of body.entry) {
            if (entry.changes) {
                for (const change of entry.changes) {
                    if (change.field === 'messages' && change.value) {
                        await procesarMensajeWhatsApp(change.value)
                    }
                }
            }
        }

        return NextResponse.json({ status: 'success' })

    } catch (error) {
        console.log('Error procesando webhook WhatsApp:', error)
        
        // Actualizar log como procesado con error
        await db.execute(`
            UPDATE webhooks_log 
            SET procesado = 1, error_procesamiento = ?, fecha_procesamiento = NOW()
            WHERE plataforma = 'whatsapp' AND procesado = 0
            ORDER BY fecha_recepcion DESC LIMIT 1
        `, [error.message])

        return NextResponse.json({ status: 'error', message: error.message }, { status: 500 })
    }
}

async function procesarMensajeWhatsApp(messageData) {
    try {
        console.log('Procesando datos de mensaje WhatsApp:', messageData)

        // Verificar si hay mensajes
        if (!messageData.messages || messageData.messages.length === 0) {
            console.log('No hay mensajes para procesar')
            return
        }

        const mensaje = messageData.messages[0]
        const whatsappId = mensaje.from
        const messageId = mensaje.id
        const timestamp = mensaje.timestamp

        // Extraer contenido del mensaje
        let contenido = ''
        let tipoMensaje = 'texto'

        if (mensaje.text) {
            contenido = mensaje.text.body
            tipoMensaje = 'texto'
        } else if (mensaje.image) {
            contenido = mensaje.image.caption || 'Imagen'
            tipoMensaje = 'imagen'
        } else if (mensaje.video) {
            contenido = mensaje.video.caption || 'Video'
            tipoMensaje = 'video'
        } else if (mensaje.audio) {
            contenido = 'Audio'
            tipoMensaje = 'audio'
        } else if (mensaje.document) {
            contenido = mensaje.document.filename || 'Documento'
            tipoMensaje = 'documento'
        } else if (mensaje.location) {
            contenido = `Ubicación: ${mensaje.location.latitude}, ${mensaje.location.longitude}`
            tipoMensaje = 'ubicacion'
        } else {
            contenido = 'Mensaje multimedia'
        }

        console.log(`Mensaje de ${whatsappId}: ${contenido}`)

        // Buscar o crear contacto
        let [contactoRows] = await db.execute(`
            SELECT id, nombre FROM contactos WHERE whatsapp_id = ?
        `, [whatsappId])

        let contactoId
        if (contactoRows.length === 0) {
            // Crear nuevo contacto
            const [resultado] = await db.execute(`
                INSERT INTO contactos (
                    whatsapp_id,
                    nombre,
                    telefono,
                    origen,
                    estado,
                    primera_interaccion,
                    fecha_creacion
                ) VALUES (?, ?, ?, 'whatsapp', 'nuevo', FROM_UNIXTIME(?), NOW())
            `, [whatsappId, whatsappId, whatsappId, timestamp])
            
            contactoId = resultado.insertId
            console.log(`Contacto creado: ${contactoId}`)
        } else {
            contactoId = contactoRows[0].id
            
            // Actualizar última interacción
            await db.execute(`
                UPDATE contactos SET ultima_interaccion = FROM_UNIXTIME(?) WHERE id = ?
            `, [timestamp, contactoId])
        }

        // Buscar o crear conversación
        let [conversacionRows] = await db.execute(`
            SELECT id FROM conversaciones 
            WHERE contacto_id = ? AND plataforma = 'whatsapp' AND whatsapp_tipo = 'api' AND estado != 'cerrada'
        `, [contactoId])

        let conversacionId
        if (conversacionRows.length === 0) {
            // Crear nueva conversación
            const [resultado] = await db.execute(`
                INSERT INTO conversaciones (
                    contacto_id,
                    plataforma,
                    whatsapp_tipo,
                    estado,
                    fecha_inicio,
                    fecha_ultima_actividad
                ) VALUES (?, 'whatsapp', 'api', 'abierta', FROM_UNIXTIME(?), FROM_UNIXTIME(?))
            `, [contactoId, timestamp, timestamp])
            
            conversacionId = resultado.insertId
            console.log(`Conversación creada: ${conversacionId}`)
        } else {
            conversacionId = conversacionRows[0].id
        }

        // Verificar si el mensaje ya existe
        const [mensajeExistente] = await db.execute(`
            SELECT id FROM mensajes WHERE mensaje_id_externo = ?
        `, [messageId])

        if (mensajeExistente.length > 0) {
            console.log('Mensaje ya procesado previamente')
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
                direccion,
                estado_entrega,
                fecha_envio
            ) VALUES (?, ?, ?, ?, ?, 'entrante', 'entregado', FROM_UNIXTIME(?))
        `, [conversacionId, contactoId, messageId, tipoMensaje, contenido, timestamp])

        // Actualizar contadores de conversación
        await db.execute(`
            UPDATE conversaciones SET 
                fecha_ultima_actividad = FROM_UNIXTIME(?),
                mensajes_contacto = mensajes_contacto + 1,
                total_mensajes = total_mensajes + 1
            WHERE id = ?
        `, [timestamp, conversacionId])

        console.log('Mensaje procesado exitosamente')

        // Ejecutar automatizaciones
        try {
            const { procesarMensajeParaAutomatizaciones } = await import('../../../automatizacion/servidor')
            
            const resultadoAuto = await procesarMensajeParaAutomatizaciones(conversacionId, {
                contenido: contenido,
                tipo_mensaje: tipoMensaje,
                direccion: 'entrante'
            })
            
            console.log('Automatizaciones procesadas:', resultadoAuto)
        } catch (autoError) {
            console.log('Error ejecutando automatizaciones:', autoError)
        }

        // Marcar webhook como procesado
        await db.execute(`
            UPDATE webhooks_log 
            SET procesado = 1, fecha_procesamiento = NOW()
            WHERE plataforma = 'whatsapp' AND procesado = 0
            ORDER BY fecha_recepcion DESC LIMIT 1
        `)

    } catch (error) {
        console.log('Error procesando mensaje WhatsApp:', error)
        throw error
    }
}