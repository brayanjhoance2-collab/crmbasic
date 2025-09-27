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
        
        console.log('Token encontrado:', !!token)
        
        if (!token || !token.value) {
            console.log('No hay token de autenticación')
            return null
        }

        // Verificar y decodificar el token JWT
        let decoded
        try {
            decoded = jwt.verify(token.value, JWT_SECRET)
            console.log('Token decodificado exitosamente:', decoded.userId)
        } catch (jwtError) {
            console.log('Error al verificar token:', jwtError.message)
            // Token inválido, limpiarlo
            cookieStore.delete('auth-token')
            return null
        }

        const userId = decoded.userId

        // Consultar el usuario en la base de datos
        console.log('Consultando usuario con ID:', userId)
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

        console.log('Filas encontradas:', rows.length)

        if (rows.length === 0) {
            console.log('Usuario no encontrado o inactivo')
            // Usuario no existe o está inactivo, limpiar token
            cookieStore.delete('auth-token')
            return null
        }

        const usuario = rows[0]
        console.log('Usuario encontrado:', usuario.nombre, 'Rol:', usuario.rol)
        
        // Actualizar último acceso
        try {
            await db.execute(`
                UPDATE usuarios 
                SET ultimo_acceso = CURRENT_TIMESTAMP 
                WHERE id = ?
            `, [userId])
        } catch (updateError) {
            console.log('Error al actualizar último acceso:', updateError.message)
        }

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
        console.log('Error general al obtener usuario actual:', error.message)
        
        // En caso de error, limpiar token por seguridad
        try {
            const cookieStore = await cookies()
            cookieStore.delete('auth-token')
        } catch (cookieError) {
            console.log('Error al limpiar cookie:', cookieError.message)
        }
        
        return null
    }
}

// Función para cerrar sesión
export async function cerrarSesion() {
    try {
        console.log('Cerrando sesión...')
        const cookieStore = await cookies()
        
        // Eliminar el token de autenticación
        cookieStore.delete('auth-token')
        
        console.log('Sesión cerrada exitosamente')
        return { success: true, message: 'Sesión cerrada correctamente' }
        
    } catch (error) {
        console.log('Error al cerrar sesión:', error.message)
        return { success: false, message: 'Error al cerrar sesión: ' + error.message }
    }
}

// Función para validar si el usuario está autenticado
export async function validarAutenticacion() {
    const usuario = await obtenerUsuarioActual()
    const isAuthenticated = !!usuario
    console.log('Usuario autenticado:', isAuthenticated)
    return isAuthenticated
}

// Función para verificar roles específicos
export async function verificarRol(rolesPermitidos) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            console.log('No hay usuario para verificar rol')
            return false
        }
        
        if (typeof rolesPermitidos === 'string') {
            const tieneRol = usuario.rol === rolesPermitidos
            console.log(`Verificando rol ${rolesPermitidos}:`, tieneRol)
            return tieneRol
        }
        
        if (Array.isArray(rolesPermitidos)) {
            const tieneRol = rolesPermitidos.includes(usuario.rol)
            console.log(`Verificando roles ${rolesPermitidos.join(', ')}:`, tieneRol)
            return tieneRol
        }
        
        return false
    } catch (error) {
        console.log('Error al verificar rol:', error.message)
        return false
    }
}

// Función de prueba para verificar conexión a base de datos
export async function verificarConexionDB() {
    try {
        console.log('Verificando conexión a base de datos...')
        const [result] = await db.execute('SELECT 1 as test')
        console.log('Conexión a BD exitosa:', result[0].test === 1)
        return { success: true, connected: result[0].test === 1 }
    } catch (error) {
        console.log('Error de conexión a BD:', error.message)
        return { success: false, error: error.message }
    }
}

// Función de prueba para verificar tabla usuarios
export async function verificarTablaUsuarios() {
    try {
        console.log('Verificando tabla usuarios...')
        const [usuarios] = await db.execute(`
            SELECT id, correo, nombre, rol, activo 
            FROM usuarios 
            LIMIT 5
        `)
        console.log('Usuarios encontrados:', usuarios.length)
        usuarios.forEach(u => {
            console.log(`- ID: ${u.id}, Email: ${u.correo}, Nombre: ${u.nombre}, Rol: ${u.rol}, Activo: ${u.activo}`)
        })
        return { success: true, usuarios: usuarios.length }
    } catch (error) {
        console.log('Error al consultar tabla usuarios:', error.message)
        return { success: false, error: error.message }
    }
}

// Función para verificar si existe el usuario admin
export async function verificarUsuarioAdmin() {
    try {
        console.log('Verificando usuario admin...')
        const [admins] = await db.execute(`
            SELECT id, correo, nombre, rol, activo 
            FROM usuarios 
            WHERE correo = 'admin@gmail.com'
        `)
        console.log('Usuario admin encontrado:', admins.length > 0)
        if (admins.length > 0) {
            const admin = admins[0]
            console.log(`Admin - ID: ${admin.id}, Email: ${admin.correo}, Rol: ${admin.rol}, Activo: ${admin.activo}`)
        }
        return { success: true, exists: admins.length > 0, admin: admins[0] || null }
    } catch (error) {
        console.log('Error al verificar usuario admin:', error.message)
        return { success: false, error: error.message }
    }
}

// Función para obtener conteo de notificaciones
export async function obtenerConteoNotificaciones() {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            return 0
        }

        // Contar mensajes no leídos (simulando conversaciones activas)
        const [conversacionesActivas] = await db.execute(`
            SELECT COUNT(*) as total 
            FROM conversaciones 
            WHERE estado IN ('abierta', 'en_proceso') 
            AND (asignada_a = ? OR asignada_a IS NULL)
        `, [usuario.id])

        const [mensajesRecientes] = await db.execute(`
            SELECT COUNT(*) as total 
            FROM mensajes m
            INNER JOIN conversaciones c ON m.conversacion_id = c.id
            WHERE m.direccion = 'entrante' 
            AND m.fecha_envio >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
            AND (c.asignada_a = ? OR c.asignada_a IS NULL)
        `, [usuario.id])

        const totalNotificaciones = conversacionesActivas[0].total + mensajesRecientes[0].total

        console.log(`Notificaciones para ${usuario.nombre}: ${totalNotificaciones}`)
        return Math.min(totalNotificaciones, 99) // Máximo 99 para UI

    } catch (error) {
        console.log('Error al obtener conteo de notificaciones:', error.message)
        return 0
    }
}

// Función para debugging completo
export async function debugSistema() {
    console.log('=== INICIO DEBUG SISTEMA ===')
    
    const resultados = {
        conexionDB: await verificarConexionDB(),
        tablaUsuarios: await verificarTablaUsuarios(),
        usuarioAdmin: await verificarUsuarioAdmin(),
        usuarioActual: await obtenerUsuarioActual(),
        notificaciones: await obtenerConteoNotificaciones(),
        timestamp: new Date().toISOString()
    }
    
    console.log('=== RESULTADOS DEBUG ===')
    console.log(JSON.stringify(resultados, null, 2))
    console.log('=== FIN DEBUG SISTEMA ===')
    
    return resultados
}