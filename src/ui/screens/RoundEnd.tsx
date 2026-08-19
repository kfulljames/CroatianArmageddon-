import { cardLabel, handPoints } from '../../engine/cards.ts'
import { isFinalRound, roundSpec } from '../../engine/rounds.ts'
import type { GameState } from '../../engine/state.ts'
import { HUMAN_ID, useStore } from '../store.ts'
import { CardFace } from '../components/CardFace.tsx'

export function RoundEnd({ state }: { state: GameState }) {
  const dispatch = useStore((store) => store.dispatch)
  const roundScores = state.scoreSheet[state.scoreSheet.length - 1] ?? {}
  const wentOut = state.players.find((player) => player.hand.length === 0)
  const ordered = [...state.players].sort((a, b) => a.score - b.score)

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-white/10 px-4 py-4 text-center">
        <p className="text-xs uppercase tracking-wide text-white/40">
          Round {state.round} · {roundSpec(state.round).label}
        </p>
        <h1 className="mt-1 text-xl font-bold text-white">
          {wentOut
            ? wentOut.id === HUMAN_ID
              ? 'You went out!'
              : `${wentOut.name} went out`
            : 'Round over'}
        </h1>
        {!wentOut && (
          <p className="mt-1 text-[11px] leading-snug text-amber-200/80">
            Nobody could shed another card, so everyone counts what they are holding.
          </p>
        )}
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {ordered.map((player) => {
          const gained = roundScores[player.id] ?? 0
          const isYou = player.id === HUMAN_ID
          return (
            <div
              key={player.id}
              className={[
                'rounded-xl border p-3',
                isYou ? 'border-accent/50 bg-accent/5' : 'border-white/10 bg-white/[0.03]',
              ].join(' ')}
            >
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold text-white">
                  {isYou ? 'You' : player.name}
                </span>
                <span className="text-sm text-white/70">
                  <span className={gained === 0 ? 'text-emerald-300' : 'text-amber-200'}>
                    +{gained}
                  </span>
                  <span className="ml-2 font-bold text-white">{player.score}</span>
                </span>
              </div>
              {player.hand.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-0.5">
                  {player.hand.map((card) => (
                    <CardFace key={card.id} card={card} size="xs" label={cardLabel(card)} />
                  ))}
                </div>
              )}
              {isYou && player.hand.length > 0 && (
                <p className="mt-1.5 text-[10px] text-white/40">
                  {handPoints(player.hand)} points caught in hand
                </p>
              )}
            </div>
          )
        })}
      </div>

      <div className="border-t border-white/10 p-4">
        <button
          type="button"
          onClick={() => dispatch({ type: 'startNextRound' })}
          className="w-full rounded-xl bg-accent py-3.5 text-sm font-bold text-felt-900 active:scale-[0.98]"
        >
          {isFinalRound(state.round) ? 'Final standings' : `Deal round ${state.round + 1}`}
        </button>
      </div>
    </div>
  )
}
