// ============================================================================
//  CURITIBA KOMBAT - HUD no canvas + telas em DOM
// ============================================================================

import { LARGURA, ALTURA, LUTADORES, MAPA, JOGAVEIS, PALCOS, FPS } from './data.js';
import * as Sprites from './sprites.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// ============================================================================
//  HUD
// ============================================================================
export function desenharHUD(ctx, m, tick) {
  const p1 = m.p1, p2 = m.p2;
  barra(ctx, 34, 34, 470, p1, false, '#3ad07a');
  barra(ctx, LARGURA - 34 - 470, 34, 470, p2, true, p2.def.chefao ? '#c9a227' : '#e8563f');

  // relogio
  const seg = Math.ceil(m.tempo / FPS);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(8,10,14,0.72)';
  ctx.fillRect(LARGURA / 2 - 62, 22, 124, 66);
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2;
  ctx.strokeRect(LARGURA / 2 - 62, 22, 124, 66);
  ctx.fillStyle = seg <= 10 ? '#ff4a32' : '#f5eee0';
  ctx.font = '800 44px Impact, "Arial Black", sans-serif';
  ctx.fillText(String(seg).padStart(2, '0'), LARGURA / 2, 70);
  ctx.restore();

  // rounds ganhos
  pips(ctx, LARGURA / 2 - 92, 100, m.placar[0], true);
  pips(ctx, LARGURA / 2 + 92, 100, m.placar[1], false);

  // textos grandes
  ctx.save();
  ctx.textAlign = 'center';
  for (const t of m.textos) {
    const k = t.t / t.vida;
    ctx.globalAlpha = k < 0.12 ? k / 0.12 : k > 0.8 ? (1 - k) / 0.2 : 1;
    const esc = t.pequeno ? 1 : 1 + (1 - Math.min(1, t.t / 8)) * 0.6;
    ctx.save();
    ctx.translate(LARGURA / 2, t.pequeno ? 210 : 300);
    ctx.scale(esc, esc);
    ctx.font = t.pequeno ? '800 42px Impact, "Arial Black", sans-serif' : '800 84px Impact, "Arial Black", sans-serif';
    ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(t.txt, 0, 0);
    ctx.fillStyle = t.cor;
    ctx.fillText(t.txt, 0, 0);
    ctx.restore();
  }
  ctx.restore();

  // intro
  if (m.fase === 'intro') {
    const k = m.faseT / 100;
    ctx.save();
    ctx.globalAlpha = k < 0.7 ? 1 : (1 - k) / 0.3;
    ctx.textAlign = 'center';
    ctx.font = '800 64px Impact, "Arial Black", sans-serif';
    ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    const txt = `${p1.def.nome}   VS   ${p2.def.nome}`;
    ctx.strokeText(txt, LARGURA / 2, 300);
    ctx.fillStyle = '#f5eee0';
    ctx.fillText(txt, LARGURA / 2, 300);
    ctx.font = '700 26px system-ui, sans-serif';
    ctx.fillStyle = '#ffd23f';
    ctx.fillText(`ROUND ${m.round}  -  ${PALCOS[m.palco].nome}`, LARGURA / 2, 342);
    ctx.restore();
  }

  // cooldowns / habilidades do jogador
  atalhos(ctx, p1);
}

function barra(ctx, x, y, w, f, espelho, cor) {
  const pct = clamp(f.vida / f.vidaMax, 0, 1);
  const sta = clamp(f.stamina / f.staminaMax, 0, 1);
  const sup = clamp(f.super / f.superMax, 0, 1);

  ctx.save();
  // moldura
  ctx.fillStyle = 'rgba(8,10,14,0.72)';
  ctx.fillRect(x - 4, y - 4, w + 8, 60);
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2;
  ctx.strokeRect(x - 4, y - 4, w + 8, 60);

  // vida
  ctx.fillStyle = '#2a1416';
  ctx.fillRect(x, y, w, 22);
  const fw = w * pct;
  const fx = espelho ? x + w - fw : x;
  const g = ctx.createLinearGradient(0, y, 0, y + 22);
  g.addColorStop(0, cor); g.addColorStop(1, sombra(cor));
  ctx.fillStyle = pct < 0.25 ? (Math.floor(Date.now() / 120) % 2 ? '#ff4a32' : cor) : g;
  ctx.fillRect(fx, y, fw, 22);

  // stamina
  ctx.fillStyle = '#1b1f26';
  ctx.fillRect(x, y + 26, w, 8);
  const sw = w * sta;
  ctx.fillStyle = f.exausto > 0 ? '#ff4a32' : sta < 0.25 ? '#ffa23f' : '#8fd3ff';
  ctx.fillRect(espelho ? x + w - sw : x, y + 26, sw, 8);

  // super (4 segmentos)
  ctx.fillStyle = '#1b1f26';
  ctx.fillRect(x, y + 38, w, 10);
  const uw = w * sup;
  if (sup >= 1) {
    ctx.fillStyle = Math.floor(Date.now() / 100) % 2 ? '#ffd23f' : '#fff3b0';
  } else ctx.fillStyle = '#7a6bd6';
  ctx.fillRect(espelho ? x + w - uw : x, y + 38, uw, 10);
  ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2;
  for (let i = 1; i < 4; i++) {
    const sx = x + (w / 4) * i;
    ctx.beginPath(); ctx.moveTo(sx, y + 38); ctx.lineTo(sx, y + 48); ctx.stroke();
  }

  // nome
  ctx.textAlign = espelho ? 'right' : 'left';
  ctx.font = '800 22px Impact, "Arial Black", sans-serif';
  ctx.fillStyle = '#f5eee0';
  ctx.fillText(f.def.nome + (f.fase2 ? '  [FASE 2]' : ''), espelho ? x + w : x, y + 72);
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(245,238,224,0.55)';
  ctx.fillText(f.def.titulo, espelho ? x + w : x, y + 90);
  ctx.restore();
}

function pips(ctx, x, y, n, esq) {
  ctx.save();
  for (let i = 0; i < 2; i++) {
    const px = esq ? x - i * 26 : x + i * 26;
    ctx.beginPath(); ctx.arc(px, y, 9, 0, Math.PI * 2);
    ctx.fillStyle = i < n ? '#ffd23f' : 'rgba(255,255,255,0.16)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2; ctx.stroke();
  }
  ctx.restore();
}

function atalhos(ctx, f) {
  const itens = [
    { k: 'J', id: 'soco' }, { k: 'K', id: 'chute' },
    { k: 'L', id: 'habilidade' }, { k: 'ESP', id: 'especial' },
  ];
  ctx.save();
  ctx.font = '700 12px system-ui, sans-serif';
  let x = 34;
  const y = ALTURA - 42;
  for (const it of itens) {
    const g = f.def.golpes[it.id];
    const cd = f.cooldowns[it.id] || 0;
    const bloq = it.id === 'especial' ? f.super < 100 : cd > 0;
    ctx.fillStyle = bloq ? 'rgba(10,12,16,0.6)' : 'rgba(10,12,16,0.85)';
    ctx.fillRect(x, y, 132, 30);
    ctx.strokeStyle = bloq ? 'rgba(255,255,255,0.12)' : '#ffd23f';
    ctx.lineWidth = 1.6;
    ctx.strokeRect(x, y, 132, 30);
    ctx.fillStyle = bloq ? 'rgba(245,238,224,0.35)' : '#f5eee0';
    ctx.textAlign = 'left';
    ctx.fillText(it.k, x + 8, y + 19);
    ctx.fillStyle = bloq ? 'rgba(245,238,224,0.3)' : '#ffd23f';
    ctx.textAlign = 'right';
    const rot = cd > 0 ? Math.ceil(cd / FPS) + 's'
      : g.nome.length > 13 ? g.nome.slice(0, 12) + '.' : g.nome;
    ctx.fillText(rot, x + 124, y + 19);
    x += 140;
  }
  ctx.restore();
}

function sombra(hex) {
  if (hex[0] !== '#') return hex;
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) * 0.55 | 0, g = ((n >> 8) & 255) * 0.55 | 0, b = (n & 255) * 0.55 | 0;
  return `rgb(${r},${g},${b})`;
}

// ============================================================================
//  RETRATO (usado nos cards do DOM) - mini rig estatico
// ============================================================================
export function retrato(id, w = 150, h = 190) {
  const d = LUTADORES[id];
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d');
  const s = (h / 200) * (d.chefao ? 0.72 : 0.92);
  const cor = d.cor, bulk = d.fisico.bulk;

  // fundo claro o bastante para roupa preta (JOAO, VINICIUS) continuar legivel
  const gr = c.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, '#3b4150'); gr.addColorStop(0.65, '#262b36'); gr.addColorStop(1, '#161a22');
  c.fillStyle = gr; c.fillRect(0, 0, w, h);
  c.fillStyle = 'rgba(255,255,255,0.05)';
  c.beginPath(); c.ellipse(w / 2, h * 0.92, w * 0.42, h * 0.10, 0, 0, Math.PI * 2); c.fill();

  // Quem tem arte aparece com a arte. O rig abaixo so desenha para quem ainda
  // nao tem - hoje so o chefao. Antes a selecao mostrava o boneco procedural
  // mesmo para personagem com sprite pronto: voce escolhia uma coisa e entrava
  // na luta com outra.
  if (Sprites.desenharEm(c, id, w, h)) return cv.toDataURL();

  c.save();
  c.translate(w / 2, h * 0.94);
  const W = (n) => n * s * bulk;
  // pernas
  c.fillStyle = sombraCor(cor.roupa);
  c.fillRect(-W(13), -62 * s, W(11), 62 * s);
  c.fillRect(W(2), -62 * s, W(11), 62 * s);
  // torso
  c.fillStyle = cor.roupa;
  c.beginPath();
  c.moveTo(-W(13), -58 * s); c.lineTo(-W(17), -104 * s);
  c.lineTo(W(17), -104 * s); c.lineTo(W(13), -58 * s);
  c.closePath(); c.fill();
  c.fillStyle = cor.detalhe;
  c.fillRect(-W(5), -104 * s, W(10), 46 * s);
  // bracos
  c.fillStyle = cor.roupa;
  c.fillRect(-W(25), -102 * s, W(9), 48 * s);
  c.fillRect(W(16), -102 * s, W(9), 48 * s);
  c.fillStyle = cor.pele;
  c.beginPath(); c.arc(-W(20), -50 * s, W(6), 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(W(20), -50 * s, W(6), 0, Math.PI * 2); c.fill();
  // cabeca
  const hx = 0, hy = -124 * s, r = 15 * s;
  c.fillStyle = sombraCor(cor.pele);
  c.fillRect(-4 * s, hy + r * 0.5, 8 * s, 8 * s);
  c.fillStyle = cor.pele;
  c.beginPath(); c.ellipse(hx, hy, r * 0.86, r, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#20160f';
  c.beginPath(); c.arc(hx - r * 0.3, hy - r * 0.1, r * 0.11, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(hx + r * 0.3, hy - r * 0.1, r * 0.11, 0, Math.PI * 2); c.fill();
  // topo
  c.fillStyle = d.cabeca.cor;
  const t = d.cabeca.tipo;
  if (t === 'gorro') { c.beginPath(); c.arc(hx, hy - r * 0.2, r * 0.98, Math.PI, Math.PI * 2); c.fill(); c.fillRect(hx - r, hy - r * 0.34, r * 2, r * 0.4); }
  else if (t === 'capacete') { c.beginPath(); c.ellipse(hx, hy - r * 0.18, r * 1.05, r * 0.92, 0, Math.PI, Math.PI * 2); c.fill(); }
  else if (t === 'bucket') { c.beginPath(); c.ellipse(hx, hy - r * 0.3, r * 0.92, r * 0.62, 0, Math.PI, Math.PI * 2); c.fill(); c.beginPath(); c.ellipse(hx, hy - r * 0.28, r * 1.5, r * 0.22, 0, 0, Math.PI * 2); c.fill(); }
  else if (t === 'careca') { /* nada */ }
  else if (t === 'oculos') { c.beginPath(); c.ellipse(hx, hy - r * 0.5, r * 0.9, r * 0.5, 0, Math.PI, Math.PI * 2); c.fill(); c.strokeStyle = '#1c1c22'; c.lineWidth = 2 * s; c.beginPath(); c.ellipse(hx - r * 0.3, hy - r * 0.1, r * 0.26, r * 0.22, 0, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.ellipse(hx + r * 0.3, hy - r * 0.1, r * 0.26, r * 0.22, 0, 0, Math.PI * 2); c.stroke(); }
  else if (t === 'copa') {
    for (let i = 0; i < 9; i++) {
      const a = Math.PI + (i / 8) * Math.PI;
      c.beginPath(); c.moveTo(hx, hy - r * 0.2);
      c.lineTo(hx + Math.cos(a) * r * 2.6, hy + Math.sin(a) * r * 1.7 - r * 0.4);
      c.lineTo(hx + Math.cos(a) * r * 2.2, hy + Math.sin(a) * r * 1.2);
      c.closePath(); c.fill();
    }
  } else { c.beginPath(); c.ellipse(hx, hy - r * 0.3, r * 0.94, r * 0.8, 0, Math.PI, Math.PI * 2); c.fill(); }
  c.restore();
  return cv.toDataURL();
}

function sombraCor(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) * 0.72 | 0, g = ((n >> 8) & 255) * 0.72 | 0, b = (n & 255) * 0.72 | 0;
  return `rgb(${r},${g},${b})`;
}

// ============================================================================
//  TELAS EM DOM
// ============================================================================
export function montarSelecao(el, onEscolher) {
  el.innerHTML = '';
  for (const id of JOGAVEIS) {
    const d = LUTADORES[id];
    const card = document.createElement('button');
    card.className = 'card';
    card.innerHTML = `
      <img src="${retrato(id)}" alt="${d.nome}">
      <div class="card-nome">${d.nome}</div>
      <div class="card-titulo">${d.titulo}</div>
      <div class="card-arq">${d.arquetipo}</div>
      <div class="card-stats">
        ${stat('VIDA', d.stats.vida / 150)}
        ${stat('VELOC', d.stats.velocidade / 4.5)}
        ${stat('DANO', d.golpes.chute.dano / 25)}
      </div>
      <div class="card-bio">${d.bio}</div>
      <div class="card-golpes">
        <b>${d.golpes.habilidade.nome}</b> · <b>${d.golpes.especial.nome}</b>
      </div>`;
    card.onclick = () => onEscolher(id);
    el.appendChild(card);
  }
}

function stat(nome, v) {
  const n = Math.round(clamp(v, 0.08, 1) * 10);
  return `<div class="stat"><span>${nome}</span><i>${'<b></b>'.repeat(n)}${'<u></u>'.repeat(10 - n)}</i></div>`;
}

export function montarMapa(el, progresso, onEscolher) {
  el.innerHTML = '';
  // linhas de ligacao
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'mapa-linhas');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  for (let i = 0; i < MAPA.length - 1; i++) {
    const a = MAPA[i], b = MAPA[i + 1];
    const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    l.setAttribute('x1', a.x); l.setAttribute('y1', a.y);
    l.setAttribute('x2', b.x); l.setAttribute('y2', b.y);
    l.setAttribute('class', progresso > i ? 'feito' : 'pendente');
    svg.appendChild(l);
  }
  el.appendChild(svg);

  MAPA.forEach((n, i) => {
    const d = LUTADORES[n.lutador];
    const liberado = i <= progresso;
    const vencido = i < progresso;
    const b = document.createElement('button');
    b.className = 'no' + (liberado ? '' : ' travado') + (vencido ? ' vencido' : '') + (n.chefao ? ' chefao' : '') + (i === progresso ? ' atual' : '');
    b.style.left = n.x + '%';
    b.style.top = n.y + '%';
    b.disabled = !liberado;
    b.innerHTML = `
      <span class="no-pino"></span>
      <span class="no-cara"><img src="${retrato(n.lutador, 76, 92)}" alt=""></span>
      <span class="no-info">
        <b>${n.nome}</b>
        <i>${vencido ? 'VENCIDO' : liberado ? d.nome : 'BLOQUEADO'}</i>
      </span>`;
    b.title = `${d.nome} — ${d.titulo}\n${n.desc}`;
    b.onclick = () => liberado && onEscolher(i);
    el.appendChild(b);
  });
}

export function montarBriefing(el, indice, idJogador) {
  const n = MAPA[indice];
  const d = LUTADORES[n.lutador];
  const j = LUTADORES[idJogador];
  const P = PALCOS[n.palco];
  el.innerHTML = `
    <div class="brief-lado">
      <img src="${retrato(idJogador, 190, 240)}" alt="">
      <h3>${j.nome}</h3><p>${j.titulo}</p>
    </div>
    <div class="brief-meio">
      <div class="brief-vs">VS</div>
      <h2>${n.nome}</h2>
      <p class="brief-hora">${P.hora}</p>
      <p class="brief-desc">${n.desc}</p>
      <div class="brief-golpes">
        <div><span>HABILIDADE</span><b>${d.golpes.habilidade.nome}</b></div>
        <div><span>ESPECIAL</span><b>${d.golpes.especial.nome}</b></div>
      </div>
      <p class="brief-dica">DICA: ${d.dica}</p>
      <button class="btn grande" id="btn-lutar">LUTAR</button>
    </div>
    <div class="brief-lado ${n.chefao ? 'chefao' : ''}">
      <img src="${retrato(n.lutador, 190, 240)}" alt="">
      <h3>${d.nome}</h3><p>${d.titulo}</p>
      ${n.chefao ? '<p class="tag-chefao">CHEFÃO</p>' : ''}
    </div>`;
}
