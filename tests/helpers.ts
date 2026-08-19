/** Test helpers for building exact hands and board positions. */

import type { Card, Rank, Suit } from '../src/engine/cards.ts'
import type { GameState, PlayerState } from '../src/engine/state.ts'
import { PLAYER_COUNT } from '../src/engine/config.ts'
import { createGame } from '../src/engine/reduce.ts'

const SUIT_BY_CODE: Record<string, Suit> = {
  C: 'clubs',
  D: 'diamonds',
  H: 'hearts',
  S: 'spades',
}

const RANK_BY_CODE: Record<string, Rank> = {
  A: 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  T: 10,
  J: 11,
  Q: 12,
  K: 13,
}

/**
 * Build a card from shorthand: `c('7S')` is the seven of spades, `c('JK')` a Joker.
 * `deck` distinguishes the physical copies that multiple decks put in play, which
 * matters for the legal same-suit overlap.
 */
export function c(spec: string, deck = 0): Card {
  if (spec === 'JK' || spec.startsWith('JK')) {
    const index = spec.length > 2 ? spec.slice(2) : '0'
    return { id: `d${deck}-JK${index}`, suit: null, rank: null, isJoker: true }
  }
  const rankCode = spec.slice(0, -1)
  const suitCode = spec.slice(-1)
  const rank = RANK_BY_CODE[rankCode]
  const suit = SUIT_BY_CODE[suitCode]
  if (rank == null || suit == null) throw new Error(`Bad card spec: ${spec}`)
  return { id: `d${deck}-${suitCode}${rank}`, suit, rank, isJoker: false }
}

/** Several cards at once: `hand('AS 2S 3S 4S')`. */
export function hand(specs: string, deck = 0): Card[] {
  return specs
    .trim()
    .split(/\s+/)
    .map((spec) => c(spec, deck))
}

export function newGame(seed = 12345): GameState {
  return createGame({
    seed,
    players: Array.from({ length: PLAYER_COUNT }, (_, index) => ({
      id: `p${index}`,
      name: `Player ${index}`,
      isHuman: index === 0,
    })),
  })
}

/** Force a specific hand onto a seat, leaving the rest of the state alone. */
export function withHand(state: GameState, seat: number, cards: Card[]): GameState {
  const players: PlayerState[] = state.players.map((player, index) =>
    index === seat ? { ...player, hand: cards } : player,
  )
  return { ...state, players }
}

export function withState(state: GameState, patch: Partial<GameState>): GameState {
  return { ...state, ...patch }
}

/** Every card currently anywhere in the game, for conservation checks. */
export function allCardIds(state: GameState): string[] {
  return [
    ...state.drawPile.map((card) => card.id),
    ...state.discardPile.map((card) => card.id),
    ...state.players.flatMap((player) => player.hand.map((card) => card.id)),
    ...state.melds.flatMap((meld) => meld.cards.map((card) => card.id)),
  ]
}
