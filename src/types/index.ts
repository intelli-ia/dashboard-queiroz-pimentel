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
  codigo_movimento_cc: number | null
  codigo_nf: number | null
  is_nfe: boolean
  chave_nfe: string | null
  // Derived classification fields
  tipo_movimento: string | null
  direcao: string | null  // 'ENTRADA' ou 'SAIDA'
  is_efetivado: boolean
  origem_descricao: string | null
  // Joined relations
  projects?: { code: string; name: string }
  categories?: { code: string; description: string }
}

// Client - Clientes/Fornecedores
export interface Client {
  codigo_cliente_omie: number  // PK - matches codigo_cliente in financial_movements
  cnpj_cpf: string | null
  razao_social: string | null
  nome_fantasia: string | null
  tags: string | null
  pessoa_fisica: boolean
  inativo: boolean
}

// Client lookup maps type for reuse
export interface ClientMaps {
  byCodigoOmie: Map<number, Client>
  byNormalizedCpfCnpj: Map<string, Client>
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
