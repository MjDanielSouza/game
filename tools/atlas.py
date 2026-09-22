#!/usr/bin/env python3
"""
Monta o atlas de sprites de um lutador.

    python tools/atlas.py lucas

Le  : assets/poses/<id>/*.png   (um PNG por pose, fundo transparente)
Gera: assets/<id>.png           (folha unica, poses lado a lado)
      assets/<id>.json          (recorte + mascara alpha em RLE por frame)

Por que mascara em RLE e nao so confiar no alpha do PNG: recorte automatico
de fundo quase sempre deixa franja semitransparente na borda. Guardando a
mascara como dado, o jogo recorta de novo na hora de carregar com
destination-in e o contorno sai limpo. E a mesma tecnica do STF.

A ordem dos frames na folha e a ordem alfabetica dos arquivos. Nomeie assim:

    00-idle.png  01-andar-a.png  02-andar-b.png  03-soco.png ...

e depois aponte os indices em `sprite.frames` do lutador, em js/data.js.
"""
import json
import os
import sys

import numpy as np
from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
POSES = os.path.join(RAIZ, 'assets', 'poses')
SAIDA = os.path.join(RAIZ, 'assets')

# alpha abaixo disto vira buraco. 40 corta franja sem comer a silhueta.
LIMIAR = 40
MARGEM = 2          # folga entre frames na folha, evita sangrar pixel do vizinho


def bbox_alpha(a):
    """Caixa do que tem alpha util. None se o frame estiver vazio."""
    linhas = np.where(a.max(axis=1) >= LIMIAR)[0]
    colunas = np.where(a.max(axis=0) >= LIMIAR)[0]
    if not len(linhas) or not len(colunas):
        return None
    return int(colunas[0]), int(linhas[0]), int(colunas[-1]) + 1, int(linhas[-1]) + 1


def spans(a):
    """Mascara alpha como corridas horizontais [x, y, largura]."""
    out = []
    solido = a >= LIMIAR
    for y in range(solido.shape[0]):
        linha = solido[y]
        if not linha.any():
            continue
        # bordas onde a linha liga/desliga
        d = np.diff(np.concatenate(([0], linha.view(np.int8), [0])))
        for ini, fim in zip(np.where(d == 1)[0], np.where(d == -1)[0]):
            out.append([int(ini), y, int(fim - ini)])
    return out


def montar(ident):
    pasta = os.path.join(POSES, ident)
    if not os.path.isdir(pasta):
        sys.exit(f'nao existe: {pasta}\n'
                 f'crie a pasta e ponha um PNG por pose, com fundo transparente.')

    arquivos = sorted(f for f in os.listdir(pasta) if f.lower().endswith('.png'))
    if not arquivos:
        sys.exit(f'nenhum .png em {pasta}')

    recortes = []
    for nome in arquivos:
        im = Image.open(os.path.join(pasta, nome)).convert('RGBA')
        a = np.array(im)[:, :, 3]
        cx = bbox_alpha(a)
        if cx is None:
            print(f'  ! {nome}: totalmente transparente, pulado')
            continue
        x0, y0, x1, y1 = cx
        recortes.append((nome, im.crop((x0, y0, x1, y1))))

    if not recortes:
        sys.exit('todos os frames sairam vazios - o recorte de fundo comeu tudo?')

    larg = sum(im.width for _, im in recortes) + MARGEM * (len(recortes) + 1)
    alt = max(im.height for _, im in recortes) + MARGEM * 2
    folha = Image.new('RGBA', (larg, alt), (0, 0, 0, 0))

    frames, x = [], MARGEM
    for nome, im in recortes:
        y = alt - MARGEM - im.height          # todos apoiados na mesma linha de base
        folha.paste(im, (x, y))
        m = spans(np.array(im)[:, :, 3])
        frames.append({
            'nome': os.path.splitext(nome)[0],
            'sx': x, 'sy': y, 'w': im.width, 'h': im.height,
            # ancora no meio-baixo: o motor desenha em (x do lutador, chao)
            'offsetX': -im.width // 2,
            'spans': m,
        })
        print(f'  {nome:<24} {im.width:>4}x{im.height:<4}  {len(m):>5} corridas')
        x += im.width + MARGEM

    os.makedirs(SAIDA, exist_ok=True)
    png = os.path.join(SAIDA, f'{ident}.png')
    folha.save(png, optimize=True)
    with open(os.path.join(SAIDA, f'{ident}.json'), 'w', encoding='utf-8') as f:
        json.dump({'frames': frames}, f, separators=(',', ':'))

    kb_png = os.path.getsize(png) / 1024
    kb_json = os.path.getsize(os.path.join(SAIDA, f'{ident}.json')) / 1024
    print(f'\n{ident}: {len(frames)} frames  |  folha {larg}x{alt} ({kb_png:.0f} KB)'
          f'  |  mascara {kb_json:.0f} KB')
    print(f'altura do frame 0: {frames[0]["h"]}px  -> use como referencia de escala')
    print(f'\nagora em js/data.js, no lutador {ident}, adicione:')
    print(f"  sprite: {{ frames: {{ idle: 0, andar: [1, 2], soco: 3 }} }},")


def autoteste():
    """Frames sinteticos -> atlas -> mascara reconstruida tem que bater exato."""
    import shutil
    import tempfile

    global POSES, SAIDA
    tmp = tempfile.mkdtemp()
    POSES = os.path.join(tmp, 'poses')
    SAIDA = os.path.join(tmp, 'out')
    alvo = os.path.join(POSES, 'teste')
    os.makedirs(alvo)

    esperado = []
    rng = np.random.default_rng(7)
    for i in range(4):
        w, h = 40 + i * 9, 60 + i * 5
        a = np.zeros((h, w), np.uint8)
        a[8:h - 6, 5:w - 5] = 255                      # corpo
        a[2:14, w // 2 - 6:w // 2 + 6] = 255           # cabeca
        if i % 2:                                       # buraco: testa multiplas
            a[25:38, w // 2 - 3:w // 2 + 3] = 0         # corridas por linha
        a[h - 3:, :] = rng.integers(0, 30, (3, w), dtype=np.uint8)  # franja fraca
        rgba = np.dstack([np.full((h, w), 200, np.uint8)] * 3 + [a])
        Image.fromarray(rgba, 'RGBA').save(os.path.join(alvo, f'{i:02d}-p.png'))
        esperado.append((w, h))

    montar('teste')

    folha = np.array(Image.open(os.path.join(SAIDA, 'teste.png')).convert('RGBA'))
    with open(os.path.join(SAIDA, 'teste.json'), encoding='utf-8') as f:
        dados = json.load(f)

    assert len(dados['frames']) == 4, 'perdeu frame no caminho'
    for i, fr in enumerate(dados['frames']):
        # o jogo reconstroi assim: pinta as corridas e usa como mascara
        m = np.zeros((fr['h'], fr['w']), bool)
        for x, y, w in fr['spans']:
            m[y, x:x + w] = True

        recorte = folha[fr['sy']:fr['sy'] + fr['h'], fr['sx']:fr['sx'] + fr['w'], 3]
        assert np.array_equal(m, recorte >= LIMIAR), f'frame {i}: mascara nao bate'
        assert m.any(), f'frame {i}: mascara vazia'
        # as 3 linhas de franja fraca no rodape tem que sair no recorte do bbox
        w_src, h_src = esperado[i]
        assert fr['h'] <= h_src - 3, (
            f'frame {i}: altura {fr["h"]} de {h_src} - franja fraca sobreviveu')
        assert fr['w'] < w_src, f'frame {i}: laterais vazias nao foram cortadas'
        assert fr['offsetX'] == -fr['w'] // 2, f'frame {i}: ancora fora do centro'

    alturas = {fr['sy'] + fr['h'] for fr in dados['frames']}
    assert len(alturas) == 1, 'frames nao estao apoiados na mesma linha de base'

    shutil.rmtree(tmp, ignore_errors=True)
    print('\nautoteste ok: mascara RLE reconstroi o alpha exato nos 4 frames')


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == '--autoteste':
        autoteste()
    elif len(sys.argv) < 2:
        disponiveis = sorted(os.listdir(POSES)) if os.path.isdir(POSES) else []
        sys.exit(f'uso: python tools/atlas.py <id-do-lutador>\n'
                 f'      python tools/atlas.py --autoteste\n'
                 f'pastas em assets/poses: {disponiveis or "(nenhuma)"}')
    else:
        for ident in sys.argv[1:]:
            print(f'\n== {ident} ==')
            montar(ident)
