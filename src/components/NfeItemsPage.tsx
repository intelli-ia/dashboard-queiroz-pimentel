"use client"

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
    Filter,
    ChevronDown,
    Calendar,
    FileText,
    TrendingUp,
    ShoppingBag,
    DollarSign,
    Search,
    Loader2,
    ArrowUpDown,
    ArrowUp,
    ArrowDown
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fetchAll } from '@/lib/supabase-utils'
import { format, subDays, parseISO } from 'date-fns'
import { useClientContext } from '@/context/ClientContext'
import type { PageProps, NfeItem, NfeHeader } from '@/types'
import GlobalFilterBar from './GlobalFilterBar'

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
}

const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 4,
    }).format(value);
}

const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return format(parseISO(dateString), 'dd/MM/yyyy')
}

interface MappedNfeItem extends NfeItem {
    supplier_name: string
    date_emissao: string | null
    header_info?: NfeHeader
}

type SortField = keyof MappedNfeItem | string
type SortDirection = 'asc' | 'desc' | null

export default function NfeItemsPage({
    timeRange,
    setTimeRange,
    customDates,
    setCustomDates,
    selectedProject,
    setSelectedProject,
    projects
}: PageProps) {
    const [items, setItems] = useState<MappedNfeItem[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')

    // Sort State
    const [sortField, setSortField] = useState<SortField>('date_emissao')
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

    const fetchItems = useCallback(async () => {
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

            // Query nfe_items joined with nfe_headers
            let query = supabase
                .from('nfe_items')
                .select(`
                    *,
                    nfe_headers!inner (
                        id_recebimento,
                        nome_fantasia,
                        razao_social,
                        data_emissao,
                        project_code,
                        numero_nfe
                    )
                `)
                .gte('nfe_headers.data_emissao', startDate)
                .lte('nfe_headers.data_emissao', endDate);

            if (selectedProject) {
                query = query.eq('nfe_headers.project_code', selectedProject);
            }

            const data = await fetchAll<any>(query)

            if (data) {
                const mappedData = data.map((item: any) => ({
                    ...item,
                    supplier_name: item.nfe_headers.nome_fantasia || item.nfe_headers.razao_social || 'N/A',
                    date_emissao: item.nfe_headers.data_emissao,
                    header_info: item.nfe_headers
                }))
                setItems(mappedData)
            }
        } catch (error) {
            console.error('Error fetching NFE items:', error)
        } finally {
            setLoading(false)
        }
    }, [timeRange, customDates, selectedProject])

    useEffect(() => {
        fetchItems()
    }, [fetchItems])

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortDirection('asc')
        }
    }

    const filteredAndSortedItems = useMemo(() => {
        let result = [...items]

        // Search filter
        if (searchTerm) {
            const lowerSearch = searchTerm.toLowerCase()
            result = result.filter(item =>
                item.descricao_produto?.toLowerCase().includes(lowerSearch) ||
                item.supplier_name.toLowerCase().includes(lowerSearch) ||
                item.codigo_produto?.toLowerCase().includes(lowerSearch)
            )
        }

        // Sorting
        if (sortField && sortDirection) {
            result.sort((a, b) => {
                let aValue: any = (a as any)[sortField]
                let bValue: any = (b as any)[sortField]

                if (aValue == null) return sortDirection === 'asc' ? 1 : -1
                if (bValue == null) return sortDirection === 'asc' ? -1 : 1

                if (typeof aValue === 'string') {
                    const comparison = aValue.localeCompare(bValue)
                    return sortDirection === 'asc' ? comparison : -comparison
                }

                const comparison = aValue > bValue ? 1 : -1
                return sortDirection === 'asc' ? comparison : -comparison
            })
        }

        return result
    }, [items, searchTerm, sortField, sortDirection])

    // KPI Calculations
    const totalSpent = useMemo(() =>
        filteredAndSortedItems.reduce((acc, curr) => acc + (curr.valor_total || 0), 0),
        [filteredAndSortedItems]
    )

    const mostBoughtItem = useMemo(() => {
        if (filteredAndSortedItems.length === 0) return null
        const counts = new Map<string, { desc: string, qty: number }>()
        filteredAndSortedItems.forEach(item => {
            const key = item.descricao_produto || 'S/N'
            const existing = counts.get(key) || { desc: key, qty: 0 }
            counts.set(key, { desc: key, qty: existing.qty + (item.quantidade || 0) })
        })
        return Array.from(counts.values()).reduce((prev, curr) => (prev.qty > curr.qty) ? prev : curr, { desc: '-', qty: 0 })
    }, [filteredAndSortedItems])

    const highestSpendItem = useMemo(() => {
        if (filteredAndSortedItems.length === 0) return null
        const spends = new Map<string, { desc: string, total: number }>()
        filteredAndSortedItems.forEach(item => {
            const key = item.descricao_produto || 'S/N'
            const existing = spends.get(key) || { desc: key, total: 0 }
            spends.set(key, { desc: key, total: existing.total + (item.valor_total || 0) })
        })
        return Array.from(spends.values()).reduce((prev, curr) => (prev.total > curr.total) ? prev : curr, { desc: '-', total: 0 })
    }, [filteredAndSortedItems])

    return (
        <div className="space-y-6 px-4 md:px-8 pb-8">
            <GlobalFilterBar
                timeRange={timeRange}
                setTimeRange={setTimeRange}
                customDates={customDates}
                setCustomDates={setCustomDates}
                selectedProject={selectedProject}
                setSelectedProject={setSelectedProject}
                projects={projects}
                title="Itens de NFE"
                subtitle="Controle e analise detalhada de produtos comprados"
                loading={loading}
            />

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass p-6 rounded-2xl space-y-2 relative overflow-hidden group">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium uppercase tracking-wider text-blue-400">
                        <DollarSign className="w-4 h-4" /> Total Gasto
                    </div>
                    <div className="text-3xl font-bold text-white">{formatCurrency(totalSpent)}</div>
                    <p className="text-sm text-muted-foreground">Soma total dos itens filtrados</p>
                </div>

                <div className="glass p-6 rounded-2xl space-y-2 relative overflow-hidden group">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium uppercase tracking-wider text-green-400">
                        <ShoppingBag className="w-4 h-4" /> Mais Comprado (Volume)
                    </div>
                    <div className="text-xl font-bold text-white truncate" title={mostBoughtItem?.desc}>
                        {mostBoughtItem?.desc || '-'}
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {mostBoughtItem ? `${formatNumber(mostBoughtItem.qty)} unidades` : 'Nenhum dado'}
                    </p>
                </div>

                <div className="glass p-6 rounded-2xl space-y-2 relative overflow-hidden group">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium uppercase tracking-wider text-purple-400">
                        <TrendingUp className="w-4 h-4" /> Maior Gasto (Total)
                    </div>
                    <div className="text-xl font-bold text-white truncate" title={highestSpendItem?.desc}>
                        {highestSpendItem?.desc || '-'}
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {highestSpendItem ? formatCurrency(highestSpendItem.total) : 'Nenhum dado'}
                    </p>
                </div>
            </div>

            {/* Table Area */}
            <div className="glass rounded-2xl overflow-hidden min-h-[400px] relative">
                {loading && (
                    <div className="absolute inset-0 bg-background-app/50 backdrop-blur-sm z-50 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-primary-app animate-spin" />
                    </div>
                )}

                <div className="p-4 border-b border-border-app flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Buscar por produto ou fornecedor..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-muted-app border border-border-app rounded-xl pl-10 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-app transition-all"
                        />
                    </div>
                    <div className="text-sm text-muted-foreground">
                        Exibindo {filteredAndSortedItems.length} itens
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-white/5 text-muted-foreground border-b border-border-app">
                            <tr>
                                <th className="px-6 py-4 font-medium cursor-pointer hover:text-white" onClick={() => handleSort('date_emissao')}>
                                    <div className="flex items-center gap-1">
                                        Data
                                        {sortField === 'date_emissao' && <ChevronDown className={`w-4 h-4 transition-transform ${sortDirection === 'asc' ? 'rotate-180' : ''}`} />}
                                    </div>
                                </th>
                                <th className="px-6 py-4 font-medium cursor-pointer hover:text-white" onClick={() => handleSort('descricao_produto')}>
                                    <div className="flex items-center gap-1">
                                        Produto
                                        {sortField === 'descricao_produto' && <ChevronDown className={`w-4 h-4 transition-transform ${sortDirection === 'asc' ? 'rotate-180' : ''}`} />}
                                    </div>
                                </th>
                                <th className="px-6 py-4 font-medium cursor-pointer hover:text-white" onClick={() => handleSort('supplier_name')}>
                                    <div className="flex items-center gap-1">
                                        Fornecedor / NF
                                        {sortField === 'supplier_name' && <ChevronDown className={`w-4 h-4 transition-transform ${sortDirection === 'asc' ? 'rotate-180' : ''}`} />}
                                    </div>
                                </th>
                                <th className="px-6 py-4 font-medium text-right cursor-pointer hover:text-white" onClick={() => handleSort('quantidade')}>
                                    <div className="flex items-center justify-end gap-1">
                                        Qtd / Un
                                        {sortField === 'quantidade' && <ChevronDown className={`w-4 h-4 transition-transform ${sortDirection === 'asc' ? 'rotate-180' : ''}`} />}
                                    </div>
                                </th>
                                <th className="px-6 py-4 font-medium text-right cursor-pointer hover:text-white" onClick={() => handleSort('preco_unitario')}>
                                    <div className="flex items-center justify-end gap-1">
                                        Preço Un.
                                        {sortField === 'preco_unitario' && <ChevronDown className={`w-4 h-4 transition-transform ${sortDirection === 'asc' ? 'rotate-180' : ''}`} />}
                                    </div>
                                </th>
                                <th className="px-6 py-4 font-medium text-right cursor-pointer hover:text-white" onClick={() => handleSort('valor_total')}>
                                    <div className="flex items-center justify-end gap-1">
                                        Total
                                        {sortField === 'valor_total' && <ChevronDown className={`w-4 h-4 transition-transform ${sortDirection === 'asc' ? 'rotate-180' : ''}`} />}
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-app">
                            {filteredAndSortedItems.length > 0 ? (
                                filteredAndSortedItems.map((item) => (
                                    <tr key={item.id_item} className="hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4 font-medium text-foreground-app whitespace-nowrap">
                                            {formatDate(item.date_emissao)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-white font-medium">{item.descricao_produto}</div>
                                            <div className="text-xs text-muted-foreground">{item.codigo_produto || '-'}</div>
                                        </td>
                                        <td className="px-6 py-4 text-muted-foreground">
                                            <div className="font-medium text-white truncate max-w-[200px]" title={item.supplier_name}>
                                                {item.supplier_name}
                                            </div>
                                            <div className="text-xs">NF: {item.header_info?.numero_nfe || '-'}</div>
                                        </td>
                                        <td className="px-6 py-4 text-right whitespace-nowrap text-muted-foreground">
                                            <span className="text-white font-medium">{formatNumber(item.quantidade || 0)}</span> {item.unidade}
                                        </td>
                                        <td className="px-6 py-4 text-right whitespace-nowrap text-muted-foreground">
                                            {formatCurrency(item.preco_unitario || 0)}
                                        </td>
                                        <td className="px-6 py-4 text-right whitespace-nowrap text-white font-bold">
                                            {formatCurrency(item.valor_total || 0)}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                                        {loading ? 'Carregando itens...' : 'Nenhum item encontrado para os filtros selecionados.'}
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
