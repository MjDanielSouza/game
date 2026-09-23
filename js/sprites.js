// ============================================================================
//  CURITIBA KOMBAT - sprites
//  Carrega assets/<id>.png + assets/<id>.json (gerados por tools/atlas.py) e
//  desenha o frame pedido. Se o lutador nao tem arte, ninguem chama isto e o
//  render cai no rig procedural - dar arte a um personagem nao mexe nos outros.
// ============================================================================

const atlas = {};        // id -> { frames, escala }
const tentando = {};     // id -> Promise
const semArte = {};      // id -> true, para nao bater no servidor de novo

// Recorta o frame da folha e reaplica a mascara alpha em RLE.
// O alpha do PNG sozinho nao basta: recorte automatico de fundo deixa franja
// semitransparente na borda, que fica visivel contra palco claro.
function recortar(folha, f) {
  const tile = document.createElement('canvas');
  tile.width = f.w;
  tile.height = f.h;
  const c = tile.getContext('2d');
  c.drawImage(folha, f.sx, f.sy, f.w, f.h, 0, 0, f.w, f.h);

  const mascara = document.createElement('canvas');
  mascara.width = f.w;
  mascara.height = f.h;
  const m = mascara.getContext('2d');
  m.fillStyle = '#fff';
  for (const [x, y, w] of f.spans) m.fillRect(x, y, w, 1);

  c.globalCompositeOperation = 'destination-in';
  c.drawImage(mascara, 0, 0);
  return { ...f, tile };
}

// alturaAlvo: quantos pixels de jogo o lutador deve ocupar. A arte pode vir em
// qualquer resolucao - o frame 0 e normalizado para essa altura.
export function carregar(id, alturaAlvo) {
  if (atlas[id] || semArte[id]) return Promise.resolve(!!atlas[id]);
  if (tentando[id]) return tentando[id];

  tentando[id] = (async () => {
    try {
      const r = await fetch(`assets/${id}.json`);
      if (!r.ok) throw new Error('sem manifesto');
      const dados = await r.json();

      const folha = await new Promise((ok, erro) => {
        const im = new Image();
        im.onload = () => ok(im);
        im.onerror = () => erro(new Error('sem folha'));
        im.src = `assets/${id}.png`;
      });

      const frames = dados.frames.map((f) => recortar(folha, f));
      atlas[id] = { frames, escala: alturaAlvo / frames[0].h };
      return true;
    } catch (e) {
      semArte[id] = true;           // segue com o rig procedural, sem barulho
      return false;
    } finally {
      delete tentando[id];
    }
  })();
  return tentando[id];
}

export function tem(id) { return !!atlas[id]; }

// Desenha o frame parado dentro de uma caixa w x h, encostado embaixo. Serve
// para o retrato das telas de DOM: antes elas desenhavam o rig procedural
// mesmo quando o lutador ja tinha arte, entao a selecao mostrava um boneco que
// nao era o personagem que ia entrar na luta.
export function desenharEm(ctx, id, w, h, margem = 0.86) {
  const a = atlas[id];
  if (!a) return false;
  const f = a.frames[0];
  const s = Math.min((h * margem) / f.h, (w * margem) / f.w);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    f.tile,
    Math.round(w / 2 - (f.w * s) / 2), Math.round(h * 0.95 - f.h * s),
    Math.round(f.w * s), Math.round(f.h * s),
  );
  ctx.restore();
  return true;
}

export function desenhar(ctx, id, indice, x, y, dir, mult = 1) {
  const a = atlas[id];
  if (!a) return false;
  const f = a.frames[indice] || a.frames[0];
  const s = a.escala * mult;
  ctx.save();
  ctx.imageSmoothingEnabled = false;          // pixel art tem que ficar dura
  ctx.translate(Math.round(x), Math.round(y));
  ctx.scale(dir, 1);
  ctx.drawImage(
    f.tile,
    Math.round(f.offsetX * s), Math.round(-f.h * s),
    Math.round(f.w * s), Math.round(f.h * s),
  );
  ctx.restore();
  return true;
}

// ----------------------------------------------------------------------------
//  Estado do lutador -> indice de frame
//  `mapa` vem de data.js (lutador.sprite.frames). Chave que falta cai em idle,
//  entao um personagem com um unico frame desenhado ja funciona.
// ----------------------------------------------------------------------------
export function frameDe(f, mapa, tick) {
  if (!mapa) return 0;
  const pega = (...chaves) => {
    for (const k of chaves) {
      const v = mapa[k];
      if (v == null) continue;
      if (Array.isArray(v)) return v[Math.floor(tick / 7) % v.length];
      return v;
    }
    return 0;
  };

  switch (f.estado) {
    case 'ataque': {
      // usa o id do golpe; se nao houver frame proprio, tenta a pose dele
      const pose = f.golpe ? f.golpe.pose : null;
      return pega(f.golpeId, pose, 'soco', 'idle');
    }
    case 'andar': return pega('andar', 'idle');
    case 'agachar': return pega('agachar', 'idle');
    case 'pulo': return pega('pulo', 'idle');
    case 'bloqueio':
    case 'blockstun': return pega('bloqueio', 'idle');
    case 'hitstun': return pega('hitstun', 'idle');
    case 'ko': return pega('ko', 'hitstun', 'idle');
    default: return pega('idle');
  }
}
