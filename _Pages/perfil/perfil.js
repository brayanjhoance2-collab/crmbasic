"use client"
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import estilos from "./perfil.module.css"
import { 
    obtenerUsuarioActual,
    actualizarPerfil,
    cambiarContrasena,
    subirAvatar,
    eliminarAvatar,
    cerrarSesion
} from "./servidor"

export default function PerfilPage() {
    const router = useRouter()
    const [usuario, setUsuario] = useState(null)
    const [loading, setLoading] = useState(true)
    const [guardando, setGuardando] = useState(false)
    
    // Estados para edición de perfil
    const [editandoPerfil, setEditandoPerfil] = useState(false)
    const [datosUsuario, setDatosUsuario] = useState({
        nombre: '',
        apellidos: '',
        correo: '',
        telefono: ''
    })
    
    // Estados para cambio de contraseña
    const [cambiandoPassword, setCambiandoPassword] = useState(false)
    const [datosPassword, setDatosPassword] = useState({
        contrasenaActual: '',
        contrasenaNueva: '',
        confirmarContrasena: ''
    })
    
    // Estados para avatar
    const [subiendoAvatar, setSubiendoAvatar] = useState(false)
    const [previewAvatar, setPreviewAvatar] = useState(null)
    
    // Estados para errores y mensajes
    const [error, setError] = useState('')
    const [mensaje, setMensaje] = useState('')

    useEffect(() => {
        verificarYCargarDatos()
    }, [])

    const verificarYCargarDatos = async () => {
        try {
            setLoading(true)
            
            const usuarioData = await obtenerUsuarioActual()
            if (!usuarioData) {
                router.push('/login')
                return
            }
            
            setUsuario(usuarioData)
            setDatosUsuario({
                nombre: usuarioData.nombre,
                apellidos: usuarioData.apellidos,
                correo: usuarioData.correo,
                telefono: usuarioData.telefono || ''
            })
            
        } catch (error) {
            console.log('Error al verificar usuario:', error)
            router.push('/login')
        } finally {
            setLoading(false)
        }
    }

    const manejarCambioPerfil = (campo, valor) => {
        setDatosUsuario(prev => ({
            ...prev,
            [campo]: valor
        }))
        setError('')
    }

    const manejarCambioPassword = (campo, valor) => {
        setDatosPassword(prev => ({
            ...prev,
            [campo]: valor
        }))
        setError('')
    }

    const guardarPerfil = async (e) => {
        e.preventDefault()
        setError('')
        setMensaje('')
        
        if (!datosUsuario.nombre.trim() || !datosUsuario.apellidos.trim() || !datosUsuario.correo.trim()) {
            setError('Nombre, apellidos y correo son requeridos')
            return
        }

        setGuardando(true)
        
        try {
            await actualizarPerfil(datosUsuario)
            setMensaje('Perfil actualizado exitosamente')
            setEditandoPerfil(false)
            
            // Actualizar datos del usuario en estado
            setUsuario(prev => ({
                ...prev,
                ...datosUsuario,
                nombreCompleto: `${datosUsuario.nombre} ${datosUsuario.apellidos}`
            }))
            
        } catch (error) {
            setError(error.message || 'Error al actualizar perfil')
        } finally {
            setGuardando(false)
        }
    }

    const cambiarPassword = async (e) => {
        e.preventDefault()
        setError('')
        setMensaje('')
        
        if (!datosPassword.contrasenaActual || !datosPassword.contrasenaNueva || !datosPassword.confirmarContrasena) {
            setError('Todos los campos de contraseña son requeridos')
            return
        }

        if (datosPassword.contrasenaNueva.length < 6) {
            setError('La nueva contraseña debe tener al menos 6 caracteres')
            return
        }

        if (datosPassword.contrasenaNueva !== datosPassword.confirmarContrasena) {
            setError('Las contraseñas no coinciden')
            return
        }

        setGuardando(true)
        
        try {
            await cambiarContrasena(datosPassword.contrasenaActual, datosPassword.contrasenaNueva)
            setMensaje('Contraseña cambiada exitosamente')
            setCambiandoPassword(false)
            setDatosPassword({
                contrasenaActual: '',
                contrasenaNueva: '',
                confirmarContrasena: ''
            })
            
        } catch (error) {
            setError(error.message || 'Error al cambiar contraseña')
        } finally {
            setGuardando(false)
        }
    }

    const manejarSubirAvatar = async (event) => {
        const file = event.target.files[0]
        if (!file) return

        // Validar archivo
        if (!file.type.startsWith('image/')) {
            setError('Solo se permiten archivos de imagen')
            return
        }

        if (file.size > 5 * 1024 * 1024) {
            setError('El archivo no puede ser mayor a 5MB')
            return
        }

        setSubiendoAvatar(true)
        setError('')
        
        try {
            const formData = new FormData()
            formData.append('avatar', file)
            
            const resultado = await subirAvatar(formData)
            
            setUsuario(prev => ({
                ...prev,
                avatarUrl: resultado.avatarUrl
            }))
            
            setMensaje('Avatar actualizado exitosamente')
            setPreviewAvatar(null)
            
        } catch (error) {
            setError(error.message || 'Error al subir avatar')
        } finally {
            setSubiendoAvatar(false)
        }
    }

    const manejarEliminarAvatar = async () => {
        if (!confirm('¿Estás seguro de que quieres eliminar tu avatar?')) {
            return
        }

        setSubiendoAvatar(true)
        setError('')
        
        try {
            await eliminarAvatar()
            
            setUsuario(prev => ({
                ...prev,
                avatarUrl: null
            }))
            
            setMensaje('Avatar eliminado exitosamente')
            
        } catch (error) {
            setError(error.message || 'Error al eliminar avatar')
        } finally {
            setSubiendoAvatar(false)
        }
    }

    const manejarCerrarSesion = async () => {
        if (!confirm('¿Estás seguro de que quieres cerrar sesión?')) {
            return
        }

        try {
            await cerrarSesion()
            router.push('/login')
        } catch (error) {
            setError('Error al cerrar sesión')
        }
    }

    const cancelarEdicion = () => {
        setEditandoPerfil(false)
        setDatosUsuario({
            nombre: usuario.nombre,
            apellidos: usuario.apellidos,
            correo: usuario.correo,
            telefono: usuario.telefono || ''
        })
        setError('')
    }

    const cancelarCambioPassword = () => {
        setCambiandoPassword(false)
        setDatosPassword({
            contrasenaActual: '',
            contrasenaNueva: '',
            confirmarContrasena: ''
        })
        setError('')
    }

    const formatearFecha = (fecha) => {
        if (!fecha) return 'No disponible'
        return new Intl.DateTimeFormat('es-ES', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(new Date(fecha))
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

    if (loading) {
        return (
            <div className={estilos.loadingContainer}>
                <div className={estilos.loadingSpinner}></div>
                <p>Cargando perfil...</p>
            </div>
        )
    }

    return (
        <div className={estilos.perfilContainer}>
            {/* Header de la página */}
            <div className={estilos.pageHeader}>
                <div className={estilos.pageTitle}>
                    <ion-icon name="person-circle-outline"></ion-icon>
                    <h1>Mi Perfil</h1>
                </div>
                <button 
                    className={estilos.botonDanger}
                    onClick={manejarCerrarSesion}
                >
                    <ion-icon name="log-out-outline"></ion-icon>
                    Cerrar Sesión
                </button>
            </div>

            {/* Mensajes */}
            {error && (
                <div className={estilos.errorMessage}>
                    <ion-icon name="alert-circle-outline"></ion-icon>
                    {error}
                </div>
            )}

            {mensaje && (
                <div className={estilos.successMessage}>
                    <ion-icon name="checkmark-circle-outline"></ion-icon>
                    {mensaje}
                </div>
            )}

            <div className={estilos.perfilGrid}>
                {/* Información del Usuario */}
                <div className={estilos.perfilCard}>
                    <div className={estilos.avatarSection}>
                        <div className={estilos.avatarContainer}>
                            <div className={estilos.avatar}>
                                {usuario.avatarUrl ? (
                                    <img src={usuario.avatarUrl} alt="Avatar" />
                                ) : (
                                    <ion-icon name="person-outline"></ion-icon>
                                )}
                                <div className={estilos.rolBadge}>
                                    <ion-icon name={obtenerIconoPorRol(usuario.rol)}></ion-icon>
                                </div>
                            </div>
                            
                            <div className={estilos.avatarActions}>
                                <label className={estilos.avatarButton}>
                                    <ion-icon name="camera-outline"></ion-icon>
                                    {subiendoAvatar ? 'Subiendo...' : 'Cambiar'}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={manejarSubirAvatar}
                                        disabled={subiendoAvatar}
                                        style={{ display: 'none' }}
                                    />
                                </label>
                                
                                {usuario.avatarUrl && (
                                    <button 
                                        className={estilos.avatarButtonDanger}
                                        onClick={manejarEliminarAvatar}
                                        disabled={subiendoAvatar}
                                    >
                                        <ion-icon name="trash-outline"></ion-icon>
                                        Eliminar
                                    </button>
                                )}
                            </div>
                        </div>
                        
                        <div className={estilos.userInfo}>
                            <h2>{usuario.nombreCompleto}</h2>
                            <p className={estilos.userEmail}>{usuario.correo}</p>
                            <span className={`${estilos.rolChip} ${estilos[obtenerColorPorRol(usuario.rol)]}`}>
                                <ion-icon name={obtenerIconoPorRol(usuario.rol)}></ion-icon>
                                {usuario.rol === 'superadmin' ? 'Super Admin' :
                                 usuario.rol === 'admin' ? 'Admin' : 'Usuario'}
                            </span>
                        </div>
                    </div>

                    <div className={estilos.userStats}>
                        <div className={estilos.statItem}>
                            <span className={estilos.statLabel}>Miembro desde</span>
                            <span className={estilos.statValue}>{formatearFecha(usuario.fechaRegistro)}</span>
                        </div>
                        <div className={estilos.statItem}>
                            <span className={estilos.statLabel}>Último acceso</span>
                            <span className={estilos.statValue}>{formatearFecha(usuario.ultimoAcceso)}</span>
                        </div>
                        {usuario.telefono && (
                            <div className={estilos.statItem}>
                                <span className={estilos.statLabel}>Teléfono</span>
                                <span className={estilos.statValue}>{usuario.telefono}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Editar Información Personal */}
                <div className={estilos.formCard}>
                    <div className={estilos.cardHeader}>
                        <h3>
                            <ion-icon name="person-outline"></ion-icon>
                            Información Personal
                        </h3>
                        {!editandoPerfil && (
                            <button 
                                className={estilos.botonSecundario}
                                onClick={() => setEditandoPerfil(true)}
                            >
                                <ion-icon name="create-outline"></ion-icon>
                                Editar
                            </button>
                        )}
                    </div>

                    {editandoPerfil ? (
                        <form onSubmit={guardarPerfil} className={estilos.form}>
                            <div className={estilos.formRow}>
                                <div className={estilos.formGroup}>
                                    <label>Nombre *</label>
                                    <input
                                        type="text"
                                        value={datosUsuario.nombre}
                                        onChange={(e) => manejarCambioPerfil('nombre', e.target.value)}
                                        required
                                    />
                                </div>
                                <div className={estilos.formGroup}>
                                    <label>Apellidos *</label>
                                    <input
                                        type="text"
                                        value={datosUsuario.apellidos}
                                        onChange={(e) => manejarCambioPerfil('apellidos', e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            <div className={estilos.formRow}>
                                <div className={estilos.formGroup}>
                                    <label>Correo Electrónico *</label>
                                    <input
                                        type="email"
                                        value={datosUsuario.correo}
                                        onChange={(e) => manejarCambioPerfil('correo', e.target.value)}
                                        required
                                    />
                                </div>
                                <div className={estilos.formGroup}>
                                    <label>Teléfono</label>
                                    <input
                                        type="tel"
                                        value={datosUsuario.telefono}
                                        onChange={(e) => manejarCambioPerfil('telefono', e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className={estilos.formActions}>
                                <button 
                                    type="button" 
                                    onClick={cancelarEdicion}
                                    className={estilos.botonSecundario}
                                    disabled={guardando}
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={guardando}
                                    className={estilos.botonPrimario}
                                >
                                    {guardando ? 'Guardando...' : 'Guardar Cambios'}
                                </button>
                            </div>
                        </form>
                    ) : (
                        <div className={estilos.infoDisplay}>
                            <div className={estilos.infoItem}>
                                <span className={estilos.infoLabel}>Nombre completo</span>
                                <span className={estilos.infoValue}>{usuario.nombreCompleto}</span>
                            </div>
                            <div className={estilos.infoItem}>
                                <span className={estilos.infoLabel}>Correo electrónico</span>
                                <span className={estilos.infoValue}>{usuario.correo}</span>
                            </div>
                            <div className={estilos.infoItem}>
                                <span className={estilos.infoLabel}>Teléfono</span>
                                <span className={estilos.infoValue}>{usuario.telefono || 'No especificado'}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Cambiar Contraseña */}
                <div className={estilos.formCard}>
                    <div className={estilos.cardHeader}>
                        <h3>
                            <ion-icon name="lock-closed-outline"></ion-icon>
                            Seguridad
                        </h3>
                        {!cambiandoPassword && (
                            <button 
                                className={estilos.botonSecundario}
                                onClick={() => setCambiandoPassword(true)}
                            >
                                <ion-icon name="key-outline"></ion-icon>
                                Cambiar Contraseña
                            </button>
                        )}
                    </div>

                    {cambiandoPassword ? (
                        <form onSubmit={cambiarPassword} className={estilos.form}>
                            <div className={estilos.formGroup}>
                                <label>Contraseña Actual *</label>
                                <input
                                    type="password"
                                    value={datosPassword.contrasenaActual}
                                    onChange={(e) => manejarCambioPassword('contrasenaActual', e.target.value)}
                                    required
                                />
                            </div>

                            <div className={estilos.formRow}>
                                <div className={estilos.formGroup}>
                                    <label>Nueva Contraseña *</label>
                                    <input
                                        type="password"
                                        value={datosPassword.contrasenaNueva}
                                        onChange={(e) => manejarCambioPassword('contrasenaNueva', e.target.value)}
                                        required
                                        minLength="6"
                                    />
                                </div>
                                <div className={estilos.formGroup}>
                                    <label>Confirmar Nueva Contraseña *</label>
                                    <input
                                        type="password"
                                        value={datosPassword.confirmarContrasena}
                                        onChange={(e) => manejarCambioPassword('confirmarContrasena', e.target.value)}
                                        required
                                        minLength="6"
                                    />
                                </div>
                            </div>

                            <div className={estilos.formActions}>
                                <button 
                                    type="button" 
                                    onClick={cancelarCambioPassword}
                                    className={estilos.botonSecundario}
                                    disabled={guardando}
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={guardando}
                                    className={estilos.botonPrimario}
                                >
                                    {guardando ? 'Cambiando...' : 'Cambiar Contraseña'}
                                </button>
                            </div>
                        </form>
                    ) : (
                        <div className={estilos.securityInfo}>
                            <div className={estilos.securityItem}>
                                <ion-icon name="shield-checkmark-outline"></ion-icon>
                                <div>
                                    <h4>Contraseña segura</h4>
                                    <p>Tu contraseña fue actualizada por última vez hace tiempo. Considera cambiarla regularmente.</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}