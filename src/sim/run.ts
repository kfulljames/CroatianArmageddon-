/**
 * CLI entry point: `npm run simulate -- --games 10000 --players 4 --difficulty normal`
 */

import { simulate, type SimulateOptions } from './simulate.ts'
import { DIFFICULTIES, type Difficulty } from '../ai/bot.ts'

function flag(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? (process.argv[index + 1] ?? fallback) : fallback
}

const games = Number(flag('games', '1000'))
const playerCount = Number(flag('players', '4'))
const difficultyArg = flag('difficulty', 'normal')

const difficulty: SimulateOptions['difficulty'] =
  difficultyArg === 'random'
    ? 'random'
    : DIFFICULTIES.includes(difficultyArg as Difficulty)
      ? (difficultyArg as Difficulty)
      : 'normal'

const started = Date.now()
const summary = simulate(games, { playerCount, difficulty })
const elapsed = ((Date.now() - started) / 1000).toFixed(1)

console.log(`Croatian Armageddon — ${games} games, ${playerCount} players, ${difficultyArg} bots`)
console.log(`  completed in ${elapsed}s`)
console.log(`  average actions per game: ${summary.averageActions.toFixed(0)}`)
console.log(`  average winning score:    ${summary.averageWinningScore.toFixed(1)}`)
console.log(`  games ending in a tie:    ${summary.ties}`)
console.log(`  rounds where cards ran out: ${summary.exhaustedRounds}`)

if (summary.failures.length > 0) {
  console.error(`\n  ${summary.failures.length} FAILURES`)
  for (const failure of summary.failures.slice(0, 10)) {
    console.error(`    seed ${failure.seed}: ${failure.message}`)
  }
  process.exit(1)
}
console.log('\n  no invariant violations')
