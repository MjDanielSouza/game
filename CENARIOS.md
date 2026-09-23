# Cenários — Curitiba como palco

## A regra que define tudo

Palco de luta não é cartão-postal. O monumento é **fundo**, e fundo tem três
obrigações: ler num piscar de olhos, não competir com os lutadores, e ter um
chão plano onde se pisa. Foto turística bonita quase sempre falha nas três —
é vertical, é aérea, ou põe o monumento bem no centro, que é exatamente onde
os personagens vão ficar.

## Especificação técnica (igual para todos)

A especificação antiga pedia **três camadas** de parallax em 2560×1080 com
fundo transparente nas duas da frente. Não foi isso que ficou. Gerar três
camadas que se alinham exige três gerações que concordem entre si, e elas não
concordam: o monumento da camada do meio nunca nasce na mesma altura do
horizonte da camada de trás. O que ficou é **uma placa só**, e o parallax
continua existindo porque o chão, a névoa e a moldura da frente continuam
sendo proceduais, desenhados por cima.

- **Placa:** 1440×804, 48 cores, PNG em modo paleta (~200 KB).
- **A largura sai da conta do parallax.** A tela tem 1280 e a arena 1700; o
  fundo anda a 0,35, então a placa precisa cobrir
  `1280 + (1700-1280)*0,35 = 1427px`. Menos que isso e a borda aparece quando
  a câmera chega na ponta.
- **Ancorada pela base** em `CHAO + 60`, não pelo topo. O que não pode escapar
  é a linha onde o chão da placa encontra o chão desenhado.
- **Horizonte a ~72% da altura** (a especificação antiga dizia 58%, mas com a
  placa ancorada embaixo o que importa é onde o chão começa).
- **Quarto inferior = chão raso, plano e vazio.** É onde os lutadores pisam.
- **Monumento fora do centro.** O centro é dos personagens.
- **Mais escura e de menos contraste que um sprite.** O sprite tem contorno de
  1px e 24 cores saturadas; se o fundo brigar, os dois somem.

```bash
python tools/palco.py opera assets/brutos/palcos/opera.png
```

Lê a geração bruta e escreve `assets/palcos/<id>.png`: reduz com BOX para 1440
e corta a paleta em 48 cores com MEDIANCUT **sem dithering** — dithering num
fundo desse tamanho vira ruído que compete com o sprite.

O carregamento é **por palco**, igual ao dos personagens: `js/render.js` tenta
`assets/palcos/<id>.png` e, se não existir, desenha a silhueta procedural de
sempre. Palco sem placa não quebra nada, e dá pra trazer um de cada vez.

## Os três palcos

### 1. Ópera de Arame — interior *(o principal)*

É o palco óbvio e é o melhor: a Ópera **já é um palco**, com piso de madeira,
arquibancada em volta e uma cúpula tubular que dá uma moldura circular perfeita
atrás dos lutadores. É o único cenário para o qual já temos referência boa
(`referencias/cenarios/opera-arame-interior.jpg`).

- **Paleta:** verde-escuro e prata, luz quente pontual
- **Hora:** noite, holofotes ligados
- **Chão:** tablado de madeira clara — contrasta com os lutadores
- **Vida:** plateia em silhueta escura na arquibancada, reagindo ao KO

> Interior de um teatro circular de tubos de aço, arquibancada escura em volta,
> piso de tablado de madeira clara no primeiro plano, cúpula de treliça metálica
> e vidro acima, holofotes quentes cortando a penumbra, mata escura visível
> através das paredes de vidro, noite, plano aberto na altura do peito,
> composição simétrica, arte de jogo de luta 2D, alto contraste

### 2. Jardim Botânico — a estufa ao amanhecer

O contraponto luminoso. A estufa de vidro faz uma silhueta que qualquer
curitibano reconhece a 200 metros, e o jardim francês dá um chão geométrico
de graça.

- **Paleta:** verde e vidro branco, céu rosa-alaranjado
- **Hora:** amanhecer, neblina baixa
- **Chão:** os canteiros geométricos do jardim francês em perspectiva
- **Composição:** estufa no terço direito, não no centro
- **Vida:** garças levantando voo quando o round começa

> Estufa vitoriana de ferro e vidro ao fundo à direita, jardim francês de
> canteiros geométricos em perspectiva no primeiro plano, neblina baixa,
> amanhecer com céu rosa e alaranjado, araucárias ao longe, plano aberto
> horizontal na altura do peito, arte de jogo de luta 2D

### 3. Largo da Ordem — noite de pedra

O palco sujo e apertado, oposto dos outros dois. Pedra portuguesa, casario
colonial, luz amarela de poste.

- **Paleta:** ocre, terracota e preto, luz de sódio amarela
- **Hora:** noite, depois da chuva — pedra molhada reflete a luz
- **Chão:** pedra portuguesa irregular, poça refletindo
- **Composição:** a igreja no terço esquerdo, beco escuro à direita

> Praça histórica de pedra portuguesa molhada refletindo luz amarela de poste,
> igreja colonial branca à esquerda ao fundo, casario antigo de dois andares,
> noite depois da chuva, neblina fina, plano aberto na altura do peito,
> arte de jogo de luta 2D, alto contraste

## Reserva (se o jogo crescer)

- **Pedreira Paulo Leminski** — paredões de rocha de 30 m fazem um anfiteatro
  natural. Visualmente é o melhor "palco final" de todos. Falta referência.
- **Museu Oscar Niemeyer** — o Olho é a silhueta mais forte da cidade, mas fica
  sobre uma coluna: difícil pôr chão de luta embaixo sem inventar.
- **Estação Tubo** — luta dentro de um tubo de vidro é a ideia mais *curitibana*
  possível, e o formato cilíndrico dá uma moldura ótima. Espaço apertado
  combina com o arquétipo do grappler.

## De onde vêm as imagens

**A placa é gerada, não é a foto pixelizada.** A foto entra como referência de
composição — o que aquele lugar *é* — e a geração entrega algo que obedece à
especificação acima, que nenhuma foto turística obedece.

Estado dos nove palcos:

| Palco | Placa | Referência |
|---|---|---|
| Ópera de Arame | sim | `referencias/cenarios/` |
| Jardim Botânico | sim | `referencias/cenarios/` |
| Praça do Japão | sim | `referencias/cenarios/` |
| Parque Barigui | sim | `referencias/cenarios/` |
| Largo da Ordem | **não** | falta foto |
| Museu Oscar Niemeyer | **não** | falta foto |
| Estação Tubo | **não** | falta foto |
| Torre Panorâmica | **não** | falta foto |
| Pedreira Paulo Leminski | **não** | falta foto |

### Placa feita direto de uma imagem: por que não fazemos mais

Existiu um décimo palco, Araucária, feito **direto** de um cartaz da cidade em
vez de gerado a partir de referência: recorte 2:1 sem o texto →
`tools/palco.py --luz 0.72 --cor 0.78`. Foi retirado.

O motivo não foi técnico — era a placa que mais parecia o lugar. Foi
procedência: não se sabia de onde a imagem tinha vindo nem sob que licença, e
ela era a única placa **derivada direta** de imagem de terceiro. Toda placa
daqui em diante é gerada tendo a foto como guia de composição, e é por isso que
a foto de referência fica em `referencias/`, fora do repositório.

Duas coisas daquele trabalho continuaram, porque valem para qualquer placa:

**`--luz` e `--cor` no `palco.py`**, padrão 1.0 nos dois, que não mexem em
nada. Geração já sai apagada porque o prompt pede; foto e pintura não — chegam
claras e saturadas e brigam com o sprite, que tem 24 cores fortes e contorno de
1px.

**O corte em 2:1 exato.** A placa é ancorada pela base em `CHAO + 60`, então
quanto mais alta ela for, mais do topo some fora da tela. A 1,74:1 a placa sai
com 826px de altura e perde 166px de topo; a 2:1 sai com 719 e perde 59. Num
cenário com silhueta alta — chaminé, torre, cúpula — a diferença é perder ou
não o que identifica o lugar.

Os dois valores existem por causa disto. Uma geração já sai apagada porque o
prompt pede; uma foto ou pintura não — chega clara e saturada, e briga com o
sprite, que tem 24 cores fortes e contorno de 1px. O padrão dos dois é 1.0,
que não mexe em nada.

O recorte em **2:1 exato** também não é gosto. A placa é ancorada pela base em
`CHAO + 60`, então quanto mais alta ela for, mais do topo some fora da tela. A
2:1 a altura sai em 719px e o topo perde 59px — as chaminés da refinaria, que
são a silhueta de verdade da cidade, sobrevivem. No primeiro corte, a 1,74:1,
elas ficavam quase todas de fora.

A foto que serve é **horizontal de 2:1 pra cima, na altura dos olhos, com o
terço de baixo em chão liso e visível, o monumento fora do centro e sem
multidão**. Foto vertical, foto aérea e foto com o monumento centralizado não
servem — e é o que todo banco de imagem tem.

Os bancos oficiais do Paraná não abrem por automação: o da Viaje Paraná está
com certificado SSL expirado, o álbum do Flickr da prefeitura não está
publicado, e a busca do banco estadual é um POST de ASP.NET. Num navegador
comum passam. `referencias/cenarios/CREDITOS.md` tem as oito que já vieram do
Wikimedia e a licença de cada uma.

### A fórmula do prompt

O que fez diferença não foi descrever o lugar bonito — foi descrever a
**composição**, e dizer o que não fazer:

- sem nenhuma pessoa, sem personagem, sem texto
- elevação lateral reta, na altura dos olhos, **sem perspectiva convergindo**
- horizonte a ~72% da altura
- quarto de baixo em chão liso e vazio, *"porque é ali que os lutadores ficam"*
- monumento no terço esquerdo ou direito, *"porque o meio é dos personagens"*
- três faixas chapadas de profundidade, sem degradê entre elas
- mais escuro e de menos contraste que um sprite de primeiro plano

Dizer *por que* cada regra existe mudou o resultado mais que qualquer ajuste de
estilo. Sem o "porque é ali que os lutadores ficam" vinha sempre um canteiro,
uma escada ou uma mureta bem onde o pé pisa.
