"use client"

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
    Search,
    Filter,
    ChevronDown,
    Calendar,
    Package,
    Tag,
    RefreshCcw,
    X
} from 'lucide-react'
import { useRef } from 'react'
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { fetchAll } from '@/lib/supabase-utils'
import { format, subDays, parseISO } from 'date-fns'
import type { PageProps, FinancialTransaction, Department, Category, AggregatedItem, SortConfig } from '@/types'

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
}

export default function ItemsPage({ timeRange, setTimeRange, customDates, setCustomDates }: PageProps) {
    const [items, setItems] = useState<AggregatedItem[]>([])
    const [loading, setLoading] = useState(true)
    const [distinctProducts, setDistinctProducts] = useState<string[]>([])
    const [categories, setCategories] = useState<Category[]>([])
    const [departments, setDepartments] = useState<Department[]>([])

    // Filters
    const [productSearchTerm, setProductSearchTerm] = useState('')
    const [selectedProduct, setSelectedProduct] = useState('')
    const [selectedCategory, setSelectedCategory] = useState('')
    const [selectedDepartment, setSelectedDepartment] = useState('')
    const [customSearch, setCustomSearch] = useState('')

    // Sort State
    const [sortConfig, setSortConfig] = useState<SortConfig>({
        key: 'total_value',
        direction: 'desc'
    })

    // Table Column Filters
    const [columnFilters, setColumnFilters] = useState<Record<string, string>>({})
    const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(null)
    const filterDropdownRef = useRef<HTMLDivElement>(null)

    const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false)
    const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false)
    const [isDepartmentDropdownOpen, setIsDepartmentDropdownOpen] = useState(false)

    // Refs for outside click detection
    const productDropdownRef = useRef<HTMLDivElement>(null)
    const categoryDropdownRef = useRef<HTMLDivElement>(null)
    const departmentDropdownRef = useRef<HTMLDivElement>(null)

    // Helper to close all dropdowns
    const closeAllDropdowns = useCallback(() => {
        setIsProductDropdownOpen(false)
        setIsCategoryDropdownOpen(false)
        setIsDepartmentDropdownOpen(false)
        setActiveFilterColumn(null)
    }, [])

    // Click outside listener
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                productDropdownRef.current && !productDropdownRef.current.contains(event.target as Node) &&
                categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node) &&
                departmentDropdownRef.current && !departmentDropdownRef.current.contains(event.target as Node) &&
                filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)
            ) {
                closeAllDropdowns()
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [closeAllDropdowns])

    const fetchInitialData = useCallback(async () => {
        try {
            // Fetch distinct product names
            const { data: products } = await supabase
                .from('purchase_items')
                .select('product_description')
                .order('product_description')

            if (products) {
                const unique = Array.from(new Set(products.map(p => p.product_description).filter(Boolean)))
                setDistinctProducts(unique as string[])
            }

            // Fetch categories
            const { data: cats } = await supabase
                .from('categories')
                .select('*')
                .order('description')

            if (cats) setCategories(cats.map(c => ({
                ...c,
                id: c.code,
                category_code: c.code,
                category_description: c.description || c.standard_description
            })))

            // Fetch projects
            const { data: projs } = await supabase
                .from('projects')
                .select('*')
                .order('name')

            if (projs) setDepartments(projs.map(p => ({
                id: p.code,
                name: p.name,
                omie_department_id: p.code,
                is_active: true
            })))
        } catch (err) {
            console.error('Error fetching initial data:', err)
        }
    }, [])

    const fetchFilteredData = useCallback(async () => {
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
            } else {
                startDate = format(subDays(new Date(), parseInt(timeRange)), 'yyyy-MM-dd');
            }

            let query = supabase
                .from('purchase_items')
                .select(`
                    *,
                    purchases!inner (
                        issue_date,
                        project_id,
                        invoice_key,
                        purchase_category,
                        projects (code, name),
                        categories (code, description, standard_description)
                    )
                `)
                .gte('purchases.issue_date', startDate)
                .lte('purchases.issue_date', endDate)

            // Custom search takes precedence over specific product selection
            if (customSearch) {
                query = query.ilike('product_description', `%${customSearch}%`)
            } else if (selectedProduct) {
                query = query.eq('product_description', selectedProduct)
            }

            if (selectedCategory) {
                query = query.eq('purchases.purchase_category', selectedCategory)
            }

            if (selectedDepartment) {
                query = query.eq('purchases.project_id', selectedDepartment)
            }

            const data = await fetchAll<any>(query.order('issue_date', { foreignTable: 'purchases', ascending: false }))

            console.log('ItemsPage raw data:', data)

            // Aggregate data by Product + Project
            if (data) {
                const aggregated = data.reduce((acc: AggregatedItem[], item: any) => {
                    const invoice = item.purchases
                    const productDesc = item.product_description || 'Sem descrição'
                    const projectId = invoice?.project_id || 'no_proj'
                    const key = `${productDesc}_${projectId}`
                    const existing = acc.find(a => a.key === key)

                    const itemValue = Number(item.total_item_value) || 0
                    const itemQty = Number(item.quantity) || 0
                    const issueDate = invoice?.issue_date

                    if (existing) {
                        existing.total_value += itemValue
                        existing.quantity += itemQty
                        existing.occurrences += 1
                        if (issueDate && issueDate > existing.latest_date) {
                            existing.latest_date = issueDate
                        }
                        if (invoice?.invoice_key && !existing.document_numbers.includes(invoice.invoice_key)) {
                            existing.document_numbers.push(invoice.invoice_key)
                        }
                    } else {
                        acc.push({
                            key,
                            product_description: productDesc,
                            department_id: projectId,
                            department_name: invoice?.projects?.name || '-',
                            category_description: invoice?.categories?.description || invoice?.categories?.standard_description || 'Outros',
                            total_value: itemValue,
                            quantity: itemQty,
                            occurrences: 1,
                            latest_date: issueDate || '',
                            unit_value: itemQty > 0 ? (itemValue / itemQty) : 0,
                            document_numbers: invoice?.invoice_key ? [invoice.invoice_key] : []
                        })
                    }

                    return acc
                }, [])

                // Sort by total value descending
                const sortedData = [...aggregated]
                const { key, direction } = sortConfig

                sortedData.sort((a, b) => {
                    const aValue = a[key as keyof AggregatedItem]
                    const bValue = b[key as keyof AggregatedItem]

                    const aStr = typeof aValue === 'string' ? aValue.toLowerCase() : aValue
                    const bStr = typeof bValue === 'string' ? bValue.toLowerCase() : bValue

                    if (aStr < bStr) return direction === 'asc' ? -1 : 1
                    if (aStr > bStr) return direction === 'asc' ? 1 : -1
                    return 0
                })

                setItems(sortedData)
            } else {
                setItems([])
            }
        } catch (err) {
            console.error('Error filtering data:', err)
        } finally {
            setLoading(false)
        }
    }, [selectedProduct, selectedCategory, selectedDepartment, customSearch, timeRange, customDates, sortConfig])

    useEffect(() => {
        fetchInitialData()
    }, [fetchInitialData])

    useEffect(() => {
        fetchFilteredData()
    }, [fetchFilteredData])

    const handleSort = (key: string) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
        }))
    }

    useEffect(() => {
        // Re-sort current items when sortConfig changes
        if (items.length > 0) {
            const sorted = [...items].sort((a, b) => {
                const aValue = a[sortConfig.key as keyof AggregatedItem]
                const bValue = b[sortConfig.key as keyof AggregatedItem]

                const aStr = typeof aValue === 'string' ? aValue.toLowerCase() : aValue
                const bStr = typeof bValue === 'string' ? bValue.toLowerCase() : bValue

                if (aStr < bStr) return sortConfig.direction === 'asc' ? -1 : 1
                if (aStr > bStr) return sortConfig.direction === 'asc' ? 1 : -1
                return 0
            })
            setItems(sorted)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sortConfig])

    const filteredDropdownProducts = distinctProducts.filter(p =>
        p.toLowerCase().includes(productSearchTerm.toLowerCase())
    )

    // Filter items by column filters
    const filteredItems = useMemo(() => {
        return items.filter(item => {
            return Object.entries(columnFilters).every(([key, filterValue]) => {
                if (!filterValue) return true
                const itemValue = key === 'document_numbers'
                    ? item.document_numbers.join(', ')
                    : String(item[key as keyof AggregatedItem] || '')
                return itemValue.toLowerCase().includes(filterValue.toLowerCase())
            })
        })
    }, [items, columnFilters])

    // Aggregate data by category for the chart
    const categoryChartData = useMemo(() => {
        const categoryTotals = filteredItems.reduce((acc, item) => {
            const category = item.category_description || 'Outros'
            acc[category] = (acc[category] || 0) + item.total_value
            return acc
        }, {} as Record<string, number>)

        return Object.entries(categoryTotals)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 8) // Limit to top 8 categories
    }, [filteredItems])

    // Handle column filter change
    const handleColumnFilter = (column: string, value: string) => {
        setColumnFilters(prev => ({
            ...prev,
            [column]: value
        }))
    }

    // Clear column filter
    const clearColumnFilter = (column: string) => {
        setColumnFilters(prev => {
            const newFilters = { ...prev }
            delete newFilters[column]
            return newFilters
        })
        setActiveFilterColumn(null)
    }

    const CHART_COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#f97316']

    return (
        <div className="p-6 md:p-8 space-y-8 animate-in fade-in duration-700 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Custos Diretos</h1>
                    <p className="text-muted-foreground">Análise detalhada de itens e insumos</p>
                </div>
                {loading && items.length > 0 && (
                    <RefreshCcw className="w-5 h-5 animate-spin text-primary-app/50" />
                )}
            </div>

            {/* Advanced Filter Bar */}
            <div className="glass p-6 rounded-2xl space-y-6 relative z-30">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
                    {/* Custom Search Field */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Search className="w-4 h-4" /> Busca Personalizada
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Digite para buscar..."
                                value={customSearch}
                                onChange={(e) => setCustomSearch(e.target.value)}
                                className="w-full bg-muted-app border border-border-app rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-app transition-all"
                            />
                            {customSearch && (
                                <button
                                    onClick={() => setCustomSearch('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded-full"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Product Dropdown Select */}
                    <div className="space-y-2 relative" ref={productDropdownRef}>
                        <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Package className="w-4 h-4" /> Item Específico
                        </label>
                        <div className="relative">
                            <button
                                onClick={() => {
                                    const newState = !isProductDropdownOpen
                                    closeAllDropdowns()
                                    setIsProductDropdownOpen(newState)
                                }}
                                className="w-full bg-muted-app border border-border-app rounded-xl px-4 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-primary-app transition-all text-left flex items-center justify-between"
                            >
                                <span className={selectedProduct ? 'text-foreground-app' : 'text-muted-foreground'}>
                                    {selectedProduct || 'Selecione um item...'}
                                </span>
                                <ChevronDown className={`w-4 h-4 transition-transform ${isProductDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {selectedProduct && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        setSelectedProduct('')
                                        setProductSearchTerm('')
                                    }}
                                    className="absolute right-10 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded-full z-10"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        {isProductDropdownOpen && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-card-app border border-border-app rounded-xl shadow-2xl z-[100] max-h-80 overflow-hidden flex flex-col">
                                <div className="p-3 border-b border-border-app">
                                    <input
                                        type="text"
                                        placeholder="Buscar item..."
                                        value={productSearchTerm}
                                        onChange={(e) => setProductSearchTerm(e.target.value)}
                                        className="w-full bg-muted-app border border-border-app rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-primary-app"
                                        autoFocus
                                    />
                                </div>
                                <div className="overflow-y-auto max-h-60 custom-scrollbar">
                                    {filteredDropdownProducts.length > 0 ? (
                                        filteredDropdownProducts.map((p) => (
                                            <button
                                                key={p}
                                                onClick={() => {
                                                    setSelectedProduct(p)
                                                    setIsProductDropdownOpen(false)
                                                    setProductSearchTerm('')
                                                }}
                                                className="w-full text-left px-4 py-2.5 hover:bg-primary-app/10 text-[13px] transition-colors border-b border-white/5 last:border-0"
                                            >
                                                {p}
                                            </button>
                                        ))
                                    ) : (
                                        <div className="p-4 text-[13px] text-center text-muted-foreground">Nenhum item encontrado</div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Category Select */}
                    <div className="space-y-2 relative" ref={categoryDropdownRef}>
                        <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Tag className="w-4 h-4" /> Categoria
                        </label>
                        <div className="relative">
                            <button
                                onClick={() => {
                                    const newState = !isCategoryDropdownOpen
                                    closeAllDropdowns()
                                    setIsCategoryDropdownOpen(newState)
                                }}
                                className="w-full bg-muted-app border border-border-app rounded-xl px-4 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-primary-app transition-all text-left flex items-center justify-between"
                            >
                                <span className={selectedCategory ? 'text-foreground-app' : 'text-muted-foreground'}>
                                    {selectedCategory
                                        ? categories.find(c => c.category_code === selectedCategory)?.category_description
                                        : 'Todas categorias'}
                                </span>
                                <ChevronDown className={`w-4 h-4 transition-transform ${isCategoryDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {selectedCategory && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        setSelectedCategory('')
                                    }}
                                    className="absolute right-10 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded-full z-10"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        {isCategoryDropdownOpen && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-card-app border border-border-app rounded-xl shadow-2xl z-[100] max-h-60 overflow-y-auto custom-scrollbar">
                                <button
                                    onClick={() => {
                                        setSelectedCategory('')
                                        setIsCategoryDropdownOpen(false)
                                    }}
                                    className={`w-full text-left px-4 py-2.5 hover:bg-primary-app/10 text-[13px] transition-colors border-b border-white/5 ${!selectedCategory ? 'bg-primary-app/10 text-primary-app' : ''}`}
                                >
                                    Todas categorias
                                </button>
                                {categories.map((cat) => (
                                    <button
                                        key={cat.code}
                                        onClick={() => {
                                            setSelectedCategory(cat.code)
                                            setIsCategoryDropdownOpen(false)
                                        }}
                                        className={`w-full text-left px-4 py-2.5 hover:bg-primary-app/10 text-[13px] transition-colors border-b border-white/5 last:border-0 ${selectedCategory === cat.code ? 'bg-primary-app/10 text-primary-app' : ''}`}
                                    >
                                        {cat.category_description}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Department Select */}
                    <div className="space-y-2 relative" ref={departmentDropdownRef}>
                        <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Filter className="w-4 h-4" /> Departamento
                        </label>
                        <div className="relative">
                            <button
                                onClick={() => {
                                    const newState = !isDepartmentDropdownOpen
                                    closeAllDropdowns()
                                    setIsDepartmentDropdownOpen(newState)
                                }}
                                className="w-full bg-muted-app border border-border-app rounded-xl px-4 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-primary-app transition-all text-left flex items-center justify-between"
                            >
                                <span className={selectedDepartment ? 'text-foreground-app' : 'text-muted-foreground'}>
                                    {selectedDepartment
                                        ? departments.find(d => d.omie_department_id === selectedDepartment)?.name
                                        : 'Todos departamentos'}
                                </span>
                                <ChevronDown className={`w-4 h-4 transition-transform ${isDepartmentDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {selectedDepartment && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        setSelectedDepartment('')
                                    }}
                                    className="absolute right-10 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded-full z-10"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        {isDepartmentDropdownOpen && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-card-app border border-border-app rounded-xl shadow-2xl z-[100] max-h-60 overflow-y-auto custom-scrollbar">
                                <button
                                    onClick={() => {
                                        setSelectedDepartment('')
                                        setIsDepartmentDropdownOpen(false)
                                    }}
                                    className={`w-full text-left px-4 py-2.5 hover:bg-primary-app/10 text-[13px] transition-colors border-b border-white/5 ${!selectedDepartment ? 'bg-primary-app/10 text-primary-app' : ''}`}
                                >
                                    Todos departamentos
                                </button>
                                {departments.map((dept) => (
                                    <button
                                        key={dept.id}
                                        onClick={() => {
                                            setSelectedDepartment(dept.omie_department_id)
                                            setIsDepartmentDropdownOpen(false)
                                        }}
                                        className={`w-full text-left px-4 py-2.5 hover:bg-primary-app/10 text-[13px] transition-colors border-b border-white/5 last:border-0 ${selectedDepartment === dept.omie_department_id ? 'bg-primary-app/10 text-primary-app' : ''}`}
                                    >
                                        {dept.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Date Presets */}
                    <div className="space-y-2 lg:col-span-2">
                        <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Calendar className="w-4 h-4" /> Período
                        </label>
                        <div className="flex bg-card-app p-1 rounded-lg border border-border-app h-[42px]">
                            {['7', '30', '90', '360'].map((range) => (
                                <button
                                    key={range}
                                    onClick={() => setTimeRange(range)}
                                    className={`flex-1 px-3 py-1.5 text-sm rounded-md transition-all ${timeRange === range
                                        ? 'bg-primary-app text-white shadow-lg'
                                        : 'text-muted-foreground hover:text-white'
                                        }`}
                                >
                                    {range}D
                                </button>
                            ))}
                            <button
                                onClick={() => setTimeRange('lastYear')}
                                className={`flex-1 px-3 py-1.5 text-sm rounded-md transition-all whitespace-nowrap ${timeRange === 'lastYear'
                                    ? 'bg-primary-app text-white shadow-lg'
                                    : 'text-muted-foreground hover:text-white'
                                    }`}
                            >
                                Ano passado
                            </button>
                            <button
                                onClick={() => setTimeRange('thisYear')}
                                className={`flex-1 px-3 py-1.5 text-sm rounded-md transition-all whitespace-nowrap ${timeRange === 'thisYear'
                                    ? 'bg-primary-app text-white shadow-lg'
                                    : 'text-muted-foreground hover:text-white'
                                    }`}
                            >
                                Este ano
                            </button>
                            <button
                                onClick={() => setTimeRange('custom')}
                                className={`flex-1 px-3 py-1.5 text-sm rounded-md transition-all ${timeRange === 'custom'
                                    ? 'bg-primary-app text-white shadow-lg'
                                    : 'text-muted-foreground hover:text-white'
                                    }`}
                            >
                                Pers.
                            </button>
                        </div>
                    </div>
                </div>

                {/* Custom Date Picker (Sub-row) */}
                {timeRange === 'custom' && (
                    <div className="pt-4 border-t border-white/5 flex flex-wrap items-center gap-4 animate-in slide-in-from-top-2 duration-300">
                        <div className="flex items-center gap-2">
                            <label className="text-sm text-muted-foreground">De:</label>
                            <input
                                type="date"
                                value={customDates.start}
                                onChange={(e) => setCustomDates({ ...customDates, start: e.target.value })}
                                className="bg-muted-app border border-border-app rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary-app outline-none appearance-none invert hue-rotate-180 brightness-90"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-sm text-muted-foreground">Até:</label>
                            <input
                                type="date"
                                value={customDates.end}
                                onChange={(e) => setCustomDates({ ...customDates, end: e.target.value })}
                                className="bg-muted-app border border-border-app rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary-app outline-none appearance-none invert hue-rotate-180 brightness-90"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Category Comparison Chart */}
            {categoryChartData.length > 0 && (
                <div className="glass p-4 rounded-2xl">
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">Custo por Categoria</h3>
                    <div className="h-[180px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={categoryChartData} margin={{ top: 10, right: 10, left: 10, bottom: 40 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                <XAxis
                                    dataKey="name"
                                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                                    angle={-45}
                                    textAnchor="end"
                                    height={60}
                                    interval={0}
                                />
                                <YAxis
                                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                                    width={45}
                                />
                                <Tooltip
                                    cursor={false}
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            return (
                                                <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl shadow-2xl backdrop-blur-md">
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
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Results Counters */}
            <div className="flex items-center gap-4 flex-wrap">
                <div className="glass px-4 py-2 rounded-lg text-sm flex items-center gap-2">
                    <span className="text-muted-foreground">Produtos únicos:</span>
                    <span className="font-bold text-primary-app">{filteredItems.length}</span>
                </div>
                <div className="glass px-4 py-2 rounded-lg text-sm flex items-center gap-2">
                    <span className="text-muted-foreground">Total acumulado:</span>
                    <span className="font-bold text-primary-app">
                        {formatCurrency(filteredItems.reduce((acc, curr) => acc + (Number(curr.total_value) || 0), 0))}
                    </span>
                </div>
                {Object.keys(columnFilters).length > 0 && (
                    <button
                        onClick={() => setColumnFilters({})}
                        className="glass px-3 py-2 rounded-lg text-sm flex items-center gap-2 text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                        <X className="w-3 h-3" />
                        Limpar filtros
                    </button>
                )}
            </div>

            {/* Data Table */}
            <div className="glass rounded-2xl overflow-hidden" ref={filterDropdownRef}>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-white/5 text-muted-foreground border-b border-border-app">
                            <tr>
                                {/* Produto / Descrição */}
                                <th className="px-6 py-4 font-medium">
                                    <div className="flex items-center gap-2">
                                        <span onClick={() => handleSort('product_description')} className="cursor-pointer hover:text-white transition-colors flex items-center gap-1">
                                            Produto / Descrição
                                            {sortConfig.key === 'product_description' && <ChevronDown className={`w-4 h-4 transition-transform ${sortConfig.direction === 'asc' ? 'rotate-180' : ''}`} />}
                                        </span>
                                        <div className="relative ml-auto">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setActiveFilterColumn(activeFilterColumn === 'product_description' ? null : 'product_description') }}
                                                className={`p-1 rounded hover:bg-white/10 transition-colors ${columnFilters['product_description'] ? 'text-primary-app' : 'text-muted-foreground'}`}
                                            >
                                                <Filter className="w-3 h-3" />
                                            </button>
                                            {activeFilterColumn === 'product_description' && (
                                                <div className="absolute top-full right-0 mt-2 bg-card-app border border-border-app rounded-xl shadow-2xl z-50 p-3 min-w-[200px]">
                                                    <input
                                                        type="text"
                                                        placeholder="Filtrar..."
                                                        value={columnFilters['product_description'] || ''}
                                                        onChange={(e) => handleColumnFilter('product_description', e.target.value)}
                                                        className="w-full bg-muted-app border border-border-app rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary-app"
                                                        autoFocus
                                                    />
                                                    {columnFilters['product_description'] && (
                                                        <button onClick={() => clearColumnFilter('product_description')} className="mt-2 text-xs text-red-400 hover:text-red-300">Limpar</button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </th>
                                {/* Departamento */}
                                <th className="px-6 py-4 font-medium">
                                    <div className="flex items-center gap-2">
                                        <span onClick={() => handleSort('department_name')} className="cursor-pointer hover:text-white transition-colors flex items-center gap-1">
                                            Departamento
                                            {sortConfig.key === 'department_name' && <ChevronDown className={`w-4 h-4 transition-transform ${sortConfig.direction === 'asc' ? 'rotate-180' : ''}`} />}
                                        </span>
                                        <div className="relative ml-auto">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setActiveFilterColumn(activeFilterColumn === 'department_name' ? null : 'department_name') }}
                                                className={`p-1 rounded hover:bg-white/10 transition-colors ${columnFilters['department_name'] ? 'text-primary-app' : 'text-muted-foreground'}`}
                                            >
                                                <Filter className="w-3 h-3" />
                                            </button>
                                            {activeFilterColumn === 'department_name' && (
                                                <div className="absolute top-full right-0 mt-2 bg-card-app border border-border-app rounded-xl shadow-2xl z-50 p-3 min-w-[200px]">
                                                    <input
                                                        type="text"
                                                        placeholder="Filtrar..."
                                                        value={columnFilters['department_name'] || ''}
                                                        onChange={(e) => handleColumnFilter('department_name', e.target.value)}
                                                        className="w-full bg-muted-app border border-border-app rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary-app"
                                                        autoFocus
                                                    />
                                                    {columnFilters['department_name'] && (
                                                        <button onClick={() => clearColumnFilter('department_name')} className="mt-2 text-xs text-red-400 hover:text-red-300">Limpar</button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </th>
                                {/* Categoria */}
                                <th className="px-6 py-4 font-medium">
                                    <div className="flex items-center gap-2">
                                        <span onClick={() => handleSort('category_description')} className="cursor-pointer hover:text-white transition-colors flex items-center gap-1">
                                            Categoria
                                            {sortConfig.key === 'category_description' && <ChevronDown className={`w-4 h-4 transition-transform ${sortConfig.direction === 'asc' ? 'rotate-180' : ''}`} />}
                                        </span>
                                        <div className="relative ml-auto">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setActiveFilterColumn(activeFilterColumn === 'category_description' ? null : 'category_description') }}
                                                className={`p-1 rounded hover:bg-white/10 transition-colors ${columnFilters['category_description'] ? 'text-primary-app' : 'text-muted-foreground'}`}
                                            >
                                                <Filter className="w-3 h-3" />
                                            </button>
                                            {activeFilterColumn === 'category_description' && (
                                                <div className="absolute top-full right-0 mt-2 bg-card-app border border-border-app rounded-xl shadow-2xl z-50 p-3 min-w-[200px]">
                                                    <input
                                                        type="text"
                                                        placeholder="Filtrar..."
                                                        value={columnFilters['category_description'] || ''}
                                                        onChange={(e) => handleColumnFilter('category_description', e.target.value)}
                                                        className="w-full bg-muted-app border border-border-app rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary-app"
                                                        autoFocus
                                                    />
                                                    {columnFilters['category_description'] && (
                                                        <button onClick={() => clearColumnFilter('category_description')} className="mt-2 text-xs text-red-400 hover:text-red-300">Limpar</button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </th>
                                {/* Nº NFE */}
                                <th className="px-6 py-4 font-medium">
                                    <div className="flex items-center gap-2">
                                        <span className="flex items-center gap-1">
                                            Nº NFE
                                        </span>
                                        <div className="relative ml-auto">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setActiveFilterColumn(activeFilterColumn === 'document_numbers' ? null : 'document_numbers') }}
                                                className={`p-1 rounded hover:bg-white/10 transition-colors ${columnFilters['document_numbers'] ? 'text-primary-app' : 'text-muted-foreground'}`}
                                            >
                                                <Filter className="w-3 h-3" />
                                            </button>
                                            {activeFilterColumn === 'document_numbers' && (
                                                <div className="absolute top-full right-0 mt-2 bg-card-app border border-border-app rounded-xl shadow-2xl z-50 p-3 min-w-[200px]">
                                                    <input
                                                        type="text"
                                                        placeholder="Filtrar..."
                                                        value={columnFilters['document_numbers'] || ''}
                                                        onChange={(e) => handleColumnFilter('document_numbers', e.target.value)}
                                                        className="w-full bg-muted-app border border-border-app rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary-app"
                                                        autoFocus
                                                    />
                                                    {columnFilters['document_numbers'] && (
                                                        <button onClick={() => clearColumnFilter('document_numbers')} className="mt-2 text-xs text-red-400 hover:text-red-300">Limpar</button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </th>
                                {/* Qtd. Total */}
                                <th className="px-6 py-4 font-medium text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <span onClick={() => handleSort('quantity')} className="cursor-pointer hover:text-white transition-colors flex items-center gap-1">
                                            Qtd. Total
                                            {sortConfig.key === 'quantity' && <ChevronDown className={`w-4 h-4 transition-transform ${sortConfig.direction === 'asc' ? 'rotate-180' : ''}`} />}
                                        </span>
                                        <div className="relative">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setActiveFilterColumn(activeFilterColumn === 'quantity' ? null : 'quantity') }}
                                                className={`p-1 rounded hover:bg-white/10 transition-colors ${columnFilters['quantity'] ? 'text-primary-app' : 'text-muted-foreground'}`}
                                            >
                                                <Filter className="w-3 h-3" />
                                            </button>
                                            {activeFilterColumn === 'quantity' && (
                                                <div className="absolute top-full right-0 mt-2 bg-card-app border border-border-app rounded-xl shadow-2xl z-50 p-3 min-w-[200px]">
                                                    <input
                                                        type="text"
                                                        placeholder="Filtrar..."
                                                        value={columnFilters['quantity'] || ''}
                                                        onChange={(e) => handleColumnFilter('quantity', e.target.value)}
                                                        className="w-full bg-muted-app border border-border-app rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary-app"
                                                        autoFocus
                                                    />
                                                    {columnFilters['quantity'] && (
                                                        <button onClick={() => clearColumnFilter('quantity')} className="mt-2 text-xs text-red-400 hover:text-red-300">Limpar</button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </th>
                                {/* Nº Compras */}
                                <th className="px-6 py-4 font-medium text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <span onClick={() => handleSort('occurrences')} className="cursor-pointer hover:text-white transition-colors flex items-center gap-1">
                                            Nº Compras
                                            {sortConfig.key === 'occurrences' && <ChevronDown className={`w-4 h-4 transition-transform ${sortConfig.direction === 'asc' ? 'rotate-180' : ''}`} />}
                                        </span>
                                        <div className="relative">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setActiveFilterColumn(activeFilterColumn === 'occurrences' ? null : 'occurrences') }}
                                                className={`p-1 rounded hover:bg-white/10 transition-colors ${columnFilters['occurrences'] ? 'text-primary-app' : 'text-muted-foreground'}`}
                                            >
                                                <Filter className="w-3 h-3" />
                                            </button>
                                            {activeFilterColumn === 'occurrences' && (
                                                <div className="absolute top-full right-0 mt-2 bg-card-app border border-border-app rounded-xl shadow-2xl z-50 p-3 min-w-[200px]">
                                                    <input
                                                        type="text"
                                                        placeholder="Filtrar..."
                                                        value={columnFilters['occurrences'] || ''}
                                                        onChange={(e) => handleColumnFilter('occurrences', e.target.value)}
                                                        className="w-full bg-muted-app border border-border-app rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary-app"
                                                        autoFocus
                                                    />
                                                    {columnFilters['occurrences'] && (
                                                        <button onClick={() => clearColumnFilter('occurrences')} className="mt-2 text-xs text-red-400 hover:text-red-300">Limpar</button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </th>
                                {/* Última Compra */}
                                <th className="px-6 py-4 font-medium text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <span onClick={() => handleSort('latest_date')} className="cursor-pointer hover:text-white transition-colors flex items-center gap-1">
                                            Última Compra
                                            {sortConfig.key === 'latest_date' && <ChevronDown className={`w-4 h-4 transition-transform ${sortConfig.direction === 'asc' ? 'rotate-180' : ''}`} />}
                                        </span>
                                        <div className="relative">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setActiveFilterColumn(activeFilterColumn === 'latest_date' ? null : 'latest_date') }}
                                                className={`p-1 rounded hover:bg-white/10 transition-colors ${columnFilters['latest_date'] ? 'text-primary-app' : 'text-muted-foreground'}`}
                                            >
                                                <Filter className="w-3 h-3" />
                                            </button>
                                            {activeFilterColumn === 'latest_date' && (
                                                <div className="absolute top-full right-0 mt-2 bg-card-app border border-border-app rounded-xl shadow-2xl z-50 p-3 min-w-[200px]">
                                                    <input
                                                        type="text"
                                                        placeholder="Filtrar..."
                                                        value={columnFilters['latest_date'] || ''}
                                                        onChange={(e) => handleColumnFilter('latest_date', e.target.value)}
                                                        className="w-full bg-muted-app border border-border-app rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary-app"
                                                        autoFocus
                                                    />
                                                    {columnFilters['latest_date'] && (
                                                        <button onClick={() => clearColumnFilter('latest_date')} className="mt-2 text-xs text-red-400 hover:text-red-300">Limpar</button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </th>
                                {/* Valor Total */}
                                <th className="px-6 py-4 font-medium text-right font-bold text-foreground-app">
                                    <div className="flex items-center justify-end gap-2">
                                        <span onClick={() => handleSort('total_value')} className="cursor-pointer hover:text-white transition-colors flex items-center gap-1">
                                            Valor Total
                                            {sortConfig.key === 'total_value' && <ChevronDown className={`w-4 h-4 transition-transform ${sortConfig.direction === 'asc' ? 'rotate-180' : ''}`} />}
                                        </span>
                                        <div className="relative">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setActiveFilterColumn(activeFilterColumn === 'total_value' ? null : 'total_value') }}
                                                className={`p-1 rounded hover:bg-white/10 transition-colors ${columnFilters['total_value'] ? 'text-primary-app' : 'text-muted-foreground'}`}
                                            >
                                                <Filter className="w-3 h-3" />
                                            </button>
                                            {activeFilterColumn === 'total_value' && (
                                                <div className="absolute top-full right-0 mt-2 bg-card-app border border-border-app rounded-xl shadow-2xl z-50 p-3 min-w-[200px]">
                                                    <input
                                                        type="text"
                                                        placeholder="Filtrar..."
                                                        value={columnFilters['total_value'] || ''}
                                                        onChange={(e) => handleColumnFilter('total_value', e.target.value)}
                                                        className="w-full bg-muted-app border border-border-app rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary-app"
                                                        autoFocus
                                                    />
                                                    {columnFilters['total_value'] && (
                                                        <button onClick={() => clearColumnFilter('total_value')} className="mt-2 text-xs text-red-400 hover:text-red-300">Limpar</button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-app">
                            {filteredItems.length === 0 && loading ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <RefreshCcw className="w-8 h-8 animate-spin text-primary-app" />
                                            <span className="text-muted-foreground">Buscando detalhes...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredItems.length > 0 ? (
                                filteredItems.map((item) => (
                                    <tr key={item.key} className="group hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4 font-medium">
                                            {item.product_description}
                                        </td>
                                        <td className="px-6 py-4 text-muted-foreground">
                                            {item.department_name}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-1 rounded bg-secondary-app text-xs uppercase tracking-wider font-semibold">
                                                {item.category_description}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-muted-foreground text-xs">
                                            {item.document_numbers.length > 0 ? (
                                                <span title={item.document_numbers.join(', ')}>
                                                    {item.document_numbers.length === 1
                                                        ? item.document_numbers[0]
                                                        : `${item.document_numbers[0]} +${item.document_numbers.length - 1}`
                                                    }
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground/50">-</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right tabular-nums text-muted-foreground">
                                            {item.quantity.toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 text-right tabular-nums">
                                            <span className="px-2 py-1 rounded-full bg-primary-app/10 text-primary-app text-xs font-semibold">
                                                {item.occurrences}x
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right text-muted-foreground tabular-nums">
                                            {format(parseISO(item.latest_date), 'dd/MM/yyyy')}
                                        </td>
                                        <td className="px-6 py-4 text-right font-bold text-primary-app tabular-nums">
                                            {formatCurrency(item.total_value)}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={8} className="px-6 py-20 text-center text-muted-foreground font-medium">
                                        Nenhum registro encontrado para os filtros selecionados.
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
