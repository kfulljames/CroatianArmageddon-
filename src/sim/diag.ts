/** How often does the human actually get asked about a discard? */
import { createGame, reduce } from '../engine/reduce.ts'
import { legalMoves } from '../engine/actions.ts'
import { chooseAction } from '../ai/bot.ts'
import { topDiscard, playerById } from '../engine/state.ts'
import { kickOptions } from '../engine/melds.ts'
import { roundSpec } from '../engine/rounds.ts'
import { cardWouldHelp } from '../ai/evaluate.ts'
import type { GameState } from '../engine/state.ts'
import type { Card } from '../engine/cards.ts'

const HUMAN = 'p0'

// Mirrors cardConnects() in the UI store.
function connects(state: GameState, card: Card): boolean {
  const player = playerById(state, HUMAN)
  if (card.isJoker) return true
  if (player.hasOpened) {
    return state.melds.some((m) => kickOptions(m, card, state.turnCounter).length > 0)
  }
  return cardWouldHelp(player.hand, card, roundSpec(state.round))
}

let discards = 0
let humanInOrder = 0      // human was somewhere in the claim queue
let humanReached = 0      // the queue actually got to the human
let askedFree = 0
let askedPenalty = 0
let autoDeclined = 0
let botsClaimed = 0

for (let seed = 1; seed <= 12; seed++) {
  let state = createGame({
    seed,
    players: Array.from({ length: 4 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, isHuman: i === 0 })),
  })
  let lastPhase = state.phase

  for (let i = 0; i < 60000 && state.phase !== 'gameEnd'; i++) {
    // Entering a claim window
    if (lastPhase !== 'claim' && state.phase === 'claim') {
      discards++
      if (state.claim!.order.includes(HUMAN)) humanInOrder++
    }
    if (state.phase === 'claim') {
      const moves = legalMoves(state)
      if (moves.claimPlayerId === HUMAN) {
        humanReached++
        const card = topDiscard(state)
        if (!moves.claimCostsPenalty) askedFree++
        else if (card && connects(state, card)) askedPenalty++
        else autoDeclined++
      }
    }
    lastPhase = state.phase
    const before = state
    // The human passes on everything, so we measure opportunity, not outcome.
    const action =
      state.phase === 'claim' && legalMoves(state).claimPlayerId === HUMAN
        ? ({ type: 'claimResponse', want: false } as const)
        : chooseAction(state, 'normal')
    if (state.phase === 'claim' && legalMoves(state).claimPlayerId !== HUMAN) {
      const a = chooseAction(state, 'normal')
      if (a.type === 'claimResponse' && a.want) botsClaimed++
    }
    state = reduce(state, action)
    if (state === before) break
  }
}

const pct = (n: number) => `${((n / discards) * 100).toFixed(0)}%`
console.log(`discards:                 ${discards}`)
console.log(`human somewhere in queue: ${humanInOrder} (${pct(humanInOrder)})`)
console.log(`queue reached the human:  ${humanReached} (${pct(humanReached)})`)
console.log(`  asked, free:            ${askedFree} (${pct(askedFree)} of all discards)`)
console.log(`  asked, penalty+connects:${askedPenalty} (${pct(askedPenalty)})`)
console.log(`  SILENTLY auto-declined: ${autoDeclined} (${pct(autoDeclined)})`)
console.log(`bot claims taken:         ${botsClaimed} (${pct(botsClaimed)})`)
