/**
 * Hand evaluation for the bots.
 *
 * The central question a player asks every turn is "how close am I to opening?", and
 * almost every decision falls out of it: which card to throw is the one whose loss
 * costs least, whether to take the discard is whether it gains anything, and whether
 * to claim out of turn is whether the gain is worth two extra cards in hand.
 */

import { type Card, type Suit, SLOT_MAX, cardPoints } from '../engine/cards.ts'
import type { RoundSpec } from '../engine/rounds.ts'
import { MIN_RUN_SIZE, MIN_SET_SIZE, isFinalRound } from '../engine/rounds.ts'

/** Slots a card occupies in its suit. An Ace sits at both ends of the scale. */
function slotsFor(card: Card): number[] {
  if (card.isJoker || card.rank == null) return []
  return card.rank === 1 ? [1, SLOT_MAX] : [card.rank]
}

/** Lengths of the consecutive chains present in each suit, longest first. */
function runChains(hand: readonly Card[]): number[] {
  const bySuit = new Map<Suit, Set<number>>()
  for (const card of hand) {
    if (card.isJoker || card.suit == null) continue
    let slots = bySuit.get(card.suit)
    if (!slots) {
      slots = new Set<number>()
      bySuit.set(card.suit, slots)
    }
    for (const slot of slotsFor(card)) slots.add(slot)
  }

  const chains: number[] = []
  for (const slots of bySuit.values()) {
    let length = 0
    for (let slot = 1; slot <= SLOT_MAX + 1; slot++) {
      if (slots.has(slot)) {
        length++
      } else {
        if (length > 0) chains.push(length)
        length = 0
      }
    }
  }
  return chains.sort((a, b) => b - a)
}

/** Sizes of the rank groups present, largest first. */
function setGroups(hand: readonly Card[]): number[] {
  const counts = new Map<number, number>()
  for (const card of hand) {
    if (card.isJoker || card.rank == null) continue
    counts.set(card.rank, (counts.get(card.rank) ?? 0) + 1)
  }
  return [...counts.values()].sort((a, b) => b - a)
}

/**
 * How much of this round's opening requirement the hand already covers, from 0 to
 * the total number of cards the requirement needs.
 *
 * This is deliberately a heuristic rather than an exact search: it is called for
 * every candidate discard on every turn, and the exact answer already exists in
 * `findOpenings` for when it matters.
 */
export function openProgress(hand: readonly Card[], spec: RoundSpec): number {
  const jokers = hand.filter((card) => card.isJoker).length
  const groups = setGroups(hand)
  const chains = runChains(hand)

  if (isFinalRound(spec.round)) {
    // Round 7 is a different problem, and treating it like the others is a trap.
    // Opening means going out, so the melds have to consume the *whole* hand — and
    // three runs of four is only twelve cards against the thirteen you are holding
    // when you act. At least one run must run long.
    //
    // So nothing is capped at the minimum here. A fourth card in a run is progress
    // and a fifth is too; what matters is covering every card you hold. Capping at
    // the minimum would have a hand stop improving at twelve and sit on a
    // thirteenth card it could never play.
    // Each chain costs a card to get started, so a lone card of a suit is worth
    // nothing and a pair barely more. Scoring `length - 1` keeps the bot pushing its
    // three best chains longer instead of collecting singletons in six suits.
    const longest = chains
      .slice(0, spec.runs)
      .reduce((total, length) => total + Math.max(0, length - 1), 0)
    return Math.min(hand.length, longest + jokers)
  }

  let progress = 0
  for (let i = 0; i < spec.sets; i++) {
    progress += Math.min(groups[i] ?? 0, MIN_SET_SIZE)
  }
  for (let i = 0; i < spec.runs; i++) {
    progress += Math.min(chains[i] ?? 0, MIN_RUN_SIZE)
  }

  const needed = spec.sets * MIN_SET_SIZE + spec.runs * MIN_RUN_SIZE
  // Jokers can stand in for whatever is still missing.
  return Math.min(needed, progress + jokers)
}

/** How much worse the hand gets without this card. Higher means keep it. */
export function cardContribution(
  hand: readonly Card[],
  card: Card,
  spec: RoundSpec,
): number {
  const without = hand.filter((other) => other.id !== card.id)
  return openProgress(hand, spec) - openProgress(without, spec)
}

/** Whether adding this card would move the hand closer to opening. */
export function cardWouldHelp(hand: readonly Card[], card: Card, spec: RoundSpec): boolean {
  return openProgress([...hand, card], spec) > openProgress(hand, spec)
}

/**
 * Rank the hand worst-first for discarding: the cards that contribute nothing, most
 * expensive first, so a bot sheds points rather than potential.
 */
export function discardOrder(hand: readonly Card[], spec: RoundSpec): Card[] {
  return hand
    .map((card) => ({
      card,
      contribution: cardContribution(hand, card, spec),
      points: cardPoints(card),
    }))
    .sort((a, b) => {
      if (a.contribution !== b.contribution) return a.contribution - b.contribution
      return b.points - a.points
    })
    .map((entry) => entry.card)
}

/** Points a hand would concede if the round ended right now. */
export function handRisk(hand: readonly Card[]): number {
  return hand.reduce((total, card) => total + cardPoints(card), 0)
}
