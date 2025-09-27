"use server"
import db from "@/_DB/db"
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

const JWT_SECRET = process.env.JWT_SECRET || 'crm_whatsapp_facebook_2024'

// Store para las instancias activas de Baileys
const baileysInstances = new Map()

// Función para obtener el usuario actual
export async function obtenerUsuarioActual() {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get('auth-token')
        
        if (!token) return null

        const decoded = jwt.verify(token.value, JWT_SECRET)
        const userId = decoded.userId

        const [rows] = await db.execute(`
            SELECT id, correo, nombre, apellidos, telefono, avatar_url, rol, activo, ultimo_acceso, fecha_registro
            FROM usuarios WHERE id = ? AND activo = 1
        `, [userId])

        if (rows.length === 0) return null

        const usuario = rows[0]
        await db.execute(`UPDATE usuarios SET ultimo_acceso = CURRENT_TIMESTAMP WHERE id = ?`, [userId])

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

// Función para obtener configuración activa por plataforma
export async function obtenerConfiguracionActiva(plataforma) {
    try {
        const [rows] = await db.execute(`
            SELECT * FROM configuraciones_activas WHERE plataforma = ?
        `, [plataforma])

        return rows.length > 0 ? rows[0] : null

    } catch (error) {
        console.log('Error al obtener configuración activa:', error)
        return null
    }
}

// Función para activar configuración - CORREGIDA
export async function activarConfiguracion(plataforma, tipoConfig, configId) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        if (usuario.rol === 'usuario') {
            throw new Error('Sin permisos para activar configuraciones')
        }

        // Verificar que la configuración existe
        let tableName
        switch (tipoConfig) {
            case 'api':
                tableName = 'configuraciones_whatsapp'
                break
            case 'baileys':
                tableName = 'configuraciones_baileys'
                break
            case 'graph':
                if (plataforma === 'instagram') tableName = 'configuraciones_instagram'
                else if (plataforma === 'facebook') tableName = 'configuraciones_facebook'
                break
            default:
                throw new Error('Tipo de configuración no válido')
        }

        const [configRows] = await db.execute(`
            SELECT id FROM ${tableName} WHERE id = ?
        `, [configId])

        if (configRows.length === 0) {
            throw new Error('Configuración no encontrada')
        }

        // Para Baileys, verificar que esté conectado
        if (tipoConfig === 'baileys') {
            const [baileysRows] = await db.execute(`
                SELECT estado_conexion FROM configuraciones_baileys WHERE id = ? AND estado_conexion = 'conectado'
            `, [configId])

            if (baileysRows.length === 0) {
                throw new Error('La configuración Baileys debe estar conectada para activarla')
            }
        }

        // Primero eliminar configuración activa anterior para esta plataforma
        await db.execute(`
            DELETE FROM configuraciones_activas WHERE plataforma = ?
        `, [plataforma])

        // Luego insertar la nueva configuración activa
        await db.execute(`
            INSERT INTO configuraciones_activas (plataforma, tipo_config, config_id, activada_por)
            VALUES (?, ?, ?, ?)
        `, [plataforma, tipoConfig, configId, usuario.id])

        return {
            success: true,
            message: `Configuración ${tipoConfig} activada como principal para ${plataforma}`
        }

    } catch (error) {
        console.log('Error al activar configuración:', error)
        throw error
    }
}

// Función para obtener todas las configuraciones con estado activo
export async function obtenerConfiguracionesPlataformas() {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        if (usuario.rol === 'usuario') {
            throw new Error('Sin permisos para ver configuraciones')
        }

        // Obtener configuración activa de WhatsApp
        const configActiva = await obtenerConfiguracionActiva('whatsapp')

        const [whatsappRows] = await db.execute(`
            SELECT *, 'api' as tipo FROM configuraciones_whatsapp 
            ORDER BY fecha_creacion DESC
        `)

        const [baileysRows] = await db.execute(`
            SELECT *, 'baileys' as tipo FROM configuraciones_baileys 
            ORDER BY fecha_creacion DESC
        `)

        const [instagramRows] = await db.execute(`
            SELECT *, 'graph' as tipo FROM configuraciones_instagram 
            ORDER BY fecha_creacion DESC
        `)

        const [facebookRows] = await db.execute(`
            SELECT *, 'graph' as tipo FROM configuraciones_facebook 
            ORDER BY fecha_creacion DESC
        `)

        // Marcar cuál está activa y agregar is_active
        const whatsappCombinado = [...whatsappRows, ...baileysRows].map(config => ({
            ...config,
            is_active: configActiva && 
                      configActiva.tipo_config === config.tipo && 
                      configActiva.config_id === config.id
        }))

        return {
            whatsapp: whatsappCombinado,
            instagram: instagramRows,
            facebook: facebookRows
        }

    } catch (error) {
        console.log('Error al obtener configuraciones:', error)
        throw error
    }
}

// Función para verificar límite de configuraciones
export async function verificarLimiteConfiguraciones(plataforma) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        if (usuario.rol === 'usuario') {
            return { puede: false, mensaje: 'Sin permisos para crear configuraciones' }
        }

        if (plataforma === 'whatsapp') {
            const [apiRows] = await db.execute(`SELECT COUNT(*) as total FROM configuraciones_whatsapp`)
            const [baileysRows] = await db.execute(`SELECT COUNT(*) as total FROM configuraciones_baileys`)
            
            const totalApi = apiRows[0].total
            const totalBaileys = baileysRows[0].total
            
            if (totalApi >= 1 && totalBaileys >= 1) {
                return { 
                    puede: false, 
                    mensaje: `Ya tienes configuraciones de WhatsApp API (${totalApi}) y Baileys (${totalBaileys}). Máximo 1 de cada tipo.` 
                }
            }
            
            return { puede: true, mensaje: 'Puede crear configuración' }
        }

        // Para otras plataformas, mantener límite de 1
        let tableName
        switch (plataforma) {
            case 'instagram':
                tableName = 'configuraciones_instagram'
                break
            case 'facebook':
                tableName = 'configuraciones_facebook'
                break
            default:
                return { puede: false, mensaje: 'Plataforma no válida' }
        }

        const [rows] = await db.execute(`SELECT COUNT(*) as total FROM ${tableName}`)
        const total = rows[0].total

        if (total >= 1) {
            return { 
                puede: false, 
                mensaje: `Solo se permite una configuración de ${plataforma}. Ya tienes ${total}.` 
            }
        }

        return { puede: true, mensaje: 'Puede crear configuración' }

    } catch (error) {
        console.log('Error al verificar límite:', error)
        return { puede: false, mensaje: 'Error al verificar límite' }
    }
}

// Función para crear configuración de Baileys
export async function crearConfiguracionBaileys(datos) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        if (usuario.rol === 'usuario') {
            throw new Error('Sin permisos para crear configuraciones')
        }

        const limite = await verificarLimiteConfiguraciones('whatsapp')
        if (!limite.puede) {
            throw new Error(limite.mensaje)
        }

        const { nombre_configuracion, webhook_url, webhook_token } = datos
        const sessionId = crypto.randomUUID()

        const [result] = await db.execute(`
            INSERT INTO configuraciones_baileys (
                nombre_configuracion,
                session_id,
                webhook_url,
                webhook_token,
                estado_conexion,
                fecha_creacion
            ) VALUES (?, ?, ?, ?, 'desconectado', NOW())
        `, [nombre_configuracion, sessionId, webhook_url || null, webhook_token || null])

        return {
            success: true,
            configId: result.insertId,
            sessionId: sessionId,
            message: 'Configuración Baileys creada exitosamente'
        }

    } catch (error) {
        console.log('Error al crear configuración Baileys:', error)
        throw error
    }
}

// Función para conectar WhatsApp con Baileys
export async function conectarWhatsAppBaileys(configId) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        if (usuario.rol === 'usuario') {
            throw new Error('Sin permisos para conectar WhatsApp')
        }

        const [configRows] = await db.execute(`
            SELECT * FROM configuraciones_baileys WHERE id = ?
        `, [configId])

        if (configRows.length === 0) {
            throw new Error('Configuración no encontrada')
        }

        const config = configRows[0]

        console.log('Iniciando conexión Baileys para:', config.nombre_configuracion)

        // Actualizar estado a conectando
        await db.execute(`
            UPDATE configuraciones_baileys SET 
                estado_conexion = 'conectando',
                fecha_actualizacion = NOW()
            WHERE id = ?
        `, [configId])

        // Iniciar Baileys
        const resultado = await iniciarBaileys(config)
        
        return resultado

    } catch (error) {
        console.log('Error al conectar Baileys:', error)
        
        await db.execute(`
            UPDATE configuraciones_baileys SET 
                estado_conexion = 'error',
                fecha_actualizacion = NOW()
            WHERE id = ?
        `, [configId])

        throw error
    }
}

// Función para iniciar Baileys
async function iniciarBaileys(config) {
    try {
        const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = await import('baileys')
        const { Boom } = await import('@hapi/boom')
        const QRCode = await import('qrcode')
        const pino = await import('pino')

        const sessionDir = path.join(process.cwd(), 'baileys_sessions', config.session_id)
        
        if (!fs.existsSync(sessionDir)) {
            fs.mkdirSync(sessionDir, { recursive: true })
        }

        const { state, saveCreds } = await useMultiFileAuthState(sessionDir)
        
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: pino.default({ level: 'silent' }),
            browser: ['CRM WhatsApp', 'Chrome', '1.0.0']
        })

        baileysInstances.set(config.id, sock)

        return new Promise((resolve) => {
            sock.ev.on('creds.update', saveCreds)
            
            sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update
                
                if (qr) {
                    try {
                        const qrString = await QRCode.default.toDataURL(qr)
                        
                        await db.execute(`
                            UPDATE configuraciones_baileys SET 
                                qr_code = ?,
                                estado_conexion = 'qr_generado',
                                fecha_actualizacion = NOW()
                            WHERE id = ?
                        `, [qrString, config.id])

                        console.log('QR generado para configuración:', config.id)
                        
                        resolve({
                            success: true,
                            qr: qrString,
                            message: 'QR generado exitosamente'
                        })
                        
                    } catch (qrError) {
                        console.log('Error generando QR:', qrError)
                        resolve({
                            success: false,
                            message: 'Error al generar QR'
                        })
                    }
                }
                
                if (connection === 'close') {
                    const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut
                    
                    console.log('Conexión cerrada:', lastDisconnect?.error?.output?.statusCode)
                    
                    if (shouldReconnect) {
                        console.log('Reintentando conexión...')
                        setTimeout(() => iniciarBaileys(config), 5000)
                    } else {
                        await db.execute(`
                            UPDATE configuraciones_baileys SET 
                                estado_conexion = 'desconectado',
                                qr_code = NULL,
                                numero_whatsapp = NULL,
                                nombre_whatsapp = NULL,
                                foto_perfil_url = NULL,
                                fecha_actualizacion = NOW()
                            WHERE id = ?
                        `, [config.id])
                        
                        // Remover de configuraciones activas si era la activa
                        await db.execute(`
                            DELETE FROM configuraciones_activas 
                            WHERE plataforma = 'whatsapp' AND tipo_config = 'baileys' AND config_id = ?
                        `, [config.id])
                        
                        baileysInstances.delete(config.id)
                        
                        const sessionDir = path.join(process.cwd(), 'baileys_sessions', config.session_id)
                        if (fs.existsSync(sessionDir)) {
                            fs.rmSync(sessionDir, { recursive: true, force: true })
                        }
                    }
                    
                    await db.execute(`
                        UPDATE configuraciones_baileys SET 
                            estado_conexion = 'desconectado',
                            fecha_actualizacion = NOW()
                        WHERE id = ?
                    `, [config.id])
                    
                } else if (connection === 'open') {
                    console.log('WhatsApp Baileys conectado exitosamente')
                    
                    const userInfo = sock.user
                    
                    // Actualizar información de conexión
                    await db.execute(`
                        UPDATE configuraciones_baileys SET 
                            estado_conexion = 'conectado',
                            qr_code = NULL,
                            numero_whatsapp = ?,
                            nombre_whatsapp = ?,
                            foto_perfil_url = ?,
                            fecha_ultima_conexion = NOW(),
                            fecha_actualizacion = NOW()
                        WHERE id = ?
                    `, [
                        userInfo?.id?.split(':')[0] || null,
                        userInfo?.name || null,
                        userInfo?.imgUrl || null,
                        config.id
                    ])
                    
                    console.log('Información de usuario actualizada:', userInfo)
                    configurarManejadoresMensajes(sock, config)
                }
            })
            
            setTimeout(() => {
                if (!baileysInstances.has(config.id)) {
                    resolve({
                        success: false,
                        message: 'Timeout al generar QR'
                    })
                }
            }, 30000)
        })

    } catch (error) {
        console.log('Error iniciando Baileys:', error)
        
        await db.execute(`
            UPDATE configuraciones_baileys SET 
                estado_conexion = 'error',
                fecha_actualizacion = NOW()
            WHERE id = ?
        `, [config.id])

        return {
            success: false,
            message: 'Error al iniciar Baileys: ' + error.message
        }
    }
}

// Función para configurar manejadores de mensajes
function configurarManejadoresMensajes(sock, config) {
    sock.ev.on('messages.upsert', async (m) => {
        const mensaje = m.messages[0]
        
        if (!mensaje.message || mensaje.key.fromMe) return
        
        try {
            await procesarMensajeEntrante(mensaje, config, sock)
        } catch (error) {
            console.log('Error procesando mensaje:', error)
        }
    })
    
    sock.ev.on('messages.update', async (updates) => {
        for (const update of updates) {
            try {
                await actualizarEstadoMensaje(update, config)
            } catch (error) {
                console.log('Error actualizando estado:', error)
            }
        }
    })
}

// Función para procesar mensajes entrantes de Baileys
async function procesarMensajeEntrante(mensaje, config, sock) {
    try {
        const remoteJid = mensaje.key.remoteJid
        const contenido = mensaje.message?.conversation || 
                         mensaje.message?.extendedTextMessage?.text || 
                         'Mensaje multimedia'
        
        console.log(`[BAILEYS] Procesando mensaje de ${remoteJid}: ${contenido}`)

        let [contactoRows] = await db.execute(`
            SELECT id FROM contactos WHERE whatsapp_id = ?
        `, [remoteJid])

        let contactoId
        if (contactoRows.length === 0) {
            const pushName = mensaje.pushName || 'Sin nombre'
            
            const [resultado] = await db.execute(`
                INSERT INTO contactos (
                    whatsapp_id,
                    nombre,
                    telefono,
                    origen,
                    estado,
                    primera_interaccion,
                    fecha_creacion
                ) VALUES (?, ?, ?, 'whatsapp', 'nuevo', NOW(), NOW())
            `, [remoteJid, pushName, remoteJid.split('@')[0]])
            
            contactoId = resultado.insertId
            console.log(`[BAILEYS] Contacto creado: ${contactoId}`)
        } else {
            contactoId = contactoRows[0].id
        }

        let [conversacionRows] = await db.execute(`
            SELECT id FROM conversaciones 
            WHERE contacto_id = ? AND plataforma = 'whatsapp' AND whatsapp_tipo = 'baileys' AND estado != 'cerrada'
        `, [contactoId])

        let conversacionId
        if (conversacionRows.length === 0) {
            const [resultado] = await db.execute(`
                INSERT INTO conversaciones (
                    contacto_id,
                    plataforma,
                    whatsapp_tipo,
                    estado,
                    fecha_inicio,
                    fecha_ultima_actividad
                ) VALUES (?, 'whatsapp', 'baileys', 'abierta', NOW(), NOW())
            `, [contactoId])
            
            conversacionId = resultado.insertId
            console.log(`[BAILEYS] Conversación creada: ${conversacionId}`)
        } else {
            conversacionId = conversacionRows[0].id
        }

        // INSERTAR MENSAJE
        await db.execute(`
            INSERT INTO mensajes (
                conversacion_id,
                contacto_id,
                mensaje_id_externo,
                tipo_mensaje,
                contenido,
                direccion,
                estado_entrega,
                fecha_envio
            ) VALUES (?, ?, ?, 'texto', ?, 'entrante', 'entregado', NOW())
        `, [
            conversacionId,
            contactoId,
            mensaje.key.id,
            contenido
        ])

        // ACTUALIZAR CONVERSACIÓN
        await db.execute(`
            UPDATE conversaciones SET 
                fecha_ultima_actividad = NOW(),
                mensajes_contacto = mensajes_contacto + 1,
                total_mensajes = total_mensajes + 1
            WHERE id = ?
        `, [conversacionId])

        await db.execute(`
            UPDATE contactos SET ultima_interaccion = NOW() WHERE id = ?
        `, [contactoId])

        console.log(`[BAILEYS] Mensaje guardado en BD`)

        // **CRÍTICO: EJECUTAR AUTOMATIZACIONES AQUÍ**
        try {
            console.log(`[BAILEYS] Ejecutando automatizaciones para conversación ${conversacionId}`)
            const { procesarMensajeParaAutomatizaciones } = await import('../automatizacion/servidor')
            
            const resultadoAuto = await procesarMensajeParaAutomatizaciones(conversacionId, {
                contenido: contenido,
                tipo_mensaje: 'texto',
                direccion: 'entrante'
            })
            
            console.log(`[BAILEYS] Automatizaciones procesadas:`, resultadoAuto)
        } catch (autoError) {
            console.log('[BAILEYS] Error ejecutando automatizaciones:', autoError)
        }

        console.log('[BAILEYS] Mensaje procesado completamente')

    } catch (error) {
        console.log('[BAILEYS] Error procesando mensaje entrante:', error)
    }
}

// Función para actualizar estado de mensaje
async function actualizarEstadoMensaje(update, config) {
    try {
        const { key, update: messageUpdate } = update
        
        if (!key?.id) return
        
        let nuevoEstado = 'enviado'
        if (messageUpdate?.status === 3) nuevoEstado = 'leido'
        else if (messageUpdate?.status === 2) nuevoEstado = 'entregado'
        
        await db.execute(`
            UPDATE mensajes SET 
                estado_entrega = ?,
                timestamp_entrega = CASE WHEN ? = 'entregado' THEN NOW() ELSE timestamp_entrega END,
                timestamp_leido = CASE WHEN ? = 'leido' THEN NOW() ELSE timestamp_leido END
            WHERE mensaje_id_externo = ?
        `, [nuevoEstado, nuevoEstado, nuevoEstado, key.id])

    } catch (error) {
        console.log('Error actualizando estado mensaje:', error)
    }
}

// Función para verificar estado de conexión
export async function verificarEstadoConexion(plataforma, configId) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        if (plataforma === 'whatsapp') {
            // Verificar si es configuración Baileys
            const [baileysRows] = await db.execute(`
                SELECT 'baileys' as tipo FROM configuraciones_baileys WHERE id = ?
            `, [configId])

            if (baileysRows.length > 0) {
                return await verificarEstadoBaileys(configId)
            } else {
                // Es configuración WhatsApp API
                const [apiRows] = await db.execute(`
                    SELECT * FROM configuraciones_whatsapp WHERE id = ?
                `, [configId])

                if (apiRows.length === 0) {
                    return { conectado: false, mensaje: 'Configuración no encontrada' }
                }

                return await verificarConexionWhatsAppAPI(apiRows[0], configId)
            }
        }

        // Para otras plataformas
        let tableName
        switch (plataforma) {
            case 'instagram':
                tableName = 'configuraciones_instagram'
                break
            case 'facebook':
                tableName = 'configuraciones_facebook'
                break
            default:
                throw new Error('Plataforma no válida')
        }

        const [configRows] = await db.execute(`
            SELECT * FROM ${tableName} WHERE id = ?
        `, [configId])

        if (configRows.length === 0) {
            throw new Error('Configuración no encontrada')
        }

        const config = configRows[0]
        let estadoConexion = { conectado: false, mensaje: 'Sin conexión' }

        switch (plataforma) {
            case 'instagram':
                estadoConexion = await verificarConexionInstagram(config, configId)
                break
            case 'facebook':
                estadoConexion = await verificarConexionFacebook(config, configId)
                break
        }

        return estadoConexion

    } catch (error) {
        console.log('Error al verificar estado:', error)
        return { conectado: false, mensaje: 'Error al verificar conexión' }
    }
}

// Función para verificar estado de Baileys
export async function verificarEstadoBaileys(configId) {
    try {
        const [rows] = await db.execute(`
            SELECT * FROM configuraciones_baileys WHERE id = ?
        `, [configId])

        if (rows.length === 0) {
            return { conectado: false, mensaje: 'Configuración no encontrada' }
        }

        const config = rows[0]
        const sock = baileysInstances.get(configId)
        
        // Verificar si es la configuración activa
        const configActiva = await obtenerConfiguracionActiva('whatsapp')
        const esActiva = configActiva && 
                        configActiva.tipo_config === 'baileys' && 
                        configActiva.config_id === configId
        
        return {
            conectado: config.estado_conexion === 'conectado' && !!sock,
            estado: config.estado_conexion,
            qr: config.qr_code,
            numero: config.numero_whatsapp,
            nombre: config.nombre_whatsapp,
            es_activa: esActiva,
            ultima_conexion: config.fecha_ultima_conexion,
            mensaje: config.estado_conexion === 'conectado' ? 'Conectado correctamente' : 
                    config.estado_conexion === 'qr_generado' ? 'QR generado, esperando escaneo' :
                    config.estado_conexion === 'conectando' ? 'Conectando...' :
                    config.estado_conexion === 'error' ? 'Error en la conexión' :
                    'Desconectado'
        }

    } catch (error) {
        console.log('Error verificando estado Baileys:', error)
        return { conectado: false, mensaje: 'Error al verificar estado' }
    }
}

// Función para verificar conexión de WhatsApp API
async function verificarConexionWhatsAppAPI(config, configId) {
    try {
        console.log('Verificando conexión WhatsApp API para:', config.nombre_configuracion)

        await new Promise(resolve => setTimeout(resolve, 500))

        // Verificar si es la configuración activa
        const configActiva = await obtenerConfiguracionActiva('whatsapp')
        const esActiva = configActiva && 
                        configActiva.tipo_config === 'api' && 
                        configActiva.config_id === configId

        const conectado = config.access_token && config.phone_number_id

        return {
            conectado: conectado && esActiva,
            es_activa: esActiva,
            mensaje: conectado ? (esActiva ? 'Configuración activa' : 'Configuración disponible') : 'Configuración incompleta',
            ultima_verificacion: new Date().toISOString()
        }

    } catch (error) {
        console.log('Error al verificar WhatsApp API:', error)
        return { conectado: false, mensaje: 'Error en la verificación' }
    }
}

// Función para verificar conexión de Instagram
async function verificarConexionInstagram(config, configId) {
    try {
        console.log('Verificando conexión Instagram para:', config.nombre_configuracion)

        await new Promise(resolve => setTimeout(resolve, 500))
        const tokenValido = config.access_token && config.access_token.length > 50

        return {
            conectado: tokenValido,
            es_activa: false,
            mensaje: tokenValido ? 'Token válido' : 'Token inválido o vacío',
            ultima_verificacion: new Date().toISOString()
        }

    } catch (error) {
        console.log('Error al verificar Instagram:', error)
        return { conectado: false, mensaje: 'Error en la verificación' }
    }
}

// Función para verificar conexión de Facebook
async function verificarConexionFacebook(config, configId) {
    try {
        console.log('Verificando conexión Facebook para:', config.nombre_configuracion)

        await new Promise(resolve => setTimeout(resolve, 500))
        const tokenValido = config.page_access_token && config.page_access_token.length > 50

        return {
            conectado: tokenValido,
            es_activa: false,
            mensaje: tokenValido ? 'Token válido' : 'Token inválido o vacío',
            ultima_verificacion: new Date().toISOString()
        }

    } catch (error) {
        console.log('Error al verificar Facebook:', error)
        return { conectado: false, mensaje: 'Error en la verificación' }
    }
}

// Función para guardar configuración de WhatsApp API
export async function guardarConfiguracionWhatsApp(datos, configId = null) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        if (usuario.rol === 'usuario') {
            throw new Error('Sin permisos para guardar configuraciones')
        }

        if (!configId) {
            const [apiRows] = await db.execute(`SELECT COUNT(*) as total FROM configuraciones_whatsapp`)
            if (apiRows[0].total >= 1) {
                throw new Error('Solo se permite una configuración de WhatsApp API')
            }
        }

        const {
            nombre_configuracion,
            phone_number_id,
            access_token,
            webhook_verify_token,
            business_account_id
        } = datos

        if (configId) {
            await db.execute(`
                UPDATE configuraciones_whatsapp SET
                    nombre_configuracion = ?,
                    phone_number_id = ?,
                    access_token = ?,
                    webhook_verify_token = ?,
                    business_account_id = ?,
                    fecha_actualizacion = NOW()
                WHERE id = ?
            `, [
                nombre_configuracion,
                phone_number_id,
                access_token,
                webhook_verify_token,
                business_account_id || null,
                configId
            ])
        } else {
            await db.execute(`
                INSERT INTO configuraciones_whatsapp (
                    nombre_configuracion,
                    phone_number_id,
                    access_token,
                    webhook_verify_token,
                    business_account_id,
                    fecha_creacion
                ) VALUES (?, ?, ?, ?, ?, NOW())
            `, [
                nombre_configuracion,
                phone_number_id,
                access_token,
                webhook_verify_token,
                business_account_id || null
            ])
        }

        return {
            success: true,
            message: configId ? 'Configuración actualizada exitosamente' : 'Configuración creada exitosamente'
        }

    } catch (error) {
        console.log('Error al guardar configuración WhatsApp:', error)
        throw error
    }
}

// Función para guardar configuración de Instagram
export async function guardarConfiguracionInstagram(datos, configId = null) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        if (usuario.rol === 'usuario') {
            throw new Error('Sin permisos para guardar configuraciones')
        }

        if (!configId) {
            const limite = await verificarLimiteConfiguraciones('instagram')
            if (!limite.puede) {
                throw new Error(limite.mensaje)
            }
        }

        const {
            nombre_configuracion,
            instagram_business_id,
            access_token,
            webhook_verify_token
        } = datos

        if (configId) {
            await db.execute(`
                UPDATE configuraciones_instagram SET
                    nombre_configuracion = ?,
                    instagram_business_id = ?,
                    access_token = ?,
                    webhook_verify_token = ?,
                    fecha_actualizacion = NOW()
                WHERE id = ?
            `, [
                nombre_configuracion,
                instagram_business_id,
                access_token,
                webhook_verify_token,
                configId
            ])
        } else {
            await db.execute(`
                INSERT INTO configuraciones_instagram (
                    nombre_configuracion,
                    instagram_business_id,
                    access_token,
                    webhook_verify_token,
                    fecha_creacion
                ) VALUES (?, ?, ?, ?, NOW())
            `, [
                nombre_configuracion,
                instagram_business_id,
                access_token,
                webhook_verify_token
            ])
        }

        return {
            success: true,
            message: configId ? 'Configuración actualizada exitosamente' : 'Configuración creada exitosamente'
        }

    } catch (error) {
        console.log('Error al guardar configuración Instagram:', error)
        throw error
    }
}

// Función para guardar configuración de Facebook
export async function guardarConfiguracionFacebook(datos, configId = null) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        if (usuario.rol === 'usuario') {
            throw new Error('Sin permisos para guardar configuraciones')
        }

        if (!configId) {
            const limite = await verificarLimiteConfiguraciones('facebook')
            if (!limite.puede) {
                throw new Error(limite.mensaje)
            }
        }

        const {
            nombre_configuracion,
            page_id,
            page_access_token,
            app_id,
            app_secret,
            webhook_verify_token
        } = datos

        if (configId) {
            await db.execute(`
                UPDATE configuraciones_facebook SET
                    nombre_configuracion = ?,
                    page_id = ?,
                    page_access_token = ?,
                    app_id = ?,
                    app_secret = ?,
                    webhook_verify_token = ?,
                    fecha_actualizacion = NOW()
                WHERE id = ?
            `, [
                nombre_configuracion,
                page_id,
                page_access_token,
                app_id,
                app_secret,
                webhook_verify_token,
                configId
            ])
        } else {
            await db.execute(`
                INSERT INTO configuraciones_facebook (
                    nombre_configuracion,
                    page_id,
                    page_access_token,
                    app_id,
                    app_secret,
                    webhook_verify_token,
                    fecha_creacion
                ) VALUES (?, ?, ?, ?, ?, ?, NOW())
            `, [
                nombre_configuracion,
                page_id,
                page_access_token,
                app_id,
                app_secret,
                webhook_verify_token
            ])
        }

        return {
            success: true,
            message: configId ? 'Configuración actualizada exitosamente' : 'Configuración creada exitosamente'
        }

    } catch (error) {
        console.log('Error al guardar configuración Facebook:', error)
        throw error
    }
}

// Función para desconectar plataforma
export async function desconectarPlataforma(plataforma, configId) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        if (usuario.rol === 'usuario') {
            throw new Error('Sin permisos para desconectar')
        }

        if (plataforma === 'whatsapp') {
            // Verificar si es Baileys
            const [baileysRows] = await db.execute(`
                SELECT id FROM configuraciones_baileys WHERE id = ?
            `, [configId])

            if (baileysRows.length > 0) {
                return await desconectarBaileys(configId)
            } else {
                // Es WhatsApp API - remover de configuraciones activas
                await db.execute(`
                    DELETE FROM configuraciones_activas 
                    WHERE plataforma = 'whatsapp' AND tipo_config = 'api' AND config_id = ?
                `, [configId])

                return {
                    success: true,
                    message: 'WhatsApp API desactivado'
                }
            }
        }

        // Para otras plataformas
        return {
            success: true,
            message: 'Desconectado exitosamente'
        }

    } catch (error) {
        console.log('Error al desconectar:', error)
        throw error
    }
}

// Función para desconectar Baileys
export async function desconectarBaileys(configId) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        if (usuario.rol === 'usuario') {
            throw new Error('Sin permisos para desconectar')
        }

        const [configRows] = await db.execute(`
            SELECT * FROM configuraciones_baileys WHERE id = ?
        `, [configId])

        if (configRows.length === 0) {
            throw new Error('Configuración no encontrada')
        }

        const config = configRows[0]
        const sock = baileysInstances.get(configId)
        
        if (sock) {
            await sock.logout()
            baileysInstances.delete(configId)
        }

        // Actualizar base de datos
        await db.execute(`
            UPDATE configuraciones_baileys SET 
                estado_conexion = 'desconectado',
                qr_code = NULL,
                fecha_actualizacion = NOW()
            WHERE id = ?
        `, [configId])

        // Remover de configuraciones activas
        await db.execute(`
            DELETE FROM configuraciones_activas 
            WHERE plataforma = 'whatsapp' AND tipo_config = 'baileys' AND config_id = ?
        `, [configId])

        // Limpiar archivos de sesión
        const sessionDir = path.join(process.cwd(), 'baileys_sessions', config.session_id)
        if (fs.existsSync(sessionDir)) {
            fs.rmSync(sessionDir, { recursive: true, force: true })
        }

        return {
            success: true,
            message: 'Baileys desconectado exitosamente'
        }

    } catch (error) {
        console.log('Error desconectando Baileys:', error)
        throw error
    }
}

// Función para probar conexión
export async function probarConexionPlataforma(plataforma, configId) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        if (usuario.rol === 'usuario') {
            throw new Error('Sin permisos para probar conexiones')
        }

        const estado = await verificarEstadoConexion(plataforma, configId)

        if (estado.conectado) {
            return {
                success: true,
                message: 'Conexión verificada exitosamente'
            }
        } else {
            return {
                success: false,
                message: `No conectado: ${estado.mensaje}`
            }
        }

    } catch (error) {
        console.log('Error al probar conexión:', error)
        return {
            success: false,
            message: 'Error al probar la conexión'
        }
    }
}

// Función para reiniciar Baileys
export async function reiniciarBaileys(configId) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        if (usuario.rol === 'usuario') {
            throw new Error('Sin permisos para reiniciar conexiones')
        }

        // Desconectar primero si está conectado
        const sock = baileysInstances.get(configId)
        if (sock) {
            try {
                await sock.end()
            } catch (e) {
                console.log('Error cerrando conexión anterior:', e)
            }
            baileysInstances.delete(configId)
        }

        // Limpiar QR anterior
        await db.execute(`
            UPDATE configuraciones_baileys SET 
                qr_code = NULL,
                estado_conexion = 'desconectado'
            WHERE id = ?
        `, [configId])

        // Reconectar
        const resultado = await conectarWhatsAppBaileys(configId)
        
        return resultado

    } catch (error) {
        console.log('Error reiniciando Baileys:', error)
        throw error
    }
}

// Función para limpiar instancias inactivas
export async function limpiarInstanciasBaileys() {
    try {
        const instanciasActivas = Array.from(baileysInstances.keys())
        
        for (const configId of instanciasActivas) {
            const [rows] = await db.execute(`
                SELECT estado_conexion FROM configuraciones_baileys WHERE id = ?
            `, [configId])

            if (rows.length === 0 || rows[0].estado_conexion !== 'conectado') {
                const sock = baileysInstances.get(configId)
                if (sock) {
                    try {
                        await sock.end()
                    } catch (e) {
                        console.log('Error cerrando instancia:', e)
                    }
                }
                baileysInstances.delete(configId)
                console.log('Instancia Baileys limpiada:', configId)
            }
        }

    } catch (error) {
        console.log('Error limpiando instancias:', error)
    }
}
export async function enviarMensajeBaileys(conversacionId, contenido) {
    try {
        console.log(`[BAILEYS] Intentando enviar mensaje a conversación ${conversacionId}`)

        const [conversacionRows] = await db.execute(`
            SELECT conv.*, c.whatsapp_id 
            FROM conversaciones conv
            INNER JOIN contactos c ON conv.contacto_id = c.id
            WHERE conv.id = ?
        `, [conversacionId])

        if (conversacionRows.length === 0) {
            throw new Error('Conversación no encontrada')
        }

        const conversacion = conversacionRows[0]
        console.log(`[BAILEYS] Enviando a WhatsApp ID: ${conversacion.whatsapp_id}`)
        
        // Obtener instancia Baileys activa
        const [configRows] = await db.execute(`
            SELECT cb.id
            FROM configuraciones_activas ca
            INNER JOIN configuraciones_baileys cb ON ca.config_id = cb.id
            WHERE ca.plataforma = 'whatsapp' AND ca.tipo_config = 'baileys'
        `)

        if (configRows.length === 0) {
            console.log('[BAILEYS] No hay configuración Baileys activa')
            throw new Error('No hay configuración Baileys activa')
        }

        const configId = configRows[0].id
        const sock = baileysInstances.get(configId)

        if (!sock) {
            console.log(`[BAILEYS] Instancia no encontrada para config ${configId}`)
            console.log(`[BAILEYS] Instancias disponibles:`, Array.from(baileysInstances.keys()))
            throw new Error('Instancia Baileys no encontrada o desconectada')
        }

        console.log(`[BAILEYS] Enviando mensaje: "${contenido}"`)

        // Enviar mensaje
        const result = await sock.sendMessage(conversacion.whatsapp_id, { text: contenido })
        
        console.log(`[BAILEYS] Mensaje enviado exitosamente`)

        return { 
            success: true, 
            message: 'Mensaje enviado via Baileys',
            messageId: result?.key?.id || `baileys_${Date.now()}`
        }

    } catch (error) {
        console.log('[BAILEYS] Error enviando mensaje:', error)
        return { 
            success: false, 
            error: error.message 
        }
    }
}
// Ejecutar limpieza cada 5 minutos
setInterval(limpiarInstanciasBaileys, 5 * 60 * 1000)