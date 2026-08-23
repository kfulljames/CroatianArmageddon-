/**
 * Application state: the game, the settings, and the loop that drives the bots.
 *
 * The engine is deliberately synchronous and pure, so this is where waiting lives —
 * bots pause between moves so a person can follow what happened, and the game stops
 * dead whenever it needs a decision from the human.
 */

import { create } from 'zustand'
import type { Action } from '../engine/actions.ts'
import { legalMoves } from '../engine/actions.ts'
import { type Card, cardLabel } from '../engine/cards.ts'
import { createGame, reduce } from '../engine/reduce.ts'
import { kickOptions } from '../engine/melds.ts'
import { roundSpec } from '../engine/rounds.ts'
import type { GameState } from '../engine/state.ts'
import { playerById, topDiscard } from '../engine/state.ts'
import { type Difficulty, chooseAction } from '../ai/bot.ts'
import { cardWouldHelp } from '../ai/evaluate.ts'
import type { SortMode } from './handOrder.ts'
import {
  clearSaved,
  loadHandOrder,
  loadSaved,
  loadSettings,
  save,
  saveHandOrder,
  saveSettings,
} from './persist.ts'

export const HUMAN_ID = 'you'

export interface Settings {
  readonly playerName: string
  /** How your hand is arranged on screen. Yours to change at any point. */
  readonly handSort: SortMode
  /** Whether the Ace sorts above the King or below the 2. */
  readonly aceHigh: boolean
  readonly difficulty: Difficulty
  readonly botSpeed: number
}

export const DEFAULT_SETTINGS: Settings = {
  playerName: 'You',
  handSort: 'suit',
  aceHigh: false,
  difficulty: 'normal',
  botSpeed: 550,
}

/** One per empty seat. The table is always four-handed, so there are always three. */
const BOT_NAMES = ['Ana', 'Marko', 'Ivana']

export type Screen = 'home' | 'setup' | 'table' | 'rules' | 'scores'

interface Store {
  game: GameState | null
  settings: Settings
  screen: Screen
  /** Card the player has tapped in their hand, awaiting a destination. */
  selectedCardId: string | null
  /** Set when the player has asked to open and is choosing between lay-downs. */
  openingPickerOpen: boolean
  /** Card ids in the order the player last arranged them by hand. */
  handOrder: string[]
  /**
   * What just happened, held on screen long enough to read.
   *
   * Claims resolve in a few hundred milliseconds, so without this a card can be taken
   * out from under you by an opponent and the only trace is a number changing
   * somewhere. Knowing who took what is most of reading the table.
   */
  notice: { text: string; playerId: string } | null
  lastError: string | null

  newGame: () => void
  resumeSaved: () => boolean
  abandonGame: () => void
  setScreen: (screen: Screen) => void
  updateSettings: (patch: Partial<Settings>) => void
  selectCard: (cardId: string | null) => void
  setOpeningPicker: (open: boolean) => void
  /** Adopt an arrangement the player made by dragging, which makes the hand custom. */
  arrangeHand: (orderedCardIds: string[]) => void
  setHandSort: (mode: SortMode) => void
  dispatch: (action: Action) => void
}

/** Would this card actually connect with anything the player holds or has laid? */
export function cardConnects(state: GameState, playerId: string, card: Card): boolean {
  const player = playerById(state, playerId)
  if (card.isJoker) return true
  if (player.hasOpened) {
    return state.melds.some((meld) => kickOptions(meld, card, state.turnCounter).length > 0)
  }
  return cardWouldHelp(player.hand, card, roundSpec(state.round))
}

/**
 * Whether the human should actually be asked about the card on the discard pile.
 *
 * Being asked after every single discard is exhausting, so the app only interrupts
 * when the answer is not obvious: a free claim (it is about to be your turn, so the
 * card is a straight upgrade on a blind draw), or an out-of-turn claim for a card
 * that genuinely connects with your hand and is therefore worth a penalty. The
 * "ask me every time" setting turns the rest back on.
 *
 * Both the driver and the table use this, so the prompt cannot flash up for a
 * question that is about to be answered automatically.
 */
/**
 * Whether the player is being asked about the discard right now.
 *
 * Every claim that reaches them, without exception. An earlier version quietly passed
 * on their behalf for out-of-turn cards that connected with nothing in hand, on the
 * theory that being asked after every discard would be tiring. Measured over 2,880
 * discards, that silently threw away 36% of all of them — more opportunities than it
 * offered — and being asked is not a chore, it is the game. At a table everybody is
 * asked about every card, in turn.
 */
export function shouldAskAboutClaim(state: GameState): boolean {
  if (state.phase !== 'claim') return false
  return legalMoves(state).claimPlayerId === HUMAN_ID
}

/**
 * If this action is somebody taking the discard, say so in a sentence.
 *
 * Returns null for every other move, which is what clears a notice that has already
 * been on screen for a turn.
 */
function describeClaim(
  state: GameState,
  action: Action,
): { text: string; playerId: string } | null {
  if (action.type !== 'claimResponse' || !action.want) return null
  const claimerId = state.claim?.order[state.claim.index]
  const card = topDiscard(state)
  if (!claimerId || !card) return null
  const claimer = playerById(state, claimerId)
  const outOfTurn = (state.claim?.index ?? 0) > 0
  const who = claimerId === HUMAN_ID ? 'You' : claimer.name
  const took = claimerId === HUMAN_ID ? 'take' : 'takes'
  return {
    playerId: claimerId,
    text: `${who} ${took} the ${cardLabel(card)}${outOfTurn ? ' — and a penalty card' : ''}`,
  }
}

let botTimer: ReturnType<typeof setTimeout> | null = null

function cancelBotTimer(): void {
  if (botTimer !== null) {
    clearTimeout(botTimer)
    botTimer = null
  }
}

export const useStore = create<Store>((set, get) => {
  /**
   * Decide whether the game can move on by itself, and if so, do it after a pause.
   *
   * It stops for the human on their turn to draw, their turn to play, and any claim
   * they should be asked about — which, by default, is every claim that reaches them.
   *
   * The pause after someone takes a discard is deliberately longer than a normal bot
   * move. Claims resolve in a few hundred milliseconds and cards get taken out from
   * under you; without a beat to read it, the table is just numbers changing.
   */
  const pump = (): void => {
    cancelBotTimer()
    const state = get().game
    if (!state) return
    if (state.phase === 'gameEnd' || state.phase === 'roundEnd') return

    const moves = legalMoves(state)
    if (!moves.playerId) return

    const isHuman = moves.playerId === HUMAN_ID

    // Their turn, or their call on the discard: the game waits.
    if (isHuman) return

    // Hold on a notice — someone taking a card — long enough to actually read it.
    const speed = get().settings.botSpeed
    const delay = get().notice
      ? Math.max(speed, 1300)
      : state.phase === 'claim'
        ? Math.round(speed * 0.7)
        : speed
    botTimer = setTimeout(() => {
      const current = get().game
      if (!current) return
      try {
        get().dispatch(chooseAction(current, get().settings.difficulty))
      } catch (error) {
        set({ lastError: error instanceof Error ? error.message : String(error) })
      }
    }, delay)
  }

  return {
    game: null,
    settings: { ...DEFAULT_SETTINGS, ...(loadSettings() ?? {}) },
    screen: 'home',
    selectedCardId: null,
    openingPickerOpen: false,
    handOrder: loadHandOrder(),
    notice: null,
    lastError: null,

    newGame: () => {
      cancelBotTimer()
      const settings = get().settings
      const players = [
        { id: HUMAN_ID, name: settings.playerName || 'You', isHuman: true },
        ...BOT_NAMES.map((name, index) => ({ id: `bot${index}`, name, isHuman: false })),
      ]
      const game = createGame({ seed: Math.floor(Math.random() * 0xffffffff), players })
      saveHandOrder([])
      set({
        game,
        screen: 'table',
        selectedCardId: null,
        lastError: null,
        openingPickerOpen: false,
        handOrder: [],
      })
      save(game)
      pump()
    },

    resumeSaved: () => {
      const game = loadSaved()
      if (!game) return false
      cancelBotTimer()
      set({ game, screen: 'table', selectedCardId: null, lastError: null })
      pump()
      return true
    },

    abandonGame: () => {
      cancelBotTimer()
      clearSaved()
      set({ game: null, screen: 'home', selectedCardId: null })
    },

    setScreen: (screen) => set({ screen }),

    updateSettings: (patch) => {
      const settings = { ...get().settings, ...patch }
      saveSettings(settings)
      set({ settings })
    },

    selectCard: (cardId) => set({ selectedCardId: cardId }),

    setOpeningPicker: (open) => set({ openingPickerOpen: open }),

    arrangeHand: (orderedCardIds) => {
      saveHandOrder(orderedCardIds)
      const settings = { ...get().settings, handSort: 'custom' as SortMode }
      saveSettings(settings)
      set({ handOrder: orderedCardIds, settings })
    },

    setHandSort: (mode) => {
      const settings = { ...get().settings, handSort: mode }
      saveSettings(settings)
      set({ settings })
    },

    dispatch: (action) => {
      const state = get().game
      if (!state) return
      try {
        // Work out who is acting before the move is applied, since taking the discard
        // hands the turn on and the answer is gone afterwards.
        const notice = describeClaim(state, action)
        const next = reduce(state, action)
        set({
          game: next,
          lastError: null,
          selectedCardId: null,
          openingPickerOpen: false,
          // A new notice replaces the old one; any other move clears it, because by
          // then the player has seen it and something else is happening.
          notice,
        })
        save(next)
        pump()
      } catch (error) {
        set({ lastError: error instanceof Error ? error.message : String(error) })
      }
    },
  }
})
