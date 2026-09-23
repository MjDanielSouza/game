// ============================================================================
//  CURITIBA KOMBAT - pontuacao e recordes
//  Modulo puro: nao toca no DOM e nao le `localStorage` sozinho. O `store` e
//  injetado para os testes rodarem sem navegador.
// ============================================================================

import { FPS } from './data.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// Quanto vale cada coisa. Ficar aqui, junto, e o que permite olhar a tabela e
// entender o que o jogo esta pedindo do jogador: terminar com vida, terminar
// rapido, usar o especial e finalizar.
export const BONUS = {
  vitoria: 500,
  vida: 1500,          // proporcional ao que sobrou
  perfeito: 1500,      // round ganho sem perder vida nenhuma
  porSegundo: 12,      // do tempo que sobrou no relogio
  especial: 200,       // por especial usado
  finalizacao: 2500,
};

// Pontos de UM round ganho. Round perdido nao pontua.
// A dificuldade do no multiplica no fim: ganhar do chefao vale mais que ganhar
// do primeiro, com exatamente a mesma jogada.
export function pontosDoRound(m, dificuldade = 1) {
  if (!m || m.vencedor !== 'p1') return { total: 0, partes: [], multiplicador: dificuldade };
  const p = m.p1;
  const partes = [['VITORIA', BONUS.vitoria]];

  const vida = Math.round(BONUS.vida * clamp(p.vida / p.vidaMax, 0, 1));
  if (vida > 0) partes.push(['VIDA', vida]);
  if (p.vida >= p.vidaMax) partes.push(['PERFEITO', BONUS.perfeito]);

  const seg = Math.max(0, Math.ceil(m.tempo / FPS));
  if (seg > 0) partes.push(['TEMPO', seg * BONUS.porSegundo]);

  if (p.especiaisUsados > 0) partes.push(['ESPECIAIS', p.especiaisUsados * BONUS.especial]);
  if (m.finalizacao) partes.push(['FINALIZACAO', BONUS.finalizacao]);

  const soma = partes.reduce((a, [, v]) => a + v, 0);
  return { total: Math.round(soma * dificuldade), partes, multiplicador: dificuldade };
}

// ---------------------------------------------------------------- recordes -
export const CHAVE_RECORDES = 'curitiba-kombat-recordes';
export const MAX_RECORDES = 10;

// Tres letras, so A-Z e digito. Vazio vira AAA - ninguem fica de fora da
// tabela por nao ter digitado nada.
export function normalizarNome(txt) {
  const limpo = String(txt || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
  return limpo.padEnd(3, 'A');
}

export function lerRecordes(store) {
  try {
    const cru = JSON.parse(store.getItem(CHAVE_RECORDES) || '[]');
    if (!Array.isArray(cru)) return [];
    return cru
      .filter((r) => r && typeof r.pontos === 'number')
      .sort((a, b) => b.pontos - a.pontos)
      .slice(0, MAX_RECORDES);
  } catch (e) {
    return [];               // storage bloqueado ou lixo salvo: tabela vazia
  }
}

// Devolve a lista nova e a posicao (1-based) em que o recorde entrou, ou 0 se
// nao entrou. A posicao e o que a tela usa para destacar a linha.
export function salvarRecorde(store, { nome, pontos, personagem, no }) {
  const lista = lerRecordes(store);
  const novo = {
    nome: normalizarNome(nome),
    pontos: Math.max(0, Math.round(pontos)),
    personagem: personagem || null,
    no: no || 0,
    quando: Date.now(),
  };
  lista.push(novo);
  lista.sort((a, b) => b.pontos - a.pontos);
  const cortada = lista.slice(0, MAX_RECORDES);
  const posicao = cortada.indexOf(novo) + 1;
  try { store.setItem(CHAVE_RECORDES, JSON.stringify(cortada)); } catch (e) {}
  return { lista: cortada, posicao };
}

// Entrou na tabela? Serve para decidir se a tela de digitar o nome aparece.
export function ehRecorde(store, pontos) {
  const lista = lerRecordes(store);
  return lista.length < MAX_RECORDES || pontos > lista[lista.length - 1].pontos;
}
