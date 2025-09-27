"use server"
import db from "@/_DB/db"
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

const JWT_SECRET = process.env.JWT_SECRET || 'crm_whatsapp_facebook_2024'

// Función para iniciar sesión
export async function iniciarSesion(correo, contrasena) {
    try {
        if (!correo || !contrasena) {
            throw new Error('Correo y contraseña son requeridos')
        }

        // Validar formato de correo
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(correo)) {
            throw new Error('Formato de correo electrónico inválido')
        }

        // Buscar usuario por correo en la base de datos
        const [rows] = await db.execute(`
            SELECT 
                id, 
                correo, 
                contrasena_hash, 
                nombre, 
                apellidos,
                telefono,
                avatar_url,
                rol,
                activo,
                ultimo_acceso,
                fecha_registro
            FROM usuarios 
            WHERE correo = ?
        `, [correo.toLowerCase().trim()])

        if (rows.length === 0) {
            throw new Error('Credenciales incorrectas')
        }

        const usuario = rows[0]

        // Verificar si el usuario está activo
        if (!usuario.activo) {
            throw new Error('Usuario inactivo. Contacta al administrador')
        }

        // Verificar contraseña usando bcrypt
        const contrasenaValida = await bcrypt.compare(contrasena, usuario.contrasena_hash)
        
        if (!contrasenaValida) {
            throw new Error('Credenciales incorrectas')
        }
        // Crear token JWT con datos del usuario
        const tokenPayload = {
            userId: usuario.id,
            correo: usuario.correo,
            rol: usuario.rol,
            nombre: usuario.nombre,
            apellidos: usuario.apellidos
        }

        const token = jwt.sign(
            tokenPayload,
            JWT_SECRET,
            { 
                expiresIn: '7d',
                issuer: 'crm-social',
                audience: 'crm-users'
            }
        )

        // Guardar token en cookies httpOnly
        const cookieStore = await cookies()
        cookieStore.set('auth-token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60, // 7 días en segundos
            path: '/'
        })

        // Actualizar último acceso del usuario
        await db.execute(`
            UPDATE usuarios 
            SET ultimo_acceso = CURRENT_TIMESTAMP 
            WHERE id = ?
        `, [usuario.id])

        // Registrar el inicio de sesión en logs si existe tabla de logs
        try {
            await db.execute(`
                INSERT INTO api_calls_log (
                    plataforma, endpoint, metodo, response_code, 
                    usuario_id, fecha_llamada
                ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `, ['sistema', 'login', 'POST', 200, usuario.id])
        } catch (error) {
            console.log('No se pudo registrar en logs:', error.message)
        }

        return {
            success: true,
            message: 'Inicio de sesión exitoso',
            usuario: {
                id: usuario.id,
                correo: usuario.correo,
                nombre: usuario.nombre,
                apellidos: usuario.apellidos,
                nombreCompleto: `${usuario.nombre} ${usuario.apellidos}`,
                rol: usuario.rol,
                avatarUrl: usuario.avatar_url,
                ultimoAcceso: usuario.ultimo_acceso
            }
        }

    } catch (error) {
        console.log('Error en inicio de sesión:', error.message)
        
        // Registrar intento fallido si es posible
        try {
            await db.execute(`
                INSERT INTO api_calls_log (
                    plataforma, endpoint, metodo, response_code, 
                    fecha_llamada
                ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            `, ['sistema', 'login', 'POST', 401])
        } catch (logError) {
            console.log('No se pudo registrar error en logs')
        }

        throw error
    }
}

// Función para obtener usuario actual desde token
export async function obtenerUsuarioActual() {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get('auth-token')
        
        if (!token || !token.value) {
            return null
        }

        // Verificar y decodificar el token JWT
        let decoded
        try {
            decoded = jwt.verify(token.value, JWT_SECRET)
        } catch (error) {
            // Token inválido o expirado
            console.log('Token inválido:', error.message)
            await cerrarSesion() // Limpiar cookies
            return null
        }

        const userId = decoded.userId

        // Consultar datos actualizados del usuario en la base de datos
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
            // Usuario no existe o está inactivo
            await cerrarSesion()
            return null
        }

        const usuario = rows[0]

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
        console.log('Error al obtener usuario actual:', error.message)
        return null
    }
}

// Función para cerrar sesión
export async function cerrarSesion() {
    try {
        const cookieStore = await cookies()
        
        // Eliminar el token de autenticación
        cookieStore.delete('auth-token')
        
        // Limpiar cualquier otra cookie relacionada
        cookieStore.delete('user-preferences')
        
        return { 
            success: true, 
            message: 'Sesión cerrada correctamente' 
        }
        
    } catch (error) {
        console.log('Error al cerrar sesión:', error.message)
        throw new Error('Error al cerrar sesión')
    }
}

// Función para validar si el usuario está autenticado
export async function validarAutenticacion() {
    const usuario = await obtenerUsuarioActual()
    return !!usuario
}

// Función para verificar roles específicos
export async function verificarRol(rolesPermitidos) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            return false
        }
        
        if (typeof rolesPermitidos === 'string') {
            return usuario.rol === rolesPermitidos
        }
        
        if (Array.isArray(rolesPermitidos)) {
            return rolesPermitidos.includes(usuario.rol)
        }
        
        return false
    } catch (error) {
        console.log('Error al verificar rol:', error.message)
        return false
    }
}

// Función para obtener estadísticas básicas de login
export async function obtenerEstadisticasLogin() {
    try {
        // Total de usuarios activos
        const [usuariosActivos] = await db.execute(`
            SELECT COUNT(*) as total 
            FROM usuarios 
            WHERE activo = 1
        `)

        // Usuarios por rol
        const [usuariosPorRol] = await db.execute(`
            SELECT 
                rol,
                COUNT(*) as total
            FROM usuarios 
            WHERE activo = 1
            GROUP BY rol
        `)

        // Inicios de sesión hoy
        const [loginHoy] = await db.execute(`
            SELECT COUNT(*) as total
            FROM usuarios 
            WHERE DATE(ultimo_acceso) = CURDATE()
            AND activo = 1
        `)

        // Último acceso general
        const [ultimoAcceso] = await db.execute(`
            SELECT MAX(ultimo_acceso) as ultimo
            FROM usuarios 
            WHERE activo = 1
        `)

        return {
            usuariosActivos: usuariosActivos[0]?.total || 0,
            usuariosPorRol: usuariosPorRol || [],
            loginHoy: loginHoy[0]?.total || 0,
            ultimoAcceso: ultimoAcceso[0]?.ultimo || null
        }

    } catch (error) {
        console.log('Error al obtener estadísticas de login:', error.message)
        return {
            usuariosActivos: 0,
            usuariosPorRol: [],
            loginHoy: 0,
            ultimoAcceso: null
        }
    }
}

// Función para validar token sin decodificar datos sensibles
export async function validarToken(token) {
    try {
        if (!token) {
            return { valid: false, reason: 'Token no proporcionado' }
        }

        const decoded = jwt.verify(token, JWT_SECRET)
        
        // Verificar que el usuario aún existe y está activo
        const [rows] = await db.execute(`
            SELECT id, activo FROM usuarios WHERE id = ?
        `, [decoded.userId])

        if (rows.length === 0) {
            return { valid: false, reason: 'Usuario no encontrado' }
        }

        if (!rows[0].activo) {
            return { valid: false, reason: 'Usuario inactivo' }
        }

        return { 
            valid: true, 
            userId: decoded.userId,
            rol: decoded.rol,
            expiry: decoded.exp
        }

    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return { valid: false, reason: 'Token expirado' }
        }
        if (error.name === 'JsonWebTokenError') {
            return { valid: false, reason: 'Token inválido' }
        }
        
        console.log('Error al validar token:', error.message)
        return { valid: false, reason: 'Error de validación' }
    }
}

// Función para refrescar token (renovar sesión)
export async function refrescarToken() {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        // Crear nuevo token con tiempo extendido
        const tokenPayload = {
            userId: usuario.id,
            correo: usuario.correo,
            rol: usuario.rol,
            nombre: usuario.nombre,
            apellidos: usuario.apellidos
        }

        const nuevoToken = jwt.sign(
            tokenPayload,
            JWT_SECRET,
            { 
                expiresIn: '7d',
                issuer: 'crm-social',
                audience: 'crm-users'
            }
        )

        // Actualizar cookie
        const cookieStore = await cookies()
        cookieStore.set('auth-token', nuevoToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60,
            path: '/'
        })

        return {
            success: true,
            message: 'Token renovado correctamente'
        }

    } catch (error) {
        console.log('Error al refrescar token:', error.message)
        throw error
    }
}

// Función para verificar integridad de la base de datos
export async function verificarIntegridadSistema() {
    try {
        // Verificar conexión a base de datos
        const [conexion] = await db.execute('SELECT 1 as test')
        if (!conexion || conexion[0].test !== 1) {
            throw new Error('Problema de conexión a base de datos')
        }

        // Verificar que existan las tablas principales
        const tablasRequeridas = [
            'usuarios',
            'contactos', 
            'conversaciones',
            'mensajes',
            'configuraciones_whatsapp',
            'configuraciones_instagram',
            'configuraciones_facebook'
        ]

        const verificaciones = await Promise.all(
            tablasRequeridas.map(async (tabla) => {
                try {
                    const [resultado] = await db.execute(`
                        SELECT COUNT(*) as existe 
                        FROM information_schema.tables 
                        WHERE table_schema = DATABASE() 
                        AND table_name = ?
                    `, [tabla])
                    return { tabla, existe: resultado[0].existe > 0 }
                } catch (error) {
                    return { tabla, existe: false, error: error.message }
                }
            })
        )

        const tablasIncorrectas = verificaciones.filter(v => !v.existe)
        
        if (tablasIncorrectas.length > 0) {
            console.log('Tablas faltantes:', tablasIncorrectas)
        }

        // Verificar que exista al menos un usuario administrador
        const [admins] = await db.execute(`
            SELECT COUNT(*) as total 
            FROM usuarios 
            WHERE rol IN ('admin', 'superadmin') 
            AND activo = 1
        `)

        return {
            conexionDB: true,
            tablas: verificaciones,
            tablasFaltantes: tablasIncorrectas.length,
            administradores: admins[0].total,
            sistemaOperativo: tablasIncorrectas.length === 0 && admins[0].total > 0
        }

    } catch (error) {
        console.log('Error al verificar integridad del sistema:', error.message)
        return {
            conexionDB: false,
            error: error.message,
            sistemaOperativo: false
        }
    }
}

// Función para limpiar sesiones expiradas (mantenimiento)
export async function limpiarSesionesExpiradas() {
    try {
        // Esta función podría implementarse si se guarda información de sesiones
        // Por ahora, los tokens JWT se auto-validan por expiración
        
        console.log('Limpieza de sesiones: No implementada (usando JWT)')
        
        return {
            success: true,
            message: 'Sesiones JWT se auto-gestionan por expiración'
        }

    } catch (error) {
        console.log('Error en limpieza de sesiones:', error.message)
        throw error
    }
}

// Función para obtener información del sistema para el dashboard de admin
export async function obtenerInfoSistema() {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario || !['admin', 'superadmin'].includes(usuario.rol)) {
            throw new Error('Sin permisos para acceder a información del sistema')
        }

        const [
            estadisticasLogin,
            integridadSistema
        ] = await Promise.all([
            obtenerEstadisticasLogin(),
            verificarIntegridadSistema()
        ])

        return {
            estadisticasLogin,
            integridadSistema,
            servidor: {
                nodeEnv: process.env.NODE_ENV || 'development',
                timestamp: new Date().toISOString()
            }
        }

    } catch (error) {
        console.log('Error al obtener información del sistema:', error.message)
        throw error
    }
}