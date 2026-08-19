/**
 * The seven rounds of Croatian Armageddon.
 *
 * Each round names how many cards are dealt and what combination a player must hold
 * to open. The amount of sets and runs is fixed for the round: a player may build a
 * set of four or a run of six, but never a fourth meld beyond the requirement.
 */

export interface RoundSpec {
  /** 1-based round number. */
  readonly round: number
  readonly cardsDealt: number
  /** Three-of-a-kinds required to open. */
  readonly sets: number
  /** Runs of four required to open. */
  readonly runs: number
  readonly label: string
}

export const ROUNDS: readonly RoundSpec[] = [
  { round: 1, cardsDealt: 9, sets: 2, runs: 0, label: 'Two three of a kinds' },
  { round: 2, cardsDealt: 9, sets: 1, runs: 1, label: 'One three of a kind, one run of four' },
  { round: 3, cardsDealt: 9, sets: 0, runs: 2, label: 'Two runs of four' },
  { round: 4, cardsDealt: 12, sets: 3, runs: 0, label: 'Three three of a kinds' },
  { round: 5, cardsDealt: 12, sets: 2, runs: 1, label: 'Two three of a kinds, one run of four' },
  { round: 6, cardsDealt: 12, sets: 1, runs: 2, label: 'One three of a kind, two runs of four' },
  { round: 7, cardsDealt: 12, sets: 0, runs: 3, label: 'Three runs of four' },
]

export const FINAL_ROUND = 7

/** Minimum cards in a valid three-of-a-kind. */
export const MIN_SET_SIZE = 3

/** Minimum cards in a valid run. */
export const MIN_RUN_SIZE = 4

/** Length of the round-7 alternative: one full suit, low Ace through high Ace. */
export const FULL_SUIT_RUN_LENGTH = 14

export function roundSpec(round: number): RoundSpec {
  const spec = ROUNDS[round - 1]
  if (!spec) throw new Error(`No such round: ${round}`)
  return spec
}

/**
 * Round 7 is the endgame: you may only open if doing so empties your hand outright,
 * with no discard afterwards, and the first player to open ends the game.
 */
export function isFinalRound(round: number): boolean {
  return round === FINAL_ROUND
}
