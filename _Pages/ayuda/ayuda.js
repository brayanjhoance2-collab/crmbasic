"use client"
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import estilos from "./ayuda.module.css"
import { 
    obtenerUsuarioActual,
    obtenerInformacionSistema,
    obtenerContactosSoporte
} from "./servidor"

export default function AyudaPage() {
    const router = useRouter()
    const [usuario, setUsuario] = useState(null)
    const [loading, setLoading] = useState(true)
    const [infoSistema, setInfoSistema] = useState(null)
    const [contactosSoporte, setContactosSoporte] = useState([])

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
            
            // Cargar información del sistema y contactos
            const [infoSist, contactos] = await Promise.all([
                obtenerInformacionSistema(),
                obtenerContactosSoporte()
            ])
            
            setInfoSistema(infoSist)
            setContactosSoporte(contactos)
            
        } catch (error) {
            console.log('Error al verificar usuario:', error)
            router.push('/login')
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className={estilos.loadingContainer}>
                <div className={estilos.loadingSpinner}></div>
                <p>Cargando información...</p>
            </div>
        )
    }

    return (
        <div className={estilos.ayudaContainer}>
            {/* Header de la página */}
            <div className={estilos.pageHeader}>
                <div className={estilos.pageTitle}>
                    <ion-icon name="help-circle-outline"></ion-icon>
                    <h1>Ayuda y Soporte</h1>
                </div>
            </div>

            <div className={estilos.contentGrid}>
                {/* Información del Sistema */}
                <div className={estilos.infoCard}>
                    <div className={estilos.cardHeader}>
                        <h2>
                            <ion-icon name="information-circle-outline"></ion-icon>
                            Información del Sistema
                        </h2>
                    </div>
                    <div className={estilos.cardContent}>
                        <div className={estilos.infoItem}>
                            <span className={estilos.infoLabel}>Nombre del Sistema:</span>
                            <span className={estilos.infoValue}>{infoSistema?.nombre}</span>
                        </div>
                        <div className={estilos.infoItem}>
                            <span className={estilos.infoLabel}>Versión:</span>
                            <span className={estilos.infoValue}>{infoSistema?.version}</span>
                        </div>
                        <div className={estilos.infoItem}>
                            <span className={estilos.infoLabel}>Descripción:</span>
                            <span className={estilos.infoValue}>{infoSistema?.descripcion}</span>
                        </div>
                        <div className={estilos.infoItem}>
                            <span className={estilos.infoLabel}>Última Actualización:</span>
                            <span className={estilos.infoValue}>{infoSistema?.ultimaActualizacion}</span>
                        </div>
                        <div className={estilos.infoItem}>
                            <span className={estilos.infoLabel}>Total de Usuarios:</span>
                            <span className={estilos.infoValue}>{infoSistema?.totalUsuarios}</span>
                        </div>
                        <div className={estilos.infoItem}>
                            <span className={estilos.infoLabel}>Total de Contactos:</span>
                            <span className={estilos.infoValue}>{infoSistema?.totalContactos}</span>
                        </div>
                        <div className={estilos.infoItem}>
                            <span className={estilos.infoLabel}>Total de Conversaciones:</span>
                            <span className={estilos.infoValue}>{infoSistema?.totalConversaciones}</span>
                        </div>
                    </div>
                </div>

                {/* Contactos de Soporte */}
                <div className={estilos.infoCard}>
                    <div className={estilos.cardHeader}>
                        <h2>
                            <ion-icon name="call-outline"></ion-icon>
                            Contactos de Soporte
                        </h2>
                    </div>
                    <div className={estilos.cardContent}>
                        {contactosSoporte.map((contacto, index) => (
                            <div key={index} className={estilos.contactoItem}>
                                <div className={estilos.contactoInfo}>
                                    <div className={estilos.contactoNombre}>
                                        <ion-icon name="person-outline"></ion-icon>
                                        {contacto.nombre}
                                    </div>
                                    <div className={estilos.contactoRol}>
                                        {contacto.rol}
                                    </div>
                                </div>
                                <div className={estilos.contactoAcciones}>
                                    {contacto.telefono && (
                                        <a 
                                            href={`tel:${contacto.telefono}`}
                                            className={estilos.contactoBtn}
                                            title="Llamar"
                                        >
                                            <ion-icon name="call-outline"></ion-icon>
                                            {contacto.telefono}
                                        </a>
                                    )}
                                    {contacto.whatsapp && (
                                        <a 
                                            href={`https://wa.me/${contacto.whatsapp.replace(/\D/g, '')}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={estilos.whatsappBtn}
                                            title="WhatsApp"
                                        >
                                            <ion-icon name="logo-whatsapp"></ion-icon>
                                            WhatsApp
                                        </a>
                                    )}
                                    {contacto.correo && (
                                        <a 
                                            href={`mailto:${contacto.correo}`}
                                            className={estilos.emailBtn}
                                            title="Enviar email"
                                        >
                                            <ion-icon name="mail-outline"></ion-icon>
                                            Email
                                        </a>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Información del Usuario Actual */}
                <div className={estilos.infoCard}>
                    <div className={estilos.cardHeader}>
                        <h2>
                            <ion-icon name="person-circle-outline"></ion-icon>
                            Tu Información
                        </h2>
                    </div>
                    <div className={estilos.cardContent}>
                        <div className={estilos.infoItem}>
                            <span className={estilos.infoLabel}>Nombre:</span>
                            <span className={estilos.infoValue}>{usuario.nombreCompleto}</span>
                        </div>
                        <div className={estilos.infoItem}>
                            <span className={estilos.infoLabel}>Correo:</span>
                            <span className={estilos.infoValue}>{usuario.correo}</span>
                        </div>
                        <div className={estilos.infoItem}>
                            <span className={estilos.infoLabel}>Rol:</span>
                            <span className={estilos.infoValue}>
                                {usuario.rol === 'superadmin' ? 'Super Administrador' :
                                 usuario.rol === 'admin' ? 'Administrador' : 'Usuario'}
                            </span>
                        </div>
                        <div className={estilos.infoItem}>
                            <span className={estilos.infoLabel}>Fecha de Registro:</span>
                            <span className={estilos.infoValue}>
                                {new Date(usuario.fechaRegistro).toLocaleDateString('es-ES', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                })}
                            </span>
                        </div>
                        <div className={estilos.infoItem}>
                            <span className={estilos.infoLabel}>Último Acceso:</span>
                            <span className={estilos.infoValue}>
                                {usuario.ultimoAcceso ? new Date(usuario.ultimoAcceso).toLocaleString('es-ES') : 'No disponible'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Preguntas Frecuentes */}
                <div className={estilos.infoCard}>
                    <div className={estilos.cardHeader}>
                        <h2>
                            <ion-icon name="help-outline"></ion-icon>
                            Preguntas Frecuentes
                        </h2>
                    </div>
                    <div className={estilos.cardContent}>
                        <div className={estilos.faqItem}>
                            <h4>¿Cómo configuro WhatsApp?</h4>
                            <p>Ve a la sección de Configuraciones y selecciona WhatsApp. Necesitarás tu Phone Number ID y Access Token de Facebook Business.</p>
                        </div>
                        <div className={estilos.faqItem}>
                            <h4>¿Cómo asigno conversaciones?</h4>
                            <p>En la sección de Conversaciones, puedes asignar manualmente o activar la auto-asignación en Configuraciones Generales.</p>
                        </div>
                        <div className={estilos.faqItem}>
                            <h4>¿Cómo genero reportes?</h4>
                            <p>Ve a la sección de Reportes, selecciona el tipo de reporte y el rango de fechas que necesites analizar.</p>
                        </div>
                        <div className={estilos.faqItem}>
                            <h4>¿Puedo cambiar mi contraseña?</h4>
                            <p>Sí, ve a tu Perfil y en la sección de Seguridad podrás cambiar tu contraseña actual.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}