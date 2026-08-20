/**
 * How the cards in your hand are arranged.
 *
 * This is purely how the hand is shown — the rules do not care what order you hold
 * cards in. But arranging your hand is a real part of playing: at a table you shuffle
 * cards around constantly, park a Joker next to the run you mean it for, and slide
 * the Ace to whichever end you are building towards. So the arrangement is yours to
 * control, and it survives being sorted, drawn to, and played from.
 */

import type { Card } from '../engine/cards.ts'
import type { CardId } from '../engine/ids.ts'

export type SortMode =
  /** Straight by rank, ignoring suit — every 7 together, then every 8. */
  | 'rank'
  /** Grouped by suit, and in sequence within each suit. */
  | 'suit'
  /** Exactly how you last arranged it by hand. */
  | 'custom'

export interface HandLayout {
  readonly mode: SortMode
  /**
   * Whether the Ace sorts above the King or below the 2. It is both in this game, so
   * which end it belongs on depends on the run you are chasing.
   */
  readonly aceHigh: boolean
  /** Card ids in the order you last arranged them. Only used in custom mode. */
  readonly customOrder: readonly CardId[]
}

export const DEFAULT_LAYOUT: HandLayout = {
  mode: 'suit',
  aceHigh: false,
  customOrder: [],
}

/**
 * Suit order, alternating black and red so the groups separate at a glance when the
 * cards are fanned and only a sliver of each is showing.
 */
const SUIT_ORDER: Record<string, number> = {
  spades: 0,
  hearts: 1,
  clubs: 2,
  diamonds: 3,
}

/** Where a card sits on the rank scale, with the Ace at whichever end you chose. */
function rankKey(card: Card, aceHigh: boolean): number {
  if (card.isJoker) return Number.POSITIVE_INFINITY
  if (card.rank === 1) return aceHigh ? 14 : 1
  return card.rank!
}

function suitKey(card: Card): number {
  if (card.isJoker || card.suit == null) return 99
  return SUIT_ORDER[card.suit] ?? 98
}

/**
 * Arrange a hand for display.
 *
 * Jokers always land at the end of a sorted hand — they belong to no rank and no
 * suit, so any position is arbitrary, and the end is where they are easiest to find.
 * Drag one somewhere better and the hand becomes custom, which is the point.
 */
export function orderHand(cards: readonly Card[], layout: HandLayout): Card[] {
  if (layout.mode === 'custom') return applyCustomOrder(cards, layout.customOrder)

  const sorted = cards.slice()
  sorted.sort((a, b) => {
    if (a.isJoker !== b.isJoker) return a.isJoker ? 1 : -1

    if (layout.mode === 'suit') {
      const bySuit = suitKey(a) - suitKey(b)
      if (bySuit !== 0) return bySuit
      return rankKey(a, layout.aceHigh) - rankKey(b, layout.aceHigh)
    }

    const byRank = rankKey(a, layout.aceHigh) - rankKey(b, layout.aceHigh)
    if (byRank !== 0) return byRank
    return suitKey(a) - suitKey(b)
  })
  return sorted
}

/**
 * Apply a remembered arrangement to the hand as it is now.
 *
 * The hand changes underneath the arrangement constantly — you draw, you kick, you
 * discard — so this is written to survive that rather than to assume it matches.
 * Cards you no longer hold fall out, and cards the arrangement has never seen (the
 * one you just drew) go on the end, where you will notice them.
 */
export function applyCustomOrder(cards: readonly Card[], order: readonly CardId[]): Card[] {
  const byId = new Map(cards.map((card) => [card.id, card]))
  const arranged: Card[] = []
  for (const id of order) {
    const card = byId.get(id)
    if (card) {
      arranged.push(card)
      byId.delete(id)
    }
  }
  // Anything not in the remembered order is new; keep its existing relative order.
  for (const card of cards) {
    if (byId.has(card.id)) arranged.push(card)
  }
  return arranged
}

/** Move one card to a new position, returning the resulting arrangement of ids. */
export function moveCard(
  ordered: readonly Card[],
  cardId: CardId,
  toIndex: number,
): CardId[] {
  const ids = ordered.map((card) => card.id)
  const from = ids.indexOf(cardId)
  if (from === -1) return ids
  const target = Math.max(0, Math.min(ids.length - 1, toIndex))
  if (target === from) return ids
  ids.splice(from, 1)
  ids.splice(target, 0, cardId)
  return ids
}

export const SORT_LABELS: Record<Exclude<SortMode, 'custom'>, string> = {
  rank: 'Rank',
  suit: 'Suit',
}
