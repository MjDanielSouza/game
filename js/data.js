// ============================================================================
//  CURITIBA KOMBAT - dados do jogo
//  Tudo que define personagem, golpe, palco e mapa mora aqui.
//  Para criar um golpe novo: adicione uma entrada em `golpes` do lutador.
//  O motor (engine.js) nao precisa saber que ele existe.
// ============================================================================

// --- constantes de mundo ----------------------------------------------------
export const FPS = 60;
export const LARGURA = 1280;
export const ALTURA = 720;
export const CHAO = 600;           // y do piso
// Gravidade baixa de proposito: o pulo precisa de tempo de voo para dar para
// ler um projetil no ar e decidir. A 0.72 o pulo durava 0,6s e era reflexo,
// nao leitura. Projetil em arco tem gravidade propria (0.16 em engine.js) e
// nao muda com isto - o arco da CHUVA DE PINHAO continua o mesmo.
export const GRAVIDADE = 0.46;
export const ATRITO = 0.82;
export const ARENA = 1700;         // largura jogavel (a camera acompanha)

// Proporcao de fliperama. O lutador ocupa ~48% da altura da tela, como em
// fighter de arcade, em vez dos ~24% de antes. Multiplica altura, largura,
// hitbox e alcance junto - tudo em engine.js deriva daqui, entao a geometria
// relativa da luta nao muda, so a escala.
export const ESCALA_ARCADE = 2.6;
// Fator de comprimento. TUDO que tem unidade de pixel-de-mundo multiplica por
// aqui: velocidade, empurrao, avanco, projetil, raio de armadilha e as
// distancias com que a IA decide.
//
// Escalar so o corpo e a hitbox quebra a luta. Medido: o alcance do golpe
// dobrou e o passo continuou do mesmo tamanho, entao recuar deixou de ser
// resposta - o chefao foi de 18% para 2% de derrota e tres nos do meio
// inverteram de dificuldade. Comprimento e comprimento; ou escala tudo, ou
// nao escala nada.
//
// ALTURA, LARGURA e CHAO NAO escalam: sao a tela, que e fixa. Por isso a
// arena fica relativamente menor que antes, e isso muda o jogo de proposito -
// e o preco de por o lutador em tamanho de fliperama.
export const ESC = ESCALA_ARCADE / 1.3;
// Impulso de pulo, e a compressao da dispersao do stat `pulo`.
//
// Medido: com a dispersao crua (11,5 a 16,0) nao existe gravidade que sirva.
// A que faz o NEUMANN limpar um projetil faz o RAFAEL pular 69% da altura da
// tela; a que segura o RAFAEL deixa o NEUMANN com 3 frames de janela, que e
// reacao, nao leitura. Comprimir em torno da media resolve os dois de uma vez
// e mantem a ordem - quem pula mais continua pulando mais.
//
// `pulo` em data.js continua significando "quanto este lutador pula em
// relacao aos outros"; o quanto isso vira pixel na tela se decide aqui.
export const PULO_MEDIO = 13.1;
export const PULO_COMPRESSAO = 0.55;
export const IMPULSO_PULO = 1.32;
export const impulsoDe = (d) =>
  (PULO_MEDIO + (d.stats.pulo - PULO_MEDIO) * PULO_COMPRESSAO) * IMPULSO_PULO;

// --- molde de golpe ---------------------------------------------------------
// startup  : frames ate a hitbox ficar ativa
// ativo    : frames com hitbox no ar
// recovery : frames travado depois
// alcance  : caixa relativa ao lutador. x cresce para a frente.
// altura   : 'alto' exige defesa em pe, 'baixo' exige defesa agachada
// cancela  : ids de golpes que podem interromper este depois de acertar
const golpe = (o) => Object.assign({
  tipo: 'melee', startup: 6, ativo: 3, recovery: 12,
  dano: 8, hitstun: 16, blockstun: 8, empurrao: 4,
  stamina: 8, ganhoSuper: 9, custoSuper: 0,
  alcance: { x: 24, y: -56, w: 44, h: 22 },
  altura: 'alto', cancela: [], armadura: 0, avanco: 0,
  cooldown: 0, hits: 1, pose: 'soco', invencivel: 0, som: 'leve',
}, o);

// ============================================================================
//  PALCOS
// ============================================================================
export const PALCOS = {
  botanico: {
    nome: 'Jardim Botanico', hora: 'amanhecer',
    ceu: ['#f7b7a3', '#f6d5b3', '#cfe3c4'],
    fundo: '#3c6b4f', meio: '#2c5340', frente: '#17321f',
    chao: '#8a7b5c', chaoLinha: '#6d6045', nevoa: 'rgba(255,225,215,0.26)',
    luz: '#ffd9b0', silhueta: 'estufa',
  },
  largo: {
    nome: 'Largo da Ordem', hora: 'noite depois da chuva',
    ceu: ['#10121c', '#1e2030', '#3a2c2a'],
    fundo: '#4a3a30', meio: '#33261f', frente: '#140f0c',
    chao: '#3b332e', chaoLinha: '#57483f', nevoa: 'rgba(255,190,90,0.10)',
    luz: '#ffb84d', silhueta: 'igreja',
  },
  barigui: {
    nome: 'Parque Barigui', hora: 'tarde',
    ceu: ['#7fc4e8', '#a9dcf0', '#dff0dc'],
    fundo: '#4e7f4a', meio: '#37633a', frente: '#1d3a22',
    chao: '#7f9b5e', chaoLinha: '#64804a', nevoa: 'rgba(255,255,255,0.13)',
    luz: '#fff2c4', silhueta: 'lago',
  },
  tubo: {
    nome: 'Estacao Tubo', hora: 'hora do rush',
    ceu: ['#20242e', '#39404f', '#5b5f6b'],
    fundo: '#6f7784', meio: '#4b525d', frente: '#23272f',
    chao: '#52575f', chaoLinha: '#7d848f', nevoa: 'rgba(255,140,40,0.12)',
    luz: '#ff8a2b', silhueta: 'tubo',
  },
  japao: {
    nome: 'Praca do Japao', hora: 'primavera',
    ceu: ['#f2c6d8', '#f8dbe6', '#e7eff0'],
    fundo: '#c76e9a', meio: '#9c4f76', frente: '#4a2b3c',
    chao: '#9e8f86', chaoLinha: '#83756c', nevoa: 'rgba(255,220,235,0.28)',
    luz: '#ffd9e8', silhueta: 'torii',
  },
  opera: {
    nome: 'Opera de Arame', hora: 'noite de espetaculo',
    ceu: ['#08110e', '#12231c', '#1d3a2c'],
    fundo: '#24503c', meio: '#173525', frente: '#0a1610',
    chao: '#a37a4a', chaoLinha: '#8a6236', nevoa: 'rgba(255,200,120,0.12)',
    luz: '#ffcf7a', silhueta: 'opera',
  },
  niemeyer: {
    nome: 'Museu Oscar Niemeyer', hora: 'entardecer',
    ceu: ['#2b3350', '#63527a', '#d4885f'],
    fundo: '#d9d4cc', meio: '#8e8880', frente: '#2a2724',
    chao: '#6d6963', chaoLinha: '#8b867e', nevoa: 'rgba(255,190,140,0.16)',
    luz: '#ffc07a', silhueta: 'olho',
  },
  torre: {
    nome: 'Torre Panoramica', hora: 'madrugada',
    ceu: ['#080b14', '#121a2c', '#2b2438'],
    fundo: '#232c40', meio: '#151b28', frente: '#080b12',
    chao: '#2a2f3a', chaoLinha: '#404757', nevoa: 'rgba(150,180,255,0.09)',
    luz: '#8fc5ff', silhueta: 'torre',
  },
  pedreira: {
    nome: 'Pedreira Paulo Leminski', hora: 'tempestade',
    ceu: ['#0b0a0f', '#2a1418', '#5e1f1c'],
    fundo: '#4a4038', meio: '#2e2823', frente: '#100d0b',
    chao: '#3a332c', chaoLinha: '#574d41', nevoa: 'rgba(255,60,40,0.13)',
    luz: '#ff4a32', silhueta: 'pedreira',
  },
};

// ============================================================================
//  DICAS - aparecem na tela de carregamento
//  Regra, nao elogio: cada uma tem que ser algo que muda como se joga.
// ============================================================================
export const DICAS = [
  'Golpe <b>alto</b> so e bloqueado em pe. Golpe <b>baixo</b> so agachado. Errar a altura e levar o golpe inteiro.',
  '<b>Agarrao nao e bloqueavel.</b> E a resposta para quem trava na defesa.',
  'Bloquear gasta stamina. <b>Stamina zerada quebra a defesa</b> e te deixa parado.',
  'Quem esta com <b>armadura</b> nao recua. Golpe avulso nao interrompe: precisa de combo.',
  'Voce ganha barra de super <b>apanhando, batendo e bloqueando</b>. Apanhar nao e so perder.',
  '<b>Pule o projetil.</b> O pulo tem tempo de voo longo de proposito - da para ler e decidir.',
  'Cada golpe tem <b>recovery</b>: a janela depois do ataque em que quem errou apanha.',
  'Ganhou o round decisivo por nocaute? <b>Voce tem 5 segundos para finalizar.</b> A sequencia esta na ficha do seu lutador.',
  'Pontos vem de <b>vida que sobrou, tempo, especiais usados e finalizacao</b>. Ganhar raspando vale pouco.',
  'O chefao <b>recarrega a armadura a cada 2,4s</b>. A janela de combo e logo depois de ele gastar.',
];

// ============================================================================
//  LUTADORES
//  cor.pele / roupa / detalhe / acento -> paleta do rig
//  cabeca.tipo -> desenho do topo (gorro, capacete, careca, bucket, oculos...)
// ============================================================================
export const LUTADORES = {

  // -------------------------------------------------------------- LUCAS ----
  lucas: {
    id: 'lucas', nome: 'LUCAS', titulo: 'O EQUILIBRADO', arquetipo: 'All-rounder',
    bio: 'Sem fraqueza e sem exagero. Se voce nao sabe com quem jogar, jogue com ele.',
    dica: 'Jogue o perfume no caminho dele. Com os controles trocados, ninguem bloqueia direito.',
    cor: { pele: '#c98d63', roupa: '#8c5a3c', detalhe: '#e8dcc8', acento: '#f0a04b' },
    cabeca: { tipo: 'cabelo', cor: '#2b1d16' },
    fisico: { escala: 1.0, bulk: 1.0 },
    // Tem arte: js/sprites.js carrega assets/lucas.png. As chaves de golpe
    // (habilidade/especial/aereo) sao o *id* do golpe, nao a pose - e assim
    // que frameDe() resolve, tentando id -> pose -> soco -> idle.
    sprite: {
      frames: {
        idle: 0, andar: [1, 2], soco: 3, chute: 4,
        baixo: 5, agachar: 5, bloqueio: 6, hitstun: 7, ko: 7,
        pulo: 8, aereo: 9, habilidade: 10, especial: 11,
      },
    },
    stats: { vida: 100, velocidade: 3.0, pulo: 13.2, stamina: 100, regen: 0.45, peso: 1.0, defesa: 1.0 },
    ia: { agressividade: 0.55, distancia: 90, reacao: 14, defesa: 0.50 },
    // Finalizacao (Sprint 2). So vale no round que decide a luta e so
    // por KO - tempo esgotado nao rende finalizacao.
    finalizacao: { nome: 'PONTO FINAL', sequencia: ['baixo', 'baixo', 'soco'], cor: '#ffd23f' },
    golpes: {
      soco: golpe({ nome: 'Jab', startup: 4, ativo: 3, recovery: 8, dano: 6, stamina: 5, cancela: ['chute', 'baixo', 'habilidade', 'especial'] }),
      chute: golpe({ nome: 'Chute Alto', startup: 9, ativo: 4, recovery: 16, dano: 13, hitstun: 20, empurrao: 7, stamina: 13, pose: 'chute', alcance: { x: 28, y: -44, w: 54, h: 26 }, cancela: ['especial'], som: 'pesado' }),
      baixo: golpe({ nome: 'Rasteira', startup: 7, ativo: 4, recovery: 15, dano: 9, altura: 'baixo', stamina: 10, pose: 'baixo', alcance: { x: 22, y: -18, w: 52, h: 18 }, cancela: ['especial'] }),
      aereo: golpe({ nome: 'Joelhada Aerea', startup: 5, ativo: 8, recovery: 6, dano: 10, stamina: 8, pose: 'aereo', alcance: { x: 18, y: -34, w: 44, h: 36 } }),
      habilidade: golpe({
        // Nuvem: fica no ar e inverte os controles de quem encostar. Nao mata,
        // desorganiza - e a unica ferramenta do jogo que ataca o INPUT do
        // outro em vez da vida dele. Bloquear evita: e a contrapartida.
        nome: 'PERFUME TOXICO', tipo: 'nuvem', startup: 12, ativo: 4, recovery: 22,
        dano: 0, stamina: 14, cooldown: 190, ganhoSuper: 14, pose: 'habilidade',
        nuvemDados: {
          dist: 95, altura: 105, raio: 46, vida: 120, dano: 3, cor: '#b6f05a',
          efeitos: { inverter: 180 },
        },
        som: 'buff',
      }),
      especial: golpe({
        nome: 'SEQUENCIA COMPLETA', startup: 8, ativo: 26, recovery: 24,
        dano: 9, hits: 4, hitstun: 12, empurrao: 2, custoSuper: 100, stamina: 0,
        avanco: 3.2, armadura: 1, pose: 'especial', alcance: { x: 24, y: -50, w: 60, h: 40 }, som: 'super',
      }),
    },
  },

  // --------------------------------------------------------------- JOAO ----
  joao: {
    id: 'joao', nome: 'JOAO', titulo: 'O BRIGA DE RUA', arquetipo: 'Brawler',
    bio: 'Dano absurdo de perto. O problema e chegar perto - e a stamina acabar antes.',
    dica: 'A toca bate na ida e na volta. Quem foge dela para tras anda direto no segundo acerto.',
    cor: { pele: '#b97a52', roupa: '#1a1a1e', detalhe: '#c62b2b', acento: '#e0533a' },
    cabeca: { tipo: 'gorro', cor: '#c62b2b' },
    fisico: { escala: 1.06, bulk: 1.2 },
    sprite: {
      frames: {
        idle: 0, andar: [1, 2], soco: 3, chute: 4,
        baixo: 5, agachar: 5, bloqueio: 6, hitstun: 7, ko: 7,
        pulo: 8, aereo: 9, habilidade: 10, especial: 11,
      },
    },
    stats: { vida: 115, velocidade: 2.7, pulo: 12.0, stamina: 100, regen: 0.40, peso: 1.25, defesa: 1.05 },
    ia: { agressividade: 0.82, distancia: 55, reacao: 17, defesa: 0.38 },
    // Finalizacao (Sprint 2). So vale no round que decide a luta e so
    // por KO - tempo esgotado nao rende finalizacao.
    finalizacao: { nome: 'ULTIMA RODADA', sequencia: ['esq', 'dir', 'soco'], cor: '#e8563f' },
    golpes: {
      soco: golpe({ nome: 'Direto', startup: 5, ativo: 3, recovery: 10, dano: 8, stamina: 7, cancela: ['chute', 'habilidade', 'especial'] }),
      chute: golpe({ nome: 'Cotovelada', startup: 12, ativo: 4, recovery: 20, dano: 18, hitstun: 24, empurrao: 9, stamina: 18, pose: 'chute', alcance: { x: 20, y: -52, w: 46, h: 30 }, armadura: 1, cancela: ['especial'], som: 'pesado' }),
      baixo: golpe({ nome: 'Chute Baixo', startup: 8, ativo: 4, recovery: 16, dano: 11, altura: 'baixo', stamina: 12, pose: 'baixo', alcance: { x: 20, y: -18, w: 46, h: 18 } }),
      aereo: golpe({ nome: 'Bomba', startup: 6, ativo: 10, recovery: 8, dano: 13, stamina: 10, pose: 'aereo', alcance: { x: 12, y: -28, w: 46, h: 40 } }),
      habilidade: golpe({
        // Bumerangue: bate na ida, inverte em `retorno` e bate de novo na
        // volta. `atravessa` e o que deixa ele sobreviver ao primeiro acerto.
        nome: 'TOCA SERRILHADA', tipo: 'projetil', startup: 13, ativo: 3, recovery: 26,
        dano: 0, stamina: 15, cooldown: 165, ganhoSuper: 12, pose: 'habilidade',
        projetil: {
          vel: 6.4, dano: 9, vida: 260, raio: 15, cor: '#d8cbb2', altura: 'alto',
          hitstun: 18, retorno: 190, atravessa: true,
        },
        som: 'projetil',
      }),
      especial: golpe({
        nome: 'BORDOADA', startup: 14, ativo: 6, recovery: 30,
        dano: 42, hitstun: 40, empurrao: 16, custoSuper: 100, stamina: 0,
        avanco: 4.5, armadura: 2, pose: 'especial', alcance: { x: 18, y: -56, w: 66, h: 52 }, som: 'super',
      }),
    },
  },

  // ------------------------------------------------------------ JULIANO ----
  juliano: {
    id: 'juliano', nome: 'JULIANO', titulo: 'A MARE', arquetipo: 'Rushdown',
    bio: 'O mais rapido do elenco e o mais fragil. Ou ele te atropela, ou cai em dois golpes.',
    dica: 'O TRANCO e anti-aereo: dobra o dano em quem esta no ar. Guarde para o pulo dele.',
    cor: { pele: '#c98559', roupa: '#f2e8d5', detalhe: '#2aa6a0', acento: '#f4c95d' },
    cabeca: { tipo: 'bucket', cor: '#f2e8d5' },
    fisico: { escala: 0.96, bulk: 0.88 },
    sprite: {
      frames: {
        idle: 0, andar: [1, 2], soco: 3, chute: 4,
        baixo: 5, agachar: 5, bloqueio: 6, hitstun: 7, ko: 7,
        pulo: 8, aereo: 9, habilidade: 10, especial: 11,
      },
    },
    stats: { vida: 82, velocidade: 4.2, pulo: 15.0, stamina: 110, regen: 0.55, peso: 0.85, defesa: 0.9 },
    ia: { agressividade: 0.95, distancia: 60, reacao: 11, defesa: 0.32 },
    // Finalizacao (Sprint 2). So vale no round que decide a luta e so
    // por KO - tempo esgotado nao rende finalizacao.
    finalizacao: { nome: 'MARE VAZANTE', sequencia: ['dir', 'dir', 'chute'], cor: '#5d8fc4' },
    golpes: {
      soco: golpe({ nome: 'Tapa', startup: 3, ativo: 3, recovery: 6, dano: 5, stamina: 4, hitstun: 13, cancela: ['soco', 'chute', 'baixo', 'habilidade', 'especial'] }),
      chute: golpe({ nome: 'Chute Giratorio', startup: 8, ativo: 5, recovery: 15, dano: 12, hitstun: 19, stamina: 12, pose: 'chute', alcance: { x: 26, y: -48, w: 52, h: 28 }, cancela: ['especial'], som: 'pesado' }),
      baixo: golpe({ nome: 'Deslize', startup: 6, ativo: 6, recovery: 14, dano: 9, altura: 'baixo', stamina: 9, avanco: 3.0, pose: 'baixo', alcance: { x: 24, y: -16, w: 56, h: 16 } }),
      aereo: golpe({ nome: 'Pe no Peito', startup: 4, ativo: 8, recovery: 6, dano: 10, stamina: 7, pose: 'aereo', alcance: { x: 22, y: -32, w: 44, h: 34 } }),
      habilidade: golpe({
        // Anti-aereo: hitbox alta e dano dobrado em quem esta no ar. E o golpe
        // que pune pulo - no chao ele e medianico de proposito.
        nome: 'TRANCO', startup: 6, ativo: 8, recovery: 26,
        dano: 11, hitstun: 30, empurrao: 10, stamina: 16, cooldown: 120,
        ganhoSuper: 16, danoAereo: 2.0, invencivel: 8, avanco: 1.2,
        alcance: { x: 14, y: -128, w: 46, h: 132 },
        pose: 'habilidade', som: 'pesado',
      }),
      especial: golpe({
        nome: 'MARE ALTA', startup: 7, ativo: 34, recovery: 26,
        dano: 7, hits: 6, hitstun: 10, empurrao: 1, custoSuper: 100, stamina: 0,
        avanco: 4.0, pose: 'especial', alcance: { x: 20, y: -52, w: 56, h: 44 }, som: 'super',
      }),
    },
  },

  // ------------------------------------------------------------ NEUMANN ----
  neumann: {
    id: 'neumann', nome: 'NEUMANN', titulo: 'O VETERANO', arquetipo: 'Tanque',
    bio: 'Lento, imenso e dificil de derrubar. Nao recua quando apanha. Cada golpe dele doi.',
    dica: 'O agarrao dele ignora a defesa. Nao trave bloqueando: ande, pule, saia de perto.',
    cor: { pele: '#b8845e', roupa: '#33373d', detalhe: '#9aa3ad', acento: '#5d8fc4' },
    cabeca: { tipo: 'careca', cor: '#b0b0aa' },
    fisico: { escala: 1.16, bulk: 1.45 },
    sprite: {
      frames: {
        idle: 0, andar: [1, 2], soco: 3, chute: 4,
        baixo: 5, agachar: 5, bloqueio: 6, hitstun: 7, ko: 7,
        pulo: 8, aereo: 9, habilidade: 10, especial: 11,
      },
    },
    // pulo 10.2 -> 11.5: continua o mais baixo do elenco, mas agora limpa um
    // projetil. Abaixo disto o NEUMANN nao tinha resposta nenhuma para zoner,
    // nem por cima nem por baixo.
    stats: { vida: 145, velocidade: 2.2, pulo: 11.5, stamina: 120, regen: 0.35, peso: 1.6, defesa: 1.12 },
    ia: { agressividade: 0.6, distancia: 70, reacao: 20, defesa: 0.42 },
    // Finalizacao (Sprint 2). So vale no round que decide a luta e so
    // por KO - tempo esgotado nao rende finalizacao.
    finalizacao: { nome: 'HORA EXTRA', sequencia: ['baixo', 'baixo', 'chute'], cor: '#9aa0ad' },
    golpes: {
      soco: golpe({ nome: 'Empurrao', startup: 6, ativo: 4, recovery: 12, dano: 9, empurrao: 8, stamina: 8, alcance: { x: 26, y: -62, w: 48, h: 26 }, cancela: ['chute', 'habilidade', 'especial'] }),
      chute: golpe({ nome: 'Pisao', startup: 14, ativo: 5, recovery: 22, dano: 21, hitstun: 26, empurrao: 10, stamina: 20, pose: 'chute', armadura: 1, alcance: { x: 24, y: -36, w: 58, h: 36 }, cancela: ['especial'], som: 'pesado' }),
      baixo: golpe({ nome: 'Varrida', startup: 10, ativo: 5, recovery: 20, dano: 13, altura: 'baixo', stamina: 14, pose: 'baixo', alcance: { x: 22, y: -18, w: 60, h: 18 } }),
      aereo: golpe({ nome: 'Queda Livre', startup: 7, ativo: 12, recovery: 10, dano: 15, stamina: 12, pose: 'aereo', alcance: { x: 10, y: -26, w: 52, h: 44 } }),
      habilidade: golpe({
        // Agarrao de dois tempos: o primeiro acerto joga para cima, o segundo
        // pega no ar e manda para o outro lado. Por isso a hitbox e alta e o
        // `ativo` e longo - o segundo acerto precisa alcancar quem ja subiu.
        nome: 'HORA DO CAFE', tipo: 'agarrao', startup: 9, ativo: 26, recovery: 34,
        dano: 9, hits: 2, hitstun: 26, empurrao: 6, stamina: 20, cooldown: 175,
        ganhoSuper: 15, arremesso: { subida: 16, lancamento: 20 },
        alcance: { x: 8, y: -120, w: 56, h: 130 },
        pose: 'habilidade', som: 'pesado',
      }),
      especial: golpe({
        nome: 'FIM DE EXPEDIENTE', tipo: 'onda', startup: 16, ativo: 6, recovery: 32,
        dano: 34, hitstun: 38, empurrao: 14, custoSuper: 100, stamina: 0, armadura: 3,
        pose: 'pound', alcance: { x: 10, y: -20, w: 50, h: 34 },
        projetil: { vel: 9, dano: 22, vida: 80, raio: 34, cor: '#9aa3ad', altura: 'baixo', rasteiro: true, hitstun: 26 },
        som: 'super',
      }),
    },
  },

  // -------------------------------------------------------- RAFAEL LATA ----
  rafael: {
    id: 'rafael', nome: 'RAFAEL LATA', titulo: 'LADEIRA ABAIXO', arquetipo: 'Zoner',
    bio: 'O mais dificil de acertar. Atravessa o oponente, reposiciona e pune pelas costas.',
    dica: 'O capacete volta. Depois de desviar da ida, o segundo acerto vem pelas costas dele.',
    cor: { pele: '#c08a5f', roupa: '#2d3e50', detalhe: '#f2f2f2', acento: '#ffd23f' },
    cabeca: { tipo: 'capacete', cor: '#ffd23f' },
    fisico: { escala: 0.99, bulk: 0.94 },
    sprite: {
      frames: {
        idle: 0, andar: [1, 2], soco: 3, chute: 4,
        baixo: 5, agachar: 5, bloqueio: 6, hitstun: 7, ko: 7,
        pulo: 8, aereo: 9, habilidade: 10, especial: 11,
      },
    },
    stats: { vida: 92, velocidade: 3.9, pulo: 16.0, stamina: 105, regen: 0.5, peso: 0.9, defesa: 0.95 },
    ia: { agressividade: 0.7, distancia: 110, reacao: 12, defesa: 0.52 },
    // Finalizacao (Sprint 2). So vale no round que decide a luta e so
    // por KO - tempo esgotado nao rende finalizacao.
    finalizacao: { nome: 'SEM FREIO', sequencia: ['dir', 'esq', 'chute'], cor: '#f0a04b' },
    golpes: {
      soco: golpe({ nome: 'Cutucada', startup: 3, ativo: 3, recovery: 6, dano: 6, stamina: 5, cancela: ['chute', 'baixo', 'habilidade', 'especial'] }),
      chute: golpe({ nome: 'Voadora', startup: 8, ativo: 5, recovery: 13, dano: 14, hitstun: 20, empurrao: 8, stamina: 14, avanco: 5, pose: 'chute', alcance: { x: 28, y: -46, w: 56, h: 26 }, cancela: ['especial'], som: 'pesado' }),
      baixo: golpe({ nome: 'Corta-Pe', startup: 6, ativo: 4, recovery: 11, dano: 9, altura: 'baixo', stamina: 10, pose: 'baixo', alcance: { x: 22, y: -16, w: 50, h: 16 } }),
      aereo: golpe({ nome: 'Mergulho', startup: 4, ativo: 10, recovery: 7, dano: 12, stamina: 9, pose: 'aereo', alcance: { x: 20, y: -30, w: 46, h: 38 } }),
      habilidade: golpe({
        // O capacete vai e volta. Cobre mais espaco que um projetil comum, mas
        // deixa o RAFAEL parado no recovery - e a troca.
        nome: 'CAPACETE VOADOR', tipo: 'projetil', startup: 12, ativo: 3, recovery: 24,
        dano: 0, stamina: 14, cooldown: 150, ganhoSuper: 12, pose: 'habilidade',
        projetil: {
          vel: 7.2, dano: 8, vida: 280, raio: 16, cor: '#c9d3dc', altura: 'alto',
          hitstun: 16, retorno: 230, atravessa: true,
        },
        som: 'projetil',
      }),
      especial: golpe({
        // Multi-acerto: era o unico especial do elenco que batia uma vez so,
        // enquanto o LUCAS bate 4, o JULIANO 6 e o VINICIUS joga 5 projeteis.
        // Isso sozinho explicava os 8,1 acertos por luta dele contra os 14,2
        // do LUCAS. Uma investida que atravessa a tela tem que atropelar.
        nome: 'CAPACETE DE ACO', startup: 12, ativo: 20, recovery: 28,
        dano: 15, hits: 3, hitstun: 36, empurrao: 15, custoSuper: 100, stamina: 0,
        avanco: 13.0, armadura: 2, pose: 'especial', alcance: { x: 20, y: -52, w: 54, h: 44 }, som: 'super',
      }),
    },
  },

  // ----------------------------------------------------------- VINICIUS ----
  vinicius: {
    id: 'vinicius', nome: 'VINICIUS', titulo: 'A GEADA', arquetipo: 'Zoner',
    bio: 'Controla a distancia. Quem tenta atravessar de qualquer jeito congela no meio do caminho.',
    dica: 'A GEADA congela por 1,5s. Ela quase nao tira vida: o que ela compra e tempo.',
    cor: { pele: '#c68f66', roupa: '#1f2933', detalhe: '#7fb7d9', acento: '#bfe6f5' },
    cabeca: { tipo: 'gorro', cor: '#1f2933' },
    fisico: { escala: 1.02, bulk: 0.98 },
    sprite: {
      frames: {
        idle: 0, andar: [1, 2], soco: 3, chute: 4,
        baixo: 5, agachar: 5, bloqueio: 6, hitstun: 7, ko: 7,
        pulo: 8, aereo: 9, habilidade: 10, especial: 11,
      },
    },
    stats: { vida: 88, velocidade: 2.9, pulo: 12.4, stamina: 100, regen: 0.45, peso: 1.0, defesa: 0.95 },
    ia: { agressividade: 0.35, distancia: 250, reacao: 13, defesa: 0.62 },
    // Finalizacao (Sprint 2). So vale no round que decide a luta e so
    // por KO - tempo esgotado nao rende finalizacao.
    finalizacao: { nome: 'ZERO ABSOLUTO', sequencia: ['baixo', 'dir', 'habilidade'], cor: '#8fd8ff' },
    golpes: {
      soco: golpe({ nome: 'Soco Longo', startup: 5, ativo: 3, recovery: 11, dano: 6, stamina: 6, alcance: { x: 28, y: -56, w: 58, h: 20 }, cancela: ['chute', 'habilidade', 'especial'] }),
      chute: golpe({ nome: 'Chute Estendido', startup: 11, ativo: 5, recovery: 19, dano: 13, hitstun: 20, empurrao: 10, stamina: 14, pose: 'chute', alcance: { x: 30, y: -44, w: 74, h: 22 }, cancela: ['especial'], som: 'pesado' }),
      baixo: golpe({ nome: 'Rasteira Longa', startup: 8, ativo: 5, recovery: 18, dano: 9, altura: 'baixo', stamina: 11, pose: 'baixo', alcance: { x: 24, y: -16, w: 68, h: 16 } }),
      aereo: golpe({ nome: 'Pisada', startup: 6, ativo: 9, recovery: 8, dano: 11, stamina: 9, pose: 'aereo', alcance: { x: 16, y: -28, w: 44, h: 38 } }),
      habilidade: golpe({
        // Dano quase nenhum: o que vale e o congelamento. Um acerto compra 1,5s
        // de alguem parado, que e tempo de chegar perto ou de montar combo.
        nome: 'GEADA', tipo: 'projetil', startup: 11, ativo: 3, recovery: 24,
        dano: 0, stamina: 15, cooldown: 165, ganhoSuper: 12, pose: 'habilidade',
        projetil: {
          vel: 7.0, dano: 4, vida: 170, raio: 16, cor: '#8fd8ff', altura: 'alto',
          hitstun: 10, efeitos: { congelar: 90 },
        },
        som: 'projetil',
      }),
      especial: golpe({
        nome: 'NEVASCA', tipo: 'projetil', startup: 14, ativo: 30, recovery: 30,
        dano: 0, custoSuper: 100, stamina: 0, hits: 5, pose: 'especial',
        projetil: { vel: 11, dano: 9, vida: 150, raio: 20, cor: '#eafaff', altura: 'alto', lentidao: 60, hitstun: 14, espalha: true },
        som: 'super',
      }),
    },
  },

  // ------------------------------------------------------------ COSTELA ----
  costela: {
    id: 'costela', nome: 'COSTELA', titulo: 'O CEREBRO', arquetipo: 'Tecnico',
    bio: 'Nao ganha na porrada, ganha no setup. Cada armadilha no chao e uma pergunta que o outro tem que responder.',
    dica: 'A costela cai em arco e queima por 2s. Pressione enquanto o outro perde vida sozinho.',
    cor: { pele: '#c1875c', roupa: '#e0632a', detalhe: '#2b2b30', acento: '#ffd166' },
    cabeca: { tipo: 'oculos', cor: '#3a2a1f' },
    fisico: { escala: 1.0, bulk: 0.96 },
    sprite: {
      frames: {
        idle: 0, andar: [1, 2], soco: 3, chute: 4,
        baixo: 5, agachar: 5, bloqueio: 6, hitstun: 7, ko: 7,
        pulo: 8, aereo: 9, habilidade: 10, especial: 11,
      },
    },
    stats: { vida: 90, velocidade: 3.1, pulo: 13.0, stamina: 100, regen: 0.48, peso: 0.95, defesa: 0.95 },
    ia: { agressividade: 0.45, distancia: 165, reacao: 13, defesa: 0.58 },
    // Finalizacao (Sprint 2). So vale no round que decide a luta e so
    // por KO - tempo esgotado nao rende finalizacao.
    finalizacao: { nome: 'CONTA FECHADA', sequencia: ['esq', 'baixo', 'habilidade'], cor: '#3ad07a' },
    golpes: {
      soco: golpe({ nome: 'Jab Tecnico', startup: 4, ativo: 3, recovery: 9, dano: 6, stamina: 5, cancela: ['chute', 'baixo', 'habilidade', 'especial'] }),
      chute: golpe({ nome: 'Chute Calculado', startup: 10, ativo: 4, recovery: 17, dano: 13, hitstun: 20, empurrao: 7, stamina: 13, pose: 'chute', alcance: { x: 28, y: -46, w: 54, h: 24 }, cancela: ['especial'], som: 'pesado' }),
      baixo: golpe({ nome: 'Tesoura', startup: 8, ativo: 5, recovery: 16, dano: 10, altura: 'baixo', stamina: 11, pose: 'baixo', alcance: { x: 22, y: -16, w: 54, h: 16 } }),
      aereo: golpe({ nome: 'Cotovelo Aereo', startup: 5, ativo: 9, recovery: 7, dano: 11, stamina: 8, pose: 'aereo', alcance: { x: 18, y: -30, w: 44, h: 36 } }),
      habilidade: golpe({
        // Arco com gravidade propria: passa por cima de quem esta agachado e
        // cai. Quem toma queima por 2s. A queimadura nunca mata - leva a 1.
        nome: 'COSTELA NA BRASA', tipo: 'projetil', startup: 14, ativo: 3, recovery: 26,
        dano: 0, stamina: 15, cooldown: 175, ganhoSuper: 13, pose: 'habilidade',
        projetil: {
          vel: 5.6, dano: 7, vida: 200, raio: 17, cor: '#e8853f', altura: 'alto',
          hitstun: 16, arco: true, efeitos: { queimar: { dano: 2, frames: 120 } },
        },
        som: 'projetil',
      }),
      especial: golpe({
        // Era XEQUE-MATE, que detonava as armadilhas. A habilidade deixou de
        // por armadilha, entao o especial detonava o que nunca existia - ficava
        // morto na barra cheia. Virou a mesma ideia da habilidade em barragem:
        // tres costelas em arco, todas queimando.
        nome: 'CHURRASCO COMPLETO', tipo: 'projetil', startup: 14, ativo: 26, recovery: 34,
        dano: 0, hits: 3, custoSuper: 100, stamina: 0, ganhoSuper: 0,
        pose: 'especial',
        projetil: {
          vel: 6.0, dano: 12, vida: 220, raio: 19, cor: '#ff9d4a', altura: 'alto',
          hitstun: 26, arco: true, efeitos: { queimar: { dano: 3, frames: 150 } },
        },
        som: 'super',
      }),
    },
  },

  // ======================== CHEFAO ========================================
  // -------------------------------------------------------------- DANIEL ----
  daniel: {
    id: 'daniel', nome: 'DANIEL', titulo: 'O DIRETOR', arquetipo: 'Sabotador',
    bio: 'Anda devagar e atravessa o seu poke. Quando ele encosta, a conversa acabou.',
    dica: 'A INVASAO rouba barra e tranca o especial dele por 4s. Use quando a barra dele encher.',
    cor: { pele: '#8a5a3e', roupa: '#1c1c20', detalhe: '#3a3a42', acento: '#d4a24a' },
    cabeca: { tipo: 'cabelo', cor: '#6a6a68' },
    fisico: { escala: 1.08, bulk: 1.18 },
    sprite: {
      frames: {
        idle: 0, andar: [1, 2], soco: 3, chute: 4,
        baixo: 5, agachar: 5, bloqueio: 6, hitstun: 7, ko: 7,
        pulo: 8, aereo: 9, habilidade: 10, especial: 11,
      },
    },
    stats: { vida: 108, velocidade: 2.75, pulo: 11.8, stamina: 110, regen: 0.55, peso: 1.3, defesa: 1.05 },
    ia: { agressividade: 0.86, distancia: 44, reacao: 15, defesa: 0.34 },
    // Finalizacao (Sprint 2). So vale no round que decide a luta e so
    // por KO - tempo esgotado nao rende finalizacao.
    finalizacao: { nome: 'ATA FINAL', sequencia: ['baixo', 'esq', 'soco'], cor: '#c9a6ff' },
    golpes: {
      // Alcance curto de proposito: ele tem que atravessar o poke dos outros
      // para existir. A armadura da cotovelada e o pedagio que ele paga.
      soco: golpe({ nome: 'Gancho Curto', startup: 6, ativo: 3, recovery: 11, dano: 9, stamina: 7, alcance: { x: 18, y: -54, w: 42, h: 22 }, cancela: ['chute', 'habilidade', 'especial'] }),
      chute: golpe({ nome: 'Joelhada', startup: 11, ativo: 4, recovery: 18, dano: 16, hitstun: 22, empurrao: 6, stamina: 15, pose: 'chute', alcance: { x: 16, y: -48, w: 40, h: 28 }, armadura: 1, cancela: ['especial'], som: 'pesado' }),
      baixo: golpe({ nome: 'Rasteira Pesada', startup: 9, ativo: 4, recovery: 17, dano: 11, altura: 'baixo', stamina: 12, pose: 'baixo', alcance: { x: 20, y: -18, w: 48, h: 18 } }),
      aereo: golpe({ nome: 'Martelo', startup: 6, ativo: 9, recovery: 8, dano: 13, stamina: 9, pose: 'aereo', alcance: { x: 14, y: -26, w: 44, h: 42 } }),
      habilidade: golpe({
        // Rouba barra e tranca o especial do outro por 4s. E curto de
        // proposito: ataca o RECURSO do adversario, entao precisa de risco.
        nome: 'INVASAO', startup: 8, ativo: 4, recovery: 22,
        dano: 10, hitstun: 22, empurrao: 6, stamina: 16, cooldown: 200,
        ganhoSuper: 10,
        efeitos: { roubarSuper: 30, bloquearEspecial: 240 },
        alcance: { x: 18, y: -74, w: 40, h: 34 },
        pose: 'habilidade', som: 'pesado',
      }),
      especial: golpe({
        nome: 'ULTIMA PALAVRA', startup: 13, ativo: 7, recovery: 30,
        dano: 40, hitstun: 42, empurrao: 15, custoSuper: 100, stamina: 0,
        avanco: 3.4, armadura: 2, pose: 'especial', alcance: { x: 16, y: -56, w: 58, h: 50 }, som: 'super',
      }),
    },
  },

  araucaria: {
    id: 'araucaria', nome: 'ARAUCARIA', titulo: 'O COLOSSO DA PEDREIRA', arquetipo: 'CHEFAO',
    chefao: true,
    bio: 'Madeira, pedra e cem anos de paciencia. Nao sente hitstun, nao recua, nao tem pressa.',
    dica: 'Armadura passiva: um golpe isolado nao o interrompe. Combo e obrigatorio.',
    cor: { pele: '#6b4a2f', roupa: '#3b2a1c', detalhe: '#2f5233', acento: '#c9a227' },
    cabeca: { tipo: 'copa', cor: '#4a8a4f' },
    fisico: { escala: 1.42, bulk: 1.85 },
    // 125 dava 138 de vida efetiva na dificuldade do no final, e o elenco
    // entrega entre 88 e 125 de dano por luta: cinco dos oito ficavam abaixo
    // do limiar e travavam em 0-8% por mais que jogassem bem.
    stats: { vida: 118, velocidade: 2.15, pulo: 9.5, stamina: 200, regen: 0.6, peso: 2.2, defesa: 1.0 },
    // recarga longa de proposito: e a janela em que ele pode ser combado
    passiva: { armadura: 1, recarga: 145 },
    fase2: { limiteVida: 0.4, velocidade: 1.35, cooldown: 0.55, dano: 1.12 },
    // Menos agressivo e mais recuado de proposito. Com agressividade 0.75 e
    // distancia 120 ele encadeava golpe sem intervalo e, com o alcance que o
    // tamanho lhe da, o jogador nunca saia da zona de ameaca: luta inganhavel.
    // O que assusta no chefao e o peso de cada golpe, nao a cadencia.
    ia: { agressividade: 0.55, distancia: 95, reacao: 22, defesa: 0.12 },
    // O chefao nao tem foto de referencia porque nao e ninguem: e ficcional.
    // As 12 poses sairam de texto, com o idle aprovado servindo de referencia
    // para as outras 11. Pixelizado a 244px e nao 176 como o elenco, porque
    // escala 1,42 x 1,3 da 244px de altura em jogo - gerar no tamanho certo
    // deixa o pixel do chefao do mesmo tamanho do pixel dos outros.
    sprite: {
      frames: {
        idle: 0, andar: [1, 2], soco: 3, chute: 4,
        baixo: 5, agachar: 5, bloqueio: 6, hitstun: 7, ko: 7,
        pulo: 8, aereo: 9, habilidade: 10, especial: 11,
      },
    },
    golpes: {
      soco: golpe({ nome: 'Galhada', startup: 8, ativo: 5, recovery: 16, dano: 13, empurrao: 9, stamina: 6, alcance: { x: 24, y: -86, w: 44, h: 30 }, cancela: ['chute', 'habilidade', 'especial'], som: 'pesado' }),
      chute: golpe({ nome: 'Pinhao', startup: 15, ativo: 6, recovery: 28, dano: 17, hitstun: 26, empurrao: 13, stamina: 12, pose: 'chute', armadura: 2, alcance: { x: 24, y: -50, w: 54, h: 44 }, cancela: ['especial'], som: 'pesado' }),
      baixo: golpe({ nome: 'Raiz', startup: 11, ativo: 7, recovery: 24, dano: 14, altura: 'baixo', stamina: 10, pose: 'baixo', alcance: { x: 18, y: -22, w: 64, h: 22 } }),
      aereo: golpe({ nome: 'Tombo', startup: 8, ativo: 12, recovery: 12, dano: 18, stamina: 10, pose: 'aereo', alcance: { x: 10, y: -30, w: 68, h: 52 } }),
      habilidade: golpe({
        // O projetil caiu de 8 para 5 de dano. A 8 ele punia os leves de forma
        // desproporcional - era 39% de tudo que o RAFAEL levava do chefao e so
        // 11% do que o JOAO levava. Mexer no cooldown nao mudou nada: medido,
        // 190 e 300 dao a mesma taxa de vitoria. O peso do chefao tem que estar
        // no corpo a corpo, que e onde ele pode ser punido.
        nome: 'CHUVA DE PINHAO', tipo: 'projetil', startup: 14, ativo: 22, recovery: 24,
        dano: 0, stamina: 14, cooldown: 190, ganhoSuper: 10, hits: 3, pose: 'projetil',
        projetil: { vel: 7.5, dano: 5, vida: 170, raio: 20, cor: '#c9a227', altura: 'alto', hitstun: 20, arco: true },
        som: 'projetil',
      }),
      especial: golpe({
        nome: 'QUEDA DA COPA', tipo: 'onda', startup: 22, ativo: 10, recovery: 40,
        dano: 32, hitstun: 46, empurrao: 20, custoSuper: 100, stamina: 0, armadura: 5,
        pose: 'pound', alcance: { x: 0, y: -40, w: 150, h: 60 },
        projetil: { vel: 11, dano: 16, vida: 85, raio: 48, cor: '#c9a227', altura: 'baixo', rasteiro: true, duplo: true, hitstun: 30 },
        som: 'super',
      }),
    },
  },
};

// ============================================================================
//  MAPA - nos na ordem da campanha. Cada no: um oponente num palco.
//  x / y sao % do painel do mapa (layout de Curitiba estilizado).
// ============================================================================
// Ordem definida pela sondagem de balanceamento (ver README): a dificuldade
// tem que subir de forma monotona. Zoner e armadilheiro vem DEPOIS do lutador
// de mobilidade porque punem mais quem ainda nao aprendeu a defender.
export const MAPA = [
  // A ordem e definida pela MEDICAO, nao pelo conceito do personagem.
  // Refeita na Sprint 5: trocar as oito habilidades mexeu em quem e dificil.
  // O VINICIUS subiu (a GEADA congela mas quase nao tira vida) e o RAFAEL
  // desceu para o no 8 (o capacete bate duas vezes por arremesso).
  { id: 'n1', lutador: 'lucas', palco: 'botanico', x: 17, y: 80, nome: 'Jardim Botanico', desc: 'Um lutador sem truque, so fundamento. Se ele te pega, foi limpo.' },
  { id: 'n2', lutador: 'vinicius', palco: 'japao', x: 50, y: 80, nome: 'Praca do Japao', desc: 'Ele nao quer chegar perto. Ele quer que voce tente. Aprenda a bloquear aqui.' },
  { id: 'n3', lutador: 'juliano', palco: 'barigui', x: 83, y: 80, nome: 'Parque Barigui', desc: 'Espaco aberto e o cara mais rapido do jogo. Boa sorte.' },
  { id: 'n4', lutador: 'daniel', palco: 'torre', x: 83, y: 50, nome: 'Torre Panoramica', desc: 'Ele nao corre atras. Ele chega. E de perto voce nao bloqueia o que ele faz.' },
  { id: 'n5', lutador: 'joao', palco: 'largo', x: 50, y: 50, nome: 'Largo da Ordem', desc: 'O aquecimento. Pedra molhada e briga suja - ele agarra o que nao se move.' },
  { id: 'n6', lutador: 'neumann', palco: 'niemeyer', x: 17, y: 50, nome: 'Museu Oscar Niemeyer', desc: 'Parede de carne. Nao adianta empurrar, tem que derrubar.' },
  { id: 'n7', lutador: 'costela', palco: 'tubo', x: 17, y: 20, nome: 'Estacao Tubo', desc: 'Apertado. Cada passo pode ter uma armadilha embaixo.' },
  { id: 'n8', lutador: 'rafael', palco: 'opera', x: 50, y: 20, nome: 'Opera de Arame', desc: 'Palco de verdade. Ele usa o espaco inteiro e some.' },
  { id: 'n9', lutador: 'araucaria', palco: 'pedreira', x: 83, y: 20, nome: 'Pedreira Paulo Leminski', chefao: true, desc: 'Trinta metros de rocha e algo muito velho no meio.' },
];

// jogaveis = todos menos o chefao
// A rampa de dificuldade vai de 0.85 ao 1.23 e distribui os nos por igual.
// Contar o indice direto (0.85 + i * 0.055) fazia acrescentar um lutador ao
// mapa empurrar o chefao para cima sem ninguem pedir.
export const dificuldadeDoNo = (i) => 0.85 + (0.38 * i) / (MAPA.length - 1);

// Altura do lutador em jogo. Mora aqui porque quem carrega o sprite precisa
// dela antes de existir um Lutador: sprites.js fixa a escala da folha na
// primeira chamada de carregar() e ignora as seguintes, entao pre-carregar
// todo mundo numa altura fixa desenhava o chefao a 70% do tamanho dele.
export const alturaDe = (d) => 132 * d.fisico.escala * ESCALA_ARCADE;

export const JOGAVEIS = Object.keys(LUTADORES).filter((k) => !LUTADORES[k].chefao);
