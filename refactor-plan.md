# Spec de Refatoracao - Dashboard Queiroz Pimentel

**Data:** 16/02/2026
**Versao:** 1.0
**Objetivo:** Documentar a nova arquitetura de dados (backend) para que a equipe de desenvolvimento refatore o front-end do dashboard, substituindo a estrutura de dados antiga pela nova, baseada em PostgreSQL com pipeline ETL via N8N + Omie API.

---

## Indice

1. [Visao Geral da Nova Arquitetura](#1-visao-geral-da-nova-arquitetura)
2. [Diagrama do Pipeline de Dados](#2-diagrama-do-pipeline-de-dados)
3. [Estrutura do Banco de Dados](#3-estrutura-do-banco-de-dados)
   - 3.1 [Schema e Tabelas de Suporte](#31-schema-e-tabelas-de-suporte)
   - 3.2 [Contas a Pagar (accounts_payable)](#32-contas-a-pagar-accounts_payable)
   - 3.3 [Contas a Receber (accounts_receivable)](#33-contas-a-receber-accounts_receivable)
   - 3.4 [Movimentos Financeiros (financial_movements)](#34-movimentos-financeiros-financial_movements)
   - 3.5 [Cabecalhos NFE (nfe_headers)](#35-cabecalhos-nfe-nfe_headers)
   - 3.6 [Itens NFE (nfe_items)](#36-itens-nfe-nfe_items)
4. [Relacionamentos entre Tabelas](#4-relacionamentos-entre-tabelas)
5. [Pipeline ETL - Fluxo de Dados](#5-pipeline-etl---fluxo-de-dados)
   - 5.1 [Scripts de Normalizacao](#51-scripts-de-normalizacao)
   - 5.2 [Scripts de Upsert](#52-scripts-de-upsert)
6. [Mapeamento: Funcionalidades do Front-End vs Nova Estrutura](#6-mapeamento-funcionalidades-do-front-end-vs-nova-estrutura)
7. [Queries Sugeridas por Funcionalidade](#7-queries-sugeridas-por-funcionalidade)
8. [Convencoes e Padroes](#8-convencoes-e-padroes)
9. [Checklist de Refatoracao](#9-checklist-de-refatoracao)

---

## 1. Visao Geral da Nova Arquitetura

### Arquitetura Anterior (Legada)
O front-end consumia dados diretamente de fontes variadas, sem uma camada de persistencia estruturada e normalizada. A estrutura dos dados dependia do formato bruto da API Omie, com campos em portugues nao padronizados e estruturas aninhadas.

### Nova Arquitetura
A nova arquitetura implementa um **pipeline ETL** (Extract, Transform, Load) com tres camadas:

| Camada | Tecnologia | Responsabilidade |
|--------|-----------|------------------|
| **Extract** | Omie REST API | Extrair dados financeiros brutos (JSON) |
| **Transform** | N8N + JavaScript | Normalizar, parsear datas, achatar estruturas |
| **Load** | PostgreSQL (schema `dashboard`) | Persistir dados normalizados com upsert idempotente |

O **front-end** passa a consumir **exclusivamente** o banco PostgreSQL (schema `dashboard`), que contem dados limpos, tipados e indexados.

### Stack do Backend

| Componente | Tecnologia |
|-----------|-----------|
| Banco de Dados | PostgreSQL |
| Schema | `dashboard` |
| Orquestrador ETL | N8N (workflow automation) |
| API de Origem | Omie ERP (REST) |
| Scripts de Transformacao | JavaScript (N8N Code Nodes) |
| Scripts de Persistencia | SQL com templates N8N |

---

## 2. Diagrama do Pipeline de Dados

```
┌──────────────────────────────┐
│         OMIE REST API        │
│                              │
│  ListarContasPagar           │
│  ListarContasReceber         │
│  ListarMovimentos            │
│  ConsultarNFe                │
└──────────────┬───────────────┘
               │ JSON Bruto
               ▼
┌──────────────────────────────┐
│      N8N WORKFLOW ENGINE     │
│                              │
│  ┌────────────────────────┐  │
│  │ Normalization Scripts  │  │
│  │ (JavaScript)           │  │
│  │                        │  │
│  │ - parseDate DD/MM/YYYY │  │
│  │   → YYYY-MM-DD         │  │
│  │ - parseParcela "X/Y"   │  │
│  │   → current + total    │  │
│  │ - parseBoolean S/N     │  │
│  │   → true/false         │  │
│  │ - flatten nested objs  │  │
│  │ - map field names      │  │
│  └───────────┬────────────┘  │
│              │ JSON Normalizado
│  ┌───────────▼────────────┐  │
│  │ Upsert SQL Scripts     │  │
│  │ (Postgres Node)        │  │
│  │                        │  │
│  │ INSERT ... ON CONFLICT │  │
│  │ DO UPDATE SET ...      │  │
│  │ RETURNING operacao     │  │
│  └───────────┬────────────┘  │
└──────────────┼───────────────┘
               │
               ▼
┌──────────────────────────────┐
│     POSTGRESQL DATABASE      │
│     Schema: dashboard        │
│                              │
│  ┌────────────────────────┐  │
│  │ Tabelas de Suporte     │  │
│  │ - categories            │  │
│  │ - projects              │  │
│  ├────────────────────────┤  │
│  │ Tabelas Transacionais  │  │
│  │ - accounts_payable      │  │
│  │ - accounts_receivable   │  │
│  │ - financial_movements   │  │
│  │ - nfe_headers           │  │
│  │ - nfe_items             │  │
│  └────────────────────────┘  │
└──────────────┬───────────────┘
               │ SQL Queries
               ▼
┌──────────────────────────────┐
│     FRONT-END DASHBOARD      │
│  React + Next.js + Recharts  │
│                              │
│  Consome dados via API/ORM   │
│  conectado ao PostgreSQL     │
└──────────────────────────────┘
```

---

## 3. Estrutura do Banco de Dados

### 3.1 Schema e Tabelas de Suporte

**Schema:** `dashboard`

```sql
CREATE SCHEMA IF NOT EXISTS dashboard;
```

#### Tabela: `dashboard.categories`

Armazena as categorias financeiras hierarquicas do Omie.

| Coluna | Tipo | Constraints | Descricao |
|--------|------|------------|-----------|
| `code` | VARCHAR(20) | **PK** NOT NULL | Codigo da categoria |
| `parent_code` | VARCHAR(20) | nullable | Codigo da categoria pai (hierarquia) |
| `description` | VARCHAR(255) | NOT NULL | Descricao da categoria |
| `standard_description` | VARCHAR(255) | nullable | Descricao padronizada |

**Uso no front-end:** Alimenta filtros de categoria, graficos de distribuicao por categoria (pizza/rosca) e agrupamentos no dashboard gerencial.

#### Tabela: `dashboard.projects`

Armazena os projetos/departamentos da empresa.

| Coluna | Tipo | Constraints | Descricao |
|--------|------|------------|-----------|
| `code` | VARCHAR(20) | **PK** NOT NULL | Codigo do projeto |
| `name` | VARCHAR(255) | NOT NULL | Nome do projeto |

**Uso no front-end:** Alimenta o filtro de projeto, graficos comparativos por projeto (barras e barras empilhadas).

---

### 3.2 Contas a Pagar (`accounts_payable`)

Armazena todos os titulos de contas a pagar sincronizados do Omie.

**Origem Omie:** `ListarContasPagar`

| Coluna | Tipo | Constraints | Default | Descricao |
|--------|------|------------|---------|-----------|
| `codigo_lancamento_omie` | BIGINT | **PK** | - | ID unico do lancamento no Omie |
| `codigo_cliente_fornecedor` | BIGINT | nullable | - | Codigo do fornecedor |
| `project_code` | VARCHAR(20) | nullable, **IDX** | - | Codigo do projeto (FK logica → projects) |
| `category_code` | VARCHAR(20) | nullable, **IDX** | - | Codigo da categoria (FK logica → categories) |
| `document_type` | VARCHAR(10) | nullable | - | Tipo de documento (NFE, NFS, BOL, etc.) |
| `numero_documento` | VARCHAR(50) | nullable | - | Numero do documento |
| `numero_documento_fiscal` | VARCHAR(50) | nullable | - | Numero do documento fiscal |
| `current_installment` | SMALLINT | NOT NULL | 1 | Parcela atual |
| `total_installments` | SMALLINT | NOT NULL | 1 | Total de parcelas |
| `data_emissao` | DATE | nullable | - | Data de emissao |
| `data_entrada` | DATE | nullable | - | Data de entrada |
| `data_previsao` | DATE | nullable | - | Data de previsao de pagamento |
| `data_vencimento` | DATE | nullable, **IDX** | - | Data de vencimento |
| `status_titulo` | VARCHAR(20) | nullable, **IDX** | - | Status: LIQUIDADO, ABERTO, CANCELADO, etc. |
| `valor_documento` | NUMERIC(15,2) | nullable | - | Valor total do documento |
| `retem_cofins` | BOOLEAN | NOT NULL | FALSE | Retencao COFINS |
| `retem_csll` | BOOLEAN | NOT NULL | FALSE | Retencao CSLL |
| `retem_inss` | BOOLEAN | NOT NULL | FALSE | Retencao INSS |
| `retem_ir` | BOOLEAN | NOT NULL | FALSE | Retencao IR |
| `retem_iss` | BOOLEAN | NOT NULL | FALSE | Retencao ISS |
| `retem_pis` | BOOLEAN | NOT NULL | FALSE | Retencao PIS |
| `valor_inss` | NUMERIC(15,2) | nullable | - | Valor retido INSS |
| `valor_ir` | NUMERIC(15,2) | nullable | - | Valor retido IR |
| `valor_iss` | NUMERIC(15,2) | nullable | - | Valor retido ISS |
| `id_conta_corrente` | BIGINT | nullable | - | ID da conta corrente |
| `id_origem` | VARCHAR(10) | nullable | - | Identificador de origem |
| `created_at` | TIMESTAMP | nullable | - | Data de criacao no Omie |
| `updated_at` | TIMESTAMP | nullable | - | Data de ultima alteracao no Omie |

**Indices:**
- `idx_ap_project` → `project_code`
- `idx_ap_category` → `category_code`
- `idx_ap_status` → `status_titulo`
- `idx_ap_data_vencimento` → `data_vencimento`

**Valores de `status_titulo`:** `LIQUIDADO`, `ABERTO`, `CANCELADO`, `ATRASADO`

**Valores de `document_type`:** `NFE`, `NFS`, `BOL`, `REC`, `PIX`, `TED`, `DIN`, etc.

---

### 3.3 Contas a Receber (`accounts_receivable`)

Armazena todos os titulos de contas a receber sincronizados do Omie.

**Origem Omie:** `ListarContasReceber`

| Coluna | Tipo | Constraints | Default | Descricao |
|--------|------|------------|---------|-----------|
| `codigo_lancamento_omie` | BIGINT | **PK** | - | ID unico do lancamento no Omie |
| `codigo_cliente_fornecedor` | BIGINT | nullable | - | Codigo do cliente |
| `project_code` | VARCHAR(20) | nullable, **IDX** | - | Codigo do projeto |
| `category_code` | VARCHAR(20) | nullable, **IDX** | - | Codigo da categoria |
| `document_type` | VARCHAR(10) | nullable | - | Tipo de documento |
| `numero_documento` | VARCHAR(50) | nullable | - | Numero do documento |
| `numero_documento_fiscal` | VARCHAR(50) | nullable | - | Numero do documento fiscal |
| `current_installment` | SMALLINT | NOT NULL | 1 | Parcela atual |
| `total_installments` | SMALLINT | NOT NULL | 1 | Total de parcelas |
| `data_emissao` | DATE | nullable | - | Data de emissao |
| `data_previsao` | DATE | nullable | - | Data de previsao de recebimento |
| `data_registro` | DATE | nullable | - | Data de registro |
| `data_vencimento` | DATE | nullable, **IDX** | - | Data de vencimento |
| `status_titulo` | VARCHAR(20) | NOT NULL, **IDX** | 'RECEBIDO' | Status do titulo |
| `valor_documento` | NUMERIC(15,2) | nullable | - | Valor total do documento |
| `retem_inss` | BOOLEAN | NOT NULL | FALSE | Retencao INSS |
| `retem_ir` | BOOLEAN | NOT NULL | FALSE | Retencao IR |
| `retem_iss` | BOOLEAN | NOT NULL | FALSE | Retencao ISS |
| `valor_inss` | NUMERIC(15,2) | nullable | - | Valor retido INSS |
| `valor_ir` | NUMERIC(15,2) | nullable | - | Valor retido IR |
| `valor_iss` | NUMERIC(15,2) | nullable | - | Valor retido ISS |
| `id_conta_corrente` | BIGINT | nullable | - | ID da conta corrente |
| `id_origem` | VARCHAR(10) | nullable | - | Identificador de origem |
| `created_at` | TIMESTAMP | nullable | - | Data de criacao no Omie |
| `updated_at` | TIMESTAMP | nullable | - | Data de ultima alteracao no Omie |

**Indices:**
- `idx_ar_project` → `project_code`
- `idx_ar_category` → `category_code`
- `idx_ar_status` → `status_titulo`
- `idx_ar_data_vencimento` → `data_vencimento`

**Diferencas em relacao a `accounts_payable`:**
- Possui `data_registro` em vez de `data_entrada`
- Default de `status_titulo` e `'RECEBIDO'`
- Nao possui `retem_cofins`, `retem_csll`, `retem_pis` (menos retencoes tributarias)

---

### 3.4 Movimentos Financeiros (`financial_movements`)

Tabela central com o espelho completo de todas as movimentacoes financeiras. E a tabela mais detalhada do sistema.

**Origem Omie:** `ListarMovimentos`

| Coluna | Tipo | Constraints | Default | Descricao |
|--------|------|------------|---------|-----------|
| `codigo_titulo` | BIGINT | **PK** | - | ID unico do titulo |
| `codigo_titulo_repetido` | BIGINT | nullable, **IDX** | - | Referencia a titulo duplicado/repetido |
| `cpf_cnpj_cliente` | VARCHAR(20) | nullable | - | CPF ou CNPJ do cliente |
| `codigo_cliente` | BIGINT | nullable | - | Codigo interno do cliente |
| `project_code` | VARCHAR(20) | nullable, **IDX** | - | Codigo do projeto |
| `category_code` | VARCHAR(20) | nullable, **IDX** | - | Codigo da categoria |
| `document_type` | VARCHAR(10) | nullable | - | Tipo de documento |
| `numero_documento_fiscal` | VARCHAR(50) | nullable | - | Numero do documento fiscal |
| `numero_titulo` | VARCHAR(50) | nullable | - | Numero do titulo |
| `current_installment` | SMALLINT | NOT NULL | 1 | Parcela atual |
| `total_installments` | SMALLINT | NOT NULL | 1 | Total de parcelas |
| `grupo` | VARCHAR(30) | nullable | - | Grupo de classificacao |
| `natureza` | VARCHAR(5) | nullable | - | Natureza: 'E' (Entrada) ou 'S' (Saida) |
| `origem` | VARCHAR(10) | nullable | - | Origem da movimentacao |
| `operacao` | VARCHAR(10) | nullable | - | Tipo de operacao |
| `status` | VARCHAR(20) | nullable, **IDX** | - | Status da movimentacao |
| `liquidado` | BOOLEAN | nullable | - | Se o titulo foi liquidado |
| `data_emissao` | DATE | nullable | - | Data de emissao |
| `data_pagamento` | DATE | nullable, **IDX** | - | Data do pagamento efetivo |
| `data_previsao` | DATE | nullable | - | Data de previsao |
| `data_registro` | DATE | nullable | - | Data de registro |
| `data_vencimento` | DATE | nullable | - | Data de vencimento |
| `valor_titulo` | NUMERIC(15,2) | nullable | - | Valor nominal do titulo |
| `juros` | NUMERIC(15,2) | nullable | - | Juros cobrados |
| `desconto` | NUMERIC(15,2) | nullable | - | Desconto aplicado |
| `juros_resumo` | NUMERIC(15,2) | nullable | - | Juros (visao resumo) |
| `multa` | NUMERIC(15,2) | nullable | - | Multa aplicada |
| `valor_aberto` | NUMERIC(15,2) | nullable | - | Valor ainda em aberto |
| `valor_liquido` | NUMERIC(15,2) | nullable | - | Valor liquido |
| `valor_pago` | NUMERIC(15,2) | nullable | - | Valor efetivamente pago |
| `codigo_conta_corrente` | BIGINT | nullable | - | ID da conta corrente |
| `codigo_nf` | BIGINT | nullable | - | ID da nota fiscal vinculada |
| `is_nfe` | BOOLEAN | NOT NULL | FALSE | Se a movimentacao originou de NFE |
| `chave_nfe` | VARCHAR(50) | nullable | - | Chave de acesso da NFE |

**Indices:**
- `idx_fm_project` → `project_code`
- `idx_fm_category` → `category_code`
- `idx_fm_status` → `status`
- `idx_fm_data_pagamento` → `data_pagamento`
- `idx_fm_titulo_repetido` → `codigo_titulo_repetido`

**Campos exclusivos desta tabela:**
- Detalhamento financeiro completo: `juros`, `desconto`, `multa`, `valor_aberto`, `valor_liquido`, `valor_pago`
- Classificacao operacional: `grupo`, `natureza`, `origem`, `operacao`
- Integracao NFE: `is_nfe`, `chave_nfe`, `codigo_nf`

---

### 3.5 Cabecalhos NFE (`nfe_headers`)

Armazena os cabecalhos das Notas Fiscais Eletronicas de entrada (produtos).

**Origem Omie:** Payload NFE (campo `cabec`)

| Coluna | Tipo | Constraints | Descricao |
|--------|------|------------|-----------|
| `id_recebimento` | BIGINT | **PK** | ID unico do recebimento |
| `id_fornecedor` | BIGINT | nullable | Codigo do fornecedor |
| `cpf_cnpj` | VARCHAR(20) | nullable | CPF/CNPJ do fornecedor |
| `nome_fantasia` | VARCHAR(200) | nullable | Nome fantasia do fornecedor |
| `razao_social` | VARCHAR(200) | nullable | Razao social do fornecedor |
| `numero_nfe` | VARCHAR(20) | nullable | Numero da NFE |
| `serie_nfe` | VARCHAR(5) | nullable | Serie da NFE |
| `chave_nfe` | VARCHAR(50) | nullable | Chave de acesso da NFE (44 digitos) |
| `data_emissao` | DATE | nullable | Data de emissao da NFE |
| `valor_nfe` | NUMERIC(15,2) | nullable | Valor total da NFE |
| `project_code` | VARCHAR(20) | nullable | Codigo do projeto |

---

### 3.6 Itens NFE (`nfe_items`)

Armazena os itens individuais de cada NFE, com referencia ao cabecalho.

**Origem Omie:** Payload NFE (campo `itensRecebimento`)

| Coluna | Tipo | Constraints | Descricao |
|--------|------|------------|-----------|
| `id_item` | BIGINT | **PK** | ID unico do item |
| `id_recebimento` | BIGINT | **FK** NOT NULL, **IDX** | Referencia ao cabecalho (nfe_headers) |
| `codigo_produto` | VARCHAR(50) | nullable | Codigo do produto |
| `id_produto` | BIGINT | nullable, **IDX** | ID interno do produto |
| `descricao_produto` | VARCHAR(300) | nullable | Descricao do produto |
| `ncm` | VARCHAR(15) | nullable | Codigo NCM (Nomenclatura Comum Mercosul) |
| `cfop` | VARCHAR(10) | nullable | Codigo Fiscal de Operacoes e Prestacoes |
| `category_code` | VARCHAR(20) | nullable, **IDX** | Categoria do item |
| `unidade` | VARCHAR(10) | nullable | Unidade de medida (UN, KG, M, etc.) |
| `quantidade` | NUMERIC(15,4) | nullable | Quantidade (4 casas decimais) |
| `preco_unitario` | NUMERIC(15,4) | nullable | Preco unitario (4 casas decimais) |
| `valor_total` | NUMERIC(15,2) | nullable | Valor total do item |
| `desconto` | NUMERIC(15,2) | nullable | Desconto aplicado |
| `sequencia` | SMALLINT | nullable | Sequencia do item na NFE |
| `icms_origem` | VARCHAR(5) | nullable | Origem do ICMS |
| `icms_sit_trib` | VARCHAR(5) | nullable | Situacao tributaria ICMS |
| `ipi_enquadramento` | VARCHAR(10) | nullable | Enquadramento IPI |
| `ipi_sit_trib` | VARCHAR(10) | nullable | Situacao tributaria IPI |
| `pis_sit_trib` | VARCHAR(10) | nullable | Situacao tributaria PIS |
| `cofins_sit_trib` | VARCHAR(10) | nullable | Situacao tributaria COFINS |

**Indices:**
- `idx_ni_recebimento` → `id_recebimento`
- `idx_ni_category` → `category_code`
- `idx_ni_produto` → `id_produto`

**Constraint FK:**
```sql
id_recebimento REFERENCES dashboard.nfe_headers(id_recebimento)
```

---

## 4. Relacionamentos entre Tabelas

```
dashboard.projects                dashboard.categories
     │ code (PK)                       │ code (PK)
     │                                 │
     │ ← project_code (logica)         │ ← category_code (logica)
     │                                 │
     ├── accounts_payable              ├── accounts_payable
     ├── accounts_receivable           ├── accounts_receivable
     ├── financial_movements           ├── financial_movements
     ├── nfe_headers                   └── nfe_items
     └── nfe_items (via header)


dashboard.nfe_headers ──── 1:N ────► dashboard.nfe_items
     │ id_recebimento (PK)              │ id_recebimento (FK)
```

**Nota:** As FKs entre tabelas transacionais e `projects`/`categories` sao **logicas** (sem constraint formal no banco). Isso permite flexibilidade na carga de dados e evita erros de constraint durante o ETL.

A unica **FK formal** e entre `nfe_items.id_recebimento` → `nfe_headers.id_recebimento`.

---

## 5. Pipeline ETL - Fluxo de Dados

### 5.1 Scripts de Normalizacao

Cada script JavaScript roda dentro de um **N8N Code Node** e transforma o payload bruto do Omie em objetos normalizados.

#### Funcoes utilitarias compartilhadas

```javascript
// Converte DD/MM/YYYY → YYYY-MM-DD
function parseDate(dateStr) {
  if (!dateStr || dateStr.trim() === '') return null;
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  const [day, month, year] = parts;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

// Converte DD/MM/YYYY + HH:MM:SS → YYYY-MM-DDTHH:MM:SS
function parseTimestamp(dateStr, timeStr) {
  const date = parseDate(dateStr);
  if (!date) return null;
  const time = timeStr && timeStr.trim() !== '' ? timeStr : '00:00:00';
  return `${date}T${time}`;
}

// Converte "X/Y" → { current: X, total: Y }
function parseParcela(parcelaStr) {
  if (!parcelaStr || parcelaStr.trim() === '') return { current: 1, total: 1 };
  const parts = parcelaStr.split('/');
  if (parts.length !== 2) return { current: 1, total: 1 };
  return {
    current: parseInt(parts[0], 10) || 1,
    total: parseInt(parts[1], 10) || 1,
  };
}

// Converte 'S'/'N' → true/false
function parseBoolean(flag) {
  return flag === 'S';
}
```

#### Mapeamento Omie → PostgreSQL por tabela

**Contas a Pagar** (`normalize_accounts_payable.js`)
| Campo Omie (bruto) | Campo PostgreSQL | Transformacao |
|---------------------|-----------------|---------------|
| `codigo_lancamento_omie` | `codigo_lancamento_omie` | Direto |
| `codigo_cliente_fornecedor` | `codigo_cliente_fornecedor` | Nullable |
| `distribuicao[0].cCodDep` | `project_code` | String() do primeiro departamento |
| `codigo_categoria` | `category_code` | Nullable |
| `codigo_tipo_documento` | `document_type` | Nullable |
| `numero_documento` | `numero_documento` | Nullable |
| `numero_documento_fiscal` | `numero_documento_fiscal` | Nullable |
| `numero_parcela` | `current_installment` / `total_installments` | parseParcela("X/Y") |
| `data_emissao` | `data_emissao` | parseDate(DD/MM/YYYY) |
| `data_entrada` | `data_entrada` | parseDate(DD/MM/YYYY) |
| `data_previsao` | `data_previsao` | parseDate(DD/MM/YYYY) |
| `data_vencimento` | `data_vencimento` | parseDate(DD/MM/YYYY) |
| `status_titulo` | `status_titulo` | Nullable |
| `valor_documento` | `valor_documento` | Nullable numeric |
| `retem_cofins` | `retem_cofins` | parseBoolean(S/N) |
| `retem_csll` | `retem_csll` | parseBoolean(S/N) |
| `retem_inss` | `retem_inss` | parseBoolean(S/N) |
| `retem_ir` | `retem_ir` | parseBoolean(S/N) |
| `retem_iss` | `retem_iss` | parseBoolean(S/N) |
| `retem_pis` | `retem_pis` | parseBoolean(S/N) |
| `valor_inss` | `valor_inss` | Nullable numeric |
| `valor_ir` | `valor_ir` | Nullable numeric |
| `valor_iss` | `valor_iss` | Nullable numeric |
| `id_conta_corrente` | `id_conta_corrente` | Nullable |
| `id_origem` | `id_origem` | Nullable |
| `info.dInc` + `info.hInc` | `created_at` | parseTimestamp() |
| `info.dAlt` + `info.hAlt` | `updated_at` | parseTimestamp() |

**Contas a Receber** (`normalize_accounts_receivable.js`)
- Mesmo mapeamento que Contas a Pagar, exceto:
  - Nao possui `data_entrada` → possui `data_registro`
  - Nao possui `retem_cofins`, `retem_csll`, `retem_pis`
  - Default de `status_titulo`: `'RECEBIDO'`

**Movimentos Financeiros** (`normalize_financial_movements.js`)
| Campo Omie (bruto) | Campo PostgreSQL | Transformacao |
|---------------------|-----------------|---------------|
| `detalhes.nCodTitulo` | `codigo_titulo` | Direto |
| `detalhes.nCodTitRepet` | `codigo_titulo_repetido` | Nullable |
| `detalhes.cCPFCNPJCliente` | `cpf_cnpj_cliente` | Nullable |
| `detalhes.nCodCliente` | `codigo_cliente` | Nullable |
| `detalhes.cCodProjeto` | `project_code` | String() |
| `detalhes.cCodCateg` | `category_code` | Nullable |
| `detalhes.cTipo` | `document_type` | Nullable |
| `detalhes.cNumDocFiscal` | `numero_documento_fiscal` | Nullable |
| `detalhes.cNumTitulo` | `numero_titulo` | Nullable |
| `detalhes.cNumParcela` | `current_installment` / `total_installments` | parseParcela() |
| `detalhes.cGrupo` | `grupo` | Nullable |
| `detalhes.cNatureza` | `natureza` | Nullable |
| `detalhes.cOrigem` | `origem` | Nullable |
| `detalhes.cOperacao` | `operacao` | Nullable |
| `detalhes.cStatus` | `status` | Nullable |
| `resumo.cLiquidado` | `liquidado` | parseBoolean(S/N) |
| `detalhes.dDtEmissao` | `data_emissao` | parseDate() |
| `detalhes.dDtPagamento` | `data_pagamento` | parseDate() |
| `detalhes.dDtPrevisao` | `data_previsao` | parseDate() |
| `detalhes.dDtRegistro` | `data_registro` | parseDate() |
| `detalhes.dDtVenc` | `data_vencimento` | parseDate() |
| `detalhes.nValorTitulo` | `valor_titulo` | Nullable numeric |
| `detalhes.nJuros` | `juros` | Nullable numeric |
| `resumo.nDesconto` | `desconto` | Nullable numeric |
| `resumo.nJuros` | `juros_resumo` | Nullable numeric |
| `resumo.nMulta` | `multa` | Nullable numeric |
| `resumo.nValAberto` | `valor_aberto` | Nullable numeric |
| `resumo.nValLiquido` | `valor_liquido` | Nullable numeric |
| `resumo.nValPago` | `valor_pago` | Nullable numeric |
| `detalhes.nCodCC` | `codigo_conta_corrente` | Nullable |
| `detalhes.nCodNF` | `codigo_nf` | Nullable |
| `detalhes.cTipo === 'NFE'` | `is_nfe` | Comparacao direta |
| `detalhes.cChaveNFe` | `chave_nfe` | Nullable |

**Itens NFE** (`normalize_nfe_items.js`)
| Campo Omie (bruto) | Campo PostgreSQL | Transformacao |
|---------------------|-----------------|---------------|
| `cabec.nIdReceb` | `id_recebimento` | Direto (header) |
| `cabec.nIdFornecedor` | `id_fornecedor` | Nullable (header) |
| `cabec.cCNPJ_CPF` | `cpf_cnpj` | Nullable (header) |
| `cabec.cNome` | `nome_fantasia` | Nullable (header) |
| `cabec.cRazaoSocial` | `razao_social` | Nullable (header) |
| `cabec.cNumeroNFe` | `numero_nfe` | Nullable (header) |
| `cabec.cSerieNFe` | `serie_nfe` | Nullable (header) |
| `cabec.cChaveNFe` | `chave_nfe` | Nullable (header) |
| `cabec.dEmissaoNFe` | `data_emissao` | parseDate() (header) |
| `cabec.nValorNFe` | `valor_nfe` | Nullable (header) |
| `departamentos[0].cCodDepartamento` | `project_code` | String() (header) |
| `itensRecebimento[].itensCabec.nIdItem` | `id_item` | Direto (item) |
| `itensRecebimento[].itensCabec.cCodigoProduto` | `codigo_produto` | Nullable |
| `itensRecebimento[].itensCabec.nIdProduto` | `id_produto` | Nullable |
| `itensRecebimento[].itensCabec.cDescricaoProduto` | `descricao_produto` | Nullable |
| `itensRecebimento[].itensCabec.cNCM` | `ncm` | Nullable |
| `itensRecebimento[].itensCabec.cCFOP` | `cfop` | Nullable |
| `itensRecebimento[].itensInfoAdic.cCategoriaItem` | `category_code` | Nullable |
| `itensRecebimento[].itensCabec.cUnidadeNfe` | `unidade` | Nullable |
| `itensRecebimento[].itensCabec.nQtdeNFe` | `quantidade` | Nullable |
| `itensRecebimento[].itensCabec.nPrecoUnit` | `preco_unitario` | Nullable |
| `itensRecebimento[].itensCabec.vTotalItem` | `valor_total` | Nullable |
| `itensRecebimento[].itensCabec.vDesconto` | `desconto` | Nullable |
| `itensRecebimento[].itensCabec.nSequencia` | `sequencia` | Nullable |
| `itensRecebimento[].itensICMS.cOrigem` | `icms_origem` | Nullable |
| `itensRecebimento[].itensICMS.cSitTrib` | `icms_sit_trib` | Nullable |
| `itensRecebimento[].itensIPI.cEnqIPI` | `ipi_enquadramento` | Nullable |
| `itensRecebimento[].itensIPI.cSitTribIPI` | `ipi_sit_trib` | Nullable |
| `itensRecebimento[].itensPIS.cSitTribPIS` | `pis_sit_trib` | Nullable |
| `itensRecebimento[].itensCOFINS.cSitTribCOFINS` | `cofins_sit_trib` | Nullable |

**Nota sobre normalizacao de NFE:** O script faz um *flatten* - os campos do cabecalho sao propagados para cada item. No pipeline, o upsert de `nfe_headers` roda **antes** do `nfe_items` para garantir a FK constraint.

### 5.2 Scripts de Upsert

Todos os scripts SQL de upsert seguem o mesmo padrao:

```sql
INSERT INTO dashboard.<tabela> (colunas...)
VALUES ({{ $json.campo }}, ...)
ON CONFLICT (<chave_primaria>) DO UPDATE SET
  coluna = EXCLUDED.coluna,
  ...
RETURNING
  <chave_primaria>,
  CASE WHEN xmax = 0 THEN 'INSERT' ELSE 'UPDATE' END AS operacao;
```

**Caracteristicas:**
- **Idempotencia:** Pode ser executado multiplas vezes sem duplicacao
- **Feedback:** Retorna se foi INSERT ou UPDATE (via `xmax = 0`)
- **Template N8N:** Usa `{{ $json.campo }}` para interpolacao
- **Tratamento de NULL:** Cada campo nullable usa operador ternario para inserir `NULL`
- **Prevencao SQL Injection:** Strings sao escapadas com `.replace(/'/g, "''")`

**Ordem de execucao obrigatoria:**
1. `007_upsert_accounts_payable.sql`
2. `008_upsert_accounts_receivable.sql`
3. `009_upsert_financial_movements.sql`
4. `010_upsert_nfe_headers.sql` ← **ANTES dos itens**
5. `011_upsert_nfe_items.sql` ← **DEPOIS dos cabecalhos**

---

## 6. Mapeamento: Funcionalidades do Front-End vs Nova Estrutura

### 6.1 Dashboard Gerencial

| Funcionalidade | Tabela(s) Principal(is) | Campos-Chave |
|----------------|------------------------|--------------|
| **KPI - Custo Total** | `accounts_payable` | `SUM(valor_documento)` |
| **KPI - Recebimentos** | `accounts_receivable` | `SUM(valor_documento)` |
| **KPI - Qtd. Movimentacoes** | `financial_movements` | `COUNT(*)` |
| **KPI - Custo Medio Mensal** | `accounts_payable` | `AVG por mes usando data_vencimento` |
| **Grafico Evolucao Temporal** | `accounts_payable` | `valor_documento` agrupado por `data_vencimento` (mes) |
| **Distribuicao por Categoria** | `accounts_payable` + `categories` | `valor_documento` agrupado por `category_code` JOIN `categories.description` |
| **Distribuicao por Tipo Pagamento** | `accounts_payable` | `valor_documento` agrupado por `document_type` |
| **Comparativo por Projeto** | `accounts_payable` + `projects` | `valor_documento` agrupado por `project_code` JOIN `projects.name` |
| **Barras Empilhadas (composicao projeto)** | `accounts_payable` + `categories` | `valor_documento` agrupado por `project_code` e `category_code` |
| **Analise Fiscal - Impostos** | `accounts_payable` | `valor_inss`, `valor_ir`, `valor_iss`, flags `retem_*` |
| **Balanco de Resultados** | `accounts_payable` + `accounts_receivable` | Receitas vs Despesas |

### 6.2 Modulos de Visualizacao

| Pagina Front-End | Tabela Principal | Filtros Aplicaveis |
|------------------|-----------------|-------------------|
| **NFE (Produtos)** | `nfe_headers` | `project_code`, `data_emissao`, `numero_nfe` |
| **NFS (Servicos)** | `accounts_payable` WHERE `document_type = 'NFS'` | `project_code`, `category_code`, datas |
| **Detalhamento NFE** | `nfe_items` JOIN `nfe_headers` | `id_recebimento`, `category_code`, `id_produto` |
| **Contas a Receber** | `accounts_receivable` | `project_code`, `status_titulo`, `data_vencimento` |
| **Folha de Pagamento** | `accounts_payable` WHERE `category_code` IN (categorias de folha) | `project_code`, datas, `category_code` |
| **Contratos e Locacoes** | `accounts_payable` WHERE `category_code` IN (categorias de contratos) | `project_code`, datas |
| **Geral (Movimentacoes)** | `financial_movements` | Todos os filtros disponiveis |

### 6.3 Filtros Globais

| Filtro | Aplicacao | Campo |
|--------|----------|-------|
| **Periodo Temporal** | Todas as tabelas | `data_vencimento`, `data_emissao`, `data_pagamento` (conforme contexto) |
| **Projeto** | Todas as tabelas | `project_code` (JOIN com `projects` para nome legivel) |

### 6.4 Status Visual

| Indicador | Tabela | Logica |
|-----------|--------|--------|
| **Titulo Pago** | `accounts_payable` | `status_titulo = 'LIQUIDADO'` |
| **Titulo Vencido** | `accounts_payable` | `status_titulo = 'ABERTO' AND data_vencimento < CURRENT_DATE` |
| **Titulo em Dia** | `accounts_payable` | `status_titulo = 'ABERTO' AND data_vencimento >= CURRENT_DATE` |
| **Movimento Liquidado** | `financial_movements` | `liquidado = TRUE` |

---

## 7. Queries Sugeridas por Funcionalidade

### 7.1 KPIs do Dashboard

```sql
-- Custo Total (periodo)
SELECT SUM(valor_documento) AS custo_total
FROM dashboard.accounts_payable
WHERE data_vencimento BETWEEN :data_inicio AND :data_fim
  AND (:project_code IS NULL OR project_code = :project_code);

-- Recebimentos (periodo)
SELECT SUM(valor_documento) AS total_recebimentos
FROM dashboard.accounts_receivable
WHERE data_vencimento BETWEEN :data_inicio AND :data_fim
  AND (:project_code IS NULL OR project_code = :project_code);

-- Quantidade de Movimentacoes
SELECT COUNT(*) AS qtd_movimentacoes
FROM dashboard.financial_movements
WHERE data_pagamento BETWEEN :data_inicio AND :data_fim
  AND (:project_code IS NULL OR project_code = :project_code);

-- Custo Medio Mensal
SELECT AVG(total_mensal) AS custo_medio_mensal
FROM (
  SELECT DATE_TRUNC('month', data_vencimento) AS mes, SUM(valor_documento) AS total_mensal
  FROM dashboard.accounts_payable
  WHERE data_vencimento BETWEEN :data_inicio AND :data_fim
    AND (:project_code IS NULL OR project_code = :project_code)
  GROUP BY DATE_TRUNC('month', data_vencimento)
) sub;
```

### 7.2 Grafico de Evolucao Temporal

```sql
SELECT
  DATE_TRUNC('month', data_vencimento) AS mes,
  SUM(valor_documento) AS total
FROM dashboard.accounts_payable
WHERE data_vencimento BETWEEN :data_inicio AND :data_fim
  AND (:project_code IS NULL OR project_code = :project_code)
GROUP BY DATE_TRUNC('month', data_vencimento)
ORDER BY mes;
```

### 7.3 Distribuicao por Categoria

```sql
SELECT
  c.description AS categoria,
  SUM(ap.valor_documento) AS total
FROM dashboard.accounts_payable ap
LEFT JOIN dashboard.categories c ON ap.category_code = c.code
WHERE ap.data_vencimento BETWEEN :data_inicio AND :data_fim
  AND (:project_code IS NULL OR ap.project_code = :project_code)
GROUP BY c.description
ORDER BY total DESC;
```

### 7.4 Distribuicao por Tipo de Pagamento

```sql
SELECT
  document_type AS tipo,
  SUM(valor_documento) AS total
FROM dashboard.accounts_payable
WHERE data_vencimento BETWEEN :data_inicio AND :data_fim
  AND (:project_code IS NULL OR project_code = :project_code)
GROUP BY document_type
ORDER BY total DESC;
```

### 7.5 Comparativo por Projeto

```sql
SELECT
  p.name AS projeto,
  SUM(ap.valor_documento) AS total
FROM dashboard.accounts_payable ap
LEFT JOIN dashboard.projects p ON ap.project_code = p.code
WHERE ap.data_vencimento BETWEEN :data_inicio AND :data_fim
GROUP BY p.name
ORDER BY total DESC;
```

### 7.6 Barras Empilhadas (Projeto x Categoria)

```sql
SELECT
  p.name AS projeto,
  c.description AS categoria,
  SUM(ap.valor_documento) AS total
FROM dashboard.accounts_payable ap
LEFT JOIN dashboard.projects p ON ap.project_code = p.code
LEFT JOIN dashboard.categories c ON ap.category_code = c.code
WHERE ap.data_vencimento BETWEEN :data_inicio AND :data_fim
GROUP BY p.name, c.description
ORDER BY p.name, total DESC;
```

### 7.7 Analise Fiscal - Impostos

```sql
SELECT
  SUM(CASE WHEN retem_pis THEN valor_documento * 0.0065 ELSE 0 END) AS pis,
  SUM(CASE WHEN retem_cofins THEN valor_documento * 0.03 ELSE 0 END) AS cofins,
  SUM(CASE WHEN retem_csll THEN valor_documento * 0.01 ELSE 0 END) AS csll,
  SUM(valor_ir) AS ir,
  SUM(valor_iss) AS iss,
  SUM(valor_inss) AS inss
FROM dashboard.accounts_payable
WHERE data_vencimento BETWEEN :data_inicio AND :data_fim
  AND (:project_code IS NULL OR project_code = :project_code);
```

### 7.8 Listagem de NFEs

```sql
SELECT
  h.id_recebimento,
  h.numero_nfe,
  h.serie_nfe,
  h.nome_fantasia AS fornecedor,
  h.cpf_cnpj,
  h.data_emissao,
  h.valor_nfe,
  p.name AS projeto
FROM dashboard.nfe_headers h
LEFT JOIN dashboard.projects p ON h.project_code = p.code
WHERE h.data_emissao BETWEEN :data_inicio AND :data_fim
  AND (:project_code IS NULL OR h.project_code = :project_code)
ORDER BY h.data_emissao DESC;
```

### 7.9 Detalhamento de Itens NFE

```sql
SELECT
  i.descricao_produto,
  i.codigo_produto,
  i.ncm,
  i.cfop,
  i.unidade,
  i.quantidade,
  i.preco_unitario,
  i.valor_total,
  i.desconto,
  c.description AS categoria,
  h.numero_nfe,
  h.nome_fantasia AS fornecedor
FROM dashboard.nfe_items i
JOIN dashboard.nfe_headers h ON i.id_recebimento = h.id_recebimento
LEFT JOIN dashboard.categories c ON i.category_code = c.code
WHERE h.data_emissao BETWEEN :data_inicio AND :data_fim
  AND (:project_code IS NULL OR h.project_code = :project_code)
ORDER BY h.data_emissao DESC, i.sequencia;
```

### 7.10 Movimentacoes Gerais (com filtros completos)

```sql
SELECT
  fm.codigo_titulo,
  fm.numero_titulo,
  fm.document_type,
  fm.natureza,
  fm.status,
  fm.liquidado,
  fm.data_emissao,
  fm.data_vencimento,
  fm.data_pagamento,
  fm.valor_titulo,
  fm.valor_pago,
  fm.valor_aberto,
  p.name AS projeto,
  c.description AS categoria
FROM dashboard.financial_movements fm
LEFT JOIN dashboard.projects p ON fm.project_code = p.code
LEFT JOIN dashboard.categories c ON fm.category_code = c.code
WHERE fm.data_pagamento BETWEEN :data_inicio AND :data_fim
  AND (:project_code IS NULL OR fm.project_code = :project_code)
  AND (:status IS NULL OR fm.status = :status)
  AND (:natureza IS NULL OR fm.natureza = :natureza)
ORDER BY fm.data_pagamento DESC;
```

### 7.11 Balanco de Resultados

```sql
SELECT
  (SELECT COALESCE(SUM(valor_documento), 0)
   FROM dashboard.accounts_receivable
   WHERE data_vencimento BETWEEN :data_inicio AND :data_fim
     AND (:project_code IS NULL OR project_code = :project_code)
  ) AS total_receitas,

  (SELECT COALESCE(SUM(valor_documento), 0)
   FROM dashboard.accounts_payable
   WHERE data_vencimento BETWEEN :data_inicio AND :data_fim
     AND (:project_code IS NULL OR project_code = :project_code)
  ) AS total_despesas,

  (SELECT COALESCE(SUM(valor_documento), 0)
   FROM dashboard.accounts_receivable
   WHERE data_vencimento BETWEEN :data_inicio AND :data_fim
     AND (:project_code IS NULL OR project_code = :project_code)
  ) -
  (SELECT COALESCE(SUM(valor_documento), 0)
   FROM dashboard.accounts_payable
   WHERE data_vencimento BETWEEN :data_inicio AND :data_fim
     AND (:project_code IS NULL OR project_code = :project_code)
  ) AS resultado;
```

---

## 8. Convencoes e Padroes

### 8.1 Nomenclatura de Campos

| Padrao | Descricao | Exemplos |
|--------|----------|----------|
| `snake_case` | Todos os campos em snake_case | `valor_documento`, `data_vencimento` |
| Prefixo `data_` | Campos de data | `data_emissao`, `data_pagamento` |
| Prefixo `valor_` | Valores monetarios | `valor_documento`, `valor_pago` |
| Prefixo `retem_` | Flags de retencao tributaria | `retem_ir`, `retem_inss` |
| Prefixo `codigo_` | Codigos identificadores | `codigo_titulo`, `codigo_cliente` |
| Sufixo `_code` | Codigos de referencia cruzada | `project_code`, `category_code` |
| Prefixo `is_` | Flags booleanas de classificacao | `is_nfe` |
| Prefixo `id_` | IDs internos | `id_recebimento`, `id_item` |

### 8.2 Tipos de Dados

| Tipo PostgreSQL | Uso |
|----------------|-----|
| `BIGINT` | IDs e codigos do Omie |
| `VARCHAR(N)` | Textos com limite definido |
| `NUMERIC(15,2)` | Valores monetarios (2 casas decimais) |
| `NUMERIC(15,4)` | Quantidades e precos unitarios (4 casas decimais) |
| `DATE` | Datas sem horario |
| `TIMESTAMP` | Datas com horario (audit trail) |
| `BOOLEAN` | Flags (retencoes, liquidacao, NFE) |
| `SMALLINT` | Contadores pequenos (parcelas, sequencias) |

### 8.3 Indexacao

Todas as tabelas possuem indices nos campos usados como filtro no front-end:
- `project_code` (filtro global de projeto)
- `category_code` (agrupamentos por categoria)
- `status_titulo` / `status` (filtro de status)
- Campos de data usados nos filtros temporais

### 8.4 Idempotencia

Toda a carga de dados e **idempotente**. O padrao `INSERT ... ON CONFLICT DO UPDATE` garante que:
- Registros novos sao inseridos
- Registros existentes sao atualizados com os dados mais recentes
- Nao ha duplicacao de dados

---

## 9. Checklist de Refatoracao

### Backend / API

- [ ] Criar camada de API (REST ou GraphQL) que consulta o schema `dashboard` do PostgreSQL
- [ ] Implementar endpoints parametrizados com filtros de periodo e projeto
- [ ] Garantir que os endpoints suportam os parametros: `data_inicio`, `data_fim`, `project_code`
- [ ] Implementar autenticacao na API
- [ ] Adicionar paginacao nos endpoints de listagem (tabelas)

### Front-End - Conexao de Dados

- [ ] Substituir todas as fontes de dados legadas pela nova API
- [ ] Refatorar servicos/hooks de dados para consumir os novos endpoints
- [ ] Garantir que todos os componentes usam os novos nomes de campos (`snake_case`)

### Front-End - Dashboard Gerencial

- [ ] Refatorar KPIs para usar queries sobre `accounts_payable` e `accounts_receivable`
- [ ] Refatorar grafico de evolucao temporal (area chart) para usar dados de `accounts_payable`
- [ ] Refatorar graficos de distribuicao (rosca/pizza) para usar `category_code` JOIN `categories`
- [ ] Refatorar comparativo por projeto (bar chart) para usar `project_code` JOIN `projects`
- [ ] Refatorar painel fiscal para usar campos `retem_*` e `valor_*` de `accounts_payable`
- [ ] Refatorar balanco de resultados para comparar `accounts_payable` vs `accounts_receivable`

### Front-End - Modulos de Visualizacao

- [ ] Refatorar pagina NFE (Produtos) para consumir `nfe_headers`
- [ ] Refatorar pagina NFS (Servicos) para filtrar `accounts_payable` por `document_type = 'NFS'`
- [ ] Refatorar pagina Detalhamento NFE para consumir `nfe_items` JOIN `nfe_headers`
- [ ] Refatorar pagina Contas a Receber para consumir `accounts_receivable`
- [ ] Refatorar pagina Folha de Pagamento para filtrar `accounts_payable` por categorias de folha
- [ ] Refatorar pagina Contratos e Locacoes para filtrar `accounts_payable` por categorias de contratos
- [ ] Refatorar pagina Geral para consumir `financial_movements`

### Front-End - Filtros

- [ ] Refatorar filtro de projeto para popular opcoes a partir de `dashboard.projects`
- [ ] Refatorar filtro temporal para aplicar `WHERE` nos campos de data corretos por contexto
- [ ] Implementar filtros adicionais conforme a tabela (status, natureza, tipo documento)

### Front-End - Tabelas Interativas

- [ ] Mapear colunas das tabelas para os novos campos do PostgreSQL
- [ ] Implementar busca textual via ILIKE no backend
- [ ] Garantir ordenacao server-side usando `ORDER BY` com indices
- [ ] Implementar paginacao server-side usando `LIMIT` / `OFFSET`

### Testes e Validacao

- [ ] Validar que todos os KPIs retornam valores corretos comparando com dados do Omie
- [ ] Testar filtros de periodo com datas limites
- [ ] Testar filtro de projeto individualmente e com "todos os projetos"
- [ ] Validar status visuais (pago/vencido/em dia) com a nova logica
- [ ] Testar paginacao e ordenacao em todas as tabelas
- [ ] Validar calculos fiscais (impostos e retencoes)

---

## Apendice A - Estrutura de Diretorios do Backend

```
qp-backend-dashboard/
├── payloads/                         # Payloads de exemplo (Omie API)
│   ├── accounts_payable.json
│   ├── accounts_receivable.json
│   ├── financial_movements.json
│   └── nfe_items.json
├── scripts/                          # Scripts de normalizacao (N8N Code Nodes)
│   ├── normalize_accounts_payable.js
│   ├── normalize_accounts_receivable.js
│   ├── normalize_financial_movements.js
│   └── normalize_nfe_items.js
└── sql/                              # Scripts SQL (DDL + DML)
    ├── 001_create_schema.sql
    ├── 002_create_support_tables.sql
    ├── 003_create_accounts_payable.sql
    ├── 004_create_accounts_receivable.sql
    ├── 005_create_financial_movements.sql
    ├── 006_create_nfe_items.sql        # Inclui nfe_headers + nfe_items
    ├── 007_upsert_accounts_payable.sql
    ├── 008_upsert_accounts_receivable.sql
    ├── 009_upsert_financial_movements.sql
    ├── 010_upsert_nfe_headers.sql
    └── 011_upsert_nfe_items.sql
```

## Apendice B - Valores de Referencia (Enums Implicitos)

### `document_type` (tipo de documento)
| Valor | Descricao |
|-------|----------|
| `NFE` | Nota Fiscal Eletronica (produtos) |
| `NFS` | Nota Fiscal de Servico |
| `BOL` | Boleto |
| `REC` | Recibo |
| `PIX` | Pagamento PIX |
| `TED` | Transferencia TED |
| `DIN` | Dinheiro |

### `status_titulo` / `status`
| Valor | Descricao |
|-------|----------|
| `LIQUIDADO` | Titulo pago/recebido |
| `ABERTO` | Titulo pendente |
| `CANCELADO` | Titulo cancelado |
| `ATRASADO` | Titulo vencido nao pago |
| `RECEBIDO` | Titulo recebido (padrao em accounts_receivable) |

### `natureza` (financial_movements)
| Valor | Descricao |
|-------|----------|
| `E` | Entrada (receita) |
| `S` | Saida (despesa) |
