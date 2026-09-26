# 📱 Finora — Guia de Uso

Controle financeiro pessoal que roda inteiro no navegador. Sem servidor, sem
conta na nuvem: seus dados ficam no `localStorage` deste navegador.

---

## 🚀 Como usar

### 1️⃣ Criar conta

1. Abra `index.html` no navegador
2. Clique na aba **Criar conta**
3. Preencha nome, e-mail, senha (mínimo 6 caracteres) e confirmação
4. Clique em **Criar conta**

Ao criar a conta, o app popula dois meses de dados de exemplo (lançamentos,
orçamentos e uma meta) para você explorar sem precisar digitar nada. Depois
disso, basta limpar os dados que não quiser.

### 2️⃣ Entrar

Informe o e-mail e a senha. A sessão dura 30 dias e sobrevive ao recarregar a
página — não precisa logar toda vez.

> **Senha esquecida?** Não há recuperação: as senhas são derivadas com SHA-256
> e sal, sem cópia em texto puro, então não há como recuperá-las. O único caminho
> é criar outra conta. Em troca, o backup em JSON da aba **Perfil** te salva de
> perder tudo.

---

## 📊 Funcionalidades

### Visão geral
- **Saldo total** consolidado de todas as contas
- **Receitas, despesas e resultado** do mês, com variação percentual vs. mês anterior
- **Gráfico de categorias** (donut) — para onde o dinheiro foi
- **Receitas x despesas** dos últimos 6 meses
- **Evolução do saldo** dia a dia nos últimos 30 dias
- Últimos 5 lançamentos do mês

### Lançamentos
- CRUD completo de receitas e despesas
- Categorias separadas por tipo (12 de despesa, 5 de receita)
- Vínculo com a conta de origem
- Marcador de **lançamento recorrente** (aluguel, assinatura, salário)
- Busca por descrição, categoria ou conta
- Filtro por tipo (todas / receitas / despesas)
- Ordenação por data, mais recente primeiro

### Extrato
- Todos os lançamentos com busca e filtros
- Filtros por período, conta e tipo
- Resumo de entradas, saídas e resultado do conjunto filtrado
- **Exportar CSV** compatível com Excel pt-BR (separador `;`, UTF-8 com BOM)

### Orçamento
- Limite mensal por categoria de despesa
- Barra de progresso que muda de cor: verde → amarelo (80%) → vermelho (100%)
- Navegue entre meses para comparar o consumo

### Metas
- Valor-alvo, valor já guardado e prazo
- Dias restantes até o prazo
- Depósito rápido sem abrir modal (botão `+` no card)
- Avatar de conclusão quando a meta é batida

### Contas
- Múltiplas contas (corrente, poupança, carteira, cartão de crédito)
- Cor e saldo inicial por conta
- O saldo é **derivado dos lançamentos**, não armazenado — edite à vontade sem
  risco de dessincronizar

### Perfil
- Nome e moeda (BRL, USD, EUR)
- Diagnóstico do armazenamento local
- **Exportar / importar backup JSON** — o único jeito de levar os dados embora

---

## 🌓 Tema claro/escuro

Botão de lua/sol no topo. A preferência fica salva e é aplicada antes da
primeira renderização, sem "flash" de tema errado.

---

## 🔐 Segurança e privacidade

**O que o app faz:**
- Senhas nunca são gravadas em texto puro (SHA-256 com salt por usuário)
- Todo dado inserido é escapado antes de ir para o DOM (proteção contra XSS)
- Escape de HTML também no atributo `data-id`, não só no texto visível
- Nenhum dado sai do navegador; não há requisições para servidores próprios

**O que o app NÃO é:**
- Não é autenticação de verdade. Quem tiver acesso ao mesmo perfil do sistema
  consegue ler o `localStorage` e abrir o DevTools. Isso é conhecido e aceitável para
  uso pessoal local, e **inadequado** para dados compartilhados ou multiusuário.
- Antes de usar em produção: backend com hash bcrypt/argon2, sessão no servidor,
  HTTPS obrigatório.

---

## 🆘 Solução de problemas

### "Os gráficos não aparecem"
O Chart.js vem de CDN. Sem internet, o resto do app funciona e só os gráficos
ficam vazios — o console mostra um aviso. Para uso offline, baixe o arquivo e
troque a tag `<script>` em `index.html`.

### "Meus dados sumiram"
Limpar os dados de navegação apaga o `localStorage`. Exporte um backup
regularmente na aba **Perfil**.

### "Não consigo salvar / tela piscou"
Provavelmente modo privativo ou quota estourada. O app avisa na tela em vez de
falhar em silêncio. A aba **Perfil** mostra o diagnóstico.

### Valores com vírgula
Todos os campos de valor aceitam `1.234,56`, `1234.56` ou `1234,56` — são
normalizados automaticamente.

---

## 💡 Dicas

1. **Marque recorrentes** (aluguel, streaming) para saber rápido o que é fixo
2. **Compare meses no Orçamento** — a mudança de mês mostra se o consumo subiu
3. **Metas com prazo** transformam intenção em rotina; o contador de dias ajuda
4. **Exporte CSV no Extrato** para jogar no Excel e fazer contas mais elaboradas
5. **Backup JSON sempre que tiver algo importante**

---

## 🗂️ Estrutura do código

```
index.html          # shell + todas as views
styles.css          # base, login, shell, tabelas (minificado)
css/app.css         # componentes das views + tema escuro
js/
  utils.js          # formatação, datas (chave local), DOM
  storage.js        # localStorage tolerante a falha
  state.js          # estado + seletores de cálculo financeiro
  auth.js           # cadastro/login local com hash
  charts.js         # wrappers do Chart.js
  ui.js             # roteador, modais, tema, toasts
  views/            # uma view por arquivo
  app.js            # bootstrap, seed e wiring de eventos
```

Os scripts são clássicos (sem módulos ES) e dependem do **ordem de carregamento**
declarada no `<head>`/`<body>` do `index.html`. Para testar com recarga automática,
use um servidor local em vez de abrir o arquivo direto (`file://`), porque
`crypto.subtle` não existe em contexto não seguro e o login cai no hash fraco:

```bash
python -m http.server 8000
```

---

**Feito para controle financeiro pessoal, sem complicação.**
