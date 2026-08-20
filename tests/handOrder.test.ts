/** How a hand is arranged for display. Purely presentational, but it is what a
 *  player looks at all game, so it gets the same treatment as the rules. */

import { describe, expect, it } from 'vitest'
import { c, hand } from './helpers.ts'
import {
  DEFAULT_LAYOUT,
  applyCustomOrder,
  moveCard,
  orderHand,
  type HandLayout,
} from '../src/ui/handOrder.ts'

const layout = (patch: Partial<HandLayout>): HandLayout => ({ ...DEFAULT_LAYOUT, ...patch })
const labels = (cards: { rank: number | null; suit: string | null; isJoker: boolean }[]) =>
  cards.map((card) => (card.isJoker ? 'JK' : `${card.rank}${card.suit![0]}`)).join(' ')

describe('sorting by rank', () => {
  it('puts every card of a rank together, ignoring suit', () => {
    const cards = hand('9H 3S 9C 3D KH')
    expect(labels(orderHand(cards, layout({ mode: 'rank' })))).toBe('3s 3d 9h 9c 13h')
  })

  it('sorts the Ace below the 2 when the Ace is low', () => {
    const cards = hand('KS AS 2S')
    expect(labels(orderHand(cards, layout({ mode: 'rank', aceHigh: false })))).toBe('1s 2s 13s')
  })

  it('sorts the Ace above the King when the Ace is high', () => {
    const cards = hand('KS AS 2S')
    expect(labels(orderHand(cards, layout({ mode: 'rank', aceHigh: true })))).toBe('2s 13s 1s')
  })
})

describe('sorting by suit', () => {
  it('groups each suit and runs it in sequence', () => {
    const cards = hand('5H 2S 9H KS 7D')
    expect(labels(orderHand(cards, layout({ mode: 'suit' })))).toBe('2s 13s 5h 9h 7d')
  })

  it('moves the Ace within its own suit, not out of it', () => {
    const cards = hand('AH 5H KH 2S')
    expect(labels(orderHand(cards, layout({ mode: 'suit', aceHigh: false })))).toBe(
      '2s 1h 5h 13h',
    )
    expect(labels(orderHand(cards, layout({ mode: 'suit', aceHigh: true })))).toBe(
      '2s 5h 13h 1h',
    )
  })

  it('alternates black and red so the groups separate at a glance', () => {
    const cards = hand('2D 2C 2H 2S')
    expect(labels(orderHand(cards, layout({ mode: 'suit' })))).toBe('2s 2h 2c 2d')
  })
})

describe('Jokers', () => {
  it('parks them at the end of a sorted hand', () => {
    const cards = [c('JK0'), ...hand('5H 2S'), c('JK1')]
    expect(labels(orderHand(cards, layout({ mode: 'suit' })))).toBe('2s 5h JK JK')
    expect(labels(orderHand(cards, layout({ mode: 'rank' })))).toBe('2s 5h JK JK')
  })

  it('lets you put one wherever you want it', () => {
    const cards = [...hand('2S 3S 5S'), c('JK0')]
    const arranged = moveCard(cards, c('JK0').id, 2)
    expect(labels(applyCustomOrder(cards, arranged))).toBe('2s 3s JK 5s')
  })
})

describe('an arrangement you made by hand', () => {
  it('is kept exactly', () => {
    const cards = hand('2S 5H 9C')
    const order = [c('9C').id, c('2S').id, c('5H').id]
    expect(labels(orderHand(cards, layout({ mode: 'custom', customOrder: order })))).toBe(
      '9c 2s 5h',
    )
  })

  it('survives cards leaving the hand', () => {
    const order = [c('9C').id, c('2S').id, c('5H').id]
    const afterPlaying5H = hand('2S 9C')
    expect(labels(applyCustomOrder(afterPlaying5H, order))).toBe('9c 2s')
  })

  it('puts a newly drawn card on the end, where you will notice it', () => {
    const order = [c('9C').id, c('2S').id]
    const afterDrawing = hand('2S 9C KD')
    expect(labels(applyCustomOrder(afterDrawing, order))).toBe('9c 2s 13d')
  })

  it('is unbothered by ids it has never seen', () => {
    const order = ['not-a-card', c('2S').id]
    expect(labels(applyCustomOrder(hand('2S 9C'), order))).toBe('2s 9c')
  })
})

describe('moving a card', () => {
  it('slides it to the position you dropped it at', () => {
    const cards = hand('2S 3S 4S 5S')
    expect(applyCustomOrder(cards, moveCard(cards, c('5S').id, 0)).map((x) => x.rank)).toEqual([
      5, 2, 3, 4,
    ])
    expect(applyCustomOrder(cards, moveCard(cards, c('2S').id, 3)).map((x) => x.rank)).toEqual([
      3, 4, 5, 2,
    ])
  })

  it('clamps to the ends rather than losing the card', () => {
    const cards = hand('2S 3S 4S')
    expect(moveCard(cards, c('2S').id, 99)).toHaveLength(3)
    expect(moveCard(cards, c('4S').id, -5)[0]).toBe(c('4S').id)
  })

  it('leaves the hand alone when the card is not in it', () => {
    const cards = hand('2S 3S')
    expect(moveCard(cards, 'nope', 0)).toEqual([c('2S').id, c('3S').id])
  })
})
