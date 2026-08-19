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
  it('plays 30 four-handed games to completion without violating an invariant', () => {
    const summary = simulate(30, { playerCount: 4, difficulty: 'normal' })
    expect(summary.failures).toEqual([])
    expect(summary.averageActions).toBeGreaterThan(0)
  })

  it('survives random legal play, which reaches positions sensible play never would', () => {
    const summary = simulate(15, { playerCount: 6, difficulty: 'random' })
    expect(summary.failures).toEqual([])
  })

  it('handles the smallest and largest sensible tables', () => {
    expect(simulate(6, { playerCount: 3, difficulty: 'normal' }).failures).toEqual([])
    expect(simulate(6, { playerCount: 6, difficulty: 'hard' }).failures).toEqual([])
  })

  it('plays all three difficulties', () => {
    // Easy bots claim greedily, so their hands balloon and their games run long.
    // Three apiece is enough to prove each difficulty drives a game to the end.
    for (const difficulty of ['easy', 'normal', 'hard'] as const) {
      expect(simulate(3, { playerCount: 4, difficulty }).failures).toEqual([])
    }
  })

  it('always scores exactly seven rounds and finishes on a non-negative score', () => {
    const result = playGame(42, { playerCount: 4, difficulty: 'normal' })
    expect(result.rounds).toBe(7)
    for (const score of Object.values(result.scores)) {
      expect(score).toBeGreaterThanOrEqual(0)
    }
  })

  it('is deterministic: the same seed replays identically', () => {
    const first = playGame(99, { playerCount: 4, difficulty: 'normal' })
    const second = playGame(99, { playerCount: 4, difficulty: 'normal' })
    expect(second.actions).toBe(first.actions)
    expect(second.scores).toEqual(first.scores)
  })
})
