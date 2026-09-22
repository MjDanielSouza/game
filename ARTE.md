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
| LUCAS, VINICIUS, NEUMANN, RAFAEL LATA | servem |
| COSTELA | 476px e desfocada — dá pra tentar, mas o rosto vai sair genérico |
| JOÃO, JULIANO | **não servem** — óculos escuros / rosto distorcido por lente |

Peça ao grupo: *selfie de frente, luz do dia, sem óculos escuros, sozinho no
quadro, o maior arquivo que o celular der.* Trinta segundos de cada um valem
mais que qualquer ajuste de workflow.

E peça autorização. São sete pessoas reais e o repositório é público.

### 2. Gerar as poses

Precisamos de ~8 poses por lutador, e **não** de uma animação completa:

```
00-idle  01-andar-a  02-andar-b  03-soco  04-chute
05-baixo  06-bloqueio  07-hitstun
```

Duas rotas, dependendo do que você quiser gastar:

**Rota A — nuvem (recomendada).** Use as skills que já existem aqui
(`human-image`, Higgsfield CLI / Magnific MCP) com a foto como referência de
rosto e um prompt de pixel art. Depois só pós-processamento local. Sem
download de modelo, sem limite de VRAM. Custa crédito por imagem.

**Rota B — local.** ComfyUI + SDXL + IPAdapter FaceID em 768px, que cabe nos
8 GB da 3070. Grátis depois de baixar, mas são ~10 GB de modelo, cinco pacotes
de custom node, e a semelhança facial em 768px é pior.

> O `comfyui-2d-character-pipeline` (abaixo) é o mais completo dos dois mundos,
> mas pede **24 GB de VRAM e 120 GB de modelos**. A máquina tem uma 3070 de
> 8 GB. Está fora.

### 3. Pós-processar para pixel art

Recorte de fundo → pixelização → redução de paleta → contorno de 1px.
O `comfyui-pixel-art-workflow` faz exatamente essa sequência e a metade local
dele (BiRefNet + Pixelate + paleta) funciona com imagem vinda de qualquer
gerador — inclusive da Rota A.

Salve os PNGs com fundo transparente em `assets/poses/<id>/`.

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

Palco não é foto pixelizada. `CENARIOS.md` manda: horizonte a ~58% da altura,
terço inferior livre pros pés, monumento fora do centro, uma cor dominante.
Foto de cartão-postal falha nas três.

O caminho é gerar o palco como pixel art usando a referência só como guia de
composição, e depois separar em três camadas (céu / monumento / moldura da
frente) para o parallax que o `render.js` já espera.

Só a Ópera de Arame tem referência aprovada (`referencias/cenarios/`). Para os
outros, `CENARIOS.md` tem os prompts prontos e diz onde baixar.

Se quiser testar o caminho "foto → pixel art" direto, `pyxelate` faz isso em
uma linha — serve pra prototipar, não pro palco final.

---

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
