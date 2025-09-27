// ============================================================================
// FUNCIONES ADICIONALES PARA EL FOOTER
// Agregar estas funciones a tu archivo servidor.js existente
// ============================================================================

// ============================================================================
// ESTADÍSTICAS PARA EL FOOTER
// ============================================================================

// Obtener estadísticas básicas para el footer
export async function obtenerEstadisticasBasicas() {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) return null

        let filtroUsuario = ''
        let params = []

        // Si es agente, solo sus estadísticas
        if (usuario.rol === 'agente') {
            filtroUsuario = 'WHERE asignado_a = ? OR asignada_a = ?'
            params = [usuario.id, usuario.id]
        }

        // Mensajes de hoy
        const [mensajesHoy] = await db.execute(`
            SELECT COUNT(*) as total
            FROM mensajes m
            INNER JOIN conversaciones c ON m.conversacion_id = c.id
            WHERE DATE(m.fecha_envio) = CURDATE()
            ${filtroUsuario.replace('asignado_a', 'c.asignada_a')}
        `, params)

        // Conversaciones activas
        const [conversacionesActivas] = await db.execute(`
            SELECT COUNT(*) as total
            FROM conversaciones 
            WHERE estado IN ('abierta', 'en_proceso', 'pendiente')
            ${filtroUsuario.replace('asignado_a', 'asignada_a')}
        `, params)

        // Tiempo promedio de respuesta (últimos 30 días)
        const [tiempoRespuesta] = await db.execute(`
            SELECT AVG(tiempo_respuesta_promedio) as promedio
            FROM conversaciones 
            WHERE fecha_inicio >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            AND tiempo_respuesta_promedio IS NOT NULL
            ${filtroUsuario.replace('asignado_a', 'asignada_a')}
        `, params)

        // Formatear tiempo de respuesta
        const tiempoPromedioSegundos = tiempoRespuesta[0].promedio || 0
        const tiempoFormateado = formatearTiempoRespuesta(tiempoPromedioSegundos)

        return {
            mensajesHoy: mensajesHoy[0].total || 0,
            conversacionesActivas: conversacionesActivas[0].total || 0,
            tiempoRespuesta: tiempoFormateado
        }

    } catch (error) {
        console.error('Error al obtener estadísticas básicas:', error)
        return {
            mensajesHoy: 0,
            conversacionesActivas: 0,
            tiempoRespuesta: 'N/A'
        }
    }
}

// Formatear tiempo de respuesta a formato legible
function formatearTiempoRespuesta(segundos) {
    if (!segundos || segundos === 0) return 'N/A'
    
    if (segundos < 60) {
        return `${Math.round(segundos)}s`
    } else if (segundos < 3600) {
        const minutos = Math.round(segundos / 60)
        return `${minutos}m`
    } else {
        const horas = Math.round(segundos / 3600)
        return `${horas}h`
    }
}

// ============================================================================
// SISTEMA DE NEWSLETTER
// ============================================================================

// Suscribir email al newsletter
export async function suscribirNewsletter(email) {
    try {
        const usuario = await obtenerUsuarioActual()
        
        // Validar email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
            throw new Error('Email inválido')
        }

        // Verificar si ya está suscrito
        const [existingSub] = await db.execute(`
            SELECT id FROM newsletter_suscripciones WHERE email = ?
        `, [email])

        if (existingSub.length > 0) {
            throw new Error('Este email ya está suscrito')
        }

        // Crear suscripción
        const [result] = await db.execute(`
            INSERT INTO newsletter_suscripciones (email, usuario_id, fecha_suscripcion, activo)
            VALUES (?, ?, CURRENT_TIMESTAMP, 1)
        `, [email, usuario?.id || null])

        // Registrar en logs
        await registrarActividadLog('newsletter_suscripcion', `Nueva suscripción: ${email}`, {
            email: email,
            suscripcionId: result.insertId
        })

        return {
            success: true,
            message: 'Suscripción exitosa. ¡Gracias por unirte!'
        }

    } catch (error) {
        console.error('Error al suscribir newsletter:', error)
        throw error
    }
}

// Desuscribir del newsletter
export async function desuscribirNewsletter(email, token = null) {
    try {
        let whereClause = 'WHERE email = ?'
        let params = [email]

        if (token) {
            whereClause += ' AND token_desuscripcion = ?'
            params.push(token)
        }

        const [result] = await db.execute(`
            UPDATE newsletter_suscripciones 
            SET activo = 0, fecha_desuscripcion = CURRENT_TIMESTAMP
            ${whereClause}
        `, params)

        if (result.affectedRows === 0) {
            throw new Error('Suscripción no encontrada')
        }

        return {
            success: true,
            message: 'Te has desuscrito exitosamente'
        }

    } catch (error) {
        console.error('Error al desuscribir newsletter:', error)
        throw error
    }
}

// ============================================================================
// SISTEMA DE CONTACTO Y SOPORTE
// ============================================================================

// Enviar mensaje de contacto/soporte
export async function enviarMensajeContacto(datos) {
    try {
        const { nombre, email, asunto, mensaje, tipo = 'general' } = datos
        const usuario = await obtenerUsuarioActual()

        // Validaciones básicas
        if (!nombre || !email || !mensaje) {
            throw new Error('Todos los campos son requeridos')
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
            throw new Error('Email inválido')
        }

        // Guardar mensaje
        const [result] = await db.execute(`
            INSERT INTO mensajes_contacto (
                nombre, email, asunto, mensaje, tipo, 
                usuario_id, fecha_creacion, estado
            ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'nuevo')
        `, [nombre, email, asunto || 'Consulta general', mensaje, tipo, usuario?.id || null])

        // Crear notificación para admins
        const [admins] = await db.execute(`
            SELECT id FROM usuarios 
            WHERE rol IN ('admin', 'super_admin') AND activo = 1
        `)

        for (const admin of admins) {
            await crearNotificacion({
                usuarioId: admin.id,
                titulo: 'Nuevo mensaje de contacto',
                mensaje: `${nombre} ha enviado un mensaje: ${asunto || 'Sin asunto'}`,
                tipo: 'sistema'
            })
        }

        return {
            success: true,
            message: 'Mensaje enviado exitosamente. Te contactaremos pronto.',
            ticketId: result.insertId
        }

    } catch (error) {
        console.error('Error al enviar mensaje de contacto:', error)
        throw error
    }
}

// ============================================================================
// ESTADO DEL SISTEMA
// ============================================================================

// Obtener estado del sistema
export async function obtenerEstadoSistema() {
    try {
        // Verificar conectividad de base de datos
        const [dbTest] = await db.execute('SELECT 1 as test')
        const dbStatus = dbTest[0].test === 1

        // Verificar APIs externas (simulado)
        const whatsappStatus = await verificarAPIWhatsApp()
        const facebookStatus = await verificarAPIFacebook()

        // Obtener métricas de rendimiento
        const [metricas] = await db.execute(`
            SELECT 
                COUNT(DISTINCT c.id) as conversaciones_hoy,
                COUNT(m.id) as mensajes_hoy,
                AVG(c.tiempo_respuesta_promedio) as tiempo_respuesta_promedio
            FROM conversaciones c
            LEFT JOIN mensajes m ON c.id = m.conversacion_id 
                AND DATE(m.fecha_envio) = CURDATE()
            WHERE DATE(c.fecha_inicio) = CURDATE()
        `)

        const estadoGeneral = dbStatus && whatsappStatus && facebookStatus

        return {
            estado: estadoGeneral ? 'operativo' : 'degradado',
            servicios: {
                base_datos: dbStatus ? 'operativo' : 'fallo',
                whatsapp_api: whatsappStatus ? 'operativo' : 'degradado',
                facebook_api: facebookStatus ? 'operativo' : 'degradado'
            },
            metricas: metricas[0],
            ultima_verificacion: new Date().toISOString()
        }

    } catch (error) {
        console.error('Error al obtener estado del sistema:', error)
        return {
            estado: 'fallo',
            servicios: {
                base_datos: 'fallo',
                whatsapp_api: 'desconocido',
                facebook_api: 'desconocido'
            },
            metricas: {
                conversaciones_hoy: 0,
                mensajes_hoy: 0,
                tiempo_respuesta_promedio: null
            },
            ultima_verificacion: new Date().toISOString()
        }
    }
}

// Verificar API de WhatsApp (simulado)
async function verificarAPIWhatsApp() {
    try {
        // Aquí harías una llamada real a la API de WhatsApp
        // Por ahora simulamos una verificación
        const [configs] = await db.execute(`
            SELECT COUNT(*) as total FROM configuraciones_whatsapp 
            WHERE activo = 1
        `)
        
        return configs[0].total > 0
    } catch (error) {
        return false
    }
}

// Verificar API de Facebook (simulado)
async function verificarAPIFacebook() {
    try {
        // Aquí harías una llamada real a la API de Facebook
        // Por ahora simulamos una verificación
        const [configs] = await db.execute(`
            SELECT COUNT(*) as total FROM configuraciones_facebook 
            WHERE activo = 1
        `)
        
        return configs[0].total > 0
    } catch (error) {
        return false
    }
}

// ============================================================================
// GESTIÓN DE FEEDBACK DEL SISTEMA
// ============================================================================

// Enviar feedback del sistema
export async function enviarFeedback(datos) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) throw new Error('Usuario no autenticado')

        const { tipo, calificacion, comentario, pagina_actual } = datos

        // Validaciones
        if (!tipo || !calificacion) {
            throw new Error('Tipo y calificación son requeridos')
        }

        if (calificacion < 1 || calificacion > 5) {
            throw new Error('La calificación debe estar entre 1 y 5')
        }

        // Guardar feedback
        const [result] = await db.execute(`
            INSERT INTO feedback_sistema (
                usuario_id, tipo, calificacion, comentario, 
                pagina_actual, fecha_creacion
            ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [usuario.id, tipo, calificacion, comentario || null, pagina_actual || null])

        // Si es calificación baja, crear notificación para admins
        if (calificacion <= 2) {
            const [admins] = await db.execute(`
                SELECT id FROM usuarios 
                WHERE rol IN ('admin', 'super_admin') AND activo = 1
            `)

            for (const admin of admins) {
                await crearNotificacion({
                    usuarioId: admin.id,
                    titulo: 'Feedback negativo recibido',
                    mensaje: `${usuario.nombre} dio una calificación de ${calificacion}/5`,
                    tipo: 'sistema'
                })
            }
        }

        return {
            success: true,
            message: 'Feedback enviado exitosamente. ¡Gracias por ayudarnos a mejorar!',
            feedbackId: result.insertId
        }

    } catch (error) {
        console.error('Error al enviar feedback:', error)
        throw error
    }
}

// ============================================================================
// FUNCIONES DE UTILIDAD PARA EL FOOTER
// ============================================================================

// Obtener información de la empresa
export async function obtenerInfoEmpresa() {
    try {
        const [info] = await db.execute(`
            SELECT * FROM configuracion_empresa 
            WHERE activo = 1 
            ORDER BY fecha_creacion DESC 
            LIMIT 1
        `)

        if (info.length === 0) {
            return {
                nombre: 'CRM Social',
                descripcion: 'Plataforma integrada de comunicación WhatsApp & Facebook',
                telefono: null,
                email: 'contacto@crmsocial.com',
                direccion: null,
                redes_sociales: {
                    whatsapp: null,
                    facebook: null,
                    twitter: null,
                    linkedin: null,
                    instagram: null
                }
            }
        }

        return {
            ...info[0],
            redes_sociales: info[0].redes_sociales ? 
                JSON.parse(info[0].redes_sociales) : {}
        }

    } catch (error) {
        console.error('Error al obtener info de empresa:', error)
        return {
            nombre: 'CRM Social',
            descripcion: 'Plataforma integrada de comunicación WhatsApp & Facebook',
            telefono: null,
            email: 'contacto@crmsocial.com',
            direccion: null,
            redes_sociales: {}
        }
    }
}

// Registrar click en enlace del footer (para analytics)
export async function registrarClickEnlace(enlace, seccion) {
    try {
        const usuario = await obtenerUsuarioActual()
        
        await db.execute(`
            INSERT INTO analytics_clicks (
                usuario_id, enlace, seccion, 
                user_agent, ip_address, fecha_click
            ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [
            usuario?.id || null, 
            enlace, 
            seccion,
            null, // user_agent - se obtendría del request
            null  // ip_address - se obtendría del request
        ])

    } catch (error) {
        console.error('Error al registrar click:', error)
        // No lanzar error para no interrumpir la navegación
    }
}

// ============================================================================
// TABLAS ADICIONALES NECESARIAS PARA EL FOOTER
// Ejecutar estos CREATE TABLE en tu base de datos:
// ============================================================================

/*
-- Tabla para suscripciones del newsletter
CREATE TABLE newsletter_suscripciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(100) NOT NULL UNIQUE,
    usuario_id INT NULL,
    fecha_suscripcion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_desuscripcion TIMESTAMP NULL,
    activo BOOLEAN DEFAULT 1,
    token_desuscripcion VARCHAR(255) NULL,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Tabla para mensajes de contacto
CREATE TABLE mensajes_contacto (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    asunto VARCHAR(255),
    mensaje TEXT NOT NULL,
    tipo ENUM('general', 'soporte', 'ventas', 'tecnico') DEFAULT 'general',
    usuario_id INT NULL,
    estado ENUM('nuevo', 'en_proceso', 'resuelto', 'cerrado') DEFAULT 'nuevo',
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_respuesta TIMESTAMP NULL,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Tabla para feedback del sistema
CREATE TABLE feedback_sistema (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    tipo ENUM('usabilidad', 'rendimiento', 'funcionalidad', 'general') NOT NULL,
    calificacion TINYINT NOT NULL CHECK(calificacion BETWEEN 1 AND 5),
    comentario TEXT,
    pagina_actual VARCHAR(255),
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Tabla para configuración de empresa
CREATE TABLE configuracion_empresa (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    telefono VARCHAR(20),
    email VARCHAR(100),
    direccion TEXT,
    redes_sociales JSON,
    activo BOOLEAN DEFAULT 1,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Tabla para analytics de clicks
CREATE TABLE analytics_clicks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NULL,
    enlace VARCHAR(255) NOT NULL,
    seccion VARCHAR(50),
    user_agent TEXT,
    ip_address VARCHAR(45),
    fecha_click TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB;
*/