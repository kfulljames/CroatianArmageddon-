/**
 * Writes a saved game to /tmp so the interface can be checked against positions that
 * are hard to reach by playing.
 *
 *   npm run fixture            a fourteen-card run and a nine-card set
 *   npm run fixture -- --r7    a round 7 hand that can go out this turn
 *
 * The second one matters most: going out in round 7 is the climax of the game and
 * the least reachable moment in it, so it is worth being able to render on demand
 * rather than waiting for one to occur.
 */
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
)
const everyJack = buildSet(
  { kind: 'set', cards: [...hand('JH JC JS JD', 0), ...hand('JH JC JS JD', 1), c('JK0')] },
  'you',
  'm2',
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

// --r7: a round 7 position where the human can go out immediately.
if (process.argv.includes('--r7')) {
  let base = createGame({
    seed: 3,
    players: [
      { id: 'you', name: 'You', isHuman: true },
      { id: 'bot0', name: 'Ana', isHuman: false },
      { id: 'bot1', name: 'Marko', isHuman: false },
      { id: 'bot2', name: 'Ivana', isHuman: false },
    ],
  })
  base = reduce(base, { type: 'drawFromPile' })
  // Thirteen cards as three runs, one of them five long, so laying them empties the
  // hand — which is the only way round 7 may be opened.
  const goOut = hand('AS 2S 3S 4S 5H 6H 7H 8H 9H 2D 3D 4D 5D')
  writeFileSync(
    '/tmp/fixture.json',
    JSON.stringify({
      ...base,
      round: 7,
      phase: 'play' as const,
      turnIndex: 0,
      turnCounter: 12,
      melds: [],
      players: base.players.map((p) =>
        p.id === 'you' ? { ...p, hasOpened: false, hand: goOut } : { ...p, hasOpened: false },
      ),
    }),
  )
  console.log('wrote round-7 go-out fixture:', goOut.length, 'cards')
}
