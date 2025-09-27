"use server"
import db from "@/_DB/db"
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

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

// Función para actualizar perfil del usuario
export async function actualizarPerfil(datosUsuario) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        const {
            nombre,
            apellidos,
            correo,
            telefono
        } = datosUsuario

        // Validar datos requeridos
        if (!nombre || !nombre.trim()) {
            throw new Error('El nombre es requerido')
        }

        if (!apellidos || !apellidos.trim()) {
            throw new Error('Los apellidos son requeridos')
        }

        if (!correo || !correo.trim()) {
            throw new Error('El correo es requerido')
        }

        // Verificar que el correo no esté en uso por otro usuario
        const [existeCorreo] = await db.execute(`
            SELECT id FROM usuarios WHERE correo = ? AND id != ?
        `, [correo.trim().toLowerCase(), usuario.id])

        if (existeCorreo.length > 0) {
            throw new Error('Este correo electrónico ya está en uso por otro usuario')
        }

        // Actualizar los datos del usuario
        await db.execute(`
            UPDATE usuarios SET
                nombre = ?,
                apellidos = ?,
                correo = ?,
                telefono = ?
            WHERE id = ?
        `, [
            nombre.trim(),
            apellidos.trim(),
            correo.trim().toLowerCase(),
            telefono?.trim() || null,
            usuario.id
        ])

        return {
            success: true,
            message: 'Perfil actualizado exitosamente'
        }

    } catch (error) {
        console.log('Error al actualizar perfil:', error)
        throw error
    }
}

// Función para cambiar contraseña
export async function cambiarContrasena(contrasenaActual, contrasenaNueva) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        if (!contrasenaActual || !contrasenaNueva) {
            throw new Error('Ambas contraseñas son requeridas')
        }

        if (contrasenaNueva.length < 6) {
            throw new Error('La nueva contraseña debe tener al menos 6 caracteres')
        }

        // Obtener la contraseña actual de la base de datos
        const [usuarioData] = await db.execute(`
            SELECT contrasena_hash FROM usuarios WHERE id = ?
        `, [usuario.id])

        if (usuarioData.length === 0) {
            throw new Error('Usuario no encontrado')
        }

        // Verificar la contraseña actual
        const esContrasenaValida = await bcrypt.compare(contrasenaActual, usuarioData[0].contrasena_hash)
        if (!esContrasenaValida) {
            throw new Error('La contraseña actual es incorrecta')
        }

        // Hashear la nueva contraseña
        const saltRounds = 12
        const hashedPassword = await bcrypt.hash(contrasenaNueva, saltRounds)

        // Actualizar la contraseña en la base de datos
        await db.execute(`
            UPDATE usuarios SET contrasena_hash = ? WHERE id = ?
        `, [hashedPassword, usuario.id])

        return {
            success: true,
            message: 'Contraseña cambiada exitosamente'
        }

    } catch (error) {
        console.log('Error al cambiar contraseña:', error)
        throw error
    }
}

// Función para subir avatar
export async function subirAvatar(formData) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        // En un entorno real, aquí subirías el archivo a un servicio de almacenamiento
        // como AWS S3, Cloudinary, etc. Por ahora, simularemos el proceso

        const archivo = formData.get('avatar')
        if (!archivo) {
            throw new Error('No se proporcionó ningún archivo')
        }

        // Validar tipo de archivo
        const tiposPermitidos = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
        if (!tiposPermitidos.includes(archivo.type)) {
            throw new Error('Formato de archivo no válido. Solo se permiten JPEG, PNG y WebP')
        }

        // Validar tamaño (5MB máximo)
        const tamanoMaximo = 5 * 1024 * 1024
        if (archivo.size > tamanoMaximo) {
            throw new Error('El archivo es demasiado grande. Máximo 5MB')
        }

        // Simular la URL del avatar subido
        // En producción, aquí tendrías la URL real del archivo subido
        const avatarUrl = `/uploads/avatars/usuario_${usuario.id}_${Date.now()}.${archivo.type.split('/')[1]}`

        // Actualizar la URL del avatar en la base de datos
        await db.execute(`
            UPDATE usuarios SET avatar_url = ? WHERE id = ?
        `, [avatarUrl, usuario.id])

        return {
            success: true,
            message: 'Avatar subido exitosamente',
            avatarUrl: avatarUrl
        }

    } catch (error) {
        console.log('Error al subir avatar:', error)
        throw error
    }
}

// Función para eliminar avatar
export async function eliminarAvatar() {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        // En un entorno real, aquí eliminarías el archivo del servicio de almacenamiento

        // Actualizar la base de datos para eliminar la URL del avatar
        await db.execute(`
            UPDATE usuarios SET avatar_url = NULL WHERE id = ?
        `, [usuario.id])

        return {
            success: true,
            message: 'Avatar eliminado exitosamente'
        }

    } catch (error) {
        console.log('Error al eliminar avatar:', error)
        throw error
    }
}

// Función para cerrar sesión
export async function cerrarSesion() {
    try {
        const cookieStore = await cookies()
        
        // Eliminar el token de autenticación
        cookieStore.delete('auth-token')
        
        return { 
            success: true, 
            message: 'Sesión cerrada correctamente' 
        }
        
    } catch (error) {
        console.log('Error al cerrar sesión:', error)
        throw new Error('Error al cerrar sesión')
    }
}

// Función para obtener estadísticas del usuario
export async function obtenerEstadisticasUsuario() {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        // Conversaciones asignadas al usuario
        const [conversacionesAsignadas] = await db.execute(`
            SELECT COUNT(*) as total
            FROM conversaciones 
            WHERE asignada_a = ?
        `, [usuario.id])

        // Contactos asignados al usuario
        const [contactosAsignados] = await db.execute(`
            SELECT COUNT(*) as total
            FROM contactos 
            WHERE asignado_a = ?
        `, [usuario.id])

        // Mensajes enviados por el usuario en los últimos 30 días
        const [mensajesEnviados] = await db.execute(`
            SELECT COUNT(*) as total
            FROM mensajes 
            WHERE enviado_por = ? 
            AND fecha_envio >= DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY)
        `, [usuario.id])

        // Conversaciones cerradas por el usuario en los últimos 30 días
        const [conversacionesCerradas] = await db.execute(`
            SELECT COUNT(*) as total
            FROM conversaciones 
            WHERE asignada_a = ? 
            AND estado = 'cerrada'
            AND fecha_cierre >= DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY)
        `, [usuario.id])

        return {
            conversacionesAsignadas: conversacionesAsignadas[0].total,
            contactosAsignados: contactosAsignados[0].total,
            mensajesEnviados: mensajesEnviados[0].total,
            conversacionesCerradas: conversacionesCerradas[0].total
        }

    } catch (error) {
        console.log('Error al obtener estadísticas del usuario:', error)
        throw error
    }
}

// Función para actualizar configuraciones de notificaciones
export async function actualizarNotificaciones(configuraciones) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        const {
            notificacionesEmail = true,
            notificacionesMensajes = true,
            notificacionesConversaciones = true,
            notificacionesReportes = false
        } = configuraciones

        // En una aplicación real, tendrías una tabla de configuraciones
        // Por ahora, simularemos que se guardaron correctamente
        console.log('Configuraciones de notificaciones actualizadas:', {
            usuarioId: usuario.id,
            notificacionesEmail,
            notificacionesMensajes,
            notificacionesConversaciones,
            notificacionesReportes
        })

        return {
            success: true,
            message: 'Configuraciones de notificaciones actualizadas'
        }

    } catch (error) {
        console.log('Error al actualizar notificaciones:', error)
        throw error
    }
}

// Función para verificar la fuerza de la contraseña
export async function verificarContrasena(contrasena) {
    try {
        if (!contrasena) {
            return {
                esSegura: false,
                puntuacion: 0,
                sugerencias: ['La contraseña es requerida']
            }
        }

        let puntuacion = 0
        const sugerencias = []

        // Verificar longitud
        if (contrasena.length >= 8) {
            puntuacion += 25
        } else {
            sugerencias.push('Usa al menos 8 caracteres')
        }

        // Verificar mayúsculas
        if (/[A-Z]/.test(contrasena)) {
            puntuacion += 25
        } else {
            sugerencias.push('Incluye al menos una letra mayúscula')
        }

        // Verificar minúsculas
        if (/[a-z]/.test(contrasena)) {
            puntuacion += 25
        } else {
            sugerencias.push('Incluye al menos una letra minúscula')
        }

        // Verificar números
        if (/\d/.test(contrasena)) {
            puntuacion += 15
        } else {
            sugerencias.push('Incluye al menos un número')
        }

        // Verificar caracteres especiales
        if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(contrasena)) {
            puntuacion += 10
        } else {
            sugerencias.push('Incluye al menos un carácter especial')
        }

        return {
            esSegura: puntuacion >= 75,
            puntuacion,
            sugerencias
        }

    } catch (error) {
        console.log('Error al verificar contraseña:', error)
        throw error
    }
}

// Función para obtener actividad reciente del usuario
export async function obtenerActividadReciente() {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        // Últimos mensajes enviados
        const [ultimosMensajes] = await db.execute(`
            SELECT 
                m.contenido,
                m.fecha_envio,
                c.plataforma,
                co.nombre as contacto_nombre
            FROM mensajes m
            JOIN conversaciones c ON m.conversacion_id = c.id
            JOIN contactos co ON c.contacto_id = co.id
            WHERE m.enviado_por = ? AND m.direccion = 'saliente'
            ORDER BY m.fecha_envio DESC
            LIMIT 5
        `, [usuario.id])

        // Últimas conversaciones asignadas
        const [ultimasConversaciones] = await db.execute(`
            SELECT 
                c.id,
                c.estado,
                c.fecha_inicio,
                c.plataforma,
                co.nombre as contacto_nombre
            FROM conversaciones c
            JOIN contactos co ON c.contacto_id = co.id
            WHERE c.asignada_a = ?
            ORDER BY c.fecha_ultima_actividad DESC
            LIMIT 5
        `, [usuario.id])

        // Actividad por día en los últimos 7 días
        const [actividadDiaria] = await db.execute(`
            SELECT 
                DATE(fecha_envio) as fecha,
                COUNT(*) as mensajes_enviados
            FROM mensajes 
            WHERE enviado_por = ? 
            AND fecha_envio >= DATE_SUB(CURRENT_DATE, INTERVAL 7 DAY)
            GROUP BY DATE(fecha_envio)
            ORDER BY fecha DESC
        `, [usuario.id])

        return {
            ultimosMensajes,
            ultimasConversaciones,
            actividadDiaria
        }

    } catch (error) {
        console.log('Error al obtener actividad reciente:', error)
        throw error
    }
}

// Función para validar datos del perfil antes de actualizar
export async function validarDatosPerfil(datos) {
    try {
        const errores = []

        // Validar nombre
        if (!datos.nombre || datos.nombre.trim().length < 2) {
            errores.push('El nombre debe tener al menos 2 caracteres')
        }

        // Validar apellidos
        if (!datos.apellidos || datos.apellidos.trim().length < 2) {
            errores.push('Los apellidos deben tener al menos 2 caracteres')
        }

        // Validar correo
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!datos.correo || !emailRegex.test(datos.correo)) {
            errores.push('El correo electrónico no es válido')
        }

        // Validar teléfono (opcional)
        if (datos.telefono) {
            const telefonoRegex = /^[\+]?[\d\s\-\(\)]{8,15}$/
            if (!telefonoRegex.test(datos.telefono)) {
                errores.push('El formato del teléfono no es válido')
            }
        }

        return {
            esValido: errores.length === 0,
            errores
        }

    } catch (error) {
        console.log('Error al validar datos del perfil:', error)
        throw error
    }
}

// Función para obtener preferencias del usuario
export async function obtenerPreferencias() {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        // En una aplicación real, tendrías una tabla de preferencias
        // Por ahora, retornamos preferencias por defecto
        return {
            tema: 'claro',
            idioma: 'es',
            zona_horaria: 'America/Mexico_City',
            notificaciones_email: true,
            notificaciones_push: true,
            notificaciones_sonido: true,
            auto_asignacion: false,
            mostrar_avatar: true,
            formato_fecha: 'DD/MM/YYYY',
            formato_hora: '24h'
        }

    } catch (error) {
        console.log('Error al obtener preferencias:', error)
        throw error
    }
}

// Función para actualizar preferencias del usuario
export async function actualizarPreferencias(preferencias) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        // En una aplicación real, actualizarías las preferencias en la base de datos
        console.log('Preferencias actualizadas para usuario:', usuario.id, preferencias)

        return {
            success: true,
            message: 'Preferencias actualizadas exitosamente'
        }

    } catch (error) {
        console.log('Error al actualizar preferencias:', error)
        throw error
    }
}

// Función para eliminar cuenta del usuario (solo para usuarios normales)
export async function eliminarCuenta(contrasenaConfirmacion) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        // Los administradores no pueden eliminar sus propias cuentas
        if (usuario.rol === 'admin' || usuario.rol === 'superadmin') {
            throw new Error('Los administradores no pueden eliminar sus propias cuentas')
        }

        if (!contrasenaConfirmacion) {
            throw new Error('La contraseña de confirmación es requerida')
        }

        // Verificar la contraseña
        const [usuarioData] = await db.execute(`
            SELECT contrasena_hash FROM usuarios WHERE id = ?
        `, [usuario.id])

        if (usuarioData.length === 0) {
            throw new Error('Usuario no encontrado')
        }

        const esContrasenaValida = await bcrypt.compare(contrasenaConfirmacion, usuarioData[0].contrasena_hash)
        if (!esContrasenaValida) {
            throw new Error('La contraseña es incorrecta')
        }

        // Verificar si el usuario tiene conversaciones o contactos asignados
        const [conversacionesAsignadas] = await db.execute(`
            SELECT COUNT(*) as total FROM conversaciones WHERE asignada_a = ?
        `, [usuario.id])

        const [contactosAsignados] = await db.execute(`
            SELECT COUNT(*) as total FROM contactos WHERE asignado_a = ?
        `, [usuario.id])

        if (conversacionesAsignadas[0].total > 0 || contactosAsignados[0].total > 0) {
            throw new Error('No puedes eliminar tu cuenta porque tienes conversaciones o contactos asignados')
        }

        // Desactivar la cuenta (mejor práctica que eliminar completamente)
        await db.execute(`
            UPDATE usuarios SET activo = 0 WHERE id = ?
        `, [usuario.id])

        // Cerrar sesión
        const cookieStore = await cookies()
        cookieStore.delete('auth-token')

        return {
            success: true,
            message: 'Cuenta eliminada exitosamente'
        }

    } catch (error) {
        console.log('Error al eliminar cuenta:', error)
        throw error
    }
}