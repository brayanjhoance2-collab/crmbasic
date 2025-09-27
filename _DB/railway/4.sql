-- ============================================================================
-- TABLAS PARA INTEGRACIÓN CON GOOGLE SHEETS - CONFIGURACIÓN EN BD
-- ============================================================================

USE railway;

-- Eliminar tablas si existen (orden correcto por dependencias)
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS google_sheets_log;
DROP TABLE IF EXISTS google_sheets_configuracion;
DROP TABLE IF EXISTS google_sheets_conexiones;
DROP TABLE IF EXISTS google_sheets_mapeos;
DROP TABLE IF EXISTS google_sheets_jobs_sync;
SET FOREIGN_KEY_CHECKS = 1;
-- ============================================================================
-- CONFIGURACIÓN DE CREDENCIALES GOOGLE SHEETS
-- ============================================================================

-- Tabla para credenciales de Google (configuración del sistema)
CREATE TABLE google_sheets_configuracion (
    id INT AUTO_INCREMENT PRIMARY KEY,
    
    -- Credenciales de la aplicación Google
    client_id VARCHAR(255) NOT NULL,
    client_secret TEXT NOT NULL,
    redirect_uri VARCHAR(255) NOT NULL,
    
    -- Configuración adicional
    nombre_configuracion VARCHAR(100) NOT NULL DEFAULT 'Google Sheets API',
    descripcion TEXT NULL,
    
    -- Estado de la configuración
    activa BOOLEAN DEFAULT 1,
    
    -- Control de fechas
    creada_por INT NULL,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (creada_por) REFERENCES usuarios(id) ON DELETE SET NULL,
    
    -- Solo una configuración activa a la vez
    UNIQUE KEY unique_activa (activa)
) ENGINE=InnoDB;

-- ============================================================================
-- CONEXIONES DE USUARIOS CON GOOGLE SHEETS
-- ============================================================================

-- Tabla para las conexiones de cada usuario con Google
CREATE TABLE google_sheets_conexiones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    
    -- Información de autenticación del usuario
    email_google VARCHAR(255) NOT NULL,
    access_token TEXT NULL,
    refresh_token TEXT NULL,
    expires_at TIMESTAMP NULL,
    
    -- Estado de la conexión
    estado ENUM('conectado', 'desconectado', 'error', 'token_expirado') DEFAULT 'desconectado',
    
    -- Información adicional de Google
    google_user_id VARCHAR(255) NULL,
    nombre_google VARCHAR(255) NULL,
    foto_perfil_google VARCHAR(500) NULL,
    
    -- Configuraciones de sincronización
    auto_sync BOOLEAN DEFAULT 0,
    sync_interval_minutes INT DEFAULT 60,
    ultima_sincronizacion TIMESTAMP NULL,
    
    -- Metadatos
    scopes_otorgados JSON NULL,
    info_adicional JSON NULL,
    
    -- Fechas de control
    fecha_conexion TIMESTAMP NULL,
    fecha_desconexion TIMESTAMP NULL,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    
    -- Índices para optimización
    INDEX idx_usuario (usuario_id),
    INDEX idx_estado (estado),
    INDEX idx_email_google (email_google),
    INDEX idx_google_user_id (google_user_id),
    
    -- Un usuario solo puede tener una conexión activa
    UNIQUE KEY unique_usuario_conexion (usuario_id)
) ENGINE=InnoDB;

-- ============================================================================
-- LOG DE OPERACIONES CON GOOGLE SHEETS
-- ============================================================================

-- Tabla para registrar todas las operaciones realizadas
CREATE TABLE google_sheets_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    conexion_id INT NULL,
    
    -- Información de la operación
    operacion ENUM(
        'conectar', 
        'desconectar', 
        'exportar', 
        'importar', 
        'sincronizar', 
        'crear_sheet', 
        'eliminar_sheet',
        'backup',
        'validar_permisos',
        'refresh_token'
    ) NOT NULL,
    
    -- Detalles del archivo/hoja
    spreadsheet_id VARCHAR(255) NULL,
    spreadsheet_name VARCHAR(255) NULL,
    sheet_name VARCHAR(255) NULL,
    
    -- Resultados de la operación
    estado_operacion ENUM('exitoso', 'fallido', 'parcial', 'en_proceso') DEFAULT 'exitoso',
    registros_procesados INT DEFAULT 0,
    
    -- Información adicional
    detalles JSON NULL,
    mensaje_error TEXT NULL,
    
    -- Metadatos técnicos
    tiempo_ejecucion_ms INT NULL,
    ip_usuario VARCHAR(45) NULL,
    user_agent TEXT NULL,
    
    -- Control de fechas
    fecha_operacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (conexion_id) REFERENCES google_sheets_conexiones(id) ON DELETE SET NULL,
    
    -- Índices para consultas frecuentes
    INDEX idx_usuario_fecha (usuario_id, fecha_operacion),
    INDEX idx_operacion (operacion),
    INDEX idx_spreadsheet (spreadsheet_id),
    INDEX idx_estado (estado_operacion),
    INDEX idx_fecha (fecha_operacion),
    INDEX idx_conexion (conexion_id)
) ENGINE=InnoDB;

-- ============================================================================
-- TABLA PARA CONFIGURACIONES DE EXPORTACIÓN/IMPORTACIÓN
-- ============================================================================

-- Tabla para guardar configuraciones personalizadas de mapeo
CREATE TABLE google_sheets_mapeos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    
    -- Identificación del mapeo
    nombre_mapeo VARCHAR(100) NOT NULL,
    descripcion TEXT NULL,
    
    -- Configuración del mapeo
    tabla_origen ENUM('contactos', 'conversaciones', 'mensajes', 'usuarios') NOT NULL,
    campos_mapeo JSON NOT NULL, -- {"campo_crm": "columna_sheet", ...}
    
    -- Configuraciones de formato
    incluir_headers BOOLEAN DEFAULT 1,
    formato_fecha VARCHAR(50) DEFAULT '%Y-%m-%d %H:%i:%s',
    separador_valores VARCHAR(5) DEFAULT ',',
    
    -- Filtros de exportación
    filtros_exportacion JSON NULL,
    condiciones_where TEXT NULL,
    
    -- Estado del mapeo
    activo BOOLEAN DEFAULT 1,
    veces_usado INT DEFAULT 0,
    ultima_vez_usado TIMESTAMP NULL,
    
    -- Control de fechas
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    
    -- Índices
    INDEX idx_usuario (usuario_id),
    INDEX idx_tabla_origen (tabla_origen),
    INDEX idx_activo (activo),
    INDEX idx_nombre (nombre_mapeo),
    
    -- Nombre único por usuario
    UNIQUE KEY unique_usuario_nombre (usuario_id, nombre_mapeo)
) ENGINE=InnoDB;

-- ============================================================================
-- TABLA PARA TRABAJOS DE SINCRONIZACIÓN PROGRAMADOS
-- ============================================================================

-- Tabla para configurar sincronizaciones automáticas
CREATE TABLE google_sheets_jobs_sync (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    conexion_id INT NULL,
    mapeo_id INT NULL,
    
    -- Configuración del trabajo
    nombre_job VARCHAR(100) NOT NULL,
    descripcion TEXT NULL,
    
    -- Destino de sincronización
    spreadsheet_id VARCHAR(255) NOT NULL,
    sheet_name VARCHAR(255) NOT NULL,
    
    -- Tipo de sincronización
    tipo_operacion ENUM('exportar', 'importar', 'sincronizar_bidireccional') DEFAULT 'exportar',
    sobrescribir_datos BOOLEAN DEFAULT 0,
    
    -- Programación
    frecuencia ENUM('manual', 'cada_hora', 'diaria', 'semanal', 'mensual') DEFAULT 'manual',
    hora_ejecucion TIME DEFAULT '02:00:00',
    dia_semana TINYINT NULL, -- 1=Lunes, 7=Domingo
    dia_mes TINYINT NULL,    -- 1-31
    
    -- Estado del trabajo
    activo BOOLEAN DEFAULT 1,
    ejecutandose BOOLEAN DEFAULT 0,
    ultima_ejecucion TIMESTAMP NULL,
    proxima_ejecucion TIMESTAMP NULL,
    ultimo_resultado ENUM('exitoso', 'fallido', 'parcial') NULL,
    ultimo_error TEXT NULL,
    
    -- Estadísticas
    total_ejecuciones INT DEFAULT 0,
    ejecuciones_exitosas INT DEFAULT 0,
    ejecuciones_fallidas INT DEFAULT 0,
    
    -- Control de fechas
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (conexion_id) REFERENCES google_sheets_conexiones(id) ON DELETE SET NULL,
    FOREIGN KEY (mapeo_id) REFERENCES google_sheets_mapeos(id) ON DELETE SET NULL,
    
    -- Índices
    INDEX idx_usuario (usuario_id),
    INDEX idx_activo (activo),
    INDEX idx_ejecutandose (ejecutandose),
    INDEX idx_proxima_ejecucion (proxima_ejecucion),
    INDEX idx_spreadsheet (spreadsheet_id),
    INDEX idx_frecuencia (frecuencia),
    
    -- Nombre único por usuario
    UNIQUE KEY unique_usuario_job (usuario_id, nombre_job)
) ENGINE=InnoDB;

-- ============================================================================
-- TRIGGERS PARA MANTENIMIENTO AUTOMÁTICO
-- ============================================================================

-- Trigger para limpiar logs antiguos automáticamente
DELIMITER $
CREATE TRIGGER after_google_sheets_log_insert
AFTER INSERT ON google_sheets_log
FOR EACH ROW
BEGIN
    -- Mantener solo los últimos 500 registros por usuario
    DELETE FROM google_sheets_log 
    WHERE usuario_id = NEW.usuario_id 
    AND id NOT IN (
        SELECT id FROM (
            SELECT id 
            FROM google_sheets_log 
            WHERE usuario_id = NEW.usuario_id 
            ORDER BY fecha_operacion DESC 
            LIMIT 500
        ) as subquery
    );
END$

-- Trigger para actualizar estadísticas de uso en mapeos
CREATE TRIGGER after_google_sheets_log_mapeo_update
AFTER INSERT ON google_sheets_log
FOR EACH ROW
BEGIN
    -- Si la operación usó un mapeo, actualizar estadísticas
    IF NEW.detalles IS NOT NULL AND JSON_EXTRACT(NEW.detalles, '$.mapeo_id') IS NOT NULL THEN
        UPDATE google_sheets_mapeos 
        SET veces_usado = veces_usado + 1,
            ultima_vez_usado = NEW.fecha_operacion,
            fecha_actualizacion = CURRENT_TIMESTAMP
        WHERE id = JSON_EXTRACT(NEW.detalles, '$.mapeo_id');
    END IF;
END$
DELIMITER ;

-- ============================================================================
-- DATOS INICIALES Y CONFIGURACIONES POR DEFECTO
-- ============================================================================

-- Mapeo por defecto para contactos
INSERT INTO google_sheets_mapeos (
    usuario_id, 
    nombre_mapeo, 
    descripcion, 
    tabla_origen, 
    campos_mapeo
) 
SELECT 
    1, 
    'Contactos Completo',
    'Exportación completa de contactos con todos los campos',
    'contactos',
    JSON_OBJECT(
        'id', 'ID',
        'nombre', 'Nombre',
        'apellidos', 'Apellidos', 
        'telefono', 'Teléfono',
        'email', 'Email',
        'whatsapp_id', 'WhatsApp ID',
        'instagram_id', 'Instagram ID',
        'facebook_id', 'Facebook ID',
        'ciudad', 'Ciudad',
        'pais', 'País',
        'estado', 'Estado Cliente',
        'origen', 'Origen',
        'primera_interaccion', 'Primera Interacción',
        'ultima_interaccion', 'Última Interacción',
        'fecha_creacion', 'Fecha Registro'
    )
WHERE EXISTS (SELECT 1 FROM usuarios WHERE id = 1);

-- Mapeo básico para contactos
INSERT INTO google_sheets_mapeos (
    usuario_id, 
    nombre_mapeo, 
    descripcion, 
    tabla_origen, 
    campos_mapeo
) 
SELECT 
    1, 
    'Contactos Básico',
    'Exportación básica con campos principales',
    'contactos',
    JSON_OBJECT(
        'nombre', 'Nombre',
        'apellidos', 'Apellidos', 
        'telefono', 'Teléfono',
        'email', 'Email',
        'estado', 'Estado',
        'origen', 'Origen'
    )
WHERE EXISTS (SELECT 1 FROM usuarios WHERE id = 1);

-- ============================================================================
-- VISTAS PARA CONSULTAS OPTIMIZADAS
-- ============================================================================

-- Vista para estado de conexiones por usuario
CREATE VIEW vista_google_sheets_usuarios AS
SELECT 
    u.id as usuario_id,
    u.nombre,
    u.apellidos,
    u.correo,
    gsc.id as conexion_id,
    gsc.email_google,
    gsc.estado as estado_conexion,
    gsc.fecha_conexion,
    gsc.ultima_sincronizacion,
    COUNT(gsl.id) as total_operaciones,
    MAX(gsl.fecha_operacion) as ultima_actividad
FROM usuarios u
LEFT JOIN google_sheets_conexiones gsc ON u.id = gsc.usuario_id
LEFT JOIN google_sheets_log gsl ON u.id = gsl.usuario_id
WHERE u.activo = 1
GROUP BY u.id, u.nombre, u.apellidos, u.correo, gsc.id, gsc.email_google, 
         gsc.estado, gsc.fecha_conexion, gsc.ultima_sincronizacion;

-- Vista para actividad reciente
CREATE VIEW vista_google_sheets_actividad_reciente AS
SELECT 
    gsl.id,
    gsl.operacion,
    gsl.spreadsheet_name,
    gsl.sheet_name,
    gsl.registros_procesados,
    gsl.estado_operacion,
    gsl.fecha_operacion,
    CONCAT(u.nombre, ' ', u.apellidos) as usuario_nombre,
    gsc.email_google,
    TIMESTAMPDIFF(MINUTE, gsl.fecha_operacion, NOW()) as minutos_transcurridos
FROM google_sheets_log gsl
JOIN usuarios u ON gsl.usuario_id = u.id
LEFT JOIN google_sheets_conexiones gsc ON gsl.conexion_id = gsc.id
WHERE gsl.fecha_operacion >= DATE_SUB(NOW(), INTERVAL 7 DAY)
ORDER BY gsl.fecha_operacion DESC;

-- ============================================================================
-- PROCEDIMIENTOS ALMACENADOS
-- ============================================================================

-- Procedimiento para limpiar datos antiguos
DELIMITER $$
CREATE PROCEDURE LimpiarDatosGoogleSheets(IN dias_logs INT, IN dias_tokens_expirados INT)
BEGIN
    DECLARE registros_eliminados INT DEFAULT 0;
    
    -- Limpiar logs antiguos
    DELETE FROM google_sheets_log 
    WHERE fecha_operacion < DATE_SUB(NOW(), INTERVAL dias_logs DAY);
    SET registros_eliminados = registros_eliminados + ROW_COUNT();
    
    -- Limpiar tokens expirados antiguos
    UPDATE google_sheets_conexiones 
    SET access_token = NULL, refresh_token = NULL, estado = 'token_expirado'
    WHERE expires_at < DATE_SUB(NOW(), INTERVAL dias_tokens_expirados DAY)
    AND estado != 'desconectado';
    SET registros_eliminados = registros_eliminados + ROW_COUNT();
    
    SELECT CONCAT('Limpieza completada: ', registros_eliminados, ' registros procesados') as resultado;
END$$
DELIMITER ;

-- ============================================================================
-- MENSAJE DE CONFIRMACIÓN
-- ============================================================================

SELECT 'Tablas de Google Sheets con configuración en BD creadas exitosamente' as resultado;