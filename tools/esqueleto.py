#!/usr/bin/env python3
"""
Desenha esqueletos OpenPose para guiar o enquadramento no ControlNet.

    python tools/esqueleto.py idle 512 768 saida.png

O problema que isto resolve: o prompt nao controla enquadramento. Pedir
"corpo inteiro, com espaco acima e abaixo" nao funciona - o modelo enche o
quadro e corta cabeca e pes. O esqueleto fixa onde cada junta fica, entao a
figura nasce inteira e com margem.

Poses em coordenadas normalizadas (0..1 do quadro), de perfil 3/4 virado para
a direita, que e como o lutador aparece no jogo.
"""
import sys

from PIL import Image, ImageDraw

# COCO-18: nariz, pescoco, ombroD, cotoveloD, punhoD, ombroE, cotoveloE,
# punhoE, quadrilD, joelhoD, tornozeloD, quadrilE, joelhoE, tornozeloE,
# olhoD, olhoE, orelhaD, orelhaE
LIGACOES = [(1, 2), (1, 5), (2, 3), (3, 4), (5, 6), (6, 7), (1, 8), (8, 9),
            (9, 10), (1, 11), (11, 12), (12, 13), (1, 0), (0, 14), (14, 16),
            (0, 15), (15, 17)]
CORES = [(255, 0, 0), (255, 85, 0), (255, 170, 0), (255, 255, 0), (170, 255, 0),
         (85, 255, 0), (0, 255, 0), (0, 255, 85), (0, 255, 170), (0, 255, 255),
         (0, 170, 255), (0, 85, 255), (0, 0, 255), (85, 0, 255), (170, 0, 255),
         (255, 0, 255), (255, 0, 170), (255, 0, 85)]

# Margem de proposito: cabeca em ~11% do topo, pes em ~91%. E a folga que o
# prompt sozinho nunca consegue segurar.
POSES = {
    'idle': [
        (.50, .125), (.50, .200),                    # nariz, pescoco
        (.44, .205), (.40, .290), (.46, .350),       # braco de tras (guarda)
        (.56, .205), (.61, .290), (.56, .350),       # braco da frente
        (.46, .430), (.44, .620), (.42, .880),       # perna de tras
        (.55, .430), (.60, .625), (.63, .880),       # perna da frente
        (.485, .115), (.525, .115), (.465, .130), (.545, .128),
    ],
    'soco': [
        (.50, .125), (.50, .200),
        (.44, .205), (.40, .290), (.45, .345),
        (.57, .205), (.66, .245), (.76, .255),       # braco estendido
        (.46, .430), (.43, .620), (.40, .880),
        (.56, .430), (.62, .625), (.66, .880),
        (.485, .115), (.525, .115), (.465, .130), (.545, .128),
    ],
    'chute': [
        (.47, .130), (.47, .205),
        (.41, .210), (.36, .285), (.41, .340),
        (.53, .210), (.57, .295), (.52, .350),
        (.44, .435), (.42, .630), (.40, .880),
        (.53, .430), (.66, .500), (.78, .520),       # perna estendida
        (.455, .120), (.495, .120), (.435, .135), (.515, .133),
    ],
    'baixo': [
        (.46, .270), (.46, .340),
        (.41, .345), (.37, .410), (.42, .455),
        (.52, .345), (.57, .410), (.53, .460),
        (.45, .530), (.44, .690), (.42, .880),
        (.53, .530), (.64, .700), (.76, .870),       # varrida rente ao chao
        (.445, .260), (.485, .260), (.425, .275), (.505, .273),
    ],
    'bloqueio': [
        (.50, .125), (.50, .200),
        (.45, .205), (.43, .270), (.50, .225),       # antebracos cruzados
        (.55, .205), (.57, .270), (.50, .235),
        (.47, .430), (.46, .620), (.45, .880),
        (.54, .430), (.56, .625), (.58, .880),
        (.485, .115), (.525, .115), (.465, .130), (.545, .128),
    ],
}


def desenhar(nome, w, h, saida):
    if nome not in POSES:
        sys.exit(f'pose "{nome}" nao existe. tem: {", ".join(POSES)}')
    pts = [(x * w, y * h) for x, y in POSES[nome]]

    im = Image.new('RGB', (w, h), (0, 0, 0))
    d = ImageDraw.Draw(im)
    esp = max(3, round(min(w, h) / 90))

    for i, (a, b) in enumerate(LIGACOES):
        d.line([pts[a], pts[b]], fill=CORES[i % len(CORES)], width=esp)
    r = max(3, round(min(w, h) / 110))
    for i, (x, y) in enumerate(pts):
        d.ellipse([x - r, y - r, x + r, y + r], fill=CORES[i % len(CORES)])

    im.save(saida)
    print(f'{saida}  {w}x{h}  pose "{nome}"')
    return saida


if __name__ == '__main__':
    if len(sys.argv) == 2 and sys.argv[1] == '--todas':
        for p in POSES:
            desenhar(p, 512, 768, f'esqueleto-{p}.png')
    elif len(sys.argv) < 5:
        sys.exit(f'uso: python tools/esqueleto.py <pose> <larg> <alt> <saida.png>\n'
                 f'poses: {", ".join(POSES)}')
    else:
        desenhar(sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4])
