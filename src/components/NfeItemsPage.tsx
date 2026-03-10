"use client"

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
    ChevronDown,
    TrendingUp,
    Search,
    Loader2,
    Tag,
    Layers,
    X
} from 'lucide-react'
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { fetchAll } from '@/lib/supabase-utils'
import { format, subDays, parseISO } from 'date-fns'
import type { PageProps, NfeItem } from '@/types'
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
    display_name: string
}

interface GroupedItem {
    key: string
    categoria: string
    total: number
    lineCount: number
    quantity: number
    unidade?: string
}

type SortField = string
type SortDirection = 'asc' | 'desc'

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
    const [selectedCategory, setSelectedCategory] = useState<string>('')
    const [selectedItem, setSelectedItem] = useState<GroupedItem | null>(null)

    // Table sort state
    const [sortField, setSortField] = useState<SortField>('total')
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

            let query = supabase
                .from('itens_nfe')
                .select('*')
                .gte('nfe_emissao', startDate)
                .lte('nfe_emissao', endDate);

            if (selectedProject) {
                query = query.eq('projeto_id', selectedProject);
            }

            const data = await fetchAll<any>(query)

            if (data) {
                const mappedData = data.map((item: any) => ({
                    ...item,
                    display_name: item.nome_normalizado || item.produto_descricao || '',
                    supplier_name: item.fornecedor_nome || item.fornecedor_razao_social || 'N/A',
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

    // Close modal on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setSelectedItem(null)
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])

    const availableCategories = useMemo(() => {
        const cats = new Set<string>()
        items.forEach(item => {
            const cat = item.categoria_normalizado || 'Sem Categoria'
            cats.add(cat)
        })
        return Array.from(cats).sort()
    }, [items])

    // Base filter (search + category selector)
    const baseFiltered = useMemo(() => {
        let result = [...items]
        if (selectedCategory) {
            result = result.filter(item =>
                (item.categoria_normalizado || 'Sem Categoria') === selectedCategory
            )
        }
        if (searchTerm) {
            const lower = searchTerm.toLowerCase()
            result = result.filter(item =>
                item.display_name.toLowerCase().includes(lower) ||
                (item.nome_normalizado || '').toLowerCase().includes(lower) ||
                (item.categoria_normalizado || '').toLowerCase().includes(lower) ||
                item.produto_descricao?.toLowerCase().includes(lower) ||
                item.supplier_name.toLowerCase().includes(lower)
            )
        }
        return result
    }, [items, searchTerm, selectedCategory])

    const grandTotal = useMemo(() =>
        baseFiltered.reduce((acc, cur) => acc + (cur.item_valor_total || 0), 0),
        [baseFiltered]
    )

    // Group by categoria_normalizado — always derived from full items (not filtered) for chart
    const categoryChartData = useMemo(() => {
        const map = new Map<string, number>()
        items.forEach(item => {
            const key = item.categoria_normalizado || 'Sem Categoria'
            map.set(key, (map.get(key) || 0) + (item.item_valor_total || 0))
        })
        return Array.from(map.entries())
            .map(([key, total]) => ({ key, total }))
            .sort((a, b) => b.total - a.total)
    }, [items])

    // Group by nome_normalizado — respects search + category filters
    const groupedByItem = useMemo(() => {
        const map = new Map<string, GroupedItem>()
        baseFiltered.forEach(item => {
            const key = item.nome_normalizado || item.produto_descricao || 'S/N'
            const cat = item.categoria_normalizado || 'Sem Categoria'
            const existing = map.get(key) || { key, categoria: cat, total: 0, lineCount: 0, quantity: 0, unidade: item.produto_unidade_nfe || '' }
            existing.total += item.item_valor_total || 0
            existing.lineCount += 1
            existing.quantity += item.item_qtde_nfe || 0
            if (!existing.unidade && item.produto_unidade_nfe) existing.unidade = item.produto_unidade_nfe
            map.set(key, existing)
        })
        let result = Array.from(map.values())
        result.sort((a, b) => {
            const aVal = (a as any)[sortField] ?? 0
            const bVal = (b as any)[sortField] ?? 0
            if (typeof aVal === 'string') {
                return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
            }
            return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
        })
        return result
    }, [baseFiltered, sortField, sortDirection])

    const handleSort = (field: string) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortDirection('desc')
        }
    }

    const SortIcon = ({ field }: { field: string }) => {
        if (sortField !== field) return <ChevronDown className="w-3.5 h-3.5 opacity-30" />
        return <ChevronDown className={`w-3.5 h-3.5 transition-transform ${sortDirection === 'asc' ? 'rotate-180' : ''} text-primary-app`} />
    }

    // Modal data — derived from all items for the selected item
    const modalData = useMemo(() => {
        if (!selectedItem) return null
        const lines = items.filter(item =>
            (item.nome_normalizado || item.produto_descricao || 'S/N') === selectedItem.key
        )
        const totalGasto = lines.reduce((s, i) => s + (i.item_valor_total || 0), 0)
        const totalQty = lines.reduce((s, i) => s + (i.item_qtde_nfe || 0), 0)
        const avgPrice = totalQty > 0 ? totalGasto / totalQty : 0
        const unidade = lines.find(i => i.produto_unidade_nfe)?.produto_unidade_nfe || ''

        // Group by supplier
        const supplierMap = new Map<string, { total: number; count: number }>()
        lines.forEach(item => {
            const sup = item.supplier_name
            const existing = supplierMap.get(sup) || { total: 0, count: 0 }
            existing.total += item.item_valor_total || 0
            existing.count += 1
            supplierMap.set(sup, existing)
        })
        const suppliers = Array.from(supplierMap.entries())
            .map(([name, v]) => ({ name, total: v.total, count: v.count }))
            .sort((a, b) => b.total - a.total)

        // History sorted by date desc
        const history = [...lines].sort((a, b) => {
            const da = a.nfe_emissao || ''
            const db = b.nfe_emissao || ''
            return db.localeCompare(da)
        })

        return { lines, totalGasto, totalQty, avgPrice, unidade, suppliers, history }
    }, [selectedItem, items])

    const dynamicChartHeight = Math.max(200, categoryChartData.length * 44)

    const topCategoria = categoryChartData[0] ?? null

    const topItem = useMemo(() => {
        if (groupedByItem.length === 0) return null
        return [...groupedByItem].sort((a, b) => b.total - a.total)[0]
    }, [groupedByItem])

    return (
        <div className="space-y-4 px-3 md:px-6 py-4 max-w-full overflow-hidden pb-8">
            <GlobalFilterBar
                timeRange={timeRange}
                setTimeRange={setTimeRange}
                customDates={customDates}
                setCustomDates={setCustomDates}
                selectedProject={selectedProject}
                setSelectedProject={setSelectedProject}
                projects={projects}
                title="Itens de NFE"
                subtitle="Analise gastos por categoria e produto normalizado"
                loading={loading}
            />

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                <div className="glass p-6 rounded-2xl space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-purple-400">
                        <Layers className="w-4 h-4" /> Maior Categoria
                    </div>
                    <div className="text-xl font-bold text-white truncate" title={topCategoria?.key}>
                        {topCategoria?.key || '-'}
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {topCategoria ? formatCurrency(topCategoria.total) : 'Nenhum dado'}
                    </p>
                </div>

                <div className="glass p-6 rounded-2xl space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-green-400">
                        <TrendingUp className="w-4 h-4" /> Maior Item (Gasto)
                    </div>
                    <div className="text-xl font-bold text-white truncate" title={topItem?.key}>
                        {topItem?.key || '-'}
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {topItem ? formatCurrency(topItem.total) : 'Nenhum dado'}
                    </p>
                </div>
            </div>

            {/* Horizontal Bar Chart — Gastos por Categoria */}
            <div className="glass rounded-2xl overflow-hidden relative">
                {loading && (
                    <div className="absolute inset-0 bg-background-app/50 backdrop-blur-sm z-10 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-primary-app animate-spin" />
                    </div>
                )}
                <div className="p-4 border-b border-border-app">
                    <h3 className="text-base font-semibold text-white">Gastos por Categoria</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Clique numa barra para filtrar a tabela abaixo</p>
                </div>
                <div className="p-4 max-h-[360px] overflow-y-auto">
                    {categoryChartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={dynamicChartHeight}>
                            <BarChart
                                data={categoryChartData}
                                layout="vertical"
                                margin={{ top: 5, right: 130, left: 10, bottom: 5 }}
                            >
                                <XAxis type="number" hide />
                                <YAxis
                                    type="category"
                                    dataKey="key"
                                    width={160}
                                    tick={{ fill: '#9ca3af', fontSize: 12 }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <Tooltip
                                    formatter={(val: number) => [formatCurrency(val), 'Total']}
                                    contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                                    labelStyle={{ color: '#fff' }}
                                    itemStyle={{ color: '#9ca3af' }}
                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                />
                                <Bar
                                    dataKey="total"
                                    radius={[0, 4, 4, 0]}
                                    barSize={22}
                                    fill="#3b82f6"
                                    style={{ cursor: 'pointer' }}
                                    onClick={(data: any) => setSelectedCategory(
                                        selectedCategory === data.key ? '' : data.key
                                    )}
                                >
                                    <LabelList
                                        dataKey="total"
                                        position="right"
                                        style={{ fill: '#fff', fontSize: 11, fontWeight: 'bold' }}
                                        formatter={(val: number) => formatCurrency(val)}
                                    />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                            {loading ? 'Carregando...' : 'Nenhum dado para o período selecionado'}
                        </div>
                    )}
                </div>
            </div>

            {/* Items Table */}
            <div className="glass rounded-2xl overflow-hidden relative">
                {loading && (
                    <div className="absolute inset-0 bg-background-app/50 backdrop-blur-sm z-10 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-primary-app animate-spin" />
                    </div>
                )}

                {/* Toolbar */}
                <div className="p-4 border-b border-border-app flex flex-col gap-3">
                    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                        {/* Search */}
                        <div className="relative w-full sm:w-80">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Buscar por item, categoria ou fornecedor..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-muted-app border border-border-app rounded-xl pl-10 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-app transition-all"
                            />
                        </div>

                        <div className="flex items-center gap-3">
                            <select
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                className="bg-muted-app border border-border-app rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-app transition-all text-foreground-app"
                            >
                                <option value="">Todas as categorias</option>
                                {availableCategories.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground whitespace-nowrap">
                                <span>{groupedByItem.length} itens</span>
                                <span className="text-white font-semibold">{formatCurrency(grandTotal)}</span>
                            </div>
                        </div>
                    </div>

                    {selectedCategory && (
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Filtrado por:</span>
                            <button
                                onClick={() => setSelectedCategory('')}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary-app/20 text-primary-app border border-primary-app/30 hover:bg-primary-app/30 transition-colors"
                            >
                                <Tag className="w-3 h-3" />
                                {selectedCategory}
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    )}
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-white/5 text-muted-foreground border-b border-border-app">
                            <tr>
                                <th className="px-6 py-4 font-medium cursor-pointer hover:text-white" onClick={() => handleSort('key')}>
                                    <div className="flex items-center gap-1">Nome Normalizado <SortIcon field="key" /></div>
                                </th>
                                <th className="px-6 py-4 font-medium cursor-pointer hover:text-white" onClick={() => handleSort('categoria')}>
                                    <div className="flex items-center gap-1">Categoria <SortIcon field="categoria" /></div>
                                </th>
                                <th className="px-6 py-4 font-medium text-right cursor-pointer hover:text-white" onClick={() => handleSort('total')}>
                                    <div className="flex items-center justify-end gap-1">Total Gasto <SortIcon field="total" /></div>
                                </th>
                                <th className="px-6 py-4 font-medium text-right cursor-pointer hover:text-white" onClick={() => handleSort('lineCount')}>
                                    <div className="flex items-center justify-end gap-1">Compras <SortIcon field="lineCount" /></div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-app">
                            {groupedByItem.length > 0 ? groupedByItem.map((row) => (
                                <tr
                                    key={row.key}
                                    className="hover:bg-white/5 transition-colors cursor-pointer"
                                    onClick={() => setSelectedItem(row)}
                                >
                                    <td className="px-6 py-4">
                                        <span className="text-white font-medium">{row.key}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-white/10 text-muted-foreground">
                                            {row.categoria}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right text-white font-bold">{formatCurrency(row.total)}</td>
                                    <td className="px-6 py-4 text-right text-muted-foreground">{row.lineCount}</td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                                        {loading ? 'Carregando...' : 'Nenhum item encontrado.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Detail Modal */}
            {selectedItem && modalData && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    onClick={(e) => { if (e.target === e.currentTarget) setSelectedItem(null) }}
                >
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

                    {/* Modal card */}
                    <div className="relative z-10 w-full max-w-5xl max-h-[85vh] overflow-y-auto bg-[#0f0f1a] border border-border-app rounded-2xl shadow-2xl">
                        {/* Header */}
                        <div className="sticky top-0 bg-[#0f0f1a] border-b border-border-app p-6 flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                                <h2 className="text-xl font-bold text-white truncate">{selectedItem.key}</h2>
                                <div className="mt-1">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-white/10 text-muted-foreground">
                                        <Tag className="w-3 h-3" />
                                        {selectedItem.categoria}
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedItem(null)}
                                className="flex-shrink-0 p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* KPI Strip */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="bg-white/5 rounded-xl p-4 space-y-1">
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Gasto</p>
                                    <p className="text-lg font-bold text-white">{formatCurrency(modalData.totalGasto)}</p>
                                </div>
                                <div className="bg-white/5 rounded-xl p-4 space-y-1">
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Quantidade</p>
                                    <p className="text-lg font-bold text-white">
                                        {formatNumber(modalData.totalQty)}
                                        {modalData.unidade && <span className="text-sm text-muted-foreground ml-1">{modalData.unidade}</span>}
                                    </p>
                                </div>
                                <div className="bg-white/5 rounded-xl p-4 space-y-1">
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Preço Médio</p>
                                    <p className="text-lg font-bold text-white">{formatCurrency(modalData.avgPrice)}</p>
                                </div>
                                <div className="bg-white/5 rounded-xl p-4 space-y-1">
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Nº Compras</p>
                                    <p className="text-lg font-bold text-white">{modalData.lines.length}</p>
                                </div>
                            </div>

                            {/* Fornecedores */}
                            <div>
                                <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">Por Fornecedor</h3>
                                <div className="rounded-xl overflow-hidden border border-border-app">
                                    <table className="w-full text-sm">
                                        <thead className="bg-white/5 text-muted-foreground border-b border-border-app">
                                            <tr>
                                                <th className="px-4 py-3 font-medium text-left">Fornecedor</th>
                                                <th className="px-4 py-3 font-medium text-right">Total Pago</th>
                                                <th className="px-4 py-3 font-medium text-right">Compras</th>
                                                <th className="px-4 py-3 font-medium text-right">% do Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border-app">
                                            {modalData.suppliers.map((sup) => (
                                                <tr key={sup.name} className="hover:bg-white/5">
                                                    <td className="px-4 py-3 text-white">{sup.name}</td>
                                                    <td className="px-4 py-3 text-right text-white font-semibold">{formatCurrency(sup.total)}</td>
                                                    <td className="px-4 py-3 text-right text-muted-foreground">{sup.count}</td>
                                                    <td className="px-4 py-3 text-right text-muted-foreground">
                                                        {modalData.totalGasto > 0 ? ((sup.total / modalData.totalGasto) * 100).toFixed(1) : '0.0'}%
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Histórico de Compras */}
                            <div>
                                <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">Histórico de Compras</h3>
                                <div className="rounded-xl overflow-hidden border border-border-app">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-white/5 text-muted-foreground border-b border-border-app">
                                                <tr>
                                                    <th className="px-4 py-3 font-medium text-left">Data</th>
                                                    <th className="px-4 py-3 font-medium text-left">NF</th>
                                                    <th className="px-4 py-3 font-medium text-left">Fornecedor</th>
                                                    <th className="px-4 py-3 font-medium text-right">Qtd</th>
                                                    <th className="px-4 py-3 font-medium text-right">Un.</th>
                                                    <th className="px-4 py-3 font-medium text-right">Preço Un.</th>
                                                    <th className="px-4 py-3 font-medium text-right">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border-app">
                                                {modalData.history.map((item) => (
                                                    <tr key={item.id} className="hover:bg-white/5">
                                                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                                                            {formatDate(item.nfe_emissao)}
                                                        </td>
                                                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                                                            {item.nfe_numero || '-'}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="text-white max-w-[160px] truncate" title={item.supplier_name}>
                                                                {item.supplier_name}
                                                            </div>
                                                            {item.produto_descricao && item.nome_normalizado && item.produto_descricao !== item.nome_normalizado && (
                                                                <div className="text-xs text-muted-foreground truncate max-w-[160px]" title={item.produto_descricao}>
                                                                    {item.produto_descricao}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-white whitespace-nowrap">
                                                            {formatNumber(item.item_qtde_nfe || 0)}
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-muted-foreground whitespace-nowrap">
                                                            {item.produto_unidade_nfe || '-'}
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-muted-foreground whitespace-nowrap">
                                                            {formatCurrency(item.item_preco_unitario || 0)}
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-white font-semibold whitespace-nowrap">
                                                            {formatCurrency(item.item_valor_total || 0)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
