/**
 * Headless bot-vs-bot games.
 *
 * This is the main defence against rules bugs. A card game has far too many reachable
 * positions to reason about by hand, and the ones that matter — a round that cannot
 * end, a card that quietly duplicates itself, a player with no legal move — only show
 * up in volume. Every game runs from a seed, so anything this finds is reproducible.
 */

import { deckCountForPlayers } from '../engine/cards.ts'
import type { Action } from '../engine/actions.ts'
import { legalMoves } from '../engine/actions.ts'
import { createGame, reduce } from '../engine/reduce.ts'
import { createRng, type Rng } from '../engine/rng.ts'
import { findOpenings } from '../engine/openings.ts'
import { roundSpec } from '../engine/rounds.ts'
import type { GameState } from '../engine/state.ts'
import { playerById } from '../engine/state.ts'
import { type Difficulty, chooseAction } from '../ai/bot.ts'

export class InvariantError extends Error {
  constructor(
    message: string,
    readonly seed: number,
    readonly state: GameState,
  ) {
    super(`${message} (seed ${seed}, round ${state.round}, phase ${state.phase})`)
  }
}

/** Cards in play must equal the shoe exactly: none lost, none conjured. */
function checkCardConservation(state: GameState, seed: number): void {
  const ids = [
    ...state.drawPile.map((card) => card.id),
    ...state.discardPile.map((card) => card.id),
    ...state.players.flatMap((player) => player.hand.map((card) => card.id)),
    ...state.melds.flatMap((meld) => meld.cards.map((card) => card.id)),
  ]
  const expected = deckCountForPlayers(state.players.length) * 55
  if (ids.length !== expected) {
    throw new InvariantError(`Card count is ${ids.length}, expected ${expected}`, seed, state)
  }
  if (new Set(ids).size !== ids.length) {
    throw new InvariantError('A card exists in two places at once', seed, state)
  }
}

/** Picks uniformly among legal moves. Finds deadlocks that sensible play never would. */
function randomAction(state: GameState, rng: Rng): Action {
  const moves = legalMoves(state)

  if (state.phase === 'roundEnd') return { type: 'startNextRound' }
  if (state.phase === 'claim') return { type: 'claimResponse', want: rng.next() < 0.35 }

  if (state.phase === 'draw') {
    if (moves.canTakeDiscard && moves.canDrawFromPile) {
      return rng.next() < 0.4 ? { type: 'takeDiscard' } : { type: 'drawFromPile' }
    }
    return moves.canTakeDiscard ? { type: 'takeDiscard' } : { type: 'drawFromPile' }
  }

  const options: Action[] = []
  if (moves.canOpen) {
    const player = playerById(state, moves.playerId!)
    const plans = findOpenings(player.hand, roundSpec(state.round), { limit: 4 })
    const plan = plans[rng.nextInt(plans.length)]
    if (plan) options.push({ type: 'open', proposals: plan.proposals })
  }
  for (const kick of moves.kicks) {
    options.push({ type: 'kick', cardId: kick.cardId, meldId: kick.meldId, position: kick.position })
  }
  for (const steal of moves.steals) {
    options.push({ type: 'stealJoker', meldId: steal.meldId, index: steal.index, cardId: steal.cardId })
  }

  // Always leave discarding on the table, or a bot could loop forever kicking.
  if (options.length === 0 || rng.next() < 0.35) {
    const discardable = moves.discardable
    return { type: 'discard', cardId: discardable[rng.nextInt(discardable.length)]! }
  }
  return options[rng.nextInt(options.length)]!
}

export interface GameResult {
  readonly seed: number
  readonly actions: number
  readonly rounds: number
  readonly scores: Record<string, number>
  readonly winnerId: string | null
  readonly tied: boolean
  /** Rounds that ended because the cards ran out rather than someone going out. */
  readonly exhaustedRounds: number
}

export interface SimulateOptions {
  readonly playerCount?: number
  readonly difficulty?: Difficulty | 'random'
  /** Safety valve: a game that needs more actions than this is treated as stuck. */
  readonly maxActions?: number
}

export function playGame(seed: number, options: SimulateOptions = {}): GameResult {
  const playerCount = options.playerCount ?? 4
  const difficulty = options.difficulty ?? 'normal'
  const maxActions = options.maxActions ?? 20000
  const rng = createRng(seed ^ 0x9e3779b9)

  let state = createGame({
    seed,
    players: Array.from({ length: playerCount }, (_, index) => ({
      id: `p${index}`,
      name: `Bot ${index + 1}`,
      isHuman: false,
    })),
  })

  let actions = 0
  let exhaustedRounds = 0
  let lastRound = state.round

  while (state.phase !== 'gameEnd') {
    if (actions >= maxActions) {
      throw new InvariantError(`Game did not finish within ${maxActions} actions`, seed, state)
    }

    const before = state
    const action =
      difficulty === 'random' ? randomAction(state, rng) : chooseAction(state, difficulty)
    state = reduce(state, action)
    actions++

    if (state === before) {
      throw new InvariantError('An action left the state unchanged', seed, state)
    }
    checkCardConservation(state, seed)

    if (state.round !== lastRound) lastRound = state.round
    if (state.phase === 'roundEnd') {
      const wentOut = state.players.some((player) => player.hand.length === 0)
      if (!wentOut) exhaustedRounds++
    }
  }

  const scores: Record<string, number> = {}
  for (const player of state.players) {
    if (player.score < 0) {
      throw new InvariantError(`${player.name} finished on a negative score`, seed, state)
    }
    scores[player.id] = player.score
  }
  if (state.scoreSheet.length !== 7) {
    throw new InvariantError(`Scored ${state.scoreSheet.length} rounds, expected 7`, seed, state)
  }

  return {
    seed,
    actions,
    rounds: state.scoreSheet.length,
    scores,
    winnerId: state.winnerId,
    tied: state.tiedPlayerIds.length > 0,
    exhaustedRounds,
  }
}

export interface SimulationSummary {
  readonly games: number
  readonly totalActions: number
  readonly averageActions: number
  readonly averageWinningScore: number
  readonly ties: number
  readonly exhaustedRounds: number
  readonly failures: { seed: number; message: string }[]
}

export function simulate(games: number, options: SimulateOptions = {}): SimulationSummary {
  const failures: { seed: number; message: string }[] = []
  let totalActions = 0
  let ties = 0
  let exhaustedRounds = 0
  let winningScoreTotal = 0
  let completed = 0

  for (let seed = 1; seed <= games; seed++) {
    try {
      const result = playGame(seed, options)
      totalActions += result.actions
      if (result.tied) ties++
      exhaustedRounds += result.exhaustedRounds
      winningScoreTotal += Math.min(...Object.values(result.scores))
      completed++
    } catch (error) {
      failures.push({ seed, message: error instanceof Error ? error.message : String(error) })
    }
  }

  return {
    games,
    totalActions,
    averageActions: completed > 0 ? totalActions / completed : 0,
    averageWinningScore: completed > 0 ? winningScoreTotal / completed : 0,
    ties,
    exhaustedRounds,
    failures,
  }
}
