/**
 * One test per Ruling.
 *
 * These are the decisions that resolved gaps in the written rules. They are the most
 * likely things to be misremembered or accidentally "fixed" later, so each one is
 * pinned here by name.
 */

import { describe, expect, it } from 'vitest'
import { c, hand, newGame, withHand, withState } from './helpers.ts'
import { cardPoints, handPoints } from '../src/engine/cards.ts'
import {
  buildRun,
  buildSet,
  canStealJoker,
  jokerSlots,
  kickOptions,
  runsAreSequential,
} from '../src/engine/melds.ts'
import { legalMoves } from '../src/engine/actions.ts'
import { IllegalMoveError, reduce } from '../src/engine/reduce.ts'
import { findOpenings } from '../src/engine/openings.ts'
import { roundSpec } from '../src/engine/rounds.ts'

const run = (specs: string, deck = 0, startSlot?: number) => {
  const built = buildRun(
    { kind: 'run', cards: hand(specs, deck), ...(startSlot != null ? { startSlot } : {}) },
    'p0',
    'm1',
    0,
  )
  if (!built.ok) throw new Error(built.reason)
  return built.meld
}

describe('Ruling 1 — the draw pile is rebuilt by flipping the discards, never shuffled', () => {
  it('leaves the top discard in place and flips the rest over in order', () => {
    const base = newGame()
    // Discard pile from oldest to newest. The 9♠ on top stays put.
    const discards = hand('2C 3C 4C 9S')
    const state = withState(base, {
      drawPile: [],
      discardPile: discards,
      lastThrownCardId: c('9S').id,
      phase: 'draw',
    })

    const after = reduce(state, { type: 'drawFromPile' })

    // The oldest discard is at the bottom of the face-up pile, so flipping the stack
    // puts it on top — 2C is drawn first.
    const drawn = after.players[after.turnIndex]!.hand.at(-1)!
    expect(drawn.id).toBe(c('2C').id)
    // The 9♠ is still the only card on the discard pile.
    expect(after.discardPile.map((card) => card.id)).toEqual([c('9S').id])
    // And the remaining draw order is preserved, not shuffled: 3C then 4C.
    expect(after.drawPile.at(-1)!.id).toBe(c('3C').id)
    expect(after.drawPile.at(-2)!.id).toBe(c('4C').id)
  })
})

describe('Ruling 2 — same-suit runs may gap or overlap, but never run sequentially', () => {
  it('rejects two runs that butt straight up against each other', () => {
    expect(runsAreSequential(run('AS 2S 3S 4S'), run('5S 6S 7S 8S'))).toBe(true)
  })

  it('allows a one-card gap, because the bridge card is not there yet', () => {
    expect(runsAreSequential(run('AS 2S 3S 4S'), run('6S 7S 8S 9S'))).toBe(false)
  })

  it('allows an overlap built from duplicate cards out of two decks', () => {
    // The two 4♠ are different physical cards, one from each deck.
    expect(runsAreSequential(run('AS 2S 3S 4S', 0), run('4S 5S 6S 7S', 1))).toBe(false)
  })

  it('does not care about runs in different suits', () => {
    expect(runsAreSequential(run('AS 2S 3S 4S'), run('5H 6H 7H 8H'))).toBe(false)
  })

  it('blocks a sequential pair when opening round 3', () => {
    const state = withHand(
      withState(newGame(), { round: 3, phase: 'play' }),
      newGame().turnIndex,
      hand('AS 2S 3S 4S 5S 6S 7S 8S KH'),
    )
    const seat = state.turnIndex
    const player = state.players[seat]!
    const plans = findOpenings(player.hand, roundSpec(3))
    // Every plan found must avoid laying A-2-3-4♠ alongside 5-6-7-8♠.
    for (const plan of plans) {
      const runs = plan.proposals.filter((proposal) => proposal.kind === 'run')
      expect(runs).toHaveLength(2)
    }
    // A hand that can *only* form sequential runs cannot open at all.
    const sequentialOnly = findOpenings(hand('AS 2S 3S 4S 5S 6S 7S 8S'), roundSpec(3))
    expect(sequentialOnly).toHaveLength(0)
  })
})

describe('Ruling 3 — melds laid this turn are closed until the next turn', () => {
  it('refuses a kick onto a meld laid down on the current turn', () => {
    const meld = run('AS 2S 3S 4S')
    const laidThisTurn = { ...meld, laidOnTurn: 5 }
    expect(kickOptions(laidThisTurn, c('5S'), 5)).toHaveLength(0)
  })

  it('allows the same kick once the turn has moved on', () => {
    const meld = run('AS 2S 3S 4S')
    const laidEarlier = { ...meld, laidOnTurn: 4 }
    expect(kickOptions(laidEarlier, c('5S'), 5)).toHaveLength(1)
  })

  it('still allows kicking onto melds that were already on the table', () => {
    const meld = run('AS 2S 3S 4S')
    const older = { ...meld, laidOnTurn: 1 }
    // Opening on turn 5 does not close melds laid by anyone on earlier turns.
    expect(kickOptions(older, c('5S'), 5)).toHaveLength(1)
  })
})

describe('Ruling 4 — in rounds 1–6 the last card must leave as a discard', () => {
  it('does not offer a kick that would empty the hand', () => {
    const base = newGame()
    const seat = base.turnIndex
    const meld = { ...run('AS 2S 3S 4S'), laidOnTurn: 0, ownerId: base.players[seat]!.id }
    const state = withState(withHand(base, seat, hand('5S')), {
      phase: 'play',
      turnCounter: 5,
      melds: [meld],
      players: base.players.map((player, index) =>
        index === seat ? { ...player, hand: hand('5S'), hasOpened: true } : player,
      ),
    })

    const moves = legalMoves(state)
    expect(moves.kicks).toHaveLength(0)
    // The card can still be discarded — that is how the round ends.
    expect(moves.discardable).toEqual([c('5S').id])
  })

  it('offers the kick as soon as a spare card is held back', () => {
    const base = newGame()
    const seat = base.turnIndex
    const meld = { ...run('AS 2S 3S 4S'), laidOnTurn: 0, ownerId: base.players[seat]!.id }
    const state = withState(base, {
      phase: 'play',
      turnCounter: 5,
      melds: [meld],
      players: base.players.map((player, index) =>
        index === seat ? { ...player, hand: hand('5S KH'), hasOpened: true } : player,
      ),
    })
    expect(legalMoves(state).kicks).toHaveLength(1)
  })

  it('refuses an opening that would leave nothing to discard', () => {
    const base = newGame()
    const seat = base.turnIndex
    const state = withState(base, {
      round: 1,
      phase: 'play',
      players: base.players.map((player, index) =>
        index === seat ? { ...player, hand: hand('4H 4C 4S 9D 9H 9C') } : player,
      ),
    })
    expect(() =>
      reduce(state, {
        type: 'open',
        proposals: [
          { kind: 'set', cards: hand('4H 4C 4S') },
          { kind: 'set', cards: hand('9D 9H 9C') },
        ],
      }),
    ).toThrow(IllegalMoveError)
  })
})

describe('Ruling 5 — a Joker in a run is pinned to its slot', () => {
  it('reads 4-5-6-Joker of spades as the 7♠ and nothing else', () => {
    const meld = run('4S 5S 6S JK')
    const [slot] = jokerSlots(meld)
    expect(slot!.rank).toBe(7)
    expect(slot!.suit).toBe('spades')
    expect(canStealJoker(meld, 3, c('7S'))).toBe(true)
    // The 3♠ would be a legal reading if the Joker could slide to the other end.
    expect(canStealJoker(meld, 3, c('3S'))).toBe(false)
    expect(canStealJoker(meld, 3, c('7H'))).toBe(false)
  })

  it('reads Joker-5-6-7 of spades as the 4♠', () => {
    const meld = run('JK 5S 6S 7S')
    expect(canStealJoker(meld, 0, c('4S'))).toBe(true)
    expect(canStealJoker(meld, 0, c('8S'))).toBe(false)
  })

  it('lets any card of the rank buy a Joker out of a three of a kind', () => {
    const built = buildSet({ kind: 'set', cards: hand('4H 4C JK') }, 'p0', 'm1', 0)
    if (!built.ok) throw new Error(built.reason)
    const meld = built.meld
    expect(canStealJoker(meld, 2, c('4D'))).toBe(true)
    expect(canStealJoker(meld, 2, c('4S'))).toBe(true)
    // Duplicates are legal in a set, so a second 4♥ works too.
    expect(canStealJoker(meld, 2, c('4H', 1))).toBe(true)
    expect(canStealJoker(meld, 2, c('5D'))).toBe(false)
  })

  it('never lets one Joker be swapped for another', () => {
    const meld = run('4S 5S 6S JK')
    expect(canStealJoker(meld, 3, c('JK', 1))).toBe(false)
  })
})

describe('Ruling 6 — stealing a Joker does not use up your turn', () => {
  it('leaves the hand the same size and keeps the player on turn', () => {
    const base = newGame()
    const seat = base.turnIndex
    const meld = { ...run('4S 5S 6S JK'), laidOnTurn: 1, ownerId: 'p1' }
    const state = withState(base, {
      phase: 'play',
      turnCounter: 5,
      melds: [meld],
      players: base.players.map((player, index) =>
        index === seat ? { ...player, hand: hand('7S KH') } : player,
      ),
    })

    const after = reduce(state, {
      type: 'stealJoker',
      meldId: meld.id,
      index: 3,
      cardId: c('7S').id,
    })

    const player = after.players[seat]!
    expect(player.hand).toHaveLength(2)
    expect(player.hand.some((card) => card.isJoker)).toBe(true)
    expect(after.turnIndex).toBe(seat)
    expect(after.phase).toBe('play')
  })

  it('is available to a player who has not opened', () => {
    const base = newGame()
    const seat = base.turnIndex
    const meld = { ...run('4S 5S 6S JK'), laidOnTurn: 1, ownerId: 'p1' }
    const state = withState(base, {
      phase: 'play',
      turnCounter: 5,
      melds: [meld],
      players: base.players.map((player, index) =>
        index === seat ? { ...player, hand: hand('7S KH'), hasOpened: false } : player,
      ),
    })
    expect(legalMoves(state).steals).toHaveLength(1)
  })

  it('can buy a Joker that is sitting there as a kicker', () => {
    // A Joker kicked onto the end of a run occupies the next slot up, 8♠.
    const meld = run('4S 5S 6S 7S JK')
    expect(canStealJoker(meld, 4, c('8S'))).toBe(true)
  })
})

describe('Ruling 7 — claiming out of turn costs one penalty card and does not move the turn', () => {
  it('gives the claimer the discard plus exactly one penalty', () => {
    const base = newGame()
    const discarder = base.turnIndex
    const state = withState(base, {
      phase: 'claim',
      claim: {
        cardId: base.discardPile.at(-1)!.id,
        order: [1, 2, 3].map((step) => base.players[(discarder + step) % 4]!.id),
        index: 2,
      },
    })

    const claimerId = state.claim!.order[2]!
    const before = state.players.find((player) => player.id === claimerId)!.hand.length
    const after = reduce(state, { type: 'claimResponse', want: true })
    const claimer = after.players.find((player) => player.id === claimerId)!

    expect(claimer.hand.length).toBe(before + 2)
    // The turn still passes to the player immediately clockwise of the discarder.
    expect(after.players[after.turnIndex]!.id).toBe(state.claim!.order[0])
    expect(after.phase).toBe('draw')
  })

  it('charges no penalty when the next player claims, and counts as their draw', () => {
    const base = newGame()
    const discarder = base.turnIndex
    const state = withState(base, {
      phase: 'claim',
      claim: {
        cardId: base.discardPile.at(-1)!.id,
        order: [1, 2, 3].map((step) => base.players[(discarder + step) % 4]!.id),
        index: 0,
      },
    })

    const claimerId = state.claim!.order[0]!
    const before = state.players.find((player) => player.id === claimerId)!.hand.length
    const after = reduce(state, { type: 'claimResponse', want: true })
    const claimer = after.players.find((player) => player.id === claimerId)!

    expect(claimer.hand.length).toBe(before + 1)
    expect(after.players[after.turnIndex]!.id).toBe(claimerId)
    // They have already drawn, so they go straight to playing.
    expect(after.phase).toBe('play')
  })

  it('closes the discard pile to the next player once it has been claimed away', () => {
    const base = newGame()
    const discarder = base.turnIndex
    const state = withState(base, {
      phase: 'claim',
      discardPile: [...base.discardPile, c('9S')],
      lastThrownCardId: c('9S').id,
      claim: {
        cardId: c('9S').id,
        order: [1, 2, 3].map((step) => base.players[(discarder + step) % 4]!.id),
        index: 2,
      },
    })

    const after = reduce(state, { type: 'claimResponse', want: true })
    // The card underneath is exposed but is not the last card thrown, so it is out
    // of bounds for the player now starting their turn.
    expect(legalMoves(after).canTakeDiscard).toBe(false)
  })
})

describe('Ruling 8 — scoring', () => {
  it('scores pips, 10 for face cards, 15 for Aces and Jokers', () => {
    expect(cardPoints(c('2H'))).toBe(2)
    expect(cardPoints(c('9C'))).toBe(9)
    expect(cardPoints(c('TD'))).toBe(10)
    expect(cardPoints(c('JS'))).toBe(10)
    expect(cardPoints(c('QS'))).toBe(10)
    expect(cardPoints(c('KS'))).toBe(10)
    expect(cardPoints(c('AS'))).toBe(15)
    expect(cardPoints(c('JK'))).toBe(15)
  })

  it('scores an Ace at 15 whether it was playing high or low', () => {
    // The same physical Ace, in a low run and a high one.
    expect(handPoints(hand('AS 2S 3S 4S'))).toBe(15 + 2 + 3 + 4)
    expect(handPoints(hand('JS QS KS AS'))).toBe(10 + 10 + 10 + 15)
  })
})

describe('Ruling 9 — round 7 opens only by going out', () => {
  it('rejects an opening that leaves cards in hand', () => {
    const base = newGame()
    const seat = base.turnIndex
    const state = withState(base, {
      round: 7,
      phase: 'play',
      players: base.players.map((player, index) =>
        index === seat
          ? { ...player, hand: hand('AS 2S 3S 4S 5H 6H 7H 8H 2D 3D 4D 5D KC') }
          : player,
      ),
    })

    expect(() =>
      reduce(state, {
        type: 'open',
        proposals: [
          { kind: 'run', cards: hand('AS 2S 3S 4S') },
          { kind: 'run', cards: hand('5H 6H 7H 8H') },
          { kind: 'run', cards: hand('2D 3D 4D 5D') },
        ],
      }),
    ).toThrow(IllegalMoveError)
  })

  it('accepts an opening that empties the hand, and ends the game', () => {
    const base = newGame()
    const seat = base.turnIndex
    const goingOut = hand('AS 2S 3S 4S 5H 6H 7H 8H 2D 3D 4D 5D')
    const state = withState(base, {
      round: 7,
      phase: 'play',
      players: base.players.map((player, index) =>
        index === seat ? { ...player, hand: goingOut } : player,
      ),
    })

    const after = reduce(state, {
      type: 'open',
      proposals: [
        { kind: 'run', cards: hand('AS 2S 3S 4S') },
        { kind: 'run', cards: hand('5H 6H 7H 8H') },
        { kind: 'run', cards: hand('2D 3D 4D 5D') },
      ],
    })

    expect(after.phase).toBe('roundEnd')
    expect(after.players[seat]!.hand).toHaveLength(0)
  })

  it('accepts the whole-suit alternative, low Ace through high Ace', () => {
    const base = newGame()
    const seat = base.turnIndex
    // Fourteen cards: the Ace appears twice, once at each end.
    const fullSuit = [
      ...hand('AS 2S 3S 4S 5S 6S 7S 8S 9S TS JS QS KS'),
      c('AS', 1),
    ]
    const state = withState(base, {
      round: 7,
      phase: 'play',
      players: base.players.map((player, index) =>
        index === seat ? { ...player, hand: fullSuit } : player,
      ),
    })

    const after = reduce(state, {
      type: 'open',
      proposals: [{ kind: 'run', cards: fullSuit, startSlot: 1 }],
    })

    expect(after.phase).toBe('roundEnd')
    expect(after.melds).toHaveLength(1)
    expect(after.melds[0]!.cards).toHaveLength(14)
  })

  it('finds the go-out itself when the hand is exactly three runs', () => {
    const goingOut = hand('AS 2S 3S 4S 5H 6H 7H 8H 2D 3D 4D 5D')
    const plans = findOpenings(goingOut, roundSpec(7))
    expect(plans.length).toBeGreaterThan(0)
    expect(plans[0]!.leftover).toHaveLength(0)
  })
})
