/**
 * Simulation smoke tests.
 *
 * A small, fast slice of what `npm run simulate` does at volume, so that a rules
 * change that deadlocks the game or loses a card fails the normal test run rather
 * than waiting for someone to remember to run the big sweep.
 */

import { describe, expect, it } from 'vitest'
import { playGame, simulate } from '../src/sim/simulate.ts'

describe('simulated games', () => {
  it('plays 30 games to completion without violating an invariant', () => {
    const summary = simulate(30, { difficulty: 'normal' })
    expect(summary.failures).toEqual([])
    expect(summary.averageActions).toBeGreaterThan(0)
  })

  it('survives random legal play, which reaches positions sensible play never would', () => {
    const summary = simulate(15, { difficulty: 'random' })
    expect(summary.failures).toEqual([])
  })

  it('plays all three difficulties', () => {
    // Easy bots claim greedily, so their hands balloon and their games run long.
    // Three apiece is enough to prove each difficulty drives a game to the end.
    for (const difficulty of ['easy', 'normal', 'hard'] as const) {
      expect(simulate(3, { difficulty }).failures).toEqual([])
    }
  })

  it('always scores exactly seven rounds and finishes on a non-negative score', () => {
    const result = playGame(42, { difficulty: 'normal' })
    expect(result.rounds).toBe(7)
    for (const score of Object.values(result.scores)) {
      expect(score).toBeGreaterThanOrEqual(0)
    }
  })

  /**
   * Twenty years of real play at Dese and Karl's table: a round has never ended with
   * nobody going out, and the draw pile has been recycled twice in all that time.
   *
   * That is a sharper specification than any rule written down, and it caught two
   * real bugs — a stalemate backstop that was killing round 7 before anyone could
   * assemble three runs, and a bot heuristic that stopped valuing a run at four
   * cards when round 7 needs thirteen cards across three runs.
   */
  it('always produces a winner in rounds 1 to 6, as it does at a real table', () => {
    const stuck: number[] = []
    for (let seed = 1; seed <= 25; seed++) {
      const result = playGame(seed, { difficulty: 'normal' })
      stuck.push(...result.roundsWithoutWinner.filter((round) => round < 7))
    }
    expect(stuck).toEqual([])
  })

  it('nearly always produces a winner in round 7 too', () => {
    let wentOut = 0
    const games = 15
    for (let seed = 500; seed < 500 + games; seed++) {
      const result = playGame(seed, { difficulty: 'normal' })
      if (!result.roundsWithoutWinner.includes(7)) wentOut++
    }
    // Someone always goes out in a real round 7. The bots manage it around nine
    // times in ten, so this guards the behaviour without being flaky.
    expect(wentOut).toBeGreaterThanOrEqual(Math.floor(games * 0.75))
  })

  it('is deterministic: the same seed replays identically', () => {
    const first = playGame(99, { difficulty: 'normal' })
    const second = playGame(99, { difficulty: 'normal' })
    expect(second.actions).toBe(first.actions)
    expect(second.scores).toEqual(first.scores)
  })
})
