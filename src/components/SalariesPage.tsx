"use client"

import React, { useState, useEffect } from 'react'
import {
    Search,
    Calendar,
    Users,
    Banknote,
    Briefcase,
    RefreshCcw
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import { fetchAll } from '@/lib/supabase-utils'

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
}

export default function SalariesPage({ timeRange, setTimeRange, customDates, setCustomDates }: any) {
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedMonth, setSelectedMonth] = useState('')
    const [salaries, setSalaries] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [availableMonths, setAvailableMonths] = useState<string[]>([])

    useEffect(() => {
        fetchSalaries()
    }, [])

    async function fetchSalaries() {
        setLoading(true)
        try {
            // Fetch Salaries containing "PAGAMENTO_PESSOAL"
            const query = supabase
                .schema('financial_dashboard')
                .from('financial_transactions')
                .select(`
                    *,
                    departments (name)
                `)
                .ilike('transaction_name', '%PAGAMENTO_PESSOAL%')

            const data = await fetchAll<any>(query.order('transaction_date', { ascending: false }))

            if (data) {
                setSalaries(data)

                // Extract unique months for filter
                const months = Array.from(new Set(data.map(item => {
                    if (!item.transaction_date) return null
                    return format(parseISO(item.transaction_date), 'MMMM/yyyy', { locale: ptBR })
                }))).filter(Boolean) as string[]

                setAvailableMonths(months)
                if (months.length > 0 && !selectedMonth) {
                    setSelectedMonth(months[0])
                }
            }
        } catch (err) {
            console.error('Error fetching salaries:', err)
        } finally {
            setLoading(false)
        }
    }

    // Filter logic
    const filteredSalaries = salaries.filter(item => {
        if (!item.transaction_date) return false
        const monthYear = format(parseISO(item.transaction_date), 'MMMM/yyyy', { locale: ptBR })
        const matchesMonth = selectedMonth ? monthYear === selectedMonth : true

        const matchesSearch = searchTerm === '' ||
            (item.transaction_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (item.departments?.name?.toLowerCase() || '').includes(searchTerm.toLowerCase())

        return matchesMonth && matchesSearch
    })

    const totalFolha = filteredSalaries.reduce((acc, curr) => acc + (Number(curr.total_value) || 0), 0)

    return (
        <div className="p-6 md:p-8 space-y-8 animate-in fade-in duration-700 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Pagamentos & Salários</h1>
                    <p className="text-muted-foreground">Gestão de folha de pagamento e pessoal</p>
                </div>
                {loading && <RefreshCcw className="w-5 h-5 animate-spin text-primary-app ml-2" />}
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass p-6 rounded-2xl space-y-2">
                    <div className="flex items-center gap-2 text-primary-app">
                        <Banknote className="w-5 h-5" />
                        <span className="font-medium">Total Folha</span>
                    </div>
                    <div className="text-2xl font-bold">{formatCurrency(totalFolha)}</div>
                    <div className="text-xs text-muted-foreground capitalize">
                        {selectedMonth ? `Referência: ${selectedMonth}` : 'Total Geral'}
                    </div>
                </div>
                <div className="glass p-6 rounded-2xl space-y-2">
                    <div className="flex items-center gap-2 text-indigo-400">
                        <Users className="w-5 h-5" />
                        <span className="font-medium">Pagamentos Realizados</span>
                    </div>
                    <div className="text-2xl font-bold">{filteredSalaries.length}</div>
                    <div className="text-xs text-muted-foreground">Registros encontrados</div>
                </div>
                <div className="glass p-6 rounded-2xl space-y-2">
                    <div className="flex items-center gap-2 text-emerald-400">
                        <Briefcase className="w-5 h-5" />
                        <span className="font-medium">Departamentos</span>
                    </div>
                    <div className="text-2xl font-bold">{new Set(filteredSalaries.map(s => s.department_id)).size}</div>
                    <div className="text-xs text-muted-foreground">Obras com alocação</div>
                </div>
            </div>

            {/* Filters */}
            <div className="glass p-6 rounded-2xl space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                    {/* Search */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Search className="w-4 h-4" /> Buscar Nome / Cargo
                        </label>
                        <input
                            type="text"
                            placeholder="Nome..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-muted-app border border-border-app rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-app transition-all"
                        />
                    </div>

                    {/* Month Select */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Calendar className="w-4 h-4" /> Mês de Competência
                        </label>
                        <div className="flex flex-wrap gap-2 overflow-x-auto pb-2">
                            <button
                                onClick={() => setSelectedMonth('')}
                                className={`px-4 py-2 text-sm rounded-md transition-all whitespace-nowrap ${selectedMonth === ''
                                    ? 'bg-primary-app text-white shadow-lg'
                                    : 'bg-card-app text-muted-foreground hover:text-white border border-border-app'
                                    }`}
                            >
                                Todos
                            </button>
                            {availableMonths.map((month) => (
                                <button
                                    key={month}
                                    onClick={() => setSelectedMonth(month)}
                                    className={`px-4 py-2 text-sm rounded-md transition-all whitespace-nowrap capitalize ${selectedMonth === month
                                        ? 'bg-primary-app text-white shadow-lg'
                                        : 'bg-card-app text-muted-foreground hover:text-white border border-border-app'
                                        }`}
                                >
                                    {month}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="glass rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-white/5 text-muted-foreground border-b border-border-app">
                            <tr>
                                <th className="px-6 py-4 font-medium">Data</th>
                                <th className="px-6 py-4 font-medium">Descrição / Colaborador</th>
                                <th className="px-6 py-4 font-medium">Departamento</th>
                                <th className="px-6 py-4 font-medium">Mês Ref.</th>
                                <th className="px-6 py-4 font-medium text-right font-bold text-foreground-app">Valor Líquido</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-app">
                            {loading && salaries.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <RefreshCcw className="w-8 h-8 animate-spin text-primary-app" />
                                            <span className="text-muted-foreground">Buscando folha de pagamento...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredSalaries.length > 0 ? (
                                filteredSalaries.map((item) => (
                                    <tr key={item.id} className="group hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4 text-muted-foreground">
                                            {format(parseISO(item.transaction_date), 'dd/MM/yyyy')}
                                        </td>
                                        <td className="px-6 py-4 font-medium">
                                            {item.transaction_name}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-1 rounded bg-secondary-app text-xs uppercase tracking-wider font-semibold">
                                                {item.departments?.name || '-'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-muted-foreground capitalize">
                                            {format(parseISO(item.transaction_date), 'MMMM/yyyy', { locale: ptBR })}
                                        </td>
                                        <td className="px-6 py-4 text-right font-bold text-primary-app tabular-nums">
                                            {formatCurrency(Number(item.total_value))}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="px-6 py-20 text-center text-muted-foreground font-medium">
                                        Nenhum registro encontrado com o termo "PAGAMENTO_PESSOAL".
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
