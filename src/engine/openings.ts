/**
 * Finding legal ways to open a hand.
 *
 * Both the interface and the bots ask the same question — "can this hand open, and
 * how?" — so the answer lives here rather than in either of them.
 *
 * Candidates are generated as abstract *shapes* (a run is "spades, starting at slot
 * 5, four long"; a set is "three Kings") and only resolved against real cards during
 * the search. That is what lets a legal same-suit overlap work: A-2-3-4♠ and
 * 4-5-6-7♠ need two different 4♠ from two different decks, and the resolver simply
 * draws the second one from what is left in the pool.
 */

import { type Card, type Rank, type Suit, RANKS, SLOT_MAX, SUITS, handPoints, slotToRank } from './cards.ts'
import type { CardId } from './ids.ts'
import {
  type MeldProposal,
  type RunProposal,
  type SetProposal,
  runEndSlot,
  type RunMeld,
} from './melds.ts'
import { FULL_SUIT_RUN_LENGTH, MIN_RUN_SIZE, MIN_SET_SIZE, type RoundSpec } from './rounds.ts'

interface SetShape {
  readonly kind: 'set'
  readonly rank: Rank
  readonly size: number
}

interface RunShape {
  readonly kind: 'run'
  readonly suit: Suit
  readonly startSlot: number
  readonly length: number
}

type Shape = SetShape | RunShape

export interface OpeningPlan {
  readonly proposals: readonly MeldProposal[]
  readonly usedCardIds: readonly CardId[]
  readonly leftover: readonly Card[]
  readonly jokersUsed: number
}

export interface FindOpeningsOptions {
  /** Stop after this many distinct plans. Keeps the search cheap for bots. */
  readonly limit?: number
  /** Cap Jokers per meld. Bots use this to avoid burning Jokers on weak openings. */
  readonly maxJokersPerMeld?: number
}

/** A pool of cards that hands out specific physical cards on request. */
class CardPool {
  private readonly used = new Set<CardId>()

  constructor(private readonly cards: readonly Card[]) {}

  snapshot(): Set<CardId> {
    return new Set(this.used)
  }

  restore(snapshot: Set<CardId>): void {
    this.used.clear()
    for (const id of snapshot) this.used.add(id)
  }

  /** Take a natural card of this rank, optionally constrained to a suit. */
  takeNatural(rank: Rank, suit: Suit | null): Card | null {
    for (const card of this.cards) {
      if (card.isJoker) continue
      if (this.used.has(card.id)) continue
      if (card.rank !== rank) continue
      if (suit != null && card.suit !== suit) continue
      this.used.add(card.id)
      return card
    }
    return null
  }

  takeJoker(): Card | null {
    for (const card of this.cards) {
      if (!card.isJoker) continue
      if (this.used.has(card.id)) continue
      this.used.add(card.id)
      return card
    }
    return null
  }

  remaining(): Card[] {
    return this.cards.filter((card) => !this.used.has(card.id))
  }

  usedIds(): CardId[] {
    return [...this.used]
  }
}

interface Resolved {
  readonly proposal: MeldProposal
  readonly jokersUsed: number
  /** Present for runs, so adjacency can be checked without rebuilding the meld. */
  readonly run?: { suit: Suit; startSlot: number; length: number }
}

function resolveShape(shape: Shape, pool: CardPool, maxJokersPerMeld: number): Resolved | null {
  const before = pool.snapshot()
  let jokersUsed = 0

  if (shape.kind === 'set') {
    const cards: Card[] = []
    for (let i = 0; i < shape.size; i++) {
      const natural = pool.takeNatural(shape.rank, null)
      if (natural) {
        cards.push(natural)
        continue
      }
      const joker = pool.takeJoker()
      if (!joker || jokersUsed + 1 > maxJokersPerMeld) {
        pool.restore(before)
        return null
      }
      cards.push(joker)
      jokersUsed++
    }
    // A set made only of Jokers has no rank of its own; it is legal only as a
    // go-out, and the caller decides that. We still record the declared rank.
    const proposal: SetProposal = { kind: 'set', cards, rank: shape.rank }
    return { proposal, jokersUsed }
  }

  const cards: Card[] = []
  for (let i = 0; i < shape.length; i++) {
    const slot = shape.startSlot + i
    const natural = pool.takeNatural(slotToRank(slot), shape.suit)
    if (natural) {
      cards.push(natural)
      continue
    }
    const joker = pool.takeJoker()
    if (!joker || jokersUsed + 1 > maxJokersPerMeld) {
      pool.restore(before)
      return null
    }
    cards.push(joker)
    jokersUsed++
  }
  // A run needs a suit, so it cannot be all Jokers.
  if (cards.every((card) => card.isJoker)) {
    pool.restore(before)
    return null
  }
  const proposal: RunProposal = { kind: 'run', cards, startSlot: shape.startSlot }
  return {
    proposal,
    jokersUsed,
    run: { suit: shape.suit, startSlot: shape.startSlot, length: shape.length },
  }
}

function runShapes(length = MIN_RUN_SIZE): RunShape[] {
  const shapes: RunShape[] = []
  for (const suit of SUITS) {
    for (let startSlot = 1; startSlot + length - 1 <= SLOT_MAX; startSlot++) {
      shapes.push({ kind: 'run', suit, startSlot, length })
    }
  }
  return shapes
}

function setShapes(size = MIN_SET_SIZE): SetShape[] {
  return RANKS.map((rank) => ({ kind: 'set', rank, size }))
}

/** Ruling 2, checked against the partial selection during the search. */
function sequentialWithAny(
  candidate: { suit: Suit; startSlot: number; length: number },
  chosen: readonly { suit: Suit; startSlot: number; length: number }[],
): boolean {
  const candidateEnd = candidate.startSlot + candidate.length - 1
  return chosen.some((other) => {
    if (other.suit !== candidate.suit) return false
    const otherEnd = other.startSlot + other.length - 1
    return otherEnd + 1 === candidate.startSlot || candidateEnd + 1 === other.startSlot
  })
}

/**
 * Grow the chosen melds with whatever is left in hand.
 *
 * Runs extend at either end, sets take any card of their rank. We loop until nothing
 * more can be absorbed, because extending one run can expose a card that now fits
 * another. `keepBack` reserves cards that must stay in hand — one, in rounds 1–6,
 * because the final card has to leave as a discard.
 */
function extendWithLeftovers(
  resolved: Resolved[],
  leftover: Card[],
  keepBack: number,
): { proposals: MeldProposal[]; leftover: Card[] } {
  const pending = leftover.slice()
  const melds = resolved.map((entry) => ({
    proposal: entry.proposal,
    cards: entry.proposal.cards.slice(),
    run: entry.run ? { ...entry.run } : null,
  }))

  /**
   * Ruling 2 again, this time against growth.
   *
   * Two runs can legally be laid with a gap between them, but extending one into
   * that gap would leave them sequential — which is just one long run wearing a
   * disguise. The adjacency check during the search cannot see this, because the
   * runs only reach each other once the leftovers are added.
   */
  const wouldCollide = (
    self: (typeof melds)[number],
    start: number,
    end: number,
  ): boolean =>
    melds.some((other) => {
      if (other === self || !other.run || !self.run) return false
      if (other.run.suit !== self.run.suit) return false
      const otherStart = other.run.startSlot
      const otherEnd = other.run.startSlot + other.run.length - 1
      return end + 1 === otherStart || otherEnd + 1 === start
    })

  let progress = true
  while (progress && pending.length > keepBack) {
    progress = false
    for (const meld of melds) {
      if (pending.length <= keepBack) break
      for (let i = 0; i < pending.length; i++) {
        if (pending.length <= keepBack) break
        const card = pending[i]!
        if (card.isJoker) continue // Jokers are worth more held than dumped as kickers

        if (meld.run) {
          const lowSlot = meld.run.startSlot - 1
          const highSlot = meld.run.startSlot + meld.run.length
          if (
            lowSlot >= 1 &&
            card.suit === meld.run.suit &&
            card.rank === slotToRank(lowSlot) &&
            !wouldCollide(meld, lowSlot, meld.run.startSlot + meld.run.length - 1)
          ) {
            meld.cards.unshift(card)
            meld.run.startSlot = lowSlot
            meld.run.length++
            pending.splice(i, 1)
            progress = true
            i--
            continue
          }
          if (
            highSlot <= SLOT_MAX &&
            card.suit === meld.run.suit &&
            card.rank === slotToRank(highSlot) &&
            !wouldCollide(meld, meld.run.startSlot, highSlot)
          ) {
            meld.cards.push(card)
            meld.run.length++
            pending.splice(i, 1)
            progress = true
            i--
            continue
          }
        } else {
          const setProposal = meld.proposal as SetProposal
          if (card.rank === setProposal.rank) {
            meld.cards.push(card)
            pending.splice(i, 1)
            progress = true
            i--
          }
        }
      }
    }
  }

  const proposals: MeldProposal[] = melds.map((meld) =>
    meld.run
      ? ({ kind: 'run', cards: meld.cards, startSlot: meld.run.startSlot } as RunProposal)
      : ({ kind: 'set', cards: meld.cards, rank: (meld.proposal as SetProposal).rank } as SetProposal),
  )
  return { proposals, leftover: pending }
}

/**
 * Find ways this hand could open for the given round.
 *
 * In rounds 1–6 a plan must leave at least one card in hand, because the round ends
 * only when the final card leaves as a discard (Ruling 4). In round 7 the opposite
 * holds: a plan is legal only if it empties the hand completely (Ruling 9).
 */
export function findOpenings(
  hand: readonly Card[],
  spec: RoundSpec,
  options: FindOpeningsOptions = {},
): OpeningPlan[] {
  const limit = options.limit ?? 20
  const maxJokersPerMeld = options.maxJokersPerMeld ?? Number.POSITIVE_INFINITY
  const isFinal = spec.runs === 3 && spec.sets === 0 && spec.round === 7
  const keepBack = isFinal ? 0 : 1

  const plans: OpeningPlan[] = []
  const seen = new Set<string>()

  const record = (resolved: Resolved[], pool: CardPool): void => {
    const leftoverCards = pool.remaining()
    const { proposals, leftover } = extendWithLeftovers(resolved, leftoverCards, keepBack)

    if (isFinal && leftover.length > 0) return
    if (!isFinal && leftover.length < 1) return

    // Jokers alone only count as a three of a kind when playing them goes out.
    const jokerOnlySet = proposals.some(
      (proposal) => proposal.kind === 'set' && proposal.cards.every((card) => card.isJoker),
    )
    if (jokerOnlySet && leftover.length !== 0) return

    const usedCardIds = proposals.flatMap((proposal) => proposal.cards.map((card) => card.id))
    const key = proposals
      .map((proposal) => proposal.cards.map((card) => card.id).sort().join(','))
      .sort()
      .join('|')
    if (seen.has(key)) return
    seen.add(key)

    plans.push({
      proposals,
      usedCardIds,
      leftover,
      jokersUsed: usedCardIds.filter((id) => id.includes('JK')).length,
    })
  }

  const allRunShapes = runShapes()
  const allSetShapes = setShapes()

  const searchSets = (
    remaining: number,
    startIndex: number,
    resolved: Resolved[],
    pool: CardPool,
  ): void => {
    if (plans.length >= limit) return
    if (remaining === 0) {
      record(resolved, pool)
      return
    }
    for (let i = startIndex; i < allSetShapes.length; i++) {
      if (plans.length >= limit) return
      const shape = allSetShapes[i]!
      const before = pool.snapshot()
      const entry = resolveShape(shape, pool, maxJokersPerMeld)
      if (!entry) continue
      resolved.push(entry)
      // Two separate three-of-a-kinds of the same rank are disallowed, so each rank
      // may be used at most once — hence `i + 1` rather than `i`.
      searchSets(remaining - 1, i + 1, resolved, pool)
      resolved.pop()
      pool.restore(before)
    }
  }

  const searchRuns = (
    remaining: number,
    startIndex: number,
    resolved: Resolved[],
    chosenRuns: { suit: Suit; startSlot: number; length: number }[],
    pool: CardPool,
  ): void => {
    if (plans.length >= limit) return
    if (remaining === 0) {
      searchSets(spec.sets, 0, resolved, pool)
      return
    }
    for (let i = startIndex; i < allRunShapes.length; i++) {
      if (plans.length >= limit) return
      const shape = allRunShapes[i]!
      if (sequentialWithAny(shape, chosenRuns)) continue
      const before = pool.snapshot()
      const entry = resolveShape(shape, pool, maxJokersPerMeld)
      if (!entry) continue
      resolved.push(entry)
      chosenRuns.push({ suit: shape.suit, startSlot: shape.startSlot, length: shape.length })
      searchRuns(remaining - 1, i, resolved, chosenRuns, pool)
      chosenRuns.pop()
      resolved.pop()
      pool.restore(before)
    }
  }

  searchRuns(spec.runs, 0, [], [], new CardPool(hand))

  // Round 7's alternative win: one run of a whole suit, low Ace through high Ace.
  if (isFinal) {
    for (const suit of SUITS) {
      const pool = new CardPool(hand)
      const entry = resolveShape(
        { kind: 'run', suit, startSlot: 1, length: FULL_SUIT_RUN_LENGTH },
        pool,
        maxJokersPerMeld,
      )
      if (entry) record([entry], pool)
    }
  }

  // Prefer plans that spend fewer Jokers, then those that shed the most points.
  return plans.sort((a, b) => {
    if (a.jokersUsed !== b.jokersUsed) return a.jokersUsed - b.jokersUsed
    return handPoints(a.leftover) - handPoints(b.leftover)
  })
}

/** Convenience for the interface: can this hand open at all right now? */
export function canOpen(hand: readonly Card[], spec: RoundSpec): boolean {
  return findOpenings(hand, spec, { limit: 1 }).length > 0
}

/** Re-export for callers that want to reason about a laid run's extent. */
export function runSpan(meld: RunMeld): { start: number; end: number } {
  return { start: meld.startSlot, end: runEndSlot(meld) }
}
