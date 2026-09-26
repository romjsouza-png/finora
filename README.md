# 💰 Finora

Controle financeiro pessoal que roda inteiro no navegador. Sem servidor, sem
cadastro na nuvem, sem mensalidade: lançamentos, orçamento, metas e contas com
os dados guardados no `localStorage` do seu próprio dispositivo.

**[▶ Abrir o app](https://romjsouza-png.github.io/finora/)** ·
[Guia de uso](GUIA-USO.md) · [Changelog](CHANGELOG.md)

---

## O que ele faz

| Módulo | Descrição |
|---|---|
| **Visão geral** | Saldo consolidado, receitas/despesas/resultado do mês com variação vs. mês anterior, 3 gráficos e últimos lançamentos |
| **Lançamentos** | CRUD de receitas e despesas, 17 categorias, busca, filtro por tipo, marcação de recorrência |
| **Extrato** | Filtros por período, conta e tipo, com resumo do conjunto e exportação CSV para Excel |
| **Orçamento** | Limite mensal por categoria, com barra de progresso que muda de cor ao se aproximar do teto |
| **Metas** | Valor-alvo, valor guardado, prazo e contador de dias restantes |
| **Contas** | Múltiplas contas com tipo, cor e saldo inicial |
| **Perfil** | Moeda configurável, diagnóstico de armazenamento e backup JSON |

Extras: tema claro/escuro, dados de exemplo no primeiro acesso, deep link por
URL (`#budget`, `#goals`…), responsivo e navegável por teclado.

## Testes

```bash
npm test
```

72 testes cobrindo a matemática financeira, o parsing de datas e valores, a
persistência e o login. Rodam em ~350 ms no `node:test` embutido — **sem
dependências, sem framework, sem `npm install`**.

Os testes exercitam os módulos reais, carregados num contexto `vm` (ver
`tests/helper.js`), e incluem regressões dos bugs já corrigidos:

| Arquivo | Cobre |
|---|---|
| `datas.test.js` | Regressão do fuso horário: datas locais, não UTC. Inclui um caso para cada hora do dia, porque o bug só aparecia depois das 21h (UTC-3) |
| `state.test.js` | Saldo derivado, totais mensais, agrupamento por categoria, uso de orçamento. Inclui casos de invariante: o saldo não pode dessincronizar ao editar ou excluir |
| `utils.test.js` | `parseAmount` nos formatos pt-BR e en-US, escape de HTML, formatação de moeda, ids |
| `storage-auth.test.js` | `localStorage` com falha simulada (quota, modo privativo, JSON corrompido), hash de senha, sessão expirada, isolamento entre usuários |

O bug de UTC tem um teste dedicado porque é o tipo de defeito que passa
despercebido ao usar o app: o número sai certo, o dia é que está errado.

## Stack

HTML5 + CSS3 + JavaScript ES6+ puro. **Zero dependências, zero build.**
A única biblioteca externa é o [Chart.js 4](https://www.chartjs.org/) via CDN,
usado só para os gráficos.

```
index.html          shell + todas as views
styles.css          base, login, shell, tabelas
css/app.css         componentes das views + tema escuro
js/
  utils.js          formatação, datas, helpers de DOM
  storage.js        localStorage tolerante a falha
  state.js          modelo de domínio + seletores financeiros
  auth.js           cadastro e login local
  charts.js         wrappers do Chart.js
  ui.js             roteador, modais, tema, avisos
  views/            uma view por arquivo
  app.js            bootstrap, seed e wiring de eventos
```

## Rodando localmente

Basta abrir o `index.html` no navegador. Mas para **desenvolver** com recarga
automática, sirva por HTTP:

```bash
python -m http.server 8000
# depois abra http://localhost:8000
```

> **Por que importa:** aberto por `file://`, o navegador não expõe
> `crypto.subtle`, e o login cai num hash fraco com aviso no console. Por HTTP
> (`localhost` conta como seguro) o SHA-256 funciona normalmente.

## Decisões de projeto

**O saldo é derivado, nunca armazenado.** O saldo de cada conta é calculado
somando os lançamentos a cada leitura. Não existe campo `balance` guardado, o
que elimina por construção toda uma classe de bug: em apps que mutam o saldo à
mão em cada edição e exclusão, um estorno deixa a conta dessincronizada e nada
na tela denuncia isso.

**As datas são locais, não UTC.** Todo dia vive como string `AAAA-MM-DD`
gerada a partir da data local. Usar `toISOString()` — que converte para UTC —
atribui ao dia seguinte qualquer registro feito depois das 21h no Brasil.

**O `localStorage` é tratado como instável.** Toda gravação devolve um booleano e
as views desfazem a mudança em memória quando a escrita falha, para a tela não
mentir sobre o que está salvo. Modo privativo e quota estourada são estados
previstos, não exceção.

**A senha é ofuscação, não segurança.** Ela é derivada com SHA-256 e salt por
usuário, então nunca aparece em texto puro num dump do `localStorage`. Mas
qualquer pessoa com acesso ao mesmo perfil do sistema consegue ler o
`localStorage` e abrir o DevTools. Para uso pessoal local isso é aceitável; para
dados compartilhados, é inadequado. Em produção seria preciso backend com
bcrypt/argon2 e sessão no servidor.

## Privacidade

Nenhuma requisição sai do navegador para servidor próprio. Sem analytics, sem
cookies de rastreamento, sem telemetria. Os dados nunca saem do dispositivo —
e por isso o app oferece **exportar backup** em JSON: é a única forma de levar
os dados embora, e é sua responsabilidade fazer isso antes de limpar os dados
de navegação.

## Acessibilidade

Navegação por teclado com focus trap e `Esc` nos modais, `aria-current` na
navegação, `aria-label` em todo botão só de ícone, `caption` nas tabelas, live
region nos avisos, skip link e respeito a `prefers-reduced-motion`.

## Compatibilidade

Chrome, Edge, Firefox e Safari atuais, em desktop e mobile. Usa
`color-mix()`, `optional chaining` e `crypto.subtle` — o que descarta
navegadores anteriores a 2023.

---

Desenvolvido com ❤️ para controle financeiro pessoal.
