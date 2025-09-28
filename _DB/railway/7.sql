-- ============================================================================
-- TABLA PARA GESTIÓN DE EXCLUSIONES DE CONTACTOS EN GOOGLE SHEETS
-- ============================================================================

USE railway;

-- Crear tabla para gestionar exclusiones de contactos por asignación
CREATE TABLE google_sheets_contactos_exclusiones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    asignacion_id INT NOT NULL,
    
    -- Información del contacto
    numero_telefono VARCHAR(20) NOT NULL,
    nombre VARCHAR(255) NULL,
    fila_numero INT NOT NULL,
    
    -- Estado de exclusión
    excluido BOOLEAN DEFAULT 0,
    fecha_exclusion TIMESTAMP NULL,
    excluido_por INT NULL,
    
    -- Fechas de control
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Relaciones
    FOREIGN KEY (asignacion_id) REFERENCES google_sheets_asignaciones(id) ON DELETE CASCADE,
    FOREIGN KEY (excluido_por) REFERENCES usuarios(id) ON DELETE SET NULL,
    
    -- Índices para optimización
    INDEX idx_asignacion (asignacion_id),
    INDEX idx_telefono (numero_telefono),
    INDEX idx_excluido (excluido),
    INDEX idx_fila (fila_numero),
    
    -- Garantizar un solo registro por asignación y teléfono
    UNIQUE KEY unique_asignacion_telefono (asignacion_id, numero_telefono)
) ENGINE=InnoDB;

-- Comentarios para documentación
ALTER TABLE google_sheets_contactos_exclusiones 
COMMENT = 'Tabla para gestionar exclusiones de contactos específicos por asignación de Google Sheets';

-- Verificar que la tabla se creó correctamente
DESCRIBE google_sheets_contactos_exclusiones;

SELECT 'Tabla google_sheets_contactos_exclusiones creada exitosamente' as resultado;