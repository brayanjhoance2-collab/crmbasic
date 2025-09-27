"use client"
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import estilos from "./usuarios.module.css"
import { 
    obtenerUsuarioActual, 
    obtenerUsuarios,
    crearUsuario,
    actualizarUsuario,
    eliminarUsuario,
    activarDesactivarUsuario,
    resetearContrasena
} from "./servidor"

export default function UsuariosPage() {
    const router = useRouter()
    const [usuario, setUsuario] = useState(null)
    const [usuarios, setUsuarios] = useState([])
    const [loading, setLoading] = useState(true)
    const [loadingData, setLoadingData] = useState(false)
    
    // Estados para filtros y búsqueda
    const [filtros, setFiltros] = useState({
        busqueda: '',
        rol: 'todos',
        estado: 'todos'
    })
    
    // Estados para paginación
    const [paginacion, setPaginacion] = useState({
        paginaActual: 1,
        totalPaginas: 1,
        totalUsuarios: 0,
        usuariosPorPagina: 20
    })
    
    // Estados para modal
    const [modalAbierto, setModalAbierto] = useState(false)
    const [usuarioEditando, setUsuarioEditando] = useState(null)
    const [modalContrasena, setModalContrasena] = useState(false)
    const [usuarioResetear, setUsuarioResetear] = useState(null)

    useEffect(() => {
        verificarYCargarDatos()
    }, [])

    useEffect(() => {
        if (usuario) {
            cargarUsuarios()
        }
    }, [filtros, paginacion.paginaActual, usuario])

    const verificarYCargarDatos = async () => {
        try {
            setLoading(true)
            
            const usuarioData = await obtenerUsuarioActual()
            if (!usuarioData) {
                router.push('/login')
                return
            }

            // Solo admins y superadmins pueden acceder
            if (usuarioData.rol === 'usuario') {
                router.push('/dashboard')
                return
            }
            
            setUsuario(usuarioData)
            
        } catch (error) {
            console.log('Error al verificar usuario:', error)
            router.push('/login')
        } finally {
            setLoading(false)
        }
    }

    const cargarUsuarios = async () => {
        try {
            setLoadingData(true)
            
            const respuesta = await obtenerUsuarios({
                ...filtros,
                pagina: paginacion.paginaActual,
                limite: paginacion.usuariosPorPagina
            })
            
            setUsuarios(respuesta.usuarios)
            setPaginacion(prev => ({
                ...prev,
                totalPaginas: respuesta.totalPaginas,
                totalUsuarios: respuesta.totalUsuarios
            }))
            
        } catch (error) {
            console.log('Error al cargar usuarios:', error)
        } finally {
            setLoadingData(false)
        }
    }

    const manejarFiltro = (campo, valor) => {
        setFiltros(prev => ({
            ...prev,
            [campo]: valor
        }))
        setPaginacion(prev => ({
            ...prev,
            paginaActual: 1
        }))
    }

    const manejarPagina = (nuevaPagina) => {
        setPaginacion(prev => ({
            ...prev,
            paginaActual: nuevaPagina
        }))
    }

    const abrirModalUsuario = (usuarioData = null) => {
        setUsuarioEditando(usuarioData)
        setModalAbierto(true)
    }

    const cerrarModalUsuario = () => {
        setModalAbierto(false)
        setUsuarioEditando(null)
    }

    const manejarGuardarUsuario = async (datosUsuario) => {
        try {
            if (usuarioEditando) {
                await actualizarUsuario(usuarioEditando.id, datosUsuario)
            } else {
                await crearUsuario(datosUsuario)
            }
            
            await cargarUsuarios()
            cerrarModalUsuario()
            
        } catch (error) {
            console.log('Error al guardar usuario:', error)
            throw error
        }
    }

    const manejarEliminarUsuario = async (usuarioId) => {
        if (confirm('¿Estás seguro de que quieres eliminar este usuario? Esta acción no se puede deshacer.')) {
            try {
                await eliminarUsuario(usuarioId)
                await cargarUsuarios()
            } catch (error) {
                console.log('Error al eliminar usuario:', error)
                alert('Error al eliminar usuario: ' + error.message)
            }
        }
    }

    const manejarActivarDesactivar = async (usuarioId, activo) => {
        try {
            await activarDesactivarUsuario(usuarioId, !activo)
            await cargarUsuarios()
        } catch (error) {
            console.log('Error al cambiar estado del usuario:', error)
            alert('Error al cambiar estado del usuario: ' + error.message)
        }
    }

    const abrirModalContrasena = (usuarioData) => {
        setUsuarioResetear(usuarioData)
        setModalContrasena(true)
    }

    const cerrarModalContrasena = () => {
        setModalContrasena(false)
        setUsuarioResetear(null)
    }

    const manejarResetearContrasena = async (nuevaContrasena) => {
        try {
            await resetearContrasena(usuarioResetear.id, nuevaContrasena)
            await cargarUsuarios()
            cerrarModalContrasena()
        } catch (error) {
            console.log('Error al resetear contraseña:', error)
            throw error
        }
    }

    const obtenerIconoPorRol = (rol) => {
        switch(rol) {
            case 'superadmin': return 'shield-checkmark'
            case 'admin': return 'settings'
            case 'usuario': return 'person'
            default: return 'person-outline'
        }
    }

    const obtenerColorPorRol = (rol) => {
        switch(rol) {
            case 'superadmin': return 'rojo'
            case 'admin': return 'azul'
            case 'usuario': return 'verde'
            default: return 'gris'
        }
    }

    const formatearFecha = (fecha) => {
        if (!fecha) return 'Nunca'
        return new Intl.DateTimeFormat('es-ES', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(new Date(fecha))
    }

    if (loading) {
        return (
            <div className={estilos.loadingContainer}>
                <div className={estilos.loadingSpinner}></div>
                <p>Cargando usuarios...</p>
            </div>
        )
    }

    return (
        <div className={estilos.usuariosContainer}>
            {/* Header de la página */}
            <div className={estilos.pageHeader}>
                <div className={estilos.pageTitle}>
                    <ion-icon name="people-outline"></ion-icon>
                    <h1>Gestión de Usuarios</h1>
                </div>
                <button 
                    className={estilos.botonPrimario} 
                    onClick={() => abrirModalUsuario()}
                >
                    <ion-icon name="person-add-outline"></ion-icon>
                    Nuevo Usuario
                </button>
            </div>

            {/* Estadísticas rápidas */}
            <div className={estilos.statsBar}>
                <div className={estilos.statItem}>
                    <span className={estilos.statNumber}>{paginacion.totalUsuarios}</span>
                    <span className={estilos.statLabel}>Total Usuarios</span>
                </div>
                <div className={estilos.statItem}>
                    <span className={estilos.statNumber}>
                        {usuarios.filter(u => u.activo).length}
                    </span>
                    <span className={estilos.statLabel}>Activos</span>
                </div>
                <div className={estilos.statItem}>
                    <span className={estilos.statNumber}>
                        {usuarios.filter(u => u.rol === 'admin').length}
                    </span>
                    <span className={estilos.statLabel}>Admins</span>
                </div>
                <div className={estilos.statItem}>
                    <span className={estilos.statNumber}>
                        {usuarios.filter(u => u.rol === 'usuario').length}
                    </span>
                    <span className={estilos.statLabel}>Usuarios</span>
                </div>
            </div>

            {/* Filtros */}
            <div className={estilos.filtrosSection}>
                <div className={estilos.searchBox}>
                    <ion-icon name="search-outline"></ion-icon>
                    <input
                        type="text"
                        placeholder="Buscar por nombre, email o teléfono..."
                        value={filtros.busqueda}
                        onChange={(e) => manejarFiltro('busqueda', e.target.value)}
                    />
                </div>
                
                <div className={estilos.filtros}>
                    <select
                        value={filtros.rol}
                        onChange={(e) => manejarFiltro('rol', e.target.value)}
                    >
                        <option value="todos">Todos los roles</option>
                        <option value="superadmin">Super Admin</option>
                        <option value="admin">Admin</option>
                        <option value="usuario">Usuario</option>
                    </select>
                    
                    <select
                        value={filtros.estado}
                        onChange={(e) => manejarFiltro('estado', e.target.value)}
                    >
                        <option value="todos">Todos los estados</option>
                        <option value="activo">Activos</option>
                        <option value="inactivo">Inactivos</option>
                    </select>
                </div>
            </div>

            {/* Lista de usuarios */}
            <div className={estilos.usuariosSection}>
                {loadingData ? (
                    <div className={estilos.loadingData}>
                        <div className={estilos.loadingSpinner}></div>
                        <p>Cargando usuarios...</p>
                    </div>
                ) : usuarios.length > 0 ? (
                    <div className={estilos.usuariosGrid}>
                        {usuarios.map((usuarioItem) => (
                            <div key={usuarioItem.id} className={estilos.usuarioCard}>
                                <div className={estilos.usuarioHeader}>
                                    <div className={estilos.usuarioAvatar}>
                                        {usuarioItem.avatar_url ? (
                                            <img src={usuarioItem.avatar_url} alt="Avatar" />
                                        ) : (
                                            <ion-icon name="person-outline"></ion-icon>
                                        )}
                                        <div className={estilos.rolBadge}>
                                            <ion-icon name={obtenerIconoPorRol(usuarioItem.rol)}></ion-icon>
                                        </div>
                                    </div>
                                    <div className={estilos.usuarioInfo}>
                                        <h3 className={estilos.usuarioNombre}>
                                            {usuarioItem.nombre} {usuarioItem.apellidos}
                                        </h3>
                                        <p className={estilos.usuarioCorreo}>{usuarioItem.correo}</p>
                                        {usuarioItem.telefono && (
                                            <p className={estilos.usuarioTelefono}>{usuarioItem.telefono}</p>
                                        )}
                                    </div>
                                    <div className={estilos.usuarioEstado}>
                                        <span className={`${estilos.estadoBadge} ${usuarioItem.activo ? estilos.activo : estilos.inactivo}`}>
                                            {usuarioItem.activo ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </div>
                                </div>

                                <div className={estilos.usuarioBody}>
                                    <div className={estilos.usuarioMeta}>
                                        <span className={`${estilos.rolChip} ${estilos[obtenerColorPorRol(usuarioItem.rol)]}`}>
                                            <ion-icon name={obtenerIconoPorRol(usuarioItem.rol)}></ion-icon>
                                            {usuarioItem.rol === 'superadmin' ? 'Super Admin' :
                                             usuarioItem.rol === 'admin' ? 'Admin' : 'Usuario'}
                                        </span>
                                    </div>

                                    <div className={estilos.usuarioFechas}>
                                        <div className={estilos.fechaItem}>
                                            <span className={estilos.fechaLabel}>Registrado:</span>
                                            <span className={estilos.fechaValor}>{formatearFecha(usuarioItem.fecha_registro)}</span>
                                        </div>
                                        <div className={estilos.fechaItem}>
                                            <span className={estilos.fechaLabel}>Último acceso:</span>
                                            <span className={estilos.fechaValor}>{formatearFecha(usuarioItem.ultimo_acceso)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className={estilos.usuarioActions}>
                                    <button 
                                        className={estilos.actionBtn}
                                        onClick={() => abrirModalContrasena(usuarioItem)}
                                        title="Resetear contraseña"
                                    >
                                        <ion-icon name="key-outline"></ion-icon>
                                    </button>
                                    <button 
                                        className={estilos.actionBtn}
                                        onClick={() => manejarActivarDesactivar(usuarioItem.id, usuarioItem.activo)}
                                        title={usuarioItem.activo ? 'Desactivar' : 'Activar'}
                                    >
                                        <ion-icon name={usuarioItem.activo ? "eye-off-outline" : "eye-outline"}></ion-icon>
                                    </button>
                                    <button 
                                        className={estilos.actionBtn}
                                        onClick={() => abrirModalUsuario(usuarioItem)}
                                        title="Editar usuario"
                                    >
                                        <ion-icon name="create-outline"></ion-icon>
                                    </button>
                                    {usuarioItem.id !== usuario.id && (
                                        <button 
                                            className={estilos.actionBtn}
                                            onClick={() => manejarEliminarUsuario(usuarioItem.id)}
                                            title="Eliminar usuario"
                                        >
                                            <ion-icon name="trash-outline"></ion-icon>
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className={estilos.emptyState}>
                        <ion-icon name="people-outline"></ion-icon>
                        <h3>No hay usuarios</h3>
                        <p>Comienza agregando el primer usuario</p>
                        <button 
                            className={estilos.botonPrimario} 
                            onClick={() => abrirModalUsuario()}
                        >
                            <ion-icon name="person-add-outline"></ion-icon>
                            Crear Usuario
                        </button>
                    </div>
                )}
            </div>

            {/* Paginación */}
            {paginacion.totalPaginas > 1 && (
                <div className={estilos.paginacion}>
                    <button
                        onClick={() => manejarPagina(paginacion.paginaActual - 1)}
                        disabled={paginacion.paginaActual === 1}
                        className={estilos.paginacionBtn}
                    >
                        <ion-icon name="chevron-back-outline"></ion-icon>
                        Anterior
                    </button>
                    
                    <span className={estilos.paginacionInfo}>
                        Página {paginacion.paginaActual} de {paginacion.totalPaginas}
                    </span>
                    
                    <button
                        onClick={() => manejarPagina(paginacion.paginaActual + 1)}
                        disabled={paginacion.paginaActual === paginacion.totalPaginas}
                        className={estilos.paginacionBtn}
                    >
                        Siguiente
                        <ion-icon name="chevron-forward-outline"></ion-icon>
                    </button>
                </div>
            )}

            {/* Modal de usuario */}
            {modalAbierto && (
                <ModalUsuario
                    usuario={usuarioEditando}
                    onGuardar={manejarGuardarUsuario}
                    onCerrar={cerrarModalUsuario}
                    usuarioLogueado={usuario}
                />
            )}

            {/* Modal de contraseña */}
            {modalContrasena && (
                <ModalContrasena
                    usuario={usuarioResetear}
                    onResetear={manejarResetearContrasena}
                    onCerrar={cerrarModalContrasena}
                />
            )}
        </div>
    )
}

// Modal para crear/editar usuarios
function ModalUsuario({ usuario: usuarioEditando, onGuardar, onCerrar, usuarioLogueado }) {
    const [formData, setFormData] = useState({
        nombre: usuarioEditando?.nombre || '',
        apellidos: usuarioEditando?.apellidos || '',
        correo: usuarioEditando?.correo || '',
        telefono: usuarioEditando?.telefono || '',
        rol: usuarioEditando?.rol || 'usuario',
        contrasena: '',
        confirmarContrasena: ''
    })

    const [guardando, setGuardando] = useState(false)
    const [error, setError] = useState('')

    const manejarCambio = (campo, valor) => {
        setFormData(prev => ({
            ...prev,
            [campo]: valor
        }))
        setError('')
    }

    const manejarSubmit = async (e) => {
        e.preventDefault()
        setError('')
        
        // Validaciones
        if (!formData.nombre.trim() || !formData.apellidos.trim() || !formData.correo.trim()) {
            setError('Nombre, apellidos y correo son requeridos')
            return
        }

        if (!usuarioEditando && (!formData.contrasena || formData.contrasena.length < 6)) {
            setError('La contraseña debe tener al menos 6 caracteres')
            return
        }

        if (!usuarioEditando && formData.contrasena !== formData.confirmarContrasena) {
            setError('Las contraseñas no coinciden')
            return
        }

        // Solo superadmins pueden crear otros superadmins
        if (formData.rol === 'superadmin' && usuarioLogueado.rol !== 'superadmin') {
            setError('Solo un Super Admin puede crear otro Super Admin')
            return
        }

        setGuardando(true)
        
        try {
            await onGuardar(formData)
        } catch (error) {
            setError(error.message || 'Error al guardar usuario')
        } finally {
            setGuardando(false)
        }
    }

    return (
        <div className={estilos.modalOverlay}>
            <div className={estilos.modal}>
                <div className={estilos.modalHeader}>
                    <h3>
                        {usuarioEditando ? 'Editar Usuario' : 'Nuevo Usuario'}
                    </h3>
                    <button onClick={onCerrar} className={estilos.modalClose}>
                        <ion-icon name="close-outline"></ion-icon>
                    </button>
                </div>

                <form onSubmit={manejarSubmit} className={estilos.modalForm}>
                    {error && (
                        <div className={estilos.errorMessage}>
                            <ion-icon name="alert-circle-outline"></ion-icon>
                            {error}
                        </div>
                    )}

                    <div className={estilos.formRow}>
                        <div className={estilos.formGroup}>
                            <label>Nombre *</label>
                            <input
                                type="text"
                                value={formData.nombre}
                                onChange={(e) => manejarCambio('nombre', e.target.value)}
                                required
                            />
                        </div>
                        <div className={estilos.formGroup}>
                            <label>Apellidos *</label>
                            <input
                                type="text"
                                value={formData.apellidos}
                                onChange={(e) => manejarCambio('apellidos', e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className={estilos.formRow}>
                        <div className={estilos.formGroup}>
                            <label>Correo Electrónico *</label>
                            <input
                                type="email"
                                value={formData.correo}
                                onChange={(e) => manejarCambio('correo', e.target.value)}
                                required
                            />
                        </div>
                        <div className={estilos.formGroup}>
                            <label>Teléfono</label>
                            <input
                                type="tel"
                                value={formData.telefono}
                                onChange={(e) => manejarCambio('telefono', e.target.value)}
                            />
                        </div>
                    </div>

                    <div className={estilos.formGroup}>
                        <label>Rol *</label>
                        <select
                            value={formData.rol}
                            onChange={(e) => manejarCambio('rol', e.target.value)}
                            required
                        >
                            <option value="usuario">Usuario</option>
                            <option value="admin">Admin</option>
                            {usuarioLogueado.rol === 'superadmin' && (
                                <option value="superadmin">Super Admin</option>
                            )}
                        </select>
                    </div>

                    {!usuarioEditando && (
                        <>
                            <div className={estilos.formRow}>
                                <div className={estilos.formGroup}>
                                    <label>Contraseña *</label>
                                    <input
                                        type="password"
                                        value={formData.contrasena}
                                        onChange={(e) => manejarCambio('contrasena', e.target.value)}
                                        required
                                        minLength="6"
                                    />
                                </div>
                                <div className={estilos.formGroup}>
                                    <label>Confirmar Contraseña *</label>
                                    <input
                                        type="password"
                                        value={formData.confirmarContrasena}
                                        onChange={(e) => manejarCambio('confirmarContrasena', e.target.value)}
                                        required
                                        minLength="6"
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    <div className={estilos.modalActions}>
                        <button type="button" onClick={onCerrar} className={estilos.botonSecundario}>
                            Cancelar
                        </button>
                        <button type="submit" disabled={guardando} className={estilos.botonPrimario}>
                            {guardando ? 'Guardando...' : 'Guardar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

// Modal para resetear contraseña
function ModalContrasena({ usuario, onResetear, onCerrar }) {
    const [nuevaContrasena, setNuevaContrasena] = useState('')
    const [confirmarContrasena, setConfirmarContrasena] = useState('')
    const [guardando, setGuardando] = useState(false)
    const [error, setError] = useState('')

    const manejarSubmit = async (e) => {
        e.preventDefault()
        setError('')

        if (nuevaContrasena.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres')
            return
        }

        if (nuevaContrasena !== confirmarContrasena) {
            setError('Las contraseñas no coinciden')
            return
        }

        setGuardando(true)
        
        try {
            await onResetear(nuevaContrasena)
        } catch (error) {
            setError(error.message || 'Error al resetear contraseña')
        } finally {
            setGuardando(false)
        }
    }

    return (
        <div className={estilos.modalOverlay}>
            <div className={estilos.modalSmall}>
                <div className={estilos.modalHeader}>
                    <h3>Resetear Contraseña</h3>
                    <button onClick={onCerrar} className={estilos.modalClose}>
                        <ion-icon name="close-outline"></ion-icon>
                    </button>
                </div>

                <form onSubmit={manejarSubmit} className={estilos.modalForm}>
                    {error && (
                        <div className={estilos.errorMessage}>
                            <ion-icon name="alert-circle-outline"></ion-icon>
                            {error}
                        </div>
                    )}

                    <div className={estilos.usuarioInfo}>
                        <strong>{usuario.nombre} {usuario.apellidos}</strong>
                        <span>{usuario.correo}</span>
                    </div>

                    <div className={estilos.formGroup}>
                        <label>Nueva Contraseña *</label>
                        <input
                            type="password"
                            value={nuevaContrasena}
                            onChange={(e) => setNuevaContrasena(e.target.value)}
                            required
                            minLength="6"
                        />
                    </div>

                    <div className={estilos.formGroup}>
                        <label>Confirmar Contraseña *</label>
                        <input
                            type="password"
                            value={confirmarContrasena}
                            onChange={(e) => setConfirmarContrasena(e.target.value)}
                            required
                            minLength="6"
                        />
                    </div>

                    <div className={estilos.modalActions}>
                        <button type="button" onClick={onCerrar} className={estilos.botonSecundario}>
                            Cancelar
                        </button>
                        <button type="submit" disabled={guardando} className={estilos.botonPrimario}>
                            {guardando ? 'Reseteando...' : 'Resetear'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}