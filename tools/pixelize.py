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

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BRUTOS = os.path.join(RAIZ, 'assets', 'brutos')
POSES = os.path.join(RAIZ, 'assets', 'poses')

LIMIAR = 40          # alpha abaixo disto vira buraco (igual ao atlas.py)


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
        viz |= np.roll(np.roll(s, dy, 0), dx, 1)
    borda = viz & ~s
    arr[borda] = (*cor, 255)
    return Image.fromarray(arr, 'RGBA')


def processar(ident, altura, cores, outline):
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
        c = recortar(Image.open(os.path.join(origem, nome)).convert('RGBA'))
        alturas.append(c.height if c else 0)
    if not max(alturas):
        sys.exit('todas as imagens sairam vazias')
    fator = altura / max(alturas)

    for nome, h0 in zip(arquivos, alturas):
        im = Image.open(os.path.join(origem, nome)).convert('RGBA')
        c = recortar(im)
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
    a = ap.parse_args()
    processar(a.ident, a.altura, a.cores, not a.sem_contorno)
