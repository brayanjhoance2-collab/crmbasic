"use client"
import { useEffect, useState } from 'react'
import { crearAdministradorInicial } from './servidor'
import estilos from "./crear.module.css"

export default function CrearAdministradorInicial() {
    const [mostrarMensaje, setMostrarMensaje] = useState(false)
    const [mensajeCreado, setMensajeCreado] = useState('')

    useEffect(() => {
        const inicializarAdmin = async () => {
            // Verificar si ya se ejecutó en esta sesión
            const yaEjecutado = sessionStorage.getItem('admin_inicializado')
            if (yaEjecutado) {
                return
            }

            try {
                const resultado = await crearAdministradorInicial()
                
                if (resultado.success) {
                    // Marcar como ejecutado en esta sesión
                    sessionStorage.setItem('admin_inicializado', 'true')
                    
                    // Solo mostrar mensaje si se CREÓ un nuevo administrador
                    if (resultado.creado) {
                        setMensajeCreado('Administrador creado')
                        setMostrarMensaje(true)
                        
                        // Ocultar mensaje después de 5 segundos
                        setTimeout(() => {
                            setMostrarMensaje(false)
                        }, 5000)
                        
                        console.log('✅ Administrador inicial creado exitosamente')
                    } else {
                        console.log('ℹ️ Administrador ya existe en el sistema')
                    }
                } else {
                    console.error('❌ Error al inicializar administrador:', resultado.mensaje)
                }
            } catch (error) {
                console.error('❌ Error al inicializar administrador:', error)
            }
        }

        inicializarAdmin()
    }, [])

    // Solo mostrar mensaje cuando se crea un nuevo administrador
    if (mostrarMensaje) {
        return (
            <div className={estilos.mensajeAdminCreado}>
                {mensajeCreado}
            </div>
        )
    }

    // No renderizar nada cuando no hay mensaje
    return null
}