"use client"

import React, { useState, useEffect, useCallback } from 'react'
import {
    Search,
    Calendar,
    Users,
    Banknote,
    Briefcase,
    RefreshCcw
} from 'lucide-react'
import { format, subDays, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import { fetchAll } from '@/lib/supabase-utils'
import type { PageProps, AccountPayable } from '@/types'

interface MappedSalary {
    id: number
    transaction_date: string
    transaction_name: string
    total_value: number
    project_name: string
    category_description: string
    installment_label: string
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
}

export default function SalariesPage({ timeRange, setTimeRange, customDates, setCustomDates }: PageProps) {
    const [searchTerm, setSearchTerm] = useState('')
    const [salaries, setSalaries] = useState<MappedSalary[]>([])
    const [loading, setLoading] = useState(true)

    const fetchSalaries = useCallback(async () => {
        setLoading(true)
        try {
            let startDate: string
            let endDate: string = format(new Date(), 'yyyy-MM-dd')

            const currentYear = new Date().getFullYear()

            if (timeRange === 'custom') {
                startDate = customDates.start
                endDate = customDates.end
            } else if (timeRange === 'lastYear') {
                startDate = `${currentYear - 1}-01-01`
                endDate = `${currentYear - 1}-12-31`
            } else if (timeRange === 'thisYear') {
                startDate = `${currentYear}-01-01`
                endDate = `${currentYear}-12-31`
            } else {
                startDate = format(subDays(new Date(), parseInt(timeRange)), 'yyyy-MM-dd')
            }

            // Fetch salaries/payroll from accounts_payable
            // Filtering by categories related to payroll (this would need actual category codes)
            // For now, we'll use document types that might represent payroll: REC (Recibo), BOL, etc.
            const query = supabase
                .from('accounts_payable')
                .select(`
                    codigo_lancamento_omie,
                    numero_documento,
                    project_code,
                    category_code,
                    current_installment,
                    total_installments,
                    data_emissao,
                    data_vencimento,
                    status_titulo,
                    valor_documento,
                    document_type,
                    projects:project_code (code, name),
                    categories:category_code (code, description)
                `)
                .in('document_type', ['REC', 'BOL', 'PIX', 'TED'])
                .gte('data_vencimento', startDate)
                .lte('data_vencimento', endDate)
                .order('data_vencimento', { ascending: false })

            const rawData = await fetchAll<AccountPayable>(query)

            if (rawData) {
                const mappedData: MappedSalary[] = rawData.map(item => {
                    const installmentLabel = item.total_installments > 1
                        ? `${item.current_installment}/${item.total_installments}`
                        : ''

                    return {
                        id: item.codigo_lancamento_omie,
                        transaction_date: item.data_vencimento || item.data_emissao || '',
                        transaction_name: `${item.document_type || 'Pagamento'}: ${item.numero_documento || item.codigo_lancamento_omie}`,
                        total_value: Number(item.valor_documento) || 0,
                        project_name: item.projects?.name || '-',
                        category_description: item.categories?.description || 'Pagamentos',
                        installment_label: installmentLabel
                    }
                })
                setSalaries(mappedData)
            }
        } catch (err) {
            console.error('Error fetching salaries:', err)
        } finally {
            setLoading(false)
        }
    }, [timeRange, customDates])

    useEffect(() => {
        fetchSalaries()
    }, [fetchSalaries])

    // Filter logic
    const filteredSalaries = salaries.filter(item => {
        const matchesSearch = searchTerm === '' ||
            (item.transaction_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (item.project_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (item.category_description?.toLowerCase() || '').includes(searchTerm.toLowerCase())

        return matchesSearch
    })

    const totalFolha = filteredSalaries.reduce((acc, curr) => acc + (Number(curr.total_value) || 0), 0)
    const uniqueProjects = new Set(filteredSalaries.map(s => s.project_name)).size

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
                    <div className="text-xs text-muted-foreground">No período selecionado</div>
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
                        <span className="font-medium">Projetos</span>
                    </div>
                    <div className="text-2xl font-bold">{uniqueProjects}</div>
                    <div className="text-xs text-muted-foreground">Obras com alocação</div>
                </div>
            </div>

            {/* Filters */}
            <div className="glass p-6 rounded-2xl space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                    {/* Search */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Search className="w-4 h-4" /> Buscar
                        </label>
                        <input
                            type="text"
                            placeholder="Nome, projeto ou categoria..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-muted-app border border-border-app rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-app transition-all"
                        />
                    </div>

                    {/* Date Presets */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Calendar className="w-4 h-4" /> Período
                        </label>
                        <div className="flex bg-card-app p-1 rounded-lg border border-border-app h-[42px]">
                            {['7', '30', '90', '360'].map((range) => (
                                <button
                                    key={range}
                                    onClick={() => setTimeRange(range)}
                                    className={`flex-1 px-3 py-1.5 text-sm rounded-md transition-all ${timeRange === range
                                        ? 'bg-primary-app text-white shadow-lg'
                                        : 'text-muted-foreground hover:text-white'
                                        }`}
                                >
                                    {range}D
                                </button>
                            ))}
                            <button
                                onClick={() => setTimeRange('lastYear')}
                                className={`flex-1 px-3 py-1.5 text-sm rounded-md transition-all whitespace-nowrap ${timeRange === 'lastYear'
                                    ? 'bg-primary-app text-white shadow-lg'
                                    : 'text-muted-foreground hover:text-white'
                                    }`}
                            >
                                Ano passado
                            </button>
                            <button
                                onClick={() => setTimeRange('thisYear')}
                                className={`flex-1 px-3 py-1.5 text-sm rounded-md transition-all whitespace-nowrap ${timeRange === 'thisYear'
                                    ? 'bg-primary-app text-white shadow-lg'
                                    : 'text-muted-foreground hover:text-white'
                                    }`}
                            >
                                Este ano
                            </button>
                            <button
                                onClick={() => setTimeRange('custom')}
                                className={`flex-1 px-3 py-1.5 text-sm rounded-md transition-all ${timeRange === 'custom'
                                    ? 'bg-primary-app text-white shadow-lg'
                                    : 'text-muted-foreground hover:text-white'
                                    }`}
                            >
                                Pers.
                            </button>
                        </div>
                    </div>
                </div>

                {/* Custom Date Picker */}
                {timeRange === 'custom' && (
                    <div className="pt-4 border-t border-white/5 flex flex-wrap items-center gap-4 animate-in slide-in-from-top-2 duration-300">
                        <div className="flex items-center gap-2">
                            <label className="text-sm text-muted-foreground">De:</label>
                            <input
                                type="date"
                                value={customDates.start}
                                onChange={(e) => setCustomDates({ ...customDates, start: e.target.value })}
                                className="bg-muted-app border border-border-app rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary-app outline-none appearance-none invert hue-rotate-180 brightness-90"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-sm text-muted-foreground">Até:</label>
                            <input
                                type="date"
                                value={customDates.end}
                                onChange={(e) => setCustomDates({ ...customDates, end: e.target.value })}
                                className="bg-muted-app border border-border-app rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary-app outline-none appearance-none invert hue-rotate-180 brightness-90"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Table */}
            <div className="glass rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-white/5 text-muted-foreground border-b border-border-app">
                            <tr>
                                <th className="px-6 py-4 font-medium">Data</th>
                                <th className="px-6 py-4 font-medium">Descrição</th>
                                <th className="px-6 py-4 font-medium">Categoria</th>
                                <th className="px-6 py-4 font-medium">Projeto</th>
                                <th className="px-6 py-4 font-medium">Mês Ref.</th>
                                <th className="px-6 py-4 font-medium text-right font-bold text-foreground-app">Valor</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-app">
                            {loading && salaries.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <RefreshCcw className="w-8 h-8 animate-spin text-primary-app" />
                                            <span className="text-muted-foreground">Buscando pagamentos...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredSalaries.length > 0 ? (
                                filteredSalaries.map((item) => (
                                    <tr key={item.id} className="group hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4 text-muted-foreground">
                                            {item.transaction_date ? format(parseISO(item.transaction_date), 'dd/MM/yyyy') : '-'}
                                        </td>
                                        <td className="px-6 py-4 font-medium">
                                            <div className="flex flex-col">
                                                <span>{item.transaction_name}</span>
                                                {item.installment_label && (
                                                    <span className="text-[10px] text-primary-app font-bold uppercase tracking-wider">
                                                        {item.installment_label}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-1 rounded bg-secondary-app text-xs uppercase tracking-wider font-semibold">
                                                {item.category_description}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-muted-foreground">{item.project_name}</span>
                                        </td>
                                        <td className="px-6 py-4 text-muted-foreground capitalize">
                                            {item.transaction_date ? format(parseISO(item.transaction_date), 'MMMM/yyyy', { locale: ptBR }) : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-right font-bold text-primary-app tabular-nums">
                                            {formatCurrency(Number(item.total_value))}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="px-6 py-20 text-center text-muted-foreground font-medium">
                                        Nenhum registro encontrado para o período selecionado.
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
