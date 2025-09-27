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

// Función para obtener usuarios con filtros y paginación
export async function obtenerUsuarios(filtros = {}) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        // Solo admins y superadmins pueden ver usuarios
        if (usuario.rol === 'usuario') {
            throw new Error('No tienes permisos para ver usuarios')
        }

        const {
            busqueda = '',
            rol = 'todos',
            estado = 'todos',
            pagina = 1,
            limite = 20
        } = filtros

        // Convertir a números enteros y validar
        const limiteFinal = Math.max(1, parseInt(limite) || 20)
        const paginaFinal = Math.max(1, parseInt(pagina) || 1)
        const offsetFinal = Math.max(0, (paginaFinal - 1) * limiteFinal)

        let whereConditions = []
        let params = []

        // Si no es superadmin, no puede ver otros superadmins
        if (usuario.rol !== 'superadmin') {
            whereConditions.push('rol != ?')
            params.push('superadmin')
        }

        // Filtro de búsqueda
        if (busqueda && busqueda.trim()) {
            whereConditions.push(`(
                nombre LIKE ? OR 
                apellidos LIKE ? OR 
                correo LIKE ? OR 
                telefono LIKE ?
            )`)
            const searchTerm = `%${busqueda.trim()}%`
            params.push(searchTerm, searchTerm, searchTerm, searchTerm)
        }

        // Filtro por rol
        if (rol && rol !== 'todos') {
            whereConditions.push('rol = ?')
            params.push(rol)
        }

        // Filtro por estado
        if (estado === 'activo') {
            whereConditions.push('activo = 1')
        } else if (estado === 'inactivo') {
            whereConditions.push('activo = 0')
        }

        const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : ''

        // SOLUCIÓN RADICAL: Construir query completa sin prepared statements para LIMIT/OFFSET
        const queryUsuarios = `
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
            ${whereClause}
            ORDER BY fecha_registro DESC
            LIMIT ${limiteFinal} OFFSET ${offsetFinal}
        `

        console.log('Query usuarios final:', queryUsuarios)
        console.log('Params usuarios:', params)
        
        const [usuarios] = await db.execute(queryUsuarios, params)

        // Consulta para contar total de usuarios (sin LIMIT)
        const queryCount = `
            SELECT COUNT(*) as total
            FROM usuarios
            ${whereClause}
        `

        console.log('Query count:', queryCount)
        console.log('Params count:', params)

        const [countResult] = await db.execute(queryCount, params)
        const totalUsuarios = countResult[0].total

        const totalPaginas = Math.ceil(totalUsuarios / limiteFinal)

        return {
            usuarios,
            totalUsuarios,
            totalPaginas,
            paginaActual: paginaFinal
        }

    } catch (error) {
        console.log('Error al obtener usuarios:', error)
        throw error
    }
}

// Función para crear un nuevo usuario
export async function crearUsuario(datosUsuario) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        // Solo admins y superadmins pueden crear usuarios
        if (usuario.rol === 'usuario') {
            throw new Error('No tienes permisos para crear usuarios')
        }

        const {
            nombre,
            apellidos,
            correo,
            telefono,
            rol,
            contrasena
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

        if (!contrasena || contrasena.length < 6) {
            throw new Error('La contraseña debe tener al menos 6 caracteres')
        }

        // Solo superadmins pueden crear otros superadmins
        if (rol === 'superadmin' && usuario.rol !== 'superadmin') {
            throw new Error('Solo un Super Admin puede crear otro Super Admin')
        }

        // Verificar si ya existe un usuario con el mismo correo
        const [existeCorreo] = await db.execute(`
            SELECT id FROM usuarios WHERE correo = ?
        `, [correo.trim().toLowerCase()])

        if (existeCorreo.length > 0) {
            throw new Error('Ya existe un usuario con este correo electrónico')
        }

        // Hashear la contraseña
        const saltRounds = 12
        const hashedPassword = await bcrypt.hash(contrasena, saltRounds)

        // Insertar el nuevo usuario
        const [resultado] = await db.execute(`
            INSERT INTO usuarios (
                correo, contrasena_hash, nombre, apellidos, 
                telefono, rol, activo
            ) VALUES (?, ?, ?, ?, ?, ?, 1)
        `, [
            correo.trim().toLowerCase(),
            hashedPassword,
            nombre.trim(),
            apellidos.trim(),
            telefono?.trim() || null,
            rol || 'usuario'
        ])

        return {
            success: true,
            usuarioId: resultado.insertId,
            message: 'Usuario creado exitosamente'
        }

    } catch (error) {
        console.log('Error al crear usuario:', error)
        throw error
    }
}

// Función para actualizar un usuario existente
export async function actualizarUsuario(usuarioId, datosUsuario) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        // Solo admins y superadmins pueden actualizar usuarios
        if (usuario.rol === 'usuario') {
            throw new Error('No tienes permisos para actualizar usuarios')
        }

        const {
            nombre,
            apellidos,
            correo,
            telefono,
            rol
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

        // Verificar que el usuario existe
        const [usuarioExiste] = await db.execute(`
            SELECT id, rol FROM usuarios WHERE id = ?
        `, [usuarioId])

        if (usuarioExiste.length === 0) {
            throw new Error('Usuario no encontrado')
        }

        // Solo superadmins pueden actualizar otros superadmins
        if (usuarioExiste[0].rol === 'superadmin' && usuario.rol !== 'superadmin') {
            throw new Error('Solo un Super Admin puede actualizar otro Super Admin')
        }

        // Solo superadmins pueden asignar rol de superadmin
        if (rol === 'superadmin' && usuario.rol !== 'superadmin') {
            throw new Error('Solo un Super Admin puede asignar el rol de Super Admin')
        }

        // Verificar duplicados de correo (excluyendo el usuario actual)
        const [existeCorreo] = await db.execute(`
            SELECT id FROM usuarios WHERE correo = ? AND id != ?
        `, [correo.trim().toLowerCase(), usuarioId])

        if (existeCorreo.length > 0) {
            throw new Error('Ya existe otro usuario con este correo electrónico')
        }

        // Actualizar el usuario
        await db.execute(`
            UPDATE usuarios SET
                nombre = ?,
                apellidos = ?,
                correo = ?,
                telefono = ?,
                rol = ?
            WHERE id = ?
        `, [
            nombre.trim(),
            apellidos.trim(),
            correo.trim().toLowerCase(),
            telefono?.trim() || null,
            rol || 'usuario',
            usuarioId
        ])

        return {
            success: true,
            message: 'Usuario actualizado exitosamente'
        }

    } catch (error) {
        console.log('Error al actualizar usuario:', error)
        throw error
    }
}

// Función para eliminar un usuario
export async function eliminarUsuario(usuarioId) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        // Solo admins y superadmins pueden eliminar usuarios
        if (usuario.rol === 'usuario') {
            throw new Error('No tienes permisos para eliminar usuarios')
        }

        // No puede eliminarse a sí mismo
        if (parseInt(usuarioId) === usuario.id) {
            throw new Error('No puedes eliminar tu propia cuenta')
        }

        // Verificar que el usuario existe
        const [usuarioExiste] = await db.execute(`
            SELECT id, rol FROM usuarios WHERE id = ?
        `, [usuarioId])

        if (usuarioExiste.length === 0) {
            throw new Error('Usuario no encontrado')
        }

        // Solo superadmins pueden eliminar otros superadmins
        if (usuarioExiste[0].rol === 'superadmin' && usuario.rol !== 'superadmin') {
            throw new Error('Solo un Super Admin puede eliminar otro Super Admin')
        }

        // Verificar si tiene conversaciones o contactos asignados
        const [conversacionesAsignadas] = await db.execute(`
            SELECT COUNT(*) as total
            FROM conversaciones 
            WHERE asignada_a = ?
        `, [usuarioId])

        const [contactosAsignados] = await db.execute(`
            SELECT COUNT(*) as total
            FROM contactos 
            WHERE asignado_a = ?
        `, [usuarioId])

        if (conversacionesAsignadas[0].total > 0 || contactosAsignados[0].total > 0) {
            throw new Error('No se puede eliminar el usuario porque tiene conversaciones o contactos asignados')
        }

        // Eliminar el usuario
        await db.execute(`
            DELETE FROM usuarios WHERE id = ?
        `, [usuarioId])

        return {
            success: true,
            message: 'Usuario eliminado exitosamente'
        }

    } catch (error) {
        console.log('Error al eliminar usuario:', error)
        throw error
    }
}

// Función para activar/desactivar un usuario
export async function activarDesactivarUsuario(usuarioId, activo) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        // Solo admins y superadmins pueden cambiar el estado
        if (usuario.rol === 'usuario') {
            throw new Error('No tienes permisos para cambiar el estado de usuarios')
        }

        // No puede desactivarse a sí mismo
        if (parseInt(usuarioId) === usuario.id && !activo) {
            throw new Error('No puedes desactivar tu propia cuenta')
        }

        // Verificar que el usuario existe
        const [usuarioExiste] = await db.execute(`
            SELECT id, rol FROM usuarios WHERE id = ?
        `, [usuarioId])

        if (usuarioExiste.length === 0) {
            throw new Error('Usuario no encontrado')
        }

        // Solo superadmins pueden desactivar otros superadmins
        if (usuarioExiste[0].rol === 'superadmin' && usuario.rol !== 'superadmin') {
            throw new Error('Solo un Super Admin puede cambiar el estado de otro Super Admin')
        }

        // Actualizar el estado
        await db.execute(`
            UPDATE usuarios SET activo = ? WHERE id = ?
        `, [activo ? 1 : 0, usuarioId])

        return {
            success: true,
            message: activo ? 'Usuario activado exitosamente' : 'Usuario desactivado exitosamente'
        }

    } catch (error) {
        console.log('Error al cambiar estado del usuario:', error)
        throw error
    }
}

// Función para resetear la contraseña de un usuario
export async function resetearContrasena(usuarioId, nuevaContrasena) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        // Solo admins y superadmins pueden resetear contraseñas
        if (usuario.rol === 'usuario') {
            throw new Error('No tienes permisos para resetear contraseñas')
        }

        if (!nuevaContrasena || nuevaContrasena.length < 6) {
            throw new Error('La contraseña debe tener al menos 6 caracteres')
        }

        // Verificar que el usuario existe
        const [usuarioExiste] = await db.execute(`
            SELECT id, rol FROM usuarios WHERE id = ?
        `, [usuarioId])

        if (usuarioExiste.length === 0) {
            throw new Error('Usuario no encontrado')
        }

        // Solo superadmins pueden resetear contraseñas de otros superadmins
        if (usuarioExiste[0].rol === 'superadmin' && usuario.rol !== 'superadmin') {
            throw new Error('Solo un Super Admin puede resetear la contraseña de otro Super Admin')
        }

        // Hashear la nueva contraseña
        const saltRounds = 12
        const hashedPassword = await bcrypt.hash(nuevaContrasena, saltRounds)

        // Actualizar la contraseña
        await db.execute(`
            UPDATE usuarios SET contrasena_hash = ? WHERE id = ?
        `, [hashedPassword, usuarioId])

        return {
            success: true,
            message: 'Contraseña reseteada exitosamente'
        }

    } catch (error) {
        console.log('Error al resetear contraseña:', error)
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