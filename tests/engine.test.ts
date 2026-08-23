/** Core mechanics: decks, meld structure, kicks, and a full turn cycle. */

import { describe, expect, it } from 'vitest'
import { allCardIds, c, hand, newGame, withState } from './helpers.ts'
import { buildShoe } from '../src/engine/cards.ts'
import { DECK_COUNT, JOKERS_PER_DECK, PLAYER_COUNT, SHOE_SIZE } from '../src/engine/config.ts'
import { buildRun, buildSet, describeMeld, kickOptions, applyKick } from '../src/engine/melds.ts'
import { createGame, reduce } from '../src/engine/reduce.ts'
import { findOpenings } from '../src/engine/openings.ts'
import { ROUNDS, openingSize, roundSpec } from '../src/engine/rounds.ts'

const okRun = (specs: string, deck = 0) => {
  const built = buildRun({ kind: 'run', cards: hand(specs, deck) }, 'p0', 'm1')
  if (!built.ok) throw new Error(built.reason)
  return built.meld
}

describe('the shoe', () => {
  it('is two decks with three Jokers each — six Jokers, 110 cards', () => {
    const shoe = buildShoe()
    expect(DECK_COUNT).toBe(2)
    expect(JOKERS_PER_DECK).toBe(3)
    expect(shoe.filter((card) => card.isJoker)).toHaveLength(6)
    expect(shoe).toHaveLength(110)
    expect(shoe).toHaveLength(SHOE_SIZE)
  })

  it('holds exactly two of every face', () => {
    const shoe = buildShoe()
    const naturals = shoe.filter((card) => !card.isJoker)
    expect(naturals).toHaveLength(104)
    const sevenOfSpades = naturals.filter(
      (card) => card.rank === 7 && card.suit === 'spades',
    )
    expect(sevenOfSpades).toHaveLength(2)
  })

  it('gives every physical card a unique id', () => {
    const shoe = buildShoe()
    expect(new Set(shoe.map((card) => card.id)).size).toBe(shoe.length)
  })
})

describe('the table', () => {
  it('is always four-handed', () => {
    expect(PLAYER_COUNT).toBe(4)
    expect(newGame().players).toHaveLength(4)
  })

  it('refuses to start with any other number of players', () => {
    expect(() =>
      createGame({
        seed: 1,
        players: [
          { id: 'a', name: 'A', isHuman: true },
          { id: 'b', name: 'B', isHuman: false },
          { id: 'c', name: 'C', isHuman: false },
        ],
      }),
    ).toThrow(/played 4-handed/)
  })
})

describe('runs', () => {
  it('accepts an Ace low', () => {
    const meld = okRun('AS 2S 3S 4S')
    expect(meld.startSlot).toBe(1)
    expect(describeMeld(meld)).toBe('A–4♠')
  })

  it('accepts an Ace high', () => {
    const meld = okRun('JS QS KS AS')
    expect(meld.startSlot).toBe(11)
  })

  it('refuses to wrap around from King through Ace to 2', () => {
    const built = buildRun({ kind: 'run', cards: hand('QS KS AS 2S') }, 'p0', 'm1')
    expect(built.ok).toBe(false)
  })

  it('refuses a run shorter than four', () => {
    const built = buildRun({ kind: 'run', cards: hand('2S 3S 4S') }, 'p0', 'm1')
    expect(built.ok).toBe(false)
  })

  it('refuses a run of mixed suits', () => {
    const built = buildRun({ kind: 'run', cards: hand('2S 3S 4H 5S') }, 'p0', 'm1')
    expect(built.ok).toBe(false)
  })

  it('refuses a run made only of Jokers', () => {
    const built = buildRun(
      { kind: 'run', cards: [c('JK0'), c('JK1'), c('JK2'), c('JK0', 1)] },
      'p0',
      'm1',
    )
    expect(built.ok).toBe(false)
  })

  it('places a Joker by its position in the given order', () => {
    expect(okRun('4S JK 6S 7S').cards[1]!.isJoker).toBe(true)
    expect(okRun('4S JK 6S 7S').startSlot).toBe(4)
  })
})

describe('sets', () => {
  it('accepts three of a rank', () => {
    const built = buildSet({ kind: 'set', cards: hand('4H 4C 4S') }, 'p0', 'm1')
    expect(built.ok).toBe(true)
  })

  it('accepts duplicates of the same suit', () => {
    const built = buildSet(
      { kind: 'set', cards: [c('4H', 0), c('4H', 1), c('4C', 0)] },
      'p0',
      'm1',
    )
    expect(built.ok).toBe(true)
  })

  it('refuses mixed ranks', () => {
    const built = buildSet({ kind: 'set', cards: hand('4H 4C 5S') }, 'p0', 'm1')
    expect(built.ok).toBe(false)
  })

  it('refuses fewer than three cards', () => {
    const built = buildSet({ kind: 'set', cards: hand('4H 4C') }, 'p0', 'm1')
    expect(built.ok).toBe(false)
  })

  it('requires an all-Joker set to declare its rank', () => {
    const built = buildSet({ kind: 'set', cards: [c('JK0'), c('JK1'), c('JK2')] }, 'p0', 'm1')
    expect(built.ok).toBe(false)
  })
})

describe('kicking', () => {
  it('extends a run at either end', () => {
    const meld = okRun('4S 5S 6S 7S')
    expect(kickOptions(meld, c('3S')).map((option) => option.position)).toEqual(['start'])
    expect(kickOptions(meld, c('8S')).map((option) => option.position)).toEqual(['end'])
  })

  it('refuses a card that is not in the run direction', () => {
    const meld = okRun('4S 5S 6S 7S')
    // A second 5♠ cannot be inserted mid-run; runs only grow at the ends.
    expect(kickOptions(meld, c('5S', 1))).toHaveLength(0)
    expect(kickOptions(meld, c('9S'))).toHaveLength(0)
  })

  it('refuses a run card of the wrong suit', () => {
    expect(kickOptions(okRun('4S 5S 6S 7S'), c('8H'))).toHaveLength(0)
  })

  it('stops a run at the high Ace', () => {
    const meld = okRun('TS JS QS KS')
    // The Ace caps it; nothing follows, because runs cannot wrap to the 2.
    expect(kickOptions(meld, c('AS')).map((option) => option.position)).toEqual(['end'])
    const capped = applyKick(meld, c('AS'), 'end')
    expect(kickOptions(capped, c('2S'))).toHaveLength(0)
  })

  it('takes any card of the rank onto a set, including a Joker', () => {
    const built = buildSet({ kind: 'set', cards: hand('4H 4C 4S') }, 'p0', 'm1')
    if (!built.ok) throw new Error(built.reason)
    expect(kickOptions(built.meld, c('4D'))).toHaveLength(1)
    expect(kickOptions(built.meld, c('JK'))).toHaveLength(1)
    expect(kickOptions(built.meld, c('5D'))).toHaveLength(0)
  })
})

describe('opening search', () => {
  it('finds two three of a kinds for round 1', () => {
    const plans = findOpenings(hand('4H 4C 4S 9D 9H 9C KS'), roundSpec(1))
    expect(plans.length).toBeGreaterThan(0)
    expect(plans[0]!.proposals).toHaveLength(2)
  })

  it('will not use one rank for two separate three of a kinds', () => {
    // Six Kings are one set of six, never two sets of three.
    const sixKings = [
      ...hand('KH KC KS', 0),
      ...hand('KH KC KS', 1),
      ...hand('2D', 0),
    ]
    const plans = findOpenings(sixKings, roundSpec(1))
    expect(plans).toHaveLength(0)
  })

  it('uses a Joker to fill a gap', () => {
    const plans = findOpenings(hand('4S 5S JK 7S 9D 9H 9C KS'), roundSpec(2))
    expect(plans.length).toBeGreaterThan(0)
    expect(plans[0]!.jokersUsed).toBeGreaterThan(0)
  })

  it('prefers plans that spend fewer Jokers', () => {
    const plans = findOpenings(hand('4S 5S 6S 7S JK 9D 9H 9C KS'), roundSpec(2))
    expect(plans[0]!.jokersUsed).toBe(0)
  })

  it('finds nothing when the hand cannot meet the requirement', () => {
    expect(findOpenings(hand('2H 4C 6S 8D TH QC AS'), roundSpec(1))).toHaveLength(0)
  })
})

describe('a full turn', () => {
  it('runs draw, open, kick, discard and hands the turn on', () => {
    const base = newGame()
    const seat = base.turnIndex
    const state = withState(base, {
      round: 1,
      phase: 'draw',
      players: base.players.map((player, index) =>
        index === seat ? { ...player, hand: hand('4H 4C 4S 9D 9H 9C KS QS') } : player,
      ),
    })

    const drawn = reduce(state, { type: 'drawFromPile' })
    expect(drawn.phase).toBe('play')
    expect(drawn.players[seat]!.hand).toHaveLength(9)

    const opened = reduce(drawn, {
      type: 'open',
      proposals: [
        { kind: 'set', cards: hand('4H 4C 4S') },
        { kind: 'set', cards: hand('9D 9H 9C') },
      ],
    })
    expect(opened.players[seat]!.hasOpened).toBe(true)
    expect(opened.melds).toHaveLength(2)

    const discarded = reduce(opened, { type: 'discard', cardId: c('KS').id })
    expect(discarded.phase).toBe('claim')
    expect(discarded.discardPile.at(-1)!.id).toBe(c('KS').id)

    // Nobody wants it, so the turn passes on.
    let after = discarded
    while (after.phase === 'claim') {
      after = reduce(after, { type: 'claimResponse', want: false })
    }
    expect(after.phase).toBe('draw')
    expect(after.turnIndex).toBe((seat + 1) % PLAYER_COUNT)
  })

  it('conserves every card through a turn', () => {
    const base = newGame()
    const before = allCardIds(base).sort()
    let state = reduce(base, { type: 'drawFromPile' })
    state = reduce(state, { type: 'discard', cardId: state.players[state.turnIndex]!.hand[0]!.id })
    while (state.phase === 'claim') {
      state = reduce(state, { type: 'claimResponse', want: false })
    }
    expect(allCardIds(state).sort()).toEqual(before)
  })

  it('ends the round when the discarder empties their hand', () => {
    const base = newGame()
    const seat = base.turnIndex
    const state = withState(base, {
      phase: 'play',
      players: base.players.map((player, index) =>
        index === seat ? { ...player, hand: hand('KS'), hasOpened: true } : player,
      ),
    })
    const after = reduce(state, { type: 'discard', cardId: c('KS').id })
    expect(after.phase).toBe('roundEnd')
    expect(after.scoreSheet).toHaveLength(1)
    expect(after.scoreSheet[0]![base.players[seat]!.id]).toBe(0)
  })
})

describe('melds have minimum sizes, not fixed ones', () => {
  it('takes every Jack in the shoe as one three of a kind', () => {
    // Two decks hold eight Jacks: four suits, twice over.
    const everyJack = [...hand('JH JC JS JD', 0), ...hand('JH JC JS JD', 1)]
    const built = buildSet({ kind: 'set', cards: everyJack }, 'p0', 'm1')
    expect(built.ok).toBe(true)
    if (built.ok) {
      expect(built.meld.cards).toHaveLength(8)
      expect(built.meld.rank).toBe(11)
    }
  })

  it('takes a ninth Jack once a Joker stands in for one', () => {
    const nineJacks = [...hand('JH JC JS JD', 0), ...hand('JH JC JS JD', 1), c('JK0')]
    const built = buildSet({ kind: 'set', cards: nineJacks }, 'p0', 'm1')
    expect(built.ok).toBe(true)
    if (built.ok) expect(built.meld.cards).toHaveLength(9)
  })

  it('will not split a pile of one rank into two three of a kinds', () => {
    // Eight Jacks are one meld of eight, never two of three or four.
    const eightJacks = [...hand('JH JC JS JD', 0), ...hand('JH JC JS JD', 1)]
    expect(findOpenings([...eightJacks, ...hand('2D')], roundSpec(1))).toHaveLength(0)
  })

  it('lays a long run as a single run', () => {
    const built = buildRun({ kind: 'run', cards: hand('2S 3S 4S 5S 6S 7S 8S 9S TS') }, 'p0', 'm1')
    expect(built.ok).toBe(true)
    if (built.ok) expect(built.meld.cards).toHaveLength(9)
  })

  it('lays a whole suit, low Ace through high Ace, as one run of fourteen', () => {
    const wholeSuit = [...hand('AS 2S 3S 4S 5S 6S 7S 8S 9S TS JS QS KS'), c('AS', 1)]
    const built = buildRun({ kind: 'run', cards: wholeSuit, startSlot: 1 }, 'p0', 'm1')
    expect(built.ok).toBe(true)
    if (built.ok) expect(built.meld.cards).toHaveLength(14)
  })

  it('keeps accepting kicks onto a meld that is already long', () => {
    const bigSet = buildSet(
      { kind: 'set', cards: [...hand('JH JC JS JD', 0), ...hand('JH JC', 1)] },
      'p0',
      'm1',
    )
    if (!bigSet.ok) throw new Error(bigSet.reason)
    expect(kickOptions(bigSet.meld, c('JS', 1))).toHaveLength(1)
    expect(kickOptions(bigSet.meld, c('JK1'))).toHaveLength(1)

    const longRun = okRun('2S 3S 4S 5S 6S 7S 8S')
    expect(kickOptions(longRun, c('9S')).map((option) => option.position)).toEqual(['end'])
    expect(kickOptions(longRun, c('AS')).map((option) => option.position)).toEqual(['start'])
  })

  it('opens round 1 with an oversized set alongside a normal one', () => {
    const plans = findOpenings(
      [...hand('JH JC JS JD', 0), ...hand('JH JC', 1), ...hand('9D 9H 9C 2S')],
      roundSpec(1),
    )
    expect(plans.length).toBeGreaterThan(0)
    const jacks = plans[0]!.proposals.find(
      (proposal) => proposal.kind === 'set' && proposal.cards.some((card) => card.rank === 11),
    )
    // All six Jacks go down together rather than three being left stranded in hand.
    expect(jacks!.cards).toHaveLength(6)
  })
})

describe('the shape of the seven rounds', () => {
  it('grows the opening by exactly one card each round: 6, 7, 8, 9, 10, 11, 12', () => {
    expect(ROUNDS.map(openingSize)).toEqual([6, 7, 8, 9, 10, 11, 12])
  })

  it('deals nine cards for the first three rounds and twelve from the fourth', () => {
    expect(ROUNDS.map((spec) => spec.cardsDealt)).toEqual([9, 9, 9, 12, 12, 12, 12])
  })

  it('always leaves you room to hold cards back, except in round 7', () => {
    // You are dealt more than the opening needs, right up until the final round,
    // where the opening is the whole hand and laying it down is going out.
    for (const spec of ROUNDS) {
      const slack = spec.cardsDealt - openingSize(spec)
      expect(slack).toBeGreaterThanOrEqual(0)
      if (spec.round === 7) expect(slack).toBe(0)
      else expect(slack).toBeGreaterThan(0)
    }
  })
})
