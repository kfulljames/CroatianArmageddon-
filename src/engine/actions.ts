/**
 * The action surface: everything a player may do, and what is legal right now.
 *
 * The human interface and the bots both go through this module, so a move that is
 * illegal is unrepresentable rather than merely un-rendered. `legalMoves` answers
 * "what can be done", `reduce` (in reduce.ts) answers "what happens when it is".
 */

import type { Card } from './cards.ts'
import type { CardId, MeldId, PlayerId } from './ids.ts'
import { type KickPosition, type MeldProposal, jokerSlots, kickOptions, canStealJoker } from './melds.ts'
import { canOpen } from './openings.ts'
import { roundSpec } from './rounds.ts'
import {
  type GameState,
  currentPlayer,
  discardIsClaimable,
  playerById,
  topDiscard,
} from './state.ts'

export type Action =
  /** Start your turn by drawing the top of the draw pile. */
  | { readonly type: 'drawFromPile' }
  /** Start your turn by taking the discard instead. */
  | { readonly type: 'takeDiscard' }
  /** Lay down this round's requirement. */
  | { readonly type: 'open'; readonly proposals: readonly MeldProposal[] }
  /** Add a card to a meld already on the table. */
  | {
      readonly type: 'kick'
      readonly cardId: CardId
      readonly meldId: MeldId
      readonly position: KickPosition
    }
  /** Buy a Joker out of a played meld by handing over the card it stands for. */
  | {
      readonly type: 'stealJoker'
      readonly meldId: MeldId
      readonly index: number
      readonly cardId: CardId
    }
  /** Throw a card, ending your turn. */
  | { readonly type: 'discard'; readonly cardId: CardId }
  /** Answer the claim question currently being put to you. */
  | { readonly type: 'claimResponse'; readonly want: boolean }
  /** Deal the next round after scoring. */
  | { readonly type: 'startNextRound' }

export interface KickMove {
  readonly cardId: CardId
  readonly meldId: MeldId
  readonly position: KickPosition
  readonly slot?: number
}

export interface StealMove {
  readonly cardId: CardId
  readonly meldId: MeldId
  readonly index: number
  /** What the Joker stands for, for display. */
  readonly description: string
}

export interface LegalMoves {
  readonly phase: GameState['phase']
  /** Who is being asked to act. Null once the game is over. */
  readonly playerId: PlayerId | null
  readonly canDrawFromPile: boolean
  readonly canTakeDiscard: boolean
  readonly kicks: readonly KickMove[]
  readonly steals: readonly StealMove[]
  readonly discardable: readonly CardId[]
  readonly canOpen: boolean
  readonly canStartNextRound: boolean
  /** During a claim window, whose answer is awaited. */
  readonly claimPlayerId: PlayerId | null
  readonly claimCard: Card | null
  /** True when accepting the claim would also cost a penalty card. */
  readonly claimCostsPenalty: boolean
}

const NO_MOVES: Omit<LegalMoves, 'phase' | 'playerId'> = {
  canDrawFromPile: false,
  canTakeDiscard: false,
  kicks: [],
  steals: [],
  discardable: [],
  canOpen: false,
  canStartNextRound: false,
  claimPlayerId: null,
  claimCard: null,
  claimCostsPenalty: false,
}

export function legalMoves(state: GameState): LegalMoves {
  if (state.phase === 'gameEnd') {
    return { ...NO_MOVES, phase: state.phase, playerId: null }
  }

  if (state.phase === 'roundEnd') {
    return {
      ...NO_MOVES,
      phase: state.phase,
      playerId: null,
      canStartNextRound: true,
    }
  }

  if (state.phase === 'claim') {
    const claim = state.claim
    if (!claim) return { ...NO_MOVES, phase: state.phase, playerId: null }
    const responderId = claim.order[claim.index] ?? null
    return {
      ...NO_MOVES,
      phase: state.phase,
      playerId: responderId,
      claimPlayerId: responderId,
      claimCard: topDiscard(state),
      // Index 0 is the player whose turn is about to start; only they claim free.
      claimCostsPenalty: claim.index > 0,
    }
  }

  const player = currentPlayer(state)

  if (state.phase === 'draw') {
    return {
      ...NO_MOVES,
      phase: state.phase,
      playerId: player.id,
      canDrawFromPile: canDraw(state),
      canTakeDiscard: discardIsClaimable(state),
    }
  }

  // phase === 'play'
  const spec = roundSpec(state.round)
  const kicks: KickMove[] = []
  const steals: StealMove[] = []

  if (player.hasOpened) {
    // Ruling 4: the last card must leave as a discard, so a kick that would empty
    // the hand is not offered. Otherwise the player would owe a discard they cannot
    // make.
    const mayKick = player.hand.length > 1
    if (mayKick) {
      for (const card of player.hand) {
        for (const meld of state.melds) {
          for (const option of kickOptions(meld, card, state.turnCounter, state.melds)) {
            kicks.push({
              cardId: card.id,
              meldId: option.meldId,
              position: option.position,
              ...(option.slot != null ? { slot: option.slot } : {}),
            })
          }
        }
      }
    }
  }

  // Stealing a Joker is open to everyone, opened or not, and does not use up the
  // turn. It swaps one card for another, so it never changes your hand size.
  for (const meld of state.melds) {
    for (const slot of jokerSlots(meld)) {
      for (const card of player.hand) {
        if (canStealJoker(meld, slot.index, card)) {
          steals.push({
            cardId: card.id,
            meldId: meld.id,
            index: slot.index,
            description: slot.description,
          })
        }
      }
    }
  }

  const moves: LegalMoves = {
    ...NO_MOVES,
    phase: state.phase,
    playerId: player.id,
    kicks,
    steals,
    discardable: player.hand.map((card) => card.id),
    canOpen: false,
  }

  // Working out whether a hand can open means searching it, which is far and away
  // the most expensive thing in the engine. Most callers only want to know what is
  // tappable, so the answer is computed on first read and then remembered.
  let openable: boolean | null = null
  Object.defineProperty(moves, 'canOpen', {
    enumerable: true,
    get(): boolean {
      if (openable === null) {
        openable = !player.hasOpened && canOpen(player.hand, spec)
      }
      return openable
    },
  })

  return moves
}

/**
 * Whether a card can be drawn at all. The draw pile refills from the discard pile
 * (Ruling 1), so it is only truly empty when the discard pile has nothing spare.
 */
export function canDraw(state: GameState): boolean {
  return state.drawPile.length > 0 || state.discardPile.length > 1
}

/** Narrow helper used by the reducer to reject moves that are not on offer. */
export function isLegal(state: GameState, action: Action): boolean {
  const moves = legalMoves(state)
  switch (action.type) {
    case 'drawFromPile':
      return moves.canDrawFromPile
    case 'takeDiscard':
      return moves.canTakeDiscard
    case 'open':
      return moves.canOpen
    case 'kick':
      return moves.kicks.some(
        (move) =>
          move.cardId === action.cardId &&
          move.meldId === action.meldId &&
          move.position === action.position,
      )
    case 'stealJoker':
      return moves.steals.some(
        (move) =>
          move.cardId === action.cardId &&
          move.meldId === action.meldId &&
          move.index === action.index,
      )
    case 'discard':
      return moves.discardable.includes(action.cardId)
    case 'claimResponse':
      return moves.claimPlayerId != null
    case 'startNextRound':
      return moves.canStartNextRound
    default:
      return false
  }
}

/** The player a claim question is currently addressed to, if any. */
export function claimResponder(state: GameState): PlayerId | null {
  if (state.phase !== 'claim' || !state.claim) return null
  return state.claim.order[state.claim.index] ?? null
}

export function handOf(state: GameState, playerId: PlayerId): readonly Card[] {
  return playerById(state, playerId).hand
}
