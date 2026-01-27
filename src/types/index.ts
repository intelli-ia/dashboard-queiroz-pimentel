// Financial transaction types
export interface FinancialTransaction {
  id: string
  transaction_date: string
  transaction_name: string
  total_value: number
  quantity_received: number
  department_id: string
  superior_category: string
  departments?: { name: string }
  categories?: {
    category_description: string
    category_code?: string
    category_type?: string
  }
}

export interface Department {
  id: string
  name: string
  omie_department_id: string
  is_active: boolean
}

export interface Category {
  id: string
  category_code: string
  category_description: string
  category_type: string
  is_active: boolean
}

// Page Props
export interface PageProps {
  timeRange: string
  setTimeRange: (range: string) => void
  customDates: { start: string; end: string }
  setCustomDates: (dates: { start: string; end: string }) => void
}

// Chart types
export interface ChartDataPoint {
  date: string
  value: number
}

export interface DepartmentChart {
  name: string
  value: number
}

export interface CategoryChart {
  name: string
  value: number
}

export interface StackedChartData {
  name: string
  total: number
  [key: string]: string | number
}

// Dashboard specific
export interface DashboardData {
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

// Items page aggregation
export interface AggregatedItem {
  key: string
  product_description: string
  department_id: string
  department_name: string
  category_description: string
  total_value: number
  quantity: number
  occurrences: number
  latest_date: string
  unit_value: number
}

export interface SortConfig {
  key: string
  direction: 'asc' | 'desc'
}

// KPI Card props
export interface KPICardProps {
  title: string
  value: number
  icon: React.ReactNode
  trend: string
  isPositive: boolean
  isCurrency?: boolean
}

// Tooltip props for recharts - using flexible types to match recharts' internal types
export interface TooltipEntry {
  name?: string
  value: number
  fill?: string
}

export interface CustomTooltipProps {
  active?: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[]
  label?: string
}
