// _services/messageService.js
import db from "../_DB/db"

export class MessageService {
    static async sendUnifiedMessage(conversacion, mensaje) {
        try {
            const { plataforma } = conversacion
            
            switch (plataforma) {
                case 'whatsapp':
                    return await this.sendWhatsAppMessage(conversacion, mensaje)
                case 'instagram':
                    return await this.sendInstagramMessage(conversacion, mensaje)
                case 'facebook':
                    return await this.sendFacebookMessage(conversacion, mensaje)
                default:
                    throw new Error(`Plataforma ${plataforma} no soportada`)
            }
        } catch (error) {
            console.log('Error en envio unificado:', error)
            throw error
        }
    }

    static async sendWhatsAppMessage(conversacion, mensaje) {
        try {
            let [configActiva] = await db.execute(`
                SELECT ca.*, 
                       cb.session_id, 
                       cw.phone_number_id, 
                       cw.access_token
                FROM configuraciones_activas ca
                LEFT JOIN configuraciones_baileys cb ON ca.config_id = cb.id AND ca.tipo_config = 'baileys'
                LEFT JOIN configuraciones_whatsapp cw ON ca.config_id = cw.id AND ca.tipo_config = 'api'
                WHERE ca.plataforma = 'whatsapp'
            `)

            if (configActiva.length > 0) {
                const config = configActiva[0]
                if (config.tipo_config === 'baileys') {
                    return await this.sendViaBaileys(conversacion, mensaje, config)
                } else if (config.tipo_config === 'api') {
                    return await this.sendViaWhatsAppAPI(conversacion, mensaje, config)
                }
            }

            console.log('No hay configuracion activa, buscando configuraciones principales...')
            
            const [whatsappConfigs] = await db.execute(`
                SELECT 'api' as tipo_config, phone_number_id, access_token 
                FROM configuraciones_whatsapp 
                ORDER BY fecha_creacion DESC LIMIT 1
            `)
            
            if (whatsappConfigs.length > 0) {
                const config = whatsappConfigs[0]
                return await this.sendViaWhatsAppAPI(conversacion, mensaje, config)
            }
            
            const [baileysConfigs] = await db.execute(`
                SELECT 'baileys' as tipo_config, session_id 
                FROM configuraciones_baileys 
                WHERE estado_conexion = 'conectado'
                ORDER BY fecha_creacion DESC LIMIT 1
            `)
            
            if (baileysConfigs.length > 0) {
                const config = baileysConfigs[0]
                return await this.sendViaBaileys(conversacion, mensaje, config)
            }
            
            throw new Error('No hay configuracion de WhatsApp disponible')

        } catch (error) {
            console.log('Error enviando WhatsApp:', error)
            return { success: false, error: error.message }
        }
    }

    static async sendViaWhatsAppAPI(conversacion, mensaje, config) {
        try {
            const response = await fetch(`https://graph.facebook.com/v18.0/${config.phone_number_id}/messages`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${config.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    messaging_product: 'whatsapp',
                    to: conversacion.whatsapp_id || conversacion.contacto_telefono,
                    type: 'text',
                    text: {
                        body: mensaje.contenido
                    }
                })
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error?.message || 'Error en WhatsApp API')
            }

            const data = await response.json()
            return { 
                success: true, 
                messageId: data.messages?.[0]?.id || null,
                platform: 'whatsapp'
            }

        } catch (error) {
            console.log('Error en WhatsApp API:', error)
            return { success: false, error: error.message }
        }
    }

    static async sendViaBaileys(conversacion, mensaje, config) {
        try {
            const { enviarMensajeBaileys } = await import('../_Pages/configuracionredes/servidor')
            const resultado = await enviarMensajeBaileys(conversacion.id, mensaje.contenido)
            return resultado
        } catch (error) {
            console.log('Error en Baileys:', error)
            return { success: false, error: error.message }
        }
    }

    static async sendInstagramMessage(conversacion, mensaje) {
        try {
            let [configRows] = await db.execute(`
                SELECT ci.* FROM configuraciones_activas ca
                INNER JOIN configuraciones_instagram ci ON ca.config_id = ci.id
                WHERE ca.plataforma = 'instagram'
                LIMIT 1
            `)

            if (configRows.length === 0) {
                console.log('No hay configuracion activa de Instagram, buscando configuraciones principales...')
                const [principalConfig] = await db.execute(`
                    SELECT * FROM configuraciones_instagram 
                    ORDER BY fecha_creacion DESC 
                    LIMIT 1
                `)
                configRows = principalConfig
            }

            if (configRows.length === 0) {
                console.log('No hay configuracion principal de Instagram, usando configuracion de prueba...')
                const [pruebaConfig] = await db.execute(`
                    SELECT 
                        instagram_business_id,
                        'TU_TOKEN_AQUI' as access_token
                    FROM instagram_business_accounts 
                    WHERE activa = 1 
                    ORDER BY fecha_vinculacion DESC 
                    LIMIT 1
                `)
                configRows = pruebaConfig
            }

            if (configRows.length === 0) {
                throw new Error('No hay configuracion de Instagram disponible')
            }

            const config = configRows[0]

            const response = await fetch(`https://graph.facebook.com/v18.0/me/messages`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${config.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    recipient: {
                        id: conversacion.instagram_id
                    },
                    message: {
                        text: mensaje.contenido
                    }
                })
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error?.message || 'Error en Instagram API')
            }

            const data = await response.json()
            return { 
                success: true, 
                messageId: data.message_id || null,
                platform: 'instagram'
            }

        } catch (error) {
            console.log('Error enviando Instagram:', error)
            return { success: false, error: error.message }
        }
    }

    static async sendFacebookMessage(conversacion, mensaje) {
        try {
            let [configRows] = await db.execute(`
                SELECT cf.* FROM configuraciones_activas ca
                INNER JOIN configuraciones_facebook cf ON ca.config_id = cf.id
                WHERE ca.plataforma = 'facebook'
                LIMIT 1
            `)

            if (configRows.length === 0) {
                console.log('No hay configuracion activa de Facebook, buscando configuraciones principales...')
                const [principalConfig] = await db.execute(`
                    SELECT * FROM configuraciones_facebook 
                    ORDER BY fecha_creacion DESC 
                    LIMIT 1
                `)
                configRows = principalConfig
            }

            if (configRows.length === 0) {
                throw new Error('No hay configuracion de Facebook disponible')
            }

            const config = configRows[0]

            const response = await fetch(`https://graph.facebook.com/v18.0/me/messages`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${config.page_access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    recipient: {
                        id: conversacion.facebook_id
                    },
                    message: {
                        text: mensaje.contenido
                    }
                })
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error?.message || 'Error en Facebook API')
            }

            const data = await response.json()
            return { 
                success: true, 
                messageId: data.message_id || null,
                platform: 'facebook'
            }

        } catch (error) {
            console.log('Error enviando Facebook:', error)
            return { success: false, error: error.message }
        }
    }

    static async sendToContact(contacto, plataforma, mensaje) {
        try {
            let recipientId = null
            let numeroTelefono = null

            switch (plataforma) {
                case 'whatsapp':
                    recipientId = contacto.whatsapp_id
                    numeroTelefono = contacto.telefono
                    break
                case 'instagram':
                    recipientId = contacto.instagram_id
                    break
                case 'facebook':
                    recipientId = contacto.facebook_id
                    break
                default:
                    throw new Error(`Plataforma ${plataforma} no soportada`)
            }

            if (!recipientId && !numeroTelefono) {
                throw new Error(`No se encontro ID para ${plataforma}`)
            }

            const conversacionSimulada = {
                id: null,
                plataforma: plataforma,
                whatsapp_id: recipientId,
                instagram_id: recipientId,
                facebook_id: recipientId,
                contacto_telefono: numeroTelefono
            }

            return await this.sendUnifiedMessage(conversacionSimulada, mensaje)

        } catch (error) {
            console.log('Error enviando a contacto:', error)
            throw error
        }
    }
}