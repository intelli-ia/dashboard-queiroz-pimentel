"use client"

import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchAll } from '@/lib/supabase-utils'
import { format, subDays, parseISO } from 'date-fns'
import { Loader2, ArrowUpDown, ArrowUp, ArrowDown, Search, X, BarChart3, Banknote } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts'
import GlobalFilterBar from './GlobalFilterBar'
import type { PageProps, FinancialMovement } from '@/types'

type SortField = 'display_date' | 'numero_documento' | 'project_name' | 'category_description' | 'installment_label' | 'valor_documento' | 'status_titulo'
type SortDirection = 'asc' | 'desc' | null

interface MappedPayable {
    id: number
    numero_documento: string | null
    numero_documento_fiscal: string | null
    data_emissao: string | null
    data_vencimento: string | null
    display_date: string
    valor_documento: number
    project_name: string
    category_description: string
    status_titulo: string | null
    installment_label: string
    document_type: string | null
}

export default function AccountsPayablePage({ timeRange, setTimeRange, customDates, setCustomDates, selectedProject, setSelectedProject, projects }: PageProps) {
    const [payables, setPayables] = useState<MappedPayable[]>([])
    const [loading, setLoading] = useState(true)

    // Sorting state
    const [sortField, setSortField] = useState<SortField | null>(null)
    const [sortDirection, setSortDirection] = useState<SortDirection>(null)

    // Filter state
    const [filters, setFilters] = useState<Record<string, string>>({
        display_date: '',
        numero_documento: '',
        project_name: '',
        category_description: '',
        installment_label: '',
        valor_documento: '',
        status_titulo: ''
    })

    const fetchPayables = useCallback(async () => {
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
            } else if (timeRange === 'all') {
                startDate = '2000-01-01'
                endDate = '2099-12-31'
            } else {
                startDate = format(subDays(new Date(), parseInt(timeRange)), 'yyyy-MM-dd')
            }

            console.log('Fetching accounts_payable from', startDate, 'to', endDate)

            // 0. Fetch Projects and Categories (Manual Join)
            const { data: projectsRaw } = await supabase.from('projects').select('code, name')
            const projectMap = new Map(projectsRaw?.map((p: any) => [p.code, p.name]) || [])

            const { data: categoriesRaw } = await supabase.from('categories').select('code, description')
            const categoryMap = new Map(categoriesRaw?.map((c: any) => [c.code, c.description]) || [])


            // Query financial_movements for Saidas (S)
            let query = supabase
                .from('financial_movements')
                .select(`
                    codigo_titulo,
                    numero_titulo,
                    numero_documento_fiscal,
                    project_code,
                    category_code,
                    current_installment,
                    total_installments,
                    data_emissao,
                    data_vencimento,
                    data_pagamento,
                    status,
                    liquidado,
                    valor_liquido,
                    valor_titulo,
                    document_type,
                    natureza
                `)
                .eq('natureza', 'S')

            if (selectedProject) {
                query = query.eq('project_code', selectedProject)
            }

            query = query
                .gte('data_pagamento', startDate)
                .lte('data_pagamento', endDate)
                .order('data_pagamento', { ascending: false })

            const rawData = await fetchAll<FinancialMovement>(query)
            console.log('financial_movements fetched:', rawData?.length || 0, 'records')

            // Map data for display
            const mappedData: MappedPayable[] = rawData?.map(item => {
                const displayDate = item.data_pagamento || item.data_vencimento || item.data_emissao || ''

                // Build installment label
                const installmentLabel = item.total_installments > 1
                    ? `${item.current_installment}/${item.total_installments}`
                    : ''

                return {
                    id: item.codigo_titulo,
                    numero_documento: item.numero_titulo,
                    numero_documento_fiscal: item.numero_documento_fiscal,
                    data_emissao: item.data_emissao,
                    data_vencimento: item.data_vencimento,
                    display_date: displayDate,
                    valor_documento: Number(item.valor_pago || item.valor_liquido || item.valor_titulo) || 0,
                    project_name: projectMap.get(item.project_code || '') || 'N/A',
                    category_description: categoryMap.get(item.category_code || '') || 'N/A',
                    status_titulo: item.status,
                    installment_label: installmentLabel,
                    document_type: item.document_type
                }
            }) || []

            setPayables(mappedData)
        } catch (err) {
            console.error('Error fetching accounts_payable data:', err)
        } finally {
            setLoading(false)
        }
    }, [timeRange, customDates, selectedProject])

    useEffect(() => {
        fetchPayables()
    }, [fetchPayables])

    // Filter and Sort Logic
    const handleSort = (field: SortField) => {
        if (sortField === field) {
            if (sortDirection === 'asc') setSortDirection('desc')
            else if (sortDirection === 'desc') {
                setSortDirection(null)
                setSortField(null)
            }
        } else {
            setSortField(field)
            setSortDirection('asc')
        }
    }

    const handleFilterChange = (field: string, value: string) => {
        setFilters(prev => ({ ...prev, [field]: value }))
    }

    const clearFilter = (field: string) => {
        setFilters(prev => ({ ...prev, [field]: '' }))
    }

    const filteredAndSortedPayables = useMemo(() => {
        let result = [...payables]

        Object.entries(filters).forEach(([field, value]) => {
            if (value) {
                result = result.filter(payable => {
                    let fieldValue = ''
                    if (field === 'display_date') {
                        fieldValue = payable.display_date ? format(parseISO(payable.display_date), 'dd/MM/yyyy') : ''
                    } else {
                        fieldValue = String((payable as any)[field] || '')
                    }
                    return fieldValue.toLowerCase().includes(value.toLowerCase())
                })
            }
        })

        if (sortField && sortDirection) {
            result.sort((a, b) => {
                let aValue: string | number = (a as any)[sortField] as string | number
                let bValue: string | number = (b as any)[sortField] as string | number
                if (sortField === 'valor_documento') {
                    aValue = Number(aValue) || 0
                    bValue = Number(bValue) || 0
                }
                if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
                if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
                return 0
            })
        }
        return result
    }, [payables, filters, sortField, sortDirection])

    const totalAmount = useMemo(() => {
        return filteredAndSortedPayables.reduce((sum, item) => sum + (Number(item.valor_documento) || 0), 0)
    }, [filteredAndSortedPayables])

    const CHART_COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#f97316']

    const categoryChartData = useMemo(() => {
        const categoryMap = new Map<string, number>()
        filteredAndSortedPayables.forEach(item => {
            const cat = item.category_description || 'Sem Categoria'
            categoryMap.set(cat, (categoryMap.get(cat) || 0) + (Number(item.valor_documento) || 0))
        })
        return Array.from(categoryMap, ([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10)
    }, [filteredAndSortedPayables])

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value)
    }

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return <ArrowUpDown className="w-4 h-4 opacity-50" />
        return sortDirection === 'asc' ?
            <ArrowUp className="w-4 h-4 text-primary-app" /> :
            <ArrowDown className="w-4 h-4 text-primary-app" />
    }

    return (
        <div className="space-y-6 px-4 md:px-8">
            <GlobalFilterBar
                timeRange={timeRange}
                setTimeRange={setTimeRange}
                customDates={customDates}
                setCustomDates={setCustomDates}
                selectedProject={selectedProject}
                setSelectedProject={setSelectedProject}
                projects={projects}
                title="Contas a Pagar"
                subtitle="Gestão de pagamentos e obrigações financeiras"
                loading={loading}
            />

            {/* KPI Card */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-card-app/40 border border-border-app p-6 rounded-2xl backdrop-blur-md relative overflow-hidden group">
                    <div className="relative z-10">
                        <p className="text-muted-foreground text-sm font-medium uppercase tracking-wider flex items-center gap-2">
                            <Banknote className="w-4 h-4" /> Total a Pagar / Pago
                        </p>
                        <p className="text-3xl font-bold mt-1 text-white">
                            {formatCurrency(totalAmount)}
                        </p>
                    </div>
                </div>
            </div>

            {/* Category Chart */}
            {!loading && categoryChartData.length > 0 && (
                <div className="glass rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-4">
                        <BarChart3 className="w-5 h-5 text-primary-app" />
                        <h3 className="text-lg font-semibold">Custos por Categoria</h3>
                    </div>
                    <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={categoryChartData} margin={{ top: 10, right: 10, left: 10, bottom: 60 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                                <XAxis
                                    dataKey="name"
                                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                                    angle={-45}
                                    textAnchor="end"
                                    height={80}
                                    interval={0}
                                />
                                <YAxis
                                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                                    tickFormatter={(value) => `R$ ${value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value}`}
                                    width={60}
                                />
                                <Tooltip
                                    cursor={false}
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            return (
                                                <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-2xl">
                                                    <p className="text-white font-semibold text-sm mb-1">{payload[0].payload.name}</p>
                                                    <p className="text-primary-app font-bold text-lg">
                                                        {formatCurrency(payload[0].value as number)}
                                                    </p>
                                                </div>
                                            )
                                        }
                                        return null
                                    }}
                                />
                                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                    {categoryChartData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                    ))}
                                    <LabelList
                                        dataKey="value"
                                        position="top"
                                        formatter={(value: number) => `R$ ${value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value}`}
                                        style={{ fill: '#e2e8f0', fontSize: 12, fontWeight: 600 }}
                                    />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin text-primary-app" />
                </div>
            ) : (
                <div className="glass rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-muted-app/50 border-b border-border-app">
                                <tr>
                                    <th className="px-4 py-3 text-left w-[110px]">
                                        <button onClick={() => handleSort('display_date')} className="flex items-center gap-2 text-sm font-semibold hover:text-primary-app transition-colors">
                                            Vencimento <SortIcon field="display_date" />
                                        </button>
                                    </th>
                                    <th className="px-4 py-3 text-left">
                                        <button onClick={() => handleSort('numero_documento')} className="flex items-center gap-2 text-sm font-semibold hover:text-primary-app transition-colors">
                                            Documento <SortIcon field="numero_documento" />
                                        </button>
                                    </th>
                                    <th className="px-4 py-3 text-left min-w-[220px]">
                                        <button onClick={() => handleSort('category_description')} className="flex items-center gap-2 text-sm font-semibold hover:text-primary-app transition-colors">
                                            Categoria <SortIcon field="category_description" />
                                        </button>
                                    </th>
                                    <th className="px-4 py-3 text-left w-[120px]">
                                        <button onClick={() => handleSort('project_name')} className="flex items-center gap-2 text-sm font-semibold hover:text-primary-app transition-colors">
                                            Projeto <SortIcon field="project_name" />
                                        </button>
                                    </th>
                                    <th className="px-4 py-3 text-left">
                                        <button onClick={() => handleSort('status_titulo')} className="flex items-center gap-2 text-sm font-semibold hover:text-primary-app transition-colors">
                                            Status <SortIcon field="status_titulo" />
                                        </button>
                                    </th>
                                    <th className="px-4 py-3 text-right w-[110px]">
                                        <button onClick={() => handleSort('valor_documento')} className="flex items-center gap-2 ml-auto text-sm font-semibold hover:text-primary-app transition-colors">
                                            Valor <SortIcon field="valor_documento" />
                                        </button>
                                    </th>
                                </tr>
                                {/* Filter Row */}
                                <tr className="bg-muted-app/30">
                                    <th className="px-4 py-2">
                                        <div className="relative">
                                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                                            <input
                                                type="text"
                                                placeholder="Filtrar..."
                                                value={filters.display_date}
                                                onChange={(e) => handleFilterChange('display_date', e.target.value)}
                                                className="w-full pl-7 pr-6 py-1 text-xs bg-background/50 border border-border-app rounded focus:outline-none focus:ring-1 focus:ring-primary-app"
                                            />
                                            {filters.display_date && (
                                                <button onClick={() => clearFilter('display_date')} className="absolute right-2 top-1/2 -translate-y-1/2">
                                                    <X className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                                                </button>
                                            )}
                                        </div>
                                    </th>
                                    <th className="px-4 py-2">
                                        <div className="relative">
                                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                                            <input
                                                type="text"
                                                placeholder="Filtrar..."
                                                value={filters.numero_documento}
                                                onChange={(e) => handleFilterChange('numero_documento', e.target.value)}
                                                className="w-full pl-7 pr-6 py-1 text-xs bg-background/50 border border-border-app rounded focus:outline-none focus:ring-1 focus:ring-primary-app"
                                            />
                                            {filters.numero_documento && (
                                                <button onClick={() => clearFilter('numero_documento')} className="absolute right-2 top-1/2 -translate-y-1/2">
                                                    <X className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                                                </button>
                                            )}
                                        </div>
                                    </th>
                                    <th className="px-4 py-2">
                                        <div className="relative">
                                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                                            <input
                                                type="text"
                                                placeholder="Filtrar..."
                                                value={filters.category_description}
                                                onChange={(e) => handleFilterChange('category_description', e.target.value)}
                                                className="w-full pl-7 pr-6 py-1 text-xs bg-background/50 border border-border-app rounded focus:outline-none focus:ring-1 focus:ring-primary-app"
                                            />
                                            {filters.category_description && (
                                                <button onClick={() => clearFilter('category_description')} className="absolute right-2 top-1/2 -translate-y-1/2">
                                                    <X className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                                                </button>
                                            )}
                                        </div>
                                    </th>
                                    <th className="px-4 py-2">
                                        <div className="relative">
                                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                                            <input
                                                type="text"
                                                placeholder="Filtrar..."
                                                value={filters.project_name}
                                                onChange={(e) => handleFilterChange('project_name', e.target.value)}
                                                className="w-full pl-7 pr-6 py-1 text-xs bg-background/50 border border-border-app rounded focus:outline-none focus:ring-1 focus:ring-primary-app"
                                            />
                                            {filters.project_name && (
                                                <button onClick={() => clearFilter('project_name')} className="absolute right-2 top-1/2 -translate-y-1/2">
                                                    <X className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                                                </button>
                                            )}
                                        </div>
                                    </th>
                                    <th className="px-4 py-2">
                                        <div className="relative">
                                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                                            <input
                                                type="text"
                                                placeholder="Filtrar..."
                                                value={filters.status_titulo}
                                                onChange={(e) => handleFilterChange('status_titulo', e.target.value)}
                                                className="w-full pl-7 pr-6 py-1 text-xs bg-background/50 border border-border-app rounded focus:outline-none focus:ring-1 focus:ring-primary-app"
                                            />
                                            {filters.status_titulo && (
                                                <button onClick={() => clearFilter('status_titulo')} className="absolute right-2 top-1/2 -translate-y-1/2">
                                                    <X className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                                                </button>
                                            )}
                                        </div>
                                    </th>
                                    <th className="px-4 py-2">
                                        <div className="relative">
                                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                                            <input
                                                type="text"
                                                placeholder="Filtrar..."
                                                value={filters.valor_documento}
                                                onChange={(e) => handleFilterChange('valor_documento', e.target.value)}
                                                className="w-full pl-7 pr-6 py-1 text-xs bg-background/50 border border-border-app rounded focus:outline-none focus:ring-1 focus:ring-primary-app"
                                            />
                                            {filters.valor_documento && (
                                                <button onClick={() => clearFilter('valor_documento')} className="absolute right-2 top-1/2 -translate-y-1/2">
                                                    <X className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                                                </button>
                                            )}
                                        </div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredAndSortedPayables.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                                            Nenhum registro encontrado.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredAndSortedPayables.map((item) => (
                                        <tr key={item.id} className="border-b border-border-app/50 hover:bg-muted-app/30 transition-colors">
                                            <td className="px-4 py-3 text-sm">
                                                <div className="flex items-center gap-2">
                                                    <span>{item.display_date ? format(parseISO(item.display_date), 'dd/MM/yyyy') : '-'}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm font-mono">
                                                {item.numero_documento || item.numero_documento_fiscal || '-'}
                                                {item.document_type && <span className="ml-2 text-[10px] bg-white/10 px-1 rounded">{item.document_type}</span>}
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-medium border border-blue-500/20">
                                                    {item.category_description || '-'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                {item.project_name}
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border
                                                    ${item.status_titulo === 'LIQUIDADO' ? 'text-green-400 bg-green-500/10 border-green-500/20' :
                                                        item.status_titulo === 'ATRASADO' ? 'text-red-400 bg-red-500/10 border-red-500/20' :
                                                            'text-yellow-400 bg-yellow-500/10 border-yellow-500/20'
                                                    }`}
                                                >
                                                    {item.status_titulo}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right font-semibold">
                                                {formatCurrency(item.valor_documento || 0)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}
