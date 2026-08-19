/**
 * Cards, decks and point values for Croatian Armageddon.
 *
 * This module is pure: no DOM, no randomness, no I/O. Shuffling takes an explicit
 * seeded RNG so that any game can be replayed exactly from its seed.
 */

export type Suit = 'clubs' | 'diamonds' | 'hearts' | 'spades'

export const SUITS: readonly Suit[] = ['clubs', 'diamonds', 'hearts', 'spades']

/** 1 = Ace, 11 = Jack, 12 = Queen, 13 = King. Jokers carry `null`. */
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13

export const RANKS: readonly Rank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]

/**
 * Position inside a run, on a 1..14 scale.
 *
 * The Ace is both high and low, so it appears twice on this scale: slot 1 is the low
 * Ace and slot 14 the high Ace. Runs occupy a consecutive span of slots, which makes
 * "you cannot wrap around" (2-A-K) structurally impossible rather than a rule we have
 * to remember to check — no consecutive span contains both slot 14 and slot 1.
 */
export type SlotRank = number

export const SLOT_MIN = 1
export const SLOT_MAX = 14

export interface Card {
  /** Unique per *physical* card. Multiple decks mean the same face appears many times. */
  readonly id: string
  readonly suit: Suit | null
  readonly rank: Rank | null
  readonly isJoker: boolean
}

const SUIT_CODE: Record<Suit, string> = {
  clubs: 'C',
  diamonds: 'D',
  hearts: 'H',
  spades: 'S',
}

const RANK_LABEL: Record<Rank, string> = {
  1: 'A',
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: 'J',
  12: 'Q',
  13: 'K',
}

export const SUIT_SYMBOL: Record<Suit, string> = {
  clubs: '♣',
  diamonds: '♦',
  hearts: '♥',
  spades: '♠',
}

/** Short human label, e.g. "7♠" or "Joker". */
export function cardLabel(card: Card): string {
  if (card.isJoker) return 'Joker'
  return `${RANK_LABEL[card.rank!]}${SUIT_SYMBOL[card.suit!]}`
}

export function rankLabel(rank: Rank): string {
  return RANK_LABEL[rank]
}

/** Label for a run slot, distinguishing the low Ace from the high Ace. */
export function slotLabel(slot: SlotRank, suit: Suit): string {
  const rank = slotToRank(slot)
  return `${RANK_LABEL[rank]}${SUIT_SYMBOL[suit]}`
}

/**
 * Point value of a card when it is caught in your hand at the end of a round.
 * Numbers score their pips, face cards 10, Ace and Joker 15 each. An Ace is worth 15
 * whether it was going to play high or low.
 */
export function cardPoints(card: Card): number {
  if (card.isJoker) return 15
  const rank = card.rank!
  if (rank === 1) return 15
  if (rank >= 11) return 10
  return rank
}

export function handPoints(cards: readonly Card[]): number {
  return cards.reduce((total, card) => total + cardPoints(card), 0)
}

/** The face rank that occupies a given run slot. Slots 1 and 14 are both the Ace. */
export function slotToRank(slot: SlotRank): Rank {
  if (slot === SLOT_MAX) return 1
  return slot as Rank
}

/**
 * Can this physical card sit in this run slot? Jokers can sit anywhere — whether a
 * joker is *allowed* there is a meld-level question, not a card-level one.
 */
export function cardFitsSlot(card: Card, suit: Suit, slot: SlotRank): boolean {
  if (card.isJoker) return true
  if (card.suit !== suit) return false
  return card.rank === slotToRank(slot)
}

/** Decks required for a given player count: one per two players, rounded up. */
export function deckCountForPlayers(playerCount: number): number {
  return Math.ceil(playerCount / 2)
}

/**
 * One standard 52-card deck plus jokers. `deckIndex` keeps card ids unique across the
 * several decks that make up a shoe.
 */
export function buildDeck(deckIndex: number, jokersPerDeck = 3): Card[] {
  const cards: Card[] = []
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push({
        id: `d${deckIndex}-${SUIT_CODE[suit]}${rank}`,
        suit,
        rank,
        isJoker: false,
      })
    }
  }
  for (let j = 0; j < jokersPerDeck; j++) {
    cards.push({ id: `d${deckIndex}-JK${j}`, suit: null, rank: null, isJoker: true })
  }
  return cards
}

/** The full draw pile for a table of this size, before shuffling. */
export function buildShoe(playerCount: number, jokersPerDeck = 3): Card[] {
  const deckCount = deckCountForPlayers(playerCount)
  const cards: Card[] = []
  for (let i = 0; i < deckCount; i++) {
    cards.push(...buildDeck(i, jokersPerDeck))
  }
  return cards
}
