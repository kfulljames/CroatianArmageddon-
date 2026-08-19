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
import type { Card } from '../engine/cards.ts'
import { createGame, reduce } from '../engine/reduce.ts'
import { kickOptions } from '../engine/melds.ts'
import { roundSpec } from '../engine/rounds.ts'
import type { GameState } from '../engine/state.ts'
import { playerById, topDiscard } from '../engine/state.ts'
import { type Difficulty, chooseAction } from '../ai/bot.ts'
import { cardWouldHelp } from '../ai/evaluate.ts'
import { loadSaved, save, clearSaved, loadSettings, saveSettings } from './persist.ts'

export const HUMAN_ID = 'you'

export interface Settings {
  readonly playerName: string
  readonly opponents: number
  readonly difficulty: Difficulty
  /**
   * When off, the app only interrupts for an out-of-turn claim if the card actually
   * connects with something you are holding. When on, it asks about every discard.
   */
  readonly alwaysAsk: boolean
  readonly botSpeed: number
}

export const DEFAULT_SETTINGS: Settings = {
  playerName: 'You',
  opponents: 3,
  difficulty: 'normal',
  alwaysAsk: false,
  botSpeed: 550,
}

const BOT_NAMES = ['Ana', 'Marko', 'Ivana', 'Luka', 'Petra']

export type Screen = 'home' | 'setup' | 'table' | 'rules' | 'scores'

interface Store {
  game: GameState | null
  settings: Settings
  screen: Screen
  /** Card the player has tapped in their hand, awaiting a destination. */
  selectedCardId: string | null
  /** Set when the player has asked to open and is choosing between lay-downs. */
  openingPickerOpen: boolean
  lastError: string | null

  newGame: () => void
  resumeSaved: () => boolean
  abandonGame: () => void
  setScreen: (screen: Screen) => void
  updateSettings: (patch: Partial<Settings>) => void
  selectCard: (cardId: string | null) => void
  setOpeningPicker: (open: boolean) => void
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
export function shouldAskAboutClaim(state: GameState, settings: Settings): boolean {
  if (state.phase !== 'claim') return false
  const moves = legalMoves(state)
  if (moves.claimPlayerId !== HUMAN_ID) return false
  if (settings.alwaysAsk) return true
  if (!moves.claimCostsPenalty) return true
  const card = topDiscard(state)
  return card != null && cardConnects(state, HUMAN_ID, card)
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
   * It stops for the human in three cases: their turn to draw, their turn to play,
   * and a claim they should actually be asked about. Claims they would obviously
   * decline are answered for them, because being asked after every single discard is
   * exhausting — that is what the "ask me every time" setting turns back on.
   */
  const pump = (): void => {
    cancelBotTimer()
    const state = get().game
    if (!state) return
    if (state.phase === 'gameEnd' || state.phase === 'roundEnd') return

    const moves = legalMoves(state)
    if (!moves.playerId) return

    const isHuman = moves.playerId === HUMAN_ID

    if (isHuman && state.phase === 'claim') {
      if (shouldAskAboutClaim(state, get().settings)) return
      // Decline quietly on their behalf and keep the game moving.
      botTimer = setTimeout(() => {
        get().dispatch({ type: 'claimResponse', want: false })
      }, 0)
      return
    }

    if (isHuman) return

    const delay = state.phase === 'claim' ? Math.round(get().settings.botSpeed * 0.55) : get().settings.botSpeed
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
    settings: loadSettings() ?? DEFAULT_SETTINGS,
    screen: 'home',
    selectedCardId: null,
    openingPickerOpen: false,
    lastError: null,

    newGame: () => {
      cancelBotTimer()
      const settings = get().settings
      const players = [
        { id: HUMAN_ID, name: settings.playerName || 'You', isHuman: true },
        ...Array.from({ length: settings.opponents }, (_, index) => ({
          id: `bot${index}`,
          name: BOT_NAMES[index] ?? `Bot ${index + 1}`,
          isHuman: false,
        })),
      ]
      const game = createGame({ seed: Math.floor(Math.random() * 0xffffffff), players })
      set({ game, screen: 'table', selectedCardId: null, lastError: null, openingPickerOpen: false })
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

    dispatch: (action) => {
      const state = get().game
      if (!state) return
      try {
        const next = reduce(state, action)
        set({
          game: next,
          lastError: null,
          selectedCardId: null,
          openingPickerOpen: false,
        })
        save(next)
        pump()
      } catch (error) {
        set({ lastError: error instanceof Error ? error.message : String(error) })
      }
    },
  }
})
