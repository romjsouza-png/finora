# 📝 Changelog — Finora

## ✅ v2.0 — Reescrita modular

Reescrita completa a partir do protótipo `Finora` (app de despesas) e da lógica
do antigo `FinanControl` (monolítico, 2.565 linhas). O design visual do Finora
foi mantido; a cobertura funcional do FinanControl foi portada e ampliada.

### ✨ Funcionalidades adicionadas

- **Receitas e despesas** — o app anterior só rastreava despesas, o que torna
  "controle financeiro" incompleto: sem receita não há saldo
- **Saldo derivado** — o saldo de cada conta é calculado a partir dos lançamentos
  em vez de armazenado. Elimina a classe de bugs em que um estorno de edição
  deixava o saldo dessincronizado
- **Contas múltiplas** com tipo, cor e saldo inicial
- **Orçamento mensal** por categoria, com barra de progresso e alerta de estouro
- **Metas de economia** com prazo, progresso e depósito rápido
- **Extrato** com filtros por período, conta e tipo + exportação CSV
- **Tema claro/escuro** (o guia antigo prometia isso; não existia)
- **Dados de exemplo** no primeiro acesso — o app antigo abria com tudo zerado
- **Backup JSON** de importação/exportação
- **Moeda configurável** (BRL, USD, EUR)
- **Marcador de recorrência** em lançamentos
- **Seed determinístico** de dois meses, para a variação mensal ter comparação

### 🐛 Bugs corrigidos

- **Gráfico de evolução descartava a maioria dos dados** — amostrava dias isolados
  com passo de 2 a 30 dias e somava apenas o dia exato da amostra. Em "Último
  ano", 352 dos 365 dias eram ignorados. Agora agrupa em intervalos contíguos
- **Desvio de um dia por fuso horário** — `toISOString()` convertia para UTC e,
  em UTC-3, empurrava registros feitos após 21h para o dia seguinte. Todas as
  datas agora são geradas localmente
- **`#total-change` nunca era preenchido** — o card mostrava "0% este mês" com
  seta fixa para baixo, inclusive quando o gasto subia
- **`Chart.instances` não existe no Chart.js v4** — o app antigo procurava a
  instância por essa API removida, recebia `undefined` e recriava o gráfico a cada
  render, vazando canvas
- **Cores de `.stat-trend` ilegíveis** — a cor menta clara era aplicada também
  aos cards brancos, onde não tinha contraste
- **Rollback de gravação falho** — quando o `localStorage` recusava a escrita
  (modo privativo, quota), o estado em memória era alterado mesmo assim e a tela
  passava a mentir sobre o que estava salvo
- **`data-id` sem escape** — os IDs interpolados no HTML não passavam por
  `escapeHtml`, ao contrário dos demais campos da mesma linha
- **`crypto.randomUUID` sem guard** — abrir o app por `file://` ou HTTP lanzava
  exceção; agora há optional chaining e fallback
- **Busca sem debounce** — a tabela inteira era reconstruída a cada tecla
- **Gráficos sem guarda** — se a CDN do Chart.js falhasse, a página inteira
  quebrava com `ReferenceError`; agora o app degrada sem quebrar
- **CSV com revogação prematura de URL** — o download podia ser cancelado em
  alguns navegadores; a revogação foi atrasada

### ♿ Acessibilidade

- Focus trap nos modais, com `Esc` para fechar e retorno de foco ao gatilho
- `aria-current` na navegação e `aria-expanded` no menu mobile
- `aria-label` em todo botão só de ícone; tabelas com `<caption>`
- Live region no toast; skip link para o conteúdo
- Respeita `prefers-reduced-motion`
- Rótulos acessíveis (`aria-label`) nos filtros do extrato

### 🏗 Arquitetura

- Monolito de 2.565 linhas dividido em 12 módulos com responsabilidade única
- `localStorage` encapsulado: toda operação tolera falha e devolve valor seguro
- Roteador de views por `data-view` + `location.hash`, com deep link
- Estado centralizado com `subscribe`/`emit` para re-render
- Rotas e IDs validados: nenhum elemento referenciado no JS está ausente no HTML

### 🔐 Segurança

- Senhas derivadas com SHA-256 + salt por usuário, nunca em texto puro
- Sessão com expiração de 30 dias
- Escape de HTML em todo interpolação de dados, incluindo atributos
- Credenciais fixas `admin / 1234` removidas

### 📦 Removido

- `financia-app.html`, `files.zip`, `Codigo_copilot/` e o `script.js` monolítico
  do Finora, substituídos pelos módulos

---

**Versão atual:** 2.0
**Stack:** HTML5 + CSS3 (variáveis, tema claro/escuro) + JavaScript ES6+ + Chart.js 4 + localStorage
**Status:** estável, testado em navegador
