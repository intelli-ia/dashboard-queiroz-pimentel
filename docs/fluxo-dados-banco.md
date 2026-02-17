# Como o Sistema Consome Dados do Banco de Dados

Este documento explica de forma simples como o dashboard busca e exibe os dados financeiros.

---

## Visão Geral

O sistema funciona assim:

1. Os dados ficam armazenados em um banco de dados **PostgreSQL** hospedado no **Supabase**
2. Quando você acessa uma tela do dashboard, o sistema faz uma consulta ao banco
3. Os dados são trazidos para o navegador e exibidos na tela
4. Quando você aplica um filtro (por data ou projeto), uma nova consulta é feita

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Seu Navegador │ ───► │     Supabase    │ ───► │ Banco de Dados  │
│   (Dashboard)   │ ◄─── │   (Conexão)     │ ◄─── │   PostgreSQL    │
└─────────────────┘      └─────────────────┘      └─────────────────┘
```

---

## As Tabelas do Banco de Dados

O banco possui **5 tabelas principais**, todas dentro de um "schema" chamado `dashboard`:

### 1. projects (Projetos)
Guarda a lista de projetos/obras da empresa.

| Campo | O que armazena |
|-------|----------------|
| code | Código único do projeto |
| name | Nome do projeto |

**Exemplo:** Projeto "Obra Centro Empresarial" com código "P001"

---

### 2. categories (Categorias)
Guarda as categorias financeiras para classificar despesas e receitas.

| Campo | O que armazena |
|-------|----------------|
| code | Código da categoria |
| parent_code | Código da categoria "pai" (para subcategorias) |
| description | Nome/descrição da categoria |
| standard_description | Descrição padronizada |

**Exemplo:** Categoria "Material de Construção" com código "MC01"

---

### 3. accounts_payable (Contas a Pagar)
Guarda as contas que a empresa tem para pagar.

| Campo | O que armazena |
|-------|----------------|
| codigo_lancamento_omie | Identificador único vindo do sistema Omie |
| project_code | Qual projeto essa conta pertence |
| category_code | Qual categoria financeira |
| document_type | Tipo do documento (NFE, NFS, BOL, REC, PIX, TED, DIN) |
| numero_documento | Número do documento |
| data_emissao | Data de emissão |
| data_vencimento | Data de vencimento |
| status_titulo | Situação: LIQUIDADO, ABERTO, CANCELADO ou ATRASADO |
| valor_documento | Valor a pagar |

---

### 4. accounts_receivable (Contas a Receber)
Guarda as contas que a empresa tem para receber.

| Campo | O que armazena |
|-------|----------------|
| codigo_lancamento_omie | Identificador único vindo do sistema Omie |
| project_code | Qual projeto essa conta pertence |
| category_code | Qual categoria financeira |
| document_type | Tipo do documento |
| data_vencimento | Data de vencimento |
| status_titulo | Situação: RECEBIDO, ABERTO, etc. |
| valor_documento | Valor a receber |

---

### 5. financial_movements (Movimentações Financeiras)
Guarda todas as movimentações financeiras (entradas e saídas).

| Campo | O que armazena |
|-------|----------------|
| codigo_titulo | Identificador único |
| natureza | **"E" = Entrada** (dinheiro recebido) ou **"S" = Saída** (dinheiro pago) |
| project_code | Qual projeto essa movimentação pertence |
| category_code | Qual categoria financeira |
| document_type | Tipo do documento (NFE, NFS, etc.) |
| data_pagamento | Data em que o pagamento foi realizado |
| valor_liquido | Valor líquido da movimentação |
| liquidado | Se já foi efetivado ou não |

---

## Qual Tela Usa Qual Tabela

Cada tela do dashboard busca dados de tabelas específicas:

| Tela do Dashboard | Tabela(s) Consultada(s) | O que busca |
|-------------------|-------------------------|-------------|
| **Contas a Pagar** | `financial_movements` | Movimentações onde natureza = "S" (saídas) |
| **Movimentos Financeiros** | `financial_movements` | Todas as movimentações |
| **Contas a Receber** | `accounts_receivable` | Contas a receber |
| **Filtro de Projetos** (dropdown) | `projects` | Lista de projetos |
| **Nomes das Categorias** | `categories` | Usado para exibir o nome da categoria |

---

## Como os Dados São Buscados

### Passo a Passo

1. **Você acessa uma tela** (ex: "Contas a Pagar")

2. **O sistema faz 3 consultas em paralelo:**
   - Busca a lista de projetos (para o dropdown)
   - Busca a lista de categorias (para exibir os nomes)
   - Busca os dados principais da tela (ex: movimentações financeiras)

3. **Os dados são combinados:**
   - Os dados principais vêm só com os códigos (project_code, category_code)
   - O sistema "cruza" esses códigos com as listas de projetos e categorias
   - Assim consegue exibir os nomes em vez de códigos

4. **Os dados são exibidos na tela**

### Exemplo Visual

```
CONSULTA 1: Buscar projetos
┌─────────────────────────────────┐
│ SELECT code, name FROM projects │
└─────────────────────────────────┘
         ↓
┌─────────────────────────────────┐
│ P001 → "Obra Centro"            │
│ P002 → "Residencial Norte"      │
└─────────────────────────────────┘

CONSULTA 2: Buscar categorias
┌───────────────────────────────────────┐
│ SELECT code, description FROM categories │
└───────────────────────────────────────┘
         ↓
┌─────────────────────────────────┐
│ MC01 → "Material Construção"    │
│ SV01 → "Serviços"               │
└─────────────────────────────────┘

CONSULTA 3: Buscar movimentações
┌─────────────────────────────────────────────┐
│ SELECT * FROM financial_movements           │
│ WHERE natureza = 'S' AND data_pagamento ... │
└─────────────────────────────────────────────┘
         ↓
┌───────────────────────────────────────────────────┐
│ Movimentação: project_code=P001, category_code=MC01, valor=5000 │
└───────────────────────────────────────────────────┘

RESULTADO COMBINADO:
┌───────────────────────────────────────────────────────────────┐
│ Projeto: "Obra Centro" | Categoria: "Material Construção" | R$ 5.000 │
└───────────────────────────────────────────────────────────────┘
```

---

## Como Funcionam os Filtros

### Filtro de Período

Quando você seleciona um período (7 dias, 30 dias, etc.), o sistema:

1. Calcula a data de início e fim do período
2. Adiciona uma condição na consulta: `data_pagamento ENTRE data_inicio E data_fim`
3. Faz uma nova consulta ao banco com esse filtro

**Opções disponíveis:**
- **7 dias:** Últimos 7 dias
- **30 dias:** Últimos 30 dias
- **90 dias:** Últimos 90 dias
- **Este ano:** Do início do ano até hoje
- **Todos:** Sem filtro de data
- **Personalizado:** Você escolhe as datas

### Filtro de Projeto

Quando você seleciona um projeto no dropdown:

1. O código do projeto selecionado é armazenado
2. A consulta ao banco adiciona: `project_code = 'código_selecionado'`
3. Só retorna dados daquele projeto específico

---

## Arquivos Importantes do Código

Se precisar olhar o código, estes são os arquivos principais:

| Arquivo | O que faz |
|---------|-----------|
| `src/lib/supabase.ts` | Configura a conexão com o banco de dados |
| `src/lib/supabase-utils.ts` | Funções auxiliares para buscar dados |
| `src/components/AccountsPayablePage.tsx` | Tela de Contas a Pagar |
| `src/components/GenericFinancialPage.tsx` | Tela de Movimentos Financeiros |
| `src/components/ReceiptsPage.tsx` | Tela de Contas a Receber |
| `src/types/index.ts` | Define a estrutura dos dados (campos de cada tabela) |

---

## Resumo

- O banco tem **5 tabelas** principais: projetos, categorias, contas a pagar, contas a receber e movimentações
- Cada tela consulta as tabelas que precisa via **Supabase**
- Os **filtros** (data e projeto) são aplicados diretamente na consulta ao banco
- Os dados de **projetos e categorias** são usados para exibir nomes em vez de códigos
