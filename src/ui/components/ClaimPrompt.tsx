/**
 * The claim question.
 *
 * Untimed by design — the game waits. The penalty is stated plainly rather than
 * implied, because taking a card out of turn costs you two cards for one and that is
 * the whole decision.
 */

import type { Card } from '../../engine/cards.ts'
import { cardLabel } from '../../engine/cards.ts'
import { CardFace } from './CardFace.tsx'

export interface ClaimPromptProps {
  card: Card
  costsPenalty: boolean
  connects: boolean
  onRespond: (want: boolean) => void
}

export function ClaimPrompt({ card, costsPenalty, connects, onRespond }: ClaimPromptProps) {
  return (
    <div className="absolute inset-0 z-20 flex items-end justify-center bg-black/70 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-felt-800 p-4 shadow-lift">
        <div className="flex items-center gap-3">
          <CardFace card={card} size="lg" />
          <div className="min-w-0">
            <h2 className="text-base font-bold text-white">Take the {cardLabel(card)}?</h2>
            {costsPenalty ? (
              <p className="mt-1 text-xs leading-snug text-amber-200">
                It is not your turn, so you would also draw a penalty card — two cards for
                one.
              </p>
            ) : (
              <p className="mt-1 text-xs leading-snug text-white/60">
                Your turn is next, so this is free — it replaces your draw.
              </p>
            )}
            {!connects && (
              <p className="mt-1 text-[11px] text-white/45">
                Nothing in your hand connects with it.
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => onRespond(false)}
            className="flex-1 rounded-lg border border-white/20 bg-white/5 py-2.5 text-sm font-semibold text-white/80 active:scale-95"
          >
            Pass
          </button>
          <button
            type="button"
            onClick={() => onRespond(true)}
            className="flex-1 rounded-lg bg-accent py-2.5 text-sm font-bold text-felt-900 active:scale-95"
          >
            Take it
          </button>
        </div>
      </div>
    </div>
  )
}
