"use client"

import React, { useState, useEffect, useCallback } from 'react'
import {
    BarChart3,
    TrendingUp,
    LayoutGrid,
    DollarSign,
    RefreshCcw,
} from 'lucide-react'
import GlobalFilterBar from './GlobalFilterBar'
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
    LabelList,
    Sector,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { fetchAll } from '@/lib/supabase-utils'
import { format, subDays, parseISO } from 'date-fns'
import type { PageProps, FinancialTransaction, ChartDataPoint, DepartmentChart, CategoryChart, StackedChartData, KPICardProps, CustomTooltipProps, TooltipEntry } from '@/types'
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

const paymentTypeLabels: Record<string, string> = {
    'NFE': 'Notas Fiscais (NFE)',
    'NFS': 'Serviços (NFS)',
    'FPGT': 'Folha de Pagamento',
    'CTR': 'Contratos',
    'REC': 'Recibos',
    'REE': 'Reembolsos',
    'BOL': 'Boleto Bancário',
    'CTE': 'Frete (CTE)',
    'DANFE': 'Nota Fiscal',
    'RET': 'Retenções',
    'ADI': 'Adiantamentos',
    'FAT': 'Faturas',
    'NFAV': 'Nota Avulsa',
    'NLOC': 'Locação',
    'GRRF': 'Encargos (GRRF)',
    'GFD': 'Guia de Impostos',
    'CF': 'Cupom Fiscal',
    '99999': 'Outros'
}

const renderActiveShape = (props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;

    return (
        <g>
            <Sector
                cx={cx}
                cy={cy}
                innerRadius={innerRadius}
                outerRadius={outerRadius + 6}
                startAngle={startAngle}
                endAngle={endAngle}
                fill={fill}
                stroke={fill}
                strokeWidth={2}
            />
            <Sector
                cx={cx}
                cy={cy}
                startAngle={startAngle}
                endAngle={endAngle}
                innerRadius={outerRadius + 10}
                outerRadius={outerRadius + 12}
                fill={fill}
                opacity={0.3}
            />
        </g>
    );
};

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
    paymentTypeData: CategoryChart[]
    avgMonthlyCost: number
}

export default function Dashboard({ timeRange, setTimeRange, customDates, setCustomDates, selectedProject, setSelectedProject, projects }: PageProps) {
    const [data, setData] = useState<DashboardData | null>(null)
    const [loading, setLoading] = useState(true)

    // Active Index for Charts
    const [activeIndexCat, setActiveIndexCat] = useState(-1)
    const [activeIndexPay, setActiveIndexPay] = useState(-1)

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
            } else if (timeRange === '2024') {
                startDate = '2024-01-01';
                endDate = '2024-12-31';
            } else if (timeRange === 'all') {
                startDate = '2000-01-01';
                endDate = '2099-12-31';
            } else {
                startDate = format(subDays(new Date(), parseInt(timeRange)), 'yyyy-MM-dd');
            }

            // Fetch financial movements (movimentações financeiras) as the main data source
            // We use or() to capture movements where EITHER issue_date, due_date or payment_date falls in range
            // This is safer for "Cash Basis" analysis
            let query = supabase
                .from('financial_movements')
                .select(`
                    title_id,
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
                    original_amount,
                    paid_amount,
                    net_amount,
                    installment_label,
                    description,
                    title_name,
                    payment_type,
                    projects (code, name),
                    categories (code, description, standard_description)
                `)
                .or(`issue_date.gte.${startDate},due_date.gte.${startDate},payment_date.gte.${startDate}`)
                .or(`issue_date.lte.${endDate},due_date.lte.${endDate},payment_date.lte.${endDate}`)

            if (selectedProject) {
                query = query.eq('project_id', selectedProject)
            }

            const rawItems = await fetchAll<any>(query.order('issue_date', { ascending: false }))

            console.log('Dashboard raw items (financial_movements):', rawItems)

            // Map to FinancialTransaction for UI compatibility - Cash Basis Logic
            const items: FinancialTransaction[] = rawItems?.map(item => {
                // Primary date for Cash Basis is payment_date (if paid) or due_date (if open)
                const cashDate = item.is_paid ? (item.payment_date || item.due_date) : (item.due_date || item.issue_date);
                const transactionDate = cashDate || item.issue_date;

                // Final filter check to ensure we only show items that "move money" in the selected period
                if (transactionDate < startDate || transactionDate > endDate) return null;

                // Determine a friendly name for the transaction
                let transactionName = ''
                if (item.title_name) {
                    transactionName = item.title_name
                } else if (item.supplier_name) {
                    transactionName = item.supplier_name
                } else if (item.description) {
                    transactionName = item.description
                } else {
                    transactionName = item.installment_label
                        ? `Título: ${item.invoice_number || item.title_id} (${item.installment_label})`
                        : `Título: ${item.invoice_number || item.title_id}`
                }

                return {
                    id: item.title_id,
                    transaction_date: transactionDate,
                    transaction_name: transactionName,
                    total_value: Number(item.net_amount) || Number(item.original_amount) || Number(item.paid_amount) || 0,
                    quantity_received: 1,
                    department_id: item.project_id,
                    superior_category: item.category_id,
                    supplier_name: item.supplier_name,
                    description: item.description,
                    departments: item.projects ? { name: item.projects.name } : undefined,
                    projects: item.projects ? { name: item.projects.name } : undefined,
                    categories: {
                        category_description: item.categories?.description || item.categories?.standard_description || 'Outros',
                        name: item.categories?.description || item.categories?.standard_description
                    }
                }
            }).filter((item): item is NonNullable<typeof item> => item !== null) || []

            if (items) {
                // Calculate Totals
                const totalCost = items.reduce((acc, item) => acc + (Number(item.total_value) || 0), 0)
                const itemCount = items.length
                const avgTicket = itemCount > 0 ? totalCost / itemCount : 0

                // Process Monthly Avg
                const monthMap = new Map()
                items.forEach(item => {
                    const month = item.transaction_date?.substring(0, 7) // YYYY-MM
                    if (!month) return
                    const val = Number(item.total_value) || 0
                    monthMap.set(month, (monthMap.get(month) || 0) + val)
                })
                const monthlyValues = Array.from(monthMap.values())
                const avgMonthlyCost = monthlyValues.length > 0
                    ? monthlyValues.reduce((a, b) => a + b, 0) / monthlyValues.length
                    : totalCost // If only one partial month or no full month info, fallback to totalCost or 0

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

                // Specific Aggregations for new charts
                const payTypeMap = new Map()

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

                    // Payment Type Aggregation (NFE, NFS, etc)
                    // We assume paymentType is stored in item since we fetched it or can deduce it
                    // Actually, rawItems has payment_type, let's make sure it's in the mapped item
                })

                // Note: I need to ensure payment_type and status are in the mapped items or re-loop rawItems
                // Let's re-run the aggregation more cleanly
                rawItems?.forEach(item => {
                    // We need these metrics for the period-filtered items only
                    const cashDate = item.is_paid ? (item.payment_date || item.due_date) : (item.due_date || item.issue_date);
                    const transactionDate = cashDate || item.issue_date;
                    if (transactionDate < startDate || transactionDate > endDate) return;

                    const val = Number(item.net_amount) || Number(item.original_amount) || Number(item.paid_amount) || 0

                    const pTypeCode = item.payment_type || 'Outros'
                    const pTypeLabel = paymentTypeLabels[pTypeCode] || pTypeCode
                    payTypeMap.set(pTypeLabel, (payTypeMap.get(pTypeLabel) || 0) + val)
                })

                const paymentTypeData = Array.from(payTypeMap.entries())
                    .map(([name, value]) => ({ name, value }))
                    .sort((a, b) => b.value - a.value)

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
                    recentItems: items.slice(0, 10),
                    paymentTypeData,
                    avgMonthlyCost
                })
            }
        } catch (err) {
            console.error('Error fetching data:', err)
        } finally {
            setLoading(false)
        }
    }, [timeRange, customDates, selectedProject])

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

            <GlobalFilterBar
                timeRange={timeRange}
                setTimeRange={setTimeRange}
                customDates={customDates}
                setCustomDates={setCustomDates}
                selectedProject={selectedProject}
                setSelectedProject={setSelectedProject}
                projects={projects}
                title="Custos por Projetos"
                subtitle="Dashboard Gerencial"
                loading={loading && !!data}
            />

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <KPICard
                    title="Custo Total"
                    value={data?.totalCost || 0}
                    icon={<DollarSign className="w-5 h-5 text-blue-500" />}
                    isCurrency
                />
                <KPICard
                    title="Movimentações"
                    value={data?.itemCount || 0}
                    icon={<LayoutGrid className="w-5 h-5 text-indigo-500" />}
                />
                <KPICard
                    title="Ticket Médio"
                    value={data?.avgTicket || 0}
                    icon={<TrendingUp className="w-5 h-5 text-purple-500" />}
                    isCurrency
                />
                <KPICard
                    title="Custo Médio Mensal"
                    value={data?.avgMonthlyCost || 0}
                    icon={<BarChart3 className="w-5 h-5 text-pink-500" />}
                    isCurrency
                />
            </div>

            {/* Main Charts Row - Full Width Line Chart */}
            <div className="grid grid-cols-1 gap-6">
                <div className="glass p-6 rounded-2xl space-y-4">
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
            </div>

            {/* Row of 2 Circular Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 1. Categorias (Donut) */}
                <div className="glass p-6 rounded-2xl space-y-6">
                    <h3 className="font-semibold text-lg">Distribuição por Categoria</h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={data?.catData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={80}
                                    outerRadius={110}
                                    paddingAngle={3}
                                    dataKey="value"
                                    stroke="none"
                                    activeIndex={activeIndexCat}
                                    activeShape={renderActiveShape}
                                    onMouseEnter={(_, index) => setActiveIndexCat(index)}
                                    onMouseLeave={() => setActiveIndexCat(-1)}
                                >
                                    {data?.catData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    cursor={false}
                                    content={({ active, payload }: CustomTooltipProps) => {
                                        if (active && payload && payload.length) {
                                            return (
                                                <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl shadow-2xl backdrop-blur-md">
                                                    <p className="text-white font-semibold text-sm mb-1">{payload[0].name}</p>
                                                    <p className="text-primary-app font-bold text-base">
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
                    <div className="space-y-2 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
                        {data?.catData.map((cat, idx) => (
                            <div key={cat.name} className="flex items-center justify-between text-[11px]">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                                    <span className="text-muted-foreground truncate" title={cat.name}>{cat.name}</span>
                                </div>
                                <span className="font-medium shrink-0 ml-2">
                                    {formatCurrency(cat.value)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 2. Tipos de Pagamento (Pie) */}
                <div className="glass p-6 rounded-2xl space-y-6">
                    <h3 className="font-semibold text-lg">Tipos de Pagamento</h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={data?.paymentTypeData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={80}
                                    outerRadius={110}
                                    paddingAngle={3}
                                    dataKey="value"
                                    stroke="none"
                                    activeIndex={activeIndexPay}
                                    activeShape={renderActiveShape}
                                    onMouseEnter={(_, index) => setActiveIndexPay(index)}
                                    onMouseLeave={() => setActiveIndexPay(-1)}
                                    label={({ percent }: { percent?: number }) => percent && percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}
                                    labelLine={false}
                                >
                                    {data?.paymentTypeData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[(index + 1) % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    cursor={false}
                                    content={({ active, payload }: CustomTooltipProps) => {
                                        if (active && payload && payload.length) {
                                            return (
                                                <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl shadow-2xl backdrop-blur-md">
                                                    <p className="text-white font-semibold text-sm mb-1">{payload[0].name}</p>
                                                    <p className="text-indigo-400 font-bold text-base">
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
                    <div className="space-y-2 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
                        {data?.paymentTypeData.map((type, idx) => (
                            <div key={type.name} className="flex items-center justify-between text-[11px]">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[(idx + 1) % COLORS.length] }} />
                                    <span className="text-muted-foreground truncate" title={type.name}>{type.name}</span>
                                </div>
                                <span className="font-medium shrink-0 ml-2">
                                    {formatCurrency(type.value)}
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

function KPICard({ title, value, icon, isCurrency = false }: KPICardProps) {
    return (
        <div className="glass p-6 rounded-2xl card-shine group">
            <div className="flex items-center justify-between mb-4">
                <div className="p-2.5 rounded-xl bg-secondary-app">{icon}</div>
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
