"use client"

import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchAll } from '@/lib/supabase-utils'
import { format, subDays, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Loader2, Banknote, TrendingUp, Hash, Calculator, FileText, PieChart as PieChartIcon, LayoutDashboard } from 'lucide-react'
import {
  AreaChart, Area, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, LabelList
} from 'recharts'
import GlobalFilterBar from './GlobalFilterBar'
import type { PageProps, FinancialMovement, AccountReceivable, AccountPayable } from '@/types'

const CHART_COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#f97316']

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

const formatCompact = (value: number) => {
  if (value >= 1000000) return (value / 1000000).toFixed(1).replace('.', ',') + 'M'
  if (value >= 1000) return (value / 1000).toFixed(0) + 'K'
  return value.toString()
}

interface MovementWithCategory extends FinancialMovement {
  category_description?: string
}

export default function DashboardPage({ timeRange, setTimeRange, customDates, setCustomDates, selectedProject, setSelectedProject, projects }: PageProps) {
  const [loading, setLoading] = useState(true)
  const [movements, setMovements] = useState<MovementWithCategory[]>([])
  const [receivables, setReceivables] = useState<AccountReceivable[]>([])
  const [taxPayables, setTaxPayables] = useState<AccountPayable[]>([])
  const [interactiveTimeRange, setInteractiveTimeRange] = useState('all')

  const resolvedProjectCode = useMemo(() => {
    if (!selectedProject) return ''
    const project = projects.find(p => p.id === selectedProject || p.name === selectedProject)
    return project?.id || selectedProject
  }, [selectedProject, projects])

  const selectedProjectLabel = useMemo(() => {
    if (!selectedProject) return ''
    const project = projects.find(p => p.id === selectedProject || p.name === selectedProject)
    return project?.name || selectedProject
  }, [selectedProject, projects])

  const fetchDashboardData = useCallback(async () => {
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

      // Fetch categories for mapping
      const { data: categoriesRaw } = await supabase
        .from('categories')
        .select('code, description')
      const categoryMap = new Map(
        categoriesRaw?.map((c: { code: string; description: string }) => [c.code, c.description]) || []
      )

      // Build query - filtra apenas CONTA_CORRENTE_PAG para exibir impacto real no caixa
      let query = supabase
        .from('financial_movements')
        .select(`
          codigo_titulo,
          natureza,
          liquidado,
          data_pagamento,
          valor_titulo,
          valor_liquido,
          valor_pago,
          category_code,
          document_type,
          project_code,
          grupo,
          direcao,
          is_efetivado
        `)
        .eq('direcao', 'SAIDA')
        .eq('is_efetivado', true)
        .not('data_pagamento', 'is', null)
        .gte('data_pagamento', startDate)
        .lte('data_pagamento', endDate)
        .order('data_pagamento', { ascending: true })

      // Retirado filtro por projeto para permitir exibição completa no gráfico de projetos com highlight
      /*
      if (selectedProject) {
        query = query.eq('project_code', selectedProject)
      }
      */

      const rawData = await fetchAll<FinancialMovement>(query)

      // Map category descriptions
      const mappedData: MovementWithCategory[] = rawData?.map(item => ({
        ...item,
        category_description: categoryMap.get(item.category_code || '') || 'Sem Categoria'
      })) || []

      setMovements(mappedData)

      // Fetch accounts_receivable for Receitas
      let receivablesQuery = supabase
        .from('accounts_receivable')
        .select(`
          codigo_lancamento_omie,
          project_code,
          project_name,
          data_vencimento,
          valor_documento,
          status_titulo
        `)
        .gte('data_vencimento', startDate)
        .lte('data_vencimento', endDate)

      // Retirado filtro por projeto
      /*
      if (selectedProject) {
        receivablesQuery = receivablesQuery.eq('project_code', selectedProject)
      }
      */

      const receivablesData = await fetchAll<AccountReceivable>(receivablesQuery)
      setReceivables(receivablesData || [])

      // Fetch accounts_payable for Tax Analysis
      let taxQuery = supabase
        .from('accounts_payable')
        .select(`
          valor_inss,
          valor_ir,
          valor_iss,
          valor_pis,
          valor_cofins,
          valor_csll,
          status_titulo,
          data_vencimento,
          project_code,
          project_name
        `)
        .in('status_titulo', ['PAGO', 'LIQUIDADO', 'Pago', 'Liquidado'])
        .gte('data_vencimento', startDate)
        .lte('data_vencimento', endDate)

      const taxData = await fetchAll<AccountPayable>(taxQuery)
      setTaxPayables(taxData || [])
    } catch (err) {
      console.error('Error fetching dashboard data:', err)
    } finally {
      setLoading(true) // Wait, why was this false? Oh, it was finally{setLoading(false)}.
      setLoading(false)
    }
  }, [timeRange, customDates])

  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  // KPI 1: Total Pagamentos - soma APENAS do campo valor_pago de SAIDAS
  const totalPagamentos = useMemo(() => {
    return movements
      .filter(m => !resolvedProjectCode || m.project_code === resolvedProjectCode)
      .reduce((sum, m) => sum + (m.valor_pago || 0), 0)
  }, [movements, resolvedProjectCode])

  // KPI 2: Total Receitas (da tabela accounts_receivable)
  const totalReceitas = useMemo(() => {
    return receivables
      .filter(r => {
        if (!selectedProject) return true
        // Filter by project_code (ID) OR project_name (Label)
        return r.project_code === resolvedProjectCode || r.project_name === selectedProjectLabel
      })
      .reduce((sum, r) => sum + (r.valor_documento || 0), 0)
  }, [receivables, selectedProject, resolvedProjectCode])

  // KPI 3: Total Transacoes
  const totalTransacoes = useMemo(() =>
    movements.filter(m => !resolvedProjectCode || m.project_code === resolvedProjectCode).length,
    [movements, resolvedProjectCode])

  // KPI 4: Custo Medio Mensal
  const custoMedioMensal = useMemo(() => {
    const monthlyTotals = new Map<string, number>()
    movements
      .filter(m => !selectedProject || m.project_code === selectedProject)
      .forEach(m => {
        const monthKey = m.data_pagamento!.substring(0, 7)
        const valor = m.valor_pago || 0
        monthlyTotals.set(monthKey, (monthlyTotals.get(monthKey) || 0) + valor)
      })
    const totalMonths = monthlyTotals.size
    const totalValue = Array.from(monthlyTotals.values()).reduce((a, b) => a + b, 0)
    return totalMonths > 0 ? totalValue / totalMonths : 0
  }, [movements, resolvedProjectCode])

  // Line Chart Data: Monthly paid values
  const monthlyChartData = useMemo(() => {
    const monthlyMap = new Map<string, number>()
    movements
      .filter(m => !selectedProject || m.project_code === selectedProject)
      .forEach(m => {
        const monthKey = m.data_pagamento!.substring(0, 7)
        const valor = m.valor_pago || 0
        monthlyMap.set(monthKey, (monthlyMap.get(monthKey) || 0) + valor)
      })
    return Array.from(monthlyMap, ([month, value]) => ({
      month: format(parseISO(month + '-01'), 'MMM/yy', { locale: ptBR }),
      monthSort: month,
      value
    })).sort((a, b) => a.monthSort.localeCompare(b.monthSort))
  }, [movements, resolvedProjectCode])

  // Pie Chart 1: Payments by Category
  const categoryChartData = useMemo(() => {
    const categoryMap = new Map<string, number>()
    movements
      .filter(m => !selectedProject || m.project_code === selectedProject)
      .forEach(m => {
        const cat = m.category_description || 'Sem Categoria'
        const valor = m.valor_pago || 0
        categoryMap.set(cat, (categoryMap.get(cat) || 0) + valor)
      })
    return Array.from(categoryMap, ([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [movements, resolvedProjectCode])

  // Interactive Area Chart Data: Daily cost over time
  const interactiveChartData = useMemo(() => {
    // 1. Group daily
    const dailyMap = new Map<string, number>()
    movements
      .filter(m => !selectedProject || m.project_code === selectedProject)
      .forEach(m => {
        const dateKey = m.data_pagamento!
        const valor = m.valor_pago || 0
        dailyMap.set(dateKey, (dailyMap.get(dateKey) || 0) + valor)
      })

    const allDays = Array.from(dailyMap, ([date, valor]) => ({
      date,
      valor
    })).sort((a, b) => a.date.localeCompare(b.date))

    // 2. Filter by interactiveTimeRange
    if (interactiveTimeRange === 'all') return allDays

    const daysToSubtract = parseInt(interactiveTimeRange)
    const referenceDate = new Date()
    const startDate = subDays(referenceDate, daysToSubtract)
    const resultData = allDays.filter(item => parseISO(item.date) >= startDate)
    return resultData
  }, [movements, interactiveTimeRange, resolvedProjectCode])

  // Pie Chart 2: Payments by Document Type
  const documentTypeChartData = useMemo(() => {
    const docTypeMap = new Map<string, number>()
    movements
      .filter(m => !selectedProject || m.project_code === selectedProject)
      .forEach(m => {
        const docType = m.document_type || 'Outros'
        const valor = m.valor_pago || 0
        docTypeMap.set(docType, (docTypeMap.get(docType) || 0) + valor)
      })
    return Array.from(docTypeMap, ([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [movements, resolvedProjectCode])

  // Bar Chart 1: Payments by Project
  const projectChartData = useMemo(() => {
    const projectMap = new Map(projects.map(p => [p.id, p.name]))
    const projectTotals = new Map<string, { name: string; value: number; id: string }>()

    movements.forEach(m => {
      const pCode = m.project_code || 'Sem Projeto'
      const projectName = projectMap.get(m.project_code || '') || 'Sem Projeto'
      const valor = m.valor_pago || 0

      if (!projectTotals.has(pCode)) {
        projectTotals.set(pCode, { name: projectName, value: 0, id: pCode })
      }
      projectTotals.get(pCode)!.value += valor
    })

    return Array.from(projectTotals.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
  }, [movements, projects])

  // Tax Analysis Chart Data
  const taxChartData = useMemo(() => {
    const totals = {
      INSS: 0,
      IR: 0,
      ISS: 0,
      PIS: 0,
      COFINS: 0,
      CSLL: 0
    }

    const normalizedPriceFilter = selectedProjectLabel.toLowerCase().trim()
    const normalizedIdFilter = resolvedProjectCode.toLowerCase().trim()

    taxPayables
      .filter(p => {
        if (!selectedProject) return true
        const pName = (p.project_name || '').toLowerCase().trim()
        const pCode = (p.project_code || '').toLowerCase().trim()
        return pCode === normalizedIdFilter || pName === normalizedPriceFilter
      })
      .forEach(p => {
        totals.INSS += Number(p.valor_inss) || 0
        totals.IR += Number(p.valor_ir) || 0
        totals.ISS += Number(p.valor_iss) || 0
        totals.PIS += Number(p.valor_pis) || 0
        totals.COFINS += Number(p.valor_cofins) || 0
        totals.CSLL += Number(p.valor_csll) || 0
      })

    return [
      { name: 'INSS', value: totals.INSS },
      { name: 'IR', value: totals.IR },
      { name: 'ISS', value: totals.ISS },
      { name: 'PIS', value: totals.PIS },
      { name: 'COFINS', value: totals.COFINS },
      { name: 'CSLL', value: totals.CSLL },
    ].sort((a, b) => b.value - a.value)
  }, [taxPayables, selectedProject, selectedProjectLabel, resolvedProjectCode])


  const docTypeLabels: Record<string, string> = {
    'NFE': 'Nota Fiscal Eletronica',
    'NFS': 'Nota Fiscal de Servico',
    'BOL': 'Boleto',
    'REC': 'Recibo',
    'PIX': 'Pagamento PIX',
    'TED': 'Transferencia TED',
    'DIN': 'Dinheiro'
  }

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
        title="Dashboard Financeiro"
        subtitle="Visao geral das movimentacoes financeiras"
        loading={loading}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Pagamentos */}
        <div className="glass p-6 rounded-2xl space-y-2">
          <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium uppercase tracking-wider">
            <Banknote className="w-4 h-4" />
            Pagamentos
          </div>
          <div className="text-2xl font-bold text-white">{formatCurrency(totalPagamentos)}</div>
          <p className="text-sm text-muted-foreground">Saídas efetivadas (Fluxo de Caixa)</p>
          <p className="text-[10px] text-muted-foreground mt-1 uppercase italic">* Baseado na data de pagamento</p>
        </div>

        {/* Receitas */}
        <div className="glass p-6 rounded-2xl space-y-2">
          <div className="flex items-center gap-2 text-green-400 text-sm font-medium uppercase tracking-wider">
            <TrendingUp className="w-4 h-4" />
            Receitas
          </div>
          <div className="text-2xl font-bold text-green-400">{formatCurrency(totalReceitas)}</div>
          <p className="text-sm text-muted-foreground">Contas a Receber no período</p>
        </div>

        {/* Transacoes */}
        <div className="glass p-6 rounded-2xl space-y-2">
          <div className="flex items-center gap-2 text-indigo-400 text-sm font-medium uppercase tracking-wider">
            <Hash className="w-4 h-4" />
            Transações
          </div>
          <div className="text-2xl font-bold text-indigo-400">{totalTransacoes.toLocaleString('pt-BR')}</div>
          <p className="text-sm text-muted-foreground">Total de pagamentos efetivados</p>
        </div>

        {/* Custo Medio Mensal */}
        <div className="glass p-6 rounded-2xl space-y-2">
          <div className="flex items-center gap-2 text-orange-400 text-sm font-medium uppercase tracking-wider">
            <Calculator className="w-4 h-4" />
            Custo Médio Mensal
          </div>
          <div className="text-2xl font-bold text-orange-400">{formatCurrency(custoMedioMensal)}</div>
          <p className="text-sm text-muted-foreground">Média de saídas por mês</p>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary-app" />
        </div>
      )}

      {/* Line Chart - Monthly Values */}
      {!loading && monthlyChartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass rounded-xl p-6 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary-app" />
                <div>
                  <h3 className="text-lg font-semibold text-white">Custo Diário</h3>
                  <p className="text-sm text-muted-foreground">Evolução diária dos pagamentos efetivados</p>
                </div>
              </div>
              <select
                value={interactiveTimeRange}
                onChange={(e) => setInteractiveTimeRange(e.target.value)}
                className="bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary-app/50 cursor-pointer"
              >
                <option value="all">Todo o período</option>
                <option value="90">Últimos 90 dias</option>
                <option value="30">Últimos 30 dias</option>
                <option value="7">Últimos 7 dias</option>
              </select>
            </div>

            <div className="h-[300px] w-full mt-auto">
              {interactiveChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={interactiveChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="fillCusto" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: '#94a3b8', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      tickMargin={12}
                      minTickGap={30}
                      tickFormatter={(value) => format(parseISO(value), 'dd MMM', { locale: ptBR })}
                    />
                    <YAxis
                      tick={{ fill: '#94a3b8', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value) => `R$ ${value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value}`}
                      width={45}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-2xl backdrop-blur-md bg-opacity-90">
                              <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider mb-1">
                                {format(parseISO(payload[0].payload.date), "dd 'de' MMMM/yyyy", { locale: ptBR })}
                              </p>
                              <p className="text-white font-bold text-lg">
                                {formatCurrency(payload[0].value as number)}
                              </p>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="valor"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#fillCusto)"
                      activeDot={{ r: 4, strokeWidth: 0, fill: '#6366f1' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  Nenhum dado para o período selecionado
                </div>
              )}
            </div>
          </div>

          <div className="glass rounded-xl p-6 flex flex-col">
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp className="w-5 h-5 text-primary-app" />
              <div>
                <h3 className="text-lg font-semibold text-white">Visão Mensal</h3>
                <p className="text-xs text-muted-foreground">Consolidado de pagamentos por mês</p>
              </div>
            </div>
            <div className="h-[300px] w-full mt-auto">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickMargin={12}
                  />
                  <YAxis
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => `R$ ${value >= 1000000 ? (value / 1000000).toFixed(1) + 'M' : value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value}`}
                    width={45}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-2xl backdrop-blur-md bg-opacity-90">
                            <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider mb-1">{label}</p>
                            <p className="text-white font-bold text-lg">
                              {formatCurrency(payload[0].value as number)}
                            </p>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6', r: 3, strokeWidth: 0 }}
                    activeDot={{ r: 5, strokeWidth: 0, fill: '#6366f1' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Two Pie Charts side by side */}
      {!loading && (categoryChartData.length > 0 || documentTypeChartData.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pie Chart 1: Category */}
          {categoryChartData.length > 0 && (
            <div className="glass rounded-xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <PieChartIcon className="w-5 h-5 text-primary-app" />
                <h3 className="text-lg font-semibold">Pagamentos por Categoria</h3>
              </div>
              <div className="h-[550px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryChartData}
                      cx="50%"
                      cy="42%"
                      innerRadius={100}
                      outerRadius={150}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {categoryChartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} stroke="none" />
                      ))}
                    </Pie>
                    <Legend
                      content={(props) => (
                        <ul className="grid grid-cols-2 gap-x-8 gap-y-2 mt-4 px-4">
                          {props.payload?.map((entry: any, index: number) => {
                            const val = entry.payload.value
                            const formattedVal = formatCompact(val)
                            return (
                              <li key={`item-${index}`} className="flex items-center justify-between border-b border-white/5 pb-1">
                                <div className="flex items-center gap-2 overflow-hidden">
                                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                                  <span className="text-muted-foreground text-[11px] truncate">{entry.value}</span>
                                </div>
                                <span className="text-white text-[11px] font-bold ml-4 shrink-0">{formattedVal}</span>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-2xl">
                              <p className="text-white font-semibold text-sm mb-1">{payload[0].name}</p>
                              <p className="text-primary-app font-bold text-lg">
                                {formatCurrency(payload[0].value as number)}
                              </p>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Chart 2: Document Type (Horizontal Bars) */}
          {documentTypeChartData.length > 0 && (
            <div className="glass rounded-xl p-6 flex flex-col">
              <div className="flex items-center gap-2 mb-6">
                <FileText className="w-5 h-5 text-primary-app" />
                <h3 className="text-lg font-semibold">Pagamentos por Tipo de Documento</h3>
              </div>
              <div className="h-[480px] w-full mt-auto">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={documentTypeChartData}
                    layout="vertical"
                    margin={{ top: 5, right: 100, left: 40, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="name"
                      type="category"
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={100}
                      tickFormatter={(value) => docTypeLabels[value] || value}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-2xl backdrop-blur-md bg-opacity-90">
                              <p className="text-white font-semibold text-sm mb-1">
                                {docTypeLabels[payload[0].payload.name as string] || payload[0].payload.name}
                              </p>
                              <p className="text-primary-app font-bold text-lg">
                                {formatCurrency(payload[0].value as number)}
                              </p>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Bar
                      dataKey="value"
                      radius={[0, 4, 4, 0]}
                      barSize={24}
                    >
                      {documentTypeChartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                      <LabelList
                        dataKey="value"
                        position="right"
                        style={{ fill: '#fff', fontSize: 11, fontWeight: 'bold' }}
                        formatter={(val: number) => {
                          return ` ${formatCompact(val)}`
                        }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

        </div>
      )}

      {/* Project Costs Chart (Full Width) */}
      {!loading && projectChartData.length > 0 && (
        <div className="glass rounded-xl p-6 flex flex-col mt-6">
          <div className="flex items-center gap-2 mb-6">
            <LayoutDashboard className="w-5 h-5 text-primary-app" />
            <h3 className="text-lg font-semibold">Pagamentos por Projeto</h3>
          </div>
          <div className="h-[480px] w-full mt-auto">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={projectChartData}
                layout="vertical"
                margin={{ top: 5, right: 150, left: 40, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={150}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-2xl backdrop-blur-md bg-opacity-90">
                          <p className="text-white font-semibold text-sm mb-1">
                            {payload[0].payload.name}
                          </p>
                          <p className="text-primary-app font-bold text-lg">
                            {formatCurrency(payload[0].value as number)}
                          </p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Bar
                  dataKey="value"
                  radius={[0, 4, 4, 0]}
                  barSize={24}
                >
                  {projectChartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={CHART_COLORS[index % CHART_COLORS.length]}
                      fillOpacity={!resolvedProjectCode || resolvedProjectCode === entry.id ? 1 : 0.3}
                    />
                  ))}
                  <LabelList
                    dataKey="value"
                    position="right"
                    style={{ fill: '#fff', fontSize: 11, fontWeight: 'bold' }}
                    formatter={(val: number) => {
                      return ` ${formatCompact(val)}`
                    }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      )}

      {/* Tax Analysis Chart */}
      {!loading && taxChartData.length > 0 && (
        <div className="glass rounded-xl p-6 flex flex-col mt-6">
          <div className="flex items-center gap-2 mb-6">
            <Calculator className="w-5 h-5 text-primary-app" />
            <h3 className="text-lg font-semibold text-white">Análise de Impostos Pagos</h3>
          </div>
          <div className="h-[350px] w-full mt-auto">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={taxChartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => `R$ ${formatCompact(value)}`}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-2xl backdrop-blur-md bg-opacity-90">
                          <p className="text-white font-semibold text-sm mb-1">
                            {payload[0].payload.name}
                          </p>
                          <p className="text-primary-app font-bold text-lg">
                            {formatCurrency(payload[0].value as number)}
                          </p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Bar
                  dataKey="value"
                  radius={[4, 4, 0, 0]}
                  barSize={60}
                >
                  {taxChartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                  <LabelList
                    dataKey="value"
                    position="top"
                    style={{ fill: '#fff', fontSize: 11, fontWeight: 'bold' }}
                    formatter={(val: number) => formatCompact(val)}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
