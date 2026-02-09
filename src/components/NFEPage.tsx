"use client"

import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchAll } from '@/lib/supabase-utils'
import { format, subDays, parseISO } from 'date-fns'
import { Loader2, ArrowUpDown, ArrowUp, ArrowDown, Search, X, BarChart3 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts'
import GlobalFilterBar from './GlobalFilterBar'
import type { PageProps } from '@/types'

type SortField = 'display_date' | 'supplier_tax_id' | 'supplier_legal_name' | 'purchase_category' | 'invoice_number' | 'project_name' | 'invoice_total_amount'
type SortDirection = 'asc' | 'desc' | null

export default function NFEPage({ timeRange, setTimeRange, customDates, setCustomDates, selectedProject, setSelectedProject, projects }: PageProps) {
    const [invoices, setInvoices] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    // Sorting state
    const [sortField, setSortField] = useState<SortField | null>(null)
    const [sortDirection, setSortDirection] = useState<SortDirection>(null)

    // Filter state
    const [filters, setFilters] = useState<Record<string, string>>({
        display_date: '',
        supplier_tax_id: '',
        supplier_legal_name: '',
        purchase_category: '',
        invoice_number: '',
        project_name: '',
        invoice_total_amount: ''
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

            console.log('Fetching financial movements from', startDate, 'to', endDate)

            // Query: Fetch financial movements as the primary source for "Cash Basis"
            let query = supabase
                .from('financial_movements')
                .select(`
                    id,
                    invoice_key,
                    invoice_number,
                    supplier_tax_id,
                    supplier_name,
                    category_id,
                    project_id,
                    status,
                    is_paid,
                    issue_date,
                    due_date,
                    payment_date,
                    net_amount,
                    original_amount,
                    installment_label,
                    payment_type,
                    description,
                    title_name,
                    projects:project_id (name),
                    categories:category_id (description)
                `)
                .eq('payment_type', 'NFE')

            if (selectedProject) {
                query = query.eq('project_id', selectedProject)
            }

            query = query
                .or(`issue_date.gte.${startDate},due_date.gte.${startDate},payment_date.gte.${startDate}`)
                .or(`issue_date.lte.${endDate},due_date.lte.${endDate},payment_date.lte.${endDate}`)
                .order('issue_date', { ascending: false })

            const rawMovements = await fetchAll<any>(query)
            console.log('NFE movements fetched:', rawMovements?.length || 0, 'records')

            // Fetch corresponding purchases to get header info (supplier name, series, etc)
            const invoiceKeys = Array.from(new Set(rawMovements?.map(m => m.invoice_key).filter(Boolean)))
            let purchasesMap = new Map()

            if (invoiceKeys.length > 0) {
                // Fetch in chunks if too many, but for NFE pages it's usually manageable
                const { data: purchasesData } = await supabase
                    .from('purchases')
                    .select('invoice_key, invoice_series, supplier_legal_name, invoice_total_amount')
                    .in('invoice_key', invoiceKeys)

                purchasesData?.forEach(p => purchasesMap.set(p.invoice_key, p))
            }

            // Map data for display - each row is an installment (Cash Basis)
            const mappedData = rawMovements?.map(item => {
                // Determine cash date (payment_date if paid, due_date if open)
                const cashDate = item.is_paid ? (item.payment_date || item.due_date) : (item.due_date || item.issue_date);
                const displayDate = cashDate || item.issue_date;

                // Range check
                if (displayDate < startDate || displayDate > endDate) return null;

                const purchaseInfo = purchasesMap.get(item.invoice_key);
                const invoiceTotal = purchaseInfo?.invoice_total_amount || 0;

                return {
                    id: item.id,
                    invoice_key: item.invoice_key,
                    invoice_number: item.invoice_number,
                    invoice_series: purchaseInfo?.invoice_series || null,
                    issue_date: item.issue_date,
                    due_date: item.due_date,
                    payment_date: item.payment_date,
                    display_date: displayDate,
                    supplier_tax_id: item.supplier_tax_id,
                    supplier_legal_name: item.title_name || item.supplier_name || purchaseInfo?.supplier_legal_name || 'N/A',
                    description: item.description,
                    // This row is an installment, so we show the net_amount of this movement
                    invoice_total_amount: Number(item.net_amount) || Number(item.original_amount) || 0,
                    // Metadata
                    full_invoice_amount: invoiceTotal,
                    project_name: item.projects?.name || 'N/A',
                    purchase_category: item.categories?.description || 'N/A',
                    is_paid: item.is_paid,
                    status: item.status,
                    installment_label: item.installment_label
                }
            }).filter((item): item is NonNullable<typeof item> => item !== null) || []

            console.log('Mapped data sample (installments):', mappedData[0])
            setInvoices(mappedData)
        } catch (err) {
            console.error('Error fetching financial data:', err)
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
            // Cycle through: asc -> desc -> null
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

                    if (field === 'display_date') {
                        fieldValue = format(parseISO(invoice.display_date), 'dd/MM/yyyy')
                    } else {
                        fieldValue = String(invoice[field] || '')
                    }

                    return fieldValue.toLowerCase().includes(value.toLowerCase())
                })
            }
        })

        // Apply sorting
        if (sortField && sortDirection) {
            result.sort((a, b) => {
                let aValue = a[sortField]
                let bValue = b[sortField]

                // Handle numeric sorting
                if (sortField === 'invoice_total_amount') {
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
        return filteredAndSortedInvoices.reduce((sum, inv) => sum + (Number(inv.invoice_total_amount) || 0), 0)
    }, [filteredAndSortedInvoices])

    const CHART_COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#f97316']

    const categoryChartData = useMemo(() => {
        const categoryMap = new Map<string, number>()
        filteredAndSortedInvoices.forEach(inv => {
            const cat = inv.purchase_category || 'Sem Categoria'
            categoryMap.set(cat, (categoryMap.get(cat) || 0) + (Number(inv.invoice_total_amount) || 0))
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
                title="Notas Fiscais Eletrônicas (NFE)"
                subtitle="Visualização de todas as notas fiscais de compra"
                loading={loading}
            />

            {/* KPI Card */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-card-app/40 border border-border-app p-6 rounded-2xl backdrop-blur-md relative overflow-hidden group">
                    <div className="relative z-10">
                        <p className="text-muted-foreground text-sm font-medium uppercase tracking-wider">Total do Período</p>
                        <p className="text-3xl font-bold mt-1 text-white">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalAmount)}
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
                                    {/* CNPJ/CPF */}
                                    <th className="px-4 py-3 text-left">
                                        <button
                                            onClick={() => handleSort('supplier_tax_id')}
                                            className="flex items-center gap-2 text-sm font-semibold hover:text-primary-app transition-colors"
                                        >
                                            CNPJ/CPF
                                            <SortIcon field="supplier_tax_id" />
                                        </button>
                                    </th>
                                    {/* Razão Social */}
                                    <th className="px-4 py-3 text-left">
                                        <button
                                            onClick={() => handleSort('supplier_legal_name')}
                                            className="flex items-center gap-2 text-sm font-semibold hover:text-primary-app transition-colors"
                                        >
                                            Razão Social
                                            <SortIcon field="supplier_legal_name" />
                                        </button>
                                    </th>
                                    {/* Categoria */}
                                    <th className="px-4 py-3 text-left min-w-[220px]">
                                        <button
                                            onClick={() => handleSort('purchase_category')}
                                            className="flex items-center gap-2 text-sm font-semibold hover:text-primary-app transition-colors"
                                        >
                                            Categoria
                                            <SortIcon field="purchase_category" />
                                        </button>
                                    </th>
                                    {/* Número da Nota */}
                                    <th className="px-4 py-3 text-left">
                                        <button
                                            onClick={() => handleSort('invoice_number')}
                                            className="flex items-center gap-2 text-sm font-semibold hover:text-primary-app transition-colors"
                                        >
                                            Nº Nota
                                            <SortIcon field="invoice_number" />
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
                                    {/* Valor */}
                                    <th className="px-4 py-3 text-right w-[110px]">
                                        <button
                                            onClick={() => handleSort('invoice_total_amount')}
                                            className="flex items-center gap-2 ml-auto text-sm font-semibold hover:text-primary-app transition-colors"
                                        >
                                            Valor
                                            <SortIcon field="invoice_total_amount" />
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
                                                <button
                                                    onClick={() => clearFilter('display_date')}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2"
                                                >
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
                                                value={filters.supplier_tax_id}
                                                onChange={(e) => handleFilterChange('supplier_tax_id', e.target.value)}
                                                className="w-full pl-7 pr-6 py-1 text-xs bg-background/50 border border-border-app rounded focus:outline-none focus:ring-1 focus:ring-primary-app"
                                            />
                                            {filters.supplier_tax_id && (
                                                <button
                                                    onClick={() => clearFilter('supplier_tax_id')}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2"
                                                >
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
                                                value={filters.supplier_legal_name}
                                                onChange={(e) => handleFilterChange('supplier_legal_name', e.target.value)}
                                                className="w-full pl-7 pr-6 py-1 text-xs bg-background/50 border border-border-app rounded focus:outline-none focus:ring-1 focus:ring-primary-app"
                                            />
                                            {filters.supplier_legal_name && (
                                                <button
                                                    onClick={() => clearFilter('supplier_legal_name')}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2"
                                                >
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
                                                value={filters.purchase_category}
                                                onChange={(e) => handleFilterChange('purchase_category', e.target.value)}
                                                className="w-full pl-7 pr-6 py-1 text-xs bg-background/50 border border-border-app rounded focus:outline-none focus:ring-1 focus:ring-primary-app"
                                            />
                                            {filters.purchase_category && (
                                                <button
                                                    onClick={() => clearFilter('purchase_category')}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2"
                                                >
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
                                                value={filters.invoice_number}
                                                onChange={(e) => handleFilterChange('invoice_number', e.target.value)}
                                                className="w-full pl-7 pr-6 py-1 text-xs bg-background/50 border border-border-app rounded focus:outline-none focus:ring-1 focus:ring-primary-app"
                                            />
                                            {filters.invoice_number && (
                                                <button
                                                    onClick={() => clearFilter('invoice_number')}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2"
                                                >
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
                                                <button
                                                    onClick={() => clearFilter('project_name')}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2"
                                                >
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
                                                value={filters.invoice_total_amount}
                                                onChange={(e) => handleFilterChange('invoice_total_amount', e.target.value)}
                                                className="w-full pl-7 pr-6 py-1 text-xs bg-background/50 border border-border-app rounded focus:outline-none focus:ring-1 focus:ring-primary-app"
                                            />
                                            {filters.invoice_total_amount && (
                                                <button
                                                    onClick={() => clearFilter('invoice_total_amount')}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2"
                                                >
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
                                        <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                                            {invoices.length === 0
                                                ? 'Nenhuma nota fiscal encontrada no período selecionado'
                                                : 'Nenhum resultado encontrado com os filtros aplicados'}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredAndSortedInvoices.map((invoice) => (
                                        <tr
                                            key={invoice.id}
                                            className="border-b border-border-app/50 hover:bg-muted-app/30 transition-colors"
                                        >
                                            <td className="px-4 py-3 text-sm">
                                                <div className="flex items-center gap-2">
                                                    <span>{format(parseISO(invoice.display_date), 'dd/MM/yyyy')}</span>
                                                    {invoice.is_paid && (
                                                        <span className="text-xs text-green-500" title={invoice.payment_date ? `Pago em: ${format(parseISO(invoice.payment_date), 'dd/MM/yyyy')}` : 'Pago'}>
                                                            💰
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm font-mono">
                                                {invoice.supplier_tax_id || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-foreground-app">
                                                        {invoice.supplier_legal_name || 'N/A'}
                                                    </span>
                                                    {invoice.description && (
                                                        <span className="text-[10px] text-muted-foreground line-clamp-1">
                                                            {invoice.description}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-medium border border-blue-500/20">
                                                    {invoice.purchase_category || '-'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm font-mono">
                                                <div className="flex flex-col">
                                                    <span>{invoice.invoice_number || '-'}</span>
                                                    {invoice.installment_label && (
                                                        <span className="text-[10px] text-primary-app font-bold uppercase tracking-wider">
                                                            {invoice.installment_label}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                {invoice.project_name || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right font-semibold">
                                                {new Intl.NumberFormat('pt-BR', {
                                                    style: 'currency',
                                                    currency: 'BRL'
                                                }).format(invoice.invoice_total_amount || 0)}
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
                                Total: {new Intl.NumberFormat('pt-BR', {
                                    style: 'currency',
                                    currency: 'BRL'
                                }).format(filteredAndSortedInvoices.reduce((sum, inv) => sum + (inv.invoice_total_amount || 0), 0))}
                            </span>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
