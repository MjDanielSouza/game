# Cenários — Curitiba como palco

## A regra que define tudo

Palco de luta não é cartão-postal. O monumento é **fundo**, e fundo tem três
obrigações: ler num piscar de olhos, não competir com os lutadores, e ter um
chão plano onde se pisa. Foto turística bonita quase sempre falha nas três —
é vertical, é aérea, ou põe o monumento bem no centro, que é exatamente onde
os personagens vão ficar.

## Especificação técnica (igual para todos)

- **Tela** 1920×1080. **Arte** 2560×1080 — a sobra é o espaço de câmera, que
  acompanha os lutadores lateralmente.
- **Linha do horizonte a 58% da altura.** Isso põe a câmera na altura do peito
  dos lutadores, que é a altura de câmera de todo fighter de arcade.
- **Terço inferior = chão.** Plano, livre, sem obstáculo, sem detalhe que
  chame atenção. Textura sim, informação não.
- **Monumento deslocado do centro**, ocupando o terço esquerdo ou direito.
- **Três camadas parallax**, geradas separadas e com fundo transparente nas
  duas da frente:

| Camada | Conteúdo | Velocidade |
|---|---|---|
| `ceu` | céu, sol/lua, nuvens, silhueta distante | 0,15× |
| `fundo` | o monumento, a mata, os prédios | 0,45× |
| `frente` | galhos, postes, grade — moldura que passa rápido | 1,25× |

- **Uma cor dominante por palco.** Se dois palcos têm a mesma paleta, viram o
  mesmo palco na memória do jogador.

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

Temos referência boa só da Ópera de Arame. Para os outros dois, o caminho é
baixar na mão da galeria da **Viaje Paraná** — travada para automação por
certificado expirado, mas num navegador comum passa. Procure ali a foto que
cumpre a especificação do topo deste arquivo, não a mais bonita.

Vale lembrar: SDXL já conhece a Ópera de Arame, a estufa do Jardim Botânico e
o Museu Oscar Niemeyer — são arquitetura publicada no mundo inteiro. A
referência melhora o resultado, mas não é bloqueio para começar a testar.
