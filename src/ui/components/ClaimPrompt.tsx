/**
 * The claim question.
 *
 * Deliberately not a modal. Deciding whether you want the card means looking at your
 * hand and at what is already on the table — so anything that covers your cards, dims
 * them or blurs them is asking a question while hiding the information needed to
 * answer it. This sits in the strip above your hand instead: nothing is obscured,
 * nothing is blurred, and the game simply waits.
 *
 * Untimed, as it should be. The penalty is stated plainly rather than implied, because
 * taking a card out of turn costs two cards for one and that is the whole decision.
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
    <div className="mx-3 mt-2 rounded-xl border border-accent/60 bg-felt-700 p-2.5 shadow-lift">
      <div className="flex items-center gap-2.5">
        <CardFace card={card} size="md" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold leading-tight text-white">
            Take the {cardLabel(card)}?
          </h2>
          {costsPenalty ? (
            <p className="mt-0.5 text-[11px] leading-snug text-amber-200">
              Out of turn — you would draw a penalty card too. Two cards for one.
            </p>
          ) : (
            <p className="mt-0.5 text-[11px] leading-snug text-white/60">
              Your turn is next, so this is free — it replaces your draw.
            </p>
          )}
          <p className="mt-0.5 text-[11px] leading-snug text-white/45">
            {connects ? 'It connects with something you are holding.' : 'Nothing in your hand connects with it.'}
          </p>
        </div>
      </div>

      <div className="mt-2.5 flex gap-2">
        <button
          type="button"
          onClick={() => onRespond(false)}
          className="flex-1 rounded-lg border border-white/25 bg-white/5 py-2.5 text-sm font-semibold text-white/85 active:scale-95"
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
  )
}
