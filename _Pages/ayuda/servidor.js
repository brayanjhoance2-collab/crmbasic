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

// Función para obtener información del sistema
export async function obtenerInformacionSistema() {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        // Obtener estadísticas del sistema
        const [totalUsuarios] = await db.execute(`
            SELECT COUNT(*) as total FROM usuarios WHERE activo = 1
        `)

        const [totalContactos] = await db.execute(`
            SELECT COUNT(*) as total FROM contactos
        `)

        const [totalConversaciones] = await db.execute(`
            SELECT COUNT(*) as total FROM conversaciones
        `)

        const [totalMensajes] = await db.execute(`
            SELECT COUNT(*) as total FROM mensajes
        `)

        return {
            nombre: 'CRM WhatsApp, Instagram & Facebook',
            version: '1.0.0',
            descripcion: 'Sistema de gestión de relaciones con clientes para múltiples plataformas de mensajería',
            ultimaActualizacion: '26 de Septiembre, 2025',
            totalUsuarios: totalUsuarios[0].total,
            totalContactos: totalContactos[0].total,
            totalConversaciones: totalConversaciones[0].total,
            totalMensajes: totalMensajes[0].total
        }

    } catch (error) {
        console.log('Error al obtener información del sistema:', error)
        throw error
    }
}

// Función para obtener contactos de soporte
export async function obtenerContactosSoporte() {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        // Obtener el primer superadmin creado
        const [superAdmin] = await db.execute(`
            SELECT 
                nombre,
                apellidos,
                correo,
                telefono
            FROM usuarios 
            WHERE rol = 'superadmin' AND activo = 1
            ORDER BY fecha_registro ASC
            LIMIT 1
        `)

        const contactos = []

        if (superAdmin.length > 0) {
            const admin = superAdmin[0]
            contactos.push({
                nombre: `${admin.nombre} ${admin.apellidos}`,
                rol: 'Super Administrador Principal',
                correo: admin.correo,
                telefono: admin.telefono,
                whatsapp: admin.telefono // Asumir que el teléfono es también WhatsApp
            })
        }

        // Agregar contacto de soporte técnico genérico
        contactos.push({
            nombre: 'Soporte Técnico',
            rol: 'Equipo de Desarrollo',
            correo: 'soporte@crm-sistema.com',
            telefono: '+52 55 1234 5678',
            whatsapp: '+525512345678'
        })

        return contactos

    } catch (error) {
        console.log('Error al obtener contactos de soporte:', error)
        throw error
    }
}

// Función para obtener información de licencia
export async function obtenerInformacionLicencia() {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        return {
            tipo: 'Licencia Empresarial',
            estado: 'Activa',
            fechaVencimiento: '26 de Septiembre, 2026',
            usuariosPermitidos: 'Ilimitados',
            plataformasIncluidas: ['WhatsApp', 'Instagram', 'Facebook'],
            soporte: '24/7'
        }

    } catch (error) {
        console.log('Error al obtener información de licencia:', error)
        throw error
    }
}

// Función para generar reporte de actividad del usuario
export async function obtenerActividadUsuario() {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        // Mensajes enviados por el usuario en los últimos 30 días
        const [mensajesEnviados] = await db.execute(`
            SELECT COUNT(*) as total
            FROM mensajes 
            WHERE enviado_por = ? 
            AND direccion = 'saliente'
            AND fecha_envio >= DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY)
        `, [usuario.id])

        // Conversaciones asignadas actualmente
        const [conversacionesAsignadas] = await db.execute(`
            SELECT COUNT(*) as total
            FROM conversaciones 
            WHERE asignada_a = ? 
            AND estado != 'cerrada'
        `, [usuario.id])

        // Contactos asignados
        const [contactosAsignados] = await db.execute(`
            SELECT COUNT(*) as total
            FROM contactos 
            WHERE asignado_a = ?
        `, [usuario.id])

        return {
            mensajesUltimos30Dias: mensajesEnviados[0].total,
            conversacionesActivas: conversacionesAsignadas[0].total,
            contactosAsignados: contactosAsignados[0].total
        }

    } catch (error) {
        console.log('Error al obtener actividad del usuario:', error)
        throw error
    }
}

// Función para obtener estado del sistema
export async function obtenerEstadoSistema() {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        // Solo admins y superadmins pueden ver el estado del sistema
        if (usuario.rol === 'usuario') {
            throw new Error('No tienes permisos para ver el estado del sistema')
        }

        // Verificar plataformas activas
        const [plataformasActivas] = await db.execute(`
            SELECT plataforma FROM configuraciones_activas
        `)

        // Obtener actividad reciente
        const [actividadReciente] = await db.execute(`
            SELECT 
                DATE(fecha_envio) as fecha,
                COUNT(*) as mensajes
            FROM mensajes 
            WHERE fecha_envio >= DATE_SUB(CURRENT_DATE, INTERVAL 7 DAY)
            GROUP BY DATE(fecha_envio)
            ORDER BY fecha DESC
        `)

        return {
            plataformasActivas: plataformasActivas.map(p => p.plataforma),
            actividadReciente,
            estadoGeneral: 'Operativo',
            ultimaVerificacion: new Date().toISOString()
        }

    } catch (error) {
        console.log('Error al obtener estado del sistema:', error)
        throw error
    }
}