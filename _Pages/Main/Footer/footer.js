"use client"
import Link from 'next/link'
import estilos from "./footer.module.css"

export default function Footer() {
    // Datos estáticos
    const estadisticas = {
        mensajesHoy: 247,
        conversacionesActivas: 18,
        tiempoRespuesta: '2.3 min'
    }

    return (
        <footer className={estilos.footer}>
            {/* Sección principal del footer */}
            <div className={estilos.footerMain}>
                <div className={estilos.container}>
                    <div className={estilos.footerGrid}>
                        {/* Logo y descripción */}
                        <div className={estilos.footerBrand}>
                            <Link href="/" className={estilos.footerLogo}>
                                <div className={estilos.logoIcon}>
                                    <div className={estilos.logoWhatsapp}>
                                        <ion-icon name="logo-whatsapp"></ion-icon>
                                    </div>
                                    <div className={estilos.logoFacebook}>
                                        <ion-icon name="logo-facebook"></ion-icon>
                                    </div>
                                </div>
                                <div className={estilos.logoText}>
                                    <span className={estilos.logoTitle}>CRM Social</span>
                                    <span className={estilos.logoSubtitle}>WhatsApp & Facebook</span>
                                </div>
                            </Link>
                            
                            <p className={estilos.brandDescription}>
                                Potencia tu negocio con nuestra plataforma integrada de comunicación. 
                                Gestiona WhatsApp y Facebook desde un solo lugar.
                            </p>
                            
                            {/* Redes sociales */}
                            <div className={estilos.socialLinks}>
                                <a href="#" className={estilos.socialLink} aria-label="WhatsApp">
                                    <ion-icon name="logo-whatsapp"></ion-icon>
                                </a>
                                <a href="#" className={estilos.socialLink} aria-label="Facebook">
                                    <ion-icon name="logo-facebook"></ion-icon>
                                </a>
                                <a href="#" className={estilos.socialLink} aria-label="Twitter">
                                    <ion-icon name="logo-twitter"></ion-icon>
                                </a>
                                <a href="#" className={estilos.socialLink} aria-label="LinkedIn">
                                    <ion-icon name="logo-linkedin"></ion-icon>
                                </a>
                                <a href="#" className={estilos.socialLink} aria-label="Instagram">
                                    <ion-icon name="logo-instagram"></ion-icon>
                                </a>
                            </div>
                        </div>

                        {/* Estadísticas del sistema */}
                        <div className={estilos.footerSection}>
                            <h4 className={estilos.footerTitle}>
                                <ion-icon name="stats-chart-outline"></ion-icon>
                                Estado del Sistema
                            </h4>
                            <div className={estilos.statsGrid}>
                                <div className={estilos.statItem}>
                                    <div className={estilos.statIcon}>
                                        <ion-icon name="chatbubble-outline"></ion-icon>
                                    </div>
                                    <div className={estilos.statInfo}>
                                        <span className={estilos.statValue}>{estadisticas.mensajesHoy}</span>
                                        <span className={estilos.statLabel}>Mensajes hoy</span>
                                    </div>
                                </div>
                                
                                <div className={estilos.statItem}>
                                    <div className={estilos.statIcon}>
                                        <ion-icon name="people-outline"></ion-icon>
                                    </div>
                                    <div className={estilos.statInfo}>
                                        <span className={estilos.statValue}>{estadisticas.conversacionesActivas}</span>
                                        <span className={estilos.statLabel}>Activas</span>
                                    </div>
                                </div>
                                
                                <div className={estilos.statItem}>
                                    <div className={estilos.statIcon}>
                                        <ion-icon name="time-outline"></ion-icon>
                                    </div>
                                    <div className={estilos.statInfo}>
                                        <span className={estilos.statValue}>{estadisticas.tiempoRespuesta}</span>
                                        <span className={estilos.statLabel}>Resp. promedio</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer bottom */}
            <div className={estilos.footerBottom}>
                <div className={estilos.container}>
                    <div className={estilos.footerBottomContent}>
                        <div className={estilos.copyright}>
                            <p>© 2024 CRM Social. Todos los derechos reservados.</p>
                            <p className={estilos.madeWith}>
                                Hecho con 
                                <ion-icon name="heart" className={estilos.heartIcon}></ion-icon>
                                para empresas que quieren crecer
                            </p>
                        </div>
                        
                        <div className={estilos.footerBottomLinks}>
                            <Link href="/privacidad" className={estilos.bottomLink}>Privacidad</Link>
                            <Link href="/terminos" className={estilos.bottomLink}>Términos</Link>
                            <Link href="/contacto" className={estilos.bottomLink}>Contacto</Link>
                        </div>
                        
                        {/* Indicador de estado del sistema */}
                        <div className={estilos.systemStatus}>
                            <div className={estilos.statusIndicator}>
                                <div className={estilos.statusDot}></div>
                                <span className={estilos.statusText}>Sistema operativo</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    )
}