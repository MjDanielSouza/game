# Curitiba Kombat

Jogo de luta 2D que roda direto no navegador. Oito lutadores, nove locais de
Curitiba e um chefão na Pedreira Paulo Leminski.

Sem build, sem framework, sem dependência. É HTML + CSS + JavaScript de módulo
nativo, servido como arquivo estático.

```bash
python -m http.server 8123
```

Depois abra <http://localhost:8123>. Abrir o `index.html` direto pelo disco
**não funciona** — módulos ES exigem `http://`.

---

## Como se joga

| Tecla | Ação |
|---|---|
| `A` `D` | andar |
| `W` | pular |
| `S` | agachar |
| `Shift` | defender (ou segure para trás enquanto o outro ataca) |
| `J` | soco |
| `K` | chute |
| `S` + `J` | golpe baixo |
| `L` | habilidade do personagem |
| `Espaço` | especial (precisa da barra roxa cheia) |
| `Esc` | abandonar a luta |

As três regras que decidem a partida:

- **Golpe alto** só é bloqueado **em pé**. **Golpe baixo** só é bloqueado
  **agachado**. Errar a altura é levar o golpe inteiro.
- **Agarrão não é bloqueável.** É a resposta para quem trava na defesa.
- **Armadura** (brilho em volta do lutador) absorve o *hitstun*, não o dano.
  Quem está com armadura não recua — então golpe isolado não interrompe.

Bloquear gasta stamina. Stamina zerada = **defesa quebrada** e um tempo parado.

Melhor de 3 rounds, 99 segundos cada. Tempo esgotado decide por percentual de vida.

---

## O elenco

| Lutador | Arquétipo | Habilidade (`L`) | Especial (`Espaço`) |
|---|---|---|---|
| **LUCAS** | all-rounder | CONTRA-GOLPE — janela de parry que devolve o golpe | SEQUÊNCIA COMPLETA — 4 acertos |
| **JOÃO** | brawler | AGARRÃO — não pode ser bloqueado | BORDOADA — dano alto, curto alcance |
| **JULIANO** | rushdown | INVESTIDA — avanço com acerto | MARÉ ALTA — 6 acertos avançando |
| **NEUMANN** | tanque | MURALHA — 3 de armadura por 2,5 s | FIM DE EXPEDIENTE — onda rasteira |
| **RAFAEL LATA** | mobilidade | LADEIRA — dash invencível que atravessa, sem dano: rende super | CAPACETE DE AÇO — investida de tela cheia, 3 acertos |
| **VINICIUS** | zoner | GEADA — projétil que deixa lento | NEVASCA — 5 projéteis |
| **COSTELA** | técnico | ARMADILHA — planta no chão (até 2) | XEQUE-MATE — detona todas de uma vez |
| **DANIEL** | grappler | REUNIÃO — agarrão que avança e não pode ser bloqueado | ÚLTIMA PALAVRA — investida com 2 de armadura |
| **ARAUCÁRIA** | **CHEFÃO** | CHUVA DE PINHÃO — 3 projéteis em arco | QUEDA DA COPA — onda nos dois sentidos |

O chefão tem **armadura passiva**: absorve um golpe e leva ~2,5 s para
recarregar. Golpe avulso não o interrompe — só combo. Você continua ganhando
barra de super nos golpes que ele absorve e nos que ele bloqueia. Abaixo de 40% de vida ele
entra em **fase 2**: mais rápido e com cooldowns menores.

---

## Estrutura

```
index.html        as telas (título, seleção, mapa, briefing, resultado) + canvas
css/style.css     interface
js/data.js        lutadores, golpes, palcos e mapa   <- é aqui que se mexe
js/engine.js      loop, state machine, hitbox/hurtbox, projéteis, IA
js/render.js      rig de ossos dos lutadores e desenho dos palcos
js/ui.js          HUD no canvas e montagem das telas em DOM
js/sprites.js     carrega e desenha sprite, quando o lutador tem arte
js/main.js        cola: teclado, telas, progresso
test.js           checagem do motor, sem navegador
tools/balance.mjs sondagem de dificuldade
tools/atlas.py    poses PNG -> folha de sprite + máscara alpha
```

O motor não conhece nenhum golpe pelo nome. Tudo — alcance, frames, dano,
altura, armadura, cancelamento — vem de `js/data.js`.

### Criar um golpe novo

Adicione uma entrada em `golpes` do lutador em `js/data.js`:

```js
habilidade: golpe({
  nome: 'NOME QUE APARECE NA TELA',
  tipo: 'melee',        // melee | projetil | agarrao | parry | buff | dash | onda | armadilha | detona
  startup: 9,           // frames até a hitbox nascer
  ativo: 4,             // frames com hitbox no ar
  recovery: 18,         // frames travado depois (é a janela em que se apanha)
  dano: 14, hitstun: 22, empurrao: 8,
  stamina: 15, cooldown: 100,
  alcance: { x: 26, y: -48, w: 54, h: 26 },  // x cresce para a frente
  altura: 'alto',       // alto | medio | baixo
  pose: 'chute',        // qual animação o rig usa
}),
```

Depois **rode as duas checagens**:

```bash
node test.js
node tools/balance.mjs 10
```

O primeiro garante que nada quebrou. O segundo mostra se a curva de
dificuldade continua subindo — golpe novo é a forma mais fácil de transformar
um oponente de meio de campanha num muro.

---

## Balanceamento

`tools/balance.mjs` põe um bot de habilidade média no lugar do jogador e roda a
campanha inteira com cada lutador. Ele não substitui jogar, mas pega o que jogar
algumas partidas não pega: dificuldade que não sobe, e chefão impossível.

Estado atual (bot médio — um humano vai bem melhor):

| nó | oponente | vitórias do bot |
|---|---|---|
| 1 | LUCAS | ~89% |
| 2 | JOÃO | ~92% |
| 3 | VINICIUS | ~90% |
| 4 | JULIANO | ~76% |
| 5 | NEUMANN | ~69% |
| 6 | COSTELA | ~36% |
| 7 | RAFAEL LATA | ~24% |
| 8 | **ARAUCÁRIA** | ~11% |

A ordem do mapa foi definida por essa medição, não pelo conceito dos
personagens. O zoner e o armadilheiro *parecem* oponentes de começo e são dos
mais difíceis; o tanque *parece* um muro e é punível.

---

## Arte

Os lutadores são desenhados por código: um rig de ossos (quadril, torso,
cabeça, dois braços e duas pernas em dois segmentos cada) com as poses em
ângulos, e os palcos são silhuetas procedurais em três camadas de parallax.

Isso não é rascunho à espera da arte — é o mesmo rig que o recorte de arte vai
usar. Trocar o desenho de um osso não encosta no motor. Os ângulos em
`render.js` seguem uma convenção só: **0° é o osso apontando para baixo,
positivo é para a frente**, então 90° é horizontal na direção que o lutador
encara e 180° é para cima.

O jogo também já aceita **sprite**: se um lutador declara `sprite` em
`js/data.js`, `js/sprites.js` carrega `assets/<id>.png` + `assets/<id>.json` e
desenha o frame; quem não declara continua no rig. A troca é por personagem.
**[ARTE.md](ARTE.md)** tem o pipeline completo da foto até o sprite, e os
repositórios que ajudam.

Os palcos seguem a especificação de `CENARIOS.md`: horizonte a ~58% da altura,
terço inferior livre para os pés, monumento fora do centro, uma cor dominante
por palco.

---

## Depuração

`window.CK` expõe o estado no console do navegador:

```js
CK.mundo.p2.vida = 1     // derruba o oponente
CK.mundo.p1.super = 100  // libera o especial
CK.progresso = 7         // libera o mapa até o chefão
```

O progresso fica em `localStorage`, chave `curitiba-kombat-v1`.

---

## O que não está aqui

As fotos de referência dos colegas ficam fora do repositório de propósito
(`.gitignore`). Imagem de pessoa real é dela; os arquivos continuam na máquina
local, nada de rosto vai para o ar. O que foi para o jogo são nomes e
arquétipos.

O chefão é ficcional, não é ninguém do grupo.
