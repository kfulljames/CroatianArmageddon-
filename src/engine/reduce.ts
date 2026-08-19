/**
 * The reducer: the single place where game state changes.
 *
 * Everything else in the engine describes what is possible; this decides what
 * happens. Keeping it in one function means the human and the bots cannot diverge,
 * and a whole game can be replayed by feeding the same actions back in.
 */

import { type Card, handPoints, cardLabel } from './cards.ts'
import type { CardId, PlayerId } from './ids.ts'
import {
  type Meld,
  type MeldProposal,
  type RunMeld,
  applyJokerSteal,
  applyKick,
  buildMeld,
  checkRunAdjacency,
  describeMeld,
  isAllJokers,
  runEndSlot,
} from './melds.ts'
import { createRng, shuffle } from './rng.ts'
import { FULL_SUIT_RUN_LENGTH, isFinalRound, roundSpec } from './rounds.ts'
import {
  type GameState,
  type LogEntry,
  type PlayerState,
  currentPlayer,
  findCardInHand,
  playerById,
  seatAfter,
  topDiscard,
} from './state.ts'
import { type Action, canDraw, isLegal } from './actions.ts'
import { buildShoe } from './cards.ts'

export interface NewGameOptions {
  readonly seed: number
  readonly players: readonly { id: PlayerId; name: string; isHuman: boolean }[]
  /** Seat index of the first dealer. Defaults to 0. */
  readonly dealerIndex?: number
  readonly jokersPerDeck?: number
}

export class IllegalMoveError extends Error {}

/**
 * Append a line to the game log.
 *
 * Entries are written in the past tense on purpose. The log names whoever acted, and
 * one of those names is the human's — which defaults to "You". Present tense would
 * force a choice between "Ana takes" and "You take"; past tense agrees with both.
 */
function log(state: GameState, playerId: PlayerId | null, text: string): LogEntry[] {
  return [...state.log, { turn: state.turnCounter, round: state.round, playerId, text }]
}

/** Start a fresh 7-round game and deal round 1. */
export function createGame(options: NewGameOptions): GameState {
  const players: PlayerState[] = options.players.map((player) => ({
    id: player.id,
    name: player.name,
    isHuman: player.isHuman,
    hand: [],
    hasOpened: false,
    score: 0,
  }))

  const base: GameState = {
    seed: options.seed,
    rngState: options.seed >>> 0,
    players,
    dealerIndex: options.dealerIndex ?? 0,
    round: 1,
    turnIndex: 0,
    turnCounter: 0,
    phase: 'draw',
    drawPile: [],
    discardPile: [],
    lastThrownCardId: null,
    melds: [],
    drawPileKnown: false,
    claim: null,
    turnsSinceProgress: 0,
    log: [],
    scoreSheet: [],
    winnerId: null,
    tiedPlayerIds: [],
    nextMeldSeq: 1,
  }

  return dealRound(base, 1, options.jokersPerDeck ?? 3)
}

/**
 * Shuffle a fresh shoe and deal a round.
 *
 * The dealer rotates each round, and play begins with the seat clockwise from the
 * dealer — which is the written rule that the starting player advances by one seat
 * every round.
 */
export function dealRound(state: GameState, round: number, jokersPerDeck = 3): GameState {
  const spec = roundSpec(round)
  const rng = createRng(state.rngState)
  const shoe = shuffle(buildShoe(state.players.length, jokersPerDeck), rng)

  const hands: Card[][] = state.players.map(() => [])
  let cursor = 0
  for (let round_ = 0; round_ < spec.cardsDealt; round_++) {
    for (let offset = 0; offset < state.players.length; offset++) {
      const seat = seatAfter(state, state.dealerIndex, offset + 1)
      hands[seat]!.push(shoe[cursor]!)
      cursor++
    }
  }

  const upcard = shoe[cursor]!
  cursor++
  const drawPile = shoe.slice(cursor)

  const players: PlayerState[] = state.players.map((player, index) => ({
    ...player,
    hand: hands[index]!,
    hasOpened: false,
  }))

  return {
    ...state,
    rngState: rng.getState(),
    players,
    round,
    turnIndex: seatAfter(state, state.dealerIndex, 1),
    turnCounter: 1,
    phase: 'draw',
    // Top of the draw pile is the last element, so reverse the dealt remainder.
    drawPile: drawPile.slice().reverse(),
    discardPile: [upcard],
    lastThrownCardId: upcard.id,
    melds: [],
    drawPileKnown: false,
    claim: null,
    turnsSinceProgress: 0,
    nextMeldSeq: 1,
    log: [
      ...state.log,
      {
        turn: 1,
        round,
        playerId: null,
        text: `Round ${round}: ${spec.label}. ${spec.cardsDealt} cards each. ${cardLabel(upcard)} turned up.`,
      },
    ],
  }
}

/**
 * Ruling 1. When the draw pile runs out, the top discard stays where it is and the
 * rest of the pile is flipped over bodily to become the new draw pile. No shuffle,
 * so the order is preserved (inverted) and an attentive player knows what is coming.
 */
function refillDrawPile(state: GameState): GameState {
  if (state.drawPile.length > 0) return state
  if (state.discardPile.length <= 1) return state

  const top = state.discardPile[state.discardPile.length - 1]!
  const rest = state.discardPile.slice(0, -1)
  // `rest[0]` is the oldest discard and sits at the bottom of the face-up pile, so
  // flipping the stack puts it on top — it is drawn first.
  const flipped = rest.slice().reverse()

  return {
    ...state,
    drawPile: flipped,
    discardPile: [top],
    drawPileKnown: true,
    log: log(state, null, 'Draw pile empty — the discards are flipped over to form a new one.'),
  }
}

function replacePlayer(
  state: GameState,
  playerId: PlayerId,
  update: (player: PlayerState) => PlayerState,
): PlayerState[] {
  return state.players.map((player) => (player.id === playerId ? update(player) : player))
}

function removeFromHand(player: PlayerState, cardIds: readonly CardId[]): Card[] {
  const removing = new Set(cardIds)
  return player.hand.filter((card) => !removing.has(card.id))
}

/**
 * Score the round: every card still in hand counts against you. The player who went
 * out has an empty hand and therefore scores nothing.
 */
function endRound(state: GameState, reason: string): GameState {
  const roundScores: Record<PlayerId, number> = {}
  const players = state.players.map((player) => {
    const points = handPoints(player.hand)
    roundScores[player.id] = points
    return { ...player, score: player.score + points }
  })

  const summary = players
    .map((player) => `${player.name} +${roundScores[player.id]} (${player.score})`)
    .join(', ')

  return {
    ...state,
    players,
    phase: 'roundEnd',
    claim: null,
    scoreSheet: [...state.scoreSheet, roundScores],
    log: log(state, null, `${reason} ${summary}`),
  }
}

/**
 * How many turns of nothing-happening before a round is declared dead.
 *
 * The written rules have no stalemate provision, because at a real table the
 * position is rare and players would simply agree to move on. Software cannot shrug,
 * so the engine calls it after this many consecutive turns in which no card was
 * kicked, no player opened, and no claim changed anyone's hand size.
 */
export const STALEMATE_TURNS = 40

/**
 * Hand the turn to a seat.
 *
 * `phase` is 'draw' normally, but 'play' when the incoming player has already taken
 * their card by claiming the discard. Both routes come through here so that the turn
 * counter and the stalemate check cannot be bypassed by one of them.
 */
function handOver(state: GameState, seat: number, phase: 'draw' | 'play'): GameState {
  const next: GameState = {
    ...refillDrawPile(state),
    turnIndex: seat,
    turnCounter: state.turnCounter + 1,
    turnsSinceProgress: state.turnsSinceProgress + 1,
    phase,
    claim: null,
  }
  // With no draw pile and nothing spare in the discards, nobody can start a turn.
  if (phase === 'draw' && !canDraw(next)) {
    return endRound(next, 'The cards ran out before anyone went out.')
  }
  // Nothing has been kicked or claimed for a long time, which means every card still
  // circulating is one that no meld on the table will accept. Hands can no longer
  // shrink, so nobody can go out. Score it where it stands.
  if (next.turnsSinceProgress >= STALEMATE_TURNS) {
    return endRound(next, 'Nobody could shed another card — the round is dead.')
  }
  return next
}

function beginTurn(state: GameState, seat: number): GameState {
  return handOver(state, seat, 'draw')
}

interface OpeningValidation {
  readonly melds: Meld[]
  readonly usedCardIds: CardId[]
  readonly leftoverCount: number
}

function isFullSuitRun(meld: Meld): meld is RunMeld {
  return (
    meld.kind === 'run' &&
    meld.cards.length === FULL_SUIT_RUN_LENGTH &&
    meld.startSlot === 1 &&
    runEndSlot(meld) === FULL_SUIT_RUN_LENGTH
  )
}

/**
 * Check a proposed opening against the round requirement and every structural rule.
 *
 * Throws rather than returning a result because the reducer treats an illegal action
 * as a programming error — `legalMoves` and `findOpenings` exist so callers never
 * have to guess.
 */
function validateOpening(
  state: GameState,
  player: PlayerState,
  proposals: readonly MeldProposal[],
): OpeningValidation {
  const spec = roundSpec(state.round)
  const used = new Set<CardId>()
  const melds: Meld[] = []

  proposals.forEach((proposal, index) => {
    for (const card of proposal.cards) {
      if (!findCardInHand(player, card.id)) {
        throw new IllegalMoveError(`${cardLabel(card)} is not in your hand.`)
      }
      if (used.has(card.id)) {
        throw new IllegalMoveError(`${cardLabel(card)} cannot be used in two melds at once.`)
      }
      used.add(card.id)
    }
    const built = buildMeld(proposal, player.id, `m${state.nextMeldSeq + index}`, state.turnCounter)
    if (!built.ok) throw new IllegalMoveError(built.reason)
    melds.push(built.meld)
  })

  const setCount = melds.filter((meld) => meld.kind === 'set').length
  const runCount = melds.filter((meld) => meld.kind === 'run').length

  const meetsStandard = setCount === spec.sets && runCount === spec.runs
  // Round 7 allows one whole suit, low Ace to high Ace, in place of three runs.
  const meetsFullSuit =
    isFinalRound(state.round) && melds.length === 1 && melds[0] != null && isFullSuitRun(melds[0])

  if (!meetsStandard && !meetsFullSuit) {
    throw new IllegalMoveError(
      `Round ${state.round} needs exactly ${spec.sets} three of a kind(s) and ${spec.runs} run(s).`,
    )
  }

  // "6 kings cannot be two three of a kinds" — each rank supports one set only.
  const setRanks = new Set<number>()
  for (const meld of melds) {
    if (meld.kind !== 'set') continue
    if (setRanks.has(meld.rank)) {
      throw new IllegalMoveError('Two three of a kinds cannot be the same rank.')
    }
    setRanks.add(meld.rank)
  }

  const adjacency = checkRunAdjacency(melds)
  if (adjacency) throw new IllegalMoveError(adjacency)

  const leftoverCount = player.hand.length - used.size

  if (isFinalRound(state.round)) {
    // Ruling 9: in round 7 you may only open if it empties your hand outright.
    if (leftoverCount !== 0) {
      throw new IllegalMoveError(
        'In round 7 you may only open if it leaves you with no cards at all.',
      )
    }
  } else if (leftoverCount < 1) {
    // Ruling 4: the final card has to leave as a discard, so one must remain.
    throw new IllegalMoveError('You must keep a card back to discard.')
  }

  // Three Jokers alone are a set only when doing so goes out.
  for (const meld of melds) {
    if (meld.kind === 'set' && isAllJokers(meld.cards) && leftoverCount !== 0) {
      throw new IllegalMoveError(
        'Jokers alone are only a three of a kind if playing them leaves you with no cards.',
      )
    }
  }

  return { melds, usedCardIds: [...used], leftoverCount }
}

/** Open the claim window on the card that was just thrown. */
function beginClaim(state: GameState, discarderSeat: number): GameState {
  const order: PlayerId[] = []
  for (let step = 1; step < state.players.length; step++) {
    order.push(state.players[seatAfter(state, discarderSeat, step)]!.id)
  }
  const top = topDiscard(state)
  if (!top || order.length === 0) {
    return beginTurn(state, seatAfter(state, discarderSeat, 1))
  }
  return { ...state, phase: 'claim', claim: { cardId: top.id, order, index: 0 } }
}

/** Draw one card for a player, refilling first if the pile has run dry. */
function drawInto(state: GameState, playerId: PlayerId): GameState {
  const refilled = refillDrawPile(state)
  const card = refilled.drawPile[refilled.drawPile.length - 1]
  if (!card) return refilled
  return {
    ...refilled,
    drawPile: refilled.drawPile.slice(0, -1),
    players: replacePlayer(refilled, playerId, (player) => ({
      ...player,
      hand: [...player.hand, card],
    })),
  }
}

export function reduce(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'drawFromPile': {
      const player = currentPlayer(state)
      const drawn = drawInto(state, player.id)
      if (drawn.phase === 'roundEnd') return drawn
      return { ...drawn, phase: 'play' }
    }

    case 'takeDiscard': {
      const player = currentPlayer(state)
      const card = topDiscard(state)
      if (!card) throw new IllegalMoveError('There is nothing to take.')
      return {
        ...state,
        discardPile: state.discardPile.slice(0, -1),
        players: replacePlayer(state, player.id, (target) => ({
          ...target,
          hand: [...target.hand, card],
        })),
        phase: 'play',
        log: log(state, player.id, `${player.name} took ${cardLabel(card)} from the discards.`),
      }
    }

    case 'open': {
      const player = currentPlayer(state)
      if (player.hasOpened) throw new IllegalMoveError('You have already opened this round.')
      const { melds, usedCardIds } = validateOpening(state, player, action.proposals)

      const opened: GameState = {
        ...state,
        players: replacePlayer(state, player.id, (target) => ({
          ...target,
          hand: removeFromHand(target, usedCardIds),
          hasOpened: true,
        })),
        melds: [...state.melds, ...melds],
        nextMeldSeq: state.nextMeldSeq + melds.length,
        turnsSinceProgress: 0,
        log: log(
          state,
          player.id,
          `${player.name} opened with ${melds.map(describeMeld).join(', ')}.`,
        ),
      }

      // Round 7: opening is going out, and it ends the game for everyone.
      if (isFinalRound(state.round)) {
        return endRound(opened, `${player.name} went out in round 7!`)
      }
      return opened
    }

    case 'kick': {
      const player = currentPlayer(state)
      const card = findCardInHand(player, action.cardId)
      if (!card) throw new IllegalMoveError('That card is not in your hand.')
      const meld = state.melds.find((candidate) => candidate.id === action.meldId)
      if (!meld) throw new IllegalMoveError('No such meld.')

      const updated = applyKick(meld, card, action.position)
      return {
        ...state,
        players: replacePlayer(state, player.id, (target) => ({
          ...target,
          hand: removeFromHand(target, [card.id]),
        })),
        melds: state.melds.map((candidate) => (candidate.id === meld.id ? updated : candidate)),
        turnsSinceProgress: 0,
        log: log(
          state,
          player.id,
          `${player.name} kicked ${cardLabel(card)} onto ${describeMeld(updated)}.`,
        ),
      }
    }

    case 'stealJoker': {
      const player = currentPlayer(state)
      const card = findCardInHand(player, action.cardId)
      if (!card) throw new IllegalMoveError('That card is not in your hand.')
      const meld = state.melds.find((candidate) => candidate.id === action.meldId)
      if (!meld) throw new IllegalMoveError('No such meld.')

      const { meld: updated, joker } = applyJokerSteal(meld, action.index, card)
      return {
        ...state,
        players: replacePlayer(state, player.id, (target) => ({
          ...target,
          hand: [...removeFromHand(target, [card.id]), joker],
        })),
        melds: state.melds.map((candidate) => (candidate.id === meld.id ? updated : candidate)),
        log: log(
          state,
          player.id,
          `${player.name} bought a Joker out of ${describeMeld(updated)} with ${cardLabel(card)}.`,
        ),
      }
    }

    case 'discard': {
      const player = currentPlayer(state)
      const card = findCardInHand(player, action.cardId)
      if (!card) throw new IllegalMoveError('That card is not in your hand.')

      const thrown: GameState = {
        ...state,
        players: replacePlayer(state, player.id, (target) => ({
          ...target,
          hand: removeFromHand(target, [card.id]),
        })),
        discardPile: [...state.discardPile, card],
        lastThrownCardId: card.id,
        log: log(state, player.id, `${player.name} discarded ${cardLabel(card)}.`),
      }

      const handAfter = playerById(thrown, player.id).hand
      if (handAfter.length === 0) {
        return endRound(thrown, `${player.name} went out.`)
      }
      return beginClaim(thrown, state.turnIndex)
    }

    case 'claimResponse': {
      const claim = state.claim
      if (!claim) throw new IllegalMoveError('Nobody is being asked about the discard.')
      const responderId = claim.order[claim.index]
      if (!responderId) throw new IllegalMoveError('The claim window has closed.')

      const nextSeat = state.players.findIndex((player) => player.id === claim.order[0])

      if (!action.want) {
        const nextIndex = claim.index + 1
        if (nextIndex >= claim.order.length) {
          // Nobody wanted it; it stays face up and play moves on.
          return beginTurn(state, nextSeat)
        }
        return { ...state, claim: { ...claim, index: nextIndex } }
      }

      const card = topDiscard(state)
      if (!card) throw new IllegalMoveError('There is nothing to claim.')
      const responder = playerById(state, responderId)

      let claimed: GameState = {
        ...state,
        discardPile: state.discardPile.slice(0, -1),
        players: replacePlayer(state, responderId, (target) => ({
          ...target,
          hand: [...target.hand, card],
        })),
        log: log(state, responderId, `${responder.name} took ${cardLabel(card)}.`),
      }

      if (claim.index === 0) {
        // The player whose turn is starting claims for free, and it counts as the
        // draw that opens their turn. It changes nobody's hand size, so it is not
        // progress — the turn is handed over exactly as any other would be.
        return handOver(claimed, nextSeat, 'play')
      }

      // Ruling 7: out of turn costs one penalty card, and the turn order is untouched.
      // This is the one claim that genuinely moves the round on, because it is the
      // only one that changes how many cards a hand holds.
      claimed = { ...claimed, turnsSinceProgress: 0 }
      claimed = drawInto(claimed, responderId)
      claimed = {
        ...claimed,
        log: log(claimed, responderId, `${responder.name} took a penalty card for going out of turn.`),
      }
      return beginTurn(claimed, nextSeat)
    }

    case 'startNextRound': {
      if (isFinalRound(state.round)) {
        const best = Math.min(...state.players.map((player) => player.score))
        const tied = state.players.filter((player) => player.score === best)
        return {
          ...state,
          phase: 'gameEnd',
          winnerId: tied.length === 1 ? tied[0]!.id : null,
          tiedPlayerIds: tied.length > 1 ? tied.map((player) => player.id) : [],
          log: log(
            state,
            null,
            tied.length === 1
              ? `${tied[0]!.name} won with ${best} points.`
              : `Tie on ${best} points — settle it with rock paper scissors.`,
          ),
        }
      }
      const rotated: GameState = { ...state, dealerIndex: seatAfter(state, state.dealerIndex, 1) }
      return dealRound(rotated, state.round + 1)
    }

    default: {
      const exhaustive: never = action
      throw new IllegalMoveError(`Unknown action: ${JSON.stringify(exhaustive)}`)
    }
  }
}

/**
 * Reduce, but refuse anything `legalMoves` would not have offered.
 *
 * The plain `reduce` trusts its caller and skips the (comparatively expensive)
 * opening search. Use this at the boundary — user input, loaded save files — where
 * the action has not already come out of `legalMoves`.
 */
export function reduceChecked(state: GameState, action: Action): GameState {
  if (!isLegal(state, action)) {
    throw new IllegalMoveError(`That move is not available right now: ${action.type}`)
  }
  return reduce(state, action)
}
