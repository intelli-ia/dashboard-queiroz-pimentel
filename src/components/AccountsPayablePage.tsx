"use client"

import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchAll } from '@/lib/supabase-utils'
import { format, subDays, parseISO } from 'date-fns'
import { Loader2, ArrowUpDown, ArrowUp, ArrowDown, Search, BarChart3, Banknote } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts'
import GlobalFilterBar from './GlobalFilterBar'
import { useClientContext } from '@/context/ClientContext'
import { normalizeCpfCnpj } from '@/lib/cpf-cnpj-utils'
import type { PageProps, AccountPayable } from '@/types'

type SortField = keyof AccountPayable | 'category_description' | 'project_name_display'
type SortDirection = 'asc' | 'desc' | null

interface MappedAccountPayable extends AccountPayable {
    id: number
    category_description: string
    project_name_display: string
    display_date: string
    installment_label: string
    client_name: string
    client_cpf_cnpj: string
}

// Helper function to format document type
const formatDocumentType = (docType: string | null | undefined): string => {
    if (!docType) return '-'
    if (docType === '9999' || docType === '99999') return 'Outros'
    return docType
}

export default function AccountsPayablePage({
    timeRange,
    setTimeRange,
    customDates,
    setCustomDates,
    selectedProject,
    setSelectedProject,
    projects
}: PageProps) {
    const [payables, setPayables] = useState<MappedAccountPayable[]>([])
    const [loading, setLoading] = useState(true)
    const { getClientName, getClient, loading: clientsLoading } = useClientContext()

    // Sorting state
    const [sortField, setSortField] = useState<SortField | null>('data_vencimento')
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

    // Filter state
    const [filters, setFilters] = useState<Record<string, string>>({
        display_date: '',
        numero_documento: '',
        category_description: '',
        project_name_display: '',
        status_titulo: '',
        document_type: '',
        valor_documento: ''
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

            // Fetch categories for manual join
            const { data: categoriesRaw } = await supabase.from('categories').select('code, description')
            const categoryMap = new Map(categoriesRaw?.map((c: any) => [c.code, c.description]) || [])

            // Project map from props
            const projectMap = new Map(projects.map(p => [p.id, p.name]))

            const resolvedProjectCode = (() => {
                if (!selectedProject) return ''
                const project = projects.find(p => p.id === selectedProject || p.name === selectedProject)
                return project?.id || selectedProject
            })()

            let query = supabase
                .from('accounts_payable')
                .select('*')

            if (resolvedProjectCode) {
                query = query.eq('project_code', resolvedProjectCode)
            }

            // Filter by date range
            query = query
                .gte('data_vencimento', startDate)
                .lte('data_vencimento', endDate)
                .order('data_vencimento', { ascending: false })

            const rawData = await fetchAll<AccountPayable>(query)

            const mappedData: MappedAccountPayable[] = rawData?.map(item => {
                const displayDate = item.data_vencimento || item.data_emissao || ''
                const installmentLabel = `${item.current_installment || 1}/${item.total_installments || 1}`
                const client = getClient(item.codigo_cliente_fornecedor, null)

                return {
                    ...item,
                    id: item.codigo_lancamento_omie,
                    category_description: categoryMap.get(item.category_code || '') || 'N/A',
                    project_name_display: item.project_name || projectMap.get(item.project_code || '') || 'N/A',
                    display_date: displayDate,
                    installment_label: installmentLabel,
                    client_name: client?.nome_fantasia || client?.razao_social || 'N/A',
                    client_cpf_cnpj: client?.cnpj_cpf || '',
                    document_type: formatDocumentType(item.document_type)
                }
            }) || []

            setPayables(mappedData)
        } catch (err) {
            console.error('Error fetching accounts_payable:', err)
        } finally {
            setLoading(false)
        }
    }, [timeRange, customDates, selectedProject, projects, getClient])

    useEffect(() => {
        fetchPayables()
    }, [fetchPayables])

    // Filter and Sort Logic
    const filteredAndSortedPayables = useMemo(() => {
        let result = [...payables]

        // Apply filters
        Object.keys(filters).forEach(key => {
            const searchValue = filters[key]?.trim()
            if (searchValue) {
                result = result.filter(item => {
                    if (key === 'display_date') {
                        const dateStr = item.display_date ? format(parseISO(item.display_date), 'dd/MM/yyyy') : ''
                        return dateStr.includes(searchValue)
                    }

                    // Special handling for client_name: search by name OR CPF/CNPJ
                    if (key === 'client_name') {
                        const nameLower = (item.client_name || '').toLowerCase()
                        const searchLower = searchValue.toLowerCase()
                        // Match by name
                        if (nameLower.includes(searchLower)) return true
                        // Match by CPF/CNPJ (normalized or formatted)
                        const normalizedSearch = normalizeCpfCnpj(searchValue)
                        const normalizedCpfCnpj = normalizeCpfCnpj(item.client_cpf_cnpj)
                        if (normalizedSearch && normalizedCpfCnpj.includes(normalizedSearch)) return true
                        return false
                    }

                    const itemValue = String((item as any)[key] || '').trim()

                    // Dropdown filters
                    if (['category_description', 'project_name_display', 'status_titulo', 'document_type'].includes(key)) {
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
                let aValue = (a as any)[sortField]
                let bValue = (b as any)[sortField]

                if (aValue === bValue) return 0
                if (aValue === null || aValue === undefined) return 1
                if (bValue === null || bValue === undefined) return -1

                if (typeof aValue === 'string') {
                    aValue = aValue.toLowerCase()
                    bValue = bValue.toLowerCase()
                }

                const comparison = aValue > bValue ? 1 : -1
                return sortDirection === 'asc' ? comparison : -comparison
            })
        }

        return result
    }, [payables, filters, sortField, sortDirection])

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

    // Unique options for dropdowns
    const uniqueOptions = useMemo(() => ({
        category_description: Array.from(new Set(payables.map(p => p.category_description).filter(v => v !== 'N/A'))).sort(),
        project_name_display: Array.from(new Set(payables.map(p => p.project_name_display).filter(v => v !== 'N/A'))).sort(),
        status_titulo: Array.from(new Set(payables.map(p => p.status_titulo).filter(Boolean))).sort(),
        document_type: Array.from(new Set(payables.map(p => p.document_type).filter(Boolean))).sort(),
    }), [payables])

    const totals = useMemo(() => {
        return {
            total: filteredAndSortedPayables.reduce((acc, curr) => acc + (Number(curr.valor_documento) || 0), 0),
            liquidado: filteredAndSortedPayables
                .filter(p => p.status_titulo === 'LIQUIDADO' || p.status_titulo === 'PAGO')
                .reduce((acc, curr) => {
                    // Tenta usar valor_pago se disponível, senão usa valor_documento
                    const pago = (curr as any).valor_pago || curr.valor_documento || 0
                    return acc + Number(pago)
                }, 0),
            aberto: filteredAndSortedPayables
                .filter(p => p.status_titulo === 'ABERTO')
                .reduce((acc, curr) => acc + (Number(curr.valor_documento) || 0), 0),
            atrasado: filteredAndSortedPayables
                .filter(p => p.status_titulo === 'ATRASADO')
                .reduce((acc, curr) => acc + (Number(curr.valor_documento) || 0), 0),
        }
    }, [filteredAndSortedPayables])

    const categoryChartData = useMemo(() => {
        // Filter by all fields EXCEPT category_description to keep context in chart
        let chartBase = [...payables]
        Object.keys(filters).forEach(key => {
            if (key === 'category_description') return // Skip category filter
            const searchValue = filters[key]?.trim()
            if (searchValue) {
                chartBase = chartBase.filter(item => {
                    const itemValue = String((item as any)[key] || '').trim()
                    if (['status_titulo', 'document_type', 'project_name_display'].includes(key)) {
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
    }, [payables, filters])

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

    const CHART_COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#f97316']

    return (
        <div className="space-y-4 px-3 md:px-6 py-4 max-w-full overflow-hidden">
            <GlobalFilterBar
                timeRange={timeRange}
                setTimeRange={setTimeRange}
                customDates={customDates}
                setCustomDates={setCustomDates}
                selectedProject={selectedProject}
                setSelectedProject={setSelectedProject}
                projects={projects}
                title="Contas a Pagar"
                subtitle="Gestão de obrigações e pagamentos (Tabela Accounts Payable)"
                loading={loading || clientsLoading}
            />

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                <div className="bg-card-app/40 border border-border-app p-4 md:p-5 rounded-xl md:rounded-2xl backdrop-blur-md relative overflow-hidden group">
                    <div className="relative z-10">
                        <p className="text-muted-foreground text-xs md:text-sm font-medium uppercase tracking-wider">Total por Vencimento</p>
                        <p className="text-2xl md:text-3xl font-bold mt-1 text-white break-words">
                            {formatCurrency(totals.total)}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1 uppercase">Obrigações vigentes</p>
                    </div>
                </div>

                <div className="bg-card-app/40 border border-border-app p-4 md:p-5 rounded-xl md:rounded-2xl backdrop-blur-md relative overflow-hidden group">
                    <div className="relative z-10">
                        <p className="text-muted-foreground text-xs md:text-sm font-medium uppercase tracking-wider">Total Pago (Caixa)</p>
                        <p className="text-2xl md:text-3xl font-bold mt-1 text-green-400 break-words">
                            {formatCurrency(totals.liquidado)}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1 uppercase">Efetivado no período</p>
                    </div>
                </div>

                <div className="bg-card-app/40 border border-border-app p-4 md:p-5 rounded-xl md:rounded-2xl backdrop-blur-md relative overflow-hidden group">
                    <div className="relative z-10">
                        <p className="text-muted-foreground text-xs md:text-sm font-medium uppercase tracking-wider">Pendente (Aberto)</p>
                        <p className="text-2xl md:text-3xl font-bold mt-1 text-yellow-400 break-words">
                            {formatCurrency(totals.aberto)}
                        </p>
                    </div>
                </div>

                <div className="bg-card-app/40 border border-border-app p-4 md:p-5 rounded-xl md:rounded-2xl backdrop-blur-md relative overflow-hidden group">
                    <div className="relative z-10">
                        <p className="text-muted-foreground text-xs md:text-sm font-medium uppercase tracking-wider">Atrasado</p>
                        <p className="text-2xl md:text-3xl font-bold mt-1 text-red-400 break-words">
                            {formatCurrency(totals.atrasado)}
                        </p>
                    </div>
                </div>
            </div>

            {/* Category Chart */}
            {!loading && categoryChartData.length > 0 && (
                <div className="glass rounded-xl p-3 md:p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <BarChart3 className="w-5 h-5 text-primary-app" />
                        <h3 className="text-base md:text-lg font-semibold">Despesas por Categoria</h3>
                    </div>
                    <div className="h-[280px] w-full">
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
                                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(payload[0].value as number)}
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
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="bg-muted-app/30 border-b border-border-app">
                                {[
                                    { id: 'display_date', label: 'Vencimento', width: 'min-w-[100px]' },
                                    { id: 'client_name', label: 'Fornecedor', width: 'min-w-[140px]' },
                                    { id: 'numero_documento', label: 'Nº Documento', width: 'min-w-[120px]' },
                                    { id: 'document_type', label: 'Tipo', width: 'min-w-[90px]' },
                                    { id: 'category_description', label: 'Categoria', width: 'min-w-[120px]' },
                                    { id: 'project_name_display', label: 'Projeto', width: 'min-w-[100px]' },
                                    { id: 'valor_documento', label: 'Valor', width: 'min-w-[110px]' },
                                    { id: 'status_titulo', label: 'Status', width: 'min-w-[90px]' }
                                ].map(col => (
                                    <th key={col.id} className={`px-2 md:px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider ${col.width || ''}`}>
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
                                                {['category_description', 'project_name_display', 'status_titulo', 'document_type'].includes(col.id) ? (
                                                    <select
                                                        value={filters[col.id]}
                                                        onChange={(e) => updateFilter(col.id, e.target.value)}
                                                        className="w-full h-7 px-1.5 bg-background-app/50 border border-border-app/50 rounded-lg text-[10px] focus:outline-none focus:ring-1 focus:ring-primary-app/50 transition-all appearance-none cursor-pointer"
                                                    >
                                                        <option value="">Todos</option>
                                                        {(uniqueOptions[col.id as keyof typeof uniqueOptions] || []).map((option) => (
                                                            option ? <option key={option} value={option}>{option}</option> : null
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <>
                                                        <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/50 group-focus-within:text-primary-app transition-colors" />
                                                        <input
                                                            type="text"
                                                            value={filters[col.id]}
                                                            onChange={(e) => updateFilter(col.id, e.target.value)}
                                                            className="w-full h-7 pl-6 pr-1.5 bg-background-app/50 border border-border-app/50 rounded-lg text-[10px] focus:outline-none focus:ring-1 focus:ring-primary-app/50 transition-all"
                                                            placeholder={col.id === 'client_name' ? 'Nome/CPF...' : 'Filtrar...'}
                                                        />
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-app/50">
                            {filteredAndSortedPayables.length > 0 ? (
                                filteredAndSortedPayables.map((item) => (
                                    <tr key={item.id} className="hover:bg-white/5 transition-colors group">
                                        <td className="px-2 md:px-3 py-2.5 text-xs md:text-sm">
                                            <div className="flex items-center gap-2">
                                                <span className="whitespace-nowrap">{item.display_date ? format(parseISO(item.display_date), 'dd/MM/yyyy') : '-'}</span>
                                            </div>
                                        </td>
                                        <td className="px-2 md:px-3 py-2.5 text-xs md:text-sm">
                                            <span className="truncate max-w-[140px] block font-medium text-white" title={item.client_name}>
                                                {item.client_name}
                                            </span>
                                        </td>
                                        <td className="px-2 md:px-3 py-2.5 text-xs md:text-sm">
                                            <div className="flex flex-col">
                                                <span className="font-mono text-xs">{item.numero_documento || item.numero_documento_fiscal || 'S/N'}</span>
                                                {item.installment_label && (
                                                    <span className="text-[9px] text-primary-app font-bold uppercase tracking-wider">
                                                        Parc. {item.installment_label}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-2 md:px-3 py-2.5 text-xs md:text-sm">
                                            <span className="px-1.5 py-0.5 rounded-full bg-white/5 text-muted-foreground text-[9px] font-medium border border-border-app/50 whitespace-nowrap">
                                                {item.document_type || '-'}
                                            </span>
                                        </td>
                                        <td className="px-2 md:px-3 py-2.5 text-xs md:text-sm">
                                            <span className="px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[9px] font-medium border border-blue-500/20 whitespace-nowrap">
                                                {item.category_description}
                                            </span>
                                        </td>
                                        <td className="px-2 md:px-3 py-2.5 text-xs md:text-sm">
                                            <span className="text-muted-foreground text-xs truncate block max-w-[100px]" title={item.project_name_display}>{item.project_name_display}</span>
                                        </td>
                                        <td className="px-2 md:px-3 py-2.5 text-xs md:text-sm font-semibold text-white">
                                            <span className="whitespace-nowrap">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor_documento || 0)}</span>
                                        </td>
                                        <td className="px-2 md:px-3 py-2.5 text-xs md:text-sm">
                                            <span className={`px-2 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase border ${item.status_titulo === 'LIQUIDADO' || item.status_titulo === 'PAGO'
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
                                    <td colSpan={8} className="px-2 md:px-3 py-12 text-center text-muted-foreground text-sm">
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
