// ============================================================================
//  CURITIBA KOMBAT - cola: loop, input, telas, progresso
// ============================================================================

import { LARGURA, ALTURA, CHAO, ARENA, FPS, MAPA, LUTADORES, PALCOS, DICAS, dificuldadeDoNo, alturaDe } from './data.js';
import { Mundo, vazio, SEQUENCIA_GAP } from './engine.js';
import { desenharLutador, desenharPalco, desenharProjetil, desenharArmadilha, desenharEfeito, carregarPlaca } from './render.js';
import { desenharHUD, montarSelecao, montarMapa, montarBriefing, montarPalcos, montarRecordes, retrato } from './ui.js';
import { pontosDoRound, salvarRecorde, lerRecordes, ehRecorde } from './pontos.js';
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
  // versus
  duplo: false,
  escolhendo: 1,      // de quem e a vez na tela de selecao
  versus: [null, null],
  versusPalco: 'opera',
  // pontuacao da campanha corrente (js/pontos.js). Nao persiste: o que
  // persiste e a tabela de recordes.
  pontos: 0,
  ultimoGanho: null,
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
// Dois jogadores no mesmo teclado: o p1 fica com o lado esquerdo e o p2 com as
// setas e o numerico. Sozinho, o p1 responde aos dois lados - quem joga a
// campanha nao tem motivo para ficar preso ao WASD.
const TECLAS_P1 = { KeyA: 'esq', KeyD: 'dir', KeyW: 'cima', KeyS: 'baixo', ShiftLeft: 'bloq' };
const TECLAS_P2 = { ArrowLeft: 'esq', ArrowRight: 'dir', ArrowUp: 'cima', ArrowDown: 'baixo', ShiftRight: 'bloq' };
const TECLAS_SOZINHO = { ...TECLAS_P1, ...TECLAS_P2 };

const ACOES_P1 = { KeyJ: 'soco', KeyK: 'chute', KeyL: 'habilidade', Space: 'especial' };
// Virgula, ponto e barra sao o plano B: notebook nao tem teclado numerico, e
// sem eles o segundo jogador simplesmente nao ataca.
const ACOES_P2 = {
  Numpad1: 'soco', Comma: 'soco',
  Numpad2: 'chute', Period: 'chute',
  Numpad3: 'habilidade', Slash: 'habilidade',
  Numpad0: 'especial', NumpadEnter: 'especial', Enter: 'especial',
};

addEventListener('keydown', (e) => {
  // Digitando num campo? O jogo nao ve a tecla. Sem isto, as iniciais do
  // recorde nao entram: A, D, W, S, J, K e L sao todas teclas de jogo e o
  // preventDefault abaixo comia a letra antes de chegar no <input>.
  const alvo = e.target;
  if (alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.isContentEditable)) return;

  // O Enter e a virgula do p2 so viram golpe dentro da luta. Fora dela o Enter
  // precisa continuar acionando o botao em foco.
  const p2Agora = S.duplo && S.tela === 'luta' && ACOES_P2[e.code];
  if (TECLAS_SOZINHO[e.code] || ACOES_P1[e.code] || e.code === 'Space' || p2Agora) e.preventDefault();
  if (teclas[e.code]) return;
  teclas[e.code] = true;

  const a1 = ACOES_P1[e.code];
  if (a1) acao(a1, 1);
  if (S.duplo && ACOES_P2[e.code]) acao(ACOES_P2[e.code], 2);

  // tokens da sequencia de finalizacao - so na borda, que e exatamente aqui
  registrar(1, (S.duplo ? TECLAS_P1 : TECLAS_SOZINHO)[e.code] || a1);
  if (S.duplo) registrar(2, TECLAS_P2[e.code] || ACOES_P2[e.code]);
  if (e.code === 'Escape') voltar();
});
addEventListener('keyup', (e) => { teclas[e.code] = false; });

// Unico caminho de golpe: teclado e toque chamam os dois aqui.
function acao(a, jogador = 1) {
  if (S.tela !== 'luta' || !S.mundo || S.mundo.fase !== 'luta') return;
  const lutador = jogador === 2 ? S.mundo.p2 : S.mundo.p1;
  // Baixo + soco = golpe baixo, com a tecla de baixo de quem esta socando.
  const baixo = jogador === 2 ? teclas.ArrowDown
    : (teclas.KeyS || (!S.duplo && teclas.ArrowDown));
  if (a === 'soco' && baixo) lutador.bufferar('baixo');
  else lutador.bufferar(a);
}

// ------------------------------------------------------- finalizacao -----
// Buffer de entradas DISCRETAS por jogador. Direcao aqui nao e o booleano
// segurado: e a borda, o instante em que a tecla desce ou o dedo encosta. Por
// isso `registrar` e chamado do keydown e do pointerdown, e nunca de
// `entrada()`, que le estado continuo.
const sequencias = { p1: [], p2: [] };

function registrar(jogador, token) {
  if (!token) return;
  const b = sequencias['p' + jogador];
  // Passou do intervalo? a sequencia anterior morreu.
  if (b.length && S.tick - b[b.length - 1].t > SEQUENCIA_GAP) b.length = 0;
  b.push({ k: token, t: S.tick });
  if (b.length > 8) b.shift();
  conferirFinalizacao();
}

function conferirFinalizacao() {
  const m = S.mundo;
  if (!m || m.fase !== 'finalize' || !m.vencedor || m.vencedor === 'empate') return;
  const venc = m.vencedor === 'p1' ? m.p1 : m.p2;
  const alvo = venc.def.finalizacao;
  if (!alvo) return;
  const b = sequencias[m.vencedor];
  const s = alvo.sequencia;
  if (b.length < s.length) return;
  const fim = b.slice(-s.length);
  if (fim.every((x, i) => x.k === s[i])) {
    if (m.finalizar()) b.length = 0;
  }
}

function lerTeclas(mapa) {
  const e = vazio();
  for (const k in mapa) if (teclas[k]) e[mapa[k]] = true;
  return e;
}
const entrada = () => lerTeclas(S.duplo ? TECLAS_P1 : TECLAS_SOZINHO);
const entrada2 = () => lerTeclas(TECLAS_P2);

// ------------------------------------------------------------------ toque --
// Celular nao tem teclado. Os botoes de direcao escrevem no mesmo `teclas` que
// o keydown, entao `entrada()` nao sabe de onde veio o input e o combo
// baixo+soco continua funcionando sem nenhuma linha a mais.
const painelToque = $('#toque');
let ehToque = matchMedia('(pointer: coarse)').matches;

function atualizarToque() {
  painelToque.classList.toggle('ativa', ehToque && S.tela === 'luta');
}

// Notebook com tela de toque responde `pointer: fine`. Entao tambem liga no
// primeiro dedo que encostar, e ai vale para o resto da sessao.
addEventListener('touchstart', () => {
  if (ehToque) return;
  ehToque = true;
  atualizarToque();
}, { passive: true });

for (const b of painelToque.querySelectorAll('.tq')) {
  const tecla = b.dataset.tecla;
  const golpe = b.dataset.acao;

  b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    // Captura no proprio botao. Sem isso, arrastar o polegar para fora entrega
    // o pointerup a outro elemento e a direcao fica presa para sempre - o
    // lutador anda sozinho ate a parede.
    try { b.setPointerCapture(e.pointerId); } catch (err) {}
    b.classList.add('presso');
    if (tecla) teclas[tecla] = true;
    else if (golpe) acao(golpe);
    else sairDaLuta();
    registrar(1, tecla ? TECLAS_SOZINHO[tecla] : golpe);
  });

  const soltar = () => {
    b.classList.remove('presso');
    if (tecla) teclas[tecla] = false;
  };
  b.addEventListener('pointerup', soltar);
  b.addEventListener('pointercancel', soltar);
}

// ------------------------------------------------------------------ telas --
const TELAS = ['titulo', 'selecao', 'mapa', 'palco', 'briefing', 'carregando', 'luta', 'resultado', 'final', 'recorde'];
function irPara(t) {
  S.tela = t;
  for (const id of TELAS) {
    const el = document.getElementById('tela-' + id);
    if (el) el.classList.toggle('ativa', id === t);
  }
  cv.classList.toggle('ativa', t === 'luta');
  atualizarToque();
  tocar('ui');

  if (t === 'selecao') {
    $('#selecao-titulo').textContent = S.duplo
      ? `JOGADOR ${S.escolhendo} — ESCOLHA` : 'ESCOLHA SEU LUTADOR';
    $('#btn-selecao-volta').textContent = S.duplo ? '← MENU' : 'MAPA';
    montarSelecao({ grade: $('#grade-personagens'), arte: $('#sel-arte'), ficha: $('#sel-ficha') },
      escolherPersonagem);
  }
  if (t === 'palco') montarPalcos($('#grade-palcos'), lutarVersus);
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
  if (S.duplo) {
    S.versus[S.escolhendo - 1] = id;
    if (S.escolhendo === 1) { S.escolhendo = 2; irPara('selecao'); }
    else irPara('palco');
    return;
  }
  S.personagem = id;
  S.pontos = 0;            // campanha nova, pontuacao nova
  salvar();
  irPara('mapa');
}

function lutarVersus(palco) {
  S.versusPalco = palco;
  comecarLuta();
}

function sairDoVersus() { S.duplo = false; irPara('titulo'); }
// Abandonar a luta volta ao mapa na campanha e ao menu no versus: no versus
// nao existe mapa, e cair nele mostraria a campanha de outra pessoa.
function sairDaLuta() { if (S.duplo) sairDoVersus(); else irPara('mapa'); }

// Uma tela so sabe de onde ela veio. Sem este mapa o mapa da campanha era um
// beco sem saida: entrava pelo CAMPANHA e as unicas saidas eram selecao e
// briefing, que voltam para ele. Nao dava para chegar no titulo sem recarregar.
const PAI = {
  selecao: () => (S.duplo ? sairDoVersus() : irPara('mapa')),
  mapa: () => irPara('titulo'),
  palco: () => { S.escolhendo = 2; irPara('selecao'); },
  briefing: () => irPara('mapa'),
  carregando: () => irPara('mapa'),   // largar aqui cancela: comecarLuta confere a tela
  luta: () => sairDaLuta(),
  recorde: () => irPara('titulo'),
  final: () => irPara('titulo'),
};
function voltar() { const f = PAI[S.tela]; if (f) f(); }


function abrirBriefing(i) { S.no = i; irPara('briefing'); }

// Tempo minimo na tela de carregamento. Sem ele, quando tudo ja esta em cache
// a tela pisca por 2 frames e vira defeito visual em vez de transicao.
const MIN_CARREGANDO = 900;

// Espera os recursos DO ROUND: as folhas dos dois lutadores e a placa do
// palco. Nada aqui rejeita - lutador sem sprite e palco sem placa sao casos
// normais, com fallback procedural.
function recursosDoRound(aoAndar) {
  const m = S.mundo;
  const tarefas = [];
  for (const l of [m.p1, m.p2]) if (l.def.sprite) tarefas.push(Sprites.carregar(l.id, alturaDe(l.def)));
  tarefas.push(carregarPlaca(m.palco));
  let prontas = 0;
  return Promise.all(tarefas.map((p) => p.then(() => aoAndar(++prontas / tarefas.length))));
}

async function comecarLuta() {
  S.placar = [0, 0];
  S.round = 1;
  novoRound();

  const barra = $('#load-preenche');
  barra.style.width = '0%';
  $('#load-local').textContent = S.duplo ? PALCOS[S.versusPalco].nome : MAPA[S.no].nome;
  $('#load-dica').innerHTML = DICAS[Math.floor(Math.random() * DICAS.length)];
  irPara('carregando');

  const t0 = performance.now();
  await recursosDoRound((p) => { barra.style.width = Math.round(p * 100) + '%'; });
  barra.style.width = '100%';
  const resta = MIN_CARREGANDO - (performance.now() - t0);
  if (resta > 0) await new Promise((r) => setTimeout(r, resta));

  // O jogador pode ter saido da tela enquanto carregava.
  if (S.tela === 'carregando') irPara('luta');
}

function novoRound() {
  sequencias.p1.length = 0;
  sequencias.p2.length = 0;
  const n = S.duplo ? null : MAPA[S.no];
  const palco = S.duplo ? S.versusPalco : n.palco;
  const a = S.duplo ? S.versus[0] : S.personagem;
  const b = S.duplo ? S.versus[1] : n.lutador;
  const dif = S.duplo ? 1 : dificuldadeDoNo(S.no);
  S.mundo = new Mundo(a, b, palco, dif, {
    round: S.round, placar: S.placar.slice(), onSom: tocar, duplo: S.duplo,
  });
  // So busca arte de quem declarou `sprite` em data.js. Quem nao declarou
  // continua no rig procedural e nao gera requisicao nenhuma. Nao esperamos
  // o carregamento: o sprite entra assim que ficar pronto.
  for (const l of [S.mundo.p1, S.mundo.p2])
    if (l.def.sprite) Sprites.carregar(l.id, l.altura);
  // A placa do palco entra assim que carregar; ate la valem as silhuetas.
  carregarPlaca(palco);
}

function fimDeRound() {
  // Pontua antes de trocar de round: o `S.mundo` daqui ainda e o do round que
  // acabou, com a vida, o relogio e a finalizacao dele.
  if (!S.duplo) {
    S.ultimoGanho = pontosDoRound(S.mundo, dificuldadeDoNo(S.no));
    S.pontos += S.ultimoGanho.total;
  }
  S.placar = S.mundo.placar.slice();
  if (S.placar[0] >= 2 || S.placar[1] >= 2) {
    if (S.duplo) { mostrarResultadoVersus(); return; }
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
    ${detalhePontos()}
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

function mostrarResultadoVersus() {
  const p1Venceu = S.placar[0] >= 2;
  const v = LUTADORES[S.versus[p1Venceu ? 0 : 1]];
  $('#resultado-caixa').innerHTML = `
    <h2 class="venceu">JOGADOR ${p1Venceu ? 1 : 2} VENCE</h2>
    <p class="res-sub">${v.nome} — ${v.titulo}</p>
    <p class="res-placar">${S.placar[0]} &nbsp;×&nbsp; ${S.placar[1]}</p>
    <div class="res-btns">
      <button class="btn" id="btn-revanche">REVANCHE</button>
      <button class="btn secundario" id="btn-troca-2p">TROCAR LUTADORES</button>
      <button class="btn fantasma" id="btn-sai-2p">MENU</button>
    </div>`;
  irPara('resultado');
  $('#btn-revanche').onclick = comecarLuta;
  $('#btn-troca-2p').onclick = () => { S.escolhendo = 1; irPara('selecao'); };
  $('#btn-sai-2p').onclick = sairDoVersus;
}

// Quebra da pontuacao do ultimo round, para o jogador ver DE ONDE vieram os
// pontos - sem isso a pontuacao e um numero que sobe sozinho.
function detalhePontos() {
  const g = S.ultimoGanho;
  if (S.duplo || !g || !g.total) return '';
  const linhas = g.partes
    .map(([k, v]) => `<div><span>${k}</span><b>+${v}</b></div>`)
    .join('');
  const mult = g.multiplicador !== 1 ? `<div class="pt-mult"><span>DIFICULDADE</span><b>×${g.multiplicador.toFixed(2)}</b></div>` : '';
  return `<div class="pt-quebra">${linhas}${mult}
    <div class="pt-total"><span>ROUND</span><b>+${g.total}</b></div>
    <div class="pt-acum"><span>TOTAL</span><b>${S.pontos.toLocaleString('pt-BR')}</b></div>
  </div>`;
}

function mostrarFinal() {
  $('#final-caixa').innerHTML = `
    <h2>ARAUCÁRIA DERRUBADA</h2>
    <img src="${retrato(S.personagem, 200, 250)}" alt="">
    <p><b>${LUTADORES[S.personagem].nome}</b> atravessou os oito locais e derrubou o colosso da Pedreira.</p>
    <p class="final-pontos">${S.pontos.toLocaleString('pt-BR')} <i>PONTOS</i></p>
    <p class="final-sub">Curitiba dorme. Por enquanto.</p>
    <div class="res-btns">
      <button class="btn" id="btn-outro">JOGAR COM OUTRO</button>
      <button class="btn secundario" id="btn-final-mapa">VOLTAR AO MAPA</button>
    </div>`;
  irPara('final');
  $('#btn-outro').onclick = () => irPara('selecao');
  $('#btn-final-mapa').onclick = () => irPara('mapa');
  if (ehRecorde(localStorage, S.pontos)) pedirNome();
}

// ------------------------------------------------------------- recordes ----
// O <input> fica POR CIMA do canvas, nao numa tela separada: o jogador acabou
// de derrubar o chefao e a cena continua atras.
function pedirNome() {
  const ov = $('#nome-overlay');
  const inp = $('#nome-input');
  $('#nome-pontos').textContent = S.pontos.toLocaleString('pt-BR');
  inp.value = '';
  ov.classList.add('ativa');
  setTimeout(() => inp.focus(), 60);

  const confirmar = () => {
    ov.classList.remove('ativa');
    const { lista, posicao } = salvarRecorde(localStorage, {
      nome: inp.value,
      pontos: S.pontos,
      personagem: S.personagem,
      no: MAPA.length,
    });
    // Run encerrada: a proxima campanha comeca do zero. Sem isto, terminar e
    // voltar a jogar somava em cima do total ja registrado.
    // Nao fecha o buraco todo: repetir um no ANTES de terminar ainda acumula.
    // Fechar de verdade pede melhor-pontuacao por no, que e outra conversa.
    S.pontos = 0;
    abrirRecordes(lista, posicao);
  };
  $('#nome-ok').onclick = confirmar;
  inp.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); confirmar(); } };
}

function abrirRecordes(lista, destaque = 0) {
  montarRecordes($('#recorde-tabela'), lista || lerRecordes(localStorage), destaque);
  irPara('recorde');
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
      S.mundo.atualizar(entrada(), S.duplo ? entrada2() : undefined);
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
  // A camera vertical move o palco e o mundo JUNTOS - se so o mundo descesse,
  // o lutador sairia do chao desenhado.
  ctx.translate(tremX, tremY + m.cameraY);
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

  // Finalizacao: escurece tudo e abre um holofote em volta dos dois. O mundo
  // ja foi desenhado; isto entra por cima e antes do HUD.
  if (m.fase === 'fatality') {
    const k = Math.min(1, m.fatalT / 26);
    const cx = clamp((m.p1.x + m.p2.x) / 2 - (camX - LARGURA / 2), 0, LARGURA);
    const foco = ctx.createRadialGradient(cx, CHAO - 150, 60, cx, CHAO - 150, 620);
    foco.addColorStop(0, `rgba(40,0,0,${0.10 * k})`);
    foco.addColorStop(1, `rgba(0,0,0,${0.88 * k})`);
    ctx.fillStyle = foco;
    ctx.fillRect(0, 0, LARGURA, ALTURA);
  }

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
// Cada um na altura que ele tem em jogo, e nao numa altura fixa: sprites.js
// fixa a escala da folha na primeira chamada e ignora as seguintes, entao um
// numero fixo aqui desenharia o chefao - o unico com escala != 1 - a 70% do
// tamanho dele pelo resto da sessao. O retrato nao se importa, porque
// desenharEm() calcula a propria escala pelo tamanho do frame.
Promise.all(
  Object.values(LUTADORES)
    .filter((d) => d.sprite)
    .map((d) => Sprites.carregar(d.id, alturaDe(d))),
).then(() => irPara(S.tela));

$('#btn-comecar').onclick = () => { S.duplo = false; irPara(S.personagem ? 'mapa' : 'selecao'); };
$('#btn-versus').onclick = () => { S.duplo = true; S.escolhendo = 1; irPara('selecao'); };
$('#btn-trocar').onclick = () => { S.duplo = false; irPara('selecao'); };
$('#btn-selecao-volta').onclick = voltar;
$('#btn-mapa-menu').onclick = voltar;
$('#btn-recordes').onclick = () => abrirRecordes();
$('#btn-recorde-volta').onclick = voltar;
$('#btn-palco-volta').onclick = voltar;
$('#btn-zerar').onclick = () => {
  if (!confirm('Apagar o progresso e voltar do zero?')) return;
  S.progresso = 0; S.personagem = null; S.pontos = 0; salvar(); irPara('selecao');
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
