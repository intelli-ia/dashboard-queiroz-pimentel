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
  valor_pis: number | null
  valor_cofins: number | null
  valor_csll: number | null
  project_name: string | null
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
  project_name: string | null
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

// NFE Headers - Cabeçalho de Notas Fiscais
export interface NfeHeader {
  id_recebimento: number
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
}

// NFE Items - Itens das Notas Fiscais
export interface NfeItem {
  // Primary Key
  id: number
  criado_em: string | null

  // Item Information
  item_sequencia: number | null
  item_id: number | null
  item_produto_id: number | null
  item_pedido_id: number | null
  item_preco_unitario: number | null
  item_qtde_nfe: number | null
  item_desconto: number | null
  item_valor_total: number | null
  item_aprox_tributos: number | null
  item_categoria: string | null
  item_adicionar_novo: string | null
  item_associar_existente: string | null
  item_ignorar: string | null

  // Product Information
  produto_codigo: string | null
  produto_descricao: string | null
  produto_ncm: string | null
  produto_cfop_saida: string | null
  produto_unidade_nfe: string | null

  // Adjustment Fields
  ajuste_cfop_entrada: string | null
  ajuste_unidade: string | null
  ajuste_qtde_recebida: number | null
  ajuste_gerar_financeiro: string | null
  ajuste_gerar_mov_estoque: string | null
  ajuste_local_estoque_id: number | null

  // ICMS Tax Information
  icms_sit_trib: string | null
  icms_nao_cred: string | null
  icms_origem: string | null
  icms_sit_trib_sn: string | null

  // ICMS-ST Tax Information
  icmsst_aliq: number | null
  icmsst_bc: number | null
  icmsst_valor: number | null
  icmsst_aliq_fcp: number | null
  icmsst_bc_fcp: number | null
  icmsst_valor_fcp: number | null
  icmsst_marg_vr_ad: number | null
  icmsst_red_bc: number | null

  // PIS Tax Information
  pis_sit_trib_nfe: string | null
  pis_aliq_nfe: number | null
  pis_bc_nfe: number | null
  pis_valor_nfe: number | null
  pis_sit_trib_entrada: string | null
  pis_tp_calc: string | null
  pis_aliq: number | null
  pis_bc: number | null
  pis_valor: number | null

  // COFINS Tax Information
  cofins_sit_trib_nfe: string | null
  cofins_aliq_nfe: number | null
  cofins_bc_nfe: number | null
  cofins_valor_nfe: number | null
  cofins_sit_trib_entrada: string | null
  cofins_tp_calc: string | null
  cofins_aliq: number | null
  cofins_bc: number | null
  cofins_valor: number | null

  // IPI Tax Information
  ipi_sit_trib: string | null
  ipi_enq: string | null
  ipi_valor_dev: number | null

  // CBS Tax Information (New tax regime)
  cbs_aliq_reg: number | null
  cbs_perc_diferimento: number | null
  cbs_perc_reducao: number | null
  cbs_valor: number | null
  cbs_valor_diferimento: number | null

  // IBS Tax Information (New tax regime)
  ibs_aliq_mun_reg: number | null
  ibs_aliq_uf_reg: number | null
  ibs_valor: number | null
  ibs_valor_mun: number | null
  ibs_valor_uf: number | null
  ibs_cbs_class_trib: string | null
  ibs_cbs_cst: string | null
  ibs_cbs_base: number | null

  // Cost Information
  custo_cofins: string | null
  custo_icms: string | null
  custo_icmsst: string | null
  custo_ipi: string | null
  custo_pis: string | null
  custo_aliq_cred_cofins: number | null
  custo_aliq_cred_pis: number | null
  custo_valor_icmsst: number | null

  // NFE Header Information (denormalized)
  nfe_chave: string | null
  nfe_numero: string | null
  nfe_serie: string | null
  nfe_modelo: string | null
  nfe_emissao: string | null
  nfe_natureza_operacao: string | null
  nfe_valor_total: number | null

  // Supplier Information (denormalized)
  fornecedor_id: number | null
  fornecedor_cnpj_cpf: string | null
  fornecedor_nome: string | null
  fornecedor_razao_social: string | null

  // Receipt/Order Information
  recebimento_id: number | null
  recebimento_etapa: string | null

  // Category and Project
  categoria_compra: string | null
  conta_id: number | null
  projeto_id: number | null

  // Freight and Totals
  tipo_frete: string | null
  total_produtos: number | null
  total_nfe: number | null
  total_aprox_tributos: number | null

  // Installments
  parcela_codigo: string | null
  parcela_quantidade: number | null

  // Status Flags
  status_bloqueado: string | null
  status_cancelada: string | null
  status_devolvido: string | null
  status_faturado: string | null
  status_recebido: string | null

  // Operation
  operacao_codigo: string | null

  // Dates
  data_registro: string | null
  data_inclusao: string | null
  data_faturamento: string | null
  data_recebimento: string | null

  // Departments
  departamentos: string | null

  // Normalized fields
  nome_normalizado: string | null
  categoria_normalizado: string | null
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
