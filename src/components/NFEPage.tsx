"use client"

import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchAll } from '@/lib/supabase-utils'
import { format, subDays, parseISO } from 'date-fns'
import { Loader2, ArrowUpDown, ArrowUp, ArrowDown, Search, X } from 'lucide-react'

interface PageProps {
    timeRange: string
    setTimeRange: (value: string) => void
    customDates: { start: string; end: string }
    setCustomDates: (dates: { start: string; end: string }) => void
}

type SortField = 'display_date' | 'supplier_tax_id' | 'supplier_legal_name' | 'purchase_category' | 'invoice_number' | 'project_name' | 'invoice_total_amount'
type SortDirection = 'asc' | 'desc' | null

export default function NFEPage({ timeRange, setTimeRange, customDates, setCustomDates }: PageProps) {
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
            } else if (timeRange === '2024') {
                startDate = '2024-01-01'
                endDate = '2024-12-31'
            } else if (timeRange === 'all') {
                startDate = '2000-01-01'
                endDate = '2099-12-31'
            } else {
                startDate = format(subDays(new Date(), parseInt(timeRange)), 'yyyy-MM-dd')
            }

            console.log('Fetching financial movements from', startDate, 'to', endDate)

            // Query: Fetch purchases as the main source
            const query = supabase
                .from('purchases')
                .select(`
                    id,
                    invoice_key,
                    invoice_number,
                    invoice_series,
                    supplier_legal_name,
                    supplier_tax_id,
                    issue_date,
                    invoice_total_amount,
                    project_id,
                    purchase_category,
                    projects:project_id (name),
                    categories:purchase_category (description)
                `)
                .gte('issue_date', startDate)
                .lte('issue_date', endDate)
                .order('issue_date', { ascending: false })

            const rawPurchases = await fetchAll<any>(query)
            console.log('Purchases data fetched:', rawPurchases?.length || 0, 'records')

            // Fetch payment status from financial_movements
            const paymentsQuery = supabase
                .from('financial_movements')
                .select('invoice_key, is_paid, payment_date, paid_amount, net_amount, original_amount, payment_type')
                .eq('payment_type', 'NFE')

            const rawPayments = await fetchAll<any>(paymentsQuery)

            // Group payments by invoice_key to handle installments
            const paymentsMap = new Map()
            rawPayments?.forEach(p => {
                if (!p.invoice_key) return
                const existing = paymentsMap.get(p.invoice_key) || { is_paid: false, payment_date: null, paid_total: 0, net_total: 0 }
                existing.is_paid = existing.is_paid || p.is_paid
                existing.paid_total += (Number(p.paid_amount) || 0)
                existing.net_total += (Number(p.net_amount) || Number(p.original_amount) || 0)
                if (p.payment_date && (!existing.payment_date || p.payment_date > existing.payment_date)) {
                    existing.payment_date = p.payment_date
                }
                paymentsMap.set(p.invoice_key, existing)
            })

            // Map data for display - each row is an invoice
            const mappedData = rawPurchases?.map(item => {
                const paymentInfo = paymentsMap.get(item.invoice_key)

                // Only include if there's a matching NFE financial movement
                if (!paymentInfo) return null

                return {
                    invoice_key: item.invoice_key,
                    invoice_number: item.invoice_number,
                    invoice_series: item.invoice_series || null,
                    issue_date: item.issue_date,
                    supplier_tax_id: item.supplier_tax_id,
                    supplier_legal_name: item.supplier_legal_name,
                    // Use consolidated net_amount from paymentsMap if available, otherwise original invoice total
                    invoice_total_amount: paymentInfo?.net_total || item.invoice_total_amount || 0,
                    project_id: item.project_id,
                    purchase_category: item.categories?.description || null,
                    projects: item.projects,
                    categories: item.categories,
                    // Payment info from consolidated map
                    payment_date: paymentInfo?.payment_date || null,
                    is_paid: paymentInfo?.is_paid || false,
                    paid_amount: paymentInfo?.paid_total || 0,
                    // Primary date for display is payment_date if available, otherwise issue_date
                    display_date: paymentInfo?.payment_date || item.issue_date
                }
            }).filter((item): item is NonNullable<typeof item> => item !== null) || []

            console.log('Mapped data sample:', mappedData[0])
            setInvoices(mappedData)
        } catch (err) {
            console.error('Error fetching financial data:', err)
        } finally {
            setLoading(false)
        }
    }, [timeRange, customDates])

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

                    if (field === 'project_name') {
                        fieldValue = invoice.projects?.name || ''
                    } else if (field === 'purchase_category') {
                        fieldValue = invoice.categories?.description || ''
                    } else if (field === 'display_date') {
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
                let aValue: any
                let bValue: any

                if (sortField === 'project_name') {
                    aValue = a.projects?.name || ''
                    bValue = b.projects?.name || ''
                } else if (sortField === 'purchase_category') {
                    aValue = a.categories?.description || ''
                    bValue = b.categories?.description || ''
                } else {
                    aValue = a[sortField]
                    bValue = b[sortField]
                }

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

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) {
            return <ArrowUpDown className="w-4 h-4 opacity-50" />
        }
        return sortDirection === 'asc' ?
            <ArrowUp className="w-4 h-4 text-primary-app" /> :
            <ArrowDown className="w-4 h-4 text-primary-app" />
    }

    return (
        <div className="p-8 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Notas Fiscais Eletrônicas (NFE)</h1>
                    <p className="text-muted-foreground mt-1">
                        Visualização de todas as notas fiscais de compra
                    </p>
                </div>

                {/* Time Range Selector */}
                <div className="flex gap-2">
                    {['30', '90', '180', '360'].map((days) => (
                        <button
                            key={days}
                            onClick={() => setTimeRange(days)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${timeRange === days
                                ? 'bg-primary-app text-white'
                                : 'bg-muted-app text-muted-foreground hover:bg-muted-app/80'
                                }`}
                        >
                            {days}D
                        </button>
                    ))}
                    <button
                        onClick={() => setTimeRange('2024')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${timeRange === '2024'
                            ? 'bg-primary-app text-white'
                            : 'bg-muted-app text-muted-foreground hover:bg-muted-app/80'
                            }`}
                    >
                        2024
                    </button>
                    <button
                        onClick={() => setTimeRange('all')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${timeRange === 'all'
                            ? 'bg-primary-app text-white'
                            : 'bg-muted-app text-muted-foreground hover:bg-muted-app/80'
                            }`}
                    >
                        Tudo
                    </button>
                </div>
            </div>

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
                                    <th className="px-4 py-3 text-left">
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
                                    <th className="px-4 py-3 text-left">
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
                                    <th className="px-4 py-3 text-left">
                                        <button
                                            onClick={() => handleSort('project_name')}
                                            className="flex items-center gap-2 text-sm font-semibold hover:text-primary-app transition-colors"
                                        >
                                            Projeto
                                            <SortIcon field="project_name" />
                                        </button>
                                    </th>
                                    {/* Valor */}
                                    <th className="px-4 py-3 text-right">
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
                                            key={invoice.invoice_key}
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
                                                {invoice.supplier_legal_name || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                {invoice.categories?.description || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-sm font-mono">
                                                {invoice.invoice_number || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                {invoice.projects?.name || '-'}
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
                                Exibindo {filteredAndSortedInvoices.length} de {invoices.length} nota{invoices.length !== 1 ? 's' : ''} fiscal{invoices.length !== 1 ? 'is' : ''}
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
