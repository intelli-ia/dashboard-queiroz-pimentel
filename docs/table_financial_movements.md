# Tabela: `dashboard.financial_movements`

Armazena todos os movimentos financeiros extraidos da API Omie (`ListarMovimentos`). Cada registro representa um titulo financeiro (parcela) com sua classificacao derivada do campo `cOrigem`.

## Chave Primaria

**PK composta:** `(codigo_titulo, current_installment)`

- `codigo_titulo` = identificador unico do titulo no Omie (`nCodTitulo`)
- `current_installment` = numero da parcela atual (ex: parcela 2 de 3)
- O upsert usa `ON CONFLICT` nessa PK para deduplicacao automatica

---

## Colunas

### Identificacao

| Coluna | Tipo | Nullable | Descricao |
|--------|------|----------|-----------|
| `codigo_titulo` | BIGINT | NOT NULL | ID do titulo no Omie (PK) |
| `codigo_titulo_repetido` | BIGINT | sim | Referencia ao titulo original quando ha repeticao |
| `cpf_cnpj_cliente` | VARCHAR(20) | sim | CPF ou CNPJ do cliente/fornecedor |
| `codigo_cliente` | BIGINT | sim | Codigo do cliente no Omie |

### Vinculacao

| Coluna | Tipo | Nullable | Descricao |
|--------|------|----------|-----------|
| `project_code` | VARCHAR(20) | sim | Codigo do projeto (FK logica para `projects.code`) |
| `category_code` | VARCHAR(20) | sim | Codigo da categoria financeira (FK logica para `categories.code`) |

### Documento

| Coluna | Tipo | Nullable | Descricao |
|--------|------|----------|-----------|
| `document_type` | VARCHAR(10) | sim | Tipo do documento: NFE, NFS, BOL, REC, PIX, TED, DIN, FAT, CTR |
| `numero_documento_fiscal` | VARCHAR(50) | sim | Numero do documento fiscal |
| `numero_titulo` | VARCHAR(50) | sim | Numero do titulo (pode incluir sufixo de parcela, ex: "007896/2") |

### Parcelas

| Coluna | Tipo | Nullable | Descricao |
|--------|------|----------|-----------|
| `current_installment` | SMALLINT | NOT NULL (default 1) | Parcela atual (PK) |
| `total_installments` | SMALLINT | NOT NULL (default 1) | Total de parcelas |

### Classificacao Omie (campos brutos)

| Coluna | Tipo | Nullable | Descricao |
|--------|------|----------|-----------|
| `grupo` | VARCHAR(30) | sim | Grupo Omie: `CONTA_A_PAGAR`, `CONTA_A_RECEBER`, `CONTA_CORRENTE_PAG`, `CONTA_CORRENTE_REC` |
| `natureza` | VARCHAR(5) | sim | Natureza Omie: `P` (pagamento/saida), `E` (entrada) |
| `origem` | VARCHAR(10) | sim | Codigo de origem bruto do Omie (ver tabela completa abaixo) |
| `operacao` | VARCHAR(10) | sim | Codigo da operacao no Omie |

### Classificacao Derivada (campos computados na normalizacao)

| Coluna | Tipo | Nullable | Descricao |
|--------|------|----------|-----------|
| `tipo_movimento` | VARCHAR(30) | sim | Categoria de alto nivel derivada de `origem` |
| `direcao` | VARCHAR(10) | sim | `ENTRADA` ou `SAIDA` (derivado do ultimo caractere de `origem`: R=entrada, P=saida) |
| `is_efetivado` | BOOLEAN | NOT NULL (default FALSE) | `true` = dinheiro realmente moveu na conta. `false` = apenas registro/obrigacao |
| `origem_descricao` | VARCHAR(80) | sim | Descricao legivel da origem |

### Status

| Coluna | Tipo | Nullable | Descricao |
|--------|------|----------|-----------|
| `status` | VARCHAR(20) | sim | Status atual: `PAGO`, `ABERTO`, `CANCELADO`, `ATRASADO`, `LIQUIDADO` |
| `liquidado` | BOOLEAN | sim | Flag de liquidacao (do resumo Omie: `S`=true, `N`=false) |

### Datas

| Coluna | Tipo | Nullable | Descricao |
|--------|------|----------|-----------|
| `data_emissao` | DATE | sim | Data de emissao do titulo |
| `data_pagamento` | DATE | sim | Data em que o pagamento/recebimento foi efetivado |
| `data_previsao` | DATE | sim | Data prevista para pagamento |
| `data_registro` | DATE | sim | Data de registro no sistema |
| `data_vencimento` | DATE | sim | Data de vencimento da parcela |

### Valores

| Coluna | Tipo | Nullable | Descricao | Origem no payload |
|--------|------|----------|-----------|-------------------|
| `valor_titulo` | NUMERIC(15,2) | sim | Valor nominal do titulo | `detalhes.nValorTitulo` |
| `juros` | NUMERIC(15,2) | sim | Juros aplicados | `detalhes.nJuros` |
| `desconto` | NUMERIC(15,2) | sim | Desconto concedido | `resumo.nDesconto` |
| `juros_resumo` | NUMERIC(15,2) | sim | Juros (visao resumo) | `resumo.nJuros` |
| `multa` | NUMERIC(15,2) | sim | Multa aplicada | `resumo.nMulta` |
| `valor_aberto` | NUMERIC(15,2) | sim | Valor ainda em aberto | `resumo.nValAberto` |
| `valor_liquido` | NUMERIC(15,2) | sim | Valor liquido final | `resumo.nValLiquido` |
| `valor_pago` | NUMERIC(15,2) | sim | Valor efetivamente pago | `resumo.nValPago` |

### Conta Corrente e NF-e

| Coluna | Tipo | Nullable | Descricao |
|--------|------|----------|-----------|
| `codigo_conta_corrente` | BIGINT | sim | Codigo da conta corrente no Omie |
| `codigo_movimento_cc` | BIGINT | sim | Codigo do movimento na conta corrente |
| `codigo_nf` | BIGINT | sim | Codigo da NF associada |
| `is_nfe` | BOOLEAN | NOT NULL (default FALSE) | `true` se o documento e uma NF-e |
| `chave_nfe` | VARCHAR(50) | sim | Chave de acesso da NF-e (44 digitos) |

---

## Classificacao por Origem (`cOrigem`)

A funcao `classifyOrigem()` no script de normalizacao transforma o codigo bruto `cOrigem` em campos de classificacao derivados. A logica:

- **`tipo_movimento`**: categoria de alto nivel
- **`direcao`**: derivada do ultimo caractere (`P` = SAIDA, `R` = ENTRADA)
- **`is_efetivado`**: indica se houve movimentacao real de dinheiro

### Tabela completa de classificacao

#### Movimentos Efetivos (`is_efetivado = true`)

| Codigo | tipo_movimento | direcao | Descricao |
|--------|---------------|---------|-----------|
| `BAXP` | PAGAMENTO_EFETIVO | SAIDA | Pagamento de Conta a Pagar |
| `OFXP` | PAGAMENTO_EFETIVO | SAIDA | Pagamento Importado de OFX |
| `BAXR` | RECEBIMENTO_EFETIVO | ENTRADA | Recebimento de Conta a Receber |
| `OFXR` | RECEBIMENTO_EFETIVO | ENTRADA | Recebimento Importado de OFX |
| `TRAP` | TRANSFERENCIA | SAIDA | Debito de Transferencia entre Contas |
| `TRAR` | TRANSFERENCIA | ENTRADA | Credito de Transferencia entre Contas |
| `MANP` | LANCAMENTO_MANUAL | SAIDA | Lancamento Manual de Conta a Pagar |
| `MANR` | LANCAMENTO_MANUAL | ENTRADA | Lancamento Manual de Conta a Receber |
| `EXTP` | LANCAMENTO_MANUAL | SAIDA | Lancamento Manual de Despesa |
| `EXTR` | LANCAMENTO_MANUAL | ENTRADA | Lancamento Manual de Receita |

#### Registros e Obrigacoes (`is_efetivado = false`)

| Codigo | tipo_movimento | direcao | Descricao |
|--------|---------------|---------|-----------|
| `COMP` | PARCELA | SAIDA | Parcela a Pagar de Compras |
| `VENR` | PARCELA | ENTRADA | Parcela a Receber de Vendas |
| `IMPP` | PARCELA | SAIDA | Parcela a Pagar de Importacao |
| `APBP` | INTEGRACAO | SAIDA | Integracao de Pagamento de Conta |
| `APBR` | INTEGRACAO | ENTRADA | Integracao de Recebimento de Conta |
| `APEP` | INTEGRACAO | SAIDA | Integracao de Lancamento de Despesa |
| `APER` | INTEGRACAO | ENTRADA | Integracao de Lancamento de Receita |
| `APIP` | INTEGRACAO | SAIDA | Integracao de Conta a Pagar |
| `APIR` | INTEGRACAO | ENTRADA | Integracao de Conta a Receber |
| `NFEP` | IMPORTACAO | SAIDA | Conta a Pagar Importada de NFe |
| `NFER` | IMPORTACAO | ENTRADA | Conta a Receber Importada de NFe |
| `XMLP` | IMPORTACAO | SAIDA | Conta a Pagar Importada de XML |
| `XMLR` | IMPORTACAO | ENTRADA | Conta a Receber Importada de XML |
| `BARP` | IMPORTACAO | SAIDA | Conta a Pagar Importada por Codigo de Barras |
| `BARR` | IMPORTACAO | ENTRADA | Conta a Receber Importada por Codigo de Barras |
| `RPTP` | REPETICAO | SAIDA | Repeticao de Conta a Pagar |
| `RPTR` | REPETICAO | ENTRADA | Repeticao de Conta a Receber |
| `DEVP` | DEVOLUCAO | SAIDA | Conta a Pagar de Devolucao de Venda |
| `DEVR` | DEVOLUCAO | ENTRADA | Conta a Receber de Devolucao ao Fornecedor |

Origens nao mapeadas recebem `tipo_movimento = 'DESCONHECIDO'`.

---

## Indices

| Indice | Coluna(s) | Uso principal |
|--------|-----------|---------------|
| PK | `(codigo_titulo, current_installment)` | Deduplicacao e lookup |
| `idx_fm_project` | `project_code` | Filtro por projeto |
| `idx_fm_category` | `category_code` | Filtro por categoria |
| `idx_fm_status` | `status` | Filtro por status |
| `idx_fm_data_pagamento` | `data_pagamento` | Consultas por periodo |
| `idx_fm_titulo_repetido` | `codigo_titulo_repetido` | Rastreio de repeticoes |
| `idx_fm_tipo_movimento` | `tipo_movimento` | Filtro por tipo |
| `idx_fm_direcao` | `direcao` | Filtro entrada/saida |
| `idx_fm_is_efetivado` | `is_efetivado` | Filtro movimentos reais vs registros |

---

## Pipeline ETL

```
Omie API (ListarMovimentos)
    |
    v
N8N Code Node (normalize_financial_movements.js)
    - Converte datas DD/MM/YYYY -> YYYY-MM-DD
    - Parseia parcelas "X/Y" -> current/total
    - Classifica origem -> tipo_movimento, direcao, is_efetivado, origem_descricao
    |
    v
N8N Postgres Node (009_upsert_financial_movements.sql)
    - INSERT ... ON CONFLICT (codigo_titulo, current_installment) DO UPDATE
    - Retorna feedback INSERT/UPDATE via xmax
    |
    v
dashboard.financial_movements (PostgreSQL)
```

---

## Queries Uteis

### Extrato bancario (visao app de banco)

```sql
SELECT data_pagamento, direcao, valor_pago, origem_descricao, status
FROM dashboard.financial_movements
WHERE is_efetivado = TRUE
ORDER BY data_pagamento DESC;
```

### Resumo de movimentacao por periodo

```sql
SELECT
  direcao,
  tipo_movimento,
  COUNT(*) AS qtd,
  SUM(valor_pago) AS total_pago
FROM dashboard.financial_movements
WHERE is_efetivado = TRUE
  AND data_pagamento BETWEEN '2025-01-01' AND '2025-12-31'
GROUP BY direcao, tipo_movimento
ORDER BY direcao, total_pago DESC;
```

### Saldo de entradas vs saidas

```sql
SELECT
  SUM(CASE WHEN direcao = 'ENTRADA' THEN valor_pago ELSE 0 END) AS total_entradas,
  SUM(CASE WHEN direcao = 'SAIDA'   THEN valor_pago ELSE 0 END) AS total_saidas,
  SUM(CASE WHEN direcao = 'ENTRADA' THEN valor_pago ELSE -valor_pago END) AS saldo
FROM dashboard.financial_movements
WHERE is_efetivado = TRUE
  AND data_pagamento IS NOT NULL;
```

### Parcelas em aberto

```sql
SELECT codigo_titulo, numero_titulo, current_installment, total_installments,
       valor_titulo, data_vencimento, status, origem_descricao
FROM dashboard.financial_movements
WHERE tipo_movimento = 'PARCELA'
  AND status = 'ABERTO'
ORDER BY data_vencimento ASC;
```

### Distribuicao por tipo de movimento

```sql
SELECT tipo_movimento, direcao, is_efetivado, COUNT(*)
FROM dashboard.financial_movements
GROUP BY tipo_movimento, direcao, is_efetivado
ORDER BY COUNT(*) DESC;
```

---

## Relacionamentos (FKs logicas)

- `project_code` -> `dashboard.projects.code`
- `category_code` -> `dashboard.categories.code`
- `codigo_nf` -> `dashboard.nfe_headers.id_recebimento` (quando `is_nfe = true`)

As foreign keys sao logicas (nao enforced no banco) para permitir carga ETL flexivel.

---

## Arquivos Relacionados

| Arquivo | Descricao |
|---------|-----------|
| `sql/005_create_financial_movements.sql` | DDL da tabela e indices |
| `scripts/normalize_financial_movements.js` | Script de normalizacao (N8N Code Node) |
| `sql/009_upsert_financial_movements.sql` | Script de upsert (N8N Postgres Node) |
| `payloads/financial_movements.json` | Payload de exemplo da API Omie |
