"use client"

import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchAll } from '@/lib/supabase-utils'
import { format, subDays, parseISO } from 'date-fns'
import { Loader2, ArrowUpDown, ArrowUp, ArrowDown, Search, X, BarChart3 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts'
import GlobalFilterBar from './GlobalFilterBar'
import type { PageProps, AccountPayable } from '@/types'

type SortField = 'display_date' | 'numero_documento' | 'project_name' | 'category_name' | 'valor_documento' | 'status_titulo'
type SortDirection = 'asc' | 'desc' | null

interface MappedInvoice {
    codigo_lancamento_omie: number
    display_date: string
    data_emissao: string | null
    data_vencimento: string | null
    numero_documento: string | null
    numero_documento_fiscal: string | null
    project_code: string | null
    project_name: string
    category_code: string | null
    category_name: string
    valor_documento: number
    status_titulo: string | null
    current_installment: number
    total_installments: number
    is_paid: boolean
}

export default function NFEPage({ timeRange, setTimeRange, customDates, setCustomDates, selectedProject, setSelectedProject, projects }: PageProps) {
    const [invoices, setInvoices] = useState<MappedInvoice[]>([])
    const [loading, setLoading] = useState(true)

    // Sorting state
    const [sortField, setSortField] = useState<SortField | null>(null)
    const [sortDirection, setSortDirection] = useState<SortDirection>(null)

    // Filter state
    const [filters, setFilters] = useState<Record<string, string>>({
        display_date: '',
        numero_documento: '',
        project_name: '',
        category_name: '',
        valor_documento: '',
        status_titulo: ''
    })

    const fetchInvoices = useCallback(async () => {
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

            console.log('Fetching NFE accounts_payable from', startDate, 'to', endDate)

            // Query accounts_payable filtered by document_type = 'NFE'
            let query = supabase
                .from('accounts_payable')
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
                    data_vencimento,
                    status_titulo,
                    valor_documento,
                    projects:project_code (code, name),
                    categories:category_code (code, description)
                `)
                .eq('document_type', 'NFE')
                .gte('data_vencimento', startDate)
                .lte('data_vencimento', endDate)

            if (selectedProject) {
                query = query.eq('project_code', selectedProject)
            }

            query = query.order('data_vencimento', { ascending: false })

            const rawMovements = await fetchAll<AccountPayable>(query)
            console.log('NFE records fetched:', rawMovements?.length || 0, 'records')

            // Map data for display
            const mappedData: MappedInvoice[] = rawMovements?.map(item => {
                const displayDate = item.data_vencimento || item.data_emissao || ''
                const isPaid = item.status_titulo === 'LIQUIDADO'

                return {
                    codigo_lancamento_omie: item.codigo_lancamento_omie,
                    display_date: displayDate,
                    data_emissao: item.data_emissao,
                    data_vencimento: item.data_vencimento,
                    numero_documento: item.numero_documento,
                    numero_documento_fiscal: item.numero_documento_fiscal,
                    project_code: item.project_code,
                    project_name: item.projects?.name || 'N/A',
                    category_code: item.category_code,
                    category_name: item.categories?.description || 'Sem Categoria',
                    valor_documento: Number(item.valor_documento) || 0,
                    status_titulo: item.status_titulo,
                    current_installment: item.current_installment,
                    total_installments: item.total_installments,
                    is_paid: isPaid
                }
            }) || []

            console.log('Mapped NFE data sample:', mappedData[0])
            setInvoices(mappedData)
        } catch (err) {
            console.error('Error fetching NFE data:', err)
        } finally {
            setLoading(false)
        }
    }, [timeRange, customDates, selectedProject])

    useEffect(() => {
        fetchInvoices()
    }, [fetchInvoices])

    // Handle sorting
    const handleSort = (field: SortField) => {
        if (sortField === field) {
            if (sortDirection === 'asc') {
                setSortDirection('desc')
            } else if (sortDirection === 'desc') {
                setSortDirection(null)
                setSortField(null)
            }
        } else {
            setSortField(field)
            setSortDirection('asc')
        }
    }

    // Handle filter change
    const handleFilterChange = (field: string, value: string) => {
        setFilters(prev => ({ ...prev, [field]: value }))
    }

    // Clear filter
    const clearFilter = (field: string) => {
        setFilters(prev => ({ ...prev, [field]: '' }))
    }

    // Apply filters and sorting
    const filteredAndSortedInvoices = useMemo(() => {
        let result = [...invoices]

        // Apply filters
        Object.entries(filters).forEach(([field, value]) => {
            if (value) {
                result = result.filter(invoice => {
                    let fieldValue = ''

                    if (field === 'display_date' && invoice.display_date) {
                        fieldValue = format(parseISO(invoice.display_date), 'dd/MM/yyyy')
                    } else if (field === 'valor_documento') {
                        fieldValue = String(invoice.valor_documento)
                    } else {
                        fieldValue = String((invoice as any)[field] || '')
                    }

                    return fieldValue.toLowerCase().includes(value.toLowerCase())
                })
            }
        })

        // Apply sorting
        if (sortField && sortDirection) {
            result.sort((a, b) => {
                let aValue = (a as any)[sortField]
                let bValue = (b as any)[sortField]

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
    }, [invoices, filters, sortField, sortDirection])

    const totalAmount = useMemo(() => {
        return filteredAndSortedInvoices.reduce((sum, inv) => sum + inv.valor_documento, 0)
    }, [filteredAndSortedInvoices])

    const CHART_COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#f97316']

    const categoryChartData = useMemo(() => {
        const categoryMap = new Map<string, number>()
        filteredAndSortedInvoices.forEach(inv => {
            const cat = inv.category_name || 'Sem Categoria'
            categoryMap.set(cat, (categoryMap.get(cat) || 0) + inv.valor_documento)
        })
        return Array.from(categoryMap, ([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10)
    }, [filteredAndSortedInvoices])

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value)
    }

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) {
            return <ArrowUpDown className="w-4 h-4 opacity-50" />
        }
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
                title="Notas Fiscais Eletronicas (NFE)"
                subtitle="Visualizacao de todas as notas fiscais de compra"
                loading={loading}
            />

            {/* KPI Card */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-card-app/40 border border-border-app p-6 rounded-2xl backdrop-blur-md relative overflow-hidden group">
                    <div className="relative z-10">
                        <p className="text-muted-foreground text-sm font-medium uppercase tracking-wider">Total do Periodo</p>
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
                                    {/* Data */}
                                    <th className="px-4 py-3 text-left w-[110px]">
                                        <button
                                            onClick={() => handleSort('display_date')}
                                            className="flex items-center gap-2 text-sm font-semibold hover:text-primary-app transition-colors"
                                        >
                                            Data
                                            <SortIcon field="display_date" />
                                        </button>
                                    </th>
                                    {/* Numero Documento */}
                                    <th className="px-4 py-3 text-left">
                                        <button
                                            onClick={() => handleSort('numero_documento')}
                                            className="flex items-center gap-2 text-sm font-semibold hover:text-primary-app transition-colors"
                                        >
                                            N Documento
                                            <SortIcon field="numero_documento" />
                                        </button>
                                    </th>
                                    {/* Categoria */}
                                    <th className="px-4 py-3 text-left min-w-[220px]">
                                        <button
                                            onClick={() => handleSort('category_name')}
                                            className="flex items-center gap-2 text-sm font-semibold hover:text-primary-app transition-colors"
                                        >
                                            Categoria
                                            <SortIcon field="category_name" />
                                        </button>
                                    </th>
                                    {/* Projeto */}
                                    <th className="px-4 py-3 text-left w-[120px]">
                                        <button
                                            onClick={() => handleSort('project_name')}
                                            className="flex items-center gap-2 text-sm font-semibold hover:text-primary-app transition-colors"
                                        >
                                            Projeto
                                            <SortIcon field="project_name" />
                                        </button>
                                    </th>
                                    {/* Status */}
                                    <th className="px-4 py-3 text-left w-[100px]">
                                        <button
                                            onClick={() => handleSort('status_titulo')}
                                            className="flex items-center gap-2 text-sm font-semibold hover:text-primary-app transition-colors"
                                        >
                                            Status
                                            <SortIcon field="status_titulo" />
                                        </button>
                                    </th>
                                    {/* Valor */}
                                    <th className="px-4 py-3 text-right w-[130px]">
                                        <button
                                            onClick={() => handleSort('valor_documento')}
                                            className="flex items-center gap-2 ml-auto text-sm font-semibold hover:text-primary-app transition-colors"
                                        >
                                            Valor
                                            <SortIcon field="valor_documento" />
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
                                                value={filters.category_name}
                                                onChange={(e) => handleFilterChange('category_name', e.target.value)}
                                                className="w-full pl-7 pr-6 py-1 text-xs bg-background/50 border border-border-app rounded focus:outline-none focus:ring-1 focus:ring-primary-app"
                                            />
                                            {filters.category_name && (
                                                <button onClick={() => clearFilter('category_name')} className="absolute right-2 top-1/2 -translate-y-1/2">
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
                                {filteredAndSortedInvoices.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                                            {invoices.length === 0
                                                ? 'Nenhuma nota fiscal encontrada no periodo selecionado'
                                                : 'Nenhum resultado encontrado com os filtros aplicados'}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredAndSortedInvoices.map((invoice) => (
                                        <tr
                                            key={invoice.codigo_lancamento_omie}
                                            className="border-b border-border-app/50 hover:bg-muted-app/30 transition-colors"
                                        >
                                            <td className="px-4 py-3 text-sm">
                                                <div className="flex items-center gap-2">
                                                    <span>{invoice.display_date ? format(parseISO(invoice.display_date), 'dd/MM/yyyy') : '-'}</span>
                                                    {invoice.is_paid && (
                                                        <span className="text-xs text-green-500" title="Pago">
                                                            ✓
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm font-mono">
                                                <div className="flex flex-col">
                                                    <span>{invoice.numero_documento || '-'}</span>
                                                    {invoice.total_installments > 1 && (
                                                        <span className="text-[10px] text-primary-app font-bold uppercase tracking-wider">
                                                            {invoice.current_installment}/{invoice.total_installments}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-medium border border-blue-500/20">
                                                    {invoice.category_name}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                {invoice.project_name}
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                                                    invoice.status_titulo === 'LIQUIDADO'
                                                        ? 'bg-green-500/10 text-green-400 border-green-500/20'
                                                        : invoice.status_titulo === 'ATRASADO'
                                                        ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                                        : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                                                }`}>
                                                    {invoice.status_titulo || 'ABERTO'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right font-semibold">
                                                {formatCurrency(invoice.valor_documento)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {filteredAndSortedInvoices.length > 0 && (
                        <div className="px-4 py-3 bg-muted-app/30 border-t border-border-app text-sm text-muted-foreground flex justify-between items-center">
                            <span>
                                Exibindo {filteredAndSortedInvoices.length} de {invoices.length} nota{invoices.length !== 1 ? 's' : ''} fisca{invoices.length !== 1 ? 'is' : 'l'}
                            </span>
                            <span className="font-semibold">
                                Total: {formatCurrency(totalAmount)}
                            </span>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
