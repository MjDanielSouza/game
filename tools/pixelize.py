#!/usr/bin/env python3
"""
Transforma a geracao bruta em pixel art de verdade.

    python tools/pixelize.py lucas

Le  : assets/brutos/<id>/*.png     (saida do gerador, alta resolucao)
Gera: assets/poses/<id>/*.png      (pronto para tools/atlas.py)

Por que este passo existe: os modelos desenham uma *ilustracao com cara de
pixel art* em 1024x1536, com milhares de cores e sem grade de pixel. Bonito
de perto e papa numa tela de 1280. Aqui ele vira sprite: recorta, reduz para
a altura de jogo, corta a paleta e endurece o alpha.

A altura padrao (176) e a do lutador no jogo: 132 * 1.3 de escala base.
"""
import argparse
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BRUTOS = os.path.join(RAIZ, 'assets', 'brutos')
POSES = os.path.join(RAIZ, 'assets', 'poses')

LIMIAR = 40          # alpha abaixo disto vira buraco (igual ao atlas.py)


def chroma(im, limiar=235):
    """Tira fundo chapado claro, abrindo alpha.

    Necessario porque a maioria dos modelos nao emite canal alpha - so o
    GPT 2.5 emitiu. A varredura parte das bordas para dentro: apagar todo
    pixel claro furaria a camisa creme do LUCAS, que e quase branca.
    """
    a = np.array(im.convert('RGBA'))
    claro = (a[:, :, 0] > limiar) & (a[:, :, 1] > limiar) & (a[:, :, 2] > limiar)
    h, w = claro.shape

    # flood fill a partir da moldura, iterativo (recursao estoura em 2500px)
    fundo = np.zeros_like(claro)
    pilha = [(0, x) for x in range(w) if claro[0, x]]
    pilha += [(h - 1, x) for x in range(w) if claro[h - 1, x]]
    pilha += [(y, 0) for y in range(h) if claro[y, 0]]
    pilha += [(y, w - 1) for y in range(h) if claro[y, w - 1]]
    for y, x in pilha:
        fundo[y, x] = True
    while pilha:
        y, x = pilha.pop()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and claro[ny, nx] and not fundo[ny, nx]:
                fundo[ny, nx] = True
                pilha.append((ny, nx))

    a[:, :, 3] = np.where(fundo, 0, 255)
    return Image.fromarray(a, 'RGBA')


def so_o_corpo(im):
    """Mantem so a maior mancha conectada e joga o resto fora.

    Os modelos deixam cacos: um borrao de nuvem sobre a cabeca, pontinhos de
    fundo que o chroma nao fechou. Sao dezenas de pixels soltos por pose - o
    aereo do NEUMANN veio com uma mancha de 361px flutuando. Em cena isso
    vira sujeira, e pior: entra no bounding box e desloca o sprite inteiro.
    O lutador e sempre uma silhueta unica, entao a maior mancha e ele.
    """
    a = np.array(im)
    solido = a[:, :, 3] >= LIMIAR
    marcas, n = ndimage.label(solido)
    if n <= 1:
        return im
    maior = 1 + int(np.argmax(ndimage.sum(solido, marcas, range(1, n + 1))))
    a[:, :, 3] = np.where(marcas == maior, a[:, :, 3], 0)
    return Image.fromarray(a, 'RGBA')


def recortar(im):
    a = np.array(im)[:, :, 3]
    ys = np.where(a.max(axis=1) >= LIMIAR)[0]
    xs = np.where(a.max(axis=0) >= LIMIAR)[0]
    if not len(ys) or not len(xs):
        return None
    return im.crop((int(xs[0]), int(ys[0]), int(xs[-1]) + 1, int(ys[-1]) + 1))


def quantizar(im, cores):
    """Reduz a paleta sem deixar o alpha virar cor."""
    arr = np.array(im)
    alpha = arr[:, :, 3]
    solido = alpha >= LIMIAR

    rgb = Image.fromarray(arr[:, :, :3], 'RGB')
    # MEDIANCUT sem dithering: dithering em sprite pequeno vira sujeira
    pal = rgb.quantize(colors=cores, method=Image.MEDIANCUT, dither=Image.NONE)
    out = np.dstack([np.array(pal.convert('RGB')),
                     np.where(solido, 255, 0).astype(np.uint8)])
    return Image.fromarray(out, 'RGBA')


def contornar(im, cor=(20, 14, 12)):
    """Contorno de 1px por fora da silhueta. E o que faz o sprite 'colar'
    contra qualquer palco em vez de se dissolver no fundo."""
    arr = np.array(im)
    s = arr[:, :, 3] >= 128
    viz = np.zeros_like(s)
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        v = np.roll(np.roll(s, dy, 0), dx, 1)
        # np.roll e circular: quem encosta no topo do quadro reaparece
        # embaixo e pinta uma tira de contorno solta na borda oposta.
        if dy:
            v[0 if dy > 0 else -1, :] = False
        if dx:
            v[:, 0 if dx > 0 else -1] = False
        viz |= v
    borda = viz & ~s
    arr[borda] = (*cor, 255)
    return Image.fromarray(arr, 'RGBA')


def processar(ident, altura, cores, outline, usar_chroma=False):
    origem = os.path.join(BRUTOS, ident)
    destino = os.path.join(POSES, ident)
    if not os.path.isdir(origem):
        sys.exit(f'nao existe: {origem}\nponha ali os PNGs vindos do gerador.')
    os.makedirs(destino, exist_ok=True)

    arquivos = sorted(f for f in os.listdir(origem) if f.lower().endswith('.png'))
    if not arquivos:
        sys.exit(f'nenhum .png em {origem}')

    # Todas as poses tem que usar a MESMA escala, senao o lutador cresce e
    # encolhe entre frames. A referencia e a pose mais alta do lote.
    alturas = []
    for nome in arquivos:
        im0 = Image.open(os.path.join(origem, nome)).convert('RGBA')
        if usar_chroma:
            im0 = chroma(im0)
        c = recortar(so_o_corpo(im0))
        alturas.append(c.height if c else 0)
    if not max(alturas):
        sys.exit('todas as imagens sairam vazias')
    fator = altura / max(alturas)

    for nome, h0 in zip(arquivos, alturas):
        im = Image.open(os.path.join(origem, nome)).convert('RGBA')
        if usar_chroma:
            im = chroma(im)
        c = recortar(so_o_corpo(im))
        if c is None:
            print(f'  ! {nome}: vazia, pulada')
            continue
        w = max(1, round(c.width * fator))
        h = max(1, round(c.height * fator))
        # BOX (media de area) e nao NEAREST: NEAREST joga fora pixel e quebra
        # linha fina, a media preserva a forma antes do corte de paleta
        p = c.resize((w, h), Image.BOX)
        p = quantizar(p, cores)
        if outline:
            p = contornar(p)
        p.save(os.path.join(destino, nome))
        n_cores = len(np.unique(np.array(p.convert('RGB')).reshape(-1, 3), axis=0))
        print(f'  {nome:<22} {im.width}x{im.height} -> {w}x{h}  {n_cores} cores')

    print(f'\n{ident}: {len(arquivos)} poses em {destino}')
    print(f'proximo passo:  python tools/atlas.py {ident}')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('ident', help='id do lutador, igual ao de js/data.js')
    ap.add_argument('--altura', type=int, default=176,
                    help='altura do sprite mais alto, em pixels (padrao 176)')
    ap.add_argument('--cores', type=int, default=24,
                    help='tamanho da paleta (padrao 24)')
    ap.add_argument('--sem-contorno', action='store_true')
    ap.add_argument('--chroma', action='store_true',
                    help='abre alpha tirando fundo chapado claro (modelos sem canal alpha)')
    a = ap.parse_args()
    processar(a.ident, a.altura, a.cores, not a.sem_contorno, a.chroma)
