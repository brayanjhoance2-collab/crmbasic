"use server"
import db from "@/_DB/db"
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'crm_whatsapp_facebook_2024'

// Función para obtener el usuario actual desde la sesión/token
export async function obtenerUsuarioActual() {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get('auth-token')
        
        if (!token) {
            return null
        }

        // Verificar y decodificar el token JWT
        const decoded = jwt.verify(token.value, JWT_SECRET)
        const userId = decoded.userId

        // Consultar el usuario en la base de datos
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
        
        // Actualizar último acceso
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
        
        // Si el token es inválido, limpiarlo
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            const cookieStore = await cookies()
            cookieStore.delete('auth-token')
        }
        
        return null
    }
}

// Función para obtener estadísticas del dashboard
export async function obtenerEstadisticasDashboard() {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        let filtroUsuario = ''
        let params = []

        // Si es usuario normal, solo sus estadísticas
        if (usuario.rol === 'usuario') {
            filtroUsuario = 'WHERE asignado_a = ?'
            params = [usuario.id]
        }

        // Estadísticas de contactos
        const [contactosStats] = await db.execute(`
            SELECT 
                COUNT(*) as total_contactos,
                SUM(CASE WHEN estado = 'nuevo' THEN 1 ELSE 0 END) as contactos_nuevos,
                SUM(CASE WHEN estado = 'cliente' THEN 1 ELSE 0 END) as clientes_convertidos,
                SUM(CASE WHEN DATE(fecha_creacion) = CURDATE() THEN 1 ELSE 0 END) as contactos_hoy
            FROM contactos 
            ${filtroUsuario}
        `, params)

        // Estadísticas de conversaciones
        const filtroConversacion = filtroUsuario.replace('asignado_a', 'asignada_a')
        const [conversacionesStats] = await db.execute(`
            SELECT 
                COUNT(*) as total_conversaciones,
                SUM(CASE WHEN estado = 'abierta' THEN 1 ELSE 0 END) as conversaciones_abiertas,
                SUM(CASE WHEN estado = 'en_proceso' THEN 1 ELSE 0 END) as conversaciones_proceso,
                SUM(CASE WHEN DATE(fecha_inicio) = CURDATE() THEN 1 ELSE 0 END) as conversaciones_hoy
            FROM conversaciones 
            ${filtroConversacion}
        `, params)

        // Estadísticas de mensajes
        let mensajesQuery = `
            SELECT 
                COUNT(*) as total_mensajes,
                SUM(CASE WHEN direccion = 'entrante' THEN 1 ELSE 0 END) as mensajes_recibidos,
                SUM(CASE WHEN direccion = 'saliente' THEN 1 ELSE 0 END) as mensajes_enviados,
                SUM(CASE WHEN DATE(fecha_envio) = CURDATE() THEN 1 ELSE 0 END) as mensajes_hoy
            FROM mensajes m
        `

        if (usuario.rol === 'usuario') {
            mensajesQuery += `
                INNER JOIN conversaciones c ON m.conversacion_id = c.id
                WHERE c.asignada_a = ?
            `
        }

        const [mensajesStats] = await db.execute(mensajesQuery, params)

        return {
            contactos: contactosStats[0] || {
                total_contactos: 0,
                contactos_nuevos: 0,
                clientes_convertidos: 0,
                contactos_hoy: 0
            },
            conversaciones: conversacionesStats[0] || {
                total_conversaciones: 0,
                conversaciones_abiertas: 0,
                conversaciones_proceso: 0,
                conversaciones_hoy: 0
            },
            mensajes: mensajesStats[0] || {
                total_mensajes: 0,
                mensajes_recibidos: 0,
                mensajes_enviados: 0,
                mensajes_hoy: 0
            }
        }

    } catch (error) {
        console.log('Error al obtener estadísticas:', error)
        throw error
    }
}

// Función para obtener conversaciones activas
export async function obtenerConversacionesActivas() {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        let whereClause = 'WHERE conv.estado IN ("abierta", "en_proceso")'
        let params = []

        // Si es usuario normal, solo ver sus conversaciones asignadas
        if (usuario.rol === 'usuario') {
            whereClause += ' AND (conv.asignada_a = ? OR conv.asignada_a IS NULL)'
            params.push(usuario.id)
        }

        const [rows] = await db.execute(`
            SELECT 
                conv.*,
                c.nombre as contacto_nombre,
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
                 ORDER BY m.fecha_envio DESC LIMIT 1) as fecha_ultimo_mensaje
            FROM conversaciones conv
            INNER JOIN contactos c ON conv.contacto_id = c.id
            LEFT JOIN usuarios u ON conv.asignada_a = u.id
            ${whereClause}
            ORDER BY conv.fecha_ultima_actividad DESC
            LIMIT 20
        `, params)

        return rows.map(conv => ({
            ...conv,
            agenteNombre: conv.agente_nombre ? 
                `${conv.agente_nombre} ${conv.agente_apellidos}` : null
        }))

    } catch (error) {
        console.log('Error al obtener conversaciones:', error)
        throw error
    }
}

// Función para obtener métricas por plataforma
export async function obtenerMetricasPorPlataforma(dias = 7) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        let filtroUsuario = ''
        let params = [dias]

        if (usuario.rol === 'usuario') {
            filtroUsuario = 'AND c.asignada_a = ?'
            params.push(usuario.id)
        }

        const [metricas] = await db.execute(`
            SELECT 
                c.plataforma,
                COUNT(DISTINCT c.id) as total_conversaciones,
                COUNT(m.id) as total_mensajes,
                SUM(CASE WHEN m.direccion = 'entrante' THEN 1 ELSE 0 END) as mensajes_recibidos,
                SUM(CASE WHEN m.direccion = 'saliente' THEN 1 ELSE 0 END) as mensajes_enviados,
                AVG(CASE 
                    WHEN m.direccion = 'saliente' AND m.estado_entrega = 'entregado' 
                    THEN TIMESTAMPDIFF(SECOND, 
                        (SELECT fecha_envio FROM mensajes m2 
                         WHERE m2.conversacion_id = c.id AND m2.direccion = 'entrante' 
                         AND m2.fecha_envio < m.fecha_envio 
                         ORDER BY m2.fecha_envio DESC LIMIT 1), 
                        m.fecha_envio)
                    ELSE NULL 
                END) as tiempo_respuesta_promedio
            FROM conversaciones c
            LEFT JOIN mensajes m ON c.id = m.conversacion_id
            WHERE c.fecha_inicio >= DATE_SUB(NOW(), INTERVAL ? DAY)
            ${filtroUsuario}
            GROUP BY c.plataforma
            ORDER BY total_conversaciones DESC
        `, params)

        return metricas || []

    } catch (error) {
        console.log('Error al obtener métricas por plataforma:', error)
        throw error
    }
}

// Función para exportar estadísticas a Excel
export async function exportarEstadisticasExcel() {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        // Obtener datos para el Excel
        const [estadisticas, conversaciones, metricas] = await Promise.all([
            obtenerEstadisticasDashboard(),
            obtenerConversacionesActivas(),
            obtenerMetricasPorPlataforma(30)
        ])

        // Simular descarga de Excel (en un entorno real usarías una librería como ExcelJS)
        const datosExcel = {
            estadisticas,
            conversaciones,
            metricas,
            fechaGeneracion: new Date().toISOString(),
            generadoPor: usuario.nombreCompleto
        }

        // En un entorno real, aquí generarías el archivo Excel
        console.log('Datos para Excel:', datosExcel)

        // Simular el proceso de descarga
        if (typeof window !== 'undefined') {
            const dataStr = JSON.stringify(datosExcel, null, 2)
            const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)
            
            const exportFileDefaultName = `estadisticas_crm_${new Date().toISOString().split('T')[0]}.json`
            
            const linkElement = document.createElement('a')
            linkElement.setAttribute('href', dataUri)
            linkElement.setAttribute('download', exportFileDefaultName)
            linkElement.click()
        }

        return {
            success: true,
            message: 'Estadísticas exportadas exitosamente'
        }

    } catch (error) {
        console.log('Error al exportar estadísticas:', error)
        throw error
    }
}

// Función para cerrar sesión
export async function cerrarSesion() {
    try {
        const cookieStore = await cookies()
        
        // Eliminar el token de autenticación
        cookieStore.delete('auth-token')
        
        return { success: true, message: 'Sesión cerrada correctamente' }
        
    } catch (error) {
        console.log('Error al cerrar sesión:', error)
        throw new Error('Error al cerrar sesión')
    }
}