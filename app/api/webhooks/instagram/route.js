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
                SELECT webhook_verify_token FROM configuraciones_instagram LIMIT 1
            `)

            if (configRows.length === 0) {
                console.log('No hay configuración Instagram')
                return NextResponse.json({ error: 'No configuration found' }, { status: 404 })
            }

            const configToken = configRows[0].webhook_verify_token

            if (token === configToken) {
                console.log('Token Instagram verificado correctamente')
                return new NextResponse(challenge, { status: 200 })
            } else {
                console.log('Token Instagram inválido:', { expected: configToken, received: token })
                return NextResponse.json({ error: 'Invalid token' }, { status: 403 })
            }
        }

        return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })

    } catch (error) {
        console.log('Error en verificación webhook Instagram:', error)
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
            VALUES ('instagram', 'mensaje_recibido', ?, ?, NOW())
        `, [JSON.stringify(body), request.headers.get('x-forwarded-for') || 'unknown'])

        console.log('Webhook Instagram recibido:', JSON.stringify(body, null, 2))

        // Verificar estructura del webhook
        if (!body.entry || !Array.isArray(body.entry)) {
            console.log('Estructura de webhook Instagram inválida')
            return NextResponse.json({ status: 'error', message: 'Invalid webhook structure' })
        }

        // Procesar cada entrada
        for (const entry of body.entry) {
            if (entry.messaging) {
                for (const message of entry.messaging) {
                    await procesarMensajeInstagram(message)
                }
            }
        }

        return NextResponse.json({ status: 'success' })

    } catch (error) {
        console.log('Error procesando webhook Instagram:', error)
        
        // Actualizar log como procesado con error
        await db.execute(`
            UPDATE webhooks_log 
            SET procesado = 1, error_procesamiento = ?, fecha_procesamiento = NOW()
            WHERE plataforma = 'instagram' AND procesado = 0
            ORDER BY fecha_recepcion DESC LIMIT 1
        `, [error.message])

        return NextResponse.json({ status: 'error', message: error.message }, { status: 500 })
    }
}

async function procesarMensajeInstagram(messageData) {
    try {
        console.log('Procesando mensaje Instagram:', messageData)

        // Verificar si es un mensaje entrante
        if (!messageData.message) {
            console.log('No es un mensaje entrante, ignorando')
            return
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
            SELECT id, nombre FROM contactos WHERE instagram_id = ?
        `, [instagramId])

        let contactoId
        if (contactoRows.length === 0) {
            // Crear nuevo contacto
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
            
            // Actualizar última interacción
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
            // Crear nueva conversación
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
        `, [conversacionId, contactoId, messageId, tipoMensaje, contenido, Math.floor(timestamp / 1000)])

        // Actualizar contadores de conversación
        await db.execute(`
            UPDATE conversaciones SET 
                fecha_ultima_actividad = FROM_UNIXTIME(?),
                mensajes_contacto = mensajes_contacto + 1,
                total_mensajes = total_mensajes + 1
            WHERE id = ?
        `, [Math.floor(timestamp / 1000), conversacionId])

        console.log('Mensaje Instagram procesado exitosamente')

        // Ejecutar automatizaciones
        try {
            const { procesarMensajeParaAutomatizaciones } = await import('../../../automatizacion/servidor')
            
            const resultadoAuto = await procesarMensajeParaAutomatizaciones(conversacionId, {
                contenido: contenido,
                tipo_mensaje: tipoMensaje,
                direccion: 'entrante'
            })
            
            console.log('Automatizaciones Instagram procesadas:', resultadoAuto)
        } catch (autoError) {
            console.log('Error ejecutando automatizaciones Instagram:', autoError)
        }

        // Marcar webhook como procesado
        await db.execute(`
            UPDATE webhooks_log 
            SET procesado = 1, fecha_procesamiento = NOW()
            WHERE plataforma = 'instagram' AND procesado = 0
            ORDER BY fecha_recepcion DESC LIMIT 1
        `)

    } catch (error) {
        console.log('Error procesando mensaje Instagram:', error)
        throw error
    }
}