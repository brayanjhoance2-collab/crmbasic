// app/api/messaging/send/route.js
import { NextResponse } from 'next/server'
import { MessageService } from '@/_services/messageService'
import { obtenerUsuarioActual } from '@/_Pages/conversacion/servidor'
import db from '@/_DB/db'

export async function POST(request) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 })
        }

        const body = await request.json()
        const { conversacionId, contenido, plataforma, recipientId, numeroTelefono } = body

        if (!contenido?.trim()) {
            return NextResponse.json({ error: 'Contenido del mensaje requerido' }, { status: 400 })
        }

        let resultado = null

        if (conversacionId) {
            const [conversacionRows] = await db.execute(`
                SELECT conv.*, 
                       c.whatsapp_id, 
                       c.instagram_id, 
                       c.facebook_id, 
                       c.telefono as contacto_telefono
                FROM conversaciones conv
                INNER JOIN contactos c ON conv.contacto_id = c.id
                WHERE conv.id = ?
                ${usuario.rol === 'usuario' ? 'AND (conv.asignada_a = ? OR conv.asignada_a IS NULL)' : ''}
            `, usuario.rol === 'usuario' ? [conversacionId, usuario.id] : [conversacionId])

            if (conversacionRows.length === 0) {
                return NextResponse.json({ error: 'Conversacion no encontrada' }, { status: 404 })
            }

            const conversacion = conversacionRows[0]
            const mensaje = { contenido: contenido.trim(), tipo: 'texto' }

            resultado = await MessageService.sendUnifiedMessage(conversacion, mensaje)

            if (resultado.success) {
                const [insertResult] = await db.execute(`
                    INSERT INTO mensajes (
                        conversacion_id,
                        contacto_id,
                        tipo_mensaje,
                        contenido,
                        direccion,
                        enviado_por,
                        estado_entrega,
                        fecha_envio,
                        mensaje_id_externo
                    ) VALUES (?, ?, ?, ?, 'saliente', ?, 'entregado', NOW(), ?)
                `, [
                    conversacion.id,
                    conversacion.contacto_id,
                    'texto',
                    contenido.trim(),
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
                `, [conversacion.id])

                await db.execute(`
                    UPDATE contactos SET ultima_interaccion = NOW() WHERE id = ?
                `, [conversacion.contacto_id])
            }

        } else if (plataforma && (recipientId || numeroTelefono)) {
            const contactoSimulado = {
                whatsapp_id: plataforma === 'whatsapp' ? recipientId : null,
                instagram_id: plataforma === 'instagram' ? recipientId : null,
                facebook_id: plataforma === 'facebook' ? recipientId : null,
                telefono: numeroTelefono
            }

            const mensaje = { contenido: contenido.trim(), tipo: 'texto' }
            resultado = await MessageService.sendToContact(contactoSimulado, plataforma, mensaje)

        } else {
            return NextResponse.json({ 
                error: 'Se requiere conversacionId o (plataforma + recipientId/numeroTelefono)' 
            }, { status: 400 })
        }

        if (resultado.success) {
            return NextResponse.json({
                success: true,
                messageId: resultado.messageId,
                platform: resultado.platform,
                message: 'Mensaje enviado exitosamente'
            })
        } else {
            return NextResponse.json({
                success: false,
                error: resultado.error
            }, { status: 400 })
        }

    } catch (error) {
        console.log('Error en API de mensajeria:', error)
        return NextResponse.json({
            success: false,
            error: 'Error interno del servidor'
        }, { status: 500 })
    }
}