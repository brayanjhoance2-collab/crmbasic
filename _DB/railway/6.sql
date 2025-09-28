-- ============================================================================
-- TABLA PARA ASIGNACIÓN DE MENSAJES AUTOMÁTICOS DESDE GOOGLE SHEETS - FINAL
-- ============================================================================

USE railway;

-- Eliminar tabla si existe
DROP TABLE IF EXISTS google_sheets_envios_historial;
DROP TABLE IF EXISTS google_sheets_asignaciones;

-- Tabla para configurar asignaciones de mensajes por columna
CREATE TABLE google_sheets_asignaciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    
    -- Información del sheet
    spreadsheet_id VARCHAR(255) NOT NULL,
    sheet_name VARCHAR(255) NOT NULL,
    columna_telefono VARCHAR(10) NOT NULL, -- A, B, C, etc.
    columna_nombre VARCHAR(10) NULL,
    columna_restriccion VARCHAR(10) NULL, -- Columna para restringir envíos (ej: si tiene "NO" no enviar)
    
    -- Configuración de mensajes (solo bienvenida)
    mensaje_bienvenida TEXT NOT NULL,
    
    -- Configuración de envío
    enviar_solo_nuevos BOOLEAN DEFAULT 1,
    valor_restriccion VARCHAR(50) NULL, -- Valor que indica NO enviar (ej: "NO", "ENVIADO", etc.)
    
    -- Estado
    activa BOOLEAN DEFAULT 1,
    
    -- Fechas de control
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    
    -- Índices
    INDEX idx_usuario (usuario_id),
    INDEX idx_spreadsheet (spreadsheet_id),
    INDEX idx_activa (activa),
    
    -- Una asignación por sheet y usuario
    UNIQUE KEY unique_usuario_sheet (usuario_id, spreadsheet_id, sheet_name)
) ENGINE=InnoDB;

-- Tabla para historial de envíos
CREATE TABLE google_sheets_envios_historial (
    id INT AUTO_INCREMENT PRIMARY KEY,
    asignacion_id INT NULL,
    usuario_id INT NOT NULL,
    
    -- Información del destinatario
    numero_telefono VARCHAR(20) NOT NULL,
    nombre_destinatario VARCHAR(255) NULL,
    
    -- Información del mensaje
    tipo_mensaje ENUM('bienvenida', 'manual') NOT NULL,
    contenido_mensaje TEXT NOT NULL,
    
    -- Estado del envío
    estado_envio ENUM('pendiente', 'enviado', 'fallido', 'cancelado') DEFAULT 'pendiente',
    mensaje_id_whatsapp VARCHAR(255) NULL,
    error_envio TEXT NULL,
    
    -- Información adicional
    spreadsheet_id VARCHAR(255) NOT NULL,
    sheet_name VARCHAR(255) NOT NULL,
    fila_sheet INT NOT NULL,
    
    -- Fechas
    fecha_programado TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_enviado TIMESTAMP NULL,
    fecha_entregado TIMESTAMP NULL,
    
    FOREIGN KEY (asignacion_id) REFERENCES google_sheets_asignaciones(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    
    -- Índices
    INDEX idx_asignacion (asignacion_id),
    INDEX idx_usuario (usuario_id),
    INDEX idx_numero (numero_telefono),
    INDEX idx_estado (estado_envio),
    INDEX idx_fecha_enviado (fecha_enviado),
    INDEX idx_spreadsheet (spreadsheet_id),
    INDEX idx_fecha_programado (fecha_programado),
    
    -- Índice compuesto para evitar envíos duplicados
    INDEX idx_envio_duplicado (asignacion_id, numero_telefono, tipo_mensaje, fecha_programado)
) ENGINE=InnoDB;

-- Insertar datos de ejemplo (opcional)
INSERT INTO google_sheets_asignaciones (
    usuario_id,
    spreadsheet_id,
    sheet_name,
    columna_telefono,
    columna_nombre,
    columna_restriccion,
    mensaje_bienvenida,
    valor_restriccion,
    enviar_solo_nuevos
) 
SELECT 
    1,
    'ejemplo_spreadsheet_id',
    'Contactos',
    'D',
    'B',
    'E',
    'Hola {nombre}, bienvenido a nuestro servicio. Estamos aquí para ayudarte.',
    'NO',
    1
WHERE EXISTS (SELECT 1 FROM usuarios WHERE id = 1 LIMIT 1);

SELECT 'Tablas de asignación de mensajes creadas exitosamente' as resultado;