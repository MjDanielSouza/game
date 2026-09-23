// ============================================================================
//  Teste do motor - roda sem navegador:  node test.js
//  Nao e suite: e a checagem minima que quebra se o combate quebrar.
// ============================================================================
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Mundo, Lutador, vazio, FINALIZE_FRAMES, FATAL_TOTAL } from './js/engine.js';
import { LUTADORES, MAPA, PALCOS, JOGAVEIS, CHAO, FPS, ESC } from './js/data.js';

let ok = 0;
const teste = (nome, fn) => {
  try { fn(); ok++; console.log('  ok  ' + nome); }
  catch (e) { console.error('FALHOU  ' + nome + '\n        ' + e.message); process.exitCode = 1; }
};

// roda n frames com a mesma entrada
const rodar = (m, n, ent = vazio()) => { for (let i = 0; i < n; i++) m.atualizar(ent); };
// pula a intro
const lutando = (m) => { while (m.fase === 'intro') m.atualizar(vazio()); return m; };
const novo = (a = 'lucas', b = 'lucas') => lutando(new Mundo(a, b, 'botanico', 1));

console.log('\n-- dados --');

teste('todo lutador tem os 6 golpes e stats coerentes', () => {
  for (const id in LUTADORES) {
    const d = LUTADORES[id];
    for (const g of ['soco', 'chute', 'baixo', 'aereo', 'habilidade', 'especial'])
      assert.ok(d.golpes[g], `${id} sem golpe ${g}`);
    assert.ok(d.stats.vida > 0 && d.stats.velocidade > 0, `${id} stats invalidos`);
    assert.equal(d.golpes.especial.custoSuper, 100, `${id}: especial deve custar a barra cheia`);
    // cancelar so pode apontar para golpe que existe
    for (const g of Object.values(d.golpes))
      for (const c of g.cancela) assert.ok(d.golpes[c], `${id}: cancela para golpe inexistente ${c}`);
  }
});

teste('mapa aponta para lutadores e palcos que existem', () => {
  for (const n of MAPA) {
    assert.ok(LUTADORES[n.lutador], `no ${n.id}: lutador ${n.lutador} nao existe`);
    assert.ok(PALCOS[n.palco], `no ${n.id}: palco ${n.palco} nao existe`);
  }
  assert.equal(MAPA.filter((n) => n.chefao).length, 1, 'deve haver exatamente 1 chefao');
  assert.ok(MAPA[MAPA.length - 1].chefao, 'o chefao tem que ser o ultimo no');
  assert.equal(JOGAVEIS.length, Object.keys(LUTADORES).length - 1, 'chefao nao pode ser jogavel');
});

console.log('\n-- combate --');

teste('soco conecta e tira vida', () => {
  const m = novo();
  m.p2.x = m.p1.x + 70 * ESC;   // distancia de soco, na escala do jogo
  const antes = m.p2.vida;
  m.p1.bufferar('soco');
  rodar(m, 30);
  assert.ok(m.p2.vida < antes, 'vida nao caiu');
});

teste('golpe erra fora de alcance', () => {
  const m = novo();
  m.p2.x = m.p1.x + 600;
  const antes = m.p2.vida;
  m.p1.bufferar('soco');
  rodar(m, 30);
  assert.equal(m.p2.vida, antes);
});

teste('defesa em pe segura golpe alto e so leva chip', () => {
  const alvo = new Lutador('lucas', 400, -1, false);
  const m = novo();
  m.p2 = alvo; alvo.x = m.p1.x + 70;
  const g = LUTADORES.lucas.golpes.soco;
  alvo.bloqueando = true; alvo.noChao = true; alvo.agachado = false;
  const r = alvo.receber(g, m.p1, m);
  assert.equal(r, 'bloqueio');
  assert.ok(alvo.vidaMax - alvo.vida < g.dano * 0.5, 'chip alto demais');
});

teste('golpe baixo passa por quem defende em pe', () => {
  const alvo = new Lutador('lucas', 400, -1, false);
  const m = novo();
  alvo.bloqueando = true; alvo.agachado = false; alvo.noChao = true;
  const r = alvo.receber(LUTADORES.lucas.golpes.baixo, m.p1, m);
  assert.equal(r, 'acerto', 'golpe baixo nao deveria ser bloqueado em pe');
});

teste('agachado bloqueia baixo mas leva golpe alto', () => {
  const m = novo();
  const a = new Lutador('lucas', 400, -1, false);
  a.bloqueando = true; a.agachado = true; a.noChao = true;
  assert.equal(a.receber(LUTADORES.lucas.golpes.baixo, m.p1, m), 'bloqueio');
  const b = new Lutador('lucas', 400, -1, false);
  b.bloqueando = true; b.agachado = true; b.noChao = true;
  assert.equal(b.receber(LUTADORES.lucas.golpes.soco, m.p1, m), 'acerto');
});

teste('agarrao ignora defesa', () => {
  const m = novo();
  const a = new Lutador('lucas', 400, -1, false);
  a.bloqueando = true; a.noChao = true;
  assert.equal(a.receber(LUTADORES.joao.golpes.habilidade, m.p1, m), 'acerto');
});

teste('armadura absorve o hitstun mas nao o dano', () => {
  const m = novo();
  const a = new Lutador('neumann', 400, -1, false);
  a.armadura = 2;
  const v = a.vida;
  const r = a.receber(LUTADORES.lucas.golpes.chute, m.p1, m);
  assert.equal(r, 'armadura');
  assert.equal(a.armadura, 1, 'armadura nao foi consumida');
  assert.ok(a.vida < v, 'armadura nao deveria zerar o dano');
  assert.notEqual(a.estado, 'hitstun', 'armadura deveria evitar o hitstun');
});

teste('barra de especial enche batendo e apanhando', () => {
  const m = novo();
  m.p2.x = m.p1.x + 70;
  m.p1.bufferar('soco');
  rodar(m, 30);
  assert.ok(m.p1.super > 0, 'quem bate nao ganhou barra');
  assert.ok(m.p2.super > 0, 'quem apanha nao ganhou barra');
});

teste('especial exige barra cheia', () => {
  const m = novo();
  m.p1.super = 40;
  assert.equal(m.p1.podeUsar('especial'), false);
  m.p1.super = 100;
  assert.equal(m.p1.podeUsar('especial'), true);
});

teste('stamina cai atacando e volta parado', () => {
  const m = novo();
  m.p1.bufferar('chute');
  rodar(m, 4);
  const baixo = m.p1.stamina;
  assert.ok(baixo < m.p1.staminaMax, 'stamina nao caiu');
  rodar(m, 180);
  assert.ok(m.p1.stamina > baixo, 'stamina nao regenerou');
});

teste('cancelar so vale depois de acertar', () => {
  const m = novo();
  m.p2.x = m.p1.x + 600;               // fora de alcance: nao acerta
  m.p1.bufferar('soco');
  rodar(m, 6);
  assert.equal(m.p1.estado, 'ataque');
  assert.equal(m.p1.podeUsar('chute'), false, 'cancelou sem ter acertado');
});

teste('projetil do VINICIUS viaja, acerta e deixa lento', () => {
  const m = lutando(new Mundo('vinicius', 'lucas', 'japao', 1));
  m.p2.x = m.p1.x + 320;
  m.p1.bufferar('habilidade');
  rodar(m, 14);
  assert.ok(m.projeteis.length > 0, 'nenhum projetil criado');
  rodar(m, 70);
  assert.ok(m.p2.lentidao > 0 || m.p2.vida < m.p2.vidaMax, 'projetil nao conectou');
});

teste('armadilha do COSTELA dispara quando o oponente pisa', () => {
  const m = lutando(new Mundo('costela', 'lucas', 'tubo', 1));
  m.p1.bufferar('habilidade');
  rodar(m, 16);
  assert.equal(m.armadilhas.length, 1, 'armadilha nao foi posta');
  const a = m.armadilhas[0];
  const v = m.p2.vida;
  m.p2.x = a.x;                        // pisou
  rodar(m, 40);
  assert.ok(m.p2.vida < v, 'armadilha nao disparou');
});

teste('CONTRA-GOLPE do LUCAS pune ataque na janela', () => {
  const m = novo('lucas', 'joao');
  m.p2.x = m.p1.x + 80;
  const v = m.p2.vida;
  m.p1.bufferar('habilidade');
  rodar(m, 4);
  m.p2.bufferar('soco');               // o inimigo ataca durante o parry
  rodar(m, 16);
  assert.ok(m.p2.vida < v, 'contra-golpe nao puniu');
});

teste('chefao tem armadura passiva que recarrega', () => {
  const m = lutando(new Mundo('lucas', 'araucaria', 'pedreira', 1));
  assert.ok(m.p2.def.chefao, 'p2 deveria ser o chefao');
  assert.ok(m.p2.armadura > 0, 'chefao comeca sem armadura passiva');
  m.p2.receber(LUTADORES.lucas.golpes.soco, m.p1, m);
  assert.equal(m.p2.armadura, 0, 'armadura nao foi consumida');
  // margem generosa de proposito: o hitstop congela o mundo, entao a recarga
  // em frames de logica leva mais tempo de relogio que o valor nominal.
  rodar(m, LUTADORES.araucaria.passiva.recarga * 2);
  assert.equal(m.p2.passivaT, 0, 'o contador de recarga nao chegou a zero');
  assert.ok(m.p2.armadura > 0, 'armadura passiva nao recarregou');
});

teste('chefao entra em fase 2 abaixo de 40% de vida', () => {
  const m = lutando(new Mundo('lucas', 'araucaria', 'pedreira', 1));
  m.p2.vida = m.p2.vidaMax * 0.3;
  rodar(m, 2);
  assert.equal(m.p2.fase2, true, 'nao entrou em fase 2');
});

console.log('\n-- round --');

teste('vida zerada encerra o round e marca o placar', () => {
  // `duplo` desliga a IA do p2. Este teste e sobre contabilidade de round, nao
  // sobre IA: com a IA ligada ele dependia de ela nao escolher bloquear, e
  // falhava em 5 de 6 execucoes conforme o Math.random dos testes anteriores.
  const m = lutando(new Mundo('lucas', 'lucas', 'botanico', 1, { duplo: true }));
  m.p2.vida = 1;
  m.p2.x = m.p1.x + 70 * ESC;   // distancia de soco, na escala do jogo
  m.p1.bufferar('soco');
  for (let i = 0; i < 40; i++) m.atualizar(vazio(), vazio());
  assert.equal(m.fase, 'fim');
  assert.equal(m.vencedor, 'p1');
  assert.equal(m.placar[0], 1);
});

teste('tempo esgotado decide por percentual de vida', () => {
  const m = novo();
  m.tempo = 1;
  m.p1.vida = m.p1.vidaMax * 0.8;
  m.p2.vida = m.p2.vidaMax * 0.2;
  rodar(m, 3);
  assert.equal(m.vencedor, 'p1');
});

teste('lutador nao sai da arena nem atravessa o chao', () => {
  const m = novo();
  rodar(m, 200, { ...vazio(), esq: true });
  // A parede e a meia-largura do corpo, nao um numero fixo: corpo maior
  // para mais cedo. Derivar daqui evita o teste envelhecer junto com a escala.
  assert.ok(m.p1.x >= m.p1.largura / 2 - 0.5, 'saiu pela esquerda');
  assert.ok(m.p1.y <= CHAO + 0.01, 'afundou no chao');
});

teste('pulo sobe e volta ao chao', () => {
  const m = novo();
  m.atualizar({ ...vazio(), cima: true });
  rodar(m, 4);
  assert.ok(m.p1.y < CHAO, 'nao saiu do chao');
  rodar(m, 120);
  assert.equal(m.p1.y, CHAO, 'nao voltou ao chao');
  assert.equal(m.p1.noChao, true);
});

teste('todo indice de sprite existe na folha do lutador', () => {
  // Erra-se isto em silencio: um indice fora da folha nao quebra o jogo,
  // so desenha nada. Aqui ele vira falha.
  for (const d of Object.values(LUTADORES)) {
    if (!d.sprite) continue;
    const manifesto = JSON.parse(
      readFileSync(new URL(`./assets/${d.id}.json`, import.meta.url), 'utf8'));
    const n = manifesto.frames.length;
    for (const [chave, v] of Object.entries(d.sprite.frames)) {
      for (const i of [].concat(v)) {
        assert.ok(Number.isInteger(i) && i >= 0 && i < n,
          `${d.id}.${chave} aponta para o frame ${i}, a folha tem ${n}`);
      }
    }
  }
});

console.log('\n-- IA --');

teste('IA de cada lutador joga um round inteiro sem travar nem quebrar', () => {
  for (const id in LUTADORES) {
    const m = lutando(new Mundo('lucas', id, 'botanico', 1.2));
    let mexeu = 0;
    const x0 = m.p2.x;
    for (let i = 0; i < 60 * 40 && m.fase === 'luta'; i++) {
      m.atualizar(i % 90 < 45 ? { ...vazio(), dir: true } : { ...vazio(), soco: false });
      if (i % 37 === 0) m.p1.bufferar('soco');
      if (Math.abs(m.p2.x - x0) > 40) mexeu = 1;
      assert.ok(Number.isFinite(m.p2.x) && Number.isFinite(m.p2.vida), `${id}: estado virou NaN`);
    }
    assert.equal(mexeu, 1, `${id}: a IA ficou parada o round inteiro`);
  }
});

teste('uma campanha inteira roda ate o chefao sem excecao', () => {
  for (const n of MAPA) {
    const m = lutando(new Mundo('juliano', n.lutador, n.palco, 1.2));
    for (let i = 0; i < 60 * 30 && m.fase === 'luta'; i++) {
      m.atualizar({ ...vazio(), dir: i % 50 < 25 });
      if (i % 23 === 0) m.p1.bufferar(['soco', 'chute', 'baixo', 'habilidade'][i % 4]);
      if (i % 400 === 0) { m.p1.super = 100; m.p1.bufferar('especial'); }
    }
    assert.ok(Number.isFinite(m.p1.vida), `${n.id}: vida virou NaN`);
  }
});

teste('em versus o p2 obedece a segunda entrada e a IA nao roda', () => {
  const m = lutando(new Mundo('joao', 'lucas', 'opera', 1, { duplo: true }));
  m.pensarIA = () => { throw new Error('a IA rodou num versus'); };
  const x0 = m.p2.x;
  // p2 anda para a esquerda: e para la que esta o p1, entao o x dele cai.
  for (let i = 0; i < 40; i++) m.atualizar(vazio(), { ...vazio(), esq: true });
  assert.ok(m.p2.x < x0 - 20, 'o p2 nao andou com a entrada do segundo teclado');
  // Sem segunda entrada ele fica parado, em vez de cair na IA. Longe do p1,
  // porque encostado o empurra-corpos separa os dois e mexe no x de graca.
  m.p2.x = m.p1.x + 400; m.p2.vx = 0;
  const x1 = m.p2.x;
  for (let i = 0; i < 40; i++) m.atualizar(vazio());
  assert.ok(Math.abs(m.p2.x - x1) < 6, 'o p2 se mexeu sem ninguem mandar');
  m.p2.bufferar('soco');
  for (let i = 0; i < 6; i++) m.atualizar(vazio(), vazio());
  assert.ok(m.p2.golpe, 'o p2 nao consegue atacar');
});

teste('finalizacao: KO no round decisivo abre a janela, e so nele', () => {
  const decisivo = (placar) => {
    const m = lutando(new Mundo('lucas', 'joao', 'opera', 1, { duplo: true }));
    m.placar = placar.slice();
    m.p2.vida = 1;
    m.p2.x = m.p1.x + 90;
    m.p1.bufferar('soco');
    for (let i = 0; i < 60 && m.fase === 'luta'; i++) m.atualizar(vazio(), vazio());
    return m;
  };
  assert.equal(decisivo([1, 0]).fase, 'finalize', 'round decisivo tem que abrir a janela');
  assert.equal(decisivo([0, 0]).fase, 'fim', 'round 1 de 3 nao abre janela');

  const m = decisivo([1, 0]);
  assert.equal(m.p2.estado, 'atordoado');
  assert.equal(m.placar[0], 2, 'o placar e marcado quando o round encerra, nao depois da cena');
});

teste('finalizacao: sem sequencia vira nocaute padrao', () => {
  const m = lutando(new Mundo('lucas', 'joao', 'opera', 1, { duplo: true }));
  m.placar = [1, 0]; m.p2.vida = 1; m.p2.x = m.p1.x + 90; m.p1.bufferar('soco');
  for (let i = 0; i < 60 && m.fase === 'luta'; i++) m.atualizar(vazio(), vazio());
  // margem porque o hitstop congela o contador de fase
  for (let i = 0; i < FINALIZE_FRAMES + 40; i++) m.atualizar(vazio(), vazio());
  assert.equal(m.fase, 'fim');
  assert.equal(m.p2.estado, 'ko');
  assert.equal(m.finalizar(), false, 'nao da para finalizar depois da janela');
});

teste('finalizacao: a cena roda e termina com o perdedor no chao', () => {
  const m = lutando(new Mundo('lucas', 'joao', 'opera', 1, { duplo: true }));
  m.placar = [1, 0]; m.p2.vida = 1; m.p2.x = m.p1.x + 90; m.p1.bufferar('soco');
  for (let i = 0; i < 60 && m.fase === 'luta'; i++) m.atualizar(vazio(), vazio());
  assert.equal(m.finalizar(), true);
  assert.equal(m.fase, 'fatality');
  assert.equal(m.p1.estado, 'finalizando');
  for (let i = 0; i < FATAL_TOTAL + 40; i++) m.atualizar(vazio(), vazio());
  assert.equal(m.fase, 'fim');
  assert.equal(m.p2.estado, 'ko');
});

teste('finalizacao: o chefao nao finaliza ninguem', () => {
  const m = lutando(new Mundo('araucaria', 'lucas', 'pedreira', 1, { duplo: true }));
  m.placar = [1, 0]; m.p2.vida = 1; m.p2.x = m.p1.x + 120; m.p1.bufferar('soco');
  for (let i = 0; i < 60 && m.fase === 'luta'; i++) m.atualizar(vazio(), vazio());
  assert.equal(m.fase, 'fim', 'o chefao nao tem finalizacao, de proposito');
});

teste('todo jogavel tem finalizacao com sequencia de 3 e nome proprio', () => {
  const nomes = new Set();
  for (const id of JOGAVEIS) {
    const f = LUTADORES[id].finalizacao;
    assert.ok(f, `${id} sem finalizacao`);
    assert.equal(f.sequencia.length, 3, `${id}: sequencia tem que ter 3 entradas`);
    for (const k of f.sequencia)
      assert.ok(['esq','dir','cima','baixo','soco','chute','habilidade','especial'].includes(k),
        `${id}: token invalido na sequencia: ${k}`);
    // nome nao pode repetir o de um golpe, senao o texto na tela mente
    for (const g in LUTADORES[id].golpes)
      assert.notEqual(f.nome, LUTADORES[id].golpes[g].nome, `${id}: finalizacao com nome de golpe`);
    assert.ok(!nomes.has(f.nome), `nome de finalizacao repetido: ${f.nome}`);
    nomes.add(f.nome);
  }
});

console.log(`\n${ok} checagens passaram.\n`);
