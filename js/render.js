// ============================================================================
//  CURITIBA KOMBAT - render
//  Lutador = rig de ossos desenhado por codigo (o mesmo rig que o cutout de
//  arte vai usar depois: trocar o desenho de cada osso nao mexe no motor).
//  Palco = silhuetas procedurais em 3 camadas de parallax.
// ============================================================================

import { LARGURA, ALTURA, CHAO, ARENA, PALCOS } from './data.js';
import * as Sprites from './sprites.js';

// ----------------------------------------------------------------------------
//  Placas de palco
//  Quem tem placa em assets/palcos/<id>.png desenha a foto-referencia
//  pixelizada; quem nao tem segue nas silhuetas procedurais. A troca e por
//  palco, igual ao sprite dos lutadores: da para trazer um cenario de cada vez
//  sem mexer nos outros.
// ----------------------------------------------------------------------------
const placas = {};        // id -> Image pronta
const semPlaca = {};      // id -> true, para nao bater no servidor de novo

export function carregarPlaca(id) {
  if (placas[id] || semPlaca[id]) return;
  semPlaca[id] = true;                       // so tenta uma vez
  const im = new Image();
  im.onload = () => { placas[id] = im; delete semPlaca[id]; };
  im.src = `assets/palcos/${id}.png`;
}

// Fator de parallax do fundo. A placa precisa cobrir
// LARGURA + (ARENA - LARGURA) * PARALLAXE pixels de largura.
const PARALLAXE = 0.35;

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rad = (g) => (g * Math.PI) / 180;

// ruido deterministico por palco (mesma mata todo jogo)
function rnd(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

// ============================================================================
//  OSSOS
// ============================================================================
// Desenha um osso conico de (x,y) no angulo `ang` (0 = para baixo).
// Retorna a ponta, para encadear.
function osso(ctx, x, y, ang, len, w1, w2, cor) {
  const ex = x + Math.sin(ang) * len;
  const ey = y + Math.cos(ang) * len;
  const nx = Math.cos(ang), ny = -Math.sin(ang);
  ctx.fillStyle = cor;
  ctx.beginPath();
  ctx.moveTo(x + nx * w1, y + ny * w1);
  ctx.lineTo(ex + nx * w2, ey + ny * w2);
  ctx.lineTo(ex - nx * w2, ey - ny * w2);
  ctx.lineTo(x - nx * w1, y - ny * w1);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath(); ctx.arc(ex, ey, w2, 0, TAU); ctx.fill();
  return [ex, ey];
}

// ============================================================================
//  POSES
// ============================================================================
function progressoGolpe(f) {
  const g = f.golpe;
  if (!g) return 0;
  if (f.t <= g.startup) return -0.35 * (f.t / Math.max(1, g.startup));
  if (f.t <= g.startup + g.ativo) return 1;
  return Math.max(0, 1 - (f.t - g.startup - g.ativo) / Math.max(1, g.recovery));
}

// Angulos em GRAUS. 0 = osso apontando para BAIXO. Positivo = para a FRENTE.
// Entao 90 = horizontal na direcao que o lutador encara, 180 = para cima.
// Cada membro e [segmento de cima (absoluto), dobra da junta (relativa)].
function pose(f, tick) {
  const resp = Math.sin(tick * 0.06) * 2;
  const p = {
    dx: 0, dy: 0, torso: -4 + resp * 0.3, cabeca: 2,
    bracoT: [24, 56], bracoF: [32, 62],     // guarda: maos na frente do peito
    pernaT: [12, -8], pernaF: [-14, 8],
  };

  const est = f.estado;

  if (est === 'ko') {
    p.dy = 46; p.torso = -78; p.cabeca = 20;
    p.bracoT = [-48, 18]; p.bracoF = [-36, 10];
    p.pernaT = [58, 26]; p.pernaF = [76, 18];
    return p;
  }

  if (est === 'hitstun') {
    const k = Math.min(1, f.t / 4);
    p.torso = -4 - 22 * k; p.cabeca = -12 * k; p.dy = 3;
    p.bracoT = [-26 * k, 22]; p.bracoF = [-18 * k, 16];
    p.pernaT = [22, -6]; p.pernaF = [-22, 10];
    return p;
  }

  if (est === 'blockstun' || est === 'bloqueio') {
    p.torso = 6; p.cabeca = -3; p.dy = f.agachado ? 20 : 2;
    p.bracoT = [58, 72]; p.bracoF = [66, 66];   // antebracos cruzados na frente
    if (f.agachado) { p.pernaT = [46, -84]; p.pernaF = [30, -78]; }
    return p;
  }

  if (est === 'agachar') {
    p.dy = 24; p.torso = 8;
    p.bracoT = [30, 58]; p.bracoF = [38, 64];
    p.pernaT = [50, -88]; p.pernaF = [26, -80];
    return p;
  }

  if (est === 'pulo' || !f.noChao) {
    const subindo = f.vy < 0;
    p.torso = subindo ? -10 : 8; p.dy = -2;
    p.bracoT = [subindo ? -34 : 16, 44]; p.bracoF = [subindo ? -24 : 26, 50];
    p.pernaT = [subindo ? 48 : 20, -60]; p.pernaF = [subindo ? 12 : -28, -30];
  }

  if (est === 'andar') {
    const c = Math.sin(tick * 0.22) * 26;
    p.pernaT = [c, -Math.max(0, c) * 0.5 - 6];
    p.pernaF = [-c, -Math.max(0, -c) * 0.5 - 6];
    p.bracoT = [24 - c * 0.45, 56];
    p.bracoF = [32 + c * 0.45, 62];
    p.dy = Math.abs(Math.sin(tick * 0.22)) * -2;
    p.torso = -5;
  }

  if (est !== 'ataque') return p;

  // ---- poses de golpe ----
  // u: -0.35 = recolhendo (startup), 1 = estendido (ativo), ->0 (recovery)
  const u = progressoGolpe(f);
  const nome = f.golpe ? f.golpe.pose : 'soco';

  switch (nome) {
    case 'soco':
      p.bracoF = [32 + 58 * u, 62 - 58 * u];      // u=1 -> [90, 4] reto na frente
      p.bracoT = [24 - 20 * u, 62];
      p.torso = -4 + 14 * u; p.dx = 4 * u;
      p.pernaF = [-18 - 6 * u, 8];
      break;
    case 'chute':
      p.pernaF = [-14 + 99 * u, 8 - 7 * u];       // u=1 -> [85, 1] perna estendida
      p.pernaT = [8 + 12 * u, -6];
      p.torso = -4 - 20 * u; p.dy = -4 * u;
      p.bracoT = [-24 * u, 30]; p.bracoF = [40 + 20 * u, 64];
      break;
    case 'baixo':
      p.dy = 26; p.torso = 14 + 8 * u;
      p.pernaF = [-30 + 118 * u, 4 - 4 * u];      // varre rente ao chao
      p.pernaT = [56, -86];
      p.bracoT = [20, 40]; p.bracoF = [40, 70];
      break;
    case 'aereo':
      p.torso = 12; p.dy = -4;
      p.pernaF = [-16 + 88 * u, -14 + 10 * u];
      p.pernaT = [40, -70];
      p.bracoF = [30 + 40 * u, 56]; p.bracoT = [-20, 34];
      break;
    case 'investida':
    case 'dash':
      p.torso = -4 + 32 * Math.abs(u); p.dy = 6; p.dx = 6 * u;
      p.bracoF = [34 + 52 * u, 58 - 52 * u]; p.bracoT = [-40, 30];
      p.pernaF = [-44, 10]; p.pernaT = [40, -20];
      break;
    case 'agarrao':
      p.bracoF = [32 + 54 * u, 60 - 54 * u];
      p.bracoT = [28 + 56 * u, 62 - 56 * u];      // as duas maos pra frente
      p.torso = -4 + 12 * u; p.dx = 3 * u;
      break;
    case 'projetil':
      p.bracoF = [30 + 58 * u, 62 - 58 * u];
      p.bracoT = [26 + 50 * u, 64 - 48 * u];
      p.torso = -2 + 8 * u; p.dy = -1;
      break;
    case 'parry':
      p.bracoF = [64, 44]; p.bracoT = [40, 60];   // palma aberta, mao alta
      p.torso = 10; p.dx = -2;
      break;
    case 'muralha':
      p.bracoF = [72, 58]; p.bracoT = [68, 62];
      p.torso = 4; p.dy = 5 * Math.abs(u);
      break;
    case 'pound':
      p.bracoF = [168 - 142 * u, 10]; p.bracoT = [172 - 146 * u, 8];  // acima -> chao
      p.torso = -18 + 32 * u; p.dy = 12 * Math.max(0, u);
      p.pernaF = [-26, 6]; p.pernaT = [26, -10];
      break;
    case 'armadilha':
      p.dy = 30; p.torso = 22;
      p.bracoF = [16 + 10 * u, 18]; p.bracoT = [24, 50];
      p.pernaF = [-34, -60]; p.pernaT = [56, -86];
      break;
    case 'especial':
      p.bracoF = [30 + 60 * u, 62 - 58 * u];
      p.bracoT = [26 + 58 * u, 64 - 56 * u];
      p.torso = -6 + 18 * u; p.dx = 5 * u; p.dy = -3 * Math.max(0, u);
      p.pernaF = [-24 + 14 * u, 8]; p.pernaT = [18, -10];
      break;
  }
  return p;
}

// ============================================================================
//  LUTADOR
// ============================================================================
export function desenharLutador(ctx, f, tick) {
  const s = f.escala;
  const bulk = f.def.fisico.bulk;
  const c = f.def.cor;
  const p = pose(f, tick);

  // sombra
  ctx.save();
  ctx.globalAlpha = clamp(0.38 - (CHAO - f.y) / 500, 0.06, 0.38);
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(f.x, CHAO + 4, 34 * s * bulk, 8 * s, 0, 0, TAU);
  ctx.fill();
  ctx.restore();

  // Tem arte? Desenha o sprite. Nao tem? Cai no rig procedural abaixo.
  // A troca e por personagem: dar arte ao LUCAS nao encosta nos outros seis.
  if (Sprites.tem(f.id)) {
    const mapa = f.def.sprite && f.def.sprite.frames;
    ctx.save();
    if (f.piscar > 0 && f.piscar % 4 < 2) ctx.globalAlpha = 0.72;
    Sprites.desenhar(ctx, f.id, Sprites.frameDe(f, mapa, tick), f.x, f.y, f.dir);
    ctx.restore();
    auras(ctx, f);
    return;
  }

  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.scale(f.dir, 1);
  ctx.translate(p.dx * s, p.dy * s);

  if (f.piscar > 0 && f.piscar % 4 < 2) ctx.globalAlpha = 0.72;

  const hipY = -62 * s;
  const tAng = rad(180 + p.torso);          // torso aponta para cima
  const torsoLen = 42 * s;
  const chestX = Math.sin(tAng) * torsoLen;
  const chestY = hipY + Math.cos(tAng) * torsoLen;

  const w = (n) => n * s * bulk;
  const escuro = sombrear(c.roupa, -0.28);
  const pelE = sombrear(c.pele, -0.22);

  // --- braco de tras ---
  const [ctx1, cty1] = osso(ctx, chestX, chestY + w(2), rad(p.bracoT[0]), 26 * s, w(6.5), w(5.2), escuro);
  osso(ctx, ctx1, cty1, rad(p.bracoT[0] + p.bracoT[1]), 24 * s, w(5.2), w(4.4), pelE);

  // --- perna de tras ---
  const [jx1, jy1] = osso(ctx, -w(5), hipY, rad(p.pernaT[0]), 32 * s, w(8), w(6.2), escuro);
  osso(ctx, jx1, jy1, rad(p.pernaT[0] + p.pernaT[1]), 32 * s, w(6.2), w(5), escuro);

  // --- torso ---
  ctx.fillStyle = c.roupa;
  ctx.beginPath();
  ctx.moveTo(-w(11), hipY + 4 * s);
  ctx.lineTo(chestX - w(15), chestY);
  ctx.lineTo(chestX + w(15), chestY);
  ctx.lineTo(w(11), hipY + 4 * s);
  ctx.closePath();
  ctx.fill();
  // faixa de detalhe
  ctx.fillStyle = c.detalhe;
  ctx.globalAlpha *= 0.9;
  ctx.beginPath();
  ctx.moveTo(chestX - w(5), chestY + 2 * s);
  ctx.lineTo(chestX + w(5), chestY + 2 * s);
  ctx.lineTo(w(4), hipY + 2 * s);
  ctx.lineTo(-w(4), hipY + 2 * s);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha /= 0.9;

  // --- perna da frente ---
  const [jx2, jy2] = osso(ctx, w(5), hipY, rad(p.pernaF[0]), 32 * s, w(8.5), w(6.6), c.roupa);
  const [px2, py2] = osso(ctx, jx2, jy2, rad(p.pernaF[0] + p.pernaF[1]), 32 * s, w(6.6), w(5.2), c.roupa);
  // pe
  ctx.fillStyle = escuro;
  ctx.beginPath(); ctx.ellipse(px2 + w(3), py2 + 2 * s, w(9), w(4), 0, 0, TAU); ctx.fill();

  // --- braco da frente ---
  const [cx2, cy2] = osso(ctx, chestX + w(3), chestY + w(2), rad(p.bracoF[0]), 26 * s, w(7), w(5.6), c.roupa);
  const [mx, my] = osso(ctx, cx2, cy2, rad(p.bracoF[0] + p.bracoF[1]), 24 * s, w(5.6), w(4.6), c.pele);
  // punho
  ctx.fillStyle = c.pele;
  ctx.beginPath(); ctx.arc(mx, my, w(6), 0, TAU); ctx.fill();

  // --- cabeca ---
  const cabAng = rad(180 + p.torso + p.cabeca);
  const hx = chestX + Math.sin(cabAng) * 20 * s;
  const hy = chestY + Math.cos(cabAng) * 20 * s;
  desenharCabeca(ctx, hx, hy, s * (0.95 + bulk * 0.06), f.def, c);

  ctx.restore();
  auras(ctx, f);
}

// Armadura e lentidao em coordenadas de mundo, para valerem igual no rig
// procedural e no sprite.
function auras(ctx, f) {
  if (f.armadura <= 0 && f.lentidao <= 0) return;
  const cx = f.x;
  const cy = f.y - f.altura * 0.5;
  const rx = f.largura * 0.78;
  const ry = f.altura * 0.54;
  ctx.save();
  if (f.armadura > 0) {
    ctx.strokeStyle = f.def.chefao ? 'rgba(201,162,39,0.75)' : 'rgba(93,143,196,0.8)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
    ctx.stroke();
  }
  if (f.lentidao > 0) {
    ctx.fillStyle = 'rgba(191,230,245,0.30)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 0.96, ry * 1.04, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function desenharCabeca(ctx, x, y, s, def, c) {
  const r = 14 * s;
  const tipo = def.cabeca.tipo;
  const cc = def.cabeca.cor;

  // pescoco
  ctx.fillStyle = sombrear(c.pele, -0.2);
  ctx.fillRect(x - 4 * s, y + r * 0.4, 8 * s, 8 * s);

  // craneo
  ctx.fillStyle = c.pele;
  ctx.beginPath();
  ctx.ellipse(x, y, r * 0.86, r, 0, 0, TAU);
  ctx.fill();

  // olho (perfil 3/4 virado para a frente)
  ctx.fillStyle = '#20160f';
  ctx.beginPath(); ctx.ellipse(x + r * 0.34, y - r * 0.12, r * 0.13, r * 0.17, 0, 0, TAU); ctx.fill();

  ctx.fillStyle = cc;
  switch (tipo) {
    case 'gorro':
      ctx.beginPath();
      ctx.arc(x, y - r * 0.18, r * 0.95, Math.PI, TAU);
      ctx.fill();
      ctx.fillRect(x - r * 0.95, y - r * 0.32, r * 1.9, r * 0.38);
      break;
    case 'capacete':
      ctx.beginPath();
      ctx.ellipse(x, y - r * 0.18, r * 1.02, r * 0.9, 0, Math.PI, TAU);
      ctx.fill();
      ctx.fillRect(x + r * 0.2, y - r * 0.28, r * 1.0, r * 0.2);   // aba
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.6 * s;
      ctx.beginPath(); ctx.moveTo(x - r * 0.4, y - r); ctx.lineTo(x - r * 0.1, y - r * 0.25); ctx.stroke();
      break;
    case 'bucket':
      ctx.beginPath(); ctx.ellipse(x, y - r * 0.3, r * 0.9, r * 0.62, 0, Math.PI, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x, y - r * 0.28, r * 1.45, r * 0.22, 0, 0, TAU); ctx.fill();
      break;
    case 'careca':
      ctx.globalAlpha *= 0.85;
      ctx.beginPath(); ctx.ellipse(x - r * 0.15, y + r * 0.35, r * 0.85, r * 0.42, 0, 0, Math.PI); ctx.fill();
      ctx.globalAlpha /= 0.85;
      break;
    case 'oculos':
      ctx.beginPath(); ctx.ellipse(x, y - r * 0.5, r * 0.88, r * 0.5, 0, Math.PI, TAU); ctx.fill();
      ctx.strokeStyle = '#1c1c22'; ctx.lineWidth = 2 * s;
      ctx.beginPath(); ctx.ellipse(x + r * 0.34, y - r * 0.1, r * 0.28, r * 0.24, 0, 0, TAU); ctx.stroke();
      break;
    case 'copa': {  // chefao: copa de araucaria, em duas camadas
      // dois tons: o verde chapado sumia contra o ceu escuro da Pedreira
      for (const [tom, esc, dy] of [[sombrear(cc, -0.35), 1.0, 0], [cc, 0.78, -r * 0.35]]) {
        ctx.fillStyle = tom;
        for (let i = 0; i < 9; i++) {
          const a = Math.PI + (i / 8) * Math.PI;
          ctx.beginPath();
          ctx.moveTo(x, y - r * 0.2 + dy);
          ctx.lineTo(x + Math.cos(a) * r * 2.6 * esc, y + Math.sin(a) * r * 1.7 * esc - r * 0.5 + dy);
          ctx.lineTo(x + Math.cos(a) * r * 2.2 * esc, y + Math.sin(a) * r * 1.15 * esc - r * 0.1 + dy);
          ctx.closePath(); ctx.fill();
        }
      }
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath(); ctx.arc(x + r * 0.34, y - r * 0.1, r * 0.22, 0, TAU); ctx.fill();
      break;
    }
    default:      // cabelo
      ctx.beginPath(); ctx.ellipse(x, y - r * 0.28, r * 0.92, r * 0.78, 0, Math.PI, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x - r * 0.6, y - r * 0.1, r * 0.34, r * 0.5, 0, 0, TAU); ctx.fill();
  }
}

function sombrear(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp(((n >> 16) & 255) * (1 + f), 0, 255) | 0;
  const g = clamp(((n >> 8) & 255) * (1 + f), 0, 255) | 0;
  const b = clamp((n & 255) * (1 + f), 0, 255) | 0;
  return `rgb(${r},${g},${b})`;
}

// ============================================================================
//  PALCOS
// ============================================================================
export function desenharPalco(ctx, idPalco, camX, tick) {
  const P = PALCOS[idPalco];
  const g = ctx.createLinearGradient(0, 0, 0, CHAO + 40);
  g.addColorStop(0, P.ceu[0]); g.addColorStop(0.55, P.ceu[1]); g.addColorStop(1, P.ceu[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, LARGURA, ALTURA);

  const off = (k) => -(camX - LARGURA / 2) * k;
  const placa = placas[idPalco];

  if (placa) {
    // A placa cobre ceu e monumento numa camada so. Perde o parallax entre os
    // dois, que a 0.15 e 0.45 quase nao se via, e ganha o lugar de verdade.
    // Encostada embaixo em CHAO + 60: a faixa de chao da imagem fica atras do
    // chao procedural, que continua sendo quem define onde o lutador pisa.
    const w = LARGURA + (ARENA - LARGURA) * PARALLAXE;
    const h = (w * placa.height) / placa.width;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(off(PARALLAXE), 0);
    ctx.drawImage(placa, Math.round(-(w - LARGURA) / 2), Math.round(CHAO + 60 - h),
      Math.round(w), Math.round(h));
    ctx.restore();
  } else {
    // camada 0 - ceu / astro
    ctx.save();
    ctx.translate(off(0.15), 0);
    astro(ctx, P, idPalco, tick);
    ctx.restore();

    // camada 1 - o monumento
    ctx.save();
    ctx.translate(off(0.45), 0);
    silhueta(ctx, P, idPalco, tick);
    ctx.restore();
  }

  // chao
  chao(ctx, P, off(1));

  // camada 2 - moldura da frente
  ctx.save();
  ctx.translate(off(1.25), 0);
  frente(ctx, P, idPalco, tick);
  ctx.restore();

  // nevoa / clima
  ctx.fillStyle = P.nevoa;
  ctx.fillRect(0, CHAO - 210, LARGURA, 250);
  clima(ctx, idPalco, tick);
}

function astro(ctx, P, id, tick) {
  const noite = ['largo', 'opera', 'pedreira', 'tubo'].includes(id);
  const cor = noite ? '#e8eef7' : P.luz;
  const ax = id === 'botanico' ? 980 : id === 'niemeyer' ? 300 : 820;
  const r = noite ? 30 : 48;
  // halo em degrade: alpha chapado virava um disco cinza sobre o ceu escuro
  const halo = ctx.createRadialGradient(ax, 150, r * 0.9, ax, 150, r * 3.4);
  halo.addColorStop(0, noite ? 'rgba(232,238,247,0.22)' : 'rgba(255,240,200,0.30)');
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(ax, 150, r * 3.4, 0, TAU); ctx.fill();
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = cor;
  ctx.beginPath(); ctx.arc(ax, 150, r, 0, TAU); ctx.fill();
  ctx.globalAlpha = 1;

  if (noite) {
    const r = rnd(id.length * 977 + 13);
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    for (let i = 0; i < 70; i++) {
      const x = r() * (LARGURA + 400) - 200, y = r() * 330;
      const tw = 0.4 + Math.abs(Math.sin(tick * 0.02 + i)) * 0.6;
      ctx.globalAlpha = tw * 0.7;
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.globalAlpha = 1;
  }
}

function silhueta(ctx, P, id, tick) {
  ctx.fillStyle = P.fundo;
  const base = CHAO - 20;

  // colinas / mata distante comum
  ctx.beginPath();
  ctx.moveTo(-200, base);
  for (let x = -200; x <= LARGURA + 200; x += 40)
    ctx.lineTo(x, base - 90 - Math.sin(x * 0.006) * 34 - Math.sin(x * 0.017) * 18);
  ctx.lineTo(LARGURA + 200, base); ctx.closePath(); ctx.fill();

  ctx.fillStyle = P.meio;
  switch (id) {
    case 'estufa': break;
    case 'botanico': {          // estufa vitoriana no terco direito
      const bx = 880, by = base;
      ctx.beginPath();
      ctx.moveTo(bx - 190, by);
      ctx.lineTo(bx - 190, by - 130);
      ctx.quadraticCurveTo(bx - 95, by - 250, bx, by - 130);
      ctx.lineTo(bx, by); ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(bx - 20, by); ctx.lineTo(bx - 20, by - 160);
      ctx.quadraticCurveTo(bx + 70, by - 300, bx + 160, by - 160);
      ctx.lineTo(bx + 160, by); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 2;
      for (let i = -180; i < 160; i += 26) {
        ctx.beginPath(); ctx.moveTo(bx + i, by); ctx.lineTo(bx + i, by - 150); ctx.stroke();
      }
      break;
    }
    case 'igreja': case 'largo': {
      const bx = 240;
      ctx.fillRect(bx - 130, base - 190, 210, 190);
      ctx.fillRect(bx + 20, base - 290, 62, 290);
      ctx.beginPath();
      ctx.moveTo(bx + 14, base - 290); ctx.lineTo(bx + 51, base - 350); ctx.lineTo(bx + 88, base - 290);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = P.luz; ctx.globalAlpha = 0.5;
      ctx.fillRect(bx - 96, base - 150, 26, 44); ctx.fillRect(bx - 40, base - 150, 26, 44);
      ctx.globalAlpha = 1;
      // casario
      ctx.fillStyle = P.meio;
      for (let i = 0; i < 5; i++) ctx.fillRect(560 + i * 140, base - 120 - (i % 2) * 34, 126, 160);
      break;
    }
    case 'lago': case 'barigui': {
      ctx.beginPath(); ctx.ellipse(700, base - 30, 460, 44, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = P.frente;
      for (let i = 0; i < 9; i++) {
        const x = 90 + i * 140, h = 120 + (i % 3) * 40;
        ctx.fillRect(x - 5, base - h, 10, h);
        ctx.beginPath(); ctx.ellipse(x, base - h - 10, 44, 26, 0, 0, TAU); ctx.fill();
      }
      break;
    }
    case 'tubo': {
      const bx = 620;
      ctx.fillStyle = P.meio;
      ctx.beginPath();
      ctx.moveTo(bx - 330, base); ctx.lineTo(bx - 330, base - 150);
      ctx.quadraticCurveTo(bx, base - 330, bx + 330, base - 150);
      ctx.lineTo(bx + 330, base); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 3;
      for (let i = -300; i <= 300; i += 60) {
        ctx.beginPath(); ctx.moveTo(bx + i, base); ctx.lineTo(bx + i, base - 150 - Math.cos(i / 330 * 1.5) * 80); ctx.stroke();
      }
      ctx.fillStyle = P.luz; ctx.globalAlpha = 0.6;
      ctx.fillRect(bx - 330, base - 168, 660, 10);
      ctx.globalAlpha = 1;
      break;
    }
    case 'torre': {          // torre panoramica: fuste + anel de observacao
      // cidade baixa primeiro, para a torre se destacar contra ela
      for (let i = 0; i < 10; i++) {
        const x = 40 + i * 132, h = 70 + ((i * 37) % 5) * 26;
        ctx.fillRect(x, base - h, 108, h + 20);
      }
      ctx.fillStyle = P.luz; ctx.globalAlpha = 0.55;
      for (let i = 0; i < 10; i++) {
        const x = 40 + i * 132, h = 70 + ((i * 37) % 5) * 26;
        for (let j = 14; j < h - 8; j += 22)
          for (let k = 12; k < 96; k += 26)
            if ((i + j + k) % 3) ctx.fillRect(x + k, base - h + j, 9, 11);
      }
      ctx.globalAlpha = 1;

      const bx = 980;
      ctx.fillStyle = P.frente;
      ctx.fillRect(bx - 26, base - 430, 52, 430);            // fuste
      ctx.fillRect(bx - 74, base - 396, 148, 40);            // anel de observacao
      ctx.beginPath();                                        // antena
      ctx.moveTo(bx - 5, base - 430); ctx.lineTo(bx, base - 492);
      ctx.lineTo(bx + 5, base - 430); ctx.closePath(); ctx.fill();
      ctx.fillStyle = P.luz; ctx.globalAlpha = 0.75;
      for (let i = -60; i < 66; i += 21) ctx.fillRect(bx + i, base - 388, 13, 22);
      ctx.globalAlpha = 1;
      // luz de topo piscando: a unica coisa viva no quadro
      ctx.fillStyle = '#ff5544';
      ctx.globalAlpha = 0.45 + Math.sin(tick * 0.06) * 0.4;
      ctx.beginPath(); ctx.arc(bx, base - 494, 5, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      break;
    }
    case 'torii': case 'japao': {
      const bx = 930;
      ctx.fillStyle = '#8c2f3d';
      ctx.fillRect(bx - 110, base - 210, 20, 210);
      ctx.fillRect(bx + 90, base - 210, 20, 210);
      ctx.fillRect(bx - 150, base - 230, 300, 20);
      ctx.fillRect(bx - 125, base - 190, 250, 14);
      ctx.fillStyle = P.meio;
      for (let i = 0; i < 6; i++) {
        const x = 70 + i * 150;
        ctx.fillRect(x - 6, base - 90, 12, 90);
        ctx.beginPath(); ctx.ellipse(x, base - 108, 56, 34, 0, 0, TAU); ctx.fill();
      }
      break;
    }
    case 'opera': {
      const bx = 640, by = base - 40;
      ctx.strokeStyle = P.meio; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.arc(bx, by + 60, 300, Math.PI, TAU); ctx.stroke();
      ctx.lineWidth = 3;
      for (let i = 0; i <= 14; i++) {
        const a = Math.PI + (i / 14) * Math.PI;
        ctx.beginPath(); ctx.moveTo(bx, by + 60);
        ctx.lineTo(bx + Math.cos(a) * 300, by + 60 + Math.sin(a) * 300); ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(bx, by + 60, 190, Math.PI, TAU); ctx.stroke();
      // plateia
      ctx.fillStyle = '#05100b';
      ctx.fillRect(0, base - 90, LARGURA, 90);
      for (let i = 0; i < 44; i++) {
        const x = 20 + i * 30 + Math.sin(i) * 6;
        ctx.beginPath(); ctx.arc(x, base - 92 + Math.sin(tick * 0.04 + i) * 2, 11, 0, TAU); ctx.fill();
      }
      // holofotes
      ctx.fillStyle = P.luz; ctx.globalAlpha = 0.12;
      for (const sx of [330, 640, 950]) {
        ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx - 130, CHAO); ctx.lineTo(sx + 130, CHAO); ctx.closePath(); ctx.fill();
      }
      ctx.globalAlpha = 1;
      break;
    }
    case 'olho': case 'niemeyer': {
      const bx = 820;
      ctx.fillStyle = '#d9d4cc';
      ctx.fillRect(bx - 34, base - 190, 68, 190);
      ctx.fillStyle = '#e8e4dd';
      ctx.beginPath(); ctx.ellipse(bx, base - 268, 210, 110, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#2b3350';
      ctx.beginPath(); ctx.ellipse(bx, base - 268, 150, 72, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = P.luz;
      ctx.beginPath(); ctx.ellipse(bx + 20, base - 272, 52, 34, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#c8c3ba';
      ctx.fillRect(60, base - 100, 420, 100);
      break;
    }
    case 'pedreira': {
      ctx.fillStyle = P.meio;
      ctx.beginPath();
      ctx.moveTo(-100, base);
      ctx.lineTo(-100, 40); ctx.lineTo(120, 10); ctx.lineTo(210, 150);
      ctx.lineTo(260, 90); ctx.lineTo(330, base); ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(LARGURA + 100, base);
      ctx.lineTo(LARGURA + 100, 20); ctx.lineTo(1120, 0); ctx.lineTo(1020, 170);
      ctx.lineTo(970, 100); ctx.lineTo(900, base); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,74,50,0.22)'; ctx.lineWidth = 2;
      for (let i = 0; i < 14; i++) {
        ctx.beginPath();
        ctx.moveTo(40 + i * 12, 60 + i * 30); ctx.lineTo(180 + i * 8, 90 + i * 32); ctx.stroke();
      }
      ctx.fillStyle = '#1a0d0c';
      ctx.beginPath(); ctx.ellipse(640, base - 30, 300, 80, 0, Math.PI, TAU); ctx.fill();
      break;
    }
  }
}

function chao(ctx, P, offX) {
  ctx.fillStyle = P.chao;
  ctx.fillRect(0, CHAO, LARGURA, ALTURA - CHAO);
  ctx.strokeStyle = P.chaoLinha;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.5;
  for (let i = -40; i < 60; i++) {
    const x = (i * 90 + offX % 90);
    ctx.beginPath(); ctx.moveTo(x, CHAO); ctx.lineTo(x - 60, ALTURA); ctx.stroke();
  }
  for (let y = CHAO + 14; y < ALTURA; y += 26) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(LARGURA, y); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const gs = ctx.createLinearGradient(0, CHAO, 0, CHAO + 60);
  gs.addColorStop(0, 'rgba(0,0,0,0.38)'); gs.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gs;
  ctx.fillRect(0, CHAO, LARGURA, 60);
}

function frente(ctx, P, id, tick) {
  ctx.fillStyle = P.frente;
  if (id === 'botanico' || id === 'barigui' || id === 'opera') {
    // galho fino descendo de cada borda superior, so como moldura
    ctx.strokeStyle = P.frente;
    ctx.lineCap = 'round';
    for (const [bx, sgn] of [[-10, 1], [LARGURA + 10, -1]]) {
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.moveTo(bx, -10);
      ctx.quadraticCurveTo(bx + sgn * 150, 30, bx + sgn * 260, 110);
      ctx.stroke();
      ctx.lineWidth = 7;
      for (let i = 1; i <= 3; i++) {
        const gx = bx + sgn * (60 * i), gy = 16 * i + 6;
        ctx.beginPath();
        ctx.moveTo(gx, gy);
        ctx.quadraticCurveTo(gx + sgn * 30, gy + 46, gx + sgn * 14, gy + 92);
        ctx.stroke();
      }
    }
  } else if (id === 'largo' || id === 'japao') {
    // postes
    for (const x of [90, LARGURA - 110]) {
      ctx.fillRect(x, CHAO - 250, 12, 250);
      ctx.beginPath(); ctx.arc(x + 6, CHAO - 258, 16, 0, TAU); ctx.fill();
      ctx.fillStyle = P.luz; ctx.globalAlpha = 0.28;
      ctx.beginPath(); ctx.arc(x + 6, CHAO - 258, 52, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1; ctx.fillStyle = P.frente;
    }
  } else if (id === 'tubo') {
    ctx.fillRect(0, 0, 46, ALTURA); ctx.fillRect(LARGURA - 46, 0, 46, ALTURA);
  } else if (id === 'pedreira') {
    ctx.beginPath(); ctx.moveTo(0, ALTURA); ctx.lineTo(0, 260); ctx.lineTo(120, 420); ctx.lineTo(130, ALTURA); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(LARGURA, ALTURA); ctx.lineTo(LARGURA, 240); ctx.lineTo(LARGURA - 130, 430); ctx.lineTo(LARGURA - 140, ALTURA); ctx.closePath(); ctx.fill();
  }
}

function clima(ctx, id, tick) {
  if (id === 'largo' || id === 'pedreira') {          // chuva
    ctx.strokeStyle = id === 'pedreira' ? 'rgba(255,160,140,0.32)' : 'rgba(200,215,255,0.28)';
    ctx.lineWidth = 1.4;
    const r = rnd(7);
    for (let i = 0; i < 110; i++) {
      const x = (r() * LARGURA + tick * 3.5) % LARGURA;
      const y = (r() * ALTURA + tick * 16) % ALTURA;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 5, y + 18); ctx.stroke();
    }
  } else if (id === 'japao') {                         // petalas
    const r = rnd(31);
    for (let i = 0; i < 46; i++) {
      const bx = r() * LARGURA, by = r() * ALTURA;
      const x = (bx + Math.sin(tick * 0.02 + i) * 40) % LARGURA;
      const y = (by + tick * 0.8) % ALTURA;
      ctx.fillStyle = 'rgba(255,205,225,0.75)';
      ctx.beginPath(); ctx.ellipse(x, y, 5, 3, tick * 0.03 + i, 0, TAU); ctx.fill();
    }
  } else if (id === 'botanico' || id === 'barigui') {  // poeira de luz
    const r = rnd(53);
    ctx.fillStyle = 'rgba(255,255,230,0.5)';
    for (let i = 0; i < 40; i++) {
      const x = (r() * LARGURA + Math.sin(tick * 0.01 + i) * 30) % LARGURA;
      const y = (r() * ALTURA - tick * 0.3 + ALTURA * 10) % ALTURA;
      ctx.fillRect(x, y, 2.5, 2.5);
    }
  }
}

// ============================================================================
//  PROJETEIS / ARMADILHAS / EFEITOS
// ============================================================================
export function desenharProjetil(ctx, p, tick) {
  ctx.save();
  const r = p.raio;
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = p.cor;
  ctx.beginPath(); ctx.ellipse(p.x - p.dir * r, p.y, r * 1.8, r * 0.7, 0, 0, TAU); ctx.fill();
  ctx.globalAlpha = 1;
  const g = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, r);
  g.addColorStop(0, '#fff'); g.addColorStop(0.5, p.cor); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(p.x, p.y, r * (p.rasteiro ? 1.3 : 1), 0, TAU); ctx.fill();
  if (p.rasteiro) {
    ctx.strokeStyle = p.cor; ctx.lineWidth = 3; ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.moveTo(p.x, CHAO); ctx.lineTo(p.x, CHAO - r * 2.2); ctx.stroke();
  }
  ctx.restore();
}

export function desenharArmadilha(ctx, a, tick) {
  ctx.save();
  const pulso = 0.6 + Math.sin(tick * 0.14) * 0.3;
  ctx.globalAlpha = a.armada > 0 ? 0.35 : pulso;
  ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(a.x, CHAO - 4, a.raio, a.raio * 0.34, 0, 0, TAU); ctx.stroke();
  ctx.fillStyle = 'rgba(224,99,42,0.35)';
  ctx.beginPath(); ctx.ellipse(a.x, CHAO - 4, a.raio * 0.7, a.raio * 0.24, 0, 0, TAU); ctx.fill();
  ctx.restore();
}

export function desenharEfeito(ctx, e) {
  const k = e.t / e.vida;
  ctx.save();
  ctx.globalAlpha = 1 - k;
  const s = e.escala || 1;
  if (e.tipo === 'acerto') {
    ctx.translate(e.x, e.y); ctx.rotate(e.ang);
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU, d = (10 + k * 46) * s;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * d, Math.sin(a) * d, 12 * s * (1 - k), 3.4 * s * (1 - k), a, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.arc(0, 0, 26 * s * (1 - k), 0, TAU); ctx.fill();
  } else if (e.tipo === 'bloqueio') {
    ctx.strokeStyle = '#8fd3ff'; ctx.lineWidth = 4 * (1 - k);
    ctx.beginPath(); ctx.arc(e.x, e.y, 16 + k * 30, -0.9, 0.9); ctx.stroke();
  } else if (e.tipo === 'armadura') {
    ctx.strokeStyle = '#c9a227'; ctx.lineWidth = 5 * (1 - k);
    ctx.beginPath(); ctx.arc(e.x, e.y, 24 + k * 44, 0, TAU); ctx.stroke();
  } else if (e.tipo === 'parry') {
    ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 6 * (1 - k);
    ctx.beginPath(); ctx.arc(e.x, e.y, 18 + k * 66, 0, TAU); ctx.stroke();
    ctx.globalAlpha = (1 - k) * 0.4; ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(e.x, e.y, 18 + k * 30, 0, TAU); ctx.fill();
  } else if (e.tipo === 'buff') {
    ctx.strokeStyle = '#5d8fc4'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(e.x, e.y, 30 * (1 - k) + 12, 62 * (1 - k) + 18, 0, 0, TAU); ctx.stroke();
  }
  ctx.restore();
}
