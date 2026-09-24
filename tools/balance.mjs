// ============================================================================
//  Sondagem de balanceamento -  node tools/balance.mjs
//
//  Poe um bot de habilidade media no lugar do jogador e roda a campanha
//  inteira com cada lutador. Serve para uma coisa so: ver se a dificuldade
//  SOBE de forma monotona e se o chefao e dificil sem ser impossivel.
//
//  Numeros de referencia (bot medio, nao humano):
//    no 1        ~85-95%   tem que ser quase de graca
//    nos 2-6      40-75%   decrescendo devagar
//    no 7         25-40%   o tanque e uma parede, nao um muro
//    chefao       10-25%   perder na primeira tentativa e o esperado
//
//  Depois de mexer em stats ou criar golpe novo, rode isto antes de publicar.
// ============================================================================

import { Mundo, vazio } from '../js/engine.js';
import { JOGAVEIS, MAPA, LUTADORES, dificuldadeDoNo, ESC } from '../js/data.js';

const RODADAS = Number(process.argv[2] || 6);

// Bot de habilidade media: bloqueia, mistura alto/baixo, pune recovery,
// pula projetil e usa o especial. Nao e um humano bom - e o piso.
// Toda distancia aqui e em pixel de mundo e multiplica por ESC, igual ao
// motor. Esquecer isso ja custou uma investigacao inteira: com o corpo em
// escala de fliperama, o empurra-corpos segura o bot a 132px do chefao e o
// gatilho de ataque estava em 120 - ele nunca apertava um botao e o chefao
// aparecia como "quase impossivel" quando o problema era a regua.
// Alcance efetivo de um golpe corpo a corpo, ja na escala do lutador.
const alcanceDe = (f, g) => (g.alcance ? (g.alcance.x + g.alcance.w) * f.escala : 0);

export function botMedio(m, i) {
  const e = vazio();
  const eu = m.p1, op = m.p2;
  const d = op.x - eu.x;
  const dist = Math.abs(d);
  const opAtacando = op.estado === 'ataque' && op.fase !== 'recovery';
  const opPunivel = op.estado === 'ataque' && op.fase === 'recovery';
  const vindo = m.projeteis.filter((p) => p.dono === op && Math.abs(p.x - eu.x) < 200 * ESC);
  // onda rastejando no chao se pula; coisa que vem pelo alto se bloqueia em pe.
  // (a versao anterior pulava de tudo, inclusive de pinhao caindo do ceu, e
  //  media o chefao como bem mais dificil do que ele e)
  if (vindo.length) {
    // Quem tem golpe com frames de invencibilidade atravessa o projetil - e o
    // que um humano faz e a razao de a LADEIRA existir. Sem isto o RAFAEL era
    // medido como se nao tivesse resposta nenhuma a distancia: 68% do dano que
    // ele levava do chefao vinha dos dois golpes de longe.
    const h = eu.def.golpes.habilidade;
    if (h.invencivel > 0 && eu.podeUsar('habilidade')) { eu.bufferar('habilidade'); return e; }
    const rasteiro = vindo.some((p) => p.rasteiro);
    if (rasteiro && eu.noChao) { e.cima = true; return e; }
    e.bloq = true;
    e.baixo = vindo.every((p) => p.altura === 'baixo');
    return e;
  }
  if (opAtacando && dist < 140 * ESC) {
    const h = eu.def.golpes.habilidade;
    e.bloq = true;
    e.baixo = !!(op.golpe && op.golpe.altura === 'baixo');
    return e;
  }
  if (dist > 130 * ESC) { if (d > 0) e.dir = true; else e.esq = true; }
  else if (dist < 60 * ESC) { if (d > 0) e.esq = true; else e.dir = true; }

  if (eu.super >= 100 && dist < 170 * ESC) { eu.bufferar('especial'); return e; }
  if (opPunivel && dist < 130 * ESC) { eu.bufferar('chute'); return e; }
  if (dist < 120 * ESC && i % 9 === 0) eu.bufferar(i % 27 === 0 ? 'baixo' : i % 18 === 0 ? 'chute' : 'soco');
  // A habilidade depende do tipo. A versao anterior so a usava a dist > 190,
  // que e exatamente quando um agarrao nao serve para nada: media o JOAO e o
  // RAFAEL como se o golpe que os define nao existisse.
  if (i % 24 === 0 && eu.podeUsar('habilidade')) {
    const h = eu.def.golpes.habilidade;
    const serve =
      // anti-aereo so no ar; fora disso o bot desperdicava o golpe do JULIANO
      h.danoAereo ? (!op.noChao && dist < alcanceDe(eu, h) * 1.2) :
      h.tipo === 'nuvem' ? dist > 110 * ESC && dist < 380 * ESC :
      h.tipo === 'projetil' || h.tipo === 'armadilha' ? dist > 150 * ESC :
      h.tipo === 'agarrao' ? dist < 120 * ESC :
      h.tipo === 'buff' ? eu.armadura <= 0 :
      h.tipo === 'dash' ? dist > 200 * ESC || opAtacando :
      // corpo a corpo: no alcance do proprio golpe, nao num numero chutado
      dist < alcanceDe(eu, h) * 1.05;
    if (serve) { eu.bufferar('habilidade'); return e; }
  }
  return e;
}

function partida(pj, pi, palco, dif) {
  const m = new Mundo(pj, pi, palco, dif);
  while (m.fase === 'intro') m.atualizar(vazio());
  for (let i = 0; i < 60 * 99 && m.fase === 'luta'; i++) m.atualizar(botMedio(m, i));
  return m.vencedor;
}

// so roda a campanha quando chamado direto; quem importa daqui quer o botMedio
if (import.meta.main !== false) {
console.log(`\nBalanceamento - ${RODADAS} rounds por lutador, ${JOGAVEIS.length} lutadores\n`);
console.log('no  local                      oponente      dif    vitorias');
console.log('-'.repeat(74));

const linhas = [];
for (let i = 0; i < MAPA.length; i++) {
  const n = MAPA[i];
  const dif = dificuldadeDoNo(i);
  let v = 0, tot = 0;
  for (const pj of JOGAVEIS)
    for (let k = 0; k < RODADAS; k++) { if (partida(pj, n.lutador, n.palco, dif) === 'p1') v++; tot++; }
  const pct = Math.round((v / tot) * 100);
  linhas.push(pct);
  console.log(
    String(i + 1).padEnd(4),
    n.nome.padEnd(26),
    LUTADORES[n.lutador].nome.padEnd(13),
    dif.toFixed(2),
    String(pct + '%').padStart(5),
    ' ' + '#'.repeat(Math.round(pct / 3)),
  );
}

console.log('-'.repeat(74));
const quebras = [];
for (let i = 1; i < linhas.length; i++)
  if (linhas[i] > linhas[i - 1] + 8) quebras.push(`no ${i + 1} e mais facil que o no ${i}`);
if (linhas[0] < 70) quebras.push('o no 1 esta dificil demais para um primeiro combate');
if (linhas[linhas.length - 1] > 35) quebras.push('o chefao esta facil demais');
if (linhas[linhas.length - 1] < 5) quebras.push('o chefao esta perto de impossivel');

if (quebras.length) { console.log('\nPROBLEMAS:'); for (const q of quebras) console.log('  - ' + q); }
else console.log('\nCurva de dificuldade ok.');
console.log();

}
