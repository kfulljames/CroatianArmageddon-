/**
 * The opponents.
 *
 * There is one bot, not three. Difficulty is a set of knobs on the same decision
 * procedure, which keeps the levels honest: Hard is not a different player, it is
 * this player paying attention to more of what is on the table.
 *
 *   Easy   — plays its own hand only. Throws its most expensive card, grabs anything
 *            that looks vaguely useful even when it costs a penalty, ignores Jokers
 *            sitting in other people's melds.
 *   Normal — throws by what the card is worth to the hand rather than its face value,
 *            takes a penalty card only when the claim actually unlocks an opening,
 *            and buys Jokers when they let it open.
 *   Hard   — all of that, plus it will not feed the table a card that is immediately
 *            kickable onto someone else's meld, and it reads the flipped draw pile,
 *            whose order is public knowledge once the discards have been turned over.
 */

import type { Card } from '../engine/cards.ts'
import { cardPoints } from '../engine/cards.ts'
import type { Action } from '../engine/actions.ts'
import { type LegalMoves, legalMoves } from '../engine/actions.ts'
import { kickOptions } from '../engine/melds.ts'
import { type OpeningPlan, findOpenings } from '../engine/openings.ts'
import { roundSpec } from '../engine/rounds.ts'
import {
  type GameState,
  playerById,
  topDiscard,
} from '../engine/state.ts'
import { cardContribution, cardWouldHelp, handRisk } from './evaluate.ts'

export type Difficulty = 'easy' | 'normal' | 'hard'

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard']

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Easy',
  normal: 'Normal',
  hard: 'Hard',
}

/** Would this card slot straight onto something already on the table? */
function isKickableNow(state: GameState, card: Card): boolean {
  return state.melds.some((meld) => kickOptions(meld, card).length > 0)
}

/**
 * How much future a card has once you have opened.
 *
 * This is the single most important thing to understand about the endgame. Your hand
 * only shrinks by kicking — drawing and discarding leaves it exactly the same size —
 * so a card that can never be kicked anywhere can never leave your hand, and holding
 * one means you cannot go out at all. Its point value is beside the point.
 *
 *   2 — it goes down right now.
 *   1 — no home yet, but a run of its suit could grow to reach it.
 *   0 — dead. No set of its rank and no run of its suit exists, and no more melds
 *       can be laid this round, so nothing will ever accept it.
 */
function kickPotential(state: GameState, card: Card): number {
  if (card.isJoker) return 2
  if (isKickableNow(state, card)) return 2
  const hasFuture = state.melds.some((meld) =>
    meld.kind === 'set' ? meld.rank === card.rank : meld.suit === card.suit,
  )
  return hasFuture ? 1 : 0
}

/** Would this card help an opponent specifically? Used by Hard to avoid feeding. */
function feedsAnOpponent(state: GameState, card: Card, selfId: string): boolean {
  return state.melds.some(
    (meld) =>
      meld.ownerId !== selfId && kickOptions(meld, card).length > 0,
  )
}

/** A cheap "does this look useful" test, for the Easy bot's grabby instincts. */
function looksUseful(hand: readonly Card[], card: Card): boolean {
  if (card.isJoker) return true
  return hand.some(
    (held) =>
      !held.isJoker &&
      (held.rank === card.rank ||
        (held.suit === card.suit && Math.abs((held.rank ?? 0) - (card.rank ?? 0)) <= 2)),
  )
}

/** Whether taking this card would let the hand open, which is worth a penalty card. */
function unlocksOpening(hand: readonly Card[], card: Card, state: GameState): boolean {
  const spec = roundSpec(state.round)
  const before = findOpenings(hand, spec, { limit: 1 }).length > 0
  if (before) return true
  return findOpenings([...hand, card], spec, { limit: 1 }).length > 0
}

function chooseClaim(state: GameState, difficulty: Difficulty): Action {
  const moves = legalMoves(state)
  const card = moves.claimCard
  const responderId = moves.claimPlayerId
  if (!card || !responderId) return { type: 'claimResponse', want: false }

  const responder = playerById(state, responderId)
  const spec = roundSpec(state.round)
  const helps = cardWouldHelp(responder.hand, card, spec)
  const kickable = responder.hasOpened && isKickableNow(state, card)

  if (difficulty === 'easy') {
    // Grabby: takes anything that looks like it might fit, penalty be damned. This
    // is the behaviour the written rules warn has ended friendships.
    return { type: 'claimResponse', want: looksUseful(responder.hand, card) }
  }

  if (!moves.claimCostsPenalty) {
    // Free: it replaces the blind draw, so take it only when it beats a random card.
    // Once open, "useful" means kickable and nothing else — a card that cannot go
    // down is worse than an unknown one, because the unknown one might go down.
    const worthTaking = responder.hasOpened ? kickable || card.isJoker : helps || card.isJoker
    return { type: 'claimResponse', want: worthTaking }
  }

  // Out of turn costs a penalty card too, so it has to genuinely unlock something.
  let want = kickable || unlocksOpening(responder.hand, card, state)

  if (difficulty === 'hard' && want && !responder.hasOpened) {
    // Two more cards is two more things to be caught holding. If the hand is already
    // cheap and the round is late, sit on your hands.
    const cost = cardPoints(card) + 6
    if (handRisk(responder.hand) + cost > 60 && !unlocksOpening(responder.hand, card, state)) {
      want = false
    }
  }

  return { type: 'claimResponse', want }
}

function chooseDraw(state: GameState, difficulty: Difficulty): Action {
  const moves = legalMoves(state)
  const player = playerById(state, moves.playerId!)
  const top = topDiscard(state)
  const spec = roundSpec(state.round)

  if (moves.canTakeDiscard && top) {
    const helps = cardWouldHelp(player.hand, top, spec)
    const kickable = player.hasOpened && isKickableNow(state, top)

    const worthTaking = player.hasOpened ? kickable || top.isJoker : helps || top.isJoker

    if (difficulty === 'easy') {
      if (looksUseful(player.hand, top)) return { type: 'takeDiscard' }
    } else if (worthTaking) {
      // Hard bots know what is coming off a flipped pile and can prefer it.
      if (difficulty === 'hard' && state.drawPileKnown) {
        const nextCard = state.drawPile[state.drawPile.length - 1]
        if (nextCard && cardWouldHelp(player.hand, nextCard, spec) && !helps) {
          return { type: 'drawFromPile' }
        }
      }
      return { type: 'takeDiscard' }
    }
  }

  if (moves.canDrawFromPile) return { type: 'drawFromPile' }
  // Nothing left to draw; taking the discard is the only way to keep playing.
  return { type: 'takeDiscard' }
}

function chooseDiscard(state: GameState, difficulty: Difficulty, moves: LegalMoves): Action {
  const player = playerById(state, moves.playerId!)
  const spec = roundSpec(state.round)

  if (difficulty === 'easy') {
    // Sheds the most expensive card it is holding and thinks no further.
    const worst = [...player.hand].sort((a, b) => cardPoints(b) - cardPoints(a))[0]!
    return { type: 'discard', cardId: worst.id }
  }

  const scored = player.hand.map((card) => ({
    card,
    // Before opening, a card is worth keeping if it builds toward the requirement.
    // After opening, all that matters is whether it can ever be kicked, because a
    // card that cannot leave your hand is a card that stops you going out.
    keep: player.hasOpened
      ? kickPotential(state, card)
      : cardContribution(player.hand, card, spec),
    // Hard would rather not hand an opponent a free kick — but only as a tie-break.
    // Throwing a card you could have used, purely to avoid helping someone, costs
    // you more than it costs them.
    feeds: difficulty === 'hard' && feedsAnOpponent(state, card, player.id) ? 1 : 0,
    points: cardPoints(card),
  }))

  scored.sort((a, b) => {
    if (a.keep !== b.keep) return a.keep - b.keep
    if (a.feeds !== b.feeds) return a.feeds - b.feeds
    return b.points - a.points
  })

  return { type: 'discard', cardId: scored[0]!.card.id }
}

/**
 * Pick which opening to lay when there is a choice.
 *
 * This is the deepest decision in the game and it is easy to miss. The number of
 * melds is fixed for the round, so once everyone has opened, the ranks and suits on
 * the table are settled for good — and a card that matches none of them can never be
 * kicked, which means it can never leave your hand. Choosing your melds is therefore
 * choosing which of your own leftovers you will still be holding at the end.
 *
 * So prefer the opening that leaves the fewest stranded cards, and only then worry
 * about Jokers and points.
 */
function bestPlanForShedding(
  state: GameState,
  plans: readonly OpeningPlan[],
): OpeningPlan | undefined {
  if (plans.length <= 1) return plans[0]

  const strandedCount = (plan: OpeningPlan): number => {
    const liveRanks = new Set<number>()
    const liveSuits = new Set<string>()
    for (const meld of state.melds) {
      if (meld.kind === 'set') liveRanks.add(meld.rank)
      else liveSuits.add(meld.suit)
    }
    for (const proposal of plan.proposals) {
      if (proposal.kind === 'set') {
        const natural = proposal.cards.find((card) => !card.isJoker)
        if (natural?.rank != null) liveRanks.add(natural.rank)
      } else {
        const natural = proposal.cards.find((card) => !card.isJoker)
        if (natural?.suit != null) liveSuits.add(natural.suit)
      }
    }
    return plan.leftover.filter(
      (card) =>
        !card.isJoker &&
        !liveRanks.has(card.rank!) &&
        !liveSuits.has(card.suit!),
    ).length
  }

  return [...plans].sort((a, b) => {
    const stranded = strandedCount(a) - strandedCount(b)
    if (stranded !== 0) return stranded
    if (a.jokersUsed !== b.jokersUsed) return a.jokersUsed - b.jokersUsed
    return handRisk(a.leftover) - handRisk(b.leftover)
  })[0]
}

function choosePlay(state: GameState, difficulty: Difficulty): Action {
  const moves = legalMoves(state)
  const player = playerById(state, moves.playerId!)
  const spec = roundSpec(state.round)

  // Opening is almost always right: in rounds 1–6 it unlocks kicking, and in round 7
  // it is the only way to open at all, because opening *is* going out.
  if (moves.canOpen) {
    const plans = findOpenings(player.hand, spec, { limit: 8 })
    const plan = difficulty === 'hard' ? bestPlanForShedding(state, plans) : plans[0]
    if (plan) return { type: 'open', proposals: plan.proposals }
  }

  // Buying a Joker out of a meld does not cost the turn and does not change hand
  // size, so it is worth doing whenever it unlocks the opening.
  if (difficulty !== 'easy' && !player.hasOpened) {
    for (const steal of moves.steals) {
      const given = player.hand.find((card) => card.id === steal.cardId)
      if (!given) continue
      const after = [
        ...player.hand.filter((card) => card.id !== steal.cardId),
        { id: 'joker-probe', suit: null, rank: null, isJoker: true } as Card,
      ]
      if (findOpenings(after, spec, { limit: 1 }).length > 0) {
        return { type: 'stealJoker', meldId: steal.meldId, index: steal.index, cardId: steal.cardId }
      }
    }
  }

  // Shed whatever will go. Highest-value cards first, so the hand gets cheap fast.
  if (moves.kicks.length > 0) {
    const byValue = [...moves.kicks].sort((a, b) => {
      const cardA = player.hand.find((card) => card.id === a.cardId)!
      const cardB = player.hand.find((card) => card.id === b.cardId)!
      return cardPoints(cardB) - cardPoints(cardA)
    })
    const best = byValue[0]!
    return { type: 'kick', cardId: best.cardId, meldId: best.meldId, position: best.position }
  }

  return chooseDiscard(state, difficulty, moves)
}

/**
 * Decide one action for whichever player the game is currently waiting on.
 *
 * Returns a single action rather than a whole turn so the caller can animate, log,
 * or interleave. Drive it in a loop until the phase moves on.
 */
export function chooseAction(state: GameState, difficulty: Difficulty): Action {
  switch (state.phase) {
    case 'claim':
      return chooseClaim(state, difficulty)
    case 'draw':
      return chooseDraw(state, difficulty)
    case 'play':
      return choosePlay(state, difficulty)
    case 'roundEnd':
      return { type: 'startNextRound' }
    default:
      throw new Error(`No bot action for phase: ${state.phase}`)
  }
}
