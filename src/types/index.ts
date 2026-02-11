// New Schema Types
export interface Project {
  id: string
  name: string
  full_description: string
}

export interface Category {
  id: string
  code: string
  parent_code?: string
  name: string
  description: string
  standard_description: string
  full_description: string
  category_code?: string // For backward compatibility
  category_description?: string // For backward compatibility
  category_type?: string // For backward compatibility
  is_active?: boolean
}

// Purchases - Tabela de notas fiscais de compra (antiga purchase_invoices)
export interface Purchase {
  invoice_key: string
  invoice_number?: string
  issue_date: string
  purchase_category: string // Renamed from category_id
  project_id: string
  supplier_legal_name?: string
  supplier_tax_id?: string
  invoice_total_amount?: number
  total_installments?: number
  // Campos fiscais
  icms_value?: number
  total_pis?: number
  total_cofins?: number
  approx_tax_value?: number
  // Dados de transporte
  carrier_name?: string
  freight_type?: string
  gross_weight?: number
  // Relações
  categories?: Category
  projects?: Project
}

// Alias para compatibilidade
export type PurchaseInvoice = Purchase

// Purchase Items - Itens das notas fiscais (antiga purchase_invoice_items)
export interface PurchaseItem {
  invoice_key: string
  item_sequence: number // Renamed from item_internal_id
  product_code?: string
  product_description: string
  ncm_code?: string
  quantity: number
  unit_price?: number
  total_item_value: number
  // Tributos por item
  icms_value?: number
  pis_value?: number
  cofins_value?: number
  approx_tax_value?: number
  // Relações
  purchases?: Purchase
}

// Alias para compatibilidade
export type PurchaseInvoiceItem = PurchaseItem

export interface FinancialInstallment {
  installment_id: string
  invoice_key: string
  due_date: string
  installment_value: number
  purchases?: Purchase
}

// Financial Movements - Tabela principal de movimentações financeiras (antiga financial_accounts_payable)
export interface FinancialMovement {
  title_id: string
  invoice_key: string | null
  invoice_number: string | null
  supplier_tax_id: string | null
  category_id: string | null
  project_id: string | null
  status: string | null
  is_paid: boolean | null
  issue_date: string | null
  due_date: string | null
  payment_date: string | null
  forecast_date: string | null
  original_amount: number | null
  discount_amount: number | null
  interest_amount: number | null
  penalty_amount: number | null
  paid_amount: number | null
  open_amount: number | null
  net_amount: number | null
  installment_label: string | null
  // Relações
  projects?: Project
  categories?: Category
  purchases?: Purchase
}

// Alias para compatibilidade
export type FinancialAccountsPayable = FinancialMovement

// Legacy/UI Compatibility Types
export interface FinancialTransaction {
  id: string
  transaction_date: string
  transaction_name: string
  total_value: number
  quantity_received: number
  department_id: string
  superior_category: string
  document_number?: string
  departments?: { name: string }
  projects?: { name: string } // Support new schema
  categories?: {
    category_description: string
    name?: string // Support new schema
    category_code?: string
    category_type?: string
  }
}

// Keep old interfaces for now to avoid breaking other things
export interface Department {
  id: string
  name: string
  omie_department_id: string
  is_active: boolean
}

// Project option for filter dropdown
export interface ProjectOption {
  id: string
  name: string
}

// Page Props
export interface PageProps {
  timeRange: string
  setTimeRange: (range: string) => void
  customDates: { start: string; end: string }
  setCustomDates: (dates: { start: string; end: string }) => void
  // Project filter
  selectedProject: string
  setSelectedProject: (projectId: string) => void
  projects: ProjectOption[]
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
  document_numbers: string[]
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

// Receipts - Contas a Receber
export interface Receipt {
  codigo_lancamento: number
  codigo_projeto: number
  nome_obra: string
  codigo_cliente: number
  numero_documento: string
  tipo_documento: string
  categoria: string
  valor_documento: number
  status: string
  data_emissao: string
  data_vencimento: string
  data_previsao: string

  // Impostos
  retem_ir: boolean
  valor_ir: number
  retem_iss: boolean
  valor_iss: number
  retem_inss: boolean
  valor_inss: number
  total_impostos: number

  // Parcelamento
  parcela_atual: number
  total_parcelas: number
  is_parcelado: boolean
  valor_parcela: number

  // Auditoria
  created_at: string
  updated_at: string
}
