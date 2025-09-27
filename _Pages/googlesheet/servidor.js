"use server"
import db from "@/_DB/db"
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { google } from 'googleapis'

const JWT_SECRET = process.env.JWT_SECRET || 'crm_whatsapp_facebook_2024'

export async function obtenerUsuarioActual() {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get('auth-token')
        
        console.log('=== DEBUG obtenerUsuarioActual ===')
        console.log('Token existe:', !!token)
        
        if (!token || !token.value) {
            console.log('No hay token de autenticación')
            return null
        }

        console.log('Token value length:', token.value.length)

        let decoded
        try {
            decoded = jwt.verify(token.value, JWT_SECRET)
            console.log('Token decodificado exitosamente, userId:', decoded.userId)
        } catch (error) {
            console.log('Error al verificar token:', error.message)
            return null
        }

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
            console.log('Usuario no encontrado o inactivo')
            return null
        }

        const usuario = rows[0]
        console.log('Usuario encontrado:', usuario.correo)

        const ahora = new Date()
        const ultimoAcceso = new Date(usuario.ultimo_acceso)
        const diferenciaMinutos = (ahora - ultimoAcceso) / (1000 * 60)

        if (diferenciaMinutos > 5) {
            await db.execute(`
                UPDATE usuarios 
                SET ultimo_acceso = CURRENT_TIMESTAMP 
                WHERE id = ?
            `, [userId])
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
        console.error('Error al obtener usuario actual:', error.message)
        return null
    }
}

export async function guardarConfiguracionGoogle(clientId, clientSecret, redirectUri) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        if (usuario.rol !== 'superadmin' && usuario.rol !== 'admin') {
            throw new Error('Sin permisos para configurar Google Sheets')
        }

        await db.execute(`
            UPDATE google_sheets_configuracion SET activa = 0
        `)

        await db.execute(`
            INSERT INTO google_sheets_configuracion (
                client_id,
                client_secret,
                redirect_uri,
                creada_por,
                activa
            ) VALUES (?, ?, ?, ?, 1)
        `, [clientId, clientSecret, redirectUri, usuario.id])

        return {
            success: true,
            message: 'Configuración de Google guardada exitosamente'
        }

    } catch (error) {
        console.log('Error al guardar configuración:', error)
        throw error
    }
}

export async function obtenerConfiguracionGoogleSheets() {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        const [configRows] = await db.execute(`
            SELECT id, client_id, redirect_uri, activa, fecha_creacion
            FROM google_sheets_configuracion 
            WHERE activa = 1 
            LIMIT 1
        `)

        const [conexionRows] = await db.execute(`
            SELECT * FROM google_sheets_conexiones 
            WHERE usuario_id = ? AND estado = 'conectado'
            ORDER BY fecha_creacion DESC 
            LIMIT 1
        `, [usuario.id])

        const [logRows] = await db.execute(`
            SELECT fecha_operacion, estado_operacion 
            FROM google_sheets_log 
            WHERE usuario_id = ? AND operacion = 'verificar_credenciales'
            ORDER BY fecha_operacion DESC 
            LIMIT 1
        `, [usuario.id])

        return {
            configuracion_guardada: configRows.length > 0,
            credenciales_validas: conexionRows.length > 0,
            ultima_verificacion: logRows.length > 0 ? logRows[0].fecha_operacion : null,
            configuracion: configRows.length > 0 ? {
                id: configRows[0].id,
                client_id: configRows[0].client_id,
                redirect_uri: configRows[0].redirect_uri,
                fecha_creacion: configRows[0].fecha_creacion
            } : null,
            conexion: conexionRows.length > 0 ? {
                id: conexionRows[0].id,
                email: conexionRows[0].email_google,
                estado: conexionRows[0].estado,
                fecha_conexion: conexionRows[0].fecha_conexion,
                ultima_sincronizacion: conexionRows[0].ultima_sincronizacion
            } : null
        }

    } catch (error) {
        console.log('Error al obtener configuración:', error)
        throw error
    }
}

async function obtenerConfiguracionActiva() {
    try {
        const [rows] = await db.execute(`
            SELECT client_id, client_secret, redirect_uri 
            FROM google_sheets_configuracion 
            WHERE activa = 1 
            LIMIT 1
        `)

        if (rows.length === 0) {
            throw new Error('No hay configuración activa de Google Sheets')
        }

        return rows[0]
    } catch (error) {
        console.log('Error al obtener configuración activa:', error)
        throw error
    }
}

export async function verificarCredenciales() {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        const config = await obtenerConfiguracionActiva()

        const oauth2Client = new google.auth.OAuth2(
            config.client_id,
            config.client_secret,
            config.redirect_uri
        )

        const scopes = [
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/drive.readonly',
            'https://www.googleapis.com/auth/userinfo.email'
        ]

        const authUrl = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: scopes,
            include_granted_scopes: true,
            prompt: 'consent'
        })

        await db.execute(`
            INSERT INTO google_sheets_log (
                usuario_id,
                operacion,
                estado_operacion,
                detalles
            ) VALUES (?, 'verificar_credenciales', 'exitoso', ?)
        `, [usuario.id, JSON.stringify({ 
            client_id: config.client_id,
            redirect_uri: config.redirect_uri 
        })])

        return {
            success: true,
            authUrl: authUrl,
            message: 'Credenciales verificadas exitosamente'
        }

    } catch (error) {
        console.log('Error al verificar credenciales:', error)
        
        const usuario = await obtenerUsuarioActual()
        if (usuario) {
            await db.execute(`
                INSERT INTO google_sheets_log (
                    usuario_id,
                    operacion,
                    estado_operacion,
                    mensaje_error
                ) VALUES (?, 'verificar_credenciales', 'fallido', ?)
            `, [usuario.id, error.message])
        }
        
        return {
            success: false,
            error: error.message
        }
    }
}

export async function procesarCallbackGoogle(code) {
    try {
        console.log('=== INICIANDO procesarCallbackGoogle ===')
        console.log('Código recibido:', code.substring(0, 20) + '...')
        
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            console.log('Usuario no autenticado en callback')
            throw new Error('Usuario no autenticado. Por favor, inicia sesión nuevamente.')
        }

        console.log('Usuario autenticado:', usuario.correo, 'ID:', usuario.id)

        const config = await obtenerConfiguracionActiva()
        console.log('Configuración obtenida:', config.client_id)

        const oauth2Client = new google.auth.OAuth2(
            config.client_id,
            config.client_secret,
            config.redirect_uri
        )

        console.log('Intercambiando código por tokens...')
        const { tokens } = await oauth2Client.getToken(code)
        console.log('Tokens obtenidos exitosamente')
        
        // DEBUG TOKENS RECIBIDOS
        console.log('Tokens recibidos:', {
            access_token: tokens.access_token ? 'EXISTS' : 'NULL',
            refresh_token: tokens.refresh_token ? 'EXISTS' : 'NULL',
            expiry_date: tokens.expiry_date || 'NULL'
        })
        
        oauth2Client.setCredentials(tokens)

        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
        console.log('Obteniendo información del usuario de Google...')
        const userInfo = await oauth2.userinfo.get()
        console.log('Info de Google obtenida:', userInfo.data.email)

        console.log('Guardando conexión en base de datos...')
        
        //  ASEGURAR QUE NO HAY UNDEFINED
        const refreshToken = tokens.refresh_token || null
        const expiryDate = tokens.expiry_date ? new Date(tokens.expiry_date) : null
        const googleUserId = userInfo.data.id || null
        const nombreGoogle = userInfo.data.name || null
        
        console.log('Valores a insertar:', {
            usuario_id: usuario.id,
            email_google: userInfo.data.email,
            google_user_id: googleUserId,
            nombre_google: nombreGoogle,
            refresh_token: refreshToken ? 'EXISTS' : 'NULL',
            expires_at: expiryDate ? expiryDate.toISOString() : 'NULL'
        })
        
        await db.execute(`
            INSERT INTO google_sheets_conexiones (
                usuario_id,
                email_google,
                google_user_id,
                nombre_google,
                access_token,
                refresh_token,
                expires_at,
                estado,
                fecha_conexion
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'conectado', NOW())
            ON DUPLICATE KEY UPDATE
                email_google = VALUES(email_google),
                google_user_id = VALUES(google_user_id),
                nombre_google = VALUES(nombre_google),
                access_token = VALUES(access_token),
                refresh_token = VALUES(refresh_token),
                expires_at = VALUES(expires_at),
                estado = 'conectado',
                fecha_conexion = NOW()
        `, [
            usuario.id,
            userInfo.data.email,
            googleUserId,
            nombreGoogle,
            tokens.access_token,
            refreshToken,
            expiryDate
        ])

        console.log('Conexión guardada en BD exitosamente')

        await db.execute(`
            INSERT INTO google_sheets_log (
                usuario_id,
                operacion,
                estado_operacion,
                detalles
            ) VALUES (?, 'conectar', 'exitoso', ?)
        `, [usuario.id, JSON.stringify({
            email: userInfo.data.email,
            nombre: nombreGoogle,
            google_user_id: googleUserId
        })])

        console.log('Log registrado exitosamente')

        return {
            success: true,
            message: 'Conectado exitosamente a Google Sheets',
            usuario: userInfo.data.email
        }

    } catch (error) {
        console.error(' ERROR DETALLADO en procesarCallbackGoogle:')
        console.error('Error message:', error.message)
        console.error('Error stack:', error.stack)
        
        try {
            const usuario = await obtenerUsuarioActual()
            if (usuario) {
                await db.execute(`
                    INSERT INTO google_sheets_log (
                        usuario_id,
                        operacion,
                        estado_operacion,
                        mensaje_error
                    ) VALUES (?, 'conectar', 'fallido', ?)
                `, [usuario.id, error.message])
            }
        } catch (logError) {
            console.error('Error al registrar log de error:', logError)
        }
        
        return {
            success: false,
            error: error.message
        }
    }
}

async function obtenerClienteAutenticado() {
    const usuario = await obtenerUsuarioActual()
    if (!usuario) {
        throw new Error('Usuario no autenticado')
    }

    const [conexionRows] = await db.execute(`
        SELECT * FROM google_sheets_conexiones 
        WHERE usuario_id = ? AND estado = 'conectado'
        LIMIT 1
    `, [usuario.id])

    if (conexionRows.length === 0) {
        throw new Error('No hay conexión activa con Google Sheets. Debe autorizar primero.')
    }

    const conexion = conexionRows[0]
    const config = await obtenerConfiguracionActiva()

    const oauth2Client = new google.auth.OAuth2(
        config.client_id,
        config.client_secret,
        config.redirect_uri
    )

    oauth2Client.setCredentials({
        access_token: conexion.access_token,
        refresh_token: conexion.refresh_token,
        expiry_date: conexion.expires_at
    })

    if (oauth2Client.isTokenExpiring()) {
        try {
            const { credentials } = await oauth2Client.refreshAccessToken()
            oauth2Client.setCredentials(credentials)
            
            await db.execute(`
                UPDATE google_sheets_conexiones 
                SET access_token = ?,
                    expires_at = ?
                WHERE usuario_id = ?
            `, [
                credentials.access_token,
                credentials.expiry_date ? new Date(credentials.expiry_date) : null,
                usuario.id
            ])
        } catch (refreshError) {
            console.log('Error al refrescar token:', refreshError)
            
            await db.execute(`
                UPDATE google_sheets_conexiones 
                SET estado = 'token_expirado'
                WHERE usuario_id = ?
            `, [usuario.id])
            
            throw new Error('Token expirado, debe volver a autorizar su cuenta')
        }
    }

    return oauth2Client
}

export async function obtenerSpreadsheets() {
    try {
        const auth = await obtenerClienteAutenticado()
        const drive = google.drive({ version: 'v3', auth })

        const response = await drive.files.list({
            q: "mimeType='application/vnd.google-apps.spreadsheet'",
            pageSize: 50,
            fields: 'files(id, name, createdTime, modifiedTime)',
            orderBy: 'modifiedTime desc'
        })

        const spreadsheets = []
        
        for (const file of response.data.files) {
            try {
                const sheets = google.sheets({ version: 'v4', auth })
                const sheetResponse = await sheets.spreadsheets.get({
                    spreadsheetId: file.id,
                    fields: 'sheets(properties(sheetId,title))'
                })

                spreadsheets.push({
                    id: file.id,
                    name: file.name,
                    createdTime: file.createdTime,
                    modifiedTime: file.modifiedTime,
                    sheets: sheetResponse.data.sheets.map(sheet => ({
                        id: sheet.properties.sheetId,
                        title: sheet.properties.title
                    }))
                })
            } catch (sheetError) {
                console.log(`Error al obtener detalles de ${file.name}:`, sheetError)
                spreadsheets.push({
                    id: file.id,
                    name: file.name,
                    createdTime: file.createdTime,
                    modifiedTime: file.modifiedTime,
                    sheets: []
                })
            }
        }

        return spreadsheets

    } catch (error) {
        console.log('Error al obtener spreadsheets:', error)
        throw error
    }
}

export async function obtenerDatosSheet(spreadsheetId, sheetName) {
    try {
        const auth = await obtenerClienteAutenticado()
        const sheets = google.sheets({ version: 'v4', auth })

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,
            range: `${sheetName}!A1:Z1000`,
            valueRenderOption: 'FORMATTED_VALUE'
        })

        const rows = response.data.values || []
        
        if (rows.length === 0) {
            return []
        }

        const headers = rows[0]
        const dataRows = rows.slice(1)

        return dataRows.map(row => {
            const obj = {}
            headers.forEach((header, index) => {
                obj[header] = row[index] || ''
            })
            return obj
        })

    } catch (error) {
        console.log('Error al obtener datos del sheet:', error)
        throw error
    }
}

export async function exportarContactosASheet(spreadsheetId, sheetName, incluirHeaders = true) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        const [contactos] = await db.execute(`
            SELECT 
                id,
                nombre,
                apellidos,
                telefono,
                email,
                whatsapp_id,
                instagram_id,
                facebook_id,
                ciudad,
                pais,
                estado,
                origen,
                primera_interaccion,
                ultima_interaccion,
                fecha_creacion
            FROM contactos
            ORDER BY fecha_creacion DESC
        `)

        const auth = await obtenerClienteAutenticado()
        const sheets = google.sheets({ version: 'v4', auth })

        const headers = [
            'ID', 'Nombre', 'Apellidos', 'Teléfono', 'Email',
            'WhatsApp ID', 'Instagram ID', 'Facebook ID',
            'Ciudad', 'País', 'Estado', 'Origen',
            'Primera Interacción', 'Última Interacción', 'Fecha Creación'
        ]

        const values = []
        
        if (incluirHeaders) {
            values.push(headers)
        }

        contactos.forEach(contacto => {
            values.push([
                contacto.id,
                contacto.nombre || '',
                contacto.apellidos || '',
                contacto.telefono || '',
                contacto.email || '',
                contacto.whatsapp_id || '',
                contacto.instagram_id || '',
                contacto.facebook_id || '',
                contacto.ciudad || '',
                contacto.pais || '',
                contacto.estado || '',
                contacto.origen || '',
                contacto.primera_interaccion ? new Date(contacto.primera_interaccion).toLocaleString() : '',
                contacto.ultima_interaccion ? new Date(contacto.ultima_interaccion).toLocaleString() : '',
                contacto.fecha_creacion ? new Date(contacto.fecha_creacion).toLocaleString() : ''
            ])
        })

        await sheets.spreadsheets.values.clear({
            spreadsheetId: spreadsheetId,
            range: `${sheetName}!A:Z`
        })

        await sheets.spreadsheets.values.update({
            spreadsheetId: spreadsheetId,
            range: `${sheetName}!A1`,
            valueInputOption: 'RAW',
            resource: {
                values: values
            }
        })

        await db.execute(`
            INSERT INTO google_sheets_log (
                usuario_id,
                operacion,
                spreadsheet_id,
                sheet_name,
                registros_procesados,
                estado_operacion
            ) VALUES (?, 'exportar', ?, ?, ?, 'exitoso')
        `, [usuario.id, spreadsheetId, sheetName, contactos.length])

        return {
            success: true,
            registros: contactos.length,
            message: 'Contactos exportados exitosamente'
        }

    } catch (error) {
        console.log('Error al exportar contactos:', error)
        
        const usuario = await obtenerUsuarioActual()
        if (usuario) {
            await db.execute(`
                INSERT INTO google_sheets_log (
                    usuario_id,
                    operacion,
                    estado_operacion,
                    mensaje_error
                ) VALUES (?, 'exportar', 'fallido', ?)
            `, [usuario.id, error.message])
        }
        
        throw error
    }
}

export async function importarContactosDeSheet(spreadsheetId, sheetName) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        const datos = await obtenerDatosSheet(spreadsheetId, sheetName)
        
        if (datos.length === 0) {
            throw new Error('No hay datos para importar')
        }

        let registrosImportados = 0
        let registrosActualizados = 0

        for (const fila of datos) {
            if (!fila.Nombre && !fila.Teléfono && !fila.Email) {
                continue
            }

            try {
                const [existente] = await db.execute(`
                    SELECT id FROM contactos 
                    WHERE telefono = ? OR email = ? OR whatsapp_id = ?
                    LIMIT 1
                `, [fila.Teléfono || null, fila.Email || null, fila['WhatsApp ID'] || null])

                if (existente.length > 0) {
                    await db.execute(`
                        UPDATE contactos SET
                            nombre = COALESCE(?, nombre),
                            apellidos = COALESCE(?, apellidos),
                            telefono = COALESCE(?, telefono),
                            email = COALESCE(?, email),
                            ciudad = COALESCE(?, ciudad),
                            pais = COALESCE(?, pais),
                            fecha_actualizacion = NOW()
                        WHERE id = ?
                    `, [
                        fila.Nombre || null,
                        fila.Apellidos || null,
                        fila.Teléfono || null,
                        fila.Email || null,
                        fila.Ciudad || null,
                        fila.País || null,
                        existente[0].id
                    ])
                    registrosActualizados++
                } else {
                    await db.execute(`
                        INSERT INTO contactos (
                            nombre,
                            apellidos,
                            telefono,
                            email,
                            whatsapp_id,
                            instagram_id,
                            facebook_id,
                            ciudad,
                            pais,
                            estado,
                            origen,
                            fecha_creacion
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'google_sheets', NOW())
                    `, [
                        fila.Nombre || null,
                        fila.Apellidos || null,
                        fila.Teléfono || null,
                        fila.Email || null,
                        fila['WhatsApp ID'] || null,
                        fila['Instagram ID'] || null,
                        fila['Facebook ID'] || null,
                        fila.Ciudad || null,
                        fila.País || 'México',
                        fila.Estado || 'nuevo'
                    ])
                    registrosImportados++
                }
            } catch (filaError) {
                console.log('Error al procesar fila:', filaError)
                continue
            }
        }

        await db.execute(`
            INSERT INTO google_sheets_log (
                usuario_id,
                operacion,
                spreadsheet_id,
                sheet_name,
                registros_procesados,
                estado_operacion,
                detalles
            ) VALUES (?, 'importar', ?, ?, ?, 'exitoso', ?)
        `, [
            usuario.id, 
            spreadsheetId, 
            sheetName, 
            registrosImportados + registrosActualizados,
            JSON.stringify({
                importados: registrosImportados,
                actualizados: registrosActualizados
            })
        ])

        return {
            success: true,
            registros: registrosImportados + registrosActualizados,
            detalles: {
                importados: registrosImportados,
                actualizados: registrosActualizados
            },
            message: `Importación completada: ${registrosImportados} nuevos, ${registrosActualizados} actualizados`
        }

    } catch (error) {
        console.log('Error al importar contactos:', error)
        
        const usuario = await obtenerUsuarioActual()
        if (usuario) {
            await db.execute(`
                INSERT INTO google_sheets_log (
                    usuario_id,
                    operacion,
                    estado_operacion,
                    mensaje_error
                ) VALUES (?, 'importar', 'fallido', ?)
            `, [usuario.id, error.message])
        }
        
        throw error
    }
}

export async function sincronizarDatos(spreadsheetId, sheetName) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        const [contactosDB] = await db.execute(`
            SELECT 
                id,
                nombre,
                apellidos,
                telefono,
                email,
                whatsapp_id,
                instagram_id,
                facebook_id,
                ciudad,
                pais,
                estado,
                origen,
                fecha_actualizacion
            FROM contactos
            ORDER BY fecha_actualizacion DESC
        `)

        const datosSheet = await obtenerDatosSheet(spreadsheetId, sheetName)
        
        const auth = await obtenerClienteAutenticado()
        const sheets = google.sheets({ version: 'v4', auth })

        let registrosSincronizados = 0

        const mapaSheet = new Map()
        datosSheet.forEach((fila, index) => {
            if (fila.ID) {
                mapaSheet.set(parseInt(fila.ID), index + 2)
            }
        })

        for (const contacto of contactosDB) {
            const filaSheet = mapaSheet.get(contacto.id)
            
            if (filaSheet) {
                const valoresActualizados = [
                    contacto.id,
                    contacto.nombre || '',
                    contacto.apellidos || '',
                    contacto.telefono || '',
                    contacto.email || '',
                    contacto.whatsapp_id || '',
                    contacto.instagram_id || '',
                    contacto.facebook_id || '',
                    contacto.ciudad || '',
                    contacto.pais || '',
                    contacto.estado || '',
                    contacto.origen || ''
                ]

                await sheets.spreadsheets.values.update({
                    spreadsheetId: spreadsheetId,
                    range: `${sheetName}!A${filaSheet}:L${filaSheet}`,
                    valueInputOption: 'RAW',
                    resource: {
                        values: [valoresActualizados]
                    }
                })

                registrosSincronizados++
            }
        }

        await db.execute(`
            INSERT INTO google_sheets_log (
                usuario_id,
                operacion,
                spreadsheet_id,
                sheet_name,
                registros_procesados,
                estado_operacion
            ) VALUES (?, 'sincronizar', ?, ?, ?, 'exitoso')
        `, [usuario.id, spreadsheetId, sheetName, registrosSincronizados])

        return {
            success: true,
            registros: registrosSincronizados,
            message: 'Datos sincronizados exitosamente'
        }

    } catch (error) {
        console.log('Error al sincronizar datos:', error)
        
        const usuario = await obtenerUsuarioActual()
        if (usuario) {
            await db.execute(`
                INSERT INTO google_sheets_log (
                    usuario_id,
                    operacion,
                    estado_operacion,
                    mensaje_error
                ) VALUES (?, 'sincronizar', 'fallido', ?)
            `, [usuario.id, error.message])
        }
        
        throw error
    }
}

export async function crearNuevoSheet(spreadsheetId, nombreSheet) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        const auth = await obtenerClienteAutenticado()
        const sheets = google.sheets({ version: 'v4', auth })

        const response = await sheets.spreadsheets.batchUpdate({
            spreadsheetId: spreadsheetId,
            resource: {
                requests: [{
                    addSheet: {
                        properties: {
                            title: nombreSheet
                        }
                    }
                }]
            }
        })

        const nuevaSheet = response.data.replies[0].addSheet

        const headers = [
            'ID', 'Nombre', 'Apellidos', 'Teléfono', 'Email',
            'WhatsApp ID', 'Instagram ID', 'Facebook ID',
            'Ciudad', 'País', 'Estado', 'Origen',
            'Primera Interacción', 'Última Interacción', 'Fecha Creación'
        ]

        await sheets.spreadsheets.values.update({
            spreadsheetId: spreadsheetId,
            range: `${nombreSheet}!A1:O1`,
            valueInputOption: 'RAW',
            resource: {
                values: [headers]
            }
        })

        await db.execute(`
            INSERT INTO google_sheets_log (
                usuario_id,
                operacion,
                spreadsheet_id,
                sheet_name,
                registros_procesados,
                estado_operacion
            ) VALUES (?, 'crear_sheet', ?, ?, 0, 'exitoso')
        `, [usuario.id, spreadsheetId, nombreSheet])

        return {
            success: true,
            sheetId: nuevaSheet.properties.sheetId,
            message: 'Pestaña creada exitosamente'
        }

    } catch (error) {
        console.log('Error al crear sheet:', error)
        
        const usuario = await obtenerUsuarioActual()
        if (usuario) {
            await db.execute(`
                INSERT INTO google_sheets_log (
                    usuario_id,
                    operacion,
                    estado_operacion,
                    mensaje_error
                ) VALUES (?, 'crear_sheet', 'fallido', ?)
            `, [usuario.id, error.message])
        }
        throw error
    }
}

export async function eliminarSheet(spreadsheetId, nombreSheet) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        const auth = await obtenerClienteAutenticado()
        const sheets = google.sheets({ version: 'v4', auth })

        const spreadsheet = await sheets.spreadsheets.get({
            spreadsheetId: spreadsheetId
        })

        const sheet = spreadsheet.data.sheets.find(s => s.properties.title === nombreSheet)
        
        if (!sheet) {
            throw new Error('Pestaña no encontrada')
        }

        if (spreadsheet.data.sheets.length <= 1) {
            throw new Error('No se puede eliminar la única pestaña del documento')
        }

        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: spreadsheetId,
            resource: {
                requests: [{
                    deleteSheet: {
                        sheetId: sheet.properties.sheetId
                    }
                }]
            }
        })

        await db.execute(`
            INSERT INTO google_sheets_log (
                usuario_id,
                operacion,
                spreadsheet_id,
                sheet_name,
                registros_procesados,
                estado_operacion
            ) VALUES (?, 'eliminar_sheet', ?, ?, 0, 'exitoso')
        `, [usuario.id, spreadsheetId, nombreSheet])

        return {
            success: true,
            message: 'Pestaña eliminada exitosamente'
        }

    } catch (error) {
        console.log('Error al eliminar sheet:', error)
        
        const usuario = await obtenerUsuarioActual()
        if (usuario) {
            await db.execute(`
                INSERT INTO google_sheets_log (
                    usuario_id,
                    operacion,
                    estado_operacion,
                    mensaje_error
                ) VALUES (?, 'eliminar_sheet', 'fallido', ?)
            `, [usuario.id, error.message])
        }
        
        throw error
    }
}

export async function obtenerHistorialOperaciones() {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        const [rows] = await db.execute(`
            SELECT 
                gsl.*,
                u.nombre as usuario_nombre,
                u.apellidos as usuario_apellidos
            FROM google_sheets_log gsl
            LEFT JOIN usuarios u ON gsl.usuario_id = u.id
            WHERE gsl.usuario_id = ?
            ORDER BY gsl.fecha_operacion DESC
            LIMIT 50
        `, [usuario.id])

        return rows.map(row => ({
            ...row,
            usuario_nombre_completo: row.usuario_nombre ? 
                `${row.usuario_nombre} ${row.usuario_apellidos}` : 
                'Usuario desconocido'
        }))

    } catch (error) {
        console.log('Error al obtener historial:', error)
        throw error
    }
}

export async function validarPermisos(spreadsheetId) {
    try {
        const auth = await obtenerClienteAutenticado()
        const drive = google.drive({ version: 'v3', auth })

        const response = await drive.permissions.list({
            fileId: spreadsheetId,
            fields: 'permissions(id,type,role,emailAddress)'
        })

        return {
            success: true,
            permisos: response.data.permissions
        }

    } catch (error) {
        console.log('Error al validar permisos:', error)
        return {
            success: false,
            error: error.message
        }
    }
}

export async function crearBackupContactos() {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        const [contactos] = await db.execute(`
            SELECT * FROM contactos ORDER BY fecha_creacion DESC
        `)

        const [conversaciones] = await db.execute(`
            SELECT 
                conv.*,
                c.nombre as contacto_nombre,
                c.telefono as contacto_telefono
            FROM conversaciones conv
            LEFT JOIN contactos c ON conv.contacto_id = c.id
            ORDER BY conv.fecha_inicio DESC
        `)

        const [mensajes] = await db.execute(`
            SELECT 
                m.*,
                c.nombre as contacto_nombre
            FROM mensajes m
            LEFT JOIN contactos c ON m.contacto_id = c.id
            ORDER BY m.fecha_envio DESC
            LIMIT 10000
        `)

        const backup = {
            fecha_backup: new Date().toISOString(),
            usuario_backup: `${usuario.nombre} ${usuario.apellidos}`,
            contactos: contactos,
            conversaciones: conversaciones,
            mensajes: mensajes,
            estadisticas: {
                total_contactos: contactos.length,
                total_conversaciones: conversaciones.length,
                total_mensajes: mensajes.length
            }
        }

        await db.execute(`
            INSERT INTO google_sheets_log (
                usuario_id,
                operacion,
                spreadsheet_id,
                sheet_name,
                registros_procesados,
                estado_operacion,
                detalles
            ) VALUES (?, 'backup', 'local', 'backup_completo', ?, 'exitoso', ?)
        `, [
            usuario.id,
            contactos.length + conversaciones.length + mensajes.length,
            JSON.stringify(backup.estadisticas)
        ])

        return {
            success: true,
            backup: backup,
            message: 'Backup creado exitosamente'
        }

    } catch (error) {
        console.log('Error al crear backup:', error)
        throw error
    }
}

export async function limpiarCacheGoogle() {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        if (usuario.rol !== 'superadmin' && usuario.rol !== 'admin') {
            throw new Error('Sin permisos para limpiar cache')
        }

        await db.execute(`
            DELETE FROM google_sheets_log 
            WHERE fecha_operacion < DATE_SUB(NOW(), INTERVAL 30 DAY)
        `)

        return {
            success: true,
            message: 'Cache limpiado exitosamente'
        }

    } catch (error) {
        console.log('Error al limpiar cache:', error)
        throw error
    }
}

export async function obtenerEstadisticasUso() {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        const [estadisticas] = await db.execute(`
            SELECT 
                operacion,
                COUNT(*) as total_operaciones,
                SUM(registros_procesados) as total_registros,
                MAX(fecha_operacion) as ultima_operacion,
                AVG(registros_procesados) as promedio_registros
            FROM google_sheets_log
            WHERE usuario_id = ?
            AND fecha_operacion >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY operacion
            ORDER BY total_operaciones DESC
        `, [usuario.id])

        const [resumenMensual] = await db.execute(`
            SELECT 
                YEAR(fecha_operacion) as año,
                MONTH(fecha_operacion) as mes,
                COUNT(*) as operaciones,
                SUM(registros_procesados) as registros
            FROM google_sheets_log
            WHERE usuario_id = ?
            AND fecha_operacion >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
            GROUP BY YEAR(fecha_operacion), MONTH(fecha_operacion)
            ORDER BY año DESC, mes DESC
        `, [usuario.id])

        return {
            estadisticas_operaciones: estadisticas,
            resumen_mensual: resumenMensual
        }

    } catch (error) {
        console.log('Error al obtener estadísticas:', error)
        throw error
    }
}

export async function obtenerConfiguracionesDisponibles() {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        if (usuario.rol !== 'superadmin' && usuario.rol !== 'admin') {
            throw new Error('Sin permisos para ver configuraciones')
        }

        const [configuraciones] = await db.execute(`
            SELECT 
                id,
                client_id,
                redirect_uri,
                nombre_configuracion,
                descripcion,
                activa,
                fecha_creacion,
                creada_por
            FROM google_sheets_configuracion
            ORDER BY fecha_creacion DESC
        `)

        return configuraciones

    } catch (error) {
        console.log('Error al obtener configuraciones:', error)
        throw error
    }
}

export async function crearSpreadsheetCompleto(nombre, descripcion = '') {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        const auth = await obtenerClienteAutenticado()
        const sheets = google.sheets({ version: 'v4', auth })

        console.log('Creando nuevo spreadsheet:', nombre)

        // Paso 1: Crear el spreadsheet
        const response = await sheets.spreadsheets.create({
            resource: {
                properties: {
                    title: nombre
                },
                sheets: [{
                    properties: {
                        title: 'Contactos'
                    }
                }]
            }
        })

        const spreadsheetId = response.data.spreadsheetId
        console.log('Spreadsheet creado con ID:', spreadsheetId)

        // Paso 2: Obtener información del sheet creado
        const spreadsheetInfo = await sheets.spreadsheets.get({
            spreadsheetId: spreadsheetId,
            fields: 'sheets(properties(sheetId,title))'
        })

        const sheetId = spreadsheetInfo.data.sheets[0].properties.sheetId
        console.log('Sheet ID obtenido:', sheetId)

        // Paso 3: Agregar headers
        const headers = [
            'ID', 'Nombre', 'Apellidos', 'Teléfono', 'Email',
            'WhatsApp ID', 'Instagram ID', 'Facebook ID',
            'Ciudad', 'País', 'Estado', 'Origen',
            'Primera Interacción', 'Última Interacción', 'Fecha Creación'
        ]

        await sheets.spreadsheets.values.update({
            spreadsheetId: spreadsheetId,
            range: 'Contactos!A1:O1',
            valueInputOption: 'RAW',
            resource: {
                values: [headers]
            }
        })

        console.log('Headers agregados exitosamente')

        // Paso 4: Formatear headers (SIN usar sheetId 0, usar el sheetId real)
        try {
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId: spreadsheetId,
                resource: {
                    requests: [{
                        repeatCell: {
                            range: {
                                sheetId: sheetId, // Usar el sheetId real, no 0
                                startRowIndex: 0,
                                endRowIndex: 1,
                                startColumnIndex: 0,
                                endColumnIndex: headers.length
                            },
                            cell: {
                                userEnteredFormat: {
                                    backgroundColor: {
                                        red: 0.9,
                                        green: 0.9,
                                        blue: 0.9
                                    },
                                    textFormat: {
                                        bold: true
                                    }
                                }
                            },
                            fields: 'userEnteredFormat(backgroundColor,textFormat)'
                        }
                    }]
                }
            })
            console.log('Formato aplicado exitosamente')
        } catch (formatError) {
            console.log('Error al aplicar formato (no crítico):', formatError.message)
            // No lanzamos error porque el spreadsheet ya está creado
        }

        // Paso 5: Registrar en log
        await db.execute(`
            INSERT INTO google_sheets_log (
                usuario_id,
                operacion,
                spreadsheet_id,
                sheet_name,
                registros_procesados,
                estado_operacion,
                detalles
            ) VALUES (?, 'crear_spreadsheet', ?, 'Contactos', 0, 'exitoso', ?)
        `, [usuario.id, spreadsheetId, JSON.stringify({ 
            nombre: nombre,
            descripcion: descripcion,
            url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
            sheetId: sheetId
        })])

        console.log('Spreadsheet creado exitosamente')

        return {
            success: true,
            spreadsheetId: spreadsheetId,
            sheetId: sheetId,
            url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
            message: 'Hoja de cálculo creada exitosamente'
        }

    } catch (error) {
        console.log('Error al crear spreadsheet:', error)
        
        const usuario = await obtenerUsuarioActual()
        if (usuario) {
            await db.execute(`
                INSERT INTO google_sheets_log (
                    usuario_id,
                    operacion,
                    estado_operacion,
                    mensaje_error
                ) VALUES (?, 'crear_spreadsheet', 'fallido', ?)
            `, [usuario.id, error.message])
        }
        
        throw error
    }
}

export async function desconectarGoogleSheets() {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        await db.execute(`
            UPDATE google_sheets_conexiones 
            SET estado = 'desconectado',
                access_token = NULL,
                refresh_token = NULL,
                expires_at = NULL,
                fecha_desconexion = NOW()
            WHERE usuario_id = ?
        `, [usuario.id])

        await db.execute(`
            INSERT INTO google_sheets_log (
                usuario_id,
                operacion,
                estado_operacion
            ) VALUES (?, 'desconectar', 'exitoso')
        `, [usuario.id])

        return {
            success: true,
            message: 'Desconectado de Google Sheets'
        }

    } catch (error) {
        console.log('Error al desconectar:', error)
        throw error
    }
}


export async function actualizarDatosExcel(spreadsheetId, sheetName) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        console.log('Actualizando datos de Excel desde Google Sheets...')
        
        const datos = await obtenerDatosSheet(spreadsheetId, sheetName)
        
        await db.execute(`
            INSERT INTO google_sheets_log (
                usuario_id,
                operacion,
                spreadsheet_id,
                sheet_name,
                registros_procesados,
                estado_operacion
            ) VALUES (?, 'actualizar_excel', ?, ?, ?, 'exitoso')
        `, [usuario.id, spreadsheetId, sheetName, datos.length])

        return {
            success: true,
            datos: datos,
            registros: datos.length,
            message: 'Excel actualizado desde Google Sheets'
        }

    } catch (error) {
        console.log('Error al actualizar Excel:', error)
        
        const usuario = await obtenerUsuarioActual()
        if (usuario) {
            await db.execute(`
                INSERT INTO google_sheets_log (
                    usuario_id,
                    operacion,
                    estado_operacion,
                    mensaje_error
                ) VALUES (?, 'actualizar_excel', 'fallido', ?)
            `, [usuario.id, error.message])
        }
        
        return {
            success: false,
            error: error.message
        }
    }
}

export async function guardarDatosExcel(spreadsheetId, sheetName, datosLuckysheet) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        console.log('Guardando datos de Excel a Google Sheets...')
        
        const auth = await obtenerClienteAutenticado()
        const sheets = google.sheets({ version: 'v4', auth })

        // Convertir datos de Luckysheet a formato Google Sheets
        const valores = convertirLuckysheetAGoogle(datosLuckysheet)
        
        if (valores.length === 0) {
            throw new Error('No hay datos para guardar')
        }

        // Limpiar el sheet antes de escribir
        await sheets.spreadsheets.values.clear({
            spreadsheetId: spreadsheetId,
            range: `${sheetName}!A:Z`
        })

        // Escribir los nuevos datos
        await sheets.spreadsheets.values.update({
            spreadsheetId: spreadsheetId,
            range: `${sheetName}!A1`,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: valores
            }
        })

        await db.execute(`
            INSERT INTO google_sheets_log (
                usuario_id,
                operacion,
                spreadsheet_id,
                sheet_name,
                registros_procesados,
                estado_operacion
            ) VALUES (?, 'guardar_excel', ?, ?, ?, 'exitoso')
        `, [usuario.id, spreadsheetId, sheetName, valores.length])

        return {
            success: true,
            registros: valores.length,
            message: 'Excel guardado en Google Sheets exitosamente'
        }

    } catch (error) {
        console.log('Error al guardar Excel:', error)
        
        const usuario = await obtenerUsuarioActual()
        if (usuario) {
            await db.execute(`
                INSERT INTO google_sheets_log (
                    usuario_id,
                    operacion,
                    estado_operacion,
                    mensaje_error
                ) VALUES (?, 'guardar_excel', 'fallido', ?)
            `, [usuario.id, error.message])
        }
        
        return {
            success: false,
            error: error.message
        }
    }
}

// Función auxiliar para convertir datos de Luckysheet a formato Google Sheets
function convertirLuckysheetAGoogle(datosLuckysheet) {
    try {
        if (!datosLuckysheet || !Array.isArray(datosLuckysheet)) {
            console.log('Datos de Luckysheet inválidos')
            return []
        }

        // Encontrar las dimensiones máximas
        let maxRow = 0
        let maxCol = 0

        datosLuckysheet.forEach(celda => {
            if (celda && typeof celda.r === 'number' && typeof celda.c === 'number') {
                maxRow = Math.max(maxRow, celda.r)
                maxCol = Math.max(maxCol, celda.c)
            }
        })

        // Crear matriz vacía
        const matriz = []
        for (let i = 0; i <= maxRow; i++) {
            matriz[i] = new Array(maxCol + 1).fill('')
        }

        // Llenar la matriz con los datos
        datosLuckysheet.forEach(celda => {
            if (celda && typeof celda.r === 'number' && typeof celda.c === 'number') {
                const valor = celda.v !== undefined ? String(celda.v) : ''
                matriz[celda.r][celda.c] = valor
            }
        })

        // Filtrar filas vacías del final
        while (matriz.length > 0 && matriz[matriz.length - 1].every(cell => cell === '')) {
            matriz.pop()
        }

        return matriz

    } catch (error) {
        console.log('Error al convertir datos de Luckysheet:', error)
        return []
    }
}

export async function obtenerEstructuraSheet(spreadsheetId, sheetName) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        const auth = await obtenerClienteAutenticado()
        const sheets = google.sheets({ version: 'v4', auth })

        // Obtener información del spreadsheet
        const spreadsheetInfo = await sheets.spreadsheets.get({
            spreadsheetId: spreadsheetId,
            fields: 'sheets(properties(title,sheetId,gridProperties))'
        })

        const sheet = spreadsheetInfo.data.sheets.find(s => s.properties.title === sheetName)
        
        if (!sheet) {
            throw new Error('Pestaña no encontrada')
        }

        return {
            success: true,
            estructura: {
                sheetId: sheet.properties.sheetId,
                titulo: sheet.properties.title,
                filas: sheet.properties.gridProperties.rowCount,
                columnas: sheet.properties.gridProperties.columnCount
            }
        }

    } catch (error) {
        console.log('Error al obtener estructura del sheet:', error)
        return {
            success: false,
            error: error.message
        }
    }
}

export async function exportarExcelCompleto(spreadsheetId, incluirTodasLasPestanas = false) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        const auth = await obtenerClienteAutenticado()
        const drive = google.drive({ version: 'v3', auth })

        // Exportar como Excel (.xlsx)
        const response = await drive.files.export({
            fileId: spreadsheetId,
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        })

        await db.execute(`
            INSERT INTO google_sheets_log (
                usuario_id,
                operacion,
                spreadsheet_id,
                registros_procesados,
                estado_operacion
            ) VALUES (?, 'exportar_excel', ?, 1, 'exitoso')
        `, [usuario.id, spreadsheetId])

        return {
            success: true,
            archivo: response.data,
            message: 'Excel exportado exitosamente'
        }

    } catch (error) {
        console.log('Error al exportar Excel:', error)
        
        const usuario = await obtenerUsuarioActual()
        if (usuario) {
            await db.execute(`
                INSERT INTO google_sheets_log (
                    usuario_id,
                    operacion,
                    estado_operacion,
                    mensaje_error
                ) VALUES (?, 'exportar_excel', 'fallido', ?)
            `, [usuario.id, error.message])
        }
        
        return {
            success: false,
            error: error.message
        }
    }
}

export async function duplicarSheet(spreadsheetId, sheetName, nuevoNombre) {
    try {
        const usuario = await obtenerUsuarioActual()
        if (!usuario) {
            throw new Error('Usuario no autenticado')
        }

        const auth = await obtenerClienteAutenticado()
        const sheets = google.sheets({ version: 'v4', auth })

        // Obtener información del sheet original
        const spreadsheet = await sheets.spreadsheets.get({
            spreadsheetId: spreadsheetId
        })

        const sheetOriginal = spreadsheet.data.sheets.find(s => s.properties.title === sheetName)
        
        if (!sheetOriginal) {
            throw new Error('Pestaña original no encontrada')
        }

        // Duplicar el sheet
        const response = await sheets.spreadsheets.batchUpdate({
            spreadsheetId: spreadsheetId,
            resource: {
                requests: [{
                    duplicateSheet: {
                        sourceSheetId: sheetOriginal.properties.sheetId,
                        newSheetName: nuevoNombre
                    }
                }]
            }
        })

        const nuevoSheet = response.data.replies[0].duplicateSheet

        await db.execute(`
            INSERT INTO google_sheets_log (
                usuario_id,
                operacion,
                spreadsheet_id,
                sheet_name,
                registros_procesados,
                estado_operacion
            ) VALUES (?, 'duplicar_sheet', ?, ?, 0, 'exitoso')
        `, [usuario.id, spreadsheetId, nuevoNombre])

        return {
            success: true,
            sheetId: nuevoSheet.properties.sheetId,
            nombreNuevo: nuevoNombre,
            message: 'Pestaña duplicada exitosamente'
        }

    } catch (error) {
        console.log('Error al duplicar sheet:', error)
        
        const usuario = await obtenerUsuarioActual()
        if (usuario) {
            await db.execute(`
                INSERT INTO google_sheets_log (
                    usuario_id,
                    operacion,
                    estado_operacion,
                    mensaje_error
                ) VALUES (?, 'duplicar_sheet', 'fallido', ?)
            `, [usuario.id, error.message])
        }
        
        return {
            success: false,
            error: error.message
        }
    }
}