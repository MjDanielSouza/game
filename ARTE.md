# Pipeline de arte — da foto ao sprite

O jogo já aceita sprite. Enquanto um lutador não tem arte, ele é desenhado pelo
rig procedural; quando a arte chega, é só declarar `sprite` em `js/data.js` e
ele troca. A troca é **por personagem** — dar arte ao LUCAS não encosta nos
outros seis.

---

## A técnica (copiada do Supremo Tribunal Fighter)

O [STF](https://stf.fepache.co/) (Felipe Pacheco) resolve isso de um jeito que
vale copiar, e a nossa implementação segue o mesmo desenho:

1. **Uma folha por personagem**, com todas as poses lado a lado.
2. **Um manifesto** com, por frame: o recorte na folha (`sx, sy, w, h`), a
   âncora (`offsetX`) e uma **máscara alpha em RLE** — corridas horizontais
   `[x, y, largura]`.
3. No carregamento, o jogo recorta o tile e **reaplica a máscara** com
   `destination-in`.
4. A escala vem de `altura_do_lutador / altura_do_frame_0` — a arte pode vir em
   qualquer resolução.
5. `imageSmoothingEnabled = false` e `Math.round` em todas as coordenadas.

O passo 3 é o que não é óbvio. O alpha do PNG sozinho não basta: remoção
automática de fundo quase sempre deixa franja semitransparente na borda, que
aparece como halo contra palco claro. Guardando a máscara como dado e
recortando de novo em runtime, o contorno sai duro.

No nosso caso: `tools/atlas.py` gera, `js/sprites.js` consome.

---

## O que fazer, na ordem

### 1. Conseguir as fotos que faltam

Estado atual das referências (640×640, COSTELA 476×476):

| Lutador | Situação |
|---|---|
| ARAUCÁRIA | **não tem foto e não precisa** — é ficcional, saiu de texto |
| LUCAS, VINICIUS, NEUMANN, RAFAEL LATA, DANIEL | servem |
| JULIANO | serve depois de cortar — a lente distorce a **mão** esticada para a câmera, não o rosto |
| JOÃO | serve com ressalva — óculos escuros escondem os olhos, então eles viraram traço do personagem |
| COSTELA | serve — 476px, mas é retrato apertado, então o rosto ocupa quase todo o quadro |

**As três que eu tinha descartado serviam.** O erro foi sempre o mesmo: julgar
pelo defeito aparente em vez de pelo que o sprite precisa.

- O tamanho do arquivo não diz nada. O que importa é **quanto do quadro o rosto
  ocupa** — 476px de retrato apertado rendem mais que 640px de foto de corpo
  inteiro na calçada. Em jogo o rosto tem ~18px.
- Distorção de lente costuma estar numa **parte** da foto. Recorte resolve.
- Quando o defeito está mesmo no rosto — os óculos escuros do JOÃO — assumir
  vira design honesto: não dá para inventar olhos que nunca se viu, e óculos
  escuros num "O BRIGA DE RUA" é escolha, não defeito.

Abra a foto e olhe antes de pedir outra.

Peça ao grupo: *selfie de frente, luz do dia, sem óculos escuros, sozinho no
quadro, o maior arquivo que o celular der.* Trinta segundos de cada um valem
mais que qualquer ajuste de workflow.

E peça autorização. São sete pessoas reais e o repositório é público.

### 2. Gerar as poses

Precisamos de ~12 poses por lutador, e **não** de uma animação completa:

```
00-idle  01-andar-a  02-andar-b  03-soco  04-chute
05-baixo  06-bloqueio  07-hitstun
08-pulo  09-aereo  10-parry  11-especial
```

As oito primeiras já dão um lutador jogável; as quatro últimas tiram os
fallbacks (sem elas o pulo usa o `idle` parado e todo golpe especial usa o
`soco`). O LUCAS tem as doze.

**Quando a pose sair errada, descreva o que *não* fazer.** Repetir a descrição
da pose certa não conserta — o modelo já leu e ignorou. O bloqueio do LUCAS
saiu como um soco duas vezes seguidas; só mudou quando o prompt passou a dizer
"absolutely NOT a punch, do NOT extend any arm forward, the silhouette must be
closed and compact, not reaching". O mesmo vale para o parry e para o aéreo.

**Gere o idle primeiro e use o idle aprovado como referência das outras sete.**
Gerar cada pose direto da foto dá sete personagens parecidos em vez de sete
poses do mesmo personagem — a camisa muda de tom, a proporção muda, o cabelo
muda. O idle é a âncora.

Duas rotas, dependendo do que você quiser gastar:

**Rota A — nuvem (validada no LUCAS, e depois no chefão).** Modelo **GPT 2.5**
— `gpt-2-mini` no Magnific, `gpt_image_2_5` no Higgsfield. É dos poucos que
aceitam fundo transparente **e** referência por imagem, e é o recomendado para
arte não-fotorealista.

> O elenco de oito saiu pelo **Magnific**; o chefão saiu pelo **Higgsfield**,
> depois que o Magnific foi descartado. Mesmo modelo, resultado indistinguível,
> e o preço não é comparável: **325 créditos por imagem** num, **1,5** no
> outro. Vale medir antes de escolher o fornecedor.

Receita que funcionou:

- `aspect_ratio: 2:3`, `quality: high`, `background: transparent`
- a foto do colega (ou o idle aprovado) como referência de imagem
- prompt em três blocos: **pose** (corpo inteiro, de perfil 3/4, virado para a
  direita) → **personagem** (cabelo, roupa peça por peça, "mantenha a
  semelhança facial da referência") → **estilo** (16-bit tipo Street Fighter
  Alpha, contorno escuro, dois tons por cor, ~20 cores, sem gradiente, sem
  anti-aliasing, sem dithering) → **fundo transparente, sem chão, sem sombra,
  sem texto**

Saiu com alpha limpo: 68% totalmente transparente, 32% totalmente opaco, só
0,5% de franja — e a franja que sobra é justamente o que a máscara RLE resolve.

**Sem foto, funciona igual.** A ARAUCÁRIA não tem referência nenhuma — é
ficcional — e as doze poses saíram de texto puro, com o idle aprovado virando
referência das outras onze. O que substitui a foto é descrever o personagem
peça por peça (copa chapada de araucária no lugar da cabeça, tronco de casca
com lajes de granito, pés de raiz, pinhões dourados) e repetir essa descrição
inteira em **todos** os onze prompts, junto com "exatamente o mesmo da imagem
de referência".

**Diga para onde o corpo aponta, e diga o que não fazer.** O primeiro idle do
chefão saiu de frente, simétrico, apesar de o prompt pedir 3/4 virado para a
direita. Só virou quando o prompt passou a dizer *"cabeça, peito, quadril e os
dois pés apontam para a DIREITA; vemos o ombro de perto grande na frente e o de
longe pequeno atrás; absolutamente NÃO de frente para o espectador, NÃO uma
pose simétrica"*. O mesmo valeu para o chute, que saiu como postura de guarda
até o prompt exigir *"uma perna completamente FORA do chão, horizontal, a mais
longa coisa da imagem; a outra é o ÚNICO ponto de contato com o chão"*.

**Rota B — local.** ComfyUI + SDXL + IPAdapter FaceID em 768px, que cabe nos
8 GB da 3070. Grátis depois de baixar, mas são ~10 GB de modelo, cinco pacotes
de custom node, e a semelhança facial em 768px é pior.

> O `comfyui-2d-character-pipeline` (abaixo) é o mais completo dos dois mundos,
> mas pede **24 GB de VRAM e 120 GB de modelos**. A máquina tem uma 3070 de
> 8 GB. Está fora.

### 3. Pós-processar para pixel art

**Este passo não é opcional.** Os modelos entregam uma *ilustração com cara de
pixel art*: o LUCAS veio em 1024×1536 com **59 mil cores** e sem grade de pixel
nenhuma. Bonito ampliado, vira papa numa tela de 1280.

```bash
pip install pillow numpy scipy
python tools/pixelize.py lucas --chroma
```

**`--altura` é a altura do lutador em jogo, não um número fixo.** O elenco vai
a 176; o chefão vai a **244**, porque a escala dele é 1,42 e
`alturaDe()` em `js/data.js` dá 244px. Pixelizar todo mundo no mesmo tamanho
faria o pixel do chefão ser 40% maior que o dos outros na tela — ele seria o
único fora da grade. E o mesmo número precisa chegar ao `Sprites.carregar()`:
`js/sprites.js` fixa a escala da folha na **primeira** chamada e ignora as
seguintes, então pré-carregar todo mundo numa altura fixa desenha o chefão no
tamanho errado pelo resto da sessão.

`--chroma` abre o alpha a partir das bordas, para os modelos que devolvem
fundo branco chapado em vez de canal alpha. Quase todos devolvem.

Lê `assets/brutos/<id>/*.png` e escreve `assets/poses/<id>/*.png`: abre o alpha,
joga fora tudo que não faz parte da maior mancha conectada, recorta pelo alpha,
reduz para a altura de jogo (176px), corta a paleta para 24 cores e põe contorno
de 1px.

O descarte de manchas soltas existe porque os modelos deixam cacos: o aéreo do
NEUMANN veio com um borrão de 361px flutuando acima da cabeça. Em cena vira
sujeira, e pior, entra no bounding box e desloca o sprite inteiro. O LUCAS saiu em **98×176 com 25 cores**.

Duas coisas que o script faz e que importam:

- **A escala sai da pose mais alta do lote**, não de cada pose. Normalizar pose
  a pose faz o lutador crescer e encolher entre frames.
- **Redimensiona com BOX (média de área), não NEAREST.** NEAREST joga pixel
  fora e quebra linha fina; a média preserva a forma antes do corte de paleta.

O `comfyui-pixel-art-workflow` faz a mesma sequência dentro do ComfyUI, se
preferir ficar lá.

### 4. Montar o atlas

```bash
python tools/atlas.py lucas
```

Gera `assets/lucas.png` + `assets/lucas.json` e imprime a linha pra colar em
`js/data.js`:

```js
sprite: { frames: { idle: 0, andar: [1, 2], soco: 3, chute: 4,
                    baixo: 5, bloqueio: 6, hitstun: 7 } },
```

Chave que falta cai em `idle`, então **um único frame desenhado já funciona** —
dá pra ir subindo pose por pose.

Para conferir o recorte sem arte nenhuma:

```bash
python tools/atlas.py --autoteste
```

---

## Cenários

O mesmo caminho dos personagens: a foto é **referência**, não é o resultado.
Palco não é foto pixelizada — foto turística é vertical, põe o monumento no
centro e enche o chão de detalhe, e as três coisas brigam com a luta.

A especificação completa, a fórmula do prompt e o estado dos nove palcos estão
em **[CENARIOS.md](CENARIOS.md)**. O resumo: gere a placa com a referência como
guia de composição e passe por

```bash
python tools/palco.py opera assets/brutos/palcos/opera.png
```

que reduz para 1440px de largura e corta a paleta em 48 cores. **Os nove
palcos estão prontos.**

Duas coisas que só apareceram na última leva: foto **aérea** serve de
referência desde que o prompt diga para não copiar o ângulo de câmera, e o
quinto superior da placa é descartado pela ancoragem, então nada importante
pode estar lá em cima.

Se algum dia a imagem **já existir** e não for gerada, o script aceita `--luz`
e `--cor`. Geração já sai apagada porque o prompt pede; foto e pintura não, e
sem abaixar as duas o fundo briga com o sprite. Nesse caso recorte a **2:1
exato**: a placa é ancorada pela base, então placa alta perde o topo fora da
tela. Mas prefira gerar — `CENARIOS.md` explica por que a única placa feita
assim acabou saindo.

A ideia antiga de gerar **três camadas separadas** de parallax foi abandonada:
três gerações não concordam entre si sobre onde fica o horizonte, e o
monumento nunca encaixa. Uma placa só, com o chão e a moldura da frente
continuando proceduais por cima, resolve com um terço do trabalho.

## Repositórios

| Repo | Pra quê | Licença | Pegadinha |
|---|---|---|---|
| [ghostmmmm/comfyui-pixel-art-workflow](https://github.com/ghostmmmm/comfyui-pixel-art-workflow) | **o mais útil.** Sprite de corpo inteiro: matting, pixelização, paleta 16-32 cores, contorno 1px | MIT | a geração usa GPT Image 2 (pago). A metade local serve pra imagem de qualquer origem |
| [aldegad/sprite-gen](https://github.com/aldegad/sprite-gen) | atlas + limpeza de alpha "unmix" (sem franja), manifesto de frames. Instala como skill de Claude | Apache-2.0 | geração via API externa; o `tools/atlas.py` daqui já cobre o essencial |
| [mor-o/comfyui-2d-character-pipeline](https://github.com/mor-o/comfyui-2d-character-pipeline) | folhas de animação em camadas a partir de uma imagem, automatizável por agente | MIT | **24 GB de VRAM, 120 GB de modelos.** Fora da 3070 |
| [sedthh/pyxelate](https://github.com/sedthh/pyxelate) | imagem → pixel art com paleta e dithering, tem CLI | MIT | ótimo pra protótipo de fundo, não resolve as 3 camadas de parallax |
| [ImageOptim/libimagequant](https://github.com/ImageOptim/libimagequant) | quantização de paleta séria (é o motor do pngquant) | GPL/comercial | use se a paleta do pyxelate ficar suja |
| [alfredang/street-fighter-game](https://github.com/alfredang/street-fighter-game) | fighter em Canvas puro com spritesheet multi-linha e hitbox por frame | — | referência de leitura, já citada no `PLANO.md` |

Para IPAdapter FaceID (Rota B), o par é
`ip-adapter-faceid-plusv2_sdxl.bin` + o LoRA
`ip-adapter-faceid-plusv2_sdxl_lora.safetensors`.

---

## O que não muda

O motor não sabe o que é sprite. `js/sprites.js` só entrega um frame pro
`render.js`; hitbox, frame data, dano e IA continuam vindo de `js/data.js`.
Arte nova não reequilibra nada — mas **rode `node tools/balance.mjs 10` mesmo
assim** se mexer em alcance por causa do tamanho do sprite.
