"use server"
import db from "@/_DB/db"
import bcrypt from 'bcryptjs'

export async function crearAdministradorInicial() {
    try {
        // 1. Verificar si ya existe algún superadmin
        const [adminExistente] = await db.execute(`
            SELECT COUNT(*) as total 
            FROM usuarios 
            WHERE rol = 'superadmin' AND activo = 1
        `)
        
        if (adminExistente[0].total > 0) {
            return {
                success: true,
                creado: false,
                mensaje: 'Ya existe un superadministrador en el sistema'
            }
        }
        
        // 2. Verificar si existe el usuario con el email admin@gmail.com
        const [usuarioExistente] = await db.execute(`
            SELECT id, rol FROM usuarios WHERE correo = ?
        `, ['admin@gmail.com'])
        
        let usuarioId
        
        if (usuarioExistente.length > 0) {
            // El usuario ya existe, actualizar a superadmin si no lo es
            usuarioId = usuarioExistente[0].id
            
            await db.execute(`
                UPDATE usuarios 
                SET 
                    nombre = 'Super',
                    apellidos = 'Administrador',
                    rol = 'superadmin',
                    activo = 1,
                    ultimo_acceso = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [usuarioId])
        } else {
            // 3. Crear el usuario superadministrador
            const contrasenaHash = await bcrypt.hash('admin123', 12)
            
            const [resultadoUsuario] = await db.execute(`
                INSERT INTO usuarios (
                    correo, 
                    contrasena_hash, 
                    nombre, 
                    apellidos, 
                    telefono,
                    rol,
                    activo,
                    fecha_registro
                ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `, [
                'admin@gmail.com',
                contrasenaHash,
                'Super',
                'Administrador',
                null,
                'superadmin',
                1
            ])
            
            usuarioId = resultadoUsuario.insertId
        }
        
        return {
            success: true,
            creado: true,
            mensaje: 'Superadministrador inicial creado exitosamente',
            datos: {
                correo: 'admin@gmail.com',
                rol: 'superadmin',
                password: 'admin123' // Solo para mostrar en desarrollo
            }
        }
        
    } catch (error) {
        console.error('Error al crear superadministrador inicial:', error)
        
        return {
            success: false,
            creado: false,
            mensaje: 'Error al crear superadministrador inicial: ' + error.message
        }
    }
}

// Función auxiliar para verificar el estado del superadministrador
export async function verificarEstadoAdministrador() {
    try {
        const [resultado] = await db.execute(`
            SELECT 
                id,
                correo,
                nombre,
                apellidos,
                rol,
                activo,
                fecha_registro,
                ultimo_acceso
            FROM usuarios 
            WHERE correo = 'admin@gmail.com' AND rol = 'superadmin'
        `)
        
        return {
            success: true,
            existe: resultado.length > 0,
            datos: resultado.length > 0 ? resultado[0] : null
        }
        
    } catch (error) {
        console.error('Error al verificar superadministrador:', error)
        return {
            success: false,
            existe: false,
            error: error.message
        }
    }
}

// Función para crear usuarios adicionales
export async function crearUsuario(datos) {
    try {
        const { correo, password, nombre, apellidos, telefono, rol = 'usuario' } = datos
        
        // Verificar que el correo no exista
        const [usuarioExistente] = await db.execute(`
            SELECT id FROM usuarios WHERE correo = ?
        `, [correo])
        
        if (usuarioExistente.length > 0) {
            return {
                success: false,
                mensaje: 'Ya existe un usuario con este correo electrónico'
            }
        }
        
        // Validar rol
        if (!['usuario', 'admin', 'superadmin'].includes(rol)) {
            return {
                success: false,
                mensaje: 'Rol no válido'
            }
        }
        
        // Hash de la contraseña
        const contrasenaHash = await bcrypt.hash(password, 12)
        
        // Crear usuario
        const [resultado] = await db.execute(`
            INSERT INTO usuarios (
                correo, 
                contrasena_hash, 
                nombre, 
                apellidos, 
                telefono,
                rol,
                activo,
                fecha_registro
            ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [correo, contrasenaHash, nombre, apellidos, telefono, rol, 1])
        
        return {
            success: true,
            mensaje: 'Usuario creado exitosamente',
            userId: resultado.insertId
        }
        
    } catch (error) {
        console.error('Error al crear usuario:', error)
        return {
            success: false,
            mensaje: 'Error al crear usuario: ' + error.message
        }
    }
}

// Función para listar usuarios
export async function listarUsuarios() {
    try {
        const [usuarios] = await db.execute(`
            SELECT 
                id,
                correo,
                nombre,
                apellidos,
                telefono,
                rol,
                activo,
                ultimo_acceso,
                fecha_registro
            FROM usuarios 
            ORDER BY fecha_registro DESC
        `)
        
        return {
            success: true,
            usuarios: usuarios
        }
        
    } catch (error) {
        console.error('Error al listar usuarios:', error)
        return {
            success: false,
            mensaje: 'Error al obtener usuarios: ' + error.message
        }
    }
}

// Función para actualizar usuario
export async function actualizarUsuario(id, datos) {
    try {
        const { nombre, apellidos, telefono, rol, activo } = datos
        
        // Validar rol si se proporciona
        if (rol && !['usuario', 'admin', 'superadmin'].includes(rol)) {
            return {
                success: false,
                mensaje: 'Rol no válido'
            }
        }
        
        await db.execute(`
            UPDATE usuarios 
            SET 
                nombre = ?,
                apellidos = ?,
                telefono = ?,
                rol = ?,
                activo = ?
            WHERE id = ?
        `, [nombre, apellidos, telefono, rol, activo, id])
        
        return {
            success: true,
            mensaje: 'Usuario actualizado exitosamente'
        }
        
    } catch (error) {
        console.error('Error al actualizar usuario:', error)
        return {
            success: false,
            mensaje: 'Error al actualizar usuario: ' + error.message
        }
    }
}

// Función para cambiar contraseña
export async function cambiarContrasena(userId, nuevaContrasena) {
    try {
        const contrasenaHash = await bcrypt.hash(nuevaContrasena, 12)
        
        await db.execute(`
            UPDATE usuarios 
            SET contrasena_hash = ?
            WHERE id = ?
        `, [contrasenaHash, userId])
        
        return {
            success: true,
            mensaje: 'Contraseña actualizada exitosamente'
        }
        
    } catch (error) {
        console.error('Error al cambiar contraseña:', error)
        return {
            success: false,
            mensaje: 'Error al cambiar contraseña: ' + error.message
        }
    }
}