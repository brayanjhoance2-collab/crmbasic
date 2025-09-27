-- ============================================================================
-- TABLAS PARA AUTOMATIZACIÓN - SIN ERRORES
-- ============================================================================

USE railway;


-- Eliminar tablas si existen (en orden correcto)
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS automatizaciones_historial;
DROP TABLE IF EXISTS automatizaciones;
SET FOREIGN_KEY_CHECKS = 1;

-- Crear tabla automatizaciones
CREATE TABLE automatizaciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    
    trigger_tipo ENUM('mensaje_recibido', 'nueva_conversacion', 'palabra_clave', 'tiempo_respuesta', 'horario') NOT NULL,
    trigger_condicion TEXT,
    
    accion_tipo ENUM('enviar_mensaje', 'asignar_agente', 'cambiar_estado', 'etiquetar', 'webhook') NOT NULL,
    accion_contenido TEXT NOT NULL,
    
    plantilla_id INT NULL,
    
    plataformas JSON NOT NULL,
    activa BOOLEAN DEFAULT 1,
    prioridad INT DEFAULT 1,
    
    creada_por INT,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (creada_por) REFERENCES usuarios(id) ON DELETE SET NULL,
    FOREIGN KEY (plantilla_id) REFERENCES plantillas_mensajes(id) ON DELETE SET NULL,
    
    INDEX idx_trigger_tipo (trigger_tipo),
    INDEX idx_accion_tipo (accion_tipo),
    INDEX idx_activa (activa),
    INDEX idx_prioridad (prioridad)
) ENGINE=InnoDB;

-- Crear tabla historial
CREATE TABLE automatizaciones_historial (
    id INT AUTO_INCREMENT PRIMARY KEY,
    automatizacion_id INT NOT NULL,
    conversacion_id INT NULL,
    
    trigger_tipo VARCHAR(50) NOT NULL,
    accion_ejecutada VARCHAR(50) NOT NULL,
    estado ENUM('ejecutado', 'fallido') NOT NULL,
    
    resultado_mensaje TEXT,
    error_mensaje TEXT NULL,
    
    fecha_ejecucion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (automatizacion_id) REFERENCES automatizaciones(id) ON DELETE CASCADE,
    FOREIGN KEY (conversacion_id) REFERENCES conversaciones(id) ON DELETE SET NULL,
    
    INDEX idx_automatizacion (automatizacion_id),
    INDEX idx_estado (estado),
    INDEX idx_fecha (fecha_ejecucion)
) ENGINE=InnoDB;

-- Insertar automatización de prueba
INSERT INTO automatizaciones (
    nombre, 
    descripcion, 
    trigger_tipo, 
    accion_tipo, 
    accion_contenido,
    plataformas,
    activa,
    prioridad,
    creada_por
) VALUES (
    'Saludo Automático',
    'Respuesta automática para nuevas conversaciones',
    'nueva_conversacion',
    'enviar_mensaje',
    'Hola, gracias por contactarnos. En breve un agente te atenderá.',
    '["whatsapp"]',
    0,
    1,
    1
);

SELECT 'Automatización creada exitosamente' as resultado;