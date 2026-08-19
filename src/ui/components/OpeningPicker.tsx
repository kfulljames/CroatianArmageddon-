/**
 * Choosing how to open.
 *
 * A hand can often meet the requirement in more than one way, and which one you pick
 * matters more than it looks: the number of melds is fixed for the round, so the
 * ranks and suits you lay down decide which of your remaining cards will ever be
 * playable. The leftovers are therefore shown as prominently as the melds.
 */

import { handPoints } from '../../engine/cards.ts'
import type { OpeningPlan } from '../../engine/openings.ts'
import { CardFace } from './CardFace.tsx'

export interface OpeningPickerProps {
  plans: readonly OpeningPlan[]
  onChoose: (plan: OpeningPlan) => void
  onCancel: () => void
}

export function OpeningPicker({ plans, onChoose, onCancel }: OpeningPickerProps) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-felt-900/97 backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <h2 className="text-base font-bold text-white">Lay down your opening</h2>
          <p className="text-[11px] text-white/50">
            {plans.length === 1 ? 'One way to do it' : `${plans.length} ways to do it`}
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-white/20 px-3 py-1.5 text-xs text-white/70 active:scale-95"
        >
          Cancel
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {plans.map((plan, index) => (
          <button
            key={index}
            type="button"
            onClick={() => onChoose(plan)}
            className="w-full rounded-xl border border-white/15 bg-felt-800 p-3 text-left active:scale-[0.99]"
          >
            <div className="space-y-2">
              {plan.proposals.map((proposal, meldIndex) => (
                <div key={meldIndex} className="flex items-center gap-1">
                  {proposal.cards.map((card, cardIndex) => (
                    <div
                      key={card.id}
                      style={{ marginLeft: cardIndex === 0 ? 0 : -14 }}
                    >
                      <CardFace card={card} size="sm" />
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="mt-3 border-t border-white/10 pt-2">
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] text-white/50">
                  {plan.leftover.length === 0
                    ? 'Leaves you with nothing — this goes out'
                    : `Leaves ${plan.leftover.length} in hand · ${handPoints(plan.leftover)} pts`}
                </span>
                {plan.jokersUsed > 0 && (
                  <span className="text-[10px] text-purple-300">
                    uses {plan.jokersUsed} Joker{plan.jokersUsed > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              {plan.leftover.length > 0 && (
                <div className="mt-1.5 flex gap-0.5">
                  {plan.leftover.map((card) => (
                    <CardFace key={card.id} card={card} size="xs" />
                  ))}
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
