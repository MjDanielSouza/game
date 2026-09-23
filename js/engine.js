// ============================================================================
//  CURITIBA KOMBAT - motor
//  Loop de tempo fixo, state machine por lutador, hitbox/hurtbox em dados.
//  Nada aqui conhece um golpe pelo nome: tudo vem de data.js.
// ============================================================================

import { LUTADORES, GRAVIDADE, ATRITO, CHAO, ARENA, FPS, alturaDe, ESCALA_ARCADE, ESC, impulsoDe } from './data.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const colide = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

// Ordem em que a IA e o input consideram golpes
export const BOTOES = ['soco', 'chute', 'baixo', 'aereo', 'habilidade', 'especial'];

// Camera vertical: o quanto ela pode descer, e a folga que a cabeca precisa
// ter do topo da tela (o HUD ocupa ate ~90).
const CAMERA_Y_MAX = 150;
const MARGEM_TOPO = 96;

// Janela de finalizacao: 5 segundos com o perdedor atordoado de pe.
export const FINALIZE_FRAMES = 5 * FPS;
// Vermelho escuro. O nome da finalizacao e o aviso ficam em cima e apagados:
// a cena e o que tem que ser vista, nao a legenda dela.
export const COR_FINALIZACAO = '#9c1c12';
// Quanto tempo um input da sequencia espera pelo proximo antes de zerar.
export const SEQUENCIA_GAP = 60;
// Duracao da finalizacao em si, por etapa: escurece, golpe, queda.
const FATAL_ESCURECE = 26;
const FATAL_GOLPE = 40;
const FATAL_QUEDA = 84;
export const FATAL_TOTAL = FATAL_ESCURECE + FATAL_GOLPE + FATAL_QUEDA;

// ============================================================================
//  LUTADOR
// ============================================================================
export class Lutador {
  constructor(idDef, x, dir, ehJogador, dificuldade = 1) {
    const d = LUTADORES[idDef];
    this.def = d;
    this.id = d.id;
    this.ehJogador = ehJogador;
    this.dificuldade = dificuldade;

    this.x = x;
    this.y = CHAO;
    this.vx = 0;
    this.vy = 0;
    this.dir = dir;               // 1 = olhando para a direita

    this.escala = d.fisico.escala * ESCALA_ARCADE;
    this.altura = alturaDe(d);
    // bulk entra amortecido: escala e bulk multiplicando direto davam um corpo
    // de 157px no chefao, e o empurra-corpos separava mais do que o alcance do
    // soco do jogador - dava para lutar a luta inteira sem nunca encostar nele.
    this.largura = 46 * this.escala * (0.6 + d.fisico.bulk * 0.4);

    // A dificuldade mexe mais no comportamento da IA do que na vida dela.
    // Escalar vida direto empilhava com peso/defesa altos e o tanque virava
    // um muro impossivel no fim da campanha.
    const escalaVida = ehJogador ? 1 : 1 + (dificuldade - 1) * 0.45;
    this.vidaMax = Math.round(d.stats.vida * escalaVida);
    this.vida = this.vidaMax;
    this.staminaMax = d.stats.stamina;
    this.stamina = this.staminaMax;
    this.super = 0;
    this.superMax = 100;

    this.estado = 'idle';
    this.t = 0;                   // frames no estado atual
    this.golpe = null;
    this.golpeId = null;
    this.fase = null;             // startup | ativo | recovery
    this.acertou = false;         // ja conectou nesta ativacao
    this.hitsDados = 0;
    this.travaAte = 0;
    this.podeCancelar = false;

    this.noChao = true;
    this.agachado = false;
    this.bloqueando = false;
    this.invencivel = 0;
    this.armadura = 0;
    this.armaduraT = 0;
    this.lentidao = 0;
    this.exausto = 0;
    this.cooldowns = {};
    this.buffer = {};             // acao -> frames restantes
    this.combo = 0;
    this.comboT = 0;
    this.especiaisUsados = 0;     // conta para a pontuacao (js/pontos.js)
    this.piscar = 0;
    this.fase2 = false;

    // armadura passiva do chefao
    this.passivaT = 0;
    if (d.passiva) this.armadura = d.passiva.armadura;
  }

  // -------------------------------------------------------------- helpers --
  get vivo() { return this.vida > 0; }

  get hurtbox() {
    const h = this.agachado && this.noChao ? this.altura * 0.62 : this.altura;
    return { x: this.x - this.largura / 2, y: this.y - h, w: this.largura, h };
  }

  hitboxDe(g) {
    const a = g.alcance;
    const s = this.escala;
    const w = a.w * s, h = a.h * s;
    const x = this.dir === 1 ? this.x + a.x * s : this.x - a.x * s - w;
    return { x, y: this.y + a.y * s, w, h };
  }

  bufferar(acao) { this.buffer[acao] = 8; }

  consumir(acao) {
    if (this.buffer[acao] > 0) { this.buffer[acao] = 0; return true; }
    return false;
  }

  temBuffer(acao) { return this.buffer[acao] > 0; }

  // ------------------------------------------------------------- transicao -
  trocar(estado) { this.estado = estado; this.t = 0; }

  travado() {
    return ['ataque', 'hitstun', 'blockstun', 'ko', 'agarrado', 'atordoado'].includes(this.estado);
  }

  // Pode iniciar `id`? Livre, ou cancelando o golpe atual depois de acertar.
  podeUsar(id) {
    const g = this.def.golpes[id];
    if (!g) return false;
    if (this.estado === 'ko' || this.exausto > 0) return false;
    if ((this.cooldowns[id] || 0) > 0) return false;
    if (g.custoSuper > 0 && this.super < g.custoSuper) return false;
    if (g.stamina > this.stamina) return false;
    if (id === 'aereo' && this.noChao) return false;
    if (id !== 'aereo' && !this.noChao) return false;

    if (this.estado === 'ataque') {
      if (!this.acertou) return false;
      const atual = this.def.golpes[this.golpeId];
      return atual && atual.cancela.includes(id);
    }
    return !this.travado();
  }

  usar(id, mundo) {
    const g = this.def.golpes[id];
    this.golpe = g;
    this.golpeId = id;
    this.fase = 'startup';
    this.acertou = false;
    this.hitsDados = 0;
    this.trocar('ataque');
    this.stamina = Math.max(0, this.stamina - g.stamina);
    if (g.custoSuper > 0) { this.super -= g.custoSuper; this.especiaisUsados++; }
    if (g.cooldown) this.cooldowns[id] = Math.round(g.cooldown * (this.def.chefao && this.fase2 ? this.def.fase2.cooldown : 1));
    if (g.invencivel) this.invencivel = Math.max(this.invencivel, g.invencivel);
    if (g.armadura && g.tipo !== 'buff') { this.armadura = Math.max(this.armadura, g.armadura); this.armaduraT = g.startup + g.ativo + 4; }
    if (g.tipo === 'buff' && g.buff) { /* aplicado no fim do startup */ }
    mundo.som(g.som);
    return true;
  }

  // ------------------------------------------------------------------ dano -
  // retorna 'acerto' | 'bloqueio' | 'armadura' | 'errou'
  receber(golpe, atacante, mundo, danoOverride) {
    if (!this.vivo) return 'errou';
    if (this.invencivel > 0) return 'errou';

    // Parry ativo: devolve o golpe em vez de recebe-lo.
    // Fica aqui, e nao num passo separado do Mundo, porque TODO golpe entra
    // por receber() - melee, projetil ou armadilha. Resolver fora daqui deixava
    // o ataque conectar primeiro e cancelar o proprio parry.
    if (this.estado === 'ataque' && this.golpe && this.golpe.tipo === 'parry' && !this.acertou) {
      const g = this.golpe;
      if (this.t > g.startup && this.t <= g.startup + g.ativo) {
        this.acertou = true;
        this.invencivel = 20;
        this.super = Math.min(this.superMax, this.super + g.ganhoSuper);
        mundo.hitstop = Math.max(mundo.hitstop, 12);
        mundo.efeito('parry', this.x + this.dir * 30, this.y - this.altura * 0.6, 1.5);
        mundo.texto('CONTRA-GOLPE!', '#ffd23f');
        mundo.som('super');
        if (atacante) {
          atacante.golpe = null;
          atacante.receber(g, this, mundo);
        }
        return 'errou';
      }
    }

    const dano0 = danoOverride != null ? danoOverride : golpe.dano;
    const mult = atacante && atacante.def.chefao && atacante.fase2 ? atacante.def.fase2.dano : 1;
    let dano = (dano0 * mult) / this.def.stats.defesa;

    // Bloqueio: precisa estar defendendo na altura certa. Agarrao ignora.
    const alturaOk =
      golpe.altura === 'baixo' ? this.agachado : !this.agachado || golpe.altura === 'medio';
    const podeBloquear =
      this.bloqueando && this.noChao && golpe.tipo !== 'agarrao' && alturaOk;

    if (podeBloquear) {
      const chip = dano * 0.14;
      this.vida = Math.max(0, this.vida - chip);
      this.stamina -= dano * 0.9;
      this.super += dano * 0.35;
      if (atacante) atacante.super = Math.min(atacante.superMax,
        atacante.super + (golpe.ganhoSuper || dano) * 0.35);
      this.vx += this.dir * -1 * golpe.empurrao * ESC * 0.5;
      this.trocar('blockstun');
      this.travaAte = golpe.blockstun;
      mundo.efeito('bloqueio', this.x + this.dir * -18, this.y - this.altura * 0.6);
      mundo.som('bloqueio');
      mundo.hitstop = Math.max(mundo.hitstop, 3);
      if (this.stamina <= 0) {           // guard break
        this.stamina = 0;
        this.exausto = 70;
        this.trocar('hitstun');
        this.travaAte = 70;
        mundo.texto('DEFESA QUEBRADA!', '#ff4a32');
      }
      return 'bloqueio';
    }

    // Armadura: absorve o hitstun, nao o dano
    if (this.armadura > 0 && golpe.tipo !== 'agarrao') {
      this.armadura--;
      // a passiva do chefao so recarrega depois de ser gasta - e e gasta aqui
      if (this.def.passiva && this.armadura <= 0) this.passivaT = this.def.passiva.recarga;
      this.vida = Math.max(0, this.vida - dano * 0.7);
      this.super += dano * 0.5;
      // O atacante tambem ganha barra aqui. Sem isto, quem enfrenta o chefao
      // era o unico a ser privado de super de forma sistematica: a passiva dele
      // recarrega sozinha e come um golpe a cada 2,4s, para sempre.
      if (atacante) atacante.super = Math.min(atacante.superMax,
        atacante.super + (golpe.ganhoSuper || dano) * 0.7);
      mundo.efeito('armadura', this.x, this.y - this.altura * 0.6);
      mundo.hitstop = Math.max(mundo.hitstop, 4);
      if (this.vida <= 0) this.morrer(mundo);
      return 'armadura';
    }

    // Acerto limpo
    this.vida = Math.max(0, this.vida - dano);
    this.super = Math.min(this.superMax, this.super + dano * 0.5);
    if (atacante) atacante.super = Math.min(atacante.superMax, atacante.super + (golpe.ganhoSuper || dano));
    this.piscar = 8;

    const pesoInv = 1 / this.def.stats.peso;
    // empurrado para longe de quem bateu
    const sentido = atacante ? atacante.dir : -this.dir;
    this.vx += sentido * golpe.empurrao * ESC * pesoInv;
    if (!this.noChao) this.vy = Math.min(this.vy, -4);

    this.trocar('hitstun');
    this.travaAte = Math.round(golpe.hitstun * (this.def.chefao ? 0.55 : pesoInv));
    this.golpe = null;
    if (this.def.passiva) this.passivaT = this.def.passiva.recarga;

    mundo.efeito('acerto', this.x + (atacante ? atacante.dir : 0) * -10, this.y - this.altura * 0.55, golpe.som === 'super' ? 1.8 : 1);
    mundo.hitstop = Math.max(mundo.hitstop, golpe.som === 'super' ? 9 : 6);
    mundo.tremor = Math.max(mundo.tremor, golpe.som === 'super' ? 14 : dano * 0.4);
    mundo.som(golpe.som === 'super' ? 'super' : 'acerto');

    if (atacante) {
      atacante.combo++;
      atacante.comboT = 60;
      if (atacante.combo >= 3) mundo.combo(atacante, atacante.combo);
    }

    if (this.vida <= 0) this.morrer(mundo);
    return 'acerto';
  }

  morrer(mundo) {
    this.vida = 0;
    this.trocar('ko');
    this.vy = -9;
    this.vx = -this.dir * 5 * ESC;
    mundo.tremor = 22;
    mundo.som('ko');
  }

  // ---------------------------------------------------------------- update -
  atualizar(ent, oponente, mundo) {
    // timers
    for (const k in this.buffer) if (this.buffer[k] > 0) this.buffer[k]--;
    for (const k in this.cooldowns) if (this.cooldowns[k] > 0) this.cooldowns[k]--;
    if (this.invencivel > 0) this.invencivel--;
    if (this.lentidao > 0) this.lentidao--;
    if (this.piscar > 0) this.piscar--;
    if (this.exausto > 0) this.exausto--;
    // Fim da armadura de um golpe. Quem tem passiva so volta a te-la se a
    // recarga ja terminou - senao a armadura de cada golpe reabastecia a
    // passiva e a janela de punicao nunca abria.
    if (this.armaduraT > 0 && --this.armaduraT === 0)
      this.armadura = this.def.passiva && this.passivaT <= 0 ? this.def.passiva.armadura : 0;
    if (this.comboT > 0 && --this.comboT === 0) this.combo = 0;
    this.t++;

    // Armadura passiva do chefao. O contador corre SEMPRE: travado atras de
    // "armadura <= 0" ele congelava enquanto um golpe armado estava no ar, e
    // como quase todo golpe dele e armado, nunca recarregava.
    if (this.def.passiva) {
      if (this.passivaT > 0) this.passivaT--;
      if (this.passivaT <= 0 && this.armadura <= 0 && this.armaduraT <= 0)
        this.armadura = this.def.passiva.armadura;
    }

    // fase 2 do chefao
    if (this.def.fase2 && !this.fase2 && this.vida / this.vidaMax <= this.def.fase2.limiteVida) {
      this.fase2 = true;
      this.super = this.superMax;
      mundo.texto('FASE 2', '#ff4a32');
      mundo.tremor = 26;
    }

    if (this.estado === 'ko') { this.fisica(); return; }

    // Atordoado: de pe, sem controle, esperando a finalizacao ou o nocaute
    // padrao. Nao sai deste estado sozinho - quem tira e o Mundo.
    if (this.estado === 'atordoado') {
      this.vx *= ATRITO;
      this.bloqueando = false;
      this.agachado = false;
      this.fisica();
      return;
    }

    const vel = this.def.stats.velocidade * ESC * (this.lentidao > 0 ? 0.45 : 1) * (this.fase2 ? this.def.fase2.velocidade : 1);

    // ---- estados travados ----
    if (this.estado === 'hitstun' || this.estado === 'blockstun') {
      if (this.t >= (this.travaAte || 10)) this.trocar('idle');
      this.fisica();
      this.encarar(oponente);
      return;
    }

    if (this.estado === 'ataque') {
      this.rodarGolpe(oponente, mundo);
      this.fisica();
      return;
    }

    // ---- livre ----
    this.agachado = ent.baixo && this.noChao;
    const paraTras = (this.dir === 1 && ent.esq) || (this.dir === -1 && ent.dir);
    this.bloqueando = this.noChao && !this.exausto && (ent.bloq || (paraTras && oponente && oponente.estado === 'ataque'));

    // iniciar golpe (buffer)
    for (const id of BOTOES) {
      if (this.temBuffer(id) && this.podeUsar(id)) { this.consumir(id); this.usar(id, mundo); return; }
    }
    // ataque aereo automatico se soco no ar
    if (!this.noChao && this.temBuffer('soco') && this.podeUsar('aereo')) {
      this.consumir('soco'); this.usar('aereo', mundo); return;
    }

    if (this.bloqueando) {
      this.vx *= ATRITO;
      this.estado = 'bloqueio';
      this.stamina = Math.min(this.staminaMax, this.stamina + this.def.stats.regen * 0.3);
      this.fisica();
      this.encarar(oponente);
      return;
    }

    if (this.agachado) {
      this.vx *= ATRITO;
      this.estado = 'agachar';
    } else if (this.noChao) {
      if (ent.esq) { this.vx = -vel; this.estado = 'andar'; }
      else if (ent.dir) { this.vx = vel; this.estado = 'andar'; }
      else { this.vx *= ATRITO; this.estado = 'idle'; }
      if (ent.cima) {
        this.vy = -impulsoDe(this.def);
        this.noChao = false;
        this.estado = 'pulo';
        mundo.som('pulo');
      }
    } else {
      this.estado = 'pulo';
      if (ent.esq) this.vx = Math.max(this.vx - 0.35 * ESC, -vel);
      if (ent.dir) this.vx = Math.min(this.vx + 0.35 * ESC, vel);
    }

    // regen de stamina fora de acao
    if (this.estado === 'idle' || this.estado === 'agachar')
      this.stamina = Math.min(this.staminaMax, this.stamina + this.def.stats.regen);
    else if (this.estado === 'andar')
      this.stamina = Math.min(this.staminaMax, this.stamina + this.def.stats.regen * 0.5);

    this.fisica();
    this.encarar(oponente);
  }

  encarar(op) {
    if (!op || this.estado === 'ataque' || !this.noChao) return;
    this.dir = op.x >= this.x ? 1 : -1;
  }

  fisica() {
    this.x += this.vx;
    if (!this.noChao) {
      this.vy += GRAVIDADE;
      this.y += this.vy;
    }
    if (this.y >= CHAO) {
      this.y = CHAO;
      this.vy = 0;
      if (!this.noChao) {
        this.noChao = true;
        if (this.estado === 'pulo') this.trocar('idle');
      }
    }
    // A parede considera a largura do corpo. Com 60 fixo, o lutador grande
    // atravessava metade de si mesmo para fora da arena.
    const meio = this.largura / 2;
    this.x = clamp(this.x, meio, ARENA - meio);
    if (Math.abs(this.vx) < 0.05) this.vx = 0;
  }

  // ------------------------------------------------------- execucao de golpe
  rodarGolpe(op, mundo) {
    const g = this.golpe;
    if (!g) { this.trocar('idle'); return; }
    const t = this.t;
    const fimStartup = g.startup;
    const fimAtivo = g.startup + g.ativo;
    const fim = fimAtivo + g.recovery;

    if (g.avanco && t <= fimAtivo) this.vx = this.dir * g.avanco * ESC * (g.tipo === 'dash' ? 1 : 0.9);
    else this.vx *= ATRITO;

    // disparo no primeiro frame ativo
    if (t === fimStartup + 1) {
      if (g.tipo === 'buff' && g.buff) {
        this.armadura = g.buff.armadura;
        this.armaduraT = g.buff.duracao;
        mundo.efeito('buff', this.x, this.y - this.altura * 0.5);
        mundo.texto(g.nome, '#5d8fc4');
      }
      if (g.tipo === 'armadilha') {
        mundo.porArmadilha(this, g.armadilhaDados);
      }
      if (g.tipo === 'detona') {
        mundo.detonarArmadilhas(this, g.detonaDano);
      }
      if (g.tipo === 'onda' && g.projetil) {
        mundo.disparar(this, g, g.projetil, 0);
        if (g.projetil.duplo) mundo.disparar(this, g, g.projetil, 0, -this.dir);
      }
      if (g.custoSuper > 0) mundo.texto(g.nome, this.ehJogador ? '#ffd23f' : '#ff4a32');
    }

    // fase ativa
    if (t > fimStartup && t <= fimAtivo) {
      this.fase = 'ativo';

      // projeteis multi-disparo espalhados ao longo do ativo
      if (g.tipo === 'projetil') {
        const n = g.hits || 1;
        const passo = Math.max(1, Math.floor(g.ativo / n));
        const i = t - fimStartup - 1;
        if (i % passo === 0 && this.hitsDados < n) {
          mundo.disparar(this, g, g.projetil, this.hitsDados);
          this.hitsDados++;
          this.acertou = true;
        }
      } else if (g.tipo === 'parry') {
        // janela de parry: tratada em mundo.resolverGolpes
      } else if (g.tipo !== 'buff' && g.tipo !== 'armadilha' && g.tipo !== 'dash' && g.dano > 0) {
        const n = g.hits || 1;
        const intervalo = Math.max(3, Math.floor(g.ativo / n));
        if (this.hitsDados < n && (t - fimStartup - 1) % intervalo === 0) {
          const hb = this.hitboxDe(g);
          if (op && op.vivo && colide(hb, op.hurtbox)) {
            const r = op.receber(g, this, mundo);
            if (r !== 'errou') {
              this.hitsDados++;
              this.acertou = true;
              if (g.tipo === 'agarrao' && r === 'acerto') {
                op.vx = this.dir * g.empurrao * ESC * 1.4;
                op.vy = -7;
                op.noChao = false;
              }
            }
          }
        }
      }
    } else if (t > fimAtivo) {
      this.fase = 'recovery';
    }

    if (t >= fim) {
      this.golpe = null;
      this.golpeId = null;
      this.fase = null;
      this.trocar(this.noChao ? 'idle' : 'pulo');
    }
  }
}

// ============================================================================
//  MUNDO (uma luta)
// ============================================================================
export class Mundo {
  constructor(idJogador, idInimigo, palco, dificuldade = 1, opcoes = {}) {
    this.palco = palco;
    this.p1 = new Lutador(idJogador, ARENA / 2 - 190, 1, true);
    this.p2 = new Lutador(idInimigo, ARENA / 2 + 190, -1, false, dificuldade);
    this.dificuldade = dificuldade;
    this.projeteis = [];
    this.armadilhas = [];
    this.efeitos = [];
    this.textos = [];
    this.hitstop = 0;
    this.tremor = 0;
    this.camera = ARENA / 2;
    // Camera vertical. Em escala de fliperama o pulo maximo leva a cabeca de
    // um lutador de 400px para fora da tela: os pes ficam em 325 e a cabeca
    // em -73. Em vez de baixar o pulo - que e o que torna o projetil
    // pulavel - a camera desce junto, como em qualquer fighter de arcade.
    this.cameraY = 0;
    this.frame = 0;
    this.round = opcoes.round || 1;
    this.placar = opcoes.placar || [0, 0];
    this.tempo = 99 * FPS;
    // intro | luta | finalize | fatality | fim
    this.fase = 'intro';
    this.faseT = 0;
    this.vencedor = null;
    // Finalizacao
    this.decisivo = false;        // este round decide a luta?
    this.finalizacao = null;      // a def do golpe, quando executada
    this.fatalT = 0;
    this.onSom = opcoes.onSom || (() => {});
    // Em versus o p2 vem do segundo teclado e a IA nao roda. E a unica
    // diferenca entre os dois modos - o resto do motor nao sabe qual e qual.
    this.duplo = !!opcoes.duplo;
    this.iaT = 0;
    this.iaPlano = null;
  }

  som(tipo) { this.onSom(tipo); }

  efeito(tipo, x, y, escala = 1) {
    this.efeitos.push({ tipo, x, y, t: 0, vida: tipo === 'acerto' ? 14 : 20, escala, ang: Math.random() * 6.28 });
  }

  // `opts.alto` desenha em cima, pequeno, acima da cabeca dos lutadores - e
  // onde vai o nome da finalizacao, que nao pode tapar a cena.
  texto(txt, cor, opts) { this.textos.push({ txt, cor, t: 0, vida: 70, ...opts }); }

  combo(quem, n) {
    const ja = this.textos.find((t) => t.combo);
    const msg = `${n} HITS`;
    if (ja) { ja.txt = msg; ja.t = 0; }
    else this.textos.push({ txt: msg, cor: quem.ehJogador ? '#ffd23f' : '#ff9a9a', t: 0, vida: 50, combo: true, pequeno: true });
  }

  disparar(dono, golpe, p, indice, forcaDir) {
    const dir = forcaDir != null ? forcaDir : dono.dir;
    // 0.47 e nao 0.55: o projetil sai na cintura, nao no peito. Com 0.55 ele
    // voava a 193px do chao e os dois lutadores mais pesados nao conseguiam
    // passar por cima nem no pulo maximo - "pule o projetil" so valia para
    // metade do elenco, que e o mesmo que nao valer.
    const y = p.rasteiro ? CHAO - 22 * ESC : dono.y - dono.altura * 0.47;
    const espalha = p.espalha ? (indice - 2) * 0.09 : 0;
    this.projeteis.push({
      x: dono.x + dir * 40 * ESC, y,
      vx: dir * p.vel * ESC, vy: (p.arco ? -3.2 - indice * 0.8 : espalha * -9) * ESC,
      arco: !!p.arco, rasteiro: !!p.rasteiro,
      raio: p.raio * ESC, cor: p.cor, dano: p.dano, altura: p.altura || 'alto',
      hitstun: p.hitstun || 18, lentidao: p.lentidao || 0,
      vida: p.vida, t: 0, dono, dir,
      golpe: { ...golpe, dano: p.dano, hitstun: p.hitstun || 18, altura: p.altura || 'alto', empurrao: 6, tipo: 'projetil', som: golpe.som },
    });
    this.som('projetil');
  }

  porArmadilha(dono, d) {
    const minhas = this.armadilhas.filter((a) => a.dono === dono);
    if (minhas.length >= d.max) this.armadilhas.splice(this.armadilhas.indexOf(minhas[0]), 1);
    this.armadilhas.push({ x: dono.x + dono.dir * 70 * ESC, y: CHAO, raio: d.raio * ESC, dano: d.dano, hitstun: d.hitstun, vida: d.vida, t: 0, dono, armada: 30 });
    this.efeito('buff', dono.x + dono.dir * 70 * ESC, CHAO - 10);
  }

  detonarArmadilhas(dono, dano) {
    const alvo = dono === this.p1 ? this.p2 : this.p1;
    let n = 0;
    for (const a of this.armadilhas.filter((a) => a.dono === dono)) {
      this.efeito('acerto', a.x, CHAO - 30, 1.4);
      if (Math.abs(alvo.x - a.x) < 140 * ESC) {
        alvo.receber({ dano, hitstun: 30, blockstun: 10, empurrao: 8, altura: 'medio', tipo: 'melee', som: 'super', ganhoSuper: 10 }, dono, this);
        n++;
      }
    }
    this.armadilhas = this.armadilhas.filter((a) => a.dono !== dono);
    if (n) this.tremor = 16;
  }

  // ---------------------------------------------------------------- update -
  atualizar(entrada, entrada2) {
    this.frame++;

    if (this.hitstop > 0) { this.hitstop--; this.decairEfeitos(); return; }
    if (this.tremor > 0) this.tremor *= 0.86;

    if (this.fase === 'intro') {
      this.faseT++;
      if (this.faseT > 100) { this.fase = 'luta'; this.texto('LUTEM!', '#ffd23f'); }
      this.decairEfeitos();
      return;
    }

    if (this.fase === 'fim') {
      this.faseT++;
      this.p1.atualizar(vazio(), this.p2, this);
      this.p2.atualizar(vazio(), this.p1, this);
      this.decairEfeitos();
      return;
    }

    // Janela de finalizacao. O vencedor continua jogando - anda, pula, bate -
    // e e por isso que ele consegue entrar a sequencia. O perdedor fica de pe,
    // atordoado, sem controle nenhum.
    if (this.fase === 'finalize') {
      this.faseT++;
      const [venc, perd] = this.dupla();
      venc.atualizar(this.vencedor === 'p1' ? entrada : (entrada2 || vazio()), perd, this);
      perd.atualizar(vazio(), venc, this);
      this.empurrarCorpos();
      this.atualizarProjeteis();
      this.atualizarCamera();
      this.decairEfeitos();
      if (this.faseT >= FINALIZE_FRAMES) this.semFinalizacao();
      return;
    }

    // Finalizacao em execucao: cena scriptada, ninguem controla nada.
    if (this.fase === 'fatality') {
      this.fatalT++;
      this.rodarFinalizacao();
      this.decairEfeitos();
      return;
    }

    // tempo
    if (this.tempo > 0) this.tempo--;
    if (this.tempo === 0) this.encerrar();

    const entP2 = this.duplo ? (entrada2 || vazio()) : this.pensarIA();
    this.p1.atualizar(entrada, this.p2, this);
    this.p2.atualizar(entP2, this.p1, this);

    this.empurrarCorpos();
    this.atualizarProjeteis();
    this.atualizarArmadilhas();
    this.atualizarCamera();
    this.decairEfeitos();

    if (!this.p1.vivo || !this.p2.vivo) this.encerrar();
  }

  empurrarCorpos() {
    const a = this.p1, b = this.p2;
    const d = b.x - a.x;
    const min = (a.largura + b.largura) * 0.38;
    if (Math.abs(d) < min && a.noChao && b.noChao) {
      const f = (min - Math.abs(d)) / 2 * Math.sign(d || 1);
      a.x -= f * 0.5; b.x += f * 0.5;
    }
  }

  atualizarProjeteis() {
    for (const p of this.projeteis) {
      p.t++;
      p.x += p.vx;
      p.y += p.vy;
      // Projetil em arco morre ao tocar o chao. Antes ele virava projetil
      // rasteiro e atravessava a arena inteira: a CHUVA DE PINHAO do chefao
      // sozinha era metade de todo o dano da luta e nunca deixava aproximar.
      if (p.arco) {
        p.vy += 0.16 * ESC;
        if (p.y > CHAO - 14 * ESC) { p.morto = true; this.efeito('acerto', p.x, CHAO - 14 * ESC, 0.7); }
      }
      const alvo = p.dono === this.p1 ? this.p2 : this.p1;
      const cx = { x: p.x - p.raio, y: p.y - p.raio, w: p.raio * 2, h: p.raio * 2 };
      if (alvo.vivo && colide(cx, alvo.hurtbox)) {
        const r = alvo.receber(p.golpe, p.dono, this);
        if (r === 'acerto' && p.lentidao) alvo.lentidao = p.lentidao;
        if (r !== 'errou') { p.morto = true; this.efeito('acerto', p.x, p.y); }
      }
      if (p.t > p.vida || p.x < 20 || p.x > ARENA - 20) p.morto = true;
    }
    this.projeteis = this.projeteis.filter((p) => !p.morto);
  }

  atualizarArmadilhas() {
    for (const a of this.armadilhas) {
      a.t++;
      if (a.armada > 0) { a.armada--; continue; }
      const alvo = a.dono === this.p1 ? this.p2 : this.p1;
      if (alvo.vivo && alvo.noChao && Math.abs(alvo.x - a.x) < a.raio + alvo.largura / 2) {
        alvo.receber({ dano: a.dano, hitstun: a.hitstun, blockstun: 12, empurrao: 6, altura: 'baixo', tipo: 'melee', som: 'pesado', ganhoSuper: 12 }, a.dono, this);
        this.efeito('acerto', a.x, CHAO - 26, 1.2);
        a.morta = true;
      }
      if (a.t > a.vida) a.morta = true;
    }
    this.armadilhas = this.armadilhas.filter((a) => !a.morta);
  }

  atualizarCamera() {
    const meio = (this.p1.x + this.p2.x) / 2;
    this.camera += (meio - this.camera) * 0.09;

    // Quanto a cabeca mais alta invade o topo, contando a margem do HUD.
    const teto = Math.min(this.p1.y - this.p1.altura, this.p2.y - this.p2.altura);
    const alvo = clamp(MARGEM_TOPO - teto, 0, CAMERA_Y_MAX);
    // Sobe rapido e desce devagar: a descida acompanhando a queda frame a
    // frame dava enjoo, e o que importa e nao cortar a cabeca na subida.
    this.cameraY += (alvo - this.cameraY) * (alvo > this.cameraY ? 0.22 : 0.06);
  }

  decairEfeitos() {
    for (const e of this.efeitos) e.t++;
    this.efeitos = this.efeitos.filter((e) => e.t < e.vida);
    for (const t of this.textos) t.t++;
    this.textos = this.textos.filter((t) => t.t < t.vida);
  }

  // [vencedor, perdedor] - so faz sentido depois de encerrar()
  dupla() {
    return this.vencedor === 'p1' ? [this.p1, this.p2] : [this.p2, this.p1];
  }

  encerrar() {
    if (this.fase !== 'luta') return;
    const a = this.p1, b = this.p2;
    const porKO = !a.vivo || !b.vivo;
    if (!a.vivo && !b.vivo) this.vencedor = 'empate';
    else if (!b.vivo) this.vencedor = 'p1';
    else if (!a.vivo) this.vencedor = 'p2';
    else this.vencedor = a.vida / a.vidaMax >= b.vida / b.vidaMax ? 'p1' : 'p2';

    if (this.vencedor === 'p1') this.placar[0]++;
    else if (this.vencedor === 'p2') this.placar[1]++;

    this.decisivo = this.placar[0] >= 2 || this.placar[1] >= 2;

    // Janela de finalizacao: so no round que decide a luta, so quando a vida
    // chegou a zero (tempo esgotado nao rende finalizacao) e so quando quem
    // venceu tem uma finalizacao definida. O chefao nao tem, de proposito - a
    // IA finalizando o jogador seria humilhacao sem agencia nenhuma.
    const [venc, perd] = this.vencedor === 'empate' ? [null, null] : this.dupla();
    if (this.decisivo && porKO && venc && venc.def.finalizacao && (venc.ehJogador || this.duplo)) {
      this.fase = 'finalize';
      this.faseT = 0;
      // Limpa o que sobrou do round. O LUTEM! vive 70 frames, entao um KO
      // rapido deixava ele na tela junto com o FINALIZE! - duas chamadas
      // brigando pela mesma cena.
      this.textos.length = 0;
      perd.trocar('atordoado');
      perd.vx = 0; perd.vy = 0; perd.y = CHAO; perd.noChao = true;
      perd.golpe = null; perd.invencivel = 0;
      // Quem escreve FINALIZE! na tela e o HUD (ui.js), com a sequencia e o
      // relogio junto. Um texto aqui ficava por cima dele.
      this.som('super');
      return;
    }

    this.fase = 'fim';
    this.faseT = 0;
    this.texto(this.vencedor === 'p1' ? 'K.O.' : this.vencedor === 'p2' ? 'DERROTA' : 'EMPATE',
      this.vencedor === 'p1' ? '#ffd23f' : '#ff4a32');
  }

  // Sequencia entrou a tempo. Chamado de fora (main.js le o teclado e o toque).
  finalizar() {
    if (this.fase !== 'finalize') return false;
    const [venc, perd] = this.dupla();
    this.finalizacao = venc.def.finalizacao;
    this.fase = 'fatality';
    this.textos.length = 0;
    this.fatalT = 0;
    venc.trocar('finalizando');
    venc.vx = 0;
    perd.vx = 0;
    // encosta os dois, e o vencedor olhando para o perdedor
    venc.dir = perd.x >= venc.x ? 1 : -1;
    this.som('super');
    return true;
  }

  // A janela fechou sem sequencia: nocaute padrao.
  semFinalizacao() {
    const [, perd] = this.dupla();
    perd.morrer(this);
    this.fase = 'fim';
    this.faseT = 0;
    this.texto(this.vencedor === 'p1' ? 'K.O.' : 'DERROTA',
      this.vencedor === 'p1' ? '#ffd23f' : '#ff4a32');
  }

  rodarFinalizacao() {
    const t = this.fatalT;
    const [venc, perd] = this.dupla();
    if (t === FATAL_ESCURECE) {
      // o golpe conecta
      this.som('ko');
      this.hitstop = 14;
      this.tremor = 30;
      this.efeito('acerto', perd.x, perd.y - perd.altura * 0.55, 2.6);
      this.texto(this.finalizacao.nome, COR_FINALIZACAO, { alto: true });
    }
    if (t === FATAL_ESCURECE + FATAL_GOLPE) {
      perd.trocar('ko');
      perd.vida = 0;
      perd.vy = -11;
      perd.vx = -perd.dir * 9 * ESC;
      this.tremor = 20;
    }
    if (t > FATAL_ESCURECE + FATAL_GOLPE) perd.atualizar(vazio(), venc, this);
    if (t >= FATAL_TOTAL) {
      this.fase = 'fim';
      this.faseT = 0;
    }
  }

  // -------------------------------------------------------------------- IA -
  pensarIA() {
    const eu = this.p2, op = this.p1;
    const cfg = eu.def.ia;
    const dist = Math.abs(op.x - eu.x);
    const perto = dist < 95 * eu.escala;
    const medio = dist < 190 * ESC;
    const agr = cfg.agressividade * (0.72 + this.dificuldade * 0.28);
    const reacao = Math.max(5, Math.round(cfg.reacao / Math.max(0.7, this.dificuldade)));

    if (this.iaT-- > 0 && this.iaPlano) return this.iaPlano;
    this.iaT = reacao;

    const e = vazio();
    if (!eu.vivo || this.fase !== 'luta') { this.iaPlano = e; return e; }

    const opAtacando = op.estado === 'ataque' && op.fase !== 'recovery';
    const ameaca = this.projeteis.some((p) => p.dono === op && Math.abs(p.x - eu.x) < 260 * ESC);

    // 1. defender - quanto cada arquetipo confia na defesa. O chefao tem valor
    // baixo de proposito: ele aguenta na armadura, nao na guarda. Um chefao que
    // bloqueia bem alem de bater forte nao tem como ser vencido.
    const tendDefesa = cfg.defesa != null ? cfg.defesa : 0.5;
    if ((opAtacando && perto) || ameaca) {
      if (Math.random() < tendDefesa + this.dificuldade * 0.12) {
        e.bloq = true;
        e.baixo = op.golpe && op.golpe.altura === 'baixo';
        this.iaPlano = e;
        return e;
      }
    }

    // 2. especial cheio e em alcance
    if (eu.super >= eu.superMax && (medio || eu.def.golpes.especial.tipo === 'projetil') && eu.podeUsar('especial')) {
      eu.bufferar('especial'); this.iaPlano = e; return e;
    }

    // 3. habilidade quando faz sentido
    const hab = eu.def.golpes.habilidade;
    if (eu.podeUsar('habilidade') && Math.random() < 0.5 + agr * 0.3) {
      const bom =
        hab.tipo === 'projetil' ? dist > 150 * ESC :
        hab.tipo === 'agarrao' ? perto && op.bloqueando :
        hab.tipo === 'parry' ? opAtacando && medio :
        hab.tipo === 'buff' ? eu.armadura <= 0 :
        hab.tipo === 'armadilha' ? dist > 120 * ESC :
        hab.tipo === 'dash' ? dist > 200 * ESC || opAtacando :
        dist > 120 * ESC && dist < 330 * ESC;
      if (bom) { eu.bufferar('habilidade'); this.iaPlano = e; return e; }
    }

    // 4. atacar
    if (perto && Math.random() < agr) {
      const r = Math.random();
      eu.bufferar(r < 0.5 ? 'soco' : r < 0.82 ? 'chute' : 'baixo');
      this.iaPlano = e; return e;
    }

    // 5. posicionar
    const alvo = cfg.distancia * ESC;
    if (dist > alvo + 30 * ESC) { if (op.x > eu.x) e.dir = true; else e.esq = true; }
    else if (dist < alvo - 40 * ESC) { if (op.x > eu.x) e.esq = true; else e.dir = true; }
    else if (Math.random() < 0.06) e.cima = true;

    this.iaPlano = e;
    return e;
  }
}

export function vazio() {
  return { esq: false, dir: false, cima: false, baixo: false, bloq: false };
}
