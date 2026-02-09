"use client"

import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchAll } from '@/lib/supabase-utils'
import { format, subDays, parseISO } from 'date-fns'
import { Loader2, ArrowUpDown, ArrowUp, ArrowDown, Search, X } from 'lucide-react'
import GlobalFilterBar from './GlobalFilterBar'
import type { PageProps } from '@/types'

type SortField = 'display_date' | 'supplier_tax_id' | 'supplier_legal_name' | 'category_name' | 'invoice_number' | 'project_name' | 'product_description' | 'total_item_value'
type SortDirection = 'asc' | 'desc' | null

export default function NFEDetailsPage({ timeRange, setTimeRange, customDates, setCustomDates, selectedProject, setSelectedProject, projects }: PageProps) {
    const [items, setItems] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    // Sorting state
    const [sortField, setSortField] = useState<SortField | null>(null)
    const [sortDirection, setSortDirection] = useState<SortDirection>(null)

    // Filter state
    const [filters, setFilters] = useState<Record<string, string>>({
        display_date: '',
        supplier_tax_id: '',
        supplier_legal_name: '',
        category_name: '',
        invoice_number: '',
        project_name: '',
        product_description: '',
        total_item_value: ''
    })

    const fetchItems = useCallback(async () => {
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

            console.log('Fetching items from', startDate, 'to', endDate)

            // Step 1: Fetch relevant financial movements (installments) within date range for "Cash Basis"
            let movementsQuery = supabase
                .from('financial_movements')
                .select('invoice_key, is_paid, payment_date, due_date, issue_date, project_id')
                .eq('payment_type', 'NFE')

            if (selectedProject) {
                movementsQuery = movementsQuery.eq('project_id', selectedProject)
            }

            movementsQuery = movementsQuery
                .or(`issue_date.gte.${startDate},due_date.gte.${startDate},payment_date.gte.${startDate}`)
                .or(`issue_date.lte.${endDate},due_date.lte.${endDate},payment_date.lte.${endDate}`)

            const movementsData = await fetchAll<any>(movementsQuery)

            // Identify which invoices have "cash action" in this period
            const validInvoiceKeys = Array.from(new Set(movementsData?.map(m => {
                const cashDate = m.is_paid ? (m.payment_date || m.due_date) : (m.due_date || m.issue_date);
                const displayDate = cashDate || m.issue_date;
                if (displayDate >= startDate && displayDate <= endDate) return m.invoice_key;
                return null;
            }).filter(Boolean)))

            if (validInvoiceKeys.length === 0) {
                setItems([])
                return
            }

            // Step 2: Fetch purchases for these keys
            const purchasesQuery = supabase
                .from('purchases')
                .select(`
                    invoice_key,
                    invoice_number,
                    supplier_tax_id,
                    supplier_legal_name,
                    issue_date,
                    invoice_total_amount,
                    projects:project_id (name),
                    categories:purchase_category (description)
                `)
                .in('invoice_key', validInvoiceKeys)

            const purchasesData = await fetchAll<any>(purchasesQuery)
            console.log('Relevant purchases fetched:', purchasesData?.length || 0)

            const invoiceKeys = validInvoiceKeys

            // Step 2: Fetch items for these purchases
            const itemsQuery = supabase
                .from('purchase_items')
                .select(`
                    item_sequence,
                    product_description,
                    total_item_value,
                    invoice_key
                `)
                .in('invoice_key', invoiceKeys)

            const rawItems = await fetchAll<any>(itemsQuery)
            console.log('Items fetched:', rawItems?.length || 0, 'records')

            // Step 3: Fetch financial movements for these purchases
            const paymentsQuery = supabase
                .from('financial_movements')
                .select(`
                    invoice_key,
                    payment_date,
                    is_paid,
                    net_amount,
                    original_amount,
                    payment_type
                `)
                .in('invoice_key', invoiceKeys)
                .eq('payment_type', 'NFE')

            const paymentsData = await fetchAll<any>(paymentsQuery)
            console.log('Payment data fetched:', paymentsData?.length || 0, 'records')

            // Step 4: Map data
            const purchasesMap = new Map()
            purchasesData.forEach(p => purchasesMap.set(p.invoice_key, p))

            const paymentsMap = new Map<string, any[]>()
            paymentsData?.forEach(payment => {
                if (payment.invoice_key) {
                    const existing = paymentsMap.get(payment.invoice_key) || []
                    existing.push(payment)
                    paymentsMap.set(payment.invoice_key, existing)
                }
            })

            const mergedData = rawItems?.map(item => {
                const invoice = purchasesMap.get(item.invoice_key)
                if (!invoice) return null

                const payments = paymentsMap.get(item.invoice_key) || []

                // If we want strict filtering by payment_type NFE, we skip items with no NFE movements
                if (payments.length === 0) return null

                const anyPaid = payments.some(p => p.is_paid)
                const latestPaymentDate = payments
                    .filter(p => p.payment_date)
                    .sort((a: any, b: any) => b.payment_date.localeCompare(a.payment_date))[0]?.payment_date

                const netTotal = payments.reduce((sum, p) => sum + (Number(p.net_amount) || Number(p.original_amount) || 0), 0)

                return {
                    id: `${item.invoice_key}-${item.item_sequence}`,
                    product_description: item.product_description,
                    total_item_value: item.total_item_value,
                    invoice_number: invoice.invoice_number,
                    supplier_tax_id: invoice.supplier_tax_id,
                    supplier_legal_name: invoice.supplier_legal_name,
                    project_name: invoice.projects?.name,
                    category_name: invoice.categories?.description,
                    issue_date: invoice.issue_date,
                    payment_date: latestPaymentDate || null,
                    is_paid: anyPaid,
                    display_date: latestPaymentDate || invoice.issue_date,
                    net_total: netTotal || invoice.invoice_total_amount || 0
                }
            }).filter((item): item is NonNullable<typeof item> => item !== null) || []

            console.log('Merged items sample:', mergedData[0])
            setItems(mergedData)
        } catch (err) {
            console.error('Error fetching items:', err)
        } finally {
            setLoading(false)
        }
    }, [timeRange, customDates, selectedProject])

    useEffect(() => {
        fetchItems()
    }, [fetchItems])

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
    const filteredAndSortedItems = useMemo(() => {
        let result = [...items]

        // Apply filters
        Object.entries(filters).forEach(([field, value]) => {
            if (value) {
                result = result.filter(item => {
                    let fieldValue = ''

                    if (field === 'display_date') {
                        fieldValue = format(parseISO(item.display_date), 'dd/MM/yyyy')
                    } else {
                        fieldValue = String(item[field] || '')
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

                aValue = a[sortField]
                bValue = b[sortField]

                // Handle numeric sorting
                if (sortField === 'total_item_value') {
                    aValue = Number(aValue) || 0
                    bValue = Number(bValue) || 0
                }

                if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
                if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
                return 0
            })
        }

        return result
    }, [items, filters, sortField, sortDirection])

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) {
            return <ArrowUpDown className="w-4 h-4 opacity-50" />
        }
        return sortDirection === 'asc' ?
            <ArrowUp className="w-4 h-4 text-primary-app" /> :
            <ArrowDown className="w-4 h-4 text-primary-app" />
    }

    return (
        <div className="space-y-6">
            <GlobalFilterBar
                timeRange={timeRange}
                setTimeRange={setTimeRange}
                customDates={customDates}
                setCustomDates={setCustomDates}
                selectedProject={selectedProject}
                setSelectedProject={setSelectedProject}
                projects={projects}
                title="Detalhamento NFE"
                subtitle="Visualização detalhada dos itens das notas fiscais"
                loading={loading}
            />

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
                                    <th className="px-4 py-3 text-left w-32">
                                        <button onClick={() => handleSort('display_date')} className="flex items-center gap-2 text-sm font-semibold hover:text-primary-app transition-colors">
                                            Data <SortIcon field="display_date" />
                                        </button>
                                    </th>
                                    {/* CNPJ/CPF */}
                                    <th className="px-4 py-3 text-left w-40">
                                        <button onClick={() => handleSort('supplier_tax_id')} className="flex items-center gap-2 text-sm font-semibold hover:text-primary-app transition-colors">
                                            CNPJ/CPF <SortIcon field="supplier_tax_id" />
                                        </button>
                                    </th>
                                    {/* Razão Social */}
                                    <th className="px-4 py-3 text-left w-48">
                                        <button onClick={() => handleSort('supplier_legal_name')} className="flex items-center gap-2 text-sm font-semibold hover:text-primary-app transition-colors">
                                            Razão Social <SortIcon field="supplier_legal_name" />
                                        </button>
                                    </th>
                                    {/* Categoria */}
                                    <th className="px-4 py-3 text-left w-40">
                                        <button onClick={() => handleSort('category_name')} className="flex items-center gap-2 text-sm font-semibold hover:text-primary-app transition-colors">
                                            Categoria <SortIcon field="category_name" />
                                        </button>
                                    </th>
                                    {/* Número da Nota */}
                                    <th className="px-4 py-3 text-left w-24">
                                        <button onClick={() => handleSort('invoice_number')} className="flex items-center gap-2 text-sm font-semibold hover:text-primary-app transition-colors">
                                            Nº Nota <SortIcon field="invoice_number" />
                                        </button>
                                    </th>
                                    {/* Projeto */}
                                    <th className="px-4 py-3 text-left w-40">
                                        <button onClick={() => handleSort('project_name')} className="flex items-center gap-2 text-sm font-semibold hover:text-primary-app transition-colors">
                                            Projeto <SortIcon field="project_name" />
                                        </button>
                                    </th>
                                    {/* Descrição do Item */}
                                    <th className="px-4 py-3 text-left min-w-[200px]">
                                        <button onClick={() => handleSort('product_description')} className="flex items-center gap-2 text-sm font-semibold hover:text-primary-app transition-colors">
                                            Descrição do Item <SortIcon field="product_description" />
                                        </button>
                                    </th>
                                    {/* Valor */}
                                    <th className="px-4 py-3 text-right w-32">
                                        <button onClick={() => handleSort('total_item_value')} className="flex items-center gap-2 ml-auto text-sm font-semibold hover:text-primary-app transition-colors">
                                            Valor <SortIcon field="total_item_value" />
                                        </button>
                                    </th>
                                </tr>

                                {/* Filter Row */}
                                <tr className="bg-muted-app/30">
                                    {[
                                        'display_date',
                                        'supplier_tax_id',
                                        'supplier_legal_name',
                                        'category_name',
                                        'invoice_number',
                                        'project_name',
                                        'product_description',
                                        'total_item_value'
                                    ].map((field) => (
                                        <th key={field} className="px-4 py-2">
                                            <div className="relative">
                                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                                                <input
                                                    type="text"
                                                    placeholder="Filtrar..."
                                                    value={filters[field]}
                                                    onChange={(e) => handleFilterChange(field, e.target.value)}
                                                    className="w-full pl-7 pr-6 py-1 text-xs bg-background/50 border border-border-app rounded focus:outline-none focus:ring-1 focus:ring-primary-app"
                                                />
                                                {filters[field] && (
                                                    <button
                                                        onClick={() => clearFilter(field)}
                                                        className="absolute right-2 top-1/2 -translate-y-1/2"
                                                    >
                                                        <X className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                                                    </button>
                                                )}
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredAndSortedItems.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                                            {items.length === 0
                                                ? 'Nenhum item encontrado no período selecionado'
                                                : 'Nenhum resultado encontrado com os filtros aplicados'}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredAndSortedItems.map((item, idx) => (
                                        <tr
                                            key={`${item.id}-${idx}`}
                                            className="border-b border-border-app/50 hover:bg-muted-app/30 transition-colors"
                                        >
                                            <td className="px-4 py-3 text-sm">
                                                <div className="flex items-center gap-2">
                                                    <span>{format(parseISO(item.display_date), 'dd/MM/yyyy')}</span>
                                                    {item.payment_date && item.payment_date !== item.issue_date && (
                                                        <span className="text-xs text-green-500" title={`Emissão: ${format(parseISO(item.issue_date), 'dd/MM/yyyy')}`}>
                                                            💰
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm font-mono truncate max-w-[150px]" title={item.supplier_tax_id}>
                                                {item.supplier_tax_id || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-sm truncate max-w-[200px]" title={item.supplier_legal_name}>
                                                {item.supplier_legal_name || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-sm truncate max-w-[150px]" title={item.category_name}>
                                                {item.category_name || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-sm font-mono">
                                                {item.invoice_number || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-sm truncate max-w-[150px]" title={item.project_name}>
                                                {item.project_name || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-sm truncate max-w-[300px]" title={item.product_description}>
                                                {item.product_description || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right font-semibold">
                                                {new Intl.NumberFormat('pt-BR', {
                                                    style: 'currency',
                                                    currency: 'BRL'
                                                }).format(item.total_item_value || 0)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {filteredAndSortedItems.length > 0 && (
                        <div className="px-4 py-3 bg-muted-app/30 border-t border-border-app text-sm text-muted-foreground flex justify-between items-center">
                            <span>
                                Exibindo {filteredAndSortedItems.length} de {items.length} itens
                            </span>
                            <span className="font-semibold">
                                Total: {new Intl.NumberFormat('pt-BR', {
                                    style: 'currency',
                                    currency: 'BRL'
                                }).format(filteredAndSortedItems.reduce((sum, item) => sum + (item.total_item_value || 0), 0))}
                            </span>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
