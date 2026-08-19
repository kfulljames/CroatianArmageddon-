/**
 * Game state and the shape of a turn.
 *
 * A turn runs: draw → play → discard. Drawing is mandatory and comes from exactly one
 * of the two piles. Playing covers opening, kicking and stealing Jokers, in any order
 * and any number of times. Discarding ends the turn and opens the claim window, where
 * the other players are asked in clockwise order whether they want the card.
 */

import type { Card } from './cards.ts'
import type { CardId, MeldId, PlayerId } from './ids.ts'
import type { Meld } from './melds.ts'

export type Phase =
  /** The player to act must take a card from one of the piles. */
  | 'draw'
  /** The player has drawn and may open, kick, steal, and must eventually discard. */
  | 'play'
  /** A card was just discarded; players are being asked in order if they want it. */
  | 'claim'
  /** Someone went out. Hands are being counted. */
  | 'roundEnd'
  /** Round 7 has finished. */
  | 'gameEnd'

export interface PlayerState {
  readonly id: PlayerId
  readonly name: string
  readonly isHuman: boolean
  readonly hand: readonly Card[]
  /** Whether this player has laid down their opening requirement this round. */
  readonly hasOpened: boolean
  /** Running total across all rounds played so far. Lowest wins. */
  readonly score: number
}

/**
 * The claim window that follows every discard.
 *
 * `order` runs clockwise from the discarder, so the player whose turn is about to
 * begin sits at index 0 — they alone can claim without taking a penalty card.
 */
export interface ClaimState {
  readonly cardId: CardId
  readonly order: readonly PlayerId[]
  /** Whose answer we are waiting on. */
  readonly index: number
}

export interface LogEntry {
  readonly turn: number
  readonly round: number
  readonly playerId: PlayerId | null
  readonly text: string
}

/** Per-round scores, indexed by round then by player id. */
export type ScoreSheet = ReadonlyArray<Readonly<Record<PlayerId, number>>>

export interface GameState {
  readonly seed: number
  /** RNG state, carried so a saved game resumes with the same shuffle stream. */
  readonly rngState: number
  readonly players: readonly PlayerState[]
  /** Index into `players`. Rotates each round. */
  readonly dealerIndex: number
  readonly round: number
  /** Index into `players` — whose turn it is. */
  readonly turnIndex: number
  /**
   * Monotonic turn counter across the whole round. Melds record the turn they were
   * laid on so Ruling 3 can close them for the rest of that turn.
   */
  readonly turnCounter: number
  readonly phase: Phase
  /** Top of the draw pile is the last element. */
  readonly drawPile: readonly Card[]
  /** Top of the discard pile is the last element. */
  readonly discardPile: readonly Card[]
  /**
   * The most recently *discarded* card. If the top of the discard pile is not this
   * card — because someone claimed it out of turn — nobody may pick up from the pile.
   */
  readonly lastThrownCardId: CardId | null
  readonly melds: readonly Meld[]
  /**
   * True once the draw pile has been rebuilt by flipping the discards (Ruling 1).
   * The resulting order is public information — anyone paying attention saw those
   * cards go down — so bots are allowed to use it, and the harder ones do.
   */
  readonly drawPileKnown: boolean
  readonly claim: ClaimState | null
  /**
   * Turns since anything happened that could bring the round closer to an end — a
   * meld laid, a card kicked, or a hand size changed by a claim.
   *
   * Drawing and discarding leaves a hand exactly the same size, so a round only ends
   * because someone kicks their way down to a last card. When every remaining card
   * in circulation is one that no meld on the table will accept, that can never
   * happen and the round would otherwise run forever. See STALEMATE_TURNS.
   */
  readonly turnsSinceProgress: number
  readonly log: readonly LogEntry[]
  readonly scoreSheet: ScoreSheet
  /** Set once round 7 is scored. */
  readonly winnerId: PlayerId | null
  /** Ids of players tied for the win, when the winner must be decided by hand. */
  readonly tiedPlayerIds: readonly PlayerId[]
  /** Incrementing counter used to mint unique meld ids. */
  readonly nextMeldSeq: number
}

export function playerById(state: GameState, id: PlayerId): PlayerState {
  const player = state.players.find((candidate) => candidate.id === id)
  if (!player) throw new Error(`No such player: ${id}`)
  return player
}

export function currentPlayer(state: GameState): PlayerState {
  const player = state.players[state.turnIndex]
  if (!player) throw new Error(`Turn index out of range: ${state.turnIndex}`)
  return player
}

export function topDiscard(state: GameState): Card | null {
  return state.discardPile[state.discardPile.length - 1] ?? null
}

/**
 * Whether the top of the discard pile is still the card that was last thrown. Once
 * someone claims it out of turn, the card beneath is exposed and is out of bounds.
 */
export function discardIsClaimable(state: GameState): boolean {
  const top = topDiscard(state)
  return top != null && top.id === state.lastThrownCardId
}

export function meldById(state: GameState, id: MeldId): Meld {
  const meld = state.melds.find((candidate) => candidate.id === id)
  if (!meld) throw new Error(`No such meld: ${id}`)
  return meld
}

export function meldsOwnedBy(state: GameState, playerId: PlayerId): Meld[] {
  return state.melds.filter((meld) => meld.ownerId === playerId)
}

export function findCardInHand(player: PlayerState, cardId: CardId): Card | null {
  return player.hand.find((card) => card.id === cardId) ?? null
}

/** Index of the player `steps` seats clockwise from `index`. */
export function seatAfter(state: GameState, index: number, steps = 1): number {
  return (index + steps) % state.players.length
}
