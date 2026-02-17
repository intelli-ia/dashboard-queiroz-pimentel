"use client"

import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchAll } from '@/lib/supabase-utils'
import { format, subDays, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Loader2, Banknote, TrendingUp, Hash, Calculator, FileText, PieChart as PieChartIcon } from 'lucide-react'
import {
  LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import GlobalFilterBar from './GlobalFilterBar'
import type { PageProps, FinancialMovement } from '@/types'

const CHART_COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#f97316']

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

interface MovementWithCategory extends FinancialMovement {
  category_description?: string
}

export default function DashboardPage({ timeRange, setTimeRange, customDates, setCustomDates, selectedProject, setSelectedProject, projects }: PageProps) {
  const [loading, setLoading] = useState(true)
  const [movements, setMovements] = useState<MovementWithCategory[]>([])

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

      // Build query
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
          project_code
        `)
        .gte('data_pagamento', startDate)
        .lte('data_pagamento', endDate)
        .order('data_pagamento', { ascending: true })

      if (selectedProject) {
        query = query.eq('project_code', selectedProject)
      }

      const rawData = await fetchAll<FinancialMovement>(query)

      // Map category descriptions
      const mappedData: MovementWithCategory[] = rawData?.map(item => ({
        ...item,
        category_description: categoryMap.get(item.category_code || '') || 'Sem Categoria'
      })) || []

      setMovements(mappedData)
    } catch (err) {
      console.error('Error fetching dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }, [timeRange, customDates, selectedProject])

  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  // KPI 1: Total Pagamentos (natureza='S' com liquidado=true)
  const totalPagamentos = useMemo(() => {
    return movements
      .filter(m => m.natureza === 'S' && m.liquidado)
      .reduce((sum, m) => sum + (m.valor_pago || m.valor_liquido || m.valor_titulo || 0), 0)
  }, [movements])

  // KPI 2: Total Receitas (natureza='E')
  const totalReceitas = useMemo(() => {
    return movements
      .filter(m => m.natureza === 'E')
      .reduce((sum, m) => sum + (m.valor_pago || m.valor_liquido || m.valor_titulo || 0), 0)
  }, [movements])

  // KPI 3: Total Transacoes
  const totalTransacoes = useMemo(() => movements.length, [movements])

  // KPI 4: Custo Medio Mensal
  const custoMedioMensal = useMemo(() => {
    const monthlyTotals = new Map<string, number>()
    movements
      .filter(m => m.natureza === 'S' && m.data_pagamento)
      .forEach(m => {
        const monthKey = m.data_pagamento!.substring(0, 7)
        const valor = m.valor_pago || m.valor_liquido || m.valor_titulo || 0
        monthlyTotals.set(monthKey, (monthlyTotals.get(monthKey) || 0) + valor)
      })
    const totalMonths = monthlyTotals.size
    const totalValue = Array.from(monthlyTotals.values()).reduce((a, b) => a + b, 0)
    return totalMonths > 0 ? totalValue / totalMonths : 0
  }, [movements])

  // Line Chart Data: Monthly paid values
  const monthlyChartData = useMemo(() => {
    const monthlyMap = new Map<string, number>()
    movements
      .filter(m => m.natureza === 'S' && m.data_pagamento)
      .forEach(m => {
        const monthKey = m.data_pagamento!.substring(0, 7)
        const valor = m.valor_pago || m.valor_liquido || m.valor_titulo || 0
        monthlyMap.set(monthKey, (monthlyMap.get(monthKey) || 0) + valor)
      })
    return Array.from(monthlyMap, ([month, value]) => ({
      month: format(parseISO(month + '-01'), 'MMM/yy', { locale: ptBR }),
      monthSort: month,
      value
    })).sort((a, b) => a.monthSort.localeCompare(b.monthSort))
  }, [movements])

  // Pie Chart 1: Payments by Category
  const categoryChartData = useMemo(() => {
    const categoryMap = new Map<string, number>()
    movements
      .filter(m => m.natureza === 'S')
      .forEach(m => {
        const cat = m.category_description || 'Sem Categoria'
        const valor = m.valor_pago || m.valor_liquido || m.valor_titulo || 0
        categoryMap.set(cat, (categoryMap.get(cat) || 0) + valor)
      })
    return Array.from(categoryMap, ([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [movements])

  // Pie Chart 2: Payments by Document Type
  const documentTypeChartData = useMemo(() => {
    const docTypeMap = new Map<string, number>()
    movements
      .filter(m => m.natureza === 'S')
      .forEach(m => {
        const docType = m.document_type || 'Outros'
        const valor = m.valor_pago || m.valor_liquido || m.valor_titulo || 0
        docTypeMap.set(docType, (docTypeMap.get(docType) || 0) + valor)
      })
    return Array.from(docTypeMap, ([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [movements])

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
          <div className="text-3xl font-bold text-white">{formatCurrency(totalPagamentos)}</div>
          <p className="text-xs text-muted-foreground">Saidas liquidadas no periodo</p>
        </div>

        {/* Receitas */}
        <div className="glass p-6 rounded-2xl space-y-2">
          <div className="flex items-center gap-2 text-green-400 text-sm font-medium uppercase tracking-wider">
            <TrendingUp className="w-4 h-4" />
            Receitas
          </div>
          <div className="text-3xl font-bold text-green-400">{formatCurrency(totalReceitas)}</div>
          <p className="text-xs text-muted-foreground">Entradas no periodo</p>
        </div>

        {/* Transacoes */}
        <div className="glass p-6 rounded-2xl space-y-2">
          <div className="flex items-center gap-2 text-indigo-400 text-sm font-medium uppercase tracking-wider">
            <Hash className="w-4 h-4" />
            Transacoes
          </div>
          <div className="text-3xl font-bold text-indigo-400">{totalTransacoes.toLocaleString('pt-BR')}</div>
          <p className="text-xs text-muted-foreground">Total de movimentacoes</p>
        </div>

        {/* Custo Medio Mensal */}
        <div className="glass p-6 rounded-2xl space-y-2">
          <div className="flex items-center gap-2 text-orange-400 text-sm font-medium uppercase tracking-wider">
            <Calculator className="w-4 h-4" />
            Custo Medio Mensal
          </div>
          <div className="text-3xl font-bold text-orange-400">{formatCurrency(custoMedioMensal)}</div>
          <p className="text-xs text-muted-foreground">Media de saidas por mes</p>
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
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-primary-app" />
            <h3 className="text-lg font-semibold">Valores Pagos Mes a Mes</h3>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyChartData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis
                  dataKey="month"
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                />
                <YAxis
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  tickFormatter={(value) => `R$ ${value >= 1000000
                    ? (value / 1000000).toFixed(1) + 'M'
                    : value >= 1000
                      ? (value / 1000).toFixed(0) + 'k'
                      : value}`}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  width={70}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-2xl">
                          <p className="text-muted-foreground text-sm mb-1">{label}</p>
                          <p className="text-primary-app font-bold text-lg">
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
                  dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, fill: '#6366f1' }}
                />
              </LineChart>
            </ResponsiveContainer>
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
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name.length > 15 ? name.substring(0, 15) + '...' : name} (${(percent * 100).toFixed(0)}%)`}
                      labelLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
                    >
                      {categoryChartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
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

          {/* Pie Chart 2: Document Type */}
          {documentTypeChartData.length > 0 && (
            <div className="glass rounded-xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-primary-app" />
                <h3 className="text-lg font-semibold">Pagamentos por Tipo de Documento</h3>
              </div>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={documentTypeChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      labelLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
                    >
                      {documentTypeChartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-2xl">
                              <p className="text-white font-semibold text-sm mb-1">
                                {docTypeLabels[payload[0].name as string] || payload[0].name}
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
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
