/**
 * The other players.
 *
 * Card counts are public at a real table and they are the single most important
 * thing to watch — someone down to two cards is about to go out and change what you
 * should be doing — so they are shown plainly rather than buried in a menu.
 */

import type { GameState, PlayerState } from '../../engine/state.ts'

export interface OpponentsProps {
  state: GameState
  humanId: string
  /** Flash whoever just took the discard, so the card can be followed across the table. */
  highlightId?: string | null
}

export function Opponents({ state, humanId, highlightId = null }: OpponentsProps) {
  const others = state.players.filter((player) => player.id !== humanId)
  const activeId = state.players[state.turnIndex]?.id
  const claimingId =
    state.phase === 'claim' && state.claim ? state.claim.order[state.claim.index] : null

  return (
    <div className="flex gap-1.5 overflow-x-auto no-scrollbar px-3 py-2">
      {others.map((player) => (
        <OpponentChip
          key={player.id}
          player={player}
          isActive={player.id === activeId}
          isClaiming={player.id === claimingId}
          isHighlighted={player.id === highlightId}
        />
      ))}
    </div>
  )
}

function OpponentChip({
  player,
  isActive,
  isClaiming,
  isHighlighted,
}: {
  player: PlayerState
  isActive: boolean
  isClaiming: boolean
  isHighlighted: boolean
}) {
  const nearlyOut = player.hand.length <= 2

  return (
    <div
      className={[
        'min-w-[76px] flex-1 rounded-lg border px-2 py-1.5 transition-colors',
        isHighlighted
          ? 'border-accent-soft bg-accent/25'
          : isActive
            ? 'border-accent bg-accent/10'
            : 'border-white/10 bg-white/[0.03]',
      ].join(' ')}
    >
      <div className="flex items-center gap-1">
        <span className="truncate text-xs font-medium text-white/90">{player.name}</span>
        {player.hasOpened && (
          <span className="rounded bg-emerald-400/20 px-1 text-[9px] font-semibold text-emerald-200">
            OPEN
          </span>
        )}
      </div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span
          className={`text-lg font-bold leading-none ${nearlyOut ? 'text-red-300' : 'text-white/80'}`}
        >
          {player.hand.length}
        </span>
        <span className="text-[10px] text-white/40">cards</span>
      </div>
      <div className="mt-0.5 text-[10px] text-white/40">
        {isClaiming ? <span className="text-accent">deciding…</span> : `${player.score} pts`}
      </div>
    </div>
  )
}
