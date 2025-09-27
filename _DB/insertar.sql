USE railway;

-- Eliminar los triggers problemáticos
DROP TRIGGER IF EXISTS before_whatsapp_active_insert;
DROP TRIGGER IF EXISTS before_whatsapp_active_update;

-- Verificar que no hay más triggers en la tabla
SHOW TRIGGERS LIKE 'configuraciones_activas';