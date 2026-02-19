"use client"

import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchAll } from '@/lib/supabase-utils'
import { format, subDays, parseISO } from 'date-fns'
import { Loader2, ArrowUpDown, ArrowUp, ArrowDown, Search, BarChart3 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts'
import GlobalFilterBar from './GlobalFilterBar'
import { useClientContext } from '@/context/ClientContext'
import { formatCpfCnpj } from '@/lib/cpf-cnpj-utils'
import type { PageProps as BasePageProps, FinancialMovement } from '@/types'

interface PageProps extends BasePageProps {
    title: string
    documentTypes?: string[]
    fetchAllTypes?: boolean
    includeKeywords?: string[]
}

type SortField = 'display_date' | 'client_name' | 'numero_documento' | 'tipo_movimento' | 'direcao' | 'category_description' | 'project_name' | 'valor_documento' | 'status_titulo'
type SortDirection = 'asc' | 'desc' | null

interface MappedMovement {
    id: number
    numero_documento: string | null
    display_date: string
    cpf_cnpj_cliente: string | null
    codigo_cliente: number | null
    client_name: string
    is_paid: boolean
    status_titulo: string | null
    valor_documento: number
    project_name: string
    category_description: string
    installment_label: string
    current_installment: number
    tipo_movimento: string
    direcao: string
    is_efetivado: boolean
    origem_descricao: string
}

export default function GenericFinancialPage({ title, documentTypes, fetchAllTypes = false, timeRange, setTimeRange, customDates, setCustomDates, selectedProject, setSelectedProject, projects }: PageProps) {
    const [movements, setMovements] = useState<MappedMovement[]>([])
    const [loading, setLoading] = useState(true)
    const { getClientName, loading: clientsLoading } = useClientContext()

    // Sorting state
    const [sortField, setSortField] = useState<SortField | null>('display_date')
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

    // Filter state
    const [filters, setFilters] = useState<Record<string, string>>({
        display_date: '',
        client_name: '',
        numero_documento: '',
        tipo_movimento: '',
        direcao: '',
        category_description: '',
        project_name: '',
        valor_documento: '',
        status_titulo: ''
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

            // 0. Fetch Categories (Manual Join)
            const { data: categoriesRaw } = await supabase.from('categories').select('code, description')
            const categoryMap = new Map(categoriesRaw?.map((c: any) => [c.code, c.description]) || [])

            // Map Projects from props
            const projectMap = new Map(projects.map(p => [p.id, p.name]))

            const resolvedProjectCode = (() => {
                if (!selectedProject) return ''
                const project = projects.find(p => p.id === selectedProject || p.name === selectedProject)
                return project?.id || selectedProject
            })()

            // Query all financial movements
            let query = supabase
                .from('financial_movements')
                .select(`
                    codigo_titulo,
                    numero_titulo,
                    numero_documento_fiscal,
                    cpf_cnpj_cliente,
                    codigo_cliente,
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
                    valor_pago,
                    document_type,
                    natureza,
                    grupo,
                    tipo_movimento,
                    direcao,
                    is_efetivado,
                    origem_descricao
                `)

            // Add project filter if selected
            if (resolvedProjectCode) {
                query = query.eq('project_code', resolvedProjectCode)
            }

            // Filter by document types if not fetching all
            if (!fetchAllTypes && documentTypes && documentTypes.length > 0) {
                query = query.in('document_type', documentTypes)
                // For non-general tabs, we usually want Saidas (Expenditures)
                // unless it's the Receipts tab (which uses a different component)
                if (title !== 'Movimentos Financeiros') {
                    query = query.eq('natureza', 'S')
                }
            }

            // Unify logic for Movimentos Financeiros to match Dashboard Payments
            if (title === 'Movimentos Financeiros') {
                query = query
                    .eq('direcao', 'SAIDA')
                    .eq('is_efetivado', true)
                    .not('data_pagamento', 'is', null)
            }

            query = query
                .gte('data_pagamento', startDate)
                .lte('data_pagamento', endDate)
                .order('data_pagamento', { ascending: false })

            const rawData = await fetchAll<FinancialMovement>(query)

            const mappedData: MappedMovement[] = rawData?.map(item => {
                const isPaid = item.liquidado || item.status === 'PAGO' || item.status === 'LIQUIDADO'
                const displayDate = item.data_pagamento || item.data_vencimento || item.data_emissao || ''

                // Build installment label
                const installmentLabel = `${item.current_installment || 1}/${item.total_installments || 1}`

                return {
                    id: item.codigo_titulo,
                    numero_documento: item.numero_titulo || item.numero_documento_fiscal,
                    display_date: displayDate,
                    cpf_cnpj_cliente: item.cpf_cnpj_cliente,
                    codigo_cliente: item.codigo_cliente,
                    client_name: getClientName(item.codigo_cliente, item.cpf_cnpj_cliente),
                    is_paid: isPaid,
                    status_titulo: item.status,
                    valor_documento: Number(item.valor_pago || item.valor_liquido || item.valor_titulo) || 0,
                    project_name: projectMap.get(item.project_code || '') || 'N/A',
                    category_description: categoryMap.get(item.category_code || '') || 'N/A',
                    installment_label: installmentLabel,
                    current_installment: item.current_installment || 1,
                    tipo_movimento: item.tipo_movimento || 'N/A',
                    direcao: item.direcao || 'N/A',
                    is_efetivado: item.is_efetivado || false,
                    origem_descricao: item.origem_descricao || 'N/A'
                }
            }) || []

            setMovements(mappedData)
        } catch (err) {
            console.error(`Error fetching ${title}:`, err)
        } finally {
            setLoading(false)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [timeRange, customDates, selectedProject, title, fetchAllTypes, JSON.stringify(documentTypes), projects, getClientName])

    useEffect(() => {
        fetchMovements()
    }, [fetchMovements])

    // Filter and Sort Logic
    const filteredMovements = useMemo(() => {
        let result = [...movements]

        // Apply filters
        Object.keys(filters).forEach(key => {
            const searchValue = filters[key]?.trim()
            if (searchValue) {
                result = result.filter(item => {
                    const itemValue = String((item as any)[key] || '').trim()

                    // Use exact match for dropdown filters, partial match for text inputs (CNPJ/CPF, Nº Documento, Valor, etc)
                    if (['tipo_movimento', 'direcao', 'category_description', 'project_name', 'status_titulo'].includes(key)) {
                        return itemValue === searchValue
                    } else {
                        return itemValue.toLowerCase().includes(searchValue.toLowerCase())
                    }
                })
            }
        })

        // Apply sorting
        if (sortField && sortDirection) {
            result.sort((a, b) => {
                const aValue = (a as any)[sortField]
                const bValue = (b as any)[sortField]

                if (aValue === bValue) {
                    // Secondary sort by installment number if dates are equal
                    if (sortField === 'display_date') {
                        return (a.current_installment - b.current_installment) * (sortDirection === 'asc' ? 1 : -1)
                    }
                    return 0
                }
                const comparison = (aValue as string | number) > (bValue as string | number) ? 1 : -1
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

    // Generate unique options for dropdown filters
    const uniqueOptions = useMemo(() => {
        return {
            tipo_movimento: Array.from(new Set(movements.map(m => m.tipo_movimento).filter(Boolean))).sort(),
            direcao: Array.from(new Set(movements.map(m => m.direcao).filter(Boolean))).sort(),
            category_description: Array.from(new Set(movements.map(m => m.category_description).filter(v => v !== 'N/A'))).sort(),
            project_name: Array.from(new Set(movements.map(m => m.project_name).filter(v => v !== 'N/A'))).sort(),
            status_titulo: Array.from(new Set(movements.map(m => m.status_titulo).filter(Boolean))).sort()
        }
    }, [movements])

    const totals = useMemo(() => {
        const total = filteredMovements.reduce((acc, curr) => acc + curr.valor_documento, 0)

        // Calculate monthly average
        const monthlyTotals = new Map<string, number>()
        filteredMovements.forEach(m => {
            const date = m.display_date || ''
            if (date) {
                const monthKey = date.substring(0, 7)
                monthlyTotals.set(monthKey, (monthlyTotals.get(monthKey) || 0) + m.valor_documento)
            }
        })

        const totalMonths = monthlyTotals.size
        const mediaMensal = totalMonths > 0 ? total / totalMonths : 0

        return {
            total,
            mediaMensal
        }
    }, [filteredMovements])

    const CHART_COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#f97316']

    const categoryChartData = useMemo(() => {
        // Filter by all fields EXCEPT category_description to keep context in chart
        let chartBase = [...movements]
        Object.keys(filters).forEach(key => {
            if (key === 'category_description') return // Skip category filter
            const searchValue = filters[key]?.trim()
            if (searchValue) {
                chartBase = chartBase.filter(item => {
                    const itemValue = String((item as any)[key] || '').trim()
                    if (['tipo_movimento', 'direcao', 'project_name', 'status_titulo'].includes(key)) {
                        return itemValue === searchValue
                    } else {
                        return itemValue.toLowerCase().includes(searchValue.toLowerCase())
                    }
                })
            }
        })

        const categoryTotals = new Map<string, number>()
        chartBase.forEach(item => {
            const cat = item.category_description || 'Sem Categoria'
            categoryTotals.set(cat, (categoryTotals.get(cat) || 0) + (Number(item.valor_documento) || 0))
        })
        return Array.from(categoryTotals, ([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10)
    }, [movements, filters])

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value)
    }

    const formatCompactBRL = (value: number) => {
        if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1).replace('.', ',')}M`
        if (value >= 1000) return `R$ ${(value / 1000).toFixed(0)}k`
        return `R$ ${value}`
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
                loading={loading || clientsLoading}
            />

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-card-app/40 border border-border-app p-6 rounded-2xl backdrop-blur-md relative overflow-hidden group">
                    <div className="relative z-10">
                        <p className="text-muted-foreground text-sm font-medium uppercase tracking-wider">Total de Pagamentos</p>
                        <p className="text-3xl font-bold mt-1 text-white">
                            {formatCurrency(totals.total)}
                        </p>
                        <p className="text-md text-muted-foreground mt-1">Saídas efetivadas no período</p>
                    </div>
                </div>

                <div className="bg-card-app/40 border border-border-app p-6 rounded-2xl backdrop-blur-md relative overflow-hidden group">
                    <div className="relative z-10">
                        <p className="text-muted-foreground text-sm font-medium uppercase tracking-wider">Média Mensal</p>
                        <p className="text-3xl font-bold mt-1 text-orange-400">
                            {formatCurrency(totals.mediaMensal)}
                        </p>
                        <p className="text-md text-muted-foreground mt-1">Média de pagamentos por mês</p>
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
                            <BarChart data={categoryChartData} margin={{ top: 40, right: 10, left: 10, bottom: 60 }}>
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
                                    tickFormatter={formatCompactBRL}
                                    width={70}
                                    domain={[0, (dataMax: number | string) => (typeof dataMax === 'number' ? dataMax * 1.15 : dataMax)]}
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
                                    {categoryChartData.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                                            fillOpacity={!filters.category_description || filters.category_description === entry.name ? 1 : 0.3}
                                        />
                                    ))}
                                    <LabelList
                                        dataKey="value"
                                        position="top"
                                        formatter={formatCompactBRL}
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
                                    { id: 'client_name', label: 'Cliente', width: 'w-56' },
                                    { id: 'numero_documento', label: 'Nº Documento', width: 'w-40' },
                                    { id: 'tipo_movimento', label: 'Tipo', width: 'w-44' },
                                    { id: 'direcao', label: 'Direção', width: 'w-32' },
                                    { id: 'category_description', label: 'Categoria' },
                                    { id: 'project_name', label: 'Projeto' },
                                    { id: 'valor_documento', label: 'Valor', width: 'w-36' },
                                    { id: 'status_titulo', label: 'Status', width: 'w-32' }
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
                                                {['tipo_movimento', 'direcao', 'category_description', 'project_name', 'status_titulo'].includes(col.id) ? (
                                                    <select
                                                        value={filters[col.id]}
                                                        onChange={(e) => updateFilter(col.id, e.target.value)}
                                                        className="w-full h-8 px-2 bg-background-app/50 border border-border-app/50 rounded-lg text-[11px] focus:outline-none focus:ring-1 focus:ring-primary-app/50 transition-all appearance-none cursor-pointer"
                                                    >
                                                        <option value="">Todos</option>
                                                        {(uniqueOptions[col.id as keyof typeof uniqueOptions] || []).map((option) => (
                                                            option ? <option key={option} value={option}>{option}</option> : null
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <>
                                                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/50 group-focus-within:text-primary-app transition-colors" />
                                                        <input
                                                            type="text"
                                                            value={filters[col.id]}
                                                            onChange={(e) => updateFilter(col.id, e.target.value)}
                                                            className="w-full h-8 pl-7 pr-2 bg-background-app/50 border border-border-app/50 rounded-lg text-[11px] focus:outline-none focus:ring-1 focus:ring-primary-app/50 transition-all"
                                                            placeholder="Filtrar..."
                                                        />
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody
                            key={JSON.stringify(filters)}
                            className="divide-y divide-border-app/50"
                        >
                            {filteredMovements.length > 0 ? (
                                filteredMovements.map((item) => (
                                    <tr key={item.id} className="hover:bg-white/5 transition-colors group">
                                        <td className="px-4 py-3 text-sm">
                                            <div className="flex items-center gap-2">
                                                <span>{item.display_date ? format(parseISO(item.display_date), 'dd/MM/yyyy') : '-'}</span>
                                                {item.is_paid && (
                                                    <span className="text-xs text-green-500" title="Pago">
                                                        💰
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            <div className="flex flex-col">
                                                <span className="font-medium text-white truncate max-w-[200px]" title={item.client_name}>
                                                    {item.client_name}
                                                </span>
                                                {item.cpf_cnpj_cliente && (
                                                    <span className="text-[10px] text-muted-foreground font-mono">
                                                        {formatCpfCnpj(item.cpf_cnpj_cliente)}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            <div className="flex flex-col">
                                                <span className="font-mono">{item.numero_documento || 'S/N'}</span>
                                                {item.installment_label && (
                                                    <span className="text-[10px] text-primary-app font-bold uppercase tracking-wider">
                                                        {item.installment_label}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            <div className="flex items-center gap-2">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${item.is_efetivado
                                                    ? 'bg-green-500/10 text-green-400 border-green-500/20'
                                                    : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                                                    }`}>
                                                    {item.tipo_movimento}
                                                </span>
                                                {item.is_efetivado && (
                                                    <span className="text-green-400" title="Movimento Efetivado">✓</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            <span className={`px-2 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase border ${item.direcao === 'ENTRADA'
                                                ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                                : 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                                                }`}>
                                                {item.direcao === 'ENTRADA' ? '↓ ENTRADA' : '↑ SAIDA'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-medium border border-blue-500/20">
                                                {item.category_description}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            <span className="text-muted-foreground">{item.project_name}</span>
                                        </td>
                                        <td className="px-4 py-3 text-sm font-semibold text-white">
                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor_documento)}
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            <span className={`px-2 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase border ${item.status_titulo === 'LIQUIDADO'
                                                ? 'bg-green-500/10 text-green-500 border-green-500/20'
                                                : item.status_titulo === 'ABERTO'
                                                    ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                                                    : item.status_titulo === 'ATRASADO'
                                                        ? 'bg-red-500/10 text-red-500 border-red-500/20'
                                                        : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                                                }`}>
                                                {item.status_titulo || 'N/A'}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
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
