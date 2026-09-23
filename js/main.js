// ============================================================================
//  CURITIBA KOMBAT - cola: loop, input, telas, progresso
// ============================================================================

import { LARGURA, ALTURA, CHAO, ARENA, FPS, MAPA, LUTADORES, PALCOS, dificuldadeDoNo } from './data.js';
import { Mundo, vazio } from './engine.js';
import { desenharLutador, desenharPalco, desenharProjetil, desenharArmadilha, desenharEfeito, carregarPlaca } from './render.js';
import { desenharHUD, montarSelecao, montarMapa, montarBriefing, retrato } from './ui.js';
import * as Sprites from './sprites.js';

const $ = (s) => document.querySelector(s);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const SAVE = 'curitiba-kombat-v1';

const cv = $('#jogo');
const ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = true;

// ---------------------------------------------------------------- estado ---
const S = {
  tela: 'titulo',
  personagem: null,
  progresso: 0,
  no: 0,
  mundo: null,
  placar: [0, 0],
  round: 1,
  tick: 0,
  som: true,
};

function salvar() {
  try { localStorage.setItem(SAVE, JSON.stringify({ p: S.personagem, g: S.progresso })); } catch (e) {}
}
function carregar() {
  try {
    const d = JSON.parse(localStorage.getItem(SAVE) || '{}');
    if (d.p && LUTADORES[d.p]) { S.personagem = d.p; S.progresso = clamp(d.g | 0, 0, MAPA.length); }
  } catch (e) {}
}

// ------------------------------------------------------------------ audio --
let AC = null;
function ac() { if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); return AC; }
const SONS = {
  leve:     { f: 520, t: 0.05, tipo: 'square', v: 0.05 },
  pesado:   { f: 200, t: 0.10, tipo: 'square', v: 0.09 },
  acerto:   { f: 150, t: 0.09, tipo: 'sawtooth', v: 0.10, ruido: true },
  bloqueio: { f: 900, t: 0.05, tipo: 'triangle', v: 0.06 },
  super:    { f: 90,  t: 0.34, tipo: 'sawtooth', v: 0.13, ruido: true },
  ko:       { f: 70,  t: 0.55, tipo: 'sawtooth', v: 0.15, ruido: true },
  pulo:     { f: 380, t: 0.06, tipo: 'sine', v: 0.04 },
  projetil: { f: 700, t: 0.12, tipo: 'sine', v: 0.06 },
  dash:     { f: 300, t: 0.08, tipo: 'triangle', v: 0.05 },
  buff:     { f: 420, t: 0.20, tipo: 'sine', v: 0.07 },
  ui:       { f: 640, t: 0.04, tipo: 'square', v: 0.05 },
};
function tocar(nome) {
  if (!S.som) return;
  const d = SONS[nome]; if (!d) return;
  try {
    const a = ac();
    if (a.state === 'suspended') a.resume();
    const o = a.createOscillator(), g = a.createGain();
    o.type = d.tipo;
    o.frequency.setValueAtTime(d.f, a.currentTime);
    o.frequency.exponentialRampToValueAtTime(Math.max(40, d.f * (d.ruido ? 0.3 : 0.7)), a.currentTime + d.t);
    g.gain.setValueAtTime(d.v, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + d.t);
    o.connect(g); g.connect(a.destination);
    o.start(); o.stop(a.currentTime + d.t + 0.02);
  } catch (e) {}
}

// ------------------------------------------------------------------ input --
const teclas = {};
const MAPA_TECLAS = {
  ArrowLeft: 'esq', KeyA: 'esq',
  ArrowRight: 'dir', KeyD: 'dir',
  ArrowUp: 'cima', KeyW: 'cima',
  ArrowDown: 'baixo', KeyS: 'baixo',
  ShiftLeft: 'bloq', ShiftRight: 'bloq',
};
const ACOES = { KeyJ: 'soco', KeyK: 'chute', KeyL: 'habilidade', Space: 'especial' };

addEventListener('keydown', (e) => {
  if (MAPA_TECLAS[e.code] || ACOES[e.code] || e.code === 'Space') e.preventDefault();
  if (teclas[e.code]) return;
  teclas[e.code] = true;

  if (S.tela === 'luta' && S.mundo && S.mundo.fase === 'luta') {
    const a = ACOES[e.code];
    if (a) {
      // Baixo + soco = golpe baixo
      if (a === 'soco' && (teclas.ArrowDown || teclas.KeyS)) S.mundo.p1.bufferar('baixo');
      else S.mundo.p1.bufferar(a);
    }
  }
  if (e.code === 'Escape' && S.tela === 'luta') irPara('mapa');
});
addEventListener('keyup', (e) => { teclas[e.code] = false; });

function entrada() {
  const e = vazio();
  for (const k in MAPA_TECLAS) if (teclas[k]) e[MAPA_TECLAS[k]] = true;
  return e;
}

// ------------------------------------------------------------------ telas --
const TELAS = ['titulo', 'selecao', 'mapa', 'briefing', 'luta', 'resultado', 'final'];
function irPara(t) {
  S.tela = t;
  for (const id of TELAS) {
    const el = document.getElementById('tela-' + id);
    if (el) el.classList.toggle('ativa', id === t);
  }
  cv.classList.toggle('ativa', t === 'luta');
  tocar('ui');

  if (t === 'selecao') montarSelecao($('#grade-personagens'), escolherPersonagem);
  if (t === 'mapa') {
    montarMapa($('#mapa-painel'), S.progresso, abrirBriefing);
    $('#mapa-heroi').innerHTML = S.personagem
      ? `<img src="${retrato(S.personagem, 92, 118)}" alt=""><div><b>${LUTADORES[S.personagem].nome}</b><span>${LUTADORES[S.personagem].titulo}</span></div>`
      : '';
    $('#mapa-progresso').textContent = `${S.progresso} / ${MAPA.length} locais vencidos`;
  }
  if (t === 'briefing') {
    montarBriefing($('#brief'), S.no, S.personagem);
    $('#btn-lutar').onclick = comecarLuta;
    $('#btn-lutar').focus();
  }
}

function escolherPersonagem(id) {
  S.personagem = id;
  salvar();
  irPara('mapa');
}

function abrirBriefing(i) { S.no = i; irPara('briefing'); }

function comecarLuta() {
  S.placar = [0, 0];
  S.round = 1;
  novoRound();
  irPara('luta');
}

function novoRound() {
  const n = MAPA[S.no];
  const dif = dificuldadeDoNo(S.no);
  S.mundo = new Mundo(S.personagem, n.lutador, n.palco, dif, {
    round: S.round, placar: S.placar.slice(), onSom: tocar,
  });
  // So busca arte de quem declarou `sprite` em data.js. Quem nao declarou
  // continua no rig procedural e nao gera requisicao nenhuma. Nao esperamos
  // o carregamento: o sprite entra assim que ficar pronto.
  for (const l of [S.mundo.p1, S.mundo.p2])
    if (l.def.sprite) Sprites.carregar(l.id, l.altura);
  // A placa do palco entra assim que carregar; ate la valem as silhuetas.
  carregarPlaca(n.palco);
}

function fimDeRound() {
  S.placar = S.mundo.placar.slice();
  if (S.placar[0] >= 2 || S.placar[1] >= 2) {
    const ganhou = S.placar[0] >= 2;
    if (ganhou && S.no === S.progresso) { S.progresso = Math.min(MAPA.length, S.progresso + 1); salvar(); }
    if (ganhou && S.no === MAPA.length - 1) { mostrarFinal(); return; }
    mostrarResultado(ganhou);
  } else {
    S.round++;
    novoRound();
  }
}

function mostrarResultado(ganhou) {
  const n = MAPA[S.no];
  const d = LUTADORES[n.lutador];
  $('#resultado-caixa').innerHTML = `
    <h2 class="${ganhou ? 'venceu' : 'perdeu'}">${ganhou ? 'VITÓRIA' : 'DERROTA'}</h2>
    <p class="res-sub">${n.nome} — ${d.nome}</p>
    <p class="res-placar">${S.placar[0]} &nbsp;×&nbsp; ${S.placar[1]}</p>
    <p class="res-txt">${ganhou
      ? (S.progresso < MAPA.length ? `Próximo destino liberado: <b>${MAPA[Math.min(S.progresso, MAPA.length - 1)].nome}</b>` : 'Todos os locais liberados.')
      : `Dica: ${d.dica}`}</p>
    <div class="res-btns">
      <button class="btn" id="btn-revanche">REVANCHE</button>
      <button class="btn secundario" id="btn-mapa">VOLTAR AO MAPA</button>
    </div>`;
  irPara('resultado');
  $('#btn-revanche').onclick = comecarLuta;
  $('#btn-mapa').onclick = () => irPara('mapa');
}

function mostrarFinal() {
  $('#final-caixa').innerHTML = `
    <h2>ARAUCÁRIA DERRUBADA</h2>
    <img src="${retrato(S.personagem, 200, 250)}" alt="">
    <p><b>${LUTADORES[S.personagem].nome}</b> atravessou os oito locais e derrubou o colosso da Pedreira.</p>
    <p class="final-sub">Curitiba dorme. Por enquanto.</p>
    <div class="res-btns">
      <button class="btn" id="btn-outro">JOGAR COM OUTRO</button>
      <button class="btn secundario" id="btn-final-mapa">VOLTAR AO MAPA</button>
    </div>`;
  irPara('final');
  $('#btn-outro').onclick = () => irPara('selecao');
  $('#btn-final-mapa').onclick = () => irPara('mapa');
}

// -------------------------------------------------------------------- loop --
let acumulado = 0, anterior = performance.now();
const PASSO = 1000 / FPS;

function loop(agora) {
  requestAnimationFrame(loop);
  let dt = agora - anterior;
  anterior = agora;
  if (dt > 250) dt = 250;
  acumulado += dt;

  while (acumulado >= PASSO) {
    acumulado -= PASSO;
    S.tick++;
    if (S.tela === 'luta' && S.mundo) {
      S.mundo.atualizar(entrada());
      if (S.mundo.fase === 'fim' && S.mundo.faseT > 150) fimDeRound();
    }
  }
  if (S.tela === 'luta' && S.mundo) desenhar();
}

function desenhar() {
  const m = S.mundo;
  const camX = clamp(m.camera, LARGURA / 2, ARENA - LARGURA / 2);
  const tremX = m.tremor > 0.4 ? (Math.random() - 0.5) * m.tremor : 0;
  const tremY = m.tremor > 0.4 ? (Math.random() - 0.5) * m.tremor : 0;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, LARGURA, ALTURA);

  ctx.save();
  ctx.translate(tremX, tremY);
  desenharPalco(ctx, m.palco, camX, S.tick);

  // mundo
  ctx.save();
  ctx.translate(-(camX - LARGURA / 2), 0);
  for (const a of m.armadilhas) desenharArmadilha(ctx, a, S.tick);
  const ordem = m.p1.y >= m.p2.y ? [m.p2, m.p1] : [m.p1, m.p2];
  for (const f of ordem) desenharLutador(ctx, f, S.tick);
  for (const p of m.projeteis) desenharProjetil(ctx, p, S.tick);
  for (const e of m.efeitos) desenharEfeito(ctx, e);
  ctx.restore();
  ctx.restore();

  // vinheta
  const v = ctx.createRadialGradient(LARGURA / 2, ALTURA / 2, ALTURA * 0.42, LARGURA / 2, ALTURA / 2, ALTURA * 0.95);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, LARGURA, ALTURA);

  // flash do hitstop
  if (m.hitstop > 4) {
    ctx.fillStyle = `rgba(255,255,255,${(m.hitstop - 4) * 0.035})`;
    ctx.fillRect(0, 0, LARGURA, ALTURA);
  }

  desenharHUD(ctx, m, S.tick);
}

// ------------------------------------------------------------------ boot ---
function ajustar() {
  const r = Math.min(innerWidth / LARGURA, (innerHeight - 8) / ALTURA);
  cv.style.width = LARGURA * r + 'px';
  cv.style.height = ALTURA * r + 'px';
}
addEventListener('resize', ajustar);

carregar();
cv.width = LARGURA; cv.height = ALTURA;
ajustar();

// Busca as folhas de sprite antes das telas de DOM, porque o retrato e montado
// uma vez e vira data URL - se a folha chegar depois, o card fica com o rig
// para sempre. Quando terminar, remonta a tela atual.
// A altura (172) e a mesma do lutador em jogo, entao o retrato usa exatamente
// o frame que vai aparecer na luta.
Promise.all(
  Object.values(LUTADORES)
    .filter((d) => d.sprite)
    .map((d) => Sprites.carregar(d.id, 172)),
).then(() => irPara(S.tela));

$('#btn-comecar').onclick = () => irPara(S.personagem ? 'mapa' : 'selecao');
$('#btn-trocar').onclick = () => irPara('selecao');
$('#btn-zerar').onclick = () => {
  if (!confirm('Apagar o progresso e voltar do zero?')) return;
  S.progresso = 0; S.personagem = null; salvar(); irPara('selecao');
};
$('#btn-som').onclick = (e) => {
  S.som = !S.som;
  e.target.textContent = S.som ? 'SOM: LIGADO' : 'SOM: DESLIGADO';
};
for (const b of document.querySelectorAll('[data-volta-mapa]')) b.onclick = () => irPara('mapa');

$('#titulo-sub').textContent = S.personagem
  ? `Continuar com ${LUTADORES[S.personagem].nome} — ${S.progresso}/${MAPA.length} locais`
  : 'Oito locais. Sete lutadores. Um colosso na Pedreira.';

// Gancho de depuracao. No console do navegador:
//   CK.mundo.p2.vida = 1        -> mata o oponente
//   CK.mundo.p1.super = 100     -> libera o especial
//   CK.progresso = 7            -> pula direto para o chefao (e depois irPara('mapa'))
window.CK = S;

irPara('titulo');
requestAnimationFrame(loop);
