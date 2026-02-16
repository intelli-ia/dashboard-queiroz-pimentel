// ============================================
// NEW SCHEMA TYPES (dashboard)
// ============================================

// Projects - Tabela de projetos/obras
export interface Project {
  code: string  // PK
  name: string
}

// Categories - Categorias financeiras hierarquicas
export interface Category {
  code: string  // PK
  parent_code: string | null
  description: string
  standard_description: string | null
}

// Accounts Payable - Contas a Pagar
export interface AccountPayable {
  codigo_lancamento_omie: number  // PK
  codigo_cliente_fornecedor: number | null
  project_code: string | null
  category_code: string | null
  document_type: string | null  // NFE, NFS, BOL, REC, PIX, TED, DIN
  numero_documento: string | null
  numero_documento_fiscal: string | null
  current_installment: number
  total_installments: number
  data_emissao: string | null
  data_entrada: string | null
  data_previsao: string | null
  data_vencimento: string | null
  status_titulo: string | null  // LIQUIDADO, ABERTO, CANCELADO, ATRASADO
  valor_documento: number | null
  // Tax retention flags
  retem_cofins: boolean
  retem_csll: boolean
  retem_inss: boolean
  retem_ir: boolean
  retem_iss: boolean
  retem_pis: boolean
  // Tax values
  valor_inss: number | null
  valor_ir: number | null
  valor_iss: number | null
  // Metadata
  id_conta_corrente: number | null
  id_origem: string | null
  created_at: string | null
  updated_at: string | null
  // Joined relations
  projects?: { code: string; name: string }
  categories?: { code: string; description: string }
}

// Accounts Receivable - Contas a Receber
export interface AccountReceivable {
  codigo_lancamento_omie: number  // PK
  codigo_cliente_fornecedor: number | null
  project_code: string | null
  category_code: string | null
  document_type: string | null
  numero_documento: string | null
  numero_documento_fiscal: string | null
  current_installment: number
  total_installments: number
  data_emissao: string | null
  data_previsao: string | null
  data_registro: string | null
  data_vencimento: string | null
  status_titulo: string  // Default: 'RECEBIDO'
  valor_documento: number | null
  // Tax retention flags
  retem_inss: boolean
  retem_ir: boolean
  retem_iss: boolean
  // Tax values
  valor_inss: number | null
  valor_ir: number | null
  valor_iss: number | null
  // Metadata
  id_conta_corrente: number | null
  id_origem: string | null
  created_at: string | null
  updated_at: string | null
  // Joined relations
  projects?: { code: string; name: string }
  categories?: { code: string; description: string }
}

// Financial Movements - Movimentos Financeiros (tabela detalhada)
export interface FinancialMovement {
  codigo_titulo: number  // PK
  codigo_titulo_repetido: number | null
  cpf_cnpj_cliente: string | null
  codigo_cliente: number | null
  project_code: string | null
  category_code: string | null
  document_type: string | null
  numero_documento_fiscal: string | null
  numero_titulo: string | null
  current_installment: number
  total_installments: number
  grupo: string | null
  natureza: string | null  // 'E' (Entrada) or 'S' (Saida)
  origem: string | null
  operacao: string | null
  status: string | null
  liquidado: boolean | null
  data_emissao: string | null
  data_pagamento: string | null
  data_previsao: string | null
  data_registro: string | null
  data_vencimento: string | null
  valor_titulo: number | null
  juros: number | null
  desconto: number | null
  juros_resumo: number | null
  multa: number | null
  valor_aberto: number | null
  valor_liquido: number | null
  valor_pago: number | null
  codigo_conta_corrente: number | null
  codigo_nf: number | null
  is_nfe: boolean
  chave_nfe: string | null
  // Joined relations
  projects?: { code: string; name: string }
  categories?: { code: string; description: string }
}

// NFE Headers - Cabecalhos de Notas Fiscais Eletronicas
export interface NFEHeader {
  id_recebimento: number  // PK
  id_fornecedor: number | null
  cpf_cnpj: string | null
  nome_fantasia: string | null
  razao_social: string | null
  numero_nfe: string | null
  serie_nfe: string | null
  chave_nfe: string | null
  data_emissao: string | null
  valor_nfe: number | null
  project_code: string | null
  // Joined relations
  projects?: { code: string; name: string }
}

// NFE Items - Itens de Notas Fiscais
export interface NFEItem {
  id_item: number  // PK
  id_recebimento: number  // FK to nfe_headers
  codigo_produto: string | null
  id_produto: number | null
  descricao_produto: string | null
  ncm: string | null
  cfop: string | null
  category_code: string | null
  unidade: string | null
  quantidade: number | null
  preco_unitario: number | null
  valor_total: number | null
  desconto: number | null
  sequencia: number | null
  // Tax fields
  icms_origem: string | null
  icms_sit_trib: string | null
  ipi_enquadramento: string | null
  ipi_sit_trib: string | null
  pis_sit_trib: string | null
  cofins_sit_trib: string | null
  // Joined relations
  nfe_headers?: NFEHeader
  categories?: { code: string; description: string }
}

// ============================================
// UI/DISPLAY TYPES
// ============================================

// Project option for filter dropdown
export interface ProjectOption {
  id: string
  name: string
}

// Page Props - Shared props for all pages
export interface PageProps {
  timeRange: string
  setTimeRange: (range: string) => void
  customDates: { start: string; end: string }
  setCustomDates: (dates: { start: string; end: string }) => void
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

// Tax Analysis Data
export interface TaxAnalysisData {
  inss: number
  fgts: number
  ir: number
  iss: number
  pis: number
  cofins: number
  csll: number
  totalEncargos: number
  valorBrutoNF: number
  valorReajuste: number
  valorLiquidoNF: number
  valorContrato: number
  saldoContrato: number
  fornecedoresAberto: number
  maquinasEquipamentos: number
  custosFinanceiros: number
  escritorioCentral: number
  custoTotal: number
  diferenca: number
}

// Dashboard Data
export interface DashboardData {
  totalCost: number
  itemCount: number
  totalReceipts: number
  trendData: ChartDataPoint[]
  deptData: DepartmentChart[]
  catData: CategoryChart[]
  stackedData: StackedChartData[]
  allCategories: string[]
  recentItems: AccountPayable[]
  paymentTypeData: CategoryChart[]
  avgMonthlyCost: number
  taxAnalysis: TaxAnalysisData
}

// Items page aggregation
export interface AggregatedItem {
  key: string
  product_description: string
  project_code: string
  project_name: string
  category_description: string
  total_value: number
  quantity: number
  occurrences: number
  latest_date: string
  unit_value: number
  document_numbers: string[]
}

// Sort Config
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

// Tooltip props for recharts
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

// ============================================
// STATUS CONSTANTS
// ============================================

export const STATUS_TITULO = {
  LIQUIDADO: 'LIQUIDADO',
  ABERTO: 'ABERTO',
  CANCELADO: 'CANCELADO',
  ATRASADO: 'ATRASADO',
  RECEBIDO: 'RECEBIDO',
} as const

export const DOCUMENT_TYPES = {
  NFE: 'NFE',
  NFS: 'NFS',
  BOL: 'BOL',
  REC: 'REC',
  PIX: 'PIX',
  TED: 'TED',
  DIN: 'DIN',
} as const

export const NATUREZA = {
  ENTRADA: 'E',
  SAIDA: 'S',
} as const
