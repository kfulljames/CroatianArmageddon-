/** Writes a saved-game JSON containing deliberately oversized melds, for UI checks. */
import { writeFileSync } from 'node:fs'
import { createGame, reduce } from '../engine/reduce.ts'
import { buildRun, buildSet } from '../engine/melds.ts'
import type { Card, Rank, Suit } from '../engine/cards.ts'

const S: Record<string, Suit> = { C: 'clubs', D: 'diamonds', H: 'hearts', S: 'spades' }
const R: Record<string, Rank> = { A:1,'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,T:10,J:11,Q:12,K:13 }
const c = (spec: string, deck = 0): Card =>
  spec.startsWith('JK')
    ? { id: `d${deck}-JK${spec.slice(2) || '0'}`, suit: null, rank: null, isJoker: true }
    : { id: `d${deck}-${spec.slice(-1)}${R[spec.slice(0, -1)]}`, suit: S[spec.slice(-1)]!, rank: R[spec.slice(0, -1)]!, isJoker: false }
const hand = (s: string, deck = 0) => s.trim().split(/\s+/).map((x) => c(x, deck))

let state = createGame({
  seed: 7,
  players: [
    { id: 'you', name: 'You', isHuman: true },
    { id: 'bot0', name: 'Ana', isHuman: false },
    { id: 'bot1', name: 'Marko', isHuman: false },
    { id: 'bot2', name: 'Ivana', isHuman: false },
  ],
})
state = reduce(state, { type: 'drawFromPile' })

const wholeSuit = buildRun(
  { kind: 'run', cards: [...hand('AS 2S 3S 4S 5S 6S 7S 8S 9S TS JS QS KS'), c('AS', 1)], startSlot: 1 },
  'bot0',
  'm1',
  1,
)
const everyJack = buildSet(
  { kind: 'set', cards: [...hand('JH JC JS JD', 0), ...hand('JH JC JS JD', 1), c('JK0')] },
  'you',
  'm2',
  1,
)
if (!wholeSuit.ok) throw new Error(wholeSuit.reason)
if (!everyJack.ok) throw new Error(everyJack.reason)

const fixture = {
  ...state,
  phase: 'play' as const,
  turnIndex: 0,
  turnCounter: 9,
  melds: [wholeSuit.meld, everyJack.meld],
  players: state.players.map((p) =>
    p.id === 'you' ? { ...p, hasOpened: true, hand: hand('JS QS 9C 4H', 1) } : { ...p, hasOpened: true },
  ),
}

writeFileSync('/tmp/fixture.json', JSON.stringify(fixture))
console.log('wrote fixture: run of', wholeSuit.meld.cards.length, 'and set of', everyJack.meld.cards.length)
