import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
    try {
        const { username, password } = await request.json()

        const validUsername = process.env.AUTH_USERNAME
        const validPassword = process.env.AUTH_PASSWORD

        if (username === validUsername && password === validPassword) {
            const response = NextResponse.json({ success: true })

            // Set httpOnly cookie for session (not accessible via JavaScript)
            response.cookies.set('auth_session', 'authenticated', {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 60 * 60 * 24 * 7, // 7 days
                path: '/',
            })

            return response
        }

        return NextResponse.json(
            { success: false, message: 'Credenciais inválidas' },
            { status: 401 }
        )
    } catch {
        return NextResponse.json(
            { success: false, message: 'Erro no servidor' },
            { status: 500 }
        )
    }
}

export async function GET(request: NextRequest) {
    const session = request.cookies.get('auth_session')

    if (session?.value === 'authenticated') {
        return NextResponse.json({ authenticated: true })
    }

    return NextResponse.json({ authenticated: false }, { status: 401 })
}

export async function DELETE() {
    const response = NextResponse.json({ success: true })

    response.cookies.set('auth_session', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 0,
        path: '/',
    })

    return response
}
