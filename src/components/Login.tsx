"use client"

import { useState } from 'react'
import { Lock, User, Loader2 } from 'lucide-react'
import Image from 'next/image'

interface LoginProps {
    onLoginSuccess: () => void
}

export default function Login({ onLoginSuccess }: LoginProps) {
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            const response = await fetch('/api/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            })

            const data = await response.json()

            if (data.success) {
                onLoginSuccess()
            } else {
                setError(data.message || 'Credenciais inválidas')
            }
        } catch {
            setError('Erro ao conectar com o servidor')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-background-app flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="glass p-8 rounded-2xl space-y-6">
                    {/* Logo */}
                    <div className="flex flex-col items-center gap-4">
                        <div className="relative w-16 h-16">
                            <Image
                                src="/logo-qp.png"
                                alt="Queiroz Pimentel"
                                fill
                                className="object-contain"
                                priority
                            />
                        </div>
                        <div className="text-center">
                            <h1 className="text-2xl font-bold">Dashboard Financeiro</h1>
                            <p className="text-muted-foreground text-sm">Queiroz Pimentel</p>
                        </div>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm text-muted-foreground">Usuário</label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full bg-muted-app border border-border-app rounded-lg pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-primary-app outline-none transition-all"
                                    placeholder="Digite seu usuário"
                                    required
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm text-muted-foreground">Senha</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-muted-app border border-border-app rounded-lg pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-primary-app outline-none transition-all"
                                    placeholder="Digite sua senha"
                                    required
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-lg">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary-app hover:bg-primary-app/90 text-white font-medium py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Entrando...
                                </>
                            ) : (
                                'Entrar'
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}
