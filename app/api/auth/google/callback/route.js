import { NextResponse } from 'next/server'
import { procesarCallbackGoogle } from '@/_Pages/googlesheet/servidor'

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url)
        const code = searchParams.get('code')
        const error = searchParams.get('error')
        const state = searchParams.get('state')

        // Usar la URL base del .env
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL

        // Si el usuario canceló la autorización
        if (error) {
            console.log('Error en OAuth:', error)
            const errorMessage = error === 'access_denied' 
                ? 'Autorización cancelada por el usuario'
                : 'Error en la autorización de Google'
                
            return NextResponse.redirect(
                new URL(`/googlesheets?error=${encodeURIComponent(errorMessage)}`, baseUrl)
            )
        }

        // Si no hay código de autorización
        if (!code) {
            return NextResponse.redirect(
                new URL('/googlesheets?error=Código de autorización no recibido', baseUrl)
            )
        }

        // Procesar el código de autorización
        const resultado = await procesarCallbackGoogle(code)

        if (resultado.success) {
            return NextResponse.redirect(
                new URL('/googlesheets?success=Conectado exitosamente a Google Sheets', baseUrl)
            )
        } else {
            return NextResponse.redirect(
                new URL(`/googlesheets?error=${encodeURIComponent(resultado.error)}`, baseUrl)
            )
        }

    } catch (error) {
        console.log('Error en callback de Google:', error)
        
        return NextResponse.redirect(
            new URL('/googlesheets?error=Error interno del servidor', process.env.NEXT_PUBLIC_BASE_URL)
        )
    }
}