"use server"
import db from "@/_DB/db"
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { MessageService } from '@/_services/messageService'

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
                id,
                correo,
                nombre,
                apellidos,
                telefono,
                avatar_url,
                rol,
                activo,
                ultimo_acceso,
                fecha_registro
            FROM usuarios 
            WHERE id = ? AND activo = 1
        `, [userId])

        if (rows.length === 0) {
            return null
        }

        const usuario = rows[0]
        
        await db.execute(`
            UPDATE usuarios 
            SET ultimo_acceso = CURRENT_TIMESTAMP 
            WHERE id = ?
        `, [userId])

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

export async function obtenerConversaciones(filtros = {}) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        let whereConditions = ['1 = 1']
        let params = []

        if (filtros.plataforma) {
            whereConditions.push('conv.plataforma = ?')
            params.push(filtros.plataforma)
        }

        if (filtros.estado) {
            whereConditions.push('conv.estado = ?')
            params.push(filtros.estado)
        }

        if (filtros.busqueda) {
            whereConditions.push('(c.nombre LIKE ? OR c.apellidos LIKE ? OR c.telefono LIKE ?)')
            const searchTerm = `%${filtros.busqueda}%`
            params.push(searchTerm, searchTerm, searchTerm)
        }

        if (usuario.rol === 'usuario') {
            whereConditions.push('(conv.asignada_a = ? OR conv.asignada_a IS NULL)')
            params.push(usuario.id)
        }

        const whereClause = 'WHERE ' + whereConditions.join(' AND ')

        const [rows] = await db.execute(`
            SELECT 
                conv.*,
                c.nombre as contacto_nombre,
                c.apellidos as contacto_apellidos,
                c.telefono as contacto_telefono,
                c.whatsapp_id,
                c.instagram_id,
                c.facebook_id,
                c.foto_perfil_url,
                u.nombre as agente_nombre,
                u.apellidos as agente_apellidos,
                (SELECT contenido FROM mensajes m 
                 WHERE m.conversacion_id = conv.id 
                 ORDER BY m.fecha_envio DESC LIMIT 1) as ultimo_mensaje,
                (SELECT fecha_envio FROM mensajes m 
                 WHERE m.conversacion_id = conv.id 
                 ORDER BY m.fecha_envio DESC LIMIT 1) as fecha_ultimo_mensaje,
                (SELECT COUNT(*) FROM mensajes m 
                 WHERE m.conversacion_id = conv.id 
                 AND m.direccion = 'entrante' 
                 AND m.timestamp_leido IS NULL) as mensajes_no_leidos
            FROM conversaciones conv
            INNER JOIN contactos c ON conv.contacto_id = c.id
            LEFT JOIN usuarios u ON conv.asignada_a = u.id
            ${whereClause}
            ORDER BY conv.fecha_ultima_actividad DESC
            LIMIT 100
        `, params)

        return rows.map(conv => ({
            ...conv,
            contacto_nombre_completo: conv.contacto_apellidos ? 
                `${conv.contacto_nombre} ${conv.contacto_apellidos}` : 
                conv.contacto_nombre,
            agente_nombre_completo: conv.agente_nombre ? 
                `${conv.agente_nombre} ${conv.agente_apellidos}` : null
        }))

    } catch (error) {
        console.log('Error al obtener conversaciones:', error)
        throw error
    }
}

export async function obtenerMensajesConversacion(conversacionId) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        const [conversacionCheck] = await db.execute(`
            SELECT conv.*, c.nombre as contacto_nombre 
            FROM conversaciones conv
            INNER JOIN contactos c ON conv.contacto_id = c.id
            WHERE conv.id = ?
            ${usuario.rol === 'usuario' ? 'AND (conv.asignada_a = ? OR conv.asignada_a IS NULL)' : ''}
        `, usuario.rol === 'usuario' ? [conversacionId, usuario.id] : [conversacionId])

        if (conversacionCheck.length === 0) {
            throw new Error('Conversacion no encontrada o sin acceso')
        }

        const [mensajes] = await db.execute(`
            SELECT 
                m.*,
                u.nombre as agente_nombre,
                u.apellidos as agente_apellidos
            FROM mensajes m
            LEFT JOIN usuarios u ON m.enviado_por = u.id
            WHERE m.conversacion_id = ?
            ORDER BY m.fecha_envio ASC
        `, [conversacionId])

        return mensajes.map(mensaje => ({
            ...mensaje,
            agente_nombre_completo: mensaje.agente_nombre ? 
                `${mensaje.agente_nombre} ${mensaje.agente_apellidos}` : null
        }))

    } catch (error) {
        console.log('Error al obtener mensajes:', error)
        throw error
    }
}

export async function enviarMensajeManual(conversacionId, datosMessage) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        const [conversacionCheck] = await db.execute(`
            SELECT conv.*, c.id as contacto_id, c.nombre as contacto_nombre,
                   c.whatsapp_id, c.instagram_id, c.facebook_id, c.telefono as contacto_telefono
            FROM conversaciones conv
            INNER JOIN contactos c ON conv.contacto_id = c.id
            WHERE conv.id = ?
            ${usuario.rol === 'usuario' ? 'AND (conv.asignada_a = ? OR conv.asignada_a IS NULL)' : ''}
        `, usuario.rol === 'usuario' ? [conversacionId, usuario.id] : [conversacionId])

        if (conversacionCheck.length === 0) {
            throw new Error('Conversacion no encontrada o sin acceso')
        }

        const conversacion = conversacionCheck[0]

        const resultado = await MessageService.sendUnifiedMessage(conversacion, datosMessage)

        if (resultado.success) {
            const [insertResult] = await db.execute(`
                INSERT INTO mensajes (
                    conversacion_id,
                    contacto_id,
                    tipo_mensaje,
                    contenido,
                    archivo_url,
                    archivo_tipo,
                    direccion,
                    enviado_por,
                    estado_entrega,
                    fecha_envio,
                    mensaje_id_externo
                ) VALUES (?, ?, ?, ?, ?, ?, 'saliente', ?, 'entregado', NOW(), ?)
            `, [
                conversacionId,
                conversacion.contacto_id,
                datosMessage.tipo || 'texto',
                datosMessage.contenido,
                datosMessage.archivo_url || null,
                datosMessage.archivo_tipo || null,
                usuario.id,
                resultado.messageId
            ])

            await db.execute(`
                UPDATE conversaciones SET 
                    fecha_ultima_actividad = NOW(),
                    mensajes_agente = mensajes_agente + 1,
                    total_mensajes = total_mensajes + 1,
                    estado = CASE WHEN estado = 'cerrada' THEN 'en_proceso' ELSE estado END
                WHERE id = ?
            `, [conversacionId])

            await db.execute(`
                UPDATE contactos SET 
                    ultima_interaccion = NOW()
                WHERE id = ?
            `, [conversacion.contacto_id])

            return {
                success: true,
                mensajeId: insertResult.insertId,
                messageIdExterno: resultado.messageId,
                message: 'Mensaje enviado exitosamente'
            }
        } else {
            throw new Error(resultado.error || 'Error al enviar mensaje')
        }

    } catch (error) {
        console.log('Error al enviar mensaje manual:', error)
        throw error
    }
}

export async function enviarMensajeDirecto(plataforma, recipientId, numeroTelefono, contenido) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        const contactoSimulado = {
            whatsapp_id: plataforma === 'whatsapp' ? recipientId : null,
            instagram_id: plataforma === 'instagram' ? recipientId : null,
            facebook_id: plataforma === 'facebook' ? recipientId : null,
            telefono: numeroTelefono,
            contacto_telefono: numeroTelefono
        }

        const mensaje = {
            contenido: contenido,
            tipo: 'texto'
        }

        const resultado = await MessageService.sendToContact(contactoSimulado, plataforma, mensaje)

        if (resultado.success) {
            let contactoId = null

            if (plataforma === 'whatsapp' && numeroTelefono) {
                const [contactoRows] = await db.execute(`
                    SELECT id FROM contactos WHERE telefono = ? OR whatsapp_id = ?
                `, [numeroTelefono, recipientId])

                if (contactoRows.length === 0) {
                    const [insertResult] = await db.execute(`
                        INSERT INTO contactos (
                            whatsapp_id,
                            telefono,
                            nombre,
                            origen,
                            estado,
                            primera_interaccion,
                            fecha_creacion
                        ) VALUES (?, ?, ?, 'whatsapp', 'nuevo', NOW(), NOW())
                    `, [recipientId, numeroTelefono, numeroTelefono])
                    
                    contactoId = insertResult.insertId
                } else {
                    contactoId = contactoRows[0].id
                }
            } else if (plataforma === 'instagram' && recipientId) {
                const [contactoRows] = await db.execute(`
                    SELECT id FROM contactos WHERE instagram_id = ?
                `, [recipientId])

                if (contactoRows.length === 0) {
                    const [insertResult] = await db.execute(`
                        INSERT INTO contactos (
                            instagram_id,
                            nombre,
                            origen,
                            estado,
                            primera_interaccion,
                            fecha_creacion
                        ) VALUES (?, ?, 'instagram', 'nuevo', NOW(), NOW())
                    `, [recipientId, recipientId])
                    
                    contactoId = insertResult.insertId
                } else {
                    contactoId = contactoRows[0].id
                }
            } else if (plataforma === 'facebook' && recipientId) {
                const [contactoRows] = await db.execute(`
                    SELECT id FROM contactos WHERE facebook_id = ?
                `, [recipientId])

                if (contactoRows.length === 0) {
                    const [insertResult] = await db.execute(`
                        INSERT INTO contactos (
                            facebook_id,
                            nombre,
                            origen,
                            estado,
                            primera_interaccion,
                            fecha_creacion
                        ) VALUES (?, ?, 'facebook', 'nuevo', NOW(), NOW())
                    `, [recipientId, recipientId])
                    
                    contactoId = insertResult.insertId
                } else {
                    contactoId = contactoRows[0].id
                }
            }

            return {
                success: true,
                messageId: resultado.messageId,
                platform: resultado.platform,
                contactoId: contactoId,
                message: 'Mensaje directo enviado exitosamente'
            }
        } else {
            throw new Error(resultado.error || 'Error al enviar mensaje directo')
        }

    } catch (error) {
        console.log('Error al enviar mensaje directo:', error)
        throw error
    }
}

export async function marcarConversacionLeida(conversacionId) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        await db.execute(`
            UPDATE mensajes SET 
                timestamp_leido = NOW()
            WHERE conversacion_id = ? 
            AND direccion = 'entrante' 
            AND timestamp_leido IS NULL
        `, [conversacionId])

        return { success: true }

    } catch (error) {
        console.log('Error al marcar como leida:', error)
        throw error
    }
}

export async function asignarConversacion(conversacionId, usuarioId) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        if (usuario.rol === 'usuario') {
            throw new Error('Sin permisos para asignar conversaciones')
        }

        await db.execute(`
            UPDATE conversaciones SET 
                asignada_a = ?,
                fecha_ultima_actividad = NOW()
            WHERE id = ?
        `, [usuarioId, conversacionId])

        return { success: true, message: 'Conversacion asignada exitosamente' }

    } catch (error) {
        console.log('Error al asignar conversacion:', error)
        throw error
    }
}

export async function cambiarEstadoConversacion(conversacionId, nuevoEstado) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        const estadosValidos = ['abierta', 'en_proceso', 'cerrada']
        if (!estadosValidos.includes(nuevoEstado)) {
            throw new Error('Estado no valido')
        }

        const whereClause = usuario.rol === 'usuario' ? 
            'WHERE id = ? AND (asignada_a = ? OR asignada_a IS NULL)' : 
            'WHERE id = ?'
        const params = usuario.rol === 'usuario' ? 
            [conversacionId, usuario.id] : 
            [conversacionId]

        await db.execute(`
            UPDATE conversaciones SET 
                estado = ?,
                fecha_ultima_actividad = NOW(),
                fecha_cierre = CASE WHEN ? = 'cerrada' THEN NOW() ELSE fecha_cierre END
            ${whereClause}
        `, [nuevoEstado, nuevoEstado, ...params])

        return { success: true, message: 'Estado actualizado exitosamente' }

    } catch (error) {
        console.log('Error al cambiar estado:', error)
        throw error
    }
}

export async function obtenerUsuarios() {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        if (usuario.rol === 'usuario') {
            return [usuario]
        }

        const [rows] = await db.execute(`
            SELECT 
                id,
                nombre,
                apellidos,
                correo,
                rol,
                activo
            FROM usuarios 
            WHERE activo = 1
            ORDER BY nombre ASC
        `)

        return rows

    } catch (error) {
        console.log('Error al obtener usuarios:', error)
        throw error
    }
}

export async function obtenerContactoPorId(contactoId) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        const [rows] = await db.execute(`
            SELECT * FROM contactos WHERE id = ?
        `, [contactoId])

        return rows.length > 0 ? rows[0] : null

    } catch (error) {
        console.log('Error al obtener contacto:', error)
        throw error
    }
}

export async function buscarContactoPorPlataforma(plataforma, identificador) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        let whereField = ''
        switch (plataforma) {
            case 'whatsapp':
                whereField = 'whatsapp_id = ? OR telefono = ?'
                break
            case 'instagram':
                whereField = 'instagram_id = ?'
                break
            case 'facebook':
                whereField = 'facebook_id = ?'
                break
            default:
                throw new Error('Plataforma no valida')
        }

        const params = plataforma === 'whatsapp' ? [identificador, identificador] : [identificador]

        const [rows] = await db.execute(`
            SELECT * FROM contactos WHERE ${whereField}
        `, params)

        return rows.length > 0 ? rows[0] : null

    } catch (error) {
        console.log('Error al buscar contacto:', error)
        throw error
    }
}

export async function obtenerConfiguracionActiva(plataforma) {
    try {
        const [rows] = await db.execute(`
            SELECT ca.*, 
                   CASE 
                       WHEN ca.plataforma = 'whatsapp' AND ca.tipo_config = 'api' THEN cw.access_token
                       WHEN ca.plataforma = 'whatsapp' AND ca.tipo_config = 'baileys' THEN cb.session_id
                       WHEN ca.plataforma = 'instagram' THEN ci.access_token
                       WHEN ca.plataforma = 'facebook' THEN cf.page_access_token
                       ELSE NULL
                   END as access_token,
                   CASE 
                       WHEN ca.plataforma = 'whatsapp' AND ca.tipo_config = 'api' THEN cw.phone_number_id
                       WHEN ca.plataforma = 'instagram' THEN ci.instagram_business_id
                       WHEN ca.plataforma = 'facebook' THEN cf.page_id
                       ELSE NULL
                   END as platform_id
            FROM configuraciones_activas ca
            LEFT JOIN configuraciones_whatsapp cw ON ca.config_id = cw.id AND ca.tipo_config = 'api'
            LEFT JOIN configuraciones_baileys cb ON ca.config_id = cb.id AND ca.tipo_config = 'baileys'
            LEFT JOIN configuraciones_instagram ci ON ca.config_id = ci.id
            LEFT JOIN configuraciones_facebook cf ON ca.config_id = cf.id
            WHERE ca.plataforma = ?
        `, [plataforma])

        return rows.length > 0 ? rows[0] : null

    } catch (error) {
        console.log('Error al obtener configuracion activa:', error)
        return null
    }
}

export async function procesarMensajeEntrante(plataforma, datosWebhook) {
    try {
        await db.execute(`
            INSERT INTO webhooks_log (
                plataforma,
                evento_tipo,
                payload,
                ip_origen,
                fecha_recepcion
            ) VALUES (?, 'mensaje_entrante', ?, ?, NOW())
        `, [plataforma, JSON.stringify(datosWebhook), datosWebhook.ip_origen || null])

        let contactoId = null
        let conversacionId = null

        switch (plataforma) {
            case 'whatsapp':
                ({ contactoId, conversacionId } = await procesarMensajeWhatsApp(datosWebhook))
                break
            case 'instagram':
                ({ contactoId, conversacionId } = await procesarMensajeInstagram(datosWebhook))
                break
            case 'facebook':
                ({ contactoId, conversacionId } = await procesarMensajeFacebook(datosWebhook))
                break
            default:
                throw new Error('Plataforma no soportada')
        }

        try {
            const { procesarMensajeParaAutomatizaciones } = await import('../automatizacion/servidor')
            await procesarMensajeParaAutomatizaciones(conversacionId, {
                contenido: datosWebhook.message || datosWebhook.text || '',
                tipo_mensaje: datosWebhook.type || 'texto',
                direccion: 'entrante'
            })
        } catch (autoError) {
            console.log('Error ejecutando automatizaciones:', autoError)
        }

        await db.execute(`
            UPDATE webhooks_log SET 
                procesado = 1,
                fecha_procesamiento = NOW()
            WHERE plataforma = ? AND payload = ? AND procesado = 0
            ORDER BY id DESC LIMIT 1
        `, [plataforma, JSON.stringify(datosWebhook)])

        return { 
            success: true, 
            contactoId, 
            conversacionId,
            message: 'Mensaje procesado exitosamente'
        }

    } catch (error) {
        console.log('Error al procesar mensaje entrante:', error)
        
        await db.execute(`
            UPDATE webhooks_log SET 
                procesado = 1,
                fecha_procesamiento = NOW(),
                error_procesamiento = ?
            WHERE plataforma = ? AND payload = ? AND procesado = 0
            ORDER BY id DESC LIMIT 1
        `, [error.message, plataforma, JSON.stringify(datosWebhook)])

        throw error
    }
}

async function procesarMensajeWhatsApp(datos) {
    const whatsappId = datos.from || datos.sender_id
    const contenido = datos.message || datos.text || ''
    const tipoMensaje = datos.type || 'texto'

    let [contactoRows] = await db.execute(`
        SELECT id FROM contactos WHERE whatsapp_id = ?
    `, [whatsappId])

    let contactoId
    if (contactoRows.length === 0) {
        const [resultado] = await db.execute(`
            INSERT INTO contactos (
                whatsapp_id,
                nombre,
                telefono,
                origen,
                estado,
                primera_interaccion,
                fecha_creacion
            ) VALUES (?, ?, ?, 'whatsapp', 'nuevo', NOW(), NOW())
        `, [whatsappId, datos.profile_name || 'Sin nombre', datos.phone || null])
        
        contactoId = resultado.insertId
    } else {
        contactoId = contactoRows[0].id
    }

    let [conversacionRows] = await db.execute(`
        SELECT id FROM conversaciones 
        WHERE contacto_id = ? AND plataforma = 'whatsapp' AND estado != 'cerrada'
        ORDER BY fecha_ultima_actividad DESC LIMIT 1
    `, [contactoId])

    let conversacionId
    if (conversacionRows.length === 0) {
        const [resultado] = await db.execute(`
            INSERT INTO conversaciones (
                contacto_id,
                plataforma,
                whatsapp_tipo,
                estado,
                fecha_inicio,
                fecha_ultima_actividad
            ) VALUES (?, 'whatsapp', ?, 'abierta', NOW(), NOW())
        `, [contactoId, datos.whatsapp_tipo || 'baileys'])
        
        conversacionId = resultado.insertId
    } else {
        conversacionId = conversacionRows[0].id
    }

    await db.execute(`
        INSERT INTO mensajes (
            conversacion_id,
            contacto_id,
            mensaje_id_externo,
            tipo_mensaje,
            contenido,
            archivo_url,
            direccion,
            estado_entrega,
            fecha_envio
        ) VALUES (?, ?, ?, ?, ?, ?, 'entrante', 'entregado', NOW())
    `, [
        conversacionId,
        contactoId,
        datos.message_id || null,
        tipoMensaje,
        contenido,
        datos.media_url || null
    ])

    await db.execute(`
        UPDATE conversaciones SET 
            fecha_ultima_actividad = NOW(),
            mensajes_contacto = mensajes_contacto + 1,
            total_mensajes = total_mensajes + 1,
            estado = CASE WHEN estado = 'cerrada' THEN 'abierta' ELSE estado END
        WHERE id = ?
    `, [conversacionId])

    await db.execute(`
        UPDATE contactos SET ultima_interaccion = NOW() WHERE id = ?
    `, [contactoId])

    return { contactoId, conversacionId }
}

async function procesarMensajeInstagram(datos) {
    const instagramId = datos.sender_id || datos.from
    const contenido = datos.message || datos.text || ''
    const tipoMensaje = datos.type || 'texto'

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
            ) VALUES (?, ?, 'instagram', 'nuevo', NOW(), NOW())
        `, [instagramId, datos.sender_name || 'Sin nombre'])
        
        contactoId = resultado.insertId
    } else {
        contactoId = contactoRows[0].id
    }

    let [conversacionRows] = await db.execute(`
        SELECT id FROM conversaciones 
        WHERE contacto_id = ? AND plataforma = 'instagram' AND estado != 'cerrada'
        ORDER BY fecha_ultima_actividad DESC LIMIT 1
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
            ) VALUES (?, 'instagram', 'abierta', NOW(), NOW())
        `, [contactoId])
        
        conversacionId = resultado.insertId
    } else {
        conversacionId = conversacionRows[0].id
    }

    await db.execute(`
        INSERT INTO mensajes (
            conversacion_id,
            contacto_id,
            mensaje_id_externo,
            tipo_mensaje,
            contenido,
            archivo_url,
            direccion,
            estado_entrega,
            fecha_envio
        ) VALUES (?, ?, ?, ?, ?, ?, 'entrante', 'entregado', NOW())
    `, [
        conversacionId,
        contactoId,
        datos.message_id || null,
        tipoMensaje,
        contenido,
        datos.media_url || null
    ])

    await db.execute(`
        UPDATE conversaciones SET 
            fecha_ultima_actividad = NOW(),
            mensajes_contacto = mensajes_contacto + 1,
            total_mensajes = total_mensajes + 1,
            estado = CASE WHEN estado = 'cerrada' THEN 'abierta' ELSE estado END
        WHERE id = ?
    `, [conversacionId])

    await db.execute(`
        UPDATE contactos SET ultima_interaccion = NOW() WHERE id = ?
    `, [contactoId])

    return { contactoId, conversacionId }
}

async function procesarMensajeFacebook(datos) {
    const facebookId = datos.sender_id || datos.from
    const contenido = datos.message || datos.text || ''
    const tipoMensaje = datos.type || 'texto'

    let [contactoRows] = await db.execute(`
        SELECT id FROM contactos WHERE facebook_id = ?
    `, [facebookId])

    let contactoId
    if (contactoRows.length === 0) {
        const [resultado] = await db.execute(`
            INSERT INTO contactos (
                facebook_id,
                nombre,
                origen,
                estado,
                primera_interaccion,
                fecha_creacion
            ) VALUES (?, ?, 'facebook', 'nuevo', NOW(), NOW())
        `, [facebookId, datos.sender_name || 'Sin nombre'])
        
        contactoId = resultado.insertId
    } else {
        contactoId = contactoRows[0].id
    }

    let [conversacionRows] = await db.execute(`
        SELECT id FROM conversaciones 
        WHERE contacto_id = ? AND plataforma = 'facebook' AND estado != 'cerrada'
        ORDER BY fecha_ultima_actividad DESC LIMIT 1
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
            ) VALUES (?, 'facebook', 'abierta', NOW(), NOW())
        `, [contactoId])
        
        conversacionId = resultado.insertId
    } else {
        conversacionId = conversacionRows[0].id
    }

    await db.execute(`
        INSERT INTO mensajes (
            conversacion_id,
            contacto_id,
            mensaje_id_externo,
            tipo_mensaje,
            contenido,
            archivo_url,
            direccion,
            estado_entrega,
            fecha_envio
        ) VALUES (?, ?, ?, ?, ?, ?, 'entrante', 'entregado', NOW())
    `, [
        conversacionId,
        contactoId,
        datos.message_id || null,
        tipoMensaje,
        contenido,
        datos.media_url || null
    ])

    await db.execute(`
        UPDATE conversaciones SET 
            fecha_ultima_actividad = NOW(),
            mensajes_contacto = mensajes_contacto + 1,
            total_mensajes = total_mensajes + 1,
            estado = CASE WHEN estado = 'cerrada' THEN 'abierta' ELSE estado END
        WHERE id = ?
    `, [conversacionId])

    await db.execute(`
        UPDATE contactos SET ultima_interaccion = NOW() WHERE id = ?
    `, [contactoId])

    return { contactoId, conversacionId }
}

export async function obtenerEstadisticasConversaciones() {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        const whereCondition = usuario.rol === 'usuario' ? 
            'WHERE asignada_a = ? OR asignada_a IS NULL' : 
            ''
        const params = usuario.rol === 'usuario' ? [usuario.id] : []

        const [stats] = await db.execute(`
            SELECT 
                COUNT(*) as total_conversaciones,
                SUM(CASE WHEN estado = 'abierta' THEN 1 ELSE 0 END) as abiertas,
                SUM(CASE WHEN estado = 'en_proceso' THEN 1 ELSE 0 END) as en_proceso,
                SUM(CASE WHEN estado = 'cerrada' THEN 1 ELSE 0 END) as cerradas,
                SUM(CASE WHEN plataforma = 'whatsapp' THEN 1 ELSE 0 END) as whatsapp,
                SUM(CASE WHEN plataforma = 'instagram' THEN 1 ELSE 0 END) as instagram,
                SUM(CASE WHEN plataforma = 'facebook' THEN 1 ELSE 0 END) as facebook
            FROM conversaciones 
            ${whereCondition}
        `, params)

        return stats[0]

    } catch (error) {
        console.log('Error al obtener estadisticas:', error)
        throw error
    }
}

export async function obtenerMensajesRecientes(limite = 10) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        const whereCondition = usuario.rol === 'usuario' ? 
            'AND (conv.asignada_a = ? OR conv.asignada_a IS NULL)' : 
            ''
        const params = usuario.rol === 'usuario' ? [limite, usuario.id] : [limite]

        const [mensajes] = await db.execute(`
            SELECT 
                m.*,
                c.nombre as contacto_nombre,
                conv.plataforma,
                u.nombre as agente_nombre
            FROM mensajes m
            INNER JOIN conversaciones conv ON m.conversacion_id = conv.id
            INNER JOIN contactos c ON m.contacto_id = c.id
            LEFT JOIN usuarios u ON m.enviado_por = u.id
            WHERE 1=1 ${whereCondition}
            ORDER BY m.fecha_envio DESC
            LIMIT ?
        `, params)

        return mensajes

    } catch (error) {
        console.log('Error al obtener mensajes recientes:', error)
        throw error
    }
}

export async function validarConfiguracionPlataforma(plataforma) {
    try {
        const config = await obtenerConfiguracionActiva(plataforma)
        
        if (!config) {
            return {
                valida: false,
                mensaje: `No hay configuracion activa para ${plataforma}`
            }
        }

        switch (plataforma) {
            case 'whatsapp':
                if (config.tipo_config === 'api') {
                    if (!config.access_token || !config.platform_id) {
                        return {
                            valida: false,
                            mensaje: 'Configuracion de WhatsApp API incompleta'
                        }
                    }
                } else if (config.tipo_config === 'baileys') {
                    if (!config.platform_id) {
                        return {
                            valida: false,
                            mensaje: 'Configuracion de Baileys incompleta'
                        }
                    }
                }
                break
                
            case 'instagram':
                if (!config.access_token || !config.platform_id) {
                    return {
                        valida: false,
                        mensaje: 'Configuracion de Instagram incompleta'
                    }
                }
                break
                
            case 'facebook':
                if (!config.access_token || !config.platform_id) {
                    return {
                        valida: false,
                        mensaje: 'Configuracion de Facebook incompleta'
                    }
                }
                break
                
            default:
                return {
                    valida: false,
                    mensaje: 'Plataforma no soportada'
                }
        }

        return {
            valida: true,
            mensaje: `Configuracion de ${plataforma} valida`,
            config: config
        }

    } catch (error) {
        console.log('Error al validar configuracion:', error)
        return {
            valida: false,
            mensaje: 'Error al validar configuracion'
        }
    }
}