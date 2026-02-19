# Funcionalidades de Front-End - Dashboard Queiroz Pimentel

Este documento descreve as funcionalidades e características da interface do usuário (front-end) do projeto, desenvolvida com React, Next.js, Tailwind CSS e Recharts.

## 1. Dashboard Gerencial
A página principal oferece uma visão analítica centralizada dos dados financeiros:
*   **Métricas (KPIs)**: Cards com valores totais de Custo, Recebimentos, Quantidade de Movimentações e Custo Médio Mensal.
*   **Gráfico de Evolução**: Visualização temporal de gastos através de um gráfico de área.
*   **Análise de Distribuição**: Gráficos de rosca e pizza para visualização de custos por categoria e por tipo de pagamento (NFE, NFS, Folha, etc.).
*   **Comparativo por Projeto**: Gráficos de barras para comparar custos entre diferentes projetos e sua composição interna (barras empilhadas).
*   **Análise Fiscal**: Painel dedicado ao cálculo e detalhamento de impostos e encargos (PIS, COFINS, CSLL, IR, ISS, INSS, FGTS) e balanço de resultados.

## 2. Módulos de Visualização de Dados
O sistema é dividido em páginas específicas para diferentes tipos de registros financeiros:
*   **NFE (Produtos)**: Gestão de Notas Fiscais Eletrônicas de mercadorias.
*   **NFS (Serviços)**: Gestão de Notas Fiscais de Serviço.
*   **Detalhamento NFE**: Análise detalhada de itens individuais de compra extraídos das notas.
*   **Contas a Receber**: Controle de recebimentos e fluxo de entrada.
*   **Folha de Pagamento**: Relatórios focados em salários, adiantamentos e encargos trabalhistas.
*   **Contratos e Locações**: Visão de custos fixos e recorrentes.
*   **Geral**: Espelho completo de todas as transações financeiras (movimentações).

## 3. Recursos de Filtragem e Navegação
*   **Filtros Globalizados**: Barra de ferramentas presente em todas as páginas para ajuste simultâneo de:
    *   **Período Temporal**: Seleção por períodos pré-definidos (7D, 30D, 360D, este ano, etc.) ou datas customizadas.
    *   **Filtro de Projeto**: Seleção de projetos específicos para análise segmentada.
*   **Tabelas Interativas**: Ferramentas de busca global, ordenação de colunas e paginação.
*   **Menu Lateral (Sidebar)**: Sistema de navegação colapsável para otimização de espaço.

## 4. Segurança e Interface
*   **Autenticação**: Interface de login integrada para acesso restrito.
*   **Feedback de Interface**: Estados de carregamento dinâmicos e animações de transição.
*   **Design System**: Uso de estética moderna com transparências (glassmorphism), paleta de cores harmoniosa e componentes responsivos.
*   **Status Visual**: Indicadores claros para títulos pagos e vencidos.
