/**
 * Fixed table setup.
 *
 * Croatian Armageddon is played four-handed with two decks. These are not settings
 * and not derived from anything — they are what the game is — so they live here as
 * constants rather than as parameters threaded through the engine.
 */

/** Players at the table, always. */
export const PLAYER_COUNT = 4

/** Decks shuffled together to form the shoe. */
export const DECK_COUNT = 2

/** Jokers in each deck. */
export const JOKERS_PER_DECK = 3

/** Jokers in play across the whole shoe. */
export const JOKER_COUNT = DECK_COUNT * JOKERS_PER_DECK

/** Cards in the shoe: two 52-card decks plus six Jokers. */
export const SHOE_SIZE = DECK_COUNT * 52 + JOKER_COUNT
