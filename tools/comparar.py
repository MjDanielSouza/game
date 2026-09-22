#!/usr/bin/env python3
"""
Painel de comparacao entre geracoes.

    python tools/comparar.py saida.png nuvem=a.png local=b.png

Mostra cada candidato em tres escalas, porque sprite mente dependendo do zoom:
  - bruto reduzido a 1/3, so para ver a composicao
  - pixelizado 98x176, que e o que o pipeline produz
  - tamanho de jogo (96x172) sobre um recorte de palco, que e o que o jogador ve

Fundo xadrez nas duas primeiras para a transparencia aparecer.
"""
import sys

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, __import__('os').path.dirname(__file__))
from pixelize import LIMIAR, contornar, quantizar, recortar  # noqa: E402

ALTURA_JOGO = 172
ALTURA_SPRITE = 176
MARGEM = 24
PALCO = (58, 44, 38)          # tom de palco noturno, para testar o contorno


def xadrez(w, h, q=8):
    im = Image.new('RGBA', (w, h), (255, 255, 255, 255))
    d = ImageDraw.Draw(im)
    for y in range(0, h, q):
        for x in range(0, w, q):
            if (x // q + y // q) % 2:
                d.rectangle([x, y, x + q - 1, y + q - 1], fill=(206, 206, 216, 255))
    return im


def pixelizar(im, altura=ALTURA_SPRITE, cores=24):
    c = recortar(im)
    if c is None:
        return None
    f = altura / c.height
    p = c.resize((max(1, round(c.width * f)), altura), Image.BOX)
    return contornar(quantizar(p, cores))


def coluna(rotulo, caminho):
    im = Image.open(caminho).convert('RGBA')
    bruto = recortar(im)
    px = pixelizar(im)
    if px is None:
        raise SystemExit(f'{caminho}: imagem vazia depois do recorte')

    # 1) bruto a 1/3
    a = bruto.resize((bruto.width // 3, bruto.height // 3), Image.LANCZOS)
    # 2) pixelizado a 2x nearest
    b = px.resize((px.width * 2, px.height * 2), Image.NEAREST)
    # 3) tamanho de jogo
    f = ALTURA_JOGO / px.height
    c = px.resize((max(1, round(px.width * f)), ALTURA_JOGO), Image.NEAREST)

    n_cores = len(np.unique(np.array(px.convert('RGB')).reshape(-1, 3), axis=0))
    return rotulo, (a, b, c), px.size, n_cores


def montar(saida, itens):
    cols = [coluna(r, c) for r, c in itens]
    lw = max(max(i.width for i in imgs) for _, imgs, _, _ in cols) + MARGEM * 2
    lh = max(max(i.height for i in imgs) for _, imgs, _, _ in cols)
    W = lw * len(cols)
    H = 40 + lh + 30 + lh + 30 + ALTURA_JOGO + 40

    painel = Image.new('RGBA', (W, H), (18, 20, 26, 255))
    d = ImageDraw.Draw(painel)

    for i, (rotulo, (a, b, c), tam, n) in enumerate(cols):
        x0 = i * lw
        d.text((x0 + MARGEM, 12), f'{rotulo}   {tam[0]}x{tam[1]}   {n} cores',
               fill=(255, 210, 63, 255))

        y = 40
        for img, legenda in ((a, 'bruto /3'), (b, 'pixelizado 2x')):
            cx = x0 + (lw - img.width) // 2
            fundo = xadrez(img.width, img.height)
            fundo.alpha_composite(img)
            painel.paste(fundo, (cx, y))
            d.text((x0 + MARGEM, y + img.height + 6), legenda, fill=(150, 156, 168, 255))
            y += img.height + 30

        # tamanho de jogo sobre palco
        cx = x0 + (lw - c.width) // 2
        fundo = Image.new('RGBA', (c.width + 40, ALTURA_JOGO), (*PALCO, 255))
        fundo.alpha_composite(c, (20, 0))
        painel.paste(fundo, (cx - 20, y))
        d.text((x0 + MARGEM, y + ALTURA_JOGO + 6), 'tamanho de jogo sobre palco',
               fill=(150, 156, 168, 255))

        if i:
            d.line([(x0, 0), (x0, H)], fill=(60, 66, 78, 255), width=1)

    painel.convert('RGB').save(saida)
    print(f'{saida}  {W}x{H}')


if __name__ == '__main__':
    if len(sys.argv) < 3:
        raise SystemExit('uso: python tools/comparar.py saida.png rotulo=arquivo.png ...')
    montar(sys.argv[1], [a.split('=', 1) for a in sys.argv[2:]])
