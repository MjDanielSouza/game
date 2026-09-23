# Status do projeto — Curitiba Kombat

Documento mestre. **Atualizar a cada etapa concluída.** Quem chegar aqui sem
contexto nenhum deve conseguir continuar o trabalho só com este arquivo mais o
código.

- Repositório: <https://github.com/MjDanielSouza/game>
- No ar: <https://mjdanielsouza.github.io/game/>
- Sem build, sem framework, sem dependência. HTML + CSS + módulos ES nativos.

```bash
python -m http.server 8123   # abrir http://localhost:8123
node test.js                 # checagem do motor, sem navegador
node tools/balance.mjs 200   # curva de dificuldade da campanha
```

---

## 1. Arquitetura

### O canvas

Um `<canvas id="jogo">` de **1280×720** fixo, escalado por CSS para caber na
janela (`ajustar()` em `js/main.js`). Todo o combate é desenhado nele. As
**telas de menu são DOM**, não canvas: título, seleção, mapa, palco, briefing,
resultado e final são `<section class="tela">` que entram e saem pela classe
`.ativa`. O canvas só aparece na tela `luta`.

Coordenadas do mundo:

| constante | valor | o que é |
|---|---|---|
| `LARGURA` × `ALTURA` | 1280 × 720 | a tela |
| `ARENA` | 1700 | largura jogável; a câmera acompanha |
| `CHAO` | 600 | o y do piso — **o lutador é ancorado pelos pés nesse y** |
| `ESCALA_ARCADE` | 2.6 | tamanho do corpo; o lutador ocupa ~48% da tela |
| `ESC` | 2.0 | fator de comprimento — **tudo em pixel de mundo multiplica por ele** |
| `FPS` | 60 | passo fixo do loop |

O loop (`js/main.js`) é de **tempo fixo**: acumula `dt` e roda `mundo.atualizar()`
em passos de `1000/60` ms, desenhando uma vez por quadro. Lógica nunca depende
de framerate.

### Os arquivos

```
index.html        telas em DOM + canvas + overlay de toque
css/style.css     interface, cards, mapa, gamepad de toque
js/data.js        lutadores, golpes, palcos, mapa   <- é aqui que se mexe
js/engine.js      Lutador (state machine) + Mundo (uma luta) + IA
js/render.js      placas de palco, rig procedural, efeitos
js/ui.js          HUD no canvas + montagem das telas em DOM
js/sprites.js     carrega folha + máscara RLE, desenha frame
js/main.js        cola: input, telas, progresso, áudio
test.js           26 checagens do motor
tools/balance.mjs bot médio joga a campanha inteira
tools/pixelize.py poses brutas -> pixel art
tools/atlas.py    poses -> folha + manifesto
tools/palco.py    geração bruta -> placa de palco
```

**O motor não conhece nenhum golpe pelo nome.** Alcance, frames, dano, altura,
armadura, cancelamento, custo — tudo vem de `js/data.js`. `engine.js` lê
`golpe.tipo` e trata genericamente.

### Controles

Um único mapa de booleanos (`teclas` em `main.js`). Teclado e toque escrevem
nele; `entrada()` lê. Não existe segundo caminho de input.

| Ação | Jogador 1 | Jogador 2 |
|---|---|---|
| andar | `A` `D` | `←` `→` |
| pular / agachar | `W` / `S` | `↑` / `↓` |
| defender | `Shift` esq. | `Shift` dir. |
| soco / chute | `J` / `K` | `1` / `2` (ou `,` `.`) |
| habilidade | `L` | `3` (ou `/`) |
| especial | `Espaço` | `0` (ou `Enter`) |
| abandonar | `Esc` | — |

Sozinho, o p1 também responde às setas. No modo 2 jogadores cada um fica com o
seu lado.

**O jogo não vê tecla digitada em campo de texto.** O `keydown` sai cedo se o
foco está num `<input>`. Sem isso as iniciais do recorde não entram: A, D, W,
S, J, K e L são todas teclas de jogo e o `preventDefault` comia a letra.

**Toque:** overlay `#toque` sobre o canvas, ligado por
`matchMedia('(pointer: coarse)')` ou pelo primeiro `touchstart`. Usa **Pointer
Events com `setPointerCapture`**, não `touchstart`/`touchend` — a captura
resolve o polegar que escorrega para fora do botão e deixa a direção presa.
Multi-touch funciona: cada botão captura seu próprio `pointerId`.

---

## 2. Mecânicas implementadas

### Combate

- **State machine por lutador:** `idle · andar · agachar · pulo · bloqueio ·
  ataque · hitstun · blockstun · ko`.
- **Frame data em dados:** `startup` / `ativo` / `recovery`. A hitbox só existe
  na fase ativa; o `recovery` é a janela em que se apanha.
- **Altura do golpe:** `alto` só é bloqueado em pé, `baixo` só agachado,
  `medio` sempre. Errar a altura é levar o golpe inteiro.
- **Agarrão (`tipo: 'agarrao'`) ignora bloqueio.** É a resposta para quem trava
  na defesa.
- **Armadura** absorve o *hitstun*, não o dano (leva 70%). Quem está com
  armadura não recua.
- **Stamina:** bloquear gasta proporcional ao dano. Zerada = defesa quebrada
  (`exausto`) e 70 frames parado.
- **Super:** barra de 100, enche apanhando, batendo, bloqueando e na armadura.
- **Cancelamento:** cada golpe lista em `cancela[]` quais podem interrompê-lo
  depois de acertar.
- **Parry (`tipo: 'parry'`)** resolve dentro de `receber()`, não num passo
  separado — todo golpe entra por ali, inclusive projétil e armadilha.
- **Hitstop, tremor de tela, flash** no impacto.
- **Escala de fliperama:** o lutador ocupa ~48% da altura da tela. Corpo,
  hurtbox, hitbox, velocidade, empurrão, avanço, projétil, raio de armadilha e
  as distâncias com que a IA decide multiplicam todos por `ESC`. Escalar só o
  corpo quebra a luta: o alcance dobra, o passo não, e recuar deixa de ser
  resposta.
- **Câmera vertical:** desce até 150px quando uma cabeça chega perto do topo.
  Sem ela, o pulo máximo decapitava os lutadores grandes.
- **Pulo com tempo de voo:** 1,17 a 1,41 s. O stat `pulo` tem a dispersão
  comprimida em torno da média (`impulsoDe()` em data.js) — com a dispersão
  crua não existe gravidade que sirva para o elenco inteiro.

### Finalização (FINALIZE!)

Fases do `Mundo`: `intro · luta · finalize · fatality · fim`.

Quando a vida zera **no round que decide a luta** e a morte foi por KO (tempo
esgotado não conta), em vez de encerrar o jogo abre uma janela de **5 segundos**:
o perdedor vai para o estado `atordoado` — de pé, balançando, sem controle — e
o HUD mostra `FINALIZE!` com a sequência e um relógio.

O vencedor **continua jogando** durante a janela; é assim que ele consegue
entrar a sequência. Se acertar, `Mundo.finalizar()` entra em `fatality`: a
arena escurece com holofote, o golpe conecta com hitstop e tremor, o nome da
finalização aparece na cor do personagem e o perdedor é lançado. Se a janela
fechar sem sequência, é nocaute padrão.

A sequência é lida em `js/main.js` (`registrar` / `conferirFinalizacao`) a
partir de entradas **discretas** — a borda do `keydown` e do `pointerdown`, não
o booleano segurado — com 60 frames de tolerância entre uma e outra. Cada
jogador tem seu buffer, então em versus quem venceu é quem finaliza.

**A sequência NÃO aparece na luta.** Ela mora na ficha do personagem — no card
da tela de seleção e no lado do jogador no briefing —, para se decorar antes.
Tutorial no meio da finalização tapa justamente a cena que essa tela tem para
mostrar.

Na luta ficam só o aviso `FINALIZE!` e o relógio, pequenos, em vermelho escuro
e **acima da cabeça dos lutadores**. Em escala de fliperama a cabeça chega a
~250px, então a faixa de texto grande inteira subiu de 300 para 225: antes o
`LUTEM!`, o `K.O.` e o nome da finalização ficavam todos na frente da cena.

O chefão **não tem finalização**, de propósito — IA humilhando o jogador sem
agência nenhuma não é diversão.

**Falta a arte.** `frameDe` já procura um frame `finalizacao` (seria o 12) e
cai no `especial` enquanto ele não existe. Entrar com a pose depois é dado, não
código.

### Chefão

Armadura passiva que absorve um golpe e recarrega em ~2,4 s: golpe avulso não
interrompe, combo sim. Abaixo de 40% de vida entra em **fase 2** — mais rápido,
cooldowns menores, mais dano.

### Pontuação e recordes (`js/pontos.js`)

Módulo **puro**: não toca no DOM e recebe o `store` por parâmetro, então os
testes rodam sem navegador.

Pontua por round ganho — `VITORIA 500 · VIDA até 1500 · PERFEITO 1500 ·
TEMPO 12/s · ESPECIAL 200 cada · FINALIZACAO 2500` — e multiplica pela
dificuldade do nó: ganhar do chefão com a mesma jogada vale mais.

O resultado mostra a quebra linha a linha. Sem isso a pontuação é um número
que sobe sozinho e não ensina nada.

Terminada a campanha, se entrou no top 10 aparece um `<input>` de 3 letras
**por cima do canvas** e a tabela é salva em `localStorage`
(`curitiba-kombat-recordes`). Storage bloqueado ou com lixo devolve tabela
vazia em vez de quebrar.

**Buraco conhecido:** repetir um nó antes de terminar a campanha soma de novo.
Fechar pediria melhor-pontuação por nó.

### Tela de carregamento

`comecarLuta()` espera de verdade: as folhas dos dois lutadores e a placa do
palco, com barra de progresso e uma dica de `DICAS` em `data.js`. Tem tempo
mínimo de 900 ms — sem ele, com tudo em cache a tela pisca por dois frames e
vira defeito visual.

`carregarPlaca` passou a devolver promessa e **nunca rejeita**: palco sem placa
é caso normal, não erro.

### Modos

- **Campanha:** 9 nós, dificuldade de 0,85 a 1,23 distribuída por
  `dificuldadeDoNo(i)`. Progresso em `localStorage` (`curitiba-kombat-v1`).
- **2 jogadores:** `Mundo` com `duplo: true`; o p2 recebe a segunda entrada em
  vez de `pensarIA()`. Escolhe p1, p2 e o local.

### Arte

Sistema de **fallback por personagem e por palco**, e é o que permitiu trazer
arte um de cada vez sem quebrar nada:

- lutador com `sprite` em `data.js` → `assets/<id>.png` + `.json`;
  sem `sprite` → rig procedural de ossos em `render.js`.
- palco com `assets/palcos/<id>.png` → placa; sem → silhueta procedural.

**Hoje todos os 9 lutadores e todos os 9 palcos têm arte.** O rig procedural
continua no código como rede de segurança, mas não desenha nada.

Pipeline completo em [ARTE.md](ARTE.md) e [CENARIOS.md](CENARIOS.md).

---

## 3. Estado das Sprints

| # | Sprint | Status |
|---|---|---|
| 1 | Escala arcade e física de pulo | **pronta** |
| 2 | Sistema de finalização (FINALIZE!) | **pronta** — falta só o frame de arte |
| 3 | Ranking, loading e nova seleção | **pronta** |
| 4 | Visual de console portátil + tela cheia no toque | a fazer — **o sistema já existe** |
| 5 | Habilidades novas dos 8 do elenco | a fazer |

### Notas que mudam o plano

**Sprint 4 inclui tela cheia.** Pedido depois: botão de tela cheia no mobile
(`requestFullscreen` + `screen.orientation.lock('landscape')` quando o
navegador deixar). Vai junto com o visual de console.

**Sprint 4 já está metade pronta.** O gamepad de toque foi entregue antes:
D-pad à esquerda, ações à direita, multi-touch, mapeado nos mesmos booleanos.
Falta só o **visual** — opacidade 0.5, sombreamento, afundar no `:active`.
Não trocar Pointer Events por `touchstart` puro: a captura de ponteiro é o que
impede a direção de ficar presa quando o polegar escorrega.

**Sprint 5 vai derrubar o balanceamento.** A curva publicada no README foi
medida com as habilidades atuais. Trocar as oito exige remedir com
`node tools/balance.mjs 200` e atualizar a tabela no mesmo PR.

---

## 4. Balanceamento

`tools/balance.mjs` põe um bot de habilidade média no lugar do jogador e roda a
campanha inteira. Não substitui jogar, mas pega o que jogar algumas partidas não
pega: dificuldade que não sobe e chefão impossível.

**A régua é o bot, e o bot mede errado com frequência.** Três investigações
desta sessão terminaram em viés do instrumento, não em defeito do jogo. Antes
de mexer em `data.js` por causa de um número, suspeite do `botMedio`.

Erro padrão ≈ `sqrt(p(1-p)/N)`. A N=200 são ~3 pontos: diferença menor que isso
não é diferença.

---

## 5. Privacidade

Sete lutadores são colegas reais, com autorização de uso das fotos. As fotos
ficam **fora do repositório** (`.gitignore`); o que foi publicado são nomes,
apelidos e o pixel art. `PERSONAGENS.md` também está fora — tem comentário
sobre o rosto de gente real.

O chefão **ARAUCÁRIA é ficcional**, não é ninguém do grupo. Foi assim de
propósito: não havia como pedir autorização para transformar alguém em monstro.

As fotos de cenário também ficam em `referencias/`, fora do repo. Entram só
como guia de composição para a geração; a placa publicada é gerada, não é a
foto.
