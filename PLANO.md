# Arcade IA — plano de execução

## 0. Estado atual da máquina (verificado)

| Recurso | Situação |
|---|---|
| node / npm / git / python / ffmpeg | OK |
| GPU | RTX 3070, 8 GB VRAM — roda SDXL, Flux-schnell GGUF |
| ComfyUI | `C:\AI\ComfyUI\ComfyUI_windows_portable` — instalado, **sem modelos e sem custom nodes** |
| Ollama | instalado, **sem modelos** |
| Repositório | `E:\GAMES_IA` vazio, sem git |

Conclusão: a parte de código roda hoje. A parte de arte por IA local precisa de ~10 GB de download antes de existir.

## 1. Referências pesquisadas

**Portal de jogos (a "casa")**
- `leereilly/games` — arquivado, mas é o mapa de como catalogar jogos web
- `kaigani/HTML5-games-list` — lista curada de jogos HTML5 com fonte completa
- `Digital-Will-Inc/html5-games` — portal open source, jogos independentes servidos como estáticos

Padrão comum a todos: **cada jogo é uma pasta autocontida, o portal é só um índice estático.** Nada de framework.

**Motor de luta**
- `mkhandotnet/StreetPhyter` — fighter HTML5 em Phaser
- `alfredang/street-fighter-game` — fighter em Canvas puro, sem build, PvP local. Mais próximo do que queremos
- `EN10/HTML5Fighting` — Canvas + JS, minimalista, bom para ler o loop de hit detection
- OpenMugen (SDL2) — não roda no browser, mas o formato de dados de personagem do MUGEN (estados, frames, hitboxes) é a melhor referência de *modelagem* de um fighter

## 2. Arquitetura (decisões tomadas)

**Portal:** HTML + CSS + `games.json`. GitHub Pages serve direto do branch. Sem Vite, sem React, sem build step — um jogo novo = uma pasta + uma linha no JSON.

```
/index.html        grade de cards lendo games.json
/games.json        [{slug, titulo, capa, pasta}]
/games/curitiba-kombat/index.html
```

**Motor:** Canvas 2D vanilla, sem dependência. Um fighter 1v1 local são ~600 linhas. Phaser resolveria sprite/input/áudio, mas traz build e 1 MB para uma física que vamos escrever à mão de qualquer jeito.

Núcleo:
- **State machine por personagem** — idle / walk / jump / crouch / block / attack(n) / hitstun / blockstun / ko. Um estado por vez, transições explícitas. É assim que todo fighter sério é feito e é o que impede o jogo de virar sopa de flags.
- **Hitbox / hurtbox** por frame de animação, em dados (`{frame, x, y, w, h, dano, hitstun, custoStamina}`), não em código.
- **Combo** = janela de cancelamento. Cada golpe declara `cancelaEm: [lista de golpes]` e uma janela em frames. Sem sistema de combos separado.
- **Stamina** = barra que drena em golpe/dash/defesa e regenera parada. Stamina zerada → estado `exausto`, sem ataque por N frames. É o que dá o ritmo arcade.
- **Especial** = barra de energia que enche ao dar e receber dano; gasta tudo num golpe de dano alto.
- **Input buffer** de ~8 frames para ler sequências (↓ ↘ → + soco) sem exigir timing desumano.
- **Loop de tempo fixo** (60 Hz lógico, render desacoplado) — sem isso o jogo muda de dificuldade conforme o monitor.

**Dados do personagem:** um `.json` por lutador (stats, frame data, golpes) + um spritesheet. Trocar personagem = trocar dois arquivos, não mexer no motor. É isso que viabiliza "depois a gente troca os personagens pelos colegas".

## 3. Pipeline de arte — a parte que muda o projeto

Gerar cada frame de animação por IA **não funciona**: a consistência quebra entre frames e vira um flicker. O caminho é:

**Cutout / bonecos articulados.** Para cada personagem:
1. Uma única geração de IA: corpo inteiro, pose neutra, luz chapada, fundo liso, traço Mortal Kombat (digitalizado, contraste alto, rim light).
2. Recorte em 8 peças: cabeça, tronco, 2 braços (×2 segmentos), 2 pernas (×2 segmentos).
3. O motor anima por rotação de ossos no canvas. Animação vira dado numérico, não imagem.

Vantagens: 1 geração por personagem em vez de 60; consistência perfeita; animação editável sem refazer arte; troca de personagem trivial.

**Foto do colega → personagem:** ComfyUI + SDXL + IPAdapter FaceID (mantém o rosto) + prompt de estilo. Precisa baixar:
- checkpoint SDXL (~6,5 GB) — base realista
- IPAdapter FaceID + CLIP-Vision (~2 GB) — semelhança facial a partir da foto
- `rembg` ou nó de remoção de fundo

*Antes de usar rosto de colega, peça autorização a cada um. É brincadeira interna, mas imagem de pessoa real é dela.*

**Cenários de Curitiba:** 3 palcos, cada um em 3 camadas parallax geradas separadamente (fundo / meio / chão):
- Jardim Botânico — estufa de vidro ao entardecer
- Rua XV de Novembro — calçadão, pinheiros, névoa
- Ópera de Arame — estrutura tubular, luz de palco, noite

## 4. Fases

**Fase 1 — Portal no ar (1 sessão)**
git init, `index.html` + `games.json`, publicar no GitHub Pages. Entregável: URL viva com um card "em breve".

**Fase 2 — Motor jogável com bonecos de teste (2-3 sessões)**
Retângulos coloridos como personagens. State machine, hitbox/hurtbox, stamina, combo, especial, KO, melhor-de-3, 2 jogadores no mesmo teclado. Entregável: dá para jogar e é divertido *antes* de existir arte. Se não for divertido com retângulos, arte nenhuma salva.

**Fase 3 — Arte (2 sessões)**
Baixar modelos, montar o workflow ComfyUI, gerar 2 personagens fictícios + 1 cenário, montar o rig de cutout, plugar no motor.

**Fase 4 — Polimento arcade (1 sessão)**
Hitstop no impacto, screen shake, barras de vida/stamina, locutor ("FIGHT!", "K.O."), efeito sonoro, tela de seleção.

**Fase 5 — Trocar pelos colegas**
Gerar a partir das fotos, ajustar stats e nomes dos golpes por pessoa. Nenhuma mudança de motor.

## 5. Habilidades necessárias

Já cobertas: JS/Canvas, game loop, git/GitHub Pages, ComfyUI/SDXL, ffmpeg (áudio), skills locais de imagem.

A adquirir no caminho: **frame data de fighter** (quantos frames de startup/active/recovery dão um golpe que parece justo) e **rig de cutout 2D em canvas** (hierarquia de transformações). Ambas se aprendem fazendo na Fase 2 e 3.

## 6. Riscos

- Arte por IA consumir o projeto inteiro → mitigado pela ordem das fases: jogo divertido antes de arte bonita.
- IPAdapter não pegar a semelhança em 8 GB de VRAM → fallback: gerar em 768px e fazer upscale.
- Escopo virar "Mortal Kombat completo" → 2 personagens, 1 cenário, 4 golpes cada. Mais que isso depois da primeira partida real.
