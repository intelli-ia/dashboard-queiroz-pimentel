Neste projeto eu acabei de armazenar 4 estruturas de payloads específicos da API do Omie. O objetivo do projeto é construir o banco de dados para um dashboard que deverá exibir estas informações em infográficos.

Cada arquivo dentro da pasta @payloads/ deverá ser uma tabela no banco de dados Postgres SQL do projeto.

Cada modelo de payload existente nos arquivos dentro da pasta @payloads/ são modelos sem normalização. O nosso objetivo inicial é o de criar 4 códigos de normalização, um para cada tipo de payload, de modo a normalizar os dados padronizados para salvamento em banco.

O projeto do Dashboard deverá exibir as seguintes anállises de dados:

- Contas a Pagar (accounts_payable): os lançamentos que estão programados para pagamento, assim como os dados de nome, tipo de pagamento, valor total, valor das taxas, impostos, juros e etc, data de inclusão no sistema e data da última alteração dessa conta a pagar, projeto associado.

- Contas a Receber: Projeto associado, valor total, valor das taxas, impostos, juros e etc, data de previsão de pagamento, status de recebimento (mantenha como padrão algo como 'recebido')

- Movimentos Financeiros: será tudo aquilo que foi efetivamente pago, será algo similar à estrutura do Contas a Pagar, porém focando apenas na data de pagamento. Quero que mantenha a descrição individualizada dos impostos e taxas atrelados, bem como o nome do pagamento e o tipo de pagamento.

- Itens da NFE: aqui será um detalhe do projeto, onde iremos mostrar item a item do que foi comprado (referente a NFE) e deverá seguir a mesma ideia estrutral dos demais itens. O foco dessa section será exibir o nome do item, o valor total, taxas e impostos etc. e também a categoria.

---

De modo geral, o que queremos armazenar no banco de dados sempre seguirá a seguinte premissa:

O QUE FOI PAGO? QUAIS OS VALORES ATRELADOS? A QUAL PROJETO ISSO FOI REFERENTE? A QUAL CATEGORIA ESSE PAGAMENTO ESTÁ ATRELADO? ESSE PAGAMENTO É PARCELADO? SE SIM, QUAIS AS PARCELAS DE CADA PAGAMENTO?

---

Com relação aos parcelamentos, as normalizações devem estipular qual a parcela do pagamento e a qual parcela aquela movimentação em questão se refere.

---

O que vai mosstrar quanto de dinheiro de fato foi usado: movimentos financeiros.

O que vai mostrar a programação de pagamentos, parcelas e etc: contas a pagar

O que vai mostrar a previsão de caixa da empresa: contas a receber

O que vai mostrar o detalhamento item a item para que a equipe de estoque tenha esses dados em mãos e tambem para que entendam quais itens são mais comprados: itens da nfe

---

Abaixo eu já vou deixar a definition de duas tabelas de suporte onde já tenho listados os projetos com base em seus códigos e também as categorias de compras, para a correlação de tabelas:

create table dashboard_new.categories (
  code character varying(20) not null,
  parent_code character varying(20) null,
  description character varying(255) not null,
  standard_description character varying(255) null,
  constraint categories_pkey primary key (code)
) TABLESPACE pg_default;

create table dashboard_new.projects (
  code character varying(20) not null,
  name character varying(255) not null,
  constraint projects_pkey primary key (code)
) TABLESPACE pg_default;

---

Comece a desenvolver os códigos de normalização, em seguida quero que crie os SQLs para a criação das tabelas do projeto usando o schema `dashboard`