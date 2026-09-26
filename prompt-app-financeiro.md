# PROMPT: Desenvolvimento de Aplicativo Financeiro Pessoal (Web App)

**Persona:** Você é um desenvolvedor full-stack sênior, com 10+ anos de experiência construindo produtos financeiros (fintechs, open banking, apps de controle de gastos). Você valoriza código limpo, segurança de dados sensíveis, performance e uma UX que reduz a ansiedade do usuário ao lidar com dinheiro.

**Missão:** Construir um **aplicativo web de controle financeiro pessoal**, completo, responsivo e visualmente profissional, usando **HTML5, CSS3 e JavaScript (ES6+)**, podendo utilizar frameworks/bibliotecas modernas quando fizer sentido (React ou Vue no front-end, Chart.js/D3.js para gráficos, LocalStorage/IndexedDB ou backend real com Node.js + banco de dados para persistência).

---

## 1. Visão Geral do Produto

Um dashboard financeiro pessoal que permite ao usuário visualizar sua saúde financeira em tempo real: quanto entrou, quanto saiu, quanto vai entrar/sair, e como está a evolução patrimonial ao longo do tempo. O tom visual deve transmitir **confiança, clareza e controle** — nada de poluição visual.

---

## 2. Stack Técnica Sugerida

- **Front-end:** HTML5 semântico, CSS3 (Grid + Flexbox, variáveis CSS para tema claro/escuro), JavaScript ES6+ (ou TypeScript para maior robustez)
- **Framework (opcional, recomendado):** React com hooks, ou Vue 3 com Composition API
- **Gráficos:** Chart.js ou Recharts (linhas, barras, pizza/donut)
- **Persistência:**
  - MVP: LocalStorage/IndexedDB
  - Produção: Node.js + Express, PostgreSQL ou MongoDB
- **Autenticação:** JWT com refresh token, hash de senha com bcrypt, opcional OAuth (Google)
- **Segurança:** HTTPS obrigatório, criptografia de dados sensíveis em repouso, sanitização de inputs, rate limiting

---

## 3. Módulos Funcionais

### 3.1 Controle de Usuários
- Cadastro, login, recuperação de senha, autenticação de dois fatores (2FA opcional)
- Perfil do usuário (nome, foto, moeda padrão, fuso horário)
- Multiperfis/contas compartilhadas (ex: casal dividindo finanças)
- Sessões seguras com expiração automática

### 3.2 Lançamentos (Transações)
- CRUD completo de receitas e despesas
- Campos: valor, data, categoria, subcategoria, conta/cartão, descrição, tags, anexo (comprovante/imagem)
- Lançamentos recorrentes (assinaturas, salário, aluguel) com frequência configurável
- Lançamentos parcelados (compras em N vezes, com geração automática das parcelas futuras)
- Edição em lote e duplicação de lançamentos
- Categorização automática por regras (ex: "Uber" → Transporte)

### 3.3 Lançamentos Futuros / Previsão
- Calendário financeiro com lançamentos programados
- Projeção de saldo futuro (próximos 30/60/90 dias)
- Alertas de contas a vencer
- Simulador de "e se" (ex: e se eu gastar X a mais este mês?)

### 3.4 Cards de Resumo (Dashboard)
- Card de saldo total consolidado
- Card de receitas do mês vs. despesas do mês
- Card de saldo previsto (considerando lançamentos futuros)
- Card de maior categoria de gasto
- Card de meta de economia (progresso visual)
- Cards com comparação percentual vs. mês anterior (setas de tendência ↑↓)

### 3.5 Gráficos e Visualizações
- Gráfico de linha: evolução do saldo ao longo do tempo
- Gráfico de pizza/donut: distribuição de gastos por categoria
- Gráfico de barras: receitas x despesas por mês (últimos 6-12 meses)
- Heatmap de gastos por dia do mês
- Filtros por período (semana, mês, trimestre, ano, personalizado)

### 3.6 Extratos
- Extrato detalhado com filtros avançados (data, categoria, conta, valor mínimo/máximo, tipo)
- Busca por texto livre
- Exportação em PDF/CSV/Excel
- Visualização por conta bancária/cartão separadamente
- Reconciliação bancária (marcar lançamento como conferido)

### 3.7 Contas e Cartões
- Cadastro de múltiplas contas (corrente, poupança, carteira) e cartões de crédito
- Controle de limite e fatura do cartão de crédito
- Transferências entre contas

### 3.8 Orçamento e Metas
- Definição de orçamento mensal por categoria
- Barra de progresso de gastos vs. orçamento
- Metas de economia com prazo (ex: "Viagem em dezembro")
- Notificações ao ultrapassar 80%/100% do orçamento

### 3.9 Notificações e Insights
- Alertas de vencimento de contas
- Insights automáticos (ex: "Você gastou 30% a mais em delivery este mês")
- Resumo semanal/mensal por e-mail ou push

---

## 4. Modelo de Dados (Sugestão)

```
User { id, nome, email, senhaHash, moeda, criadoEm }
Account { id, userId, nome, tipo, saldoInicial, cor }
Category { id, userId, nome, tipo (receita/despesa), icone, cor }
Transaction { id, userId, accountId, categoryId, valor, tipo, data, descricao, status (pendente/confirmado), recorrenciaId, parcelaAtual, totalParcelas, tags[] }
Recurrence { id, frequencia, dataInicio, dataFim, valor }
Budget { id, userId, categoryId, valorLimite, mesReferencia }
Goal { id, userId, nome, valorAlvo, valorAtual, prazo }
```

---

## 5. Design e UX

- Tema claro e escuro (toggle)
- Paleta com cor de destaque para positivo (verde) e negativo (vermelho), neutra para informativo
- Tipografia legível, hierarquia clara de números (valores grandes e destacados nos cards)
- Micro-interações suaves (transições, skeleton loading)
- Totalmente responsivo (mobile-first)
- Acessibilidade: contraste AA, navegação por teclado, labels ARIA

---

## 6. Requisitos Não Funcionais

- **Performance:** carregamento inicial < 2s, gráficos renderizando sem travar com 1000+ lançamentos
- **Segurança:** nunca expor dados financeiros em logs, criptografia de valores sensíveis, proteção contra XSS/CSRF/SQL Injection
- **Escalabilidade:** arquitetura modular permitindo adicionar Open Finance/integração bancária no futuro
- **Testes:** unitários (lógica de cálculo financeiro) e E2E (fluxos críticos como criar lançamento)

---

## 7. Entregáveis Esperados

1. Estrutura de pastas do projeto (front-end + back-end, se aplicável)
2. Componentização clara (Dashboard, Extrato, Lançamentos, Gráficos, Autenticação)
3. Código comentado nas partes de lógica financeira (cálculo de saldo, projeção, parcelamento)
4. README com instruções de instalação e uso
5. Dados mockados para demonstração caso não haja backend

---

## 8. Diferenciais (opcional, se houver tempo/escopo)

- Modo "cofrinho" (arredondamento de compras para poupança)
- Divisão de contas entre pessoas (split de despesas)
- Integração fictícia com Open Finance (dados simulados)
- Assistente de IA para categorização automática e insights personalizados
