-- Ejecutar en tu base de datos MySQL
USE railway;

-- Tabla para almacenar información de Instagram Business Accounts
CREATE TABLE instagram_business_accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    instagram_business_id VARCHAR(255) NOT NULL UNIQUE,
    nombre VARCHAR(100),
    username VARCHAR(100),
    profile_picture_url VARCHAR(500),
    followers_count INT DEFAULT 0,
    media_count INT DEFAULT 0,
    activa BOOLEAN DEFAULT 1,
    fecha_vinculacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_business_id (instagram_business_id)
) ENGINE=InnoDB;

-- Tabla para logs específicos de Instagram
CREATE TABLE instagram_webhooks_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    entry_id VARCHAR(255),
    messaging_data JSON,
    sender_id VARCHAR(255),
    recipient_id VARCHAR(255),
    message_id VARCHAR(255),
    timestamp_recibido BIGINT,
    procesado BOOLEAN DEFAULT 0,
    error_procesamiento TEXT NULL,
    fecha_recepcion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_procesamiento TIMESTAMP NULL,
    
    INDEX idx_sender (sender_id),
    INDEX idx_procesado (procesado),
    INDEX idx_message_id (message_id)
) ENGINE=InnoDB;

-- Tabla para métricas de Instagram
CREATE TABLE instagram_metricas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    configuracion_id INT NOT NULL,
    mensajes_enviados INT DEFAULT 0,
    mensajes_recibidos INT DEFAULT 0,
    conversaciones_nuevas INT DEFAULT 0,
    fecha_metrica DATE NOT NULL,
    
    FOREIGN KEY (configuracion_id) REFERENCES configuraciones_instagram(id) ON DELETE CASCADE,
    UNIQUE KEY unique_config_fecha (configuracion_id, fecha_metrica)
) ENGINE=InnoDB;