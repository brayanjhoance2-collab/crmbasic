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

// Función para obtener configuraciones de todas las plataformas
export async function obtenerConfiguracionesPlataformas() {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        if (usuario.rol === 'usuario') {
            throw new Error('No tienes permisos para ver configuraciones')
        }

        // Configuraciones WhatsApp
        const [whatsappConfig] = await db.execute(`
            SELECT * FROM configuraciones_whatsapp 
            ORDER BY fecha_creacion DESC 
            LIMIT 1
        `)

        // Configuraciones Instagram
        const [instagramConfig] = await db.execute(`
            SELECT * FROM configuraciones_instagram 
            ORDER BY fecha_creacion DESC 
            LIMIT 1
        `)

        // Configuraciones Facebook
        const [facebookConfig] = await db.execute(`
            SELECT * FROM configuraciones_facebook ORDER BY fecha_creacion DESC 
            LIMIT 1
        `)

        // Verificar configuraciones activas
        const [configuracionesActivas] = await db.execute(`
            SELECT plataforma, config_id 
            FROM configuraciones_activas
        `)

        // Mapear configuraciones activas
        const activasMap = {}
        configuracionesActivas.forEach(config => {
            activasMap[config.plataforma] = true
        })

        return {
            whatsapp: {
                activa: activasMap.whatsapp || false,
                phone_number_id: whatsappConfig[0]?.phone_number_id || '',
                access_token: whatsappConfig[0]?.access_token || '',
                webhook_verify_token: whatsappConfig[0]?.webhook_verify_token || '',
                business_account_id: whatsappConfig[0]?.business_account_id || ''
            },
            instagram: {
                activa: activasMap.instagram || false,
                instagram_business_id: instagramConfig[0]?.instagram_business_id || '',
                access_token: instagramConfig[0]?.access_token || '',
                webhook_verify_token: instagramConfig[0]?.webhook_verify_token || ''
            },
            facebook: {
                activa: activasMap.facebook || false,
                page_id: facebookConfig[0]?.page_id || '',
                page_access_token: facebookConfig[0]?.page_access_token || '',
                app_id: facebookConfig[0]?.app_id || '',
                app_secret: facebookConfig[0]?.app_secret || '',
                webhook_verify_token: facebookConfig[0]?.webhook_verify_token || ''
            },
            general: {
                zona_horaria: 'America/Mexico_City',
                idioma: 'es',
                auto_asignacion: false,
                notificaciones_email: true,
                respuesta_automatica: false,
                horario_atencion_inicio: '09:00',
                horario_atencion_fin: '18:00'
            }
        }

    } catch (error) {
        console.log('Error al obtener configuraciones:', error)
        throw error
    }
}

// Función para actualizar configuración de WhatsApp
export async function actualizarConfiguracionWhatsApp(configuracion) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        if (usuario.rol === 'usuario') {
            throw new Error('No tienes permisos para actualizar configuraciones')
        }

        const {
            phone_number_id,
            access_token,
            webhook_verify_token,
            business_account_id
        } = configuracion

        // Validar campos requeridos
        if (!phone_number_id || !access_token || !webhook_verify_token) {
            throw new Error('Todos los campos marcados con * son requeridos')
        }

        // Buscar configuración existente
        const [existente] = await db.execute(`
            SELECT id FROM configuraciones_whatsapp 
            ORDER BY fecha_creacion DESC 
            LIMIT 1
        `)

        if (existente.length > 0) {
            // Actualizar configuración existente
            await db.execute(`
                UPDATE configuraciones_whatsapp SET
                    phone_number_id = ?,
                    access_token = ?,
                    webhook_verify_token = ?,
                    business_account_id = ?,
                    fecha_actualizacion = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [
                phone_number_id,
                access_token,
                webhook_verify_token,
                business_account_id || null,
                existente[0].id
            ])
        } else {
            // Crear nueva configuración
            await db.execute(`
                INSERT INTO configuraciones_whatsapp (
                    nombre_configuracion,
                    phone_number_id,
                    access_token,
                    webhook_verify_token,
                    business_account_id
                ) VALUES (?, ?, ?, ?, ?)
            `, [
                'Configuración Principal',
                phone_number_id,
                access_token,
                webhook_verify_token,
                business_account_id || null
            ])
        }

        return {
            success: true,
            message: 'Configuración de WhatsApp actualizada exitosamente'
        }

    } catch (error) {
        console.log('Error al actualizar configuración WhatsApp:', error)
        throw error
    }
}

// Función para actualizar configuración de Instagram
export async function actualizarConfiguracionInstagram(configuracion) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        if (usuario.rol === 'usuario') {
            throw new Error('No tienes permisos para actualizar configuraciones')
        }

        const {
            instagram_business_id,
            access_token,
            webhook_verify_token
        } = configuracion

        // Validar campos requeridos
        if (!instagram_business_id || !access_token || !webhook_verify_token) {
            throw new Error('Todos los campos marcados con * son requeridos')
        }

        // Buscar configuración existente
        const [existente] = await db.execute(`
            SELECT id FROM configuraciones_instagram 
            ORDER BY fecha_creacion DESC 
            LIMIT 1
        `)

        if (existente.length > 0) {
            // Actualizar configuración existente
            await db.execute(`
                UPDATE configuraciones_instagram SET
                    instagram_business_id = ?,
                    access_token = ?,
                    webhook_verify_token = ?,
                    fecha_actualizacion = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [
                instagram_business_id,
                access_token,
                webhook_verify_token,
                existente[0].id
            ])
        } else {
            // Crear nueva configuración
            await db.execute(`
                INSERT INTO configuraciones_instagram (
                    nombre_configuracion,
                    instagram_business_id,
                    access_token,
                    webhook_verify_token
                ) VALUES (?, ?, ?, ?)
            `, [
                'Configuración Principal',
                instagram_business_id,
                access_token,
                webhook_verify_token
            ])
        }

        return {
            success: true,
            message: 'Configuración de Instagram actualizada exitosamente'
        }

    } catch (error) {
        console.log('Error al actualizar configuración Instagram:', error)
        throw error
    }
}

// Función para actualizar configuración de Facebook
export async function actualizarConfiguracionFacebook(configuracion) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        if (usuario.rol === 'usuario') {
            throw new Error('No tienes permisos para actualizar configuraciones')
        }

        const {
            page_id,
            page_access_token,
            app_id,
            app_secret,
            webhook_verify_token
        } = configuracion

        // Validar campos requeridos
        if (!page_id || !page_access_token || !app_id || !app_secret || !webhook_verify_token) {
            throw new Error('Todos los campos marcados con * son requeridos')
        }

        // Buscar configuración existente
        const [existente] = await db.execute(`
            SELECT id FROM configuraciones_facebook 
            ORDER BY fecha_creacion DESC 
            LIMIT 1
        `)

        if (existente.length > 0) {
            // Actualizar configuración existente
            await db.execute(`
                UPDATE configuraciones_facebook SET
                    page_id = ?,
                    page_access_token = ?,
                    app_id = ?,
                    app_secret = ?,
                    webhook_verify_token = ?,
                    fecha_actualizacion = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [
                page_id,
                page_access_token,
                app_id,
                app_secret,
                webhook_verify_token,
                existente[0].id
            ])
        } else {
            // Crear nueva configuración
            await db.execute(`
                INSERT INTO configuraciones_facebook (
                    nombre_configuracion,
                    page_id,
                    page_access_token,
                    app_id,
                    app_secret,
                    webhook_verify_token
                ) VALUES (?, ?, ?, ?, ?, ?)
            `, [
                'Configuración Principal',
                page_id,
                page_access_token,
                app_id,
                app_secret,
                webhook_verify_token
            ])
        }

        return {
            success: true,
            message: 'Configuración de Facebook actualizada exitosamente'
        }

    } catch (error) {
        console.log('Error al actualizar configuración Facebook:', error)
        throw error
    }
}

// Función para actualizar configuración general
export async function actualizarConfiguracionGeneral(configuracion) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        if (usuario.rol === 'usuario') {
            throw new Error('No tienes permisos para actualizar configuraciones')
        }

        // En una aplicación real, guardarías estas configuraciones en una tabla
        console.log('Configuración general actualizada:', configuracion)

        return {
            success: true,
            message: 'Configuración general actualizada exitosamente'
        }

    } catch (error) {
        console.log('Error al actualizar configuración general:', error)
        throw error
    }
}

// Función para probar conexión con plataforma
export async function probarConexionPlataforma(plataforma, configuracion) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        if (usuario.rol === 'usuario') {
            throw new Error('No tienes permisos para probar conexiones')
        }

        // Simular prueba de conexión
        // En producción, aquí harías llamadas reales a las APIs
        console.log(`Probando conexión con ${plataforma}:`, configuracion)

        // Simular un delay de red
        await new Promise(resolve => setTimeout(resolve, 2000))

        // Simular éxito/fallo aleatorio para demostración
        const exito = Math.random() > 0.3

        if (exito) {
            return {
                exito: true,
                mensaje: `Conexión con ${plataforma} exitosa`
            }
        } else {
            return {
                exito: false,
                mensaje: `Error de autenticación en ${plataforma}`
            }
        }

    } catch (error) {
        console.log(`Error al probar conexión con ${plataforma}:`, error)
        return {
            exito: false,
            mensaje: error.message
        }
    }
}

// Función para activar/desactivar plataforma
export async function activarDesactivarPlataforma(plataforma, activa) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        if (usuario.rol === 'usuario') {
            throw new Error('No tienes permisos para activar/desactivar plataformas')
        }

        if (activa) {
            // Obtener ID de configuración más reciente
            let configId = null
            let tipoConfig = 'api'

            switch (plataforma) {
                case 'whatsapp':
                    const [whatsappConfig] = await db.execute(`
                        SELECT id FROM configuraciones_whatsapp 
                        ORDER BY fecha_creacion DESC 
                        LIMIT 1
                    `)
                    if (whatsappConfig.length === 0) {
                        throw new Error('No hay configuración de WhatsApp guardada')
                    }
                    configId = whatsappConfig[0].id
                    break

                case 'instagram':
                    const [instagramConfig] = await db.execute(`
                        SELECT id FROM configuraciones_instagram 
                        ORDER BY fecha_creacion DESC 
                        LIMIT 1
                    `)
                    if (instagramConfig.length === 0) {
                        throw new Error('No hay configuración de Instagram guardada')
                    }
                    configId = instagramConfig[0].id
                    tipoConfig = 'graph'
                    break

                case 'facebook':
                    const [facebookConfig] = await db.execute(`
                        SELECT id FROM configuraciones_facebook 
                        ORDER BY fecha_creacion DESC 
                        LIMIT 1
                    `)
                    if (facebookConfig.length === 0) {
                        throw new Error('No hay configuración de Facebook guardada')
                    }
                    configId = facebookConfig[0].id
                    tipoConfig = 'graph'
                    break

                default:
                    throw new Error('Plataforma no válida')
            }

            // Insertar o actualizar configuración activa
            await db.execute(`
                INSERT INTO configuraciones_activas (plataforma, tipo_config, config_id, activada_por)
                VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    tipo_config = VALUES(tipo_config),
                    config_id = VALUES(config_id),
                    fecha_activacion = CURRENT_TIMESTAMP,
                    activada_por = VALUES(activada_por)
            `, [plataforma, tipoConfig, configId, usuario.id])

        } else {
            // Desactivar plataforma
            await db.execute(`
                DELETE FROM configuraciones_activas 
                WHERE plataforma = ?
            `, [plataforma])
        }

        return {
            success: true,
            message: `${plataforma} ${activa ? 'activada' : 'desactivada'} exitosamente`
        }

    } catch (error) {
        console.log(`Error al ${activa ? 'activar' : 'desactivar'} ${plataforma}:`, error)
        throw error
    }
}

// Función para obtener webhooks configurados
export async function obtenerWebhooksConfigurados() {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        if (usuario.rol === 'usuario') {
            throw new Error('No tienes permisos para ver webhooks')
        }

        const [webhooks] = await db.execute(`
            SELECT 
                'whatsapp' as plataforma,
                webhook_verify_token as token,
                'activa' as estado
            FROM configuraciones_whatsapp cw
            JOIN configuraciones_activas ca ON ca.plataforma = 'whatsapp'
            
            UNION ALL
            
            SELECT 
                'instagram' as plataforma,
                webhook_verify_token as token,
                'activa' as estado
            FROM configuraciones_instagram ci
            JOIN configuraciones_activas ca ON ca.plataforma = 'instagram'
            
            UNION ALL
            
            SELECT 
                'facebook' as plataforma,
                webhook_verify_token as token,
                'activa' as estado
            FROM configuraciones_facebook cf
            JOIN configuraciones_activas ca ON ca.plataforma = 'facebook'
        `)

        return webhooks

    } catch (error) {
        console.log('Error al obtener webhooks:', error)
        throw error
    }
}

// Función para validar configuración antes de guardar
export async function validarConfiguracion(plataforma, configuracion) {
    try {
        const errores = []

        switch (plataforma) {
            case 'whatsapp':
                if (!configuracion.phone_number_id) {
                    errores.push('Phone Number ID es requerido')
                }
                if (!configuracion.access_token) {
                    errores.push('Access Token es requerido')
                }
                if (!configuracion.webhook_verify_token) {
                    errores.push('Webhook Verify Token es requerido')
                }
                break

            case 'instagram':
                if (!configuracion.instagram_business_id) {
                    errores.push('Instagram Business ID es requerido')
                }
                if (!configuracion.access_token) {
                    errores.push('Access Token es requerido')
                }
                if (!configuracion.webhook_verify_token) {
                    errores.push('Webhook Verify Token es requerido')
                }
                break

            case 'facebook':
                if (!configuracion.page_id) {
                    errores.push('Page ID es requerido')
                }
                if (!configuracion.page_access_token) {
                    errores.push('Page Access Token es requerido')
                }
                if (!configuracion.app_id) {
                    errores.push('App ID es requerido')
                }
                if (!configuracion.app_secret) {
                    errores.push('App Secret es requerido')
                }
                if (!configuracion.webhook_verify_token) {
                    errores.push('Webhook Verify Token es requerido')
                }
                break

            default:
                errores.push('Plataforma no válida')
        }

        return {
            esValida: errores.length === 0,
            errores
        }

    } catch (error) {
        console.log('Error al validar configuración:', error)
        throw error
    }
}

// Función para exportar configuraciones (backup)
export async function exportarConfiguraciones() {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        if (usuario.rol !== 'superadmin') {
            throw new Error('Solo Super Admins pueden exportar configuraciones')
        }

        const configuraciones = await obtenerConfiguracionesPlataformas()

        // En producción, aquí generarías un archivo de backup
        console.log('Exportando configuraciones:', configuraciones)

        return {
            success: true,
            message: 'Configuraciones exportadas exitosamente',
            archivo: `configuraciones_backup_${new Date().toISOString().split('T')[0]}.json`
        }

    } catch (error) {
        console.log('Error al exportar configuraciones:', error)
        throw error
    }
}