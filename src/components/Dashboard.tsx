"use client"

import React, { useState, useEffect, useCallback } from 'react'
import {
    BarChart3,
    TrendingUp,
    Users,
    LayoutGrid,
    DollarSign,
    ArrowUpRight,
    ArrowDownRight,
    Filter,
    RefreshCcw
} from 'lucide-react'
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    LabelList
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { fetchAll } from '@/lib/supabase-utils'
import { format, subDays, parseISO } from 'date-fns'
import type { PageProps, Department, FinancialTransaction, ChartDataPoint, DepartmentChart, CategoryChart, StackedChartData, KPICardProps, CustomTooltipProps, TooltipEntry } from '@/types'
import { ptBR } from 'date-fns/locale'

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
}

const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(value);
}

interface DashboardData {
    totalCost: number
    itemCount: number
    avgTicket: number
    trendData: ChartDataPoint[]
    deptData: DepartmentChart[]
    catData: CategoryChart[]
    stackedData: StackedChartData[]
    allCategories: string[]
    recentItems: FinancialTransaction[]
}

export default function Dashboard({ timeRange, setTimeRange, customDates, setCustomDates }: PageProps) {
    const [data, setData] = useState<DashboardData | null>(null)
    const [loading, setLoading] = useState(true)
    const [departments, setDepartments] = useState<Department[]>([])
    const [selectedDept, setSelectedDept] = useState('')

    const fetchDepartments = useCallback(async () => {
        const { data: deptData } = await supabase
            .schema('financial_dashboard')
            .from('departments')
            .select('*')
            .eq('is_active', true)
            .order('name')
        if (deptData) setDepartments(deptData)
    }, [])

    const fetchDashboardData = useCallback(async () => {
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

            // Fetch financial transactions with date filter
            let query = supabase
                .schema('financial_dashboard')
                .from('financial_transactions')
                .select(`
          *,
          departments (name),
          categories (category_description)
        `)
                .gte('transaction_date', startDate)
                .lte('transaction_date', endDate)

            if (selectedDept) {
                query = query.eq('department_id', selectedDept)
            }

            const items = await fetchAll<FinancialTransaction>(query.order('transaction_date', { ascending: false }))

            if (items) {
                // Calculate Totals
                const totalCost = items.reduce((acc, item) => acc + (Number(item.total_value) || 0), 0)
                const itemCount = items.length
                const avgTicket = itemCount > 0 ? totalCost / itemCount : 0

                // Process Trend Data (Group by Date)
                const trendMap = new Map()
                items.forEach(item => {
                    const date = item.transaction_date
                    if (!date) return
                    const val = Number(item.total_value) || 0
                    trendMap.set(date, (trendMap.get(date) || 0) + val)
                })
                const trendData = Array.from(trendMap.entries())
                    .map(([date, value]) => ({ date, value }))
                    .sort((a, b) => a.date.localeCompare(b.date))

                // Process Dept Data
                const deptMap = new Map()
                items.forEach(item => {
                    const deptName = item.departments?.name || 'Não Informado'
                    const val = Number(item.total_value) || 0
                    deptMap.set(deptName, (deptMap.get(deptName) || 0) + val)
                })
                const deptData = Array.from(deptMap.entries())
                    .map(([name, value]) => ({ name, value }))
                    .sort((a, b) => b.value - a.value)

                // Process Category Data
                const catMap = new Map()
                items.forEach(item => {
                    const catName = item.categories?.category_description || 'Outros'
                    const val = Number(item.total_value) || 0
                    catMap.set(catName, (catMap.get(catName) || 0) + val)
                })
                const catData = Array.from(catMap.entries())
                    .map(([name, value]) => ({ name, value }))
                    .sort((a, b) => b.value - a.value)
                    .slice(0, 5)

                // Process Stacked Data (Category per Department)
                const stackedMap = new Map()
                const categorySet = new Set<string>()

                items.forEach(item => {
                    const deptName = item.departments?.name || 'Não Informado'
                    const catName = item.categories?.category_description || 'Outros'
                    const val = Number(item.total_value) || 0

                    if (!stackedMap.has(deptName)) {
                        stackedMap.set(deptName, { name: deptName, total: 0 })
                    }
                    const deptObj = stackedMap.get(deptName)
                    deptObj[catName] = (deptObj[catName] || 0) + val
                    deptObj.total += val
                    categorySet.add(catName)
                })

                const allCategories = Array.from(categorySet).sort()
                const stackedData = Array.from(stackedMap.values())
                    .sort((a, b) => b.total - a.total)

                setData({
                    totalCost,
                    itemCount,
                    avgTicket,
                    trendData,
                    deptData,
                    catData,
                    stackedData,
                    allCategories,
                    recentItems: items.slice(0, 10)
                })
            }
        } catch (err) {
            console.error('Error fetching data:', err)
        } finally {
            setLoading(false)
        }
    }, [timeRange, customDates, selectedDept])

    useEffect(() => {
        fetchDepartments()
    }, [fetchDepartments])

    useEffect(() => {
        fetchDashboardData()
    }, [fetchDashboardData])

    const COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef']

    return (
        <div className="min-h-screen pb-12 pt-8 px-4 md:px-8 space-y-8 animate-in fade-in duration-700 relative">
            {loading && !data && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background-app/50 backdrop-blur-sm">
                    <div className="flex flex-col items-center gap-4">
                        <RefreshCcw className="w-8 h-8 animate-spin text-primary-app" />
                        <p className="text-muted-foreground animate-pulse">Carregando dados financeiros...</p>
                    </div>
                </div>
            )}

            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Custos por Projetos</h1>
                        <p className="text-muted-foreground">Dashboard Gerencial</p>
                    </div>
                    {loading && data && (
                        <RefreshCcw className="w-5 h-5 animate-spin text-primary-app/50" />
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex bg-card-app p-1 rounded-lg border border-border-app">
                        <select
                            value={selectedDept}
                            onChange={(e) => setSelectedDept(e.target.value)}
                            className="bg-transparent text-sm focus:outline-none px-2 py-1.5 text-muted-foreground w-[150px] md:w-[200px]"
                        >
                            <option value="">Geral (Todas Obras)</option>
                            {departments.map((dept) => (
                                <option key={dept.id} value={dept.omie_department_id}>
                                    {dept.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex bg-card-app p-1 rounded-lg border border-border-app">
                        {['7', '30', '90', '360'].map((range) => (
                            <button
                                key={range}
                                onClick={() => setTimeRange(range)}
                                className={`px-3 py-1.5 text-sm rounded-md transition-all ${timeRange === range
                                    ? 'bg-primary-app text-white shadow-lg'
                                    : 'text-muted-foreground hover:text-white'
                                    }`}
                            >
                                {range}D
                            </button>
                        ))}
                        <button
                            onClick={() => setTimeRange('lastYear')}
                            className={`px-3 py-1.5 text-sm rounded-md transition-all ${timeRange === 'lastYear'
                                ? 'bg-primary-app text-white shadow-lg'
                                : 'text-muted-foreground hover:text-white'
                                }`}
                        >
                            Ano passado
                        </button>
                        <button
                            onClick={() => setTimeRange('thisYear')}
                            className={`px-3 py-1.5 text-sm rounded-md transition-all ${timeRange === 'thisYear'
                                ? 'bg-primary-app text-white shadow-lg'
                                : 'text-muted-foreground hover:text-white'
                                }`}
                        >
                            Este ano
                        </button>
                        <button
                            onClick={() => setTimeRange('custom')}
                            className={`px-3 py-1.5 text-sm rounded-md transition-all ${timeRange === 'custom'
                                ? 'bg-primary-app text-white shadow-lg'
                                : 'text-muted-foreground hover:text-white'
                                }`}
                        >
                            Pers.
                        </button>
                    </div>
                    <button className="p-2.5 rounded-lg border border-border-app bg-card-app hover:bg-secondary-app transition-colors">
                        <Filter className="w-5 h-5" />
                    </button>
                </div>
            </header>

            {/* Custom Date Picker Section */}
            {timeRange === 'custom' && (
                <div className="glass p-4 rounded-xl flex flex-wrap items-center gap-4 animate-in slide-in-from-top-2 duration-300">
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

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <KPICard
                    title="Custo Total"
                    value={data?.totalCost || 0}
                    icon={<DollarSign className="w-5 h-5 text-blue-500" />}
                    trend="+12.5%"
                    isPositive={false}
                    isCurrency
                />
                <KPICard
                    title="Itens Processados"
                    value={data?.itemCount || 0}
                    icon={<LayoutGrid className="w-5 h-5 text-indigo-500" />}
                    trend="+5.2%"
                    isPositive={true}
                />
                <KPICard
                    title="Ticket Médio"
                    value={data?.avgTicket || 0}
                    icon={<TrendingUp className="w-5 h-5 text-purple-500" />}
                    trend="-2.1%"
                    isPositive={true}
                    isCurrency
                />
                <KPICard
                    title="Departamentos"
                    value={data?.deptData.length || 0}
                    icon={<Users className="w-5 h-5 text-pink-500" />}
                    trend="Estável"
                    isPositive={true}
                />
            </div>

            {/* Main Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 glass p-6 rounded-2xl space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-lg flex items-center gap-2">
                            <BarChart3 className="w-5 h-5 text-primary-app" />
                            Evolução de Gastos
                        </h3>
                    </div>
                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data?.trendData}>
                                <defs>
                                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                                <XAxis
                                    dataKey="date"
                                    stroke="#9ca3af"
                                    fontSize={12}
                                    tickFormatter={(val) => format(parseISO(val), 'dd MMM', { locale: ptBR })}
                                />
                                <YAxis
                                    stroke="#9ca3af"
                                    fontSize={12}
                                    tickFormatter={(val) => `R$ ${val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val}`}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px' }}
                                    labelFormatter={(val) => format(parseISO(val), 'dd/MM/yyyy')}
                                    formatter={(value) => [formatCurrency(Number(value) || 0), 'Custo']}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="value"
                                    stroke="#3b82f6"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorValue)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="glass p-6 rounded-2xl space-y-6">
                    <h3 className="font-semibold text-lg">Distribuição por Categoria</h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={data?.catData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                    label={({ percent }: { percent?: number }) => percent ? `${(percent * 100).toFixed(0)}%` : ''}
                                >
                                    {data?.catData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    content={({ active, payload }: CustomTooltipProps) => {
                                        if (active && payload && payload.length) {
                                            return (
                                                <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl shadow-2xl backdrop-blur-md">
                                                    <p className="text-white font-semibold text-sm mb-1">{payload[0].name}</p>
                                                    <p className="text-primary-app font-bold text-lg">
                                                        {formatCurrency(payload[0].value)}
                                                    </p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="space-y-3 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                        {data?.catData.map((cat, idx) => (
                            <div key={cat.name} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                                    <span className="text-muted-foreground truncate" title={cat.name}>{cat.name}</span>
                                </div>
                                <span className="font-medium shrink-0 ml-4">
                                    {formatCurrency(cat.value)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            {/* Depts and Projects Section */}
            <div className="grid grid-cols-1 gap-8">
                {/* Horizontal Cost per Department (Original) */}
                <div className="glass p-6 rounded-2xl flex flex-col">
                    <h3 className="font-semibold text-lg mb-6">Custos por Departamento</h3>
                    <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={data?.deptData}
                                layout="vertical"
                                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="5 5" stroke="#374151" horizontal={false} />
                                <XAxis
                                    type="number"
                                    stroke="#9ca3af"
                                    fontSize={12}
                                    tickFormatter={(val) => `R$ ${val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val}`}
                                />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    stroke="#9ca3af"
                                    fontSize={12}
                                    width={120}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px' }}
                                    formatter={(value: number | string) => [formatCurrency(Number(value)), 'Custo']}
                                    cursor={false}
                                />
                                <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={35}>
                                    <LabelList
                                        dataKey="value"
                                        position="right"
                                        formatter={(value: number) => formatCurrency(value)}
                                        style={{ fill: '#fff', fontSize: 11, fontWeight: 500 }}
                                    />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Stacked Vertical Bar Chart (New) */}
                <div className="glass p-6 rounded-2xl flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-semibold text-lg flex items-center gap-2">
                            <LayoutGrid className="w-5 h-5 text-primary-app" />
                            Categorias de Custos por Projeto
                        </h3>
                    </div>
                    <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={data?.stackedData}
                                margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                                <XAxis
                                    dataKey="name"
                                    stroke="#9ca3af"
                                    fontSize={10}
                                    angle={-45}
                                    textAnchor="end"
                                    interval={0}
                                />
                                <YAxis
                                    stroke="#9ca3af"
                                    fontSize={12}
                                    tickFormatter={(val) => `R$ ${val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val}`}
                                />
                                <Tooltip
                                    content={(props) => <CustomStackedTooltip {...props} />}
                                    cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                                />
                                {data?.allCategories.map((cat, idx) => (
                                    <Bar
                                        key={cat}
                                        dataKey={cat}
                                        stackId="a"
                                        fill={COLORS[idx % COLORS.length]}
                                        radius={idx === data.allCategories.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                                    >
                                        {/* Optional: Add percentage labels inside bars if space permits */}
                                    </Bar>
                                ))}
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    {/* Legend */}
                    <div className="mt-4 flex flex-wrap gap-4 items-center justify-center border-t border-border-app pt-4">
                        {data?.allCategories.map((cat, idx) => (
                            <div key={cat} className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{cat}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div >
    )
}

function CustomStackedTooltip({ active, payload, label }: CustomTooltipProps) {
    if (active && payload && payload.length) {
        const total = payload.reduce((sum: number, entry: TooltipEntry) => sum + (Number(entry.value) || 0), 0);
        const filteredItems = payload
            .filter((p: TooltipEntry) => p.value > 0)
            .sort((a: TooltipEntry, b: TooltipEntry) => b.value - a.value);

        // Divide items into columns of 10
        const itemsPerColumn = 10;
        const columns: TooltipEntry[][] = [];
        for (let i = 0; i < filteredItems.length; i += itemsPerColumn) {
            columns.push(filteredItems.slice(i, i + itemsPerColumn));
        }

        return (
            <div className="bg-slate-900/50 border border-slate-700 p-3 rounded-lg shadow-2xl backdrop-blur-xl">
                <p className="text-white font-bold text-sm mb-2 border-b border-slate-700 pb-1.5">{label}</p>
                <div className="flex gap-4">
                    {columns.map((column, colIndex) => (
                        <div key={colIndex} className="space-y-1.5 min-w-[200px]">
                            {column.map((entry: TooltipEntry) => (
                                <div key={entry.name} className="flex items-center justify-between text-xs gap-3">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.fill }} />
                                        <span className="text-slate-300">{entry.name}</span>
                                    </div>
                                    <span className="text-white font-semibold">{formatCurrency(entry.value)}</span>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
                <div className="mt-2 pt-1.5 border-t border-slate-700 flex justify-between items-center">
                    <span className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider">Total</span>
                    <span className="text-primary-app font-bold text-sm">{formatCurrency(total)}</span>
                </div>
            </div>
        );
    }
    return null;
}

function KPICard({ title, value, icon, trend, isPositive, isCurrency = false }: KPICardProps) {
    return (
        <div className="glass p-6 rounded-2xl card-shine group">
            <div className="flex items-center justify-between mb-4">
                <div className="p-2.5 rounded-xl bg-secondary-app">{icon}</div>
                <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${isPositive ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                    }`}>
                    {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {trend}
                </div>
            </div>
            <div>
                <p className="text-sm text-muted-foreground">{title}</p>
                <h4 className="text-2xl font-bold mt-1">
                    {isCurrency
                        ? formatCurrency(value)
                        : formatNumber(value)}
                </h4>
            </div>
        </div>
    )
}
