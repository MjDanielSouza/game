# Continuar daqui

Ponto de retomada do **Curitiba Kombat**. O documento de fundo é
[STATUS_PROJETO.md](STATUS_PROJETO.md) — arquitetura, constantes, mecânicas e
balanceamento estão lá. Este aqui é só **o que falta**.

Atualizado em 24/09/2026.

---

## 1. Primeiro: merjar os três PRs abertos

Saíram todos de `main` e não dependem um do outro.

| PR | branch | o que é |
|---|---|---|
| [#23](https://github.com/MjDanielSouza/game/pull/23) | `sprint5/habilidades` | Sprint 5 — as 8 habilidades novas |
| [#24](https://github.com/MjDanielSouza/game/pull/24) | `fix/voltar-ao-menu` | bug: o mapa da campanha não voltava ao título |
| [#25](https://github.com/MjDanielSouza/game/pull/25) | `sprint4/console-toque` | Sprint 4 — visual de console + tela cheia |

**Depois do merge, arrumar uma coisa só:** os #23 e #25 mexem na mesma tabela
de Sprints do `STATUS_PROJETO.md`, cada um marcando a *outra* como pendente.
O git resolve as linhas sozinho, mas sobra a frase **"Só a Sprint 4 fica
pendente"** na seção *Notas que mudam o plano*, que fica falsa. Apagar.

Com os três dentro, **as 5 Sprints da especificação estão completas.**

---

## 2. Dois testes que eu não consegui fazer

Precisam de aparelho de verdade — o painel de navegador da ferramenta não
deixa. O código dos dois está escrito e o caminho de falha está provado.

- **A tecla `Escape`** (PR #24). O painel engole a tecla antes de chegar na
  página; provei por evento sintético. Num teclado de verdade, `Escape` deve
  voltar uma tela em qualquer lugar (menos no título e no resultado).
- **Entrar em tela cheia** (PR #25). O painel recusa `requestFullscreen`.
  Provei que a recusa é silenciosa e o jogo segue em janela. Falta ver
  funcionando **num celular Android**, junto com o `orientation.lock`.

---

## 3. O que ficou pendente de propósito

Nada disso está quebrado. São decisões adiadas, com o motivo.

**Arte de finalização.** `frameDe` já procura um frame `finalizacao`
(índice 12) e cai no `especial` quando não acha. Adicionar a pose é **dado,
não código** — nenhuma linha muda. Foi adiado por custo de geração.

**O parry ficou sem dono.** `tipo: 'parry'` continua implementado no motor,
sem nenhum lutador usando — era o CONTRA-GOLPE do LUCAS, trocado na Sprint 5.
Devolver a alguém é uma linha em `js/data.js`. Ou tirar o tipo do motor.

---

## 4. As três regras que custaram caro neste projeto

Estão no `STATUS_PROJETO.md` também, mas custaram tanto que repito:

1. **Suspeite do instrumento antes do jogo.** Quatro vezes um "bug de
   balanceamento" era o `tools/balance.mjs` medindo errado — a última, o bot
   atacando a `dist < 120` enquanto `empurrarCorpos` o segurava a 132px. **O
   bot nunca apertou botão.**
2. **Prove mecânica sem navegador.** `node test.js` é determinístico e rápido;
   clicar menu no navegador queima chamada e devolve screenshot atrasado.
3. **Tudo que tem unidade de comprimento multiplica por `ESC`.** Escalar só o
   corpo já inverteu três nós do mapa uma vez.

---

## 5. Comandos

```bash
node test.js                 # as checagens (38 em main, 43 com a Sprint 5)
node tools/balance.mjs 200   # remede a curva de dificuldade do mapa
```

**A ordem do mapa em `js/data.js` é definida por essa medição, não pelo
conceito dos personagens.** Mexeu em habilidade, remede e reordena.
