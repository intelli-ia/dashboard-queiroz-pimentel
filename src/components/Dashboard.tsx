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
import type { PageProps, AccountPayable, ChartDataPoint, DepartmentChart, CategoryChart, StackedChartData, KPICardProps, CustomTooltipProps, TooltipEntry, DashboardData, TaxAnalysisData } from '@/types'
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

const documentTypeLabels: Record<string, string> = {
    'NFE': 'Notas Fiscais (NFE)',
    'NFS': 'Servicos (NFS)',
    'BOL': 'Boleto Bancario',
    'REC': 'Recibos',
    'PIX': 'PIX',
    'TED': 'Transferencia TED',
    'DIN': 'Dinheiro',
    'CTR': 'Contratos',
    'FAT': 'Faturas',
    'CTE': 'Frete (CTE)',
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

            // 1. Fetch Accounts Receivable (Contas a Receber)
            let receivablesQuery = supabase
                .from('accounts_receivable')
                .select('valor_documento, project_code, data_vencimento, status_titulo')
                .gte('data_vencimento', startDate)
                .lte('data_vencimento', endDate)

            if (selectedProject) {
                receivablesQuery = receivablesQuery.eq('project_code', selectedProject)
            }

            const { data: receivablesData } = await receivablesQuery
            const totalReceipts = receivablesData?.reduce((acc, curr) => acc + (Number(curr.valor_documento) || 0), 0) || 0

            // 2. Fetch Accounts Payable (Contas a Pagar) - Main data source
            let query = supabase
                .from('accounts_payable')
                .select(`
                    codigo_lancamento_omie,
                    codigo_cliente_fornecedor,
                    project_code,
                    category_code,
                    document_type,
                    numero_documento,
                    numero_documento_fiscal,
                    current_installment,
                    total_installments,
                    data_emissao,
                    data_entrada,
                    data_previsao,
                    data_vencimento,
                    status_titulo,
                    valor_documento,
                    retem_cofins,
                    retem_csll,
                    retem_inss,
                    retem_ir,
                    retem_iss,
                    retem_pis,
                    valor_inss,
                    valor_ir,
                    valor_iss,
                    projects:project_code (code, name),
                    categories:category_code (code, description)
                `)
                .gte('data_vencimento', startDate)
                .lte('data_vencimento', endDate)

            if (selectedProject) {
                query = query.eq('project_code', selectedProject)
            }

            const rawItems = await fetchAll<AccountPayable>(query.order('data_vencimento', { ascending: false }))

            console.log('Dashboard raw items (accounts_payable):', rawItems)

            if (rawItems) {
                // Calculate Totals
                const totalCost = rawItems.reduce((acc, item) => acc + (Number(item.valor_documento) || 0), 0)
                const itemCount = rawItems.length

                // Process Monthly Avg
                const monthMap = new Map<string, number>()
                rawItems.forEach(item => {
                    const month = item.data_vencimento?.substring(0, 7) // YYYY-MM
                    if (!month) return
                    const val = Number(item.valor_documento) || 0
                    monthMap.set(month, (monthMap.get(month) || 0) + val)
                })
                const monthlyValues = Array.from(monthMap.values())
                const avgMonthlyCost = monthlyValues.length > 0
                    ? monthlyValues.reduce((a, b) => a + b, 0) / monthlyValues.length
                    : totalCost

                // Process Trend Data (Group by Date)
                const trendMap = new Map<string, number>()
                rawItems.forEach(item => {
                    const date = item.data_vencimento
                    if (!date) return
                    const val = Number(item.valor_documento) || 0
                    trendMap.set(date, (trendMap.get(date) || 0) + val)
                })
                const trendData: ChartDataPoint[] = Array.from(trendMap.entries())
                    .map(([date, value]) => ({ date, value }))
                    .sort((a, b) => a.date.localeCompare(b.date))

                // Process Dept Data (Project)
                const deptMap = new Map<string, number>()
                rawItems.forEach(item => {
                    const deptName = item.projects?.name || 'Nao Informado'
                    const val = Number(item.valor_documento) || 0
                    deptMap.set(deptName, (deptMap.get(deptName) || 0) + val)
                })
                const deptData: DepartmentChart[] = Array.from(deptMap.entries())
                    .map(([name, value]) => ({ name, value }))
                    .sort((a, b) => b.value - a.value)

                // Process Category Data
                const catMap = new Map<string, number>()
                rawItems.forEach(item => {
                    const catName = item.categories?.description || 'Outros'
                    const val = Number(item.valor_documento) || 0
                    catMap.set(catName, (catMap.get(catName) || 0) + val)
                })
                const catData: CategoryChart[] = Array.from(catMap.entries())
                    .map(([name, value]) => ({ name, value }))
                    .sort((a, b) => b.value - a.value)
                    .slice(0, 5)

                // Process Stacked Data (Category per Project)
                const stackedMap = new Map<string, StackedChartData>()
                const categorySet = new Set<string>()

                // Payment Type Aggregation
                const payTypeMap = new Map<string, number>()

                rawItems.forEach(item => {
                    const deptName = item.projects?.name || 'Nao Informado'
                    const catName = item.categories?.description || 'Outros'
                    const val = Number(item.valor_documento) || 0

                    if (!stackedMap.has(deptName)) {
                        stackedMap.set(deptName, { name: deptName, total: 0 })
                    }
                    const deptObj = stackedMap.get(deptName)!
                    deptObj[catName] = ((deptObj[catName] as number) || 0) + val
                    deptObj.total += val
                    categorySet.add(catName)

                    // Document Type Aggregation
                    const docTypeCode = item.document_type || 'Outros'
                    const docTypeLabel = documentTypeLabels[docTypeCode] || docTypeCode
                    payTypeMap.set(docTypeLabel, (payTypeMap.get(docTypeLabel) || 0) + val)
                })

                const paymentTypeData: CategoryChart[] = Array.from(payTypeMap.entries())
                    .map(([name, value]) => ({ name, value }))
                    .sort((a, b) => b.value - a.value)

                const allCategories = Array.from(categorySet).sort()
                const stackedData: StackedChartData[] = Array.from(stackedMap.values())
                    .sort((a, b) => b.total - a.total)

                // Tax Analysis Calculations - Using actual values from the database
                const totalInss = rawItems.reduce((acc, item) => acc + (Number(item.valor_inss) || 0), 0)
                const totalIr = rawItems.reduce((acc, item) => acc + (Number(item.valor_ir) || 0), 0)
                const totalIss = rawItems.reduce((acc, item) => acc + (Number(item.valor_iss) || 0), 0)

                // Estimated values based on retention flags
                const valorBrutoNF = totalReceipts
                const itemsWithPis = rawItems.filter(i => i.retem_pis)
                const pis = itemsWithPis.reduce((acc, i) => acc + (Number(i.valor_documento) || 0) * 0.0065, 0)
                const itemsWithCofins = rawItems.filter(i => i.retem_cofins)
                const cofins = itemsWithCofins.reduce((acc, i) => acc + (Number(i.valor_documento) || 0) * 0.03, 0)
                const itemsWithCsll = rawItems.filter(i => i.retem_csll)
                const csll = itemsWithCsll.reduce((acc, i) => acc + (Number(i.valor_documento) || 0) * 0.028, 0)

                const fgts = valorBrutoNF * 0.002 // Estimated average

                const totalEncargos = totalInss + fgts + totalIr + totalIss + pis + cofins + csll

                // Other metrics
                const valorReajuste = 0
                const valorLiquidoNF = valorBrutoNF + valorReajuste
                const valorContrato = valorBrutoNF * 1.05
                const saldoContrato = valorContrato - valorBrutoNF

                // Open items (ABERTO status)
                const fornecedoresAberto = rawItems
                    .filter(i => i.status_titulo === 'ABERTO')
                    .reduce((acc, curr) => acc + (Number(curr.valor_documento) || 0), 0)

                const maquinasEquipamentos = 0
                const custosFinanceiros = valorBrutoNF * 0.06
                const escritorioCentral = valorBrutoNF * 0.04
                const custoTotal = totalCost + totalEncargos + custosFinanceiros + escritorioCentral
                const diferenca = custoTotal - valorLiquidoNF

                const taxAnalysis: TaxAnalysisData = {
                    inss: totalInss,
                    fgts,
                    ir: totalIr,
                    iss: totalIss,
                    pis,
                    cofins,
                    csll,
                    totalEncargos,
                    valorBrutoNF,
                    valorReajuste,
                    valorLiquidoNF,
                    valorContrato,
                    saldoContrato,
                    fornecedoresAberto,
                    maquinasEquipamentos,
                    custosFinanceiros,
                    escritorioCentral,
                    custoTotal,
                    diferenca
                }

                setData({
                    totalCost,
                    itemCount,
                    totalReceipts,
                    trendData,
                    deptData,
                    catData,
                    stackedData,
                    allCategories,
                    recentItems: rawItems.slice(0, 10),
                    paymentTypeData,
                    avgMonthlyCost,
                    taxAnalysis
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
                    title="Movimentacoes"
                    value={data?.itemCount || 0}
                    icon={<LayoutGrid className="w-5 h-5 text-indigo-500" />}
                />
                <KPICard
                    title="Recebimentos"
                    value={data?.totalReceipts || 0}
                    icon={<TrendingUp className="w-5 h-5 text-purple-500" />}
                    isCurrency
                />
                <KPICard
                    title="Custo Medio Mensal"
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
                            Evolucao de Gastos
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
                    <h3 className="font-semibold text-lg">Distribuicao por Categoria</h3>
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

            {/* Tax and Fee Analysis Section */}
            {data && <TaxAnalysisSummary data={data.taxAnalysis} />}
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

function TaxAnalysisSummary({ data }: { data: TaxAnalysisData }) {
    return (
        <div className="glass p-8 rounded-3xl space-y-8 border border-white/10 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
                <DollarSign className="w-32 h-32" />
            </div>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/10 pb-6">
                <div>
                    <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                        <div className="p-2 bg-primary-app/20 rounded-lg">
                            <BarChart3 className="w-6 h-6 text-primary-app" />
                        </div>
                        Analise de Impostos e Tarifas
                    </h3>
                    <p className="text-muted-foreground mt-1">Detalhamento fiscal e financeiro do periodo</p>
                </div>
                <div className="bg-white/5 px-4 py-2 rounded-xl border border-white/5">
                    <span className="text-sm text-muted-foreground">Status: </span>
                    <span className="text-sm font-semibold text-primary-app uppercase tracking-wider">Consolidado</span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                {/* Left Side: Encargos Table */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between px-2">
                        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Encargos</span>
                        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground text-right">Valor</span>
                    </div>

                    <div className="space-y-1">
                        <TaxRow label="INSS" value={data.inss} />
                        <TaxRow label="FGTS" value={data.fgts} />
                        <TaxRow label="IR - 1,5%" value={data.ir} />
                        <TaxRow label="ISS" value={data.iss} />
                        <TaxRow label="PIS - 0,65%" value={data.pis} />
                        <TaxRow label="COFINS - 3%" value={data.cofins} />
                        <TaxRow label="CSLL - 2,8%" value={data.csll} />
                        <div className="pt-4 mt-4 border-t border-white/10">
                            <TaxRow label="TOTAL" value={data.totalEncargos} isTotal />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 pt-8">
                        <div className="glass-light p-5 rounded-2xl border border-white/5 space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">DESPESAS + ENCARGOS + EM ABERTO</span>
                                <div className="px-3 py-1 bg-yellow-500/10 rounded-full border border-yellow-500/20">
                                    <span className="text-[10px] font-bold text-yellow-500 uppercase">Custo Total</span>
                                </div>
                            </div>
                            <div className="text-3xl font-black text-white tabular-nums">
                                {formatCurrency(data.custoTotal)}
                            </div>
                        </div>

                        <div className="glass-light p-5 rounded-2xl border border-white/5 space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">CUSTO - VALOR RECEBIDO</span>
                                <div className="px-3 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                                    <span className="text-[10px] font-bold text-emerald-500 uppercase">Diferenca</span>
                                </div>
                            </div>
                            <div className="text-3xl font-black text-white tabular-nums">
                                {formatCurrency(data.diferenca)}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Side: Detailed Metrics */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between px-2">
                        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Detalhamento de Contrato</span>
                        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground text-right">Valor</span>
                    </div>

                    <div className="space-y-2">
                        <MetricRow label="VALOR BRUTO NF" value={data.valorBrutoNF} />
                        <MetricRow label="VALOR REAJUSTE" value={data.valorReajuste} />
                        <MetricRow label="VALOR LIQUIDO/RECEBIDO NF" value={data.valorLiquidoNF} isHighlight />
                        <MetricRow label="VALOR DO CONTRATO" value={data.valorContrato} />
                        <MetricRow label="SALDO DO CONTRATO/A MEDIR" value={data.saldoContrato} isNegative />
                        <MetricRow label="FORNECEDORES EM ABERTO" value={data.fornecedoresAberto} />
                        <MetricRow label="MAQUINAS E EQUIPAMENTOS" value={data.maquinasEquipamentos} />
                        <MetricRow label="CUSTOS FINANCEIROS - 6%" value={data.custosFinanceiros} />
                        <MetricRow label="ESCRITORIO CENTRAL - 4%" value={data.escritorioCentral} />
                    </div>
                </div>
            </div>
        </div>
    )
}

function TaxRow({ label, value, isTotal = false }: { label: string, value: number, isTotal?: boolean }) {
    return (
        <div className={`flex items-center justify-between px-4 py-3 rounded-xl transition-colors ${isTotal ? 'bg-primary-app/10 font-bold' : 'hover:bg-white/5'}`}>
            <span className={isTotal ? 'text-white' : 'text-slate-300'}>{label}</span>
            <span className={`tabular-nums ${isTotal ? 'text-primary-app text-lg' : 'text-white'}`}>
                {formatCurrency(value)}
            </span>
        </div>
    )
}

function MetricRow({ label, value, isHighlight = false, isNegative = false }: { label: string, value: number, isHighlight?: boolean, isNegative?: boolean }) {
    return (
        <div className={`flex items-center justify-between px-4 py-3 rounded-xl border border-transparent transition-all ${isHighlight ? 'bg-primary-app/5 border-primary-app/20' : 'hover:border-white/5 hover:bg-white/5'}`}>
            <span className={`text-xs font-medium uppercase tracking-wide ${isHighlight ? 'text-primary-app' : 'text-slate-400'}`}>
                {label}
            </span>
            <span className={`font-bold tabular-nums ${isHighlight ? 'text-xl text-white' : isNegative ? 'text-rose-400' : 'text-slate-200'}`}>
                {isNegative ? `- ${formatCurrency(Math.abs(value))}` : formatCurrency(value)}
            </span>
        </div>
    )
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
