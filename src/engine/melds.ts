/**
 * Melds: three-of-a-kinds and runs, plus everything that can legally be done to them.
 *
 * Two of the rulings that resolve gaps in the written rules live here:
 *
 *   Ruling 2 — two runs in the same suit may not be laid *sequentially*, since that
 *              is one run wearing a disguise and would leave you a meld short. A gap
 *              or an overlap built from duplicate cards is fine, and once down the
 *              two runs stay separate lays for good — they never combine.
 *   Ruling 5 — a Joker in a run is pinned to its slot (4-5-6-Joker♠ is the 7♠ and
 *              nothing else). A Joker in a set is bought by any card of that rank.
 */

import {
  type Card,
  type Rank,
  type SlotRank,
  type Suit,
  SLOT_MAX,
  SLOT_MIN,
  cardFitsSlot,
  cardLabel,
  rankLabel,
  slotLabel,
  slotToRank,
  SUIT_SYMBOL,
} from './cards.ts'
import type { MeldId, PlayerId } from './ids.ts'
import { MIN_RUN_SIZE, MIN_SET_SIZE } from './rounds.ts'

export interface SetMeld {
  readonly id: MeldId
  readonly kind: 'set'
  readonly ownerId: PlayerId
  /** The rank every card in the set stands for. */
  readonly rank: Rank
  readonly cards: readonly Card[]
}

export interface RunMeld {
  readonly id: MeldId
  readonly kind: 'run'
  readonly ownerId: PlayerId
  readonly suit: Suit
  /** Slot occupied by `cards[0]`; `cards[i]` occupies `startSlot + i`. */
  readonly startSlot: SlotRank
  readonly cards: readonly Card[]
}

export type Meld = SetMeld | RunMeld

/** A meld the player is proposing to lay down, before it has been validated. */
export interface SetProposal {
  readonly kind: 'set'
  /** Cards to lay. */
  readonly cards: readonly Card[]
  /** Only needed when every card is a Joker and the rank cannot be inferred. */
  readonly rank?: Rank
}

export interface RunProposal {
  readonly kind: 'run'
  /** Cards in slot order, lowest slot first. Order fixes where the Jokers sit. */
  readonly cards: readonly Card[]
  /** Overrides slot inference. Needed only when the run starts on an Ace. */
  readonly startSlot?: SlotRank
}

export type MeldProposal = SetProposal | RunProposal

export type MeldResult<T> = { ok: true; meld: T } | { ok: false; reason: string }

export function runEndSlot(meld: RunMeld): SlotRank {
  return meld.startSlot + meld.cards.length - 1
}

export function isAllJokers(cards: readonly Card[]): boolean {
  return cards.length > 0 && cards.every((card) => card.isJoker)
}

/**
 * Validate a proposed three-of-a-kind.
 *
 * Duplicates are explicitly allowed — 4♥ 4♥ 4♣ is a legal set — so we check rank
 * agreement only, never suit distinctness.
 */
export function buildSet(
  proposal: SetProposal,
  ownerId: PlayerId,
  id: MeldId,
): MeldResult<SetMeld> {
  const { cards } = proposal
  if (cards.length < MIN_SET_SIZE) {
    return { ok: false, reason: `A three of a kind needs at least ${MIN_SET_SIZE} cards.` }
  }

  const naturals = cards.filter((card) => !card.isJoker)
  let rank: Rank
  if (naturals.length === 0) {
    // An all-Joker set has no rank of its own, so the player must name one. Whether
    // such a set is legal at all is a hand-level question handled when opening.
    if (proposal.rank == null) {
      return { ok: false, reason: 'An all-Joker set must declare which rank it stands for.' }
    }
    rank = proposal.rank
  } else {
    rank = naturals[0]!.rank!
    if (naturals.some((card) => card.rank !== rank)) {
      return { ok: false, reason: 'Every card in a three of a kind must be the same rank.' }
    }
    if (proposal.rank != null && proposal.rank !== rank) {
      return { ok: false, reason: 'Declared rank does not match the cards.' }
    }
  }

  return { ok: true, meld: { id, kind: 'set', ownerId, rank, cards: cards.slice() } }
}

/**
 * Work out which slots a proposed run occupies.
 *
 * The cards arrive in slot order, so a Joker's position in the array already fixes
 * which card it stands for. The only genuine ambiguity is a run whose first natural
 * card is an Ace, which could be the low Ace or the high one; we try low first and
 * fall back to high, and a caller who cares can pass `startSlot` explicitly.
 */
function inferRunLayout(
  cards: readonly Card[],
  explicitStart?: SlotRank,
): { suit: Suit; startSlot: SlotRank } | null {
  const firstNaturalIndex = cards.findIndex((card) => !card.isJoker)
  if (firstNaturalIndex === -1) return null
  const anchor = cards[firstNaturalIndex]!
  const suit = anchor.suit!

  const candidateStarts: SlotRank[] =
    explicitStart != null
      ? [explicitStart]
      : anchor.rank === 1
        ? [SLOT_MIN - firstNaturalIndex, SLOT_MAX - firstNaturalIndex]
        : [anchor.rank! - firstNaturalIndex]

  for (const startSlot of candidateStarts) {
    if (startSlot < SLOT_MIN) continue
    if (startSlot + cards.length - 1 > SLOT_MAX) continue
    const everyCardFits = cards.every(
      (card, index) => card.isJoker || cardFitsSlot(card, suit, startSlot + index),
    )
    if (everyCardFits) return { suit, startSlot }
  }
  return null
}

/**
 * Validate a proposed run.
 *
 * Because runs live on the 1..14 slot scale where slot 1 is the low Ace and slot 14
 * the high Ace, "an Ace is high and low but cannot wrap" needs no special case: a
 * consecutive span simply cannot contain both ends.
 */
export function buildRun(
  proposal: RunProposal,
  ownerId: PlayerId,
  id: MeldId,
): MeldResult<RunMeld> {
  const { cards } = proposal
  if (cards.length < MIN_RUN_SIZE) {
    return { ok: false, reason: `A run needs at least ${MIN_RUN_SIZE} cards.` }
  }
  if (isAllJokers(cards)) {
    return { ok: false, reason: 'A run cannot be made of Jokers alone — it has no suit.' }
  }

  const naturals = cards.filter((card) => !card.isJoker)
  const suit = naturals[0]!.suit!
  if (naturals.some((card) => card.suit !== suit)) {
    return { ok: false, reason: 'Every card in a run must be the same suit.' }
  }

  const layout = inferRunLayout(cards, proposal.startSlot)
  if (!layout) {
    return { ok: false, reason: 'Those cards do not form a straight run in that order.' }
  }

  return {
    ok: true,
    meld: {
      id,
      kind: 'run',
      ownerId,
      suit: layout.suit,
      startSlot: layout.startSlot,
      cards: cards.slice(),
    },
  }
}

export function buildMeld(
  proposal: MeldProposal,
  ownerId: PlayerId,
  id: MeldId,
): MeldResult<Meld> {
  return proposal.kind === 'set'
    ? buildSet(proposal, ownerId, id)
    : buildRun(proposal, ownerId, id)
}

/**
 * Ruling 2. Two runs in the same suit may not be laid down sequentially, because
 * together they would simply be one longer run. A gap of one or more, or an overlap
 * built from duplicate cards, keeps them genuinely distinct and is allowed.
 */
export function runsAreSequential(a: RunMeld, b: RunMeld): boolean {
  if (a.suit !== b.suit) return false
  return runEndSlot(a) + 1 === b.startSlot || runEndSlot(b) + 1 === a.startSlot
}

/** Ruling 2, applied to a whole opening lay-down. Returns a reason if illegal. */
export function checkRunAdjacency(melds: readonly Meld[]): string | null {
  const runs = melds.filter((meld): meld is RunMeld => meld.kind === 'run')
  for (let i = 0; i < runs.length; i++) {
    for (let j = i + 1; j < runs.length; j++) {
      const a = runs[i]!
      const b = runs[j]!
      if (runsAreSequential(a, b)) {
        return `${describeMeld(a)} and ${describeMeld(b)} run straight into each other — together they are one run, not two.`
      }
    }
  }
  return null
}

export type KickPosition = 'start' | 'end'

export interface KickOption {
  readonly meldId: MeldId
  readonly position: KickPosition
  /** For runs, the slot the card would occupy. Undefined for sets. */
  readonly slot?: SlotRank
}

/**
 * Where, if anywhere, this card could be kicked onto this meld.
 *
 * Pure geometry: a set takes any card of its rank, a run grows at either end. There
 * is no timing rule here at all. Once a meld is down it can be added to, including on
 * the turn it was laid and including by the player who laid it.
 *
 * Two runs of a suit laid with a gap stay two separate melds for good — they never
 * combine — so the card that sits in the gap is not a problem to be prevented. Lay
 * 2-3-4-5♠ and 7-8-9-10♠ and the 6♠ can go onto either of them, or a Joker can, with
 * no issue. The runs simply remain two lays, which is what the round required.
 */
export function kickOptions(meld: Meld, card: Card): KickOption[] {
  if (meld.kind === 'set') {
    const matches = card.isJoker || card.rank === meld.rank
    return matches ? [{ meldId: meld.id, position: 'end' }] : []
  }

  const options: KickOption[] = []
  const lowSlot = meld.startSlot - 1
  if (lowSlot >= SLOT_MIN && cardFitsSlot(card, meld.suit, lowSlot)) {
    options.push({ meldId: meld.id, position: 'start', slot: lowSlot })
  }
  const highSlot = runEndSlot(meld) + 1
  if (highSlot <= SLOT_MAX && cardFitsSlot(card, meld.suit, highSlot)) {
    options.push({ meldId: meld.id, position: 'end', slot: highSlot })
  }
  // A run cannot wrap: the slot scale simply ends at the high Ace, so nothing follows
  // it and nothing precedes the low Ace.
  return options
}

/** Apply a kick, returning the new meld. Assumes the option came from `kickOptions`. */
export function applyKick(meld: Meld, card: Card, position: KickPosition): Meld {
  if (meld.kind === 'set') {
    return { ...meld, cards: [...meld.cards, card] }
  }
  return position === 'start'
    ? { ...meld, startSlot: meld.startSlot - 1, cards: [card, ...meld.cards] }
    : { ...meld, cards: [...meld.cards, card] }
}

export interface JokerSlotInfo {
  readonly meldId: MeldId
  readonly index: number
  /** The rank the Joker stands for. */
  readonly rank: Rank
  /** The suit it stands for — null in a set, where any suit of that rank buys it. */
  readonly suit: Suit | null
  readonly description: string
}

/**
 * Ruling 5. Every Joker sitting in a played meld, and exactly what it stands for.
 *
 * In a run the answer is strict and positional. In a set the rank is fixed but the
 * suit is open, so any card of that rank — including a duplicate of one already in
 * the set — will buy it.
 */
export function jokerSlots(meld: Meld): JokerSlotInfo[] {
  const slots: JokerSlotInfo[] = []
  meld.cards.forEach((card, index) => {
    if (!card.isJoker) return
    if (meld.kind === 'set') {
      slots.push({
        meldId: meld.id,
        index,
        rank: meld.rank,
        suit: null,
        description: `any ${rankLabel(meld.rank)}`,
      })
    } else {
      const slot = meld.startSlot + index
      slots.push({
        meldId: meld.id,
        index,
        rank: slotToRank(slot),
        suit: meld.suit,
        description: slotLabel(slot, meld.suit),
      })
    }
  })
  return slots
}

/** Can this card buy that Joker? A Joker can never be swapped for another Joker. */
export function canStealJoker(meld: Meld, index: number, card: Card): boolean {
  if (card.isJoker) return false
  const occupant = meld.cards[index]
  if (!occupant || !occupant.isJoker) return false
  if (meld.kind === 'set') return card.rank === meld.rank
  return cardFitsSlot(card, meld.suit, meld.startSlot + index)
}

/** Swap a natural card in for a Joker, returning the new meld and the freed Joker. */
export function applyJokerSteal(
  meld: Meld,
  index: number,
  card: Card,
): { meld: Meld; joker: Card } {
  const joker = meld.cards[index]!
  const cards = meld.cards.slice()
  cards[index] = card
  return { meld: { ...meld, cards } as Meld, joker }
}

export function describeMeld(meld: Meld): string {
  if (meld.kind === 'set') {
    return `${meld.cards.length}× ${rankLabel(meld.rank)}`
  }
  const start = rankLabel(slotToRank(meld.startSlot))
  const end = rankLabel(slotToRank(runEndSlot(meld)))
  return `${start}–${end}${SUIT_SYMBOL[meld.suit]}`
}

export function describeMeldCards(meld: Meld): string {
  return meld.cards.map(cardLabel).join(' ')
}
