/**
 * Saving to localStorage.
 *
 * Game state is plain data by construction — the engine holds no classes, functions
 * or dates — so it round-trips through JSON untouched, and a game survives the app
 * being closed mid-round.
 */

import { PLAYER_COUNT } from '../engine/config.ts'
import type { GameState } from '../engine/state.ts'
import type { Settings } from './store.ts'

const GAME_KEY = 'croatian-armageddon:game:v1'
const SETTINGS_KEY = 'croatian-armageddon:settings:v1'
const HAND_ORDER_KEY = 'croatian-armageddon:handorder:v1'

export function save(state: GameState): void {
  try {
    if (state.phase === 'gameEnd') {
      window.localStorage.removeItem(GAME_KEY)
      return
    }
    window.localStorage.setItem(GAME_KEY, JSON.stringify(state))
  } catch {
    // A full or disabled localStorage should never take the game down with it.
  }
}

export function loadSaved(): GameState | null {
  try {
    const raw = window.localStorage.getItem(GAME_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as GameState
    // Guard against a save written by an older, incompatible build — including one
    // from before the table was fixed at four players.
    if (typeof parsed?.round !== 'number' || !Array.isArray(parsed?.players)) return null
    if (parsed.players.length !== PLAYER_COUNT) return null
    return parsed
  } catch {
    return null
  }
}

export function hasSaved(): boolean {
  return loadSaved() !== null
}

export function clearSaved(): void {
  try {
    window.localStorage.removeItem(GAME_KEY)
  } catch {
    // ignore
  }
}

export function saveSettings(settings: Settings): void {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // ignore
  }
}

export function loadSettings(): Settings | null {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY)
    return raw ? (JSON.parse(raw) as Settings) : null
  } catch {
    return null
  }
}

/**
 * The arrangement of your hand, kept separately from the game itself.
 *
 * The rules have no opinion on what order you hold cards in, so this does not belong
 * in the game state. Keeping it apart also means a stale arrangement can never
 * corrupt a saved game — at worst it refers to cards you no longer hold, which the
 * ordering code already discards.
 */
export function saveHandOrder(order: readonly string[]): void {
  try {
    window.localStorage.setItem(HAND_ORDER_KEY, JSON.stringify(order))
  } catch {
    // ignore
  }
}

export function loadHandOrder(): string[] {
  try {
    const raw = window.localStorage.getItem(HAND_ORDER_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : null
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}
