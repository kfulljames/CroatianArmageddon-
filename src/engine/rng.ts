/**
 * Seeded pseudo-random number generation.
 *
 * Every shuffle in the game goes through here, so a whole game is reproducible from
 * its seed alone. That is what lets us turn a reported bug ("the round locked up")
 * into a regression test: record the seed, replay the exact deal.
 */

export interface Rng {
  /** Float in [0, 1). */
  next(): number
  /** Integer in [0, maxExclusive). */
  nextInt(maxExclusive: number): number
  /** Current internal state, so a game in progress can be saved and resumed. */
  getState(): number
}

/** mulberry32 — small, fast, and good enough for shuffling a card shoe. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    nextInt: (maxExclusive: number) => Math.floor(next() * maxExclusive),
    getState: () => state,
  }
}

/** Fisher-Yates. Returns a new array; the input is left alone. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1)
    const a = out[i]!
    const b = out[j]!
    out[i] = b
    out[j] = a
  }
  return out
}

/** Turn an arbitrary string into a seed, so games can be shared by name. */
export function seedFromString(text: string): number {
  let hash = 2166136261 >>> 0
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619) >>> 0
  }
  return hash >>> 0
}
