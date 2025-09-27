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

export async function obtenerAutomatizaciones() {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        if (usuario.rol === 'usuario') {
            throw new Error('Sin permisos para ver automatizaciones')
        }

        const [rows] = await db.execute(`
            SELECT 
                a.*,
                COUNT(ah.id) as veces_ejecutada,
                MAX(ah.fecha_ejecucion) as ultima_ejecucion
            FROM automatizaciones a
            LEFT JOIN automatizaciones_historial ah ON a.id = ah.automatizacion_id
            GROUP BY a.id
            ORDER BY a.prioridad ASC, a.fecha_creacion DESC
        `)

        return rows.map(automatizacion => {
            // Verificar y corregir el formato de plataformas
            let plataformasArray = ['whatsapp']; // Valor por defecto
            
            if (automatizacion.plataformas) {
                try {
                    // Si ya es JSON válido, parsearlo
                    plataformasArray = JSON.parse(automatizacion.plataformas);
                } catch (error) {
                    // Si no es JSON válido, podría ser una cadena simple
                    if (typeof automatizacion.plataformas === 'string') {
                        // Si es una cadena como "whatsapp", convertirla a array
                        const cleaned = automatizacion.plataformas.replace(/['"]/g, '');
                        if (cleaned.includes(',')) {
                            plataformasArray = cleaned.split(',').map(p => p.trim());
                        } else {
                            plataformasArray = [cleaned];
                        }
                    }
                }
            }
            
            return {
                ...automatizacion,
                plataformas: JSON.stringify(plataformasArray) // Asegurar que siempre sea JSON string
            }
        })

    } catch (error) {
        console.log('Error al obtener automatizaciones:', error)
        throw error
    }
}

export async function crearAutomatizacion(datos) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        if (usuario.rol === 'usuario') {
            throw new Error('Sin permisos para crear automatizaciones')
        }

        const {
            nombre,
            descripcion,
            trigger_tipo,
            trigger_condicion,
            accion_tipo,
            accion_contenido,
            plantilla_id,
            plataformas,
            activa,
            prioridad
        } = datos

        const [result] = await db.execute(`
            INSERT INTO automatizaciones (
                nombre,
                descripcion,
                trigger_tipo,
                trigger_condicion,
                accion_tipo,
                accion_contenido,
                plantilla_id,
                plataformas,
                activa,
                prioridad,
                creada_por,
                fecha_creacion
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `, [
            nombre,
            descripcion || null,
            trigger_tipo,
            trigger_condicion || null,
            accion_tipo,
            accion_contenido,
            plantilla_id || null,
            plataformas,
            activa ? 1 : 0,
            prioridad || 1,
            usuario.id
        ])

        return {
            success: true,
            automatizacionId: result.insertId,
            message: 'Automatización creada exitosamente'
        }

    } catch (error) {
        console.log('Error al crear automatización:', error)
        throw error
    }
}

export async function actualizarAutomatizacion(id, datos) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        if (usuario.rol === 'usuario') {
            throw new Error('Sin permisos para actualizar automatizaciones')
        }

        const {
            nombre,
            descripcion,
            trigger_tipo,
            trigger_condicion,
            accion_tipo,
            accion_contenido,
            plantilla_id,
            plataformas,
            activa,
            prioridad
        } = datos

        await db.execute(`
            UPDATE automatizaciones SET
                nombre = ?,
                descripcion = ?,
                trigger_tipo = ?,
                trigger_condicion = ?,
                accion_tipo = ?,
                accion_contenido = ?,
                plantilla_id = ?,
                plataformas = ?,
                activa = ?,
                prioridad = ?,
                fecha_actualizacion = NOW()
            WHERE id = ?
        `, [
            nombre,
            descripcion || null,
            trigger_tipo,
            trigger_condicion || null,
            accion_tipo,
            accion_contenido,
            plantilla_id || null,
            plataformas,
            activa ? 1 : 0,
            prioridad || 1,
            id
        ])

        return {
            success: true,
            message: 'Automatización actualizada exitosamente'
        }

    } catch (error) {
        console.log('Error al actualizar automatización:', error)
        throw error
    }
}

export async function eliminarAutomatizacion(id) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        if (usuario.rol === 'usuario') {
            throw new Error('Sin permisos para eliminar automatizaciones')
        }

        await db.execute(`DELETE FROM automatizaciones WHERE id = ?`, [id])

        return {
            success: true,
            message: 'Automatización eliminada exitosamente'
        }

    } catch (error) {
        console.log('Error al eliminar automatización:', error)
        throw error
    }
}

export async function activarDesactivarAutomatizacion(id, activa) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        if (usuario.rol === 'usuario') {
            throw new Error('Sin permisos para cambiar estado de automatizaciones')
        }

        await db.execute(`
            UPDATE automatizaciones SET 
                activa = ?,
                fecha_actualizacion = NOW()
            WHERE id = ?
        `, [activa ? 1 : 0, id])

        return {
            success: true,
            message: `Automatización ${activa ? 'activada' : 'desactivada'} exitosamente`
        }

    } catch (error) {
        console.log('Error al cambiar estado de automatización:', error)
        throw error
    }
}

export async function obtenerPlantillasMensajes() {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        const [rows] = await db.execute(`
            SELECT 
                p.*,
                u.nombre as creador_nombre,
                u.apellidos as creador_apellidos
            FROM plantillas_mensajes p
            LEFT JOIN usuarios u ON p.creada_por = u.id
            WHERE p.activa = 1
            ORDER BY p.veces_usada DESC, p.fecha_creacion DESC
        `)

        return rows.map(plantilla => ({
            ...plantilla,
            veces_usada: plantilla.veces_usada || 0,
            creador_nombre_completo: plantilla.creador_nombre ? 
                `${plantilla.creador_nombre} ${plantilla.creador_apellidos}` : 'Sistema'
        }))

    } catch (error) {
        console.log('Error al obtener plantillas:', error)
        throw error
    }
}

export async function crearPlantillaMensaje(datos) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        if (usuario.rol === 'usuario') {
            throw new Error('Sin permisos para crear plantillas')
        }

        const {
            nombre,
            categoria,
            contenido,
            variables,
            plataforma
        } = datos

        const [result] = await db.execute(`
            INSERT INTO plantillas_mensajes (
                nombre,
                categoria,
                contenido,
                variables,
                plataforma,
                activa,
                veces_usada,
                creada_por,
                fecha_creacion
            ) VALUES (?, ?, ?, ?, ?, 1, 0, ?, NOW())
        `, [
            nombre,
            categoria || 'general',
            contenido,
            variables ? JSON.stringify(variables) : null,
            plataforma || 'todas',
            usuario.id
        ])

        return {
            success: true,
            plantillaId: result.insertId,
            message: 'Plantilla creada exitosamente'
        }

    } catch (error) {
        console.log('Error al crear plantilla:', error)
        throw error
    }
}

export async function actualizarPlantillaMensaje(id, datos) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        if (usuario.rol === 'usuario') {
            throw new Error('Sin permisos para actualizar plantillas')
        }

        const {
            nombre,
            categoria,
            contenido,
            variables,
            plataforma
        } = datos

        await db.execute(`
            UPDATE plantillas_mensajes SET
                nombre = ?,
                categoria = ?,
                contenido = ?,
                variables = ?,
                plataforma = ?
            WHERE id = ?
        `, [
            nombre,
            categoria || 'general',
            contenido,
            variables ? JSON.stringify(variables) : null,
            plataforma || 'todas',
            id
        ])

        return {
            success: true,
            message: 'Plantilla actualizada exitosamente'
        }

    } catch (error) {
        console.log('Error al actualizar plantilla:', error)
        throw error
    }
}

export async function eliminarPlantillaMensaje(id) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        if (usuario.rol === 'usuario') {
            throw new Error('Sin permisos para eliminar plantillas')
        }

        await db.execute(`UPDATE plantillas_mensajes SET activa = 0 WHERE id = ?`, [id])

        return {
            success: true,
            message: 'Plantilla eliminada exitosamente'
        }

    } catch (error) {
        console.log('Error al eliminar plantilla:', error)
        throw error
    }
}

export async function obtenerTriggers(filtro = 'todos') {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        if (usuario.rol === 'usuario') {
            throw new Error('Sin permisos para ver triggers')
        }

        let whereClause = '1 = 1'
        if (filtro === 'ejecutados') {
            whereClause = "ah.estado = 'ejecutado'"
        } else if (filtro === 'fallidos') {
            whereClause = "ah.estado = 'fallido'"
        }

        const [rows] = await db.execute(`
            SELECT 
                ah.*,
                a.nombre as automatizacion_nombre,
                c.nombre as contacto_nombre,
                conv.plataforma
            FROM automatizaciones_historial ah
            LEFT JOIN automatizaciones a ON ah.automatizacion_id = a.id
            LEFT JOIN conversaciones conv ON ah.conversacion_id = conv.id
            LEFT JOIN contactos c ON conv.contacto_id = c.id
            WHERE ${whereClause}
            ORDER BY ah.fecha_ejecucion DESC
            LIMIT 100
        `)

        return rows

    } catch (error) {
        console.log('Error al obtener triggers:', error)
        throw error
    }
}

export async function probarAutomatizacion(id) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        if (usuario.rol === 'usuario') {
            throw new Error('Sin permisos para probar automatizaciones')
        }

        const [automatizacionRows] = await db.execute(`
            SELECT * FROM automatizaciones WHERE id = ? AND activa = 1
        `, [id])

        if (automatizacionRows.length === 0) {
            throw new Error('Automatización no encontrada o inactiva')
        }

        const automatizacion = automatizacionRows[0]

        await db.execute(`
            INSERT INTO automatizaciones_historial (
                automatizacion_id,
                trigger_tipo,
                accion_ejecutada,
                estado,
                resultado_mensaje,
                fecha_ejecucion
            ) VALUES (?, ?, ?, 'ejecutado', 'Prueba manual ejecutada', NOW())
        `, [
            id,
            automatizacion.trigger_tipo,
            automatizacion.accion_tipo
        ])

        return {
            success: true,
            message: `Automatización "${automatizacion.nombre}" probada exitosamente`
        }

    } catch (error) {
        console.log('Error al probar automatización:', error)
        throw error
    }
}

export async function ejecutarAutomatizacion(conversacionId, mensaje) {
    try {
        const [conversacionRows] = await db.execute(`
            SELECT conv.*, c.nombre as contacto_nombre, c.whatsapp_id, c.instagram_id, c.facebook_id
            FROM conversaciones conv
            INNER JOIN contactos c ON conv.contacto_id = c.id
            WHERE conv.id = ?
        `, [conversacionId])

        if (conversacionRows.length === 0) {
            return { success: false, message: 'Conversación no encontrada' }
        }

        const conversacion = conversacionRows[0]

        // Consulta mejorada que maneja diferentes formatos de JSON
        const [automatizacionesRows] = await db.execute(`
            SELECT * FROM automatizaciones 
            WHERE activa = 1 
            AND (
                plataformas LIKE ? OR 
                JSON_CONTAINS(plataformas, ?) OR
                JSON_EXTRACT(plataformas, '$[*]') LIKE ?
            )
            ORDER BY prioridad ASC
        `, [
            `%"${conversacion.plataforma}"%`, 
            `"${conversacion.plataforma}"`,
            `%"${conversacion.plataforma}"%`
        ])

        for (const automatizacion of automatizacionesRows) {
            const cumpleCondicion = await evaluarCondicionTrigger(automatizacion, conversacion, mensaje)
            
            if (cumpleCondicion) {
                await ejecutarAccionAutomatizacion(automatizacion, conversacion, mensaje)
                break // Solo ejecutar la primera automatización que coincida
            }
        }

        return { success: true, message: 'Automatizaciones procesadas' }

    } catch (error) {
        console.log('Error al ejecutar automatizaciones:', error)
        return { success: false, message: error.message }
    }
}

async function evaluarCondicionTrigger(automatizacion, conversacion, mensaje) {
    try {
        const { trigger_tipo, trigger_condicion } = automatizacion

        switch (trigger_tipo) {
            case 'mensaje_recibido':
                return true

            case 'nueva_conversacion':
                const [mensajesCount] = await db.execute(`
                    SELECT COUNT(*) as total FROM mensajes WHERE conversacion_id = ?
                `, [conversacion.id])
                return mensajesCount[0].total <= 1

            case 'palabra_clave':
                if (!trigger_condicion || !mensaje.contenido) return false
                const palabras = trigger_condicion.toLowerCase().split(',').map(p => p.trim())
                const contenidoLower = mensaje.contenido.toLowerCase()
                return palabras.some(palabra => contenidoLower.includes(palabra))

            case 'tiempo_respuesta':
                const minutos = parseInt(trigger_condicion) || 30
                const [ultimoMensajeAgente] = await db.execute(`
                    SELECT fecha_envio FROM mensajes 
                    WHERE conversacion_id = ? AND direccion = 'saliente'
                    ORDER BY fecha_envio DESC LIMIT 1
                `, [conversacion.id])
                
                if (ultimoMensajeAgente.length === 0) return true
                
                const tiempoTranscurrido = Date.now() - new Date(ultimoMensajeAgente[0].fecha_envio).getTime()
                return tiempoTranscurrido > (minutos * 60 * 1000)

            case 'horario':
                if (!trigger_condicion) return false
                const hora = new Date().getHours()
                const rangos = trigger_condicion.split('-')
                if (rangos.length !== 2) return false
                const horaInicio = parseInt(rangos[0])
                const horaFin = parseInt(rangos[1])
                return hora >= horaInicio && hora <= horaFin

            default:
                return false
        }
    } catch (error) {
        console.log('Error al evaluar condición de trigger:', error)
        return false
    }
}

async function ejecutarAccionAutomatizacion(automatizacion, conversacion, mensaje) {
    try {
        const { accion_tipo, accion_contenido, id: automatizacionId } = automatizacion

        let resultado = { success: false, message: 'Acción no ejecutada' }

        switch (accion_tipo) {
            case 'enviar_mensaje':
                resultado = await enviarMensajeAutomatico(conversacion, accion_contenido)
                break

            case 'asignar_agente':
                resultado = await asignarAgenteAutomatico(conversacion.id, accion_contenido)
                break

            case 'cambiar_estado':
                resultado = await cambiarEstadoAutomatico(conversacion.id, accion_contenido)
                break

            case 'etiquetar':
                resultado = await etiquetarConversacionAutomatica(conversacion.id, accion_contenido)
                break

            case 'webhook':
                resultado = await llamarWebhookAutomatico(accion_contenido, conversacion, mensaje)
                break

            default:
                resultado = { success: false, message: 'Tipo de acción no válido' }
        }

        // Registrar en historial
        await db.execute(`
            INSERT INTO automatizaciones_historial (
                automatizacion_id,
                conversacion_id,
                trigger_tipo,
                accion_ejecutada,
                estado,
                resultado_mensaje,
                fecha_ejecucion
            ) VALUES (?, ?, ?, ?, ?, ?, NOW())
        `, [
            automatizacionId,
            conversacion.id,
            automatizacion.trigger_tipo,
            accion_tipo,
            resultado.success ? 'ejecutado' : 'fallido',
            resultado.message
        ])

        return resultado

    } catch (error) {
        console.log('Error al ejecutar acción de automatización:', error)
        
        // Registrar error en historial
        await db.execute(`
            INSERT INTO automatizaciones_historial (
                automatizacion_id,
                conversacion_id,
                trigger_tipo,
                accion_ejecutada,
                estado,
                resultado_mensaje,
                error_mensaje,
                fecha_ejecucion
            ) VALUES (?, ?, ?, ?, 'fallido', ?, ?, NOW())
        `, [
            automatizacion.id,
            conversacion.id,
            automatizacion.trigger_tipo,
            automatizacion.accion_tipo,
            'Error interno',
            error.message
        ])

        return { success: false, message: error.message }
    }
}

async function enviarMensajeAutomatico(conversacion, contenidoMensaje) {
    try {
        // Importar desde conversaciones (no conversacion)
        const { enviarMensaje } = await import('../conversacion/servidor')
        
        const contenidoPersonalizado = contenidoMensaje
            .replace('{nombre}', conversacion.contacto_nombre || 'Usuario')
            .replace('{fecha}', new Date().toLocaleDateString('es-ES'))
            .replace('{hora}', new Date().toLocaleTimeString('es-ES'))

        const resultado = await enviarMensaje(conversacion.id, {
            contenido: contenidoPersonalizado,
            tipo: 'texto'
        })

        return {
            success: resultado.success,
            message: resultado.success ? 'Mensaje automático enviado' : 'Error al enviar mensaje automático'
        }

    } catch (error) {
        console.log('Error al enviar mensaje automático:', error)
        return { success: false, message: 'Error al enviar mensaje automático' }
    }
}

async function asignarAgenteAutomatico(conversacionId, agenteId) {
    try {
        const { asignarConversacion } = await import('../conversacion/servidor')
        
        const resultado = await asignarConversacion(conversacionId, parseInt(agenteId))
        
        return {
            success: resultado.success,
            message: resultado.success ? 'Agente asignado automáticamente' : 'Error al asignar agente'
        }

    } catch (error) {
        console.log('Error al asignar agente automático:', error)
        return { success: false, message: 'Error al asignar agente automático' }
    }
}

async function cambiarEstadoAutomatico(conversacionId, nuevoEstado) {
    try {
        const { cambiarEstadoConversacion } = await import('../conversacion/servidor')
        
        const resultado = await cambiarEstadoConversacion(conversacionId, nuevoEstado)
        
        return {
            success: resultado.success,
            message: resultado.success ? `Estado cambiado a ${nuevoEstado}` : 'Error al cambiar estado'
        }

    } catch (error) {
        console.log('Error al cambiar estado automático:', error)
        return { success: false, message: 'Error al cambiar estado automático' }
    }
}

async function etiquetarConversacionAutomatica(conversacionId, etiqueta) {
    try {
        let etiquetaId = null
        
        // Buscar etiqueta existente
        const [etiquetaExistente] = await db.execute(`
            SELECT id FROM etiquetas WHERE nombre = ? AND activa = 1
        `, [etiqueta])

        if (etiquetaExistente.length > 0) {
            etiquetaId = etiquetaExistente[0].id
        } else {
            // Crear nueva etiqueta
            const [nuevaEtiqueta] = await db.execute(`
                INSERT INTO etiquetas (nombre, color, descripcion, activa, fecha_creacion)
                VALUES (?, '#3B82F6', 'Etiqueta automática', 1, NOW())
            `, [etiqueta])
            etiquetaId = nuevaEtiqueta.insertId
        }

        // Obtener contacto de la conversación
        const [conversacionData] = await db.execute(`
            SELECT contacto_id FROM conversaciones WHERE id = ?
        `, [conversacionId])

        if (conversacionData.length === 0) {
            return { success: false, message: 'Conversación no encontrada' }
        }

        // Asignar etiqueta al contacto
        await db.execute(`
            INSERT IGNORE INTO contactos_etiquetas (contacto_id, etiqueta_id, fecha_asignacion)
            VALUES (?, ?, NOW())
        `, [conversacionData[0].contacto_id, etiquetaId])

        return { success: true, message: `Etiqueta "${etiqueta}" asignada` }

    } catch (error) {
        console.log('Error al etiquetar conversación:', error)
        return { success: false, message: 'Error al asignar etiqueta' }
    }
}

async function llamarWebhookAutomatico(url, conversacion, mensaje) {
    try {
        const payload = {
            conversacion: {
                id: conversacion.id,
                plataforma: conversacion.plataforma,
                contacto_nombre: conversacion.contacto_nombre
            },
            mensaje: {
                contenido: mensaje.contenido,
                tipo: mensaje.tipo_mensaje,
                direccion: mensaje.direccion
            },
            timestamp: new Date().toISOString()
        }

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 segundos

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload),
            signal: controller.signal
        })

        clearTimeout(timeoutId)

        if (response.ok) {
            return { success: true, message: 'Webhook llamado exitosamente' }
        } else {
            return { success: false, message: `Webhook falló: ${response.status}` }
        }

    } catch (error) {
        console.log('Error al llamar webhook:', error)
        if (error.name === 'AbortError') {
            return { success: false, message: 'Webhook timeout (10s)' }
        }
        return { success: false, message: 'Error al llamar webhook: ' + error.message }
    }
}

export async function procesarMensajeParaAutomatizaciones(conversacionId, mensaje) {
    try {
        return await ejecutarAutomatizacion(conversacionId, mensaje)
    } catch (error) {
        console.log('Error al procesar mensaje para automatizaciones:', error)
        return { success: false, message: error.message }
    }
}