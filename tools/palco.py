#!/usr/bin/env python3
"""
Transforma a geracao bruta de cenario em placa de palco para o jogo.

    python tools/palco.py opera assets/brutos/palcos/opera.png

Le a imagem bruta e escreve assets/palcos/<id>.png.

Mesmo problema dos personagens: o modelo entrega uma *ilustracao com cara de
pixel art* em 2752x1536 com 24 mil cores e sem grade de pixel nenhuma. Aqui ela
vira placa: reduz para a largura que o jogo desenha e corta a paleta.

A largura padrao (1440) sai da conta do parallax. O jogo desenha o fundo com
fator 0.35 numa arena de 1700 e tela de 1280, entao a placa precisa cobrir
1280 + (1700-1280)*0.35 = 1427px. Menos que isso e a borda aparece quando a
camera anda ate a ponta.
"""
import argparse
import os

import numpy as np
from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DESTINO = os.path.join(RAIZ, 'assets', 'palcos')


def processar(ident, origem, largura, cores):
    if not os.path.isfile(origem):
        raise SystemExit(f'nao existe: {origem}')
    os.makedirs(DESTINO, exist_ok=True)

    im = Image.open(origem).convert('RGB')
    alt = round(im.height * largura / im.width)
    # BOX (media de area) e nao NEAREST: NEAREST joga fora pixel e quebra as
    # linhas finas da estrutura, a media preserva a forma antes do corte de
    # paleta. Mesma escolha do pixelize.py.
    p = im.resize((largura, alt), Image.BOX)
    # MEDIANCUT sem dithering: dithering num fundo grande vira ruido que
    # compete com o sprite desenhado por cima.
    # Fica em modo paleta ate o disco: converter de volta para RGB perde a
    # paleta e o PNG sai 5x maior sem ganhar nada.
    p = p.quantize(colors=cores, method=Image.MEDIANCUT, dither=Image.NONE)

    saida = os.path.join(DESTINO, f'{ident}.png')
    p.save(saida, optimize=True)
    n = len(np.unique(np.array(p.convert('RGB')).reshape(-1, 3), axis=0))
    kb = os.path.getsize(saida) // 1024
    print(f'{ident}: {im.width}x{im.height} -> {largura}x{alt}  {n} cores  {kb} KB')
    print(f'  {saida}')
    return saida


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('ident', help='id do palco, igual ao de js/data.js')
    ap.add_argument('origem', help='PNG bruto vindo do gerador')
    ap.add_argument('--largura', type=int, default=1440,
                    help='largura final em pixels (padrao 1440, ver docstring)')
    ap.add_argument('--cores', type=int, default=48,
                    help='tamanho da paleta (padrao 48)')
    a = ap.parse_args()
    processar(a.ident, a.origem, a.largura, a.cores)
