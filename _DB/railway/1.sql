-- ============================================================================
-- CRM WHATSAPP, INSTAGRAM & FACEBOOK - BASE DE DATOS COMPLETA
-- ============================================================================
USE railway;

-- ============================================================================
-- TABLAS DE USUARIOS Y AUTENTICACIÓN
-- ============================================================================

-- Tabla de usuarios del CRM
CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    correo VARCHAR(100) NOT NULL UNIQUE,
    contrasena_hash VARCHAR(255) NOT NULL,
    nombre VARCHAR(50) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    telefono VARCHAR(20),
    avatar_url VARCHAR(255),
    rol ENUM('usuario', 'admin', 'superadmin') NOT NULL DEFAULT 'usuario',
    activo BOOLEAN DEFAULT 1,
    ultimo_acceso TIMESTAMP NULL,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Tokens para recuperación de contraseña
CREATE TABLE tokens_recuperacion (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expira_en TIMESTAMP NOT NULL,
    usado BOOLEAN DEFAULT 0,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================================
-- CONFIGURACIONES DE PLATAFORMAS
-- ============================================================================

-- Configuraciones de WhatsApp API
CREATE TABLE configuraciones_whatsapp (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre_configuracion VARCHAR(100) NOT NULL,
    phone_number_id VARCHAR(255) NOT NULL,
    access_token TEXT NOT NULL,
    webhook_verify_token VARCHAR(255) NOT NULL,
    business_account_id VARCHAR(255),
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Configuraciones de WhatsApp con Baileys
CREATE TABLE configuraciones_baileys (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre_configuracion VARCHAR(100) NOT NULL,
    session_id VARCHAR(50) NOT NULL UNIQUE,
    estado_conexion ENUM('desconectado', 'conectando', 'qr_generado', 'conectado', 'error') DEFAULT 'desconectado',
    qr_code TEXT NULL,
    numero_whatsapp VARCHAR(20) NULL,
    nombre_whatsapp VARCHAR(100) NULL,
    foto_perfil_url VARCHAR(500) NULL,
    fecha_ultima_conexion TIMESTAMP NULL,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    datos_sesion JSON NULL,
    webhook_url VARCHAR(255) NULL,
    webhook_token VARCHAR(255) NULL,
    
    INDEX idx_session_id (session_id),
    INDEX idx_estado (estado_conexion)
) ENGINE=InnoDB;

-- Configuraciones de Instagram
CREATE TABLE configuraciones_instagram (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre_configuracion VARCHAR(100) NOT NULL,
    instagram_business_id VARCHAR(255) NOT NULL,
    access_token TEXT NOT NULL,
    webhook_verify_token VARCHAR(255) NOT NULL,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Configuraciones de Facebook
CREATE TABLE configuraciones_facebook (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre_configuracion VARCHAR(100) NOT NULL,
    page_id VARCHAR(255) NOT NULL,
    page_access_token TEXT NOT NULL,
    app_id VARCHAR(255) NOT NULL,
    app_secret TEXT NOT NULL,
    webhook_verify_token VARCHAR(255) NOT NULL,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Tabla para gestionar configuraciones activas
CREATE TABLE configuraciones_activas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    plataforma ENUM('whatsapp', 'instagram', 'facebook') NOT NULL,
    tipo_config ENUM('api', 'baileys', 'graph') NOT NULL,
    config_id INT NOT NULL,
    fecha_activacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    activada_por INT NULL,
    
    UNIQUE KEY unique_plataforma (plataforma),
    FOREIGN KEY (activada_por) REFERENCES usuarios(id) ON DELETE SET NULL,
    
    INDEX idx_plataforma (plataforma),
    INDEX idx_tipo (tipo_config)
) ENGINE=InnoDB;

-- ============================================================================
-- GESTIÓN DE CONTACTOS
-- ============================================================================

-- Tabla principal de contactos
CREATE TABLE contactos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100),
    apellidos VARCHAR(100),
    telefono VARCHAR(20),
    email VARCHAR(100),
    
    -- IDs por plataforma
    whatsapp_id VARCHAR(255),
    instagram_id VARCHAR(255),
    facebook_id VARCHAR(255),
    
    foto_perfil_url VARCHAR(500),
    ciudad VARCHAR(100),
    pais VARCHAR(50) DEFAULT 'México',
    
    estado ENUM('nuevo', 'contactado', 'interesado', 'cliente', 'inactivo') DEFAULT 'nuevo',
    origen ENUM('whatsapp', 'instagram', 'facebook', 'manual') NOT NULL,
    etiquetas JSON NULL,
    notas TEXT,
    
    asignado_a INT NULL,
    
    primera_interaccion TIMESTAMP NULL,
    ultima_interaccion TIMESTAMP NULL,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    bloqueado BOOLEAN DEFAULT 0,
    opt_out BOOLEAN DEFAULT 0,
    
    FOREIGN KEY (asignado_a) REFERENCES usuarios(id) ON DELETE SET NULL,
    
    UNIQUE KEY unique_whatsapp (whatsapp_id),
    UNIQUE KEY unique_instagram (instagram_id),
    UNIQUE KEY unique_facebook (facebook_id)
) ENGINE=InnoDB;

-- ============================================================================
-- SISTEMA DE CONVERSACIONES
-- ============================================================================

-- Conversaciones
CREATE TABLE conversaciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    contacto_id INT NOT NULL,
    plataforma ENUM('whatsapp', 'instagram', 'facebook') NOT NULL,
    whatsapp_tipo ENUM('api', 'baileys') DEFAULT 'api',
    estado ENUM('abierta', 'en_proceso', 'cerrada') DEFAULT 'abierta',
    asignada_a INT NULL,
    prioridad ENUM('baja', 'normal', 'alta') DEFAULT 'normal',
    
    fecha_inicio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_ultima_actividad TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    fecha_cierre TIMESTAMP NULL,
    
    total_mensajes INT DEFAULT 0,
    mensajes_agente INT DEFAULT 0,
    mensajes_contacto INT DEFAULT 0,
    
    FOREIGN KEY (contacto_id) REFERENCES contactos(id) ON DELETE CASCADE,
    FOREIGN KEY (asignada_a) REFERENCES usuarios(id) ON DELETE SET NULL,
    
    INDEX idx_whatsapp_tipo (whatsapp_tipo)
) ENGINE=InnoDB;

-- ============================================================================
-- SISTEMA DE MENSAJES
-- ============================================================================

-- Mensajes individuales
CREATE TABLE mensajes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conversacion_id INT NOT NULL,
    contacto_id INT NOT NULL,
    
    mensaje_id_externo VARCHAR(255),
    
    tipo_mensaje ENUM('texto', 'imagen', 'video', 'audio', 'documento', 'ubicacion', 'sticker') NOT NULL,
    contenido TEXT,
    
    archivo_url VARCHAR(500) NULL,
    archivo_tipo VARCHAR(50) NULL,
    miniatura_url VARCHAR(500) NULL,
    
    direccion ENUM('entrante', 'saliente') NOT NULL,
    enviado_por INT NULL,
    
    estado_entrega ENUM('enviado', 'entregado', 'leido', 'fallido') DEFAULT 'enviado',
    timestamp_entrega TIMESTAMP NULL,
    timestamp_leido TIMESTAMP NULL,
    
    fecha_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (conversacion_id) REFERENCES conversaciones(id) ON DELETE CASCADE,
    FOREIGN KEY (contacto_id) REFERENCES contactos(id) ON DELETE CASCADE,
    FOREIGN KEY (enviado_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================================
-- SISTEMA DE PLANTILLAS
-- ============================================================================

-- Plantillas de mensajes
CREATE TABLE plantillas_mensajes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    categoria VARCHAR(50),
    plataforma ENUM('whatsapp', 'instagram', 'facebook', 'todas') DEFAULT 'todas',
    
    contenido TEXT NOT NULL,
    variables JSON NULL,
    
    activa BOOLEAN DEFAULT 1,
    creada_por INT,
    veces_usada INT DEFAULT 0,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (creada_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================================
-- SISTEMA DE ETIQUETAS
-- ============================================================================

-- Etiquetas
CREATE TABLE etiquetas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    color VARCHAR(7) DEFAULT '#3B82F6',
    descripcion TEXT,
    activa BOOLEAN DEFAULT 1,
    creada_por INT,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (creada_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Relación contactos-etiquetas
CREATE TABLE contactos_etiquetas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    contacto_id INT NOT NULL,
    etiqueta_id INT NOT NULL,
    asignada_por INT,
    fecha_asignacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contacto_id) REFERENCES contactos(id) ON DELETE CASCADE,
    FOREIGN KEY (etiqueta_id) REFERENCES etiquetas(id) ON DELETE CASCADE,
    FOREIGN KEY (asignada_por) REFERENCES usuarios(id) ON DELETE SET NULL,
    UNIQUE(contacto_id, etiqueta_id)
) ENGINE=InnoDB;

-- ============================================================================
-- ENVÍOS AUTOMÁTICOS
-- ============================================================================

-- Campañas de envío masivo
CREATE TABLE campanas_envio (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    plataformas JSON NOT NULL, -- ["whatsapp", "instagram", "facebook"]
    
    mensaje_contenido TEXT NOT NULL,
    archivo_adjunto VARCHAR(500) NULL,
    
    estado ENUM('borrador', 'programada', 'enviando', 'completada', 'pausada', 'cancelada') DEFAULT 'borrador',
    
    fecha_programada TIMESTAMP NULL,
    fecha_inicio_envio TIMESTAMP NULL,
    fecha_fin_envio TIMESTAMP NULL,
    
    total_contactos INT DEFAULT 0,
    enviados_exitosos INT DEFAULT 0,
    enviados_fallidos INT DEFAULT 0,
    
    creada_por INT,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (creada_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Contactos incluidos en campañas
CREATE TABLE campanas_contactos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    campana_id INT NOT NULL,
    contacto_id INT NOT NULL,
    plataforma ENUM('whatsapp', 'instagram', 'facebook') NOT NULL,
    
    estado ENUM('pendiente', 'enviado', 'fallido', 'excluido') DEFAULT 'pendiente',
    fecha_envio TIMESTAMP NULL,
    error_mensaje TEXT NULL,
    
    FOREIGN KEY (campana_id) REFERENCES campanas_envio(id) ON DELETE CASCADE,
    FOREIGN KEY (contacto_id) REFERENCES contactos(id) ON DELETE CASCADE,
    UNIQUE(campana_id, contacto_id, plataforma)
) ENGINE=InnoDB;

-- ============================================================================
-- WEBHOOKS Y LOGS
-- ============================================================================

-- Log de webhooks recibidos
CREATE TABLE webhooks_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    plataforma ENUM('whatsapp', 'instagram', 'facebook') NOT NULL,
    evento_tipo VARCHAR(50),
    payload JSON NOT NULL,
    ip_origen VARCHAR(45),
    
    procesado BOOLEAN DEFAULT 0,
    fecha_procesamiento TIMESTAMP NULL,
    error_procesamiento TEXT NULL,
    
    fecha_recepcion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Log de llamadas a APIs
CREATE TABLE api_calls_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    plataforma ENUM('whatsapp', 'instagram', 'facebook') NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    metodo ENUM('GET', 'POST', 'PUT', 'DELETE') NOT NULL,
    response_code INT,
    tiempo_respuesta_ms INT,
    
    usuario_id INT NULL,
    fecha_llamada TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================================
-- TRIGGERS PARA CONFIGURACIONES ACTIVAS
-- ============================================================================

-- Trigger para WhatsApp: solo una configuración activa
DELIMITER $$
CREATE TRIGGER before_whatsapp_active_insert 
BEFORE INSERT ON configuraciones_activas
FOR EACH ROW
BEGIN
    IF NEW.plataforma = 'whatsapp' THEN
        DELETE FROM configuraciones_activas WHERE plataforma = 'whatsapp';
    END IF;
END$$

CREATE TRIGGER before_whatsapp_active_update 
BEFORE UPDATE ON configuraciones_activas
FOR EACH ROW
BEGIN
    IF NEW.plataforma = 'whatsapp' AND OLD.plataforma = 'whatsapp' THEN
        DELETE FROM configuraciones_activas WHERE plataforma = 'whatsapp' AND id != NEW.id;
    END IF;
END$$
DELIMITER ;

-- ============================================================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- ============================================================================

-- Índices para contactos
CREATE INDEX idx_contactos_telefono ON contactos(telefono);
CREATE INDEX idx_contactos_email ON contactos(email);
CREATE INDEX idx_contactos_estado ON contactos(estado);
CREATE INDEX idx_contactos_origen ON contactos(origen);
CREATE INDEX idx_contactos_asignado ON contactos(asignado_a);

-- Índices para conversaciones
CREATE INDEX idx_conversaciones_contacto ON conversaciones(contacto_id);
CREATE INDEX idx_conversaciones_plataforma ON conversaciones(plataforma);
CREATE INDEX idx_conversaciones_estado ON conversaciones(estado);
CREATE INDEX idx_conversaciones_asignada ON conversaciones(asignada_a);

-- Índices para mensajes
CREATE INDEX idx_mensajes_conversacion ON mensajes(conversacion_id);
CREATE INDEX idx_mensajes_contacto ON mensajes(contacto_id);
CREATE INDEX idx_mensajes_direccion ON mensajes(direccion);
CREATE INDEX idx_mensajes_fecha ON mensajes(fecha_envio);

-- Índices para logs
CREATE INDEX idx_webhooks_plataforma ON webhooks_log(plataforma);
CREATE INDEX idx_webhooks_procesado ON webhooks_log(procesado);
CREATE INDEX idx_api_calls_plataforma ON api_calls_log(plataforma);

-- ============================================================================
-- DATOS INICIALES
-- ============================================================================

-- Etiquetas básicas
INSERT INTO etiquetas (nombre, color, descripcion) VALUES
('VIP', '#F59E0B', 'Cliente VIP'),
('Interesado', '#10B981', 'Cliente interesado'),
('Seguimiento', '#3B82F6', 'Requiere seguimiento'),
('Problema', '#EF4444', 'Cliente con problemas'),
('Convertido', '#8B5CF6', 'Lead convertido'),
('Nuevo', '#14B8A6', 'Contacto nuevo');

-- Plantillas básicas
INSERT INTO plantillas_mensajes (nombre, categoria, contenido) VALUES
('Saludo inicial', 'general', 'Hola {nombre}, gracias por contactarnos. ¿En qué podemos ayudarte?'),
('Seguimiento', 'seguimiento', 'Hola {nombre}, te contactamos para dar seguimiento. ¿Necesitas más información?'),
('Cierre', 'general', 'Gracias por contactarnos {nombre}. ¡Que tengas un excelente día!');