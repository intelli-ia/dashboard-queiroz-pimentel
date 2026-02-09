"use client"

import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchAll } from '@/lib/supabase-utils'
import { format, subDays, parseISO } from 'date-fns'
import { Loader2, ArrowUpDown, ArrowUp, ArrowDown, Search, X, BarChart3 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts'
import GlobalFilterBar from './GlobalFilterBar'
import type { PageProps as BasePageProps, ProjectOption } from '@/types'

interface PageProps extends BasePageProps {
    title: string
    paymentTypes?: string[]
    includeKeywords?: string[]
    excludeKeywords?: string[]
    fetchAllTypes?: boolean
}

type SortField = 'display_date' | 'supplier_name' | 'category_description' | 'invoice_number' | 'project_name' | 'net_amount' | 'status'
type SortDirection = 'asc' | 'desc' | null

export default function GenericFinancialPage({ title, paymentTypes = [], includeKeywords = [], excludeKeywords = [], fetchAllTypes = false, timeRange, setTimeRange, customDates, setCustomDates, selectedProject, setSelectedProject, projects }: PageProps) {
    const [movements, setMovements] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    // Sorting state
    const [sortField, setSortField] = useState<SortField | null>('display_date')
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

    // Filter state
    const [filters, setFilters] = useState<Record<string, string>>({
        display_date: '',
        supplier_name: '',
        category_description: '',
        invoice_number: '',
        project_name: '',
        net_amount: '',
        status: ''
    })

    const fetchMovements = useCallback(async () => {
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

            console.log(`Fetching ${title} from`, startDate, 'to', endDate)

            let query = supabase
                .from('financial_movements')
                .select(`
                    id,
                    title_id,
                    invoice_number,
                    supplier_name,
                    payment_date,
                    issue_date,
                    due_date,
                    is_paid,
                    status,
                    net_amount,
                    original_amount,
                    installment_label,
                    payment_type,
                    description,
                    title_name,
                    projects:project_id (name),
                    categories:category_id (description)
                `)

            // Add project filter if selected
            if (selectedProject) {
                query = query.eq('project_id', selectedProject)
            }

            // Create filters
            let mainFilter = ''

            if (!fetchAllTypes) {
                const typeFilter = paymentTypes.length > 0 ? `payment_type.in.(${paymentTypes.join(',')})` : ''
                const keywordFilters = includeKeywords.map(kw => `invoice_number.ilike.%${kw}%,description.ilike.%${kw}%`).join(',')

                if (typeFilter && keywordFilters) {
                    mainFilter = `${typeFilter},${keywordFilters}`
                } else if (typeFilter) {
                    mainFilter = typeFilter
                } else if (keywordFilters) {
                    mainFilter = keywordFilters
                }
            }

            if (mainFilter) {
                query = query.or(mainFilter)
            }

            query = query
                .or(`issue_date.gte.${startDate},due_date.gte.${startDate},payment_date.gte.${startDate}`)
                .or(`issue_date.lte.${endDate},due_date.lte.${endDate},payment_date.lte.${endDate}`)
                .order('issue_date', { ascending: false })

            const rawData = await fetchAll<any>(query)

            const mappedData = rawData?.map(item => {
                // Determine cash date (payment_date if paid, due_date if open)
                const cashDate = item.is_paid ? (item.payment_date || item.due_date) : (item.due_date || item.issue_date);
                const displayDate = cashDate || item.issue_date;

                // Range check
                if (displayDate < startDate || displayDate > endDate) return null;

                // Keyword exclusion check
                if (excludeKeywords.length > 0) {
                    const searchableText = `${item.invoice_number} ${item.description} ${item.payment_type} ${item.supplier_name || ''} ${item.title_name || ''}`.toLowerCase()
                    const shouldExclude = excludeKeywords.some(kw => searchableText.includes(kw.toLowerCase()))
                    if (shouldExclude) return null
                }

                return {
                    id: item.id,
                    title_id: item.title_id,
                    invoice_number: item.invoice_number,
                    supplier_name: item.title_name || item.supplier_name || 'N/A',
                    display_date: displayDate,
                    is_paid: item.is_paid,
                    status: item.status,
                    net_amount: Number(item.net_amount) || Number(item.original_amount) || 0,
                    project_name: item.projects?.name || 'N/A',
                    category_description: item.categories?.description || 'N/A',
                    description: item.description,
                    installment: item.installment_label
                }
            }).filter((item): item is NonNullable<typeof item> => item !== null) || []

            setMovements(mappedData)
        } catch (err) {
            console.error(`Error fetching ${title}:`, err)
        } finally {
            setLoading(false)
        }
    }, [timeRange, customDates, selectedProject, title, fetchAllTypes, paymentTypes.join(','), includeKeywords.join(','), excludeKeywords.join(',')])

    useEffect(() => {
        fetchMovements()
    }, [fetchMovements])

    // Filter and Sort Logic
    const filteredMovements = useMemo(() => {
        let result = [...movements]

        // Apply filters
        Object.keys(filters).forEach(key => {
            if (filters[key]) {
                const searchValue = filters[key].toLowerCase()
                result = result.filter(item => {
                    const itemValue = String(item[key] || '').toLowerCase()
                    return itemValue.includes(searchValue)
                })
            }
        })

        // Apply sorting
        if (sortField && sortDirection) {
            result.sort((a, b) => {
                const aValue = a[sortField]
                const bValue = b[sortField]

                if (aValue === bValue) return 0
                const comparison = aValue > bValue ? 1 : -1
                return sortDirection === 'asc' ? comparison : -comparison
            })
        }

        return result
    }, [movements, filters, sortField, sortDirection])

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : sortDirection === 'desc' ? null : 'asc')
            if (sortDirection === 'desc') setSortField(null)
        } else {
            setSortField(field)
            setSortDirection('asc')
        }
    }

    const updateFilter = (field: string, value: string) => {
        setFilters(prev => ({ ...prev, [field]: value }))
    }

    const clearFilters = () => {
        setFilters({
            display_date: '',
            supplier_name: '',
            category_description: '',
            invoice_number: '',
            project_name: '',
            net_amount: '',
            status: ''
        })
    }

    const totals = useMemo(() => {
        return filteredMovements.reduce((acc, curr) => ({
            total: acc.total + curr.net_amount,
            paid: acc.paid + (curr.is_paid ? curr.net_amount : 0),
            pending: acc.pending + (!curr.is_paid ? curr.net_amount : 0)
        }), { total: 0, paid: 0, pending: 0 })
    }, [filteredMovements])

    const CHART_COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#f97316']

    const categoryChartData = useMemo(() => {
        const categoryMap = new Map<string, number>()
        filteredMovements.forEach(item => {
            const cat = item.category_description || 'Sem Categoria'
            categoryMap.set(cat, (categoryMap.get(cat) || 0) + (Number(item.net_amount) || 0))
        })
        return Array.from(categoryMap, ([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10)
    }, [filteredMovements])

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value)
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
                title={title}
                subtitle="Visualização detalhada por tipo de pagamento"
                loading={loading}
            />

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-card-app/40 border border-border-app p-6 rounded-2xl backdrop-blur-md relative overflow-hidden group">
                    <div className="relative z-10">
                        <p className="text-muted-foreground text-sm font-medium uppercase tracking-wider">Total do Período</p>
                        <p className="text-3xl font-bold mt-1 text-white">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totals.total)}
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

            <div className="bg-card-app border border-border-app rounded-2xl overflow-hidden shadow-2xl relative">
                {loading && (
                    <div className="absolute inset-0 bg-background-app/50 backdrop-blur-sm z-50 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-2">
                            <Loader2 className="w-8 h-8 text-primary-app animate-spin" />
                            <p className="text-xs text-muted-foreground font-medium">Carregando dados...</p>
                        </div>
                    </div>
                )}

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-muted-app/30 border-b border-border-app">
                                {[
                                    { id: 'display_date', label: 'Data', width: 'w-32' },
                                    { id: 'supplier_name', label: 'Beneficiário/Fornecedor' },
                                    { id: 'category_description', label: 'Categoria' },
                                    { id: 'invoice_number', label: 'Nº Docto', width: 'w-32' },
                                    { id: 'project_name', label: 'Projeto' },
                                    { id: 'net_amount', label: 'Valor', width: 'w-36' },
                                    { id: 'status', label: 'Status', width: 'w-32' }
                                ].map(col => (
                                    <th key={col.id} className={`px-4 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider ${col.width || ''}`}>
                                        <div className="flex flex-col gap-2">
                                            <button
                                                onClick={() => handleSort(col.id as SortField)}
                                                className="flex items-center gap-2 hover:text-white transition-colors"
                                            >
                                                {col.label}
                                                {sortField === col.id ? (
                                                    sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-primary-app" /> : <ArrowDown className="w-3 h-3 text-primary-app" />
                                                ) : (
                                                    <ArrowUpDown className="w-3 h-3 opacity-30" />
                                                )}
                                            </button>
                                            <div className="relative group">
                                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/50 group-focus-within:text-primary-app transition-colors" />
                                                <input
                                                    type="text"
                                                    value={filters[col.id]}
                                                    onChange={(e) => updateFilter(col.id, e.target.value)}
                                                    className="w-full h-8 pl-7 pr-2 bg-background-app/50 border border-border-app/50 rounded-lg text-[11px] focus:outline-none focus:ring-1 focus:ring-primary-app/50 transition-all"
                                                    placeholder="Filtrar..."
                                                />
                                            </div>
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-app/50">
                            {filteredMovements.length > 0 ? (
                                filteredMovements.map((item) => (
                                    <tr key={item.id} className="hover:bg-white/5 transition-colors group">
                                        <td className="px-4 py-3 text-sm">
                                            <div className="flex items-center gap-2">
                                                <span>{format(parseISO(item.display_date), 'dd/MM/yyyy')}</span>
                                                {item.is_paid && (
                                                    <span className="text-xs text-green-500" title="Pago">
                                                        💰
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            <div className="flex flex-col">
                                                <span className="font-medium text-foreground-app">
                                                    {item.supplier_name !== 'N/A' ? item.supplier_name : (item.description || item.title_id || 'N/A')}
                                                </span>
                                                {item.supplier_name !== item.description && item.description && (
                                                    <span className="text-[10px] text-muted-foreground line-clamp-1">
                                                        {item.description}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-medium border border-blue-500/20">
                                                {item.category_description}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-muted-foreground font-mono">
                                            {item.invoice_number || 'S/N'}
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            <span className="text-muted-foreground">{item.project_name}</span>
                                        </td>
                                        <td className="px-4 py-3 text-sm font-semibold text-white">
                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.net_amount)}
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            <span className={`px-2 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase border ${item.status === 'PAGO'
                                                ? 'bg-green-500/10 text-green-500 border-green-500/20'
                                                : item.status === 'ABERTO'
                                                    ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                                                    : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                                                }`}>
                                                {item.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                                        {loading ? 'Carregando...' : 'Nenhum registro encontrado para este período.'}
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
