/** Can a player put a Joker onto a meld they laid down themselves? */
import { createGame, reduce } from '../engine/reduce.ts'
import { legalMoves } from '../engine/actions.ts'
import type { Card, Rank, Suit } from '../engine/cards.ts'

const S: Record<string, Suit> = { C:'clubs', D:'diamonds', H:'hearts', S:'spades' }
const R: Record<string, Rank> = { A:1,'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,T:10,J:11,Q:12,K:13 }
const c = (spec: string, deck = 0): Card =>
  spec.startsWith('JK')
    ? { id:`d${deck}-JK${spec.slice(2)||'0'}`, suit:null, rank:null, isJoker:true }
    : { id:`d${deck}-${spec.slice(-1)}${R[spec.slice(0,-1)]}`, suit:S[spec.slice(-1)]!, rank:R[spec.slice(0,-1)]!, isJoker:false }
const hand = (s: string, d = 0) => s.trim().split(/\s+/).map(x => c(x, d))

let state = createGame({
  seed: 5,
  players: Array.from({ length: 4 }, (_, i) => ({ id:`p${i}`, name:`P${i}`, isHuman: i===0 })),
})
const seat = state.turnIndex
const me = state.players[seat]!.id

// Round 1: two three of a kinds, plus a Joker and a spare.
const myHand = [...hand('4H 4C 4S 9D 9H 9C'), c('JK0'), ...c('KS') ? [c('KS')] : []]
state = {
  ...state,
  round: 1,
  phase: 'play',
  players: state.players.map((p, i) => (i === seat ? { ...p, hand: myHand } : p)),
}

state = reduce(state, {
  type: 'open',
  proposals: [
    { kind: 'set', cards: hand('4H 4C 4S') },
    { kind: 'set', cards: hand('9D 9H 9C') },
  ],
})
console.log('opened. my melds:', state.melds.filter(m => m.ownerId === me).length)
console.log('hand now:', state.players[seat]!.hand.map(x => x.isJoker ? 'JK' : `${x.rank}`).join(' '))

const sameTurn = legalMoves(state).kicks
console.log('SAME turn — kicks offered onto my own lays:', sameTurn.length)

// Now move to the next turn and try again.
let next = state
next = reduce(next, { type: 'discard', cardId: c('KS').id })
let guard = 0
while (next.phase !== 'draw' && guard++ < 20) next = reduce(next, { type: 'claimResponse', want: false })
while (next.players[next.turnIndex]!.id !== me && guard++ < 200) {
  const { chooseAction } = await import('../ai/bot.ts')
  next = reduce(next, chooseAction(next, 'normal'))
}
if (next.phase === 'draw') next = reduce(next, { type: 'drawFromPile' })
const laterTurn = legalMoves(next).kicks.filter(k => {
  const card = next.players[next.turnIndex]!.hand.find(x => x.id === k.cardId)
  return card?.isJoker
})
console.log('LATER turn — Joker kicks offered:', laterTurn.length)
