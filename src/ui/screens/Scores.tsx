import { ROUNDS } from '../../engine/rounds.ts'
import type { GameState } from '../../engine/state.ts'
import { HUMAN_ID, useStore } from '../store.ts'

/** The running tally that would otherwise live on a slip of paper beside the table. */
export function Scores({ state }: { state: GameState }) {
  const setScreen = useStore((store) => store.setScreen)

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <button
          type="button"
          onClick={() => setScreen('table')}
          className="text-sm text-white/60 active:scale-95"
        >
          ← Back
        </button>
        <h1 className="text-base font-bold text-white">Scores</h1>
      </header>

      <div className="flex-1 overflow-auto p-4">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-white/40">
              <th className="pb-2 pr-2 font-medium">Round</th>
              {state.players.map((player) => (
                <th key={player.id} className="pb-2 px-1 text-right font-medium">
                  {player.id === HUMAN_ID ? 'You' : player.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROUNDS.map((spec) => {
              const scores = state.scoreSheet[spec.round - 1]
              return (
                <tr key={spec.round} className="border-t border-white/5">
                  <td className="py-2 pr-2 text-white/50">{spec.round}</td>
                  {state.players.map((player) => (
                    <td key={player.id} className="px-1 py-2 text-right text-white/80">
                      {scores ? (scores[player.id] ?? 0) : <span className="text-white/20">—</span>}
                    </td>
                  ))}
                </tr>
              )
            })}
            <tr className="border-t-2 border-white/20">
              <td className="py-2 pr-2 text-xs font-bold uppercase text-white/60">Total</td>
              {state.players.map((player) => (
                <td key={player.id} className="px-1 py-2 text-right text-base font-bold text-accent">
                  {player.score}
                </td>
              ))}
            </tr>
          </tbody>
        </table>

        <p className="mt-4 text-[11px] leading-snug text-white/40">
          Lowest total after round 7 wins. A tie is settled with one round of rock paper
          scissors.
        </p>
      </div>
    </div>
  )
}
