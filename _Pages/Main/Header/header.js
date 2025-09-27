"use client"
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import estilos from "./header.module.css"
import { obtenerUsuarioActual, cerrarSesion, obtenerConteoNotificaciones } from "./servidor"

export default function HeaderMain(){
    const router = useRouter()
    const [usuario, setUsuario] = useState(null)
    const [menuUsuarioAbierto, setMenuUsuarioAbierto] = useState(false)
    const [menuMovilAbierto, setMenuMovilAbierto] = useState(false)
    const [loading, setLoading] = useState(true)
    const [notificacionesCount, setNotificacionesCount] = useState(0)

    useEffect(() => {
        cargarUsuario()
        cargarNotificaciones()
    }, [])

    const cargarUsuario = async () => {
        try {
            setLoading(true)
            const usuarioData = await obtenerUsuarioActual()
            console.log('Usuario cargado en header:', usuarioData)
            setUsuario(usuarioData)
        } catch (error) {
            console.log('Error al cargar usuario en header:', error)
            setUsuario(null)
        } finally {
            setLoading(false)
        }
    }

    const cargarNotificaciones = async () => {
        try {
            const conteo = await obtenerConteoNotificaciones()
            setNotificacionesCount(conteo)
        } catch (error) {
            console.log('Error al cargar notificaciones:', error)
            setNotificacionesCount(0)
        }
    }

    const manejarCerrarSesion = async () => {
        try {
            await cerrarSesion()
            setUsuario(null)
            setMenuUsuarioAbierto(false)
            router.push('/login')
        } catch (error) {
            console.log('Error al cerrar sesión:', error)
        }
    }

    const toggleMenuUsuario = () => {
        setMenuUsuarioAbierto(!menuUsuarioAbierto)
        setMenuMovilAbierto(false)
    }

    const toggleMenuMovil = () => {
        setMenuMovilAbierto(!menuMovilAbierto)
        setMenuUsuarioAbierto(false)
    }

    const cerrarMenuMovil = () => {
        setMenuMovilAbierto(false)
    }

    // Función para obtener el enlace según el rol (manteniendo estructura antigua)
    const obtenerEnlaceSegunRol = (ruta) => {
        if (!usuario) return ruta
        
        const baseRuta = ruta.replace('/', '')
        
        if (usuario.rol === 'superadmin') {
            return `/${baseRuta}`
        } else if (usuario.rol === 'admin') {
            return `/supervisor${baseRuta}`
        } else {
            return `/agente${baseRuta}`
        }
    }

    // Función para obtener el texto del rol (actualizada para nuevos roles)
    const obtenerTextoRol = () => {
        if (!usuario) return ''
        
        switch(usuario.rol) {
            case 'superadmin': return 'Super Admin'
            case 'admin': return 'Admin'
            case 'usuario': return 'Usuario'
            default: return 'Usuario'
        }
    }

    // Función para obtener el ícono según el rol (actualizada para nuevos roles)
    const obtenerIconoRol = () => {
        if (!usuario) return 'person-outline'
        
        switch(usuario.rol) {
            case 'superadmin': return 'shield-checkmark'
            case 'admin': return 'settings'
            case 'usuario': return 'person'
            default: return 'person'
        }
    }

    return(
        <header className={estilos.header}>
            <div className={estilos.container}>
                {/* Logo del CRM */}
                <Link href="/" className={estilos.logo}>
                    <div className={estilos.logoIcon}>
                        <div className={estilos.logoWhatsapp}>
                            <ion-icon name="logo-whatsapp"></ion-icon>
                        </div>
                        <div className={estilos.logoFacebook}>
                            <ion-icon name="logo-facebook"></ion-icon>
                        </div>
                    </div>
                    <div className={estilos.logoText}>
                        <span className={estilos.logoTitle}>CRM</span>
                    </div>
                </Link>

                {/* Navegación Principal - ESTRUCTURA ANTIGUA */}
                <nav className={estilos.navDesktop}>
                    <Link href={obtenerEnlaceSegunRol("/dashboard")} className={estilos.navLink}>
                        <ion-icon name="grid-outline"></ion-icon>
                        Dashboard
                    </Link>
                    <Link href={obtenerEnlaceSegunRol("/conversaciones")} className={estilos.navLink}>
                        <ion-icon name="chatbubbles-outline"></ion-icon>
                        Conversaciones
                        {notificacionesCount > 0 && (
                            <span className={estilos.badge}>{notificacionesCount}</span>
                        )}
                    </Link>
                    <Link href={obtenerEnlaceSegunRol("/usuarios")} className={estilos.navLink}>
                        <ion-icon name="people-outline"></ion-icon>
                        Usuarios
                    </Link>

                    <Link href={obtenerEnlaceSegunRol("/automatizacion")} className={estilos.navLink}>
                        <ion-icon name="cog-outline"></ion-icon>
                        Automatización
                    </Link>
                    {(usuario?.rol === 'superadmin' || usuario?.rol === 'admin') && (
                        <Link href={obtenerEnlaceSegunRol("/reportes")} className={estilos.navLink}>
                            <ion-icon name="analytics-outline"></ion-icon>
                            Reportes
                        </Link>
                    )}
                </nav>

                {/* Acciones del Usuario */}
                <div className={estilos.userActions}>

                    {/* Usuario/Autenticación */}
                    {loading ? (
                        <div className={estilos.loading}>
                            <div className={estilos.loadingSpinner}></div>
                        </div>
                    ) : usuario ? (
                        <div className={estilos.userMenu}>
                            <button 
                                onClick={toggleMenuUsuario}
                                className={estilos.userButton}
                            >
                                <div className={estilos.userAvatar}>
                                    <ion-icon name={obtenerIconoRol()}></ion-icon>
                                </div>
                                <div className={estilos.userInfo}>
                                    <span className={estilos.userName}>{usuario.nombre}</span>
                                    <span className={estilos.userRole}>{obtenerTextoRol()}</span>
                                </div>
                                <ion-icon 
                                    name={menuUsuarioAbierto ? "chevron-up-outline" : "chevron-down-outline"}
                                    className={estilos.chevron}
                                ></ion-icon>
                            </button>
                            
                            {menuUsuarioAbierto && (
                                <div className={estilos.dropdown}>                                    
                                    {/* Perfil */}
                                    <Link 
                                        href="/perfil" 
                                        className={estilos.dropdownItem}
                                        onClick={() => setMenuUsuarioAbierto(false)}
                                    >
                                        <ion-icon name="person-outline"></ion-icon>
                                        Mi Perfil
                                    </Link>
                                    
                                    {/* Google Sheets */}
                                    <Link 
                                        href={obtenerEnlaceSegunRol("/googlesheets")}
                                        className={estilos.dropdownItem}
                                        onClick={() => setMenuUsuarioAbierto(false)}
                                    >
                                        <ion-icon name="grid-outline"></ion-icon>
                                        Google Sheets
                                    </Link>
                                    
                                    {/* Configuraciones - Solo para admins */}
                                    {(usuario.rol === 'superadmin' || usuario.rol === 'admin') && (
                                        <Link 
                                            href={obtenerEnlaceSegunRol("/configuraciones")}
                                            className={estilos.dropdownItem}
                                            onClick={() => setMenuUsuarioAbierto(false)}
                                        >
                                            <ion-icon name="settings-outline"></ion-icon>
                                            Configuraciones
                                        </Link>
                                    )}
                                    {/* Configuraciones de redes - Solo para admins */}
                                    {(usuario.rol === 'superadmin' || usuario.rol === 'admin') && (
                                        <Link 
                                            href={obtenerEnlaceSegunRol("/configuracionredes")}
                                            className={estilos.dropdownItem}
                                            onClick={() => setMenuUsuarioAbierto(false)}
                                        >
                                            <ion-icon name="settings-outline"></ion-icon>
                                            Conexion Redes
                                        </Link>
                                    )}
                                    {/* Separador */}
                                    <div className={estilos.dropdownDivider}></div>
                                    
                                    {/* Ayuda */}
                                    <Link 
                                        href="/ayuda" 
                                        className={estilos.dropdownItem}
                                        onClick={() => setMenuUsuarioAbierto(false)}
                                    >
                                        <ion-icon name="help-circle-outline"></ion-icon>
                                        Ayuda & Soporte
                                    </Link>
                                    
                                    {/* Cerrar sesión */}
                                    <button 
                                        onClick={manejarCerrarSesion}
                                        className={`${estilos.dropdownItem} ${estilos.logoutItem}`}
                                    >
                                        <ion-icon name="log-out-outline"></ion-icon>
                                        Cerrar Sesión
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className={estilos.authButtons}>
                            <Link href="/login" className={estilos.loginButton}>
                                <ion-icon name="log-in-outline"></ion-icon>
                                Iniciar Sesión
                            </Link>
                        </div>
                    )}

                    {/* Botón menú móvil */}
                    <button 
                        onClick={toggleMenuMovil}
                        className={estilos.menuMovil}
                    >
                        <span className={`${estilos.hamburger} ${menuMovilAbierto ? estilos.active : ''}`}>
                            <span></span>
                            <span></span>
                            <span></span>
                        </span>
                    </button>
                </div>
            </div>

            {/* Navegación Móvil */}
            <nav className={`${estilos.navMovil} ${menuMovilAbierto ? estilos.open : ''}`}>
                <div className={estilos.navMovilHeader}>
                    <button 
                        onClick={cerrarMenuMovil}
                        className={estilos.closeButtonMovil}
                    >
                        <div className={estilos.closeIcon}></div>
                    </button>
                    
                    {usuario && (
                        <div className={estilos.userInfoMovil}>
                            <div className={estilos.userAvatarMovil}>
                                <ion-icon name={obtenerIconoRol()}></ion-icon>
                            </div>
                            <div>
                                <div className={estilos.userNameMovil}>{usuario.nombre}</div>
                                <div className={estilos.userRoleMovil}>{obtenerTextoRol()}</div>
                            </div>
                        </div>
                    )}
                </div>
                
                <div className={estilos.navMovilLinks}>
                    <Link href={obtenerEnlaceSegunRol("/")} className={estilos.navLinkMovil} onClick={cerrarMenuMovil}>
                        <ion-icon name="grid-outline"></ion-icon>
                        Dashboard
                    </Link>
                    <Link href={obtenerEnlaceSegunRol("/conversaciones")} className={estilos.navLinkMovil} onClick={cerrarMenuMovil}>
                        <ion-icon name="chatbubbles-outline"></ion-icon>
                        Conversaciones
                        {notificacionesCount > 0 && (
                            <span className={estilos.badge}>{notificacionesCount}</span>
                        )}
                    </Link>
                    <Link href={obtenerEnlaceSegunRol("/usuarios")} className={estilos.navLinkMovil} onClick={cerrarMenuMovil}>
                        <ion-icon name="people-outline"></ion-icon>
                        Usuarios
                    </Link>

                    <Link href={obtenerEnlaceSegunRol("/automatizacion")} className={estilos.navLinkMovil} onClick={cerrarMenuMovil}>
                        <ion-icon name="cog-outline"></ion-icon>
                        Automatización
                    </Link>
                    {(usuario?.rol === 'superadmin' || usuario?.rol === 'admin') && (
                        <Link href={obtenerEnlaceSegunRol("/reportes")} className={estilos.navLinkMovil} onClick={cerrarMenuMovil}>
                            <ion-icon name="analytics-outline"></ion-icon>
                            Reportes
                        </Link>
                    )}
                </div>
                
                {usuario && (
                    <div className={estilos.navMovilFooter}>
                        <Link href="/perfil" className={estilos.authLinkMovil} onClick={cerrarMenuMovil}>
                            <ion-icon name="person-outline"></ion-icon>
                            Mi Perfil
                        </Link>
                        <Link href={obtenerEnlaceSegunRol("/googlesheets")} className={estilos.authLinkMovil} onClick={cerrarMenuMovil}>
                            <ion-icon name="grid-outline"></ion-icon>
                            Google Sheets
                        </Link>
                        {(usuario.rol === 'superadmin' || usuario.rol === 'admin') && (
                            <Link href={obtenerEnlaceSegunRol("/configuraciones")} className={estilos.authLinkMovil} onClick={cerrarMenuMovil}>
                                <ion-icon name="settings-outline"></ion-icon>
                                Configuraciones
                            </Link>
                        )}
                        {(usuario.rol === 'superadmin' || usuario.rol === 'admin') && (
                            <Link href={obtenerEnlaceSegunRol("/configuracionredes")} className={estilos.authLinkMovil} onClick={cerrarMenuMovil}>
                                <ion-icon name="settings-outline"></ion-icon>
                                Conexion Redes
                            </Link>
                        )}
                        <button 
                            onClick={manejarCerrarSesion} 
                            className={`${estilos.authLinkMovil} ${estilos.logoutLinkMovil}`}
                        >
                            <ion-icon name="log-out-outline"></ion-icon>
                            Cerrar Sesión
                        </button>
                    </div>
                )}
            </nav>

            {/* Overlay para cerrar menús */}
            {(menuUsuarioAbierto || menuMovilAbierto) && (
                <div 
                    className={estilos.overlay}
                    onClick={() => {
                        setMenuUsuarioAbierto(false)
                        setMenuMovilAbierto(false)
                    }}
                ></div>
            )}
        </header>
    )
}