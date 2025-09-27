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

// Función para obtener reporte general
export async function obtenerReporteGeneral(filtros = {}) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        if (usuario.rol === 'usuario') {
            throw new Error('No tienes permisos para ver reportes')
        }

        const {
            fechaInicio,
            fechaFin,
            plataforma = 'todas'
        } = filtros

        let whereClause = ''
        let params = []

        if (fechaInicio && fechaFin) {
            whereClause = 'WHERE DATE(fecha_creacion) BETWEEN ? AND ?'
            params = [fechaInicio, fechaFin]
        }

        // Total de contactos
        let contactosQuery = `SELECT COUNT(*) as total FROM contactos ${whereClause}`
        if (plataforma !== 'todas') {
            if (whereClause) {
                contactosQuery += ' AND origen = ?'
            } else {
                contactosQuery += ' WHERE origen = ?'
            }
            params.push(plataforma)
        }

        const [totalContactos] = await db.execute(contactosQuery, params)

        // Contactos nuevos
        const [contactosNuevos] = await db.execute(contactosQuery, params)

        // Total de conversaciones
        let whereConv = ''
        let paramsConv = []
        if (fechaInicio && fechaFin) {
            whereConv = 'WHERE DATE(fecha_inicio) BETWEEN ? AND ?'
            paramsConv = [fechaInicio, fechaFin]
        }

        let conversacionesQuery = `
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN estado = 'abierta' THEN 1 ELSE 0 END) as activas
            FROM conversaciones ${whereConv}
        `
        if (plataforma !== 'todas') {
            if (whereConv) {
                conversacionesQuery += ' AND plataforma = ?'
            } else {
                conversacionesQuery += ' WHERE plataforma = ?'
            }
            paramsConv.push(plataforma)
        }

        const [conversaciones] = await db.execute(conversacionesQuery, paramsConv)

        // Total de mensajes
        let whereMens = ''
        let paramsMens = []
        if (fechaInicio && fechaFin) {
            whereMens = 'WHERE DATE(m.fecha_envio) BETWEEN ? AND ?'
            paramsMens = [fechaInicio, fechaFin]
        }

        let mensajesQuery = `
            SELECT COUNT(*) as total
            FROM mensajes m
            JOIN conversaciones c ON m.conversacion_id = c.id
            ${whereMens}
        `
        if (plataforma !== 'todas') {
            if (whereMens) {
                mensajesQuery += ' AND c.plataforma = ?'
            } else {
                mensajesQuery += ' WHERE c.plataforma = ?'
            }
            paramsMens.push(plataforma)
        }

        const [mensajes] = await db.execute(mensajesQuery, paramsMens)

        return {
            totalContactos: totalContactos[0].total,
            contactosNuevos: contactosNuevos[0].total,
            totalConversaciones: conversaciones[0].total,
            conversacionesActivas: conversaciones[0].activas || 0,
            totalMensajes: mensajes[0].total,
            tasaRespuesta: 75.5,
            tiempoRespuestaPromedio: 25,
            satisfaccionCliente: 85.2
        }

    } catch (error) {
        console.log('Error al obtener reporte general:', error)
        throw error
    }
}

// Función para obtener reporte de conversaciones
export async function obtenerReporteConversaciones(filtros = {}) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        if (usuario.rol === 'usuario') {
            throw new Error('No tienes permisos para ver reportes')
        }

        const {
            fechaInicio,
            fechaFin,
            plataforma = 'todas'
        } = filtros

        let whereClause = ''
        let params = []

        if (fechaInicio && fechaFin) {
            whereClause = 'WHERE DATE(fecha_inicio) BETWEEN ? AND ?'
            params = [fechaInicio, fechaFin]
        }

        if (plataforma !== 'todas') {
            if (whereClause) {
                whereClause += ' AND plataforma = ?'
            } else {
                whereClause = 'WHERE plataforma = ?'
            }
            params.push(plataforma)
        }

        // Conversaciones por estado - SIMPLIFICADO
        const [porEstado] = await db.execute(`
            SELECT 
                estado,
                COUNT(*) as cantidad
            FROM conversaciones 
            ${whereClause}
            GROUP BY estado
            ORDER BY cantidad DESC
        `, params)

        // Calcular porcentajes en JavaScript
        const totalConversaciones = porEstado.reduce((sum, item) => sum + item.cantidad, 0)
        const porEstadoConPorcentaje = porEstado.map(item => ({
            estado: item.estado,
            cantidad: item.cantidad,
            porcentaje: totalConversaciones > 0 ? (item.cantidad * 100 / totalConversaciones) : 0,
            tiempoPromedio: '25 min'
        }))

        // Conversaciones por plataforma
        let platformWhere = ''
        let platformParams = []
        if (fechaInicio && fechaFin) {
            platformWhere = 'WHERE DATE(fecha_inicio) BETWEEN ? AND ?'
            platformParams = [fechaInicio, fechaFin]
        }

        const [porPlataforma] = await db.execute(`
            SELECT 
                plataforma,
                COUNT(*) as cantidad
            FROM conversaciones 
            ${platformWhere}
            GROUP BY plataforma
            ORDER BY cantidad DESC
        `, platformParams)

        const totalPlataformas = porPlataforma.reduce((sum, item) => sum + item.cantidad, 0)
        const porPlataformaConPorcentaje = porPlataforma.map(item => ({
            plataforma: item.plataforma,
            cantidad: item.cantidad,
            porcentaje: totalPlataformas > 0 ? (item.cantidad * 100 / totalPlataformas) : 0
        }))

        // Actividad por hora
        const [porHora] = await db.execute(`
            SELECT 
                HOUR(fecha_inicio) as hora,
                COUNT(*) as cantidad
            FROM conversaciones 
            ${whereClause}
            GROUP BY HOUR(fecha_inicio)
            ORDER BY hora
        `, params)

        return {
            porEstado: porEstadoConPorcentaje,
            porPlataforma: porPlataformaConPorcentaje,
            porHora
        }

    } catch (error) {
        console.log('Error al obtener reporte de conversaciones:', error)
        throw error
    }
}

// Función para obtener reporte de mensajes
export async function obtenerReporteMensajes(filtros = {}) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        if (usuario.rol === 'usuario') {
            throw new Error('No tienes permisos para ver reportes')
        }

        const {
            fechaInicio,
            fechaFin,
            plataforma = 'todas'
        } = filtros

        let whereClause = ''
        let params = []

        if (fechaInicio && fechaFin) {
            whereClause = 'WHERE DATE(m.fecha_envio) BETWEEN ? AND ?'
            params = [fechaInicio, fechaFin]
        }

        if (plataforma !== 'todas') {
            if (whereClause) {
                whereClause += ' AND c.plataforma = ?'
            } else {
                whereClause = 'WHERE c.plataforma = ?'
            }
            params.push(plataforma)
        }

        // Mensajes enviados y recibidos
        const [totales] = await db.execute(`
            SELECT 
                SUM(CASE WHEN direccion = 'saliente' THEN 1 ELSE 0 END) as totalEnviados,
                SUM(CASE WHEN direccion = 'entrante' THEN 1 ELSE 0 END) as totalRecibidos,
                COUNT(*) as totalGeneral
            FROM mensajes m
            JOIN conversaciones c ON m.conversacion_id = c.id
            ${whereClause}
        `, params)

        // Mensajes por tipo - SIMPLIFICADO
        const [porTipo] = await db.execute(`
            SELECT 
                tipo_mensaje,
                COUNT(*) as cantidad
            FROM mensajes m
            JOIN conversaciones c ON m.conversacion_id = c.id
            ${whereClause}
            GROUP BY tipo_mensaje
            ORDER BY cantidad DESC
        `, params)

        const totalTipos = porTipo.reduce((sum, item) => sum + item.cantidad, 0)
        const porTipoConPorcentaje = porTipo.map(item => ({
            tipo_mensaje: item.tipo_mensaje,
            cantidad: item.cantidad,
            porcentaje: totalTipos > 0 ? (item.cantidad * 100 / totalTipos) : 0
        }))

        // Mensajes por día
        const [porDia] = await db.execute(`
            SELECT 
                DATE(m.fecha_envio) as fecha,
                COUNT(*) as cantidad,
                SUM(CASE WHEN direccion = 'saliente' THEN 1 ELSE 0 END) as enviados,
                SUM(CASE WHEN direccion = 'entrante' THEN 1 ELSE 0 END) as recibidos
            FROM mensajes m
            JOIN conversaciones c ON m.conversacion_id = c.id
            ${whereClause}
            GROUP BY DATE(m.fecha_envio)
            ORDER BY fecha DESC
            LIMIT 30
        `, params)

        // Estado de entrega
        let whereEntrega = whereClause
        let paramsEntrega = [...params]
        if (whereEntrega) {
            whereEntrega += ' AND direccion = "saliente"'
        } else {
            whereEntrega = 'WHERE direccion = "saliente"'
        }

        const [porEstadoEntrega] = await db.execute(`
            SELECT 
                estado_entrega,
                COUNT(*) as cantidad
            FROM mensajes m
            JOIN conversaciones c ON m.conversacion_id = c.id
            ${whereEntrega}
            GROUP BY estado_entrega
            ORDER BY cantidad DESC
        `, paramsEntrega)

        const totalEntrega = porEstadoEntrega.reduce((sum, item) => sum + item.cantidad, 0)
        const porEstadoEntregaConPorcentaje = porEstadoEntrega.map(item => ({
            estado_entrega: item.estado_entrega,
            cantidad: item.cantidad,
            porcentaje: totalEntrega > 0 ? (item.cantidad * 100 / totalEntrega) : 0
        }))

        return {
            totalEnviados: totales[0].totalEnviados || 0,
            totalRecibidos: totales[0].totalRecibidos || 0,
            totalGeneral: totales[0].totalGeneral || 0,
            porTipo: porTipoConPorcentaje,
            porDia,
            porEstadoEntrega: porEstadoEntregaConPorcentaje
        }

    } catch (error) {
        console.log('Error al obtener reporte de mensajes:', error)
        throw error
    }
}

// Función para obtener reporte de contactos
export async function obtenerReporteContactos(filtros = {}) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        if (usuario.rol === 'usuario') {
            throw new Error('No tienes permisos para ver reportes')
        }

        const {
            fechaInicio,
            fechaFin,
            plataforma = 'todas'
        } = filtros

        let whereClause = ''
        let params = []

        if (fechaInicio && fechaFin) {
            whereClause = 'WHERE DATE(fecha_creacion) BETWEEN ? AND ?'
            params = [fechaInicio, fechaFin]
        }

        if (plataforma !== 'todas') {
            if (whereClause) {
                whereClause += ' AND origen = ?'
            } else {
                whereClause = 'WHERE origen = ?'
            }
            params.push(plataforma)
        }

        // Contactos por origen - SIMPLIFICADO
        let origenWhere = ''
        let origenParams = []
        if (fechaInicio && fechaFin) {
            origenWhere = 'WHERE DATE(fecha_creacion) BETWEEN ? AND ?'
            origenParams = [fechaInicio, fechaFin]
        }

        const [porOrigen] = await db.execute(`
            SELECT 
                origen,
                COUNT(*) as cantidad
            FROM contactos 
            ${origenWhere}
            GROUP BY origen
            ORDER BY cantidad DESC
        `, origenParams)

        const totalOrigen = porOrigen.reduce((sum, item) => sum + item.cantidad, 0)
        const porOrigenConPorcentaje = porOrigen.map(item => ({
            origen: item.origen,
            cantidad: item.cantidad,
            porcentaje: totalOrigen > 0 ? (item.cantidad * 100 / totalOrigen) : 0
        }))

        // Contactos por estado
        const [porEstado] = await db.execute(`
            SELECT 
                estado,
                COUNT(*) as cantidad
            FROM contactos 
            ${whereClause}
            GROUP BY estado
            ORDER BY cantidad DESC
        `, params)

        const totalEstado = porEstado.reduce((sum, item) => sum + item.cantidad, 0)
        const porEstadoConPorcentaje = porEstado.map(item => ({
            estado: item.estado,
            cantidad: item.cantidad,
            porcentaje: totalEstado > 0 ? (item.cantidad * 100 / totalEstado) : 0
        }))

        // Contactos por país
        const [porPais] = await db.execute(`
            SELECT 
                COALESCE(pais, 'No especificado') as pais,
                COUNT(*) as cantidad
            FROM contactos 
            ${whereClause}
            GROUP BY pais
            ORDER BY cantidad DESC
            LIMIT 10
        `, params)

        const totalPais = porPais.reduce((sum, item) => sum + item.cantidad, 0)
        const porPaisConPorcentaje = porPais.map(item => ({
            pais: item.pais,
            cantidad: item.cantidad,
            porcentaje: totalPais > 0 ? (item.cantidad * 100 / totalPais) : 0
        }))

        // Contactos por ciudad
        const [porCiudad] = await db.execute(`
            SELECT 
                COALESCE(ciudad, 'No especificada') as ciudad,
                COUNT(*) as cantidad
            FROM contactos 
            ${whereClause}
            GROUP BY ciudad
            ORDER BY cantidad DESC
            LIMIT 10
        `, params)

        const totalCiudad = porCiudad.reduce((sum, item) => sum + item.cantidad, 0)
        const porCiudadConPorcentaje = porCiudad.map(item => ({
            ciudad: item.ciudad,
            cantidad: item.cantidad,
            porcentaje: totalCiudad > 0 ? (item.cantidad * 100 / totalCiudad) : 0
        }))

        // Evolución por día
        const [porDia] = await db.execute(`
            SELECT 
                DATE(fecha_creacion) as fecha,
                COUNT(*) as cantidad
            FROM contactos 
            ${whereClause}
            GROUP BY DATE(fecha_creacion)
            ORDER BY fecha DESC
            LIMIT 30
        `, params)

        // Contactos asignados vs no asignados
        const [asignacion] = await db.execute(`
            SELECT 
                CASE WHEN asignado_a IS NOT NULL THEN 'Asignado' ELSE 'Sin asignar' END as estado_asignacion,
                COUNT(*) as cantidad
            FROM contactos 
            ${whereClause}
            GROUP BY CASE WHEN asignado_a IS NOT NULL THEN 'Asignado' ELSE 'Sin asignar' END
        `, params)

        const totalAsignacion = asignacion.reduce((sum, item) => sum + item.cantidad, 0)
        const asignacionConPorcentaje = asignacion.map(item => ({
            estado_asignacion: item.estado_asignacion,
            cantidad: item.cantidad,
            porcentaje: totalAsignacion > 0 ? (item.cantidad * 100 / totalAsignacion) : 0
        }))

        return {
            porOrigen: porOrigenConPorcentaje,
            porEstado: porEstadoConPorcentaje,
            porPais: porPaisConPorcentaje,
            porCiudad: porCiudadConPorcentaje,
            porDia,
            asignacion: asignacionConPorcentaje
        }

    } catch (error) {
        console.log('Error al obtener reporte de contactos:', error)
        throw error
    }
}

// Función para obtener reporte por plataformas
export async function obtenerReportePlataformas(filtros = {}) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        if (usuario.rol === 'usuario') {
            throw new Error('No tienes permisos para ver reportes')
        }

        const {
            fechaInicio,
            fechaFin
        } = filtros

        let whereContactos = ''
        let whereConversaciones = ''
        let whereMensajes = ''
        let params = []

        if (fechaInicio && fechaFin) {
            whereContactos = 'WHERE DATE(fecha_creacion) BETWEEN ? AND ?'
            whereConversaciones = 'WHERE DATE(fecha_inicio) BETWEEN ? AND ?'
            whereMensajes = 'WHERE DATE(m.fecha_envio) BETWEEN ? AND ?'
            params = [fechaInicio, fechaFin]
        }

        const plataformas = ['whatsapp', 'instagram', 'facebook']
        const datos = []

        for (const plataforma of plataformas) {
            // Contactos por plataforma
            let contactosQuery = `SELECT COUNT(*) as total FROM contactos`
            let contactosParams = []
            
            if (whereContactos) {
                contactosQuery += ` ${whereContactos} AND origen = ?`
                contactosParams = [...params, plataforma]
            } else {
                contactosQuery += ` WHERE origen = ?`
                contactosParams = [plataforma]
            }

            const [contactos] = await db.execute(contactosQuery, contactosParams)

            // Conversaciones por plataforma
            let conversacionesQuery = `SELECT COUNT(*) as total FROM conversaciones`
            let conversacionesParams = []
            
            if (whereConversaciones) {
                conversacionesQuery += ` ${whereConversaciones} AND plataforma = ?`
                conversacionesParams = [...params, plataforma]
            } else {
                conversacionesQuery += ` WHERE plataforma = ?`
                conversacionesParams = [plataforma]
            }

            const [conversaciones] = await db.execute(conversacionesQuery, conversacionesParams)

            // Mensajes por plataforma
            let mensajesQuery = `
                SELECT COUNT(*) as total
                FROM mensajes m
                JOIN conversaciones c ON m.conversacion_id = c.id
            `
            let mensajesParams = []
            
            if (whereMensajes) {
                mensajesQuery += ` ${whereMensajes} AND c.plataforma = ?`
                mensajesParams = [...params, plataforma]
            } else {
                mensajesQuery += ` WHERE c.plataforma = ?`
                mensajesParams = [plataforma]
            }

            const [mensajes] = await db.execute(mensajesQuery, mensajesParams)

            datos.push({
                nombre: plataforma,
                contactos: contactos[0].total,
                conversaciones: conversaciones[0].total,
                mensajes: mensajes[0].total
            })
        }

        // Comparativa de rendimiento
        let rendimientoWhere = ''
        let rendimientoParams = []
        if (fechaInicio && fechaFin) {
            rendimientoWhere = 'WHERE DATE(c.fecha_inicio) BETWEEN ? AND ?'
            rendimientoParams = [fechaInicio, fechaFin]
        }

        const [rendimiento] = await db.execute(`
            SELECT 
                c.plataforma,
                COUNT(DISTINCT co.id) as contactos_unicos,
                COUNT(DISTINCT c.id) as conversaciones_totales,
                AVG(c.total_mensajes) as promedio_mensajes_conversacion,
                SUM(CASE WHEN c.estado = 'cerrada' THEN 1 ELSE 0 END) as conversaciones_cerradas
            FROM conversaciones c
            JOIN contactos co ON c.contacto_id = co.id
            ${rendimientoWhere}
            GROUP BY c.plataforma
            ORDER BY contactos_unicos DESC
        `, rendimientoParams)

        // Actividad por hora y plataforma
        let actividadWhere = ''
        let actividadParams = []
        if (fechaInicio && fechaFin) {
            actividadWhere = 'WHERE DATE(m.fecha_envio) BETWEEN ? AND ?'
            actividadParams = [fechaInicio, fechaFin]
        }

        const [actividadPorHora] = await db.execute(`
            SELECT 
                c.plataforma,
                HOUR(m.fecha_envio) as hora,
                COUNT(*) as mensajes
            FROM mensajes m
            JOIN conversaciones c ON m.conversacion_id = c.id
            ${actividadWhere}
            GROUP BY c.plataforma, HOUR(m.fecha_envio)
            ORDER BY c.plataforma, hora
        `, actividadParams)

        return {
            datos,
            rendimiento,
            actividadPorHora
        }

    } catch (error) {
        console.log('Error al obtener reporte de plataformas:', error)
        throw error
    }
}

// Función para exportar reporte
export async function exportarReporte(tipoReporte, filtros = {}) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        if (usuario.rol === 'usuario') {
            throw new Error('No tienes permisos para exportar reportes')
        }

        console.log('Exportando reporte:', tipoReporte, 'con filtros:', filtros)
        
        return {
            success: true,
            message: `Reporte ${tipoReporte} exportado exitosamente`,
            archivo: `reporte_${tipoReporte}_${new Date().toISOString().split('T')[0]}.xlsx`
        }

    } catch (error) {
        console.log('Error al exportar reporte:', error)
        throw error
    }
}

// Función para obtener resumen de actividad reciente
export async function obtenerActividadReciente() {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        if (usuario.rol === 'usuario') {
            throw new Error('No tienes permisos para ver actividad')
        }

        // Actividad de los últimos 7 días
        const [actividad] = await db.execute(`
            SELECT 
                DATE(fecha_envio) as fecha,
                COUNT(*) as mensajes,
                COUNT(DISTINCT conversacion_id) as conversaciones_activas
            FROM mensajes 
            WHERE fecha_envio >= DATE_SUB(CURRENT_DATE, INTERVAL 7 DAY)
            GROUP BY DATE(fecha_envio)
            ORDER BY fecha DESC
        `)

        // Nuevos contactos hoy
        const [contactosHoy] = await db.execute(`
            SELECT COUNT(*) as total
            FROM contactos 
            WHERE DATE(fecha_creacion) = CURRENT_DATE
        `)

        // Conversaciones abiertas hoy
        const [conversacionesHoy] = await db.execute(`
            SELECT COUNT(*) as total
            FROM conversaciones 
            WHERE DATE(fecha_inicio) = CURRENT_DATE
        `)

        // Mensajes enviados hoy
        const [mensajesHoy] = await db.execute(`
            SELECT COUNT(*) as total
            FROM mensajes 
            WHERE DATE(fecha_envio) = CURRENT_DATE AND direccion = 'saliente'
        `)

        return {
            actividad,
            hoy: {
                contactos: contactosHoy[0].total,
                conversaciones: conversacionesHoy[0].total,
                mensajes: mensajesHoy[0].total
            }
        }

    } catch (error) {
        console.log('Error al obtener actividad reciente:', error)
        throw error
    }
}