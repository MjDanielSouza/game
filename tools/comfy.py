#!/usr/bin/env python3
"""
Driver do ComfyUI: enfileira um workflow em formato API e baixa o resultado.

    python tools/comfy.py tools/workflows/sprite.json \
        --out assets/brutos/lucas --nome 03-soco \
        --set prompt="..." --set seed=7

O ComfyUI precisa estar rodando. Se nao estiver:
    C:/AI/ComfyUI/ComfyUI_windows_portable/run_nvidia_gpu.bat

`--set chave=valor` procura a chave em `inputs` de todos os nos e substitui.
Se mais de um no tiver a mesma chave, use `--set <id-do-no>.chave=valor`.
Descubra os ids abrindo o JSON: em formato API a chave do objeto e o id.
"""
import argparse
import json
import os
import sys
import time
import urllib.parse
import urllib.request
import uuid

SERVIDOR = os.environ.get('COMFY', '127.0.0.1:8188')


def api(caminho, dados=None):
    url = f'http://{SERVIDOR}{caminho}'
    corpo = json.dumps(dados).encode() if dados is not None else None
    req = urllib.request.Request(url, data=corpo,
                                 headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def vivo():
    try:
        api('/system_stats')
        return True
    except Exception:
        return False


def aplicar(wf, chave, valor):
    """--set prompt=x  ou  --set 6.text=x"""
    # converte numero quando der, senao fica string
    try:
        valor = int(valor)
    except ValueError:
        try:
            valor = float(valor)
        except ValueError:
            pass

    if '.' in chave and chave.split('.', 1)[0] in wf:
        no, campo = chave.split('.', 1)
        wf[no]['inputs'][campo] = valor
        return 1

    n = 0
    for no in wf.values():
        if chave in no.get('inputs', {}):
            no['inputs'][chave] = valor
            n += 1
    if n > 1:
        print(f'  ! "{chave}" existe em {n} nos - todos foram trocados. '
              f'Use <id>.{chave} para acertar so um.')
    return n


def rodar(caminho_wf, saida, nome, sets, timeout=600):
    if not vivo():
        sys.exit(f'ComfyUI nao responde em {SERVIDOR}.\n'
                 f'Suba com: C:/AI/ComfyUI/ComfyUI_windows_portable/run_nvidia_gpu.bat\n'
                 f'(ou aponte outro endereco em COMFY=host:porta)')

    with open(caminho_wf, encoding='utf-8') as f:
        wf = json.load(f)

    for s in sets:
        k, _, v = s.partition('=')
        if not aplicar(wf, k, v):
            sys.exit(f'nenhum no tem a entrada "{k}"')

    cliente = str(uuid.uuid4())
    r = api('/prompt', {'prompt': wf, 'client_id': cliente})
    if 'prompt_id' not in r:
        sys.exit(f'ComfyUI recusou o workflow: {json.dumps(r)[:600]}')
    pid = r['prompt_id']
    print(f'enfileirado {pid}')

    t0 = time.time()
    while True:
        h = api(f'/history/{pid}')
        if pid in h:
            registro = h[pid]
            estado = registro.get('status', {})
            if estado.get('status_str') == 'error' or not estado.get('completed', True):
                msgs = estado.get('messages', [])
                sys.exit('ComfyUI falhou:\n' + json.dumps(msgs, indent=2)[:1500])
            break
        if time.time() - t0 > timeout:
            sys.exit(f'passou de {timeout}s sem terminar')
        time.sleep(1.5)

    os.makedirs(saida, exist_ok=True)
    salvos = []
    for no in registro.get('outputs', {}).values():
        for img in no.get('images', []):
            q = urllib.parse.urlencode({
                'filename': img['filename'], 'subfolder': img.get('subfolder', ''),
                'type': img.get('type', 'output'),
            })
            with urllib.request.urlopen(f'http://{SERVIDOR}/view?{q}', timeout=60) as resp:
                dados = resp.read()
            alvo = os.path.join(saida, f'{nome}.png' if len(salvos) == 0
                                else f'{nome}-{len(salvos)}.png')
            with open(alvo, 'wb') as f:
                f.write(dados)
            salvos.append(alvo)
            print(f'  {alvo}  {len(dados) / 1024:.0f} KB')

    if not salvos:
        sys.exit('terminou sem imagem - o workflow tem um no SaveImage?')
    print(f'{len(salvos)} imagem(ns) em {time.time() - t0:.0f}s')
    return salvos


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('workflow')
    ap.add_argument('--out', required=True, help='pasta de destino')
    ap.add_argument('--nome', default='saida', help='nome base do arquivo')
    ap.add_argument('--set', dest='sets', action='append', default=[],
                    metavar='CHAVE=VALOR')
    ap.add_argument('--timeout', type=int, default=600)
    a = ap.parse_args()
    rodar(a.workflow, a.out, a.nome, a.sets, a.timeout)
