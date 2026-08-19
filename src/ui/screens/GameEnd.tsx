import type { GameState } from '../../engine/state.ts'
import { HUMAN_ID, useStore } from '../store.ts'

export function GameEnd({ state }: { state: GameState }) {
  const abandonGame = useStore((store) => store.abandonGame)
  const ordered = [...state.players].sort((a, b) => a.score - b.score)
  const tied = state.tiedPlayerIds.length > 0
  const youWon = state.winnerId === HUMAN_ID
  const youTied = state.tiedPlayerIds.includes(HUMAN_ID)

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-white/10 px-4 py-6 text-center">
        <p className="text-xs uppercase tracking-wide text-white/40">Seven rounds played</p>
        <h1 className="mt-2 text-2xl font-black text-accent">
          {tied
            ? 'It’s a tie'
            : youWon
              ? 'You win!'
              : `${state.players.find((player) => player.id === state.winnerId)?.name ?? 'Nobody'} wins`}
        </h1>
        {tied && (
          <p className="mx-auto mt-2 max-w-xs text-xs leading-snug text-white/60">
            {youTied ? 'You are' : 'They are'} level on{' '}
            {Math.min(...state.players.map((player) => player.score))} points. Settle it the
            proper way — one round of rock paper scissors.
          </p>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        <ol className="space-y-2">
          {ordered.map((player, index) => {
            const isYou = player.id === HUMAN_ID
            return (
              <li
                key={player.id}
                className={[
                  'flex items-center gap-3 rounded-xl border p-3',
                  index === 0 ? 'border-accent/60 bg-accent/10' : 'border-white/10 bg-white/[0.03]',
                ].join(' ')}
              >
                <span className="w-5 text-center text-sm font-bold text-white/40">{index + 1}</span>
                <span className="flex-1 text-sm font-semibold text-white">
                  {isYou ? 'You' : player.name}
                </span>
                <span className="text-base font-bold text-white">{player.score}</span>
              </li>
            )
          })}
        </ol>
      </div>

      <div className="border-t border-white/10 p-4">
        <button
          type="button"
          onClick={abandonGame}
          className="w-full rounded-xl bg-accent py-3.5 text-sm font-bold text-felt-900 active:scale-[0.98]"
        >
          Back to the menu
        </button>
      </div>
    </div>
  )
}
