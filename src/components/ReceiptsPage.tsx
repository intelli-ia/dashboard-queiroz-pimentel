"use client"

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
    Filter,
    ChevronDown,
    Calendar,
    FileText,
    TrendingUp,
    AlertCircle,
    CheckCircle2
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { format, subDays, parseISO } from 'date-fns'
import type { PageProps, AccountReceivable, STATUS_TITULO } from '@/types'

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
}

const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return format(parseISO(dateString), 'dd/MM/yyyy')
}

interface SortConfig {
    key: keyof AccountReceivable | string
    direction: 'asc' | 'desc'
}

export default function ReceiptsPage({ timeRange, setTimeRange, customDates, setCustomDates }: PageProps) {
    const [receipts, setReceipts] = useState<AccountReceivable[]>([])
    const [loading, setLoading] = useState(true)

    // Filters
    const [statusFilter, setStatusFilter] = useState('all')
    const [projectFilter, setProjectFilter] = useState('all')
    const [distinctProjects, setDistinctProjects] = useState<{ code: string; name: string }[]>([])

    // Sort State
    const [sortConfig, setSortConfig] = useState<SortConfig>({
        key: 'data_vencimento',
        direction: 'asc'
    })

    const fetchReceipts = useCallback(async () => {
        setLoading(true)
        try {
            let startDate: string;
            let endDate: string = format(new Date(), 'yyyy-MM-dd');
            const currentYear = new Date().getFullYear()

            if (timeRange === 'custom') {
                startDate = customDates.start;
                endDate = customDates.end;
            } else if (timeRange === 'lastYear') {
                startDate = `${currentYear - 1}-01-01`;
                endDate = `${currentYear - 1}-12-31`;
            } else if (timeRange === 'thisYear') {
                startDate = `${currentYear}-01-01`;
                endDate = `${currentYear}-12-31`;
            } else if (timeRange === 'all') {
                startDate = '2000-01-01';
                endDate = '2099-12-31';
            } else {
                startDate = format(subDays(new Date(), parseInt(timeRange)), 'yyyy-MM-dd');
            }

            // 0. Fetch Projects and Categories (Manual Join)
            const { data: projectsRaw } = await supabase.from('projects').select('code, name')
            const projectMap = new Map(projectsRaw?.map((p: any) => [p.code, p.name]) || [])

            const { data: categoriesRaw } = await supabase.from('categories').select('code, description')
            const categoryMap = new Map(categoriesRaw?.map((c: any) => [c.code, c.description]) || [])

            // Query accounts_receivable (no joins)
            const query = supabase
                .from('accounts_receivable')
                .select(`
                    codigo_lancamento_omie,
                    codigo_cliente_fornecedor,
                    project_code,
                    category_code,
                    document_type,
                    numero_documento,
                    numero_documento_fiscal,
                    current_installment,
                    total_installments,
                    data_emissao,
                    data_previsao,
                    data_registro,
                    data_vencimento,
                    status_titulo,
                    valor_documento,
                    retem_inss,
                    retem_ir,
                    retem_iss,
                    valor_inss,
                    valor_ir,
                    valor_iss
                `)
                .gte('data_vencimento', startDate)
                .lte('data_vencimento', endDate)
                .order('data_vencimento', { ascending: true });

            const { data, error } = await query

            if (error) throw error

            if (data) {
                // Map the data with projects and categories
                const mappedData = data.map((r: any) => ({
                    ...r,
                    projects: { name: projectMap.get(r.project_code || '') || 'Nao Informado' },
                    categories: { description: categoryMap.get(r.category_code || '') || 'Outros' }
                }))

                setReceipts(mappedData as AccountReceivable[])

                // Extract distinct projects for filter
                const uniqueProjects = Array.from(projectMap.entries())
                    .map(([code, name]) => ({ code, name }))
                    .sort((a, b) => a.name.localeCompare(b.name))

                setDistinctProjects(uniqueProjects)
            }
        } catch (error) {
            console.error('Error fetching receipts:', error)
        } finally {
            setLoading(false)
        }
    }, [timeRange, customDates])

    useEffect(() => {
        fetchReceipts()
    }, [fetchReceipts])

    const handleSort = (key: keyof AccountReceivable | string) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }))
    }

    const filteredAndSortedReceipts = useMemo(() => {
        let result = [...receipts]

        // Status filter
        if (statusFilter !== 'all') {
            result = result.filter(r => r.status_titulo === statusFilter)
        }

        // Project filter
        if (projectFilter !== 'all') {
            result = result.filter(r => r.project_code === projectFilter)
        }

        // Sorting
        result.sort((a, b) => {
            let aValue: string | number | null | undefined
            let bValue: string | number | null | undefined

            // Handle nested properties
            if (sortConfig.key === 'project_name') {
                aValue = a.projects?.name
                bValue = b.projects?.name
            } else if (sortConfig.key === 'category_description') {
                aValue = a.categories?.description
                bValue = b.categories?.description
            } else {
                aValue = a[sortConfig.key as keyof AccountReceivable] as string | number | null
                bValue = b[sortConfig.key as keyof AccountReceivable] as string | number | null
            }

            if (aValue == null) return sortConfig.direction === 'asc' ? 1 : -1
            if (bValue == null) return sortConfig.direction === 'asc' ? -1 : 1

            if (typeof aValue === 'string' && typeof bValue === 'string') {
                return sortConfig.direction === 'asc'
                    ? aValue.localeCompare(bValue)
                    : bValue.localeCompare(aValue)
            }

            if (typeof aValue === 'number' && typeof bValue === 'number') {
                return sortConfig.direction === 'asc'
                    ? aValue - bValue
                    : bValue - aValue
            }

            return 0
        })

        return result
    }, [receipts, statusFilter, projectFilter, sortConfig])

    const handleStatusChange = async (codigo_lancamento_omie: number, newStatus: string) => {
        try {
            const { error } = await supabase
                .from('accounts_receivable')
                .update({ status_titulo: newStatus })
                .eq('codigo_lancamento_omie', codigo_lancamento_omie)

            if (error) throw error

            // Update local state
            setReceipts(prev => prev.map(r =>
                r.codigo_lancamento_omie === codigo_lancamento_omie
                    ? { ...r, status_titulo: newStatus }
                    : r
            ))
        } catch (error) {
            console.error('Error updating status:', error)
            alert('Erro ao atualizar status. Tente novamente.')
        }
    }

    // KPI Calculations
    const totalReceivable = useMemo(() =>
        filteredAndSortedReceipts.reduce((acc, curr) => acc + (curr.valor_documento || 0), 0),
        [filteredAndSortedReceipts]
    )
    const totalReceived = useMemo(() =>
        filteredAndSortedReceipts
            .filter(r => r.status_titulo === 'RECEBIDO' || r.status_titulo === 'LIQUIDADO')
            .reduce((acc, curr) => acc + (curr.valor_documento || 0), 0),
        [filteredAndSortedReceipts]
    )
    const totalPending = useMemo(() =>
        filteredAndSortedReceipts
            .filter(r => r.status_titulo !== 'RECEBIDO' && r.status_titulo !== 'LIQUIDADO')
            .reduce((acc, curr) => acc + (curr.valor_documento || 0), 0),
        [filteredAndSortedReceipts]
    )

    return (
        <div className="p-6 md:p-8 space-y-8 animate-in fade-in duration-700 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Contas a Receber</h1>
                    <p className="text-muted-foreground">Gerenciamento de recebimentos e previsoes</p>
                </div>
                {loading && (
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-app"></div>
                )}
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="glass p-6 rounded-2xl space-y-2">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
                        <TrendingUp className="w-4 h-4" /> Total Previsto
                    </div>
                    <div className="text-2xl font-bold">{formatCurrency(totalReceivable)}</div>
                </div>
                <div className="glass p-6 rounded-2xl space-y-2">
                    <div className="flex items-center gap-2 text-green-400 text-sm font-medium">
                        <CheckCircle2 className="w-4 h-4" /> Recebido
                    </div>
                    <div className="text-2xl font-bold text-green-400">{formatCurrency(totalReceived)}</div>
                </div>
                <div className="glass p-6 rounded-2xl space-y-2">
                    <div className="flex items-center gap-2 text-yellow-400 text-sm font-medium">
                        <AlertCircle className="w-4 h-4" /> Pendente
                    </div>
                    <div className="text-2xl font-bold text-yellow-400">{formatCurrency(totalPending)}</div>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="glass p-6 rounded-2xl space-y-6 relative z-30">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
                    {/* Status Filter */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Filter className="w-4 h-4" /> Status
                        </label>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full bg-muted-app border border-border-app rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-app transition-all appearance-none"
                        >
                            <option value="all">Todos</option>
                            <option value="RECEBIDO">Recebido</option>
                            <option value="LIQUIDADO">Liquidado</option>
                            <option value="ABERTO">Aberto</option>
                            <option value="ATRASADO">Atrasado</option>
                        </select>
                    </div>

                    {/* Project Filter */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <FileText className="w-4 h-4" /> Obra / Projeto
                        </label>
                        <select
                            value={projectFilter}
                            onChange={(e) => setProjectFilter(e.target.value)}
                            className="w-full bg-muted-app border border-border-app rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-app transition-all appearance-none"
                        >
                            <option value="all">Todas as Obras</option>
                            {distinctProjects.map(project => (
                                <option key={project.code} value={project.code}>{project.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Date Range */}
                    <div className="space-y-2 lg:col-span-2">
                        <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Calendar className="w-4 h-4" /> Vencimento
                        </label>
                        <div className="flex bg-card-app p-1 rounded-lg border border-border-app h-[42px] overflow-x-auto scrollbar-hide">
                            {['30', '90', '360'].map((range) => (
                                <button
                                    key={range}
                                    onClick={() => setTimeRange(range)}
                                    className={`flex-1 min-w-[50px] px-3 py-1.5 text-sm rounded-md transition-all whitespace-nowrap ${timeRange === range
                                        ? 'bg-primary-app text-white shadow-lg'
                                        : 'text-muted-foreground hover:text-white'
                                        }`}
                                >
                                    {range}D
                                </button>
                            ))}
                            <button
                                onClick={() => setTimeRange('thisYear')}
                                className={`flex-1 min-w-[90px] px-3 py-1.5 text-sm rounded-md transition-all whitespace-nowrap ${timeRange === 'thisYear'
                                    ? 'bg-primary-app text-white shadow-lg'
                                    : 'text-muted-foreground hover:text-white'
                                    }`}
                            >
                                Este ano
                            </button>
                            <button
                                onClick={() => setTimeRange('all')}
                                className={`flex-1 min-w-[80px] px-3 py-1.5 text-sm rounded-md transition-all whitespace-nowrap ${timeRange === 'all'
                                    ? 'bg-primary-app text-white shadow-lg'
                                    : 'text-muted-foreground hover:text-white'
                                    }`}
                            >
                                Todas
                            </button>
                            <button
                                onClick={() => setTimeRange('custom')}
                                className={`flex-1 min-w-[60px] px-3 py-1.5 text-sm rounded-md transition-all whitespace-nowrap ${timeRange === 'custom'
                                    ? 'bg-primary-app text-white shadow-lg'
                                    : 'text-muted-foreground hover:text-white'
                                    }`}
                            >
                                Periodo
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
                            <label className="text-sm text-muted-foreground">Ate:</label>
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
                                <th className="px-6 py-4 font-medium cursor-pointer hover:text-white" onClick={() => handleSort('data_vencimento')}>
                                    <div className="flex items-center gap-1">
                                        Vencimento
                                        {sortConfig.key === 'data_vencimento' && <ChevronDown className={`w-4 h-4 transition-transform ${sortConfig.direction === 'asc' ? 'rotate-180' : ''}`} />}
                                    </div>
                                </th>
                                <th className="px-6 py-4 font-medium cursor-pointer hover:text-white" onClick={() => handleSort('project_name')}>
                                    <div className="flex items-center gap-1">
                                        Obra / Projeto
                                        {sortConfig.key === 'project_name' && <ChevronDown className={`w-4 h-4 transition-transform ${sortConfig.direction === 'asc' ? 'rotate-180' : ''}`} />}
                                    </div>
                                </th>
                                <th className="px-6 py-4 font-medium">Documento</th>
                                <th className="px-6 py-4 font-medium cursor-pointer hover:text-white" onClick={() => handleSort('valor_documento')}>
                                    <div className="flex items-center gap-1">
                                        Valor
                                        {sortConfig.key === 'valor_documento' && <ChevronDown className={`w-4 h-4 transition-transform ${sortConfig.direction === 'asc' ? 'rotate-180' : ''}`} />}
                                    </div>
                                </th>
                                <th className="px-6 py-4 font-medium">Parcela</th>
                                <th className="px-6 py-4 font-medium text-right cursor-pointer hover:text-white" onClick={() => handleSort('status_titulo')}>
                                    <div className="flex items-center justify-end gap-1">
                                        Status
                                        {sortConfig.key === 'status_titulo' && <ChevronDown className={`w-4 h-4 transition-transform ${sortConfig.direction === 'asc' ? 'rotate-180' : ''}`} />}
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-app">
                            {filteredAndSortedReceipts.length > 0 ? (
                                filteredAndSortedReceipts.map((receipt) => (
                                    <tr key={receipt.codigo_lancamento_omie} className="hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4 font-medium text-foreground-app whitespace-nowrap">
                                            {formatDate(receipt.data_vencimento)}
                                        </td>
                                        <td className="px-6 py-4 text-muted-foreground">
                                            <div className="font-medium text-foreground-app">{receipt.projects?.name || '-'}</div>
                                            <div className="text-xs opacity-70">{receipt.categories?.description || '-'}</div>
                                        </td>
                                        <td className="px-6 py-4 text-muted-foreground">
                                            {receipt.numero_documento || '-'}
                                            {receipt.document_type && <span className="ml-2 text-xs bg-white/10 px-1.5 py-0.5 rounded">{receipt.document_type}</span>}
                                        </td>
                                        <td className="px-6 py-4 font-medium text-foreground-app">
                                            {formatCurrency(receipt.valor_documento || 0)}
                                        </td>
                                        <td className="px-6 py-4 text-muted-foreground">
                                            {receipt.total_installments > 1 ? `${receipt.current_installment}/${receipt.total_installments}` : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <select
                                                value={receipt.status_titulo}
                                                onChange={(e) => handleStatusChange(receipt.codigo_lancamento_omie, e.target.value)}
                                                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border bg-transparent outline-none cursor-pointer transition-all
                                                    ${receipt.status_titulo === 'RECEBIDO' || receipt.status_titulo === 'LIQUIDADO' ? 'text-green-400 border-green-500/20 hover:bg-green-500/10' :
                                                        receipt.status_titulo === 'ATRASADO' ? 'text-red-400 border-red-500/20 hover:bg-red-500/10' :
                                                            'text-yellow-400 border-yellow-500/20 hover:bg-yellow-500/10'
                                                    }`}
                                            >
                                                {!['RECEBIDO', 'LIQUIDADO', 'ABERTO', 'ATRASADO'].includes(receipt.status_titulo) && (
                                                    <option value={receipt.status_titulo} className="bg-slate-900 text-white">{receipt.status_titulo}</option>
                                                )}
                                                <option value="RECEBIDO" className="bg-slate-900 text-green-400">RECEBIDO</option>
                                                <option value="LIQUIDADO" className="bg-slate-900 text-green-400">LIQUIDADO</option>
                                                <option value="ABERTO" className="bg-slate-900 text-yellow-400">ABERTO</option>
                                                <option value="ATRASADO" className="bg-slate-900 text-red-400">ATRASADO</option>
                                            </select>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                                        Nenhum lancamento encontrado para os filtros selecionados.
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
