import { NextResponse } from 'next/server'
import { procesarCallbackGoogle } from '@/_Pages/googlesheet/servidor'

export async function GET(request) {
    try {
        console.log('=== INICIO CALLBACK GOOGLE ===')
        
        const { searchParams } = new URL(request.url)
        const code = searchParams.get('code')
        const error = searchParams.get('error')
        const state = searchParams.get('state')

        console.log('Parámetros recibidos:', { 
            hasCode: !!code, 
            error, 
            hasState: !!state 
        })

        // Usar la URL base del .env
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL

        // Si el usuario canceló la autorización
        if (error) {
            console.log('Error en OAuth:', error)
            const errorMessage = error === 'access_denied' 
                ? 'Autorización cancelada por el usuario'
                : `Error en la autorización de Google: ${error}`
                
            return NextResponse.redirect(
                new URL(`/googlesheets?error=${encodeURIComponent(errorMessage)}`, baseUrl)
            )
        }

        // Si no hay código de autorización
        if (!code) {
            console.log('No se recibió código de autorización')
            return NextResponse.redirect(
                new URL('/googlesheets?error=Código de autorización no recibido', baseUrl)
            )
        }

        console.log('Código OAuth recibido:', code.substring(0, 20) + '...')

        // Procesar el código de autorización
        const resultado = await procesarCallbackGoogle(code)

        console.log('Resultado del procesamiento:', {
            success: resultado.success,
            error: resultado.error
        })

        if (resultado.success) {
            console.log('=== OAUTH EXITOSO ===')
            
            // Crear respuesta con headers para forzar refresh
            const response = NextResponse.redirect(
                new URL('/googlesheets?success=Conectado exitosamente a Google Sheets', baseUrl)
            )
            
            // Headers para forzar refresh de la página
            response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
            response.headers.set('Pragma', 'no-cache')
            response.headers.set('Expires', '0')
            
            return response
        } else {
            console.log('=== OAUTH FALLIDO ===')
            console.log('Error:', resultado.error)
            
            return NextResponse.redirect(
                new URL(`/googlesheets?error=${encodeURIComponent(resultado.error)}`, baseUrl)
            )
        }

    } catch (error) {
        console.error('=== ERROR CRÍTICO EN CALLBACK ===')
        console.error('Error completo:', error)
        console.error('Stack trace:', error.stack)
        
        return NextResponse.redirect(
            new URL(`/googlesheets?error=${encodeURIComponent('Error interno: ' + error.message)}`, process.env.NEXT_PUBLIC_BASE_URL)
        )
    }
}