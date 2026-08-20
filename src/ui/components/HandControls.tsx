/**
 * How you want your hand arranged.
 *
 * Deliberately always visible rather than tucked into a settings screen: which way
 * you sort changes through a round — by suit while you are chasing runs, by rank
 * while you are collecting a set — and the Ace belongs at whichever end you are
 * building towards. Burying that behind a menu would mean nobody ever uses it.
 */

import type { SortMode } from '../handOrder.ts'

export interface HandControlsProps {
  mode: SortMode
  aceHigh: boolean
  onSort: (mode: SortMode) => void
  onAceHigh: (aceHigh: boolean) => void
}

export function HandControls({ mode, aceHigh, onSort, onAceHigh }: HandControlsProps) {
  return (
    <div className="flex items-center gap-1.5 px-3 pb-1">
      <span className="text-[10px] uppercase tracking-wide text-white/35">Sort</span>

      <Chip active={mode === 'rank'} onClick={() => onSort('rank')}>
        Rank
      </Chip>
      <Chip active={mode === 'suit'} onClick={() => onSort('suit')}>
        Suit
      </Chip>

      <Chip active={aceHigh} onClick={() => onAceHigh(!aceHigh)}>
        {aceHigh ? 'Ace high' : 'Ace low'}
      </Chip>

      {mode === 'custom' && (
        <span className="ml-auto text-[10px] text-accent/70" title="You arranged this hand yourself">
          your order
        </span>
      )}
    </div>
  )
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded px-2 py-0.5 text-[11px] font-medium transition-colors active:scale-95',
        active
          ? 'bg-accent/20 text-accent ring-1 ring-accent/50'
          : 'bg-white/5 text-white/50 ring-1 ring-white/10',
      ].join(' ')}
    >
      {children}
    </button>
  )
}
