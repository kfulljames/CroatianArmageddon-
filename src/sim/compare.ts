/**
 * Difficulty comparison harness: `npm run compare -- --games 150`
 *
 * Seat position matters in this game — the player clockwise of the dealer moves
 * first and that is worth real points — so a difficulty cannot be judged by sitting
 * it in one chair. Each level is rotated through every seat and averaged, with an
 * all-Normal table printed first to show how much of the spread is just the seating.
 */

import { createGame, reduce } from '../engine/reduce.ts'
import { chooseAction, type Difficulty } from '../ai/bot.ts'

function flag(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? (process.argv[index + 1] ?? fallback) : fallback
}

interface TableResult {
  readonly averageScores: number[]
  readonly wins: number[]
}

function runTable(seats: Difficulty[], games: number, seedBase: number): TableResult {
  const totals = seats.map(() => 0)
  const wins = seats.map(() => 0)

  for (let seed = seedBase + 1; seed <= seedBase + games; seed++) {
    let state = createGame({
      seed,
      players: seats.map((difficulty, index) => ({
        id: `p${index}`,
        name: `${difficulty}-${index}`,
        isHuman: false,
      })),
    })

    let guard = 0
    while (state.phase !== 'gameEnd' && guard++ < 40000) {
      // During a claim the actor is whoever is being asked, not whoever is on turn.
      const actorIndex = state.claim
        ? state.players.findIndex((player) => player.id === state.claim!.order[state.claim!.index])
        : state.turnIndex
      state = reduce(state, chooseAction(state, seats[actorIndex]!))
    }

    const scores = state.players.map((player) => player.score)
    scores.forEach((score, index) => {
      totals[index]! += score
    })
    const best = Math.min(...scores)
    scores.forEach((score, index) => {
      if (score === best) wins[index]!++
    })
  }

  return { averageScores: totals.map((total) => total / games), wins }
}

const games = Number(flag('games', '100'))
const seatCount = 4

console.log(`Croatian Armageddon — difficulty comparison over ${games} games per seating\n`)

const baseline = runTable(Array(seatCount).fill('normal'), games, 0)
console.log('Baseline (every seat Normal) — this is pure seat advantage:')
baseline.averageScores.forEach((score, index) => {
  console.log(`  seat ${index}: avg ${score.toFixed(1)}, wins ${baseline.wins[index]}/${games}`)
})

for (const challenger of ['easy', 'hard'] as const) {
  let challengerScore = 0
  let challengerWins = 0
  let fieldScore = 0
  for (let seat = 0; seat < seatCount; seat++) {
    const seats: Difficulty[] = Array(seatCount).fill('normal')
    seats[seat] = challenger
    const result = runTable(seats, games, (seat + 1) * 10000)
    challengerScore += result.averageScores[seat]!
    challengerWins += result.wins[seat]!
    for (let other = 0; other < seatCount; other++) {
      if (other !== seat) fieldScore += result.averageScores[other]!
    }
  }
  const totalGames = games * seatCount
  console.log(`\n${challenger} vs a table of Normal, rotated through every seat:`)
  console.log(
    `  ${challenger}: avg ${(challengerScore / seatCount).toFixed(1)}, wins ${challengerWins}/${totalGames} (${((challengerWins / totalGames) * 100).toFixed(1)}%)`,
  )
  console.log(
    `  normal: avg ${(fieldScore / (seatCount * (seatCount - 1))).toFixed(1)} (expected win rate ${(100 / seatCount).toFixed(0)}%)`,
  )
}
