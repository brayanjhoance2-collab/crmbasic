"use client"
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import estilos from "./admin.module.css"
import { iniciarSesion, obtenerUsuarioActual } from "./servidor"

export default function AdminLogin() {
    const router = useRouter()
    const [formData, setFormData] = useState({
        correo: '',
        contrasena: ''
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [rememberMe, setRememberMe] = useState(false)

    useEffect(() => {
        verificarSesionExistente()
        cargarDatosRecordados()
    }, [])

    const verificarSesionExistente = async () => {
        try {
            const usuario = await obtenerUsuarioActual()
            if (usuario) {
                // Redirigir según el rol del usuario
                redirigirSegunRol(usuario.rol)
            }
        } catch (error) {
            console.log('No hay sesión activa')
        }
    }

    const cargarDatosRecordados = () => {
        const correoRecordado = localStorage.getItem('admin_correo_recordado')
        if (correoRecordado) {
            setFormData(prev => ({
                ...prev,
                correo: correoRecordado
            }))
            setRememberMe(true)
        }
    }

    const redirigirSegunRol = (rol) => {
        switch(rol) {
            case 'superadmin':
                router.push('/')
                break
            case 'admin':
                router.push('/dashboard')
                break
            case 'usuario':
                router.push('/dashboard')
                break
            default:
                console.log('Rol no reconocido:', rol)
        }
    }

    const handleInputChange = (e) => {
        const { name, value } = e.target
        setFormData(prev => ({
            ...prev,
            [name]: value
        }))
        
        // Limpiar error cuando el usuario empiece a escribir
        if (error) {
            setError('')
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        
        if (!formData.correo || !formData.contrasena) {
            setError('Por favor completa todos los campos')
            return
        }

        if (!validarEmail(formData.correo)) {
            setError('Por favor ingresa un correo electrónico válido')
            return
        }

        setLoading(true)
        setError('')

        try {
            const resultado = await iniciarSesion(formData.correo, formData.contrasena)
            
            if (resultado.success) {
                // Guardar correo si "Recordarme" está activado
                if (rememberMe) {
                    localStorage.setItem('admin_correo_recordado', formData.correo)
                } else {
                    localStorage.removeItem('admin_correo_recordado')
                }

                // Redirigir según el rol
                redirigirSegunRol(resultado.usuario.rol)
            } else {
                setError(resultado.mensaje || 'Error al iniciar sesión')
            }
        } catch (error) {
            console.log('Error en inicio de sesión:', error)
            setError(error.message || 'Error de conexión. Inténtalo de nuevo.')
        } finally {
            setLoading(false)
        }
    }

    const validarEmail = (email) => {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        return regex.test(email)
    }

    const toggleShowPassword = () => {
        setShowPassword(!showPassword)
    }

    return (
        <div className={estilos.adminContainer}>
            <div className={estilos.loginCard}>
                {/* Header con logo */}
                <div className={estilos.loginHeader}>
                    <div className={estilos.logoContainer}>
                        <div className={estilos.logoIcon}>
                            <div className={estilos.logoWhatsapp}>
                                <ion-icon name="logo-whatsapp"></ion-icon>
                            </div>
                            <div className={estilos.logoFacebook}>
                                <ion-icon name="logo-facebook"></ion-icon>
                            </div>
                            <div className={estilos.logoInstagram}>
                                <ion-icon name="logo-instagram"></ion-icon>
                            </div>
                        </div>
                        <div className={estilos.logoText}>
                            <h1 className={estilos.logoTitle}>CRM Social</h1>
                            <p className={estilos.logoSubtitle}>Acceso Administrativo</p>
                        </div>
                    </div>
                </div>

                {/* Formulario de login */}
                <div className={estilos.loginForm}>
                    <div className={estilos.welcomeText}>
                        <h2>Bienvenido de vuelta</h2>
                        <p>Ingresa tus credenciales para acceder al panel administrativo</p>
                    </div>

                    {error && (
                        <div className={estilos.errorMessage}>
                            <ion-icon name="alert-circle-outline"></ion-icon>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className={estilos.form}>
                        <div className={estilos.inputGroup}>
                            <label htmlFor="correo" className={estilos.label}>
                                Correo Electrónico
                            </label>
                            <div className={estilos.inputWrapper}>
                                <ion-icon name="mail-outline" className={estilos.inputIcon}></ion-icon>
                                <input
                                    type="email"
                                    id="correo"
                                    name="correo"
                                    value={formData.correo}
                                    onChange={handleInputChange}
                                    className={estilos.input}
                                    placeholder="admin@empresa.com"
                                    disabled={loading}
                                    autoComplete="email"
                                />
                            </div>
                        </div>

                        <div className={estilos.inputGroup}>
                            <label htmlFor="contrasena" className={estilos.label}>
                                Contraseña
                            </label>
                            <div className={estilos.inputWrapper}>
                                <ion-icon name="lock-closed-outline" className={estilos.inputIcon}></ion-icon>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    id="contrasena"
                                    name="contrasena"
                                    value={formData.contrasena}
                                    onChange={handleInputChange}
                                    className={estilos.input}
                                    placeholder="Tu contraseña"
                                    disabled={loading}
                                    autoComplete="current-password"
                                />
                                <button
                                    type="button"
                                    onClick={toggleShowPassword}
                                    className={estilos.passwordToggle}
                                    disabled={loading}
                                >
                                    <ion-icon name={showPassword ? "eye-off-outline" : "eye-outline"}></ion-icon>
                                </button>
                            </div>
                        </div>

                        <div className={estilos.formOptions}>
                            <label className={estilos.checkboxLabel}>
                                <input
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                    className={estilos.checkbox}
                                    disabled={loading}
                                />
                                <span className={estilos.checkboxCustom}>
                                    <ion-icon name="checkmark-outline"></ion-icon>
                                </span>
                                Recordar mi correo
                            </label>

                            <button
                                type="button"
                                className={estilos.forgotPassword}
                                disabled={loading}
                            >
                                ¿Olvidaste tu contraseña?
                            </button>
                        </div>

                        <button
                            type="submit"
                            className={estilos.submitButton}
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <div className={estilos.loadingSpinner}></div>
                                    Iniciando sesión...
                                </>
                            ) : (
                                <>
                                    <ion-icon name="log-in-outline"></ion-icon>
                                    Iniciar Sesión
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* Footer */}
                <div className={estilos.loginFooter}>
                    <div className={estilos.securityInfo}>
                        <ion-icon name="shield-checkmark-outline"></ion-icon>
                        <span>Conexión segura SSL</span>
                    </div>
                    <p className={estilos.footerText}>
                        CRM Social - Sistema de gestión empresarial
                    </p>
                </div>
            </div>

            {/* Background decorativo */}
            <div className={estilos.backgroundDecoration}>
                <div className={estilos.decorationCircle}></div>
                <div className={estilos.decorationCircle}></div>
                <div className={estilos.decorationCircle}></div>
            </div>
        </div>
    )
}