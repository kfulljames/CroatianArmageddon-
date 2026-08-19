/**
 * A meld on the table.
 *
 * Cards overlap so a long run still fits across a phone, and a meld you can play on
 * lights up rather than requiring you to work it out. Where a Joker is standing in
 * for a card, we say which card, because that is exactly what you need to know to
 * buy it back.
 */

import { type Card } from '../../engine/cards.ts'
import { type Meld, describeMeld, jokerSlots } from '../../engine/melds.ts'
import { CardFace } from './CardFace.tsx'

export interface MeldViewProps {
  meld: Meld
  ownerName: string
  isYours: boolean
  /** Highlight because the selected card can be kicked here. */
  kickable?: boolean
  /** Indexes of Jokers the selected card could buy. */
  stealableIndexes?: readonly number[]
  onKick?: (position: 'start' | 'end') => void
  onSteal?: (index: number) => void
  kickPositions?: readonly ('start' | 'end')[]
}

export function MeldView({
  meld,
  ownerName,
  isYours,
  kickable = false,
  stealableIndexes = [],
  onKick,
  onSteal,
  kickPositions = [],
}: MeldViewProps) {
  const jokerInfo = new Map(jokerSlots(meld).map((slot) => [slot.index, slot.description]))

  return (
    <div
      className={[
        'rounded-lg border px-2 pb-0.5 pt-1.5 transition-colors',
        kickable
          ? 'border-emerald-300/80 bg-emerald-400/10'
          : isYours
            ? 'border-accent/40 bg-white/[0.04]'
            : 'border-white/10 bg-white/[0.02]',
      ].join(' ')}
    >
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wide text-white/50">
          {isYours ? 'You' : ownerName}
        </span>
        <span className="text-[10px] text-white/40">{describeMeld(meld)}</span>
      </div>

      <div className="flex items-center gap-1">
        {kickPositions.includes('start') && onKick && (
          <KickSlot onClick={() => onKick('start')} />
        )}

        {/*
          Melds have a minimum size, not a fixed one: a three of a kind can hold every
          Jack in the shoe, and a run can stretch from the low Ace to the high one —
          fourteen cards, wider than the phone. The cards scroll within the meld while
          the slots you play into stay pinned either side, so a long meld never pushes
          them off screen.
        */}
        <div className="flex min-w-0 flex-1 overflow-x-auto no-scrollbar pb-3 pt-0.5">
          {meld.cards.map((card: Card, index: number) => {
            const stealable = stealableIndexes.includes(index)
            return (
              <div key={card.id} style={{ marginLeft: index === 0 ? 0 : -14 }} className="relative">
                <CardFace
                  card={card}
                  size="sm"
                  highlighted={stealable}
                  onClick={stealable && onSteal ? () => onSteal(index) : undefined}
                  label={
                    card.isJoker ? `Joker standing in for ${jokerInfo.get(index) ?? 'a card'}` : undefined
                  }
                />
                {card.isJoker && (
                  <span className="pointer-events-none absolute -bottom-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black/75 px-1 text-[8px] font-medium text-accent-soft">
                    {jokerInfo.get(index)}
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {kickPositions.includes('end') && onKick && <KickSlot onClick={() => onKick('end')} />}
      </div>
    </div>
  )
}

function KickSlot({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-[54px] w-8 shrink-0 items-center justify-center rounded-[6px] border border-dashed border-emerald-300 bg-emerald-400/15 text-lg font-bold text-emerald-200 active:scale-95"
      aria-label="Play the selected card here"
    >
      +
    </button>
  )
}
