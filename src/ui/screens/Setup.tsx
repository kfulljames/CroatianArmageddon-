import { DIFFICULTIES, DIFFICULTY_LABELS, type Difficulty } from '../../ai/bot.ts'
import { DECK_COUNT, JOKER_COUNT, PLAYER_COUNT } from '../../engine/config.ts'
import { useStore } from '../store.ts'

const DIFFICULTY_BLURB: Record<Difficulty, string> = {
  easy: 'Plays its own hand and grabs anything that looks useful, penalties and all.',
  normal: 'Judges cards by what they are worth to its hand, and buys Jokers to open.',
  hard: 'Also watches what it feeds you, and reads the flipped draw pile.',
}

export function Setup() {
  const settings = useStore((store) => store.settings)
  const updateSettings = useStore((store) => store.updateSettings)
  const newGame = useStore((store) => store.newGame)
  const setScreen = useStore((store) => store.setScreen)

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <button
          type="button"
          onClick={() => setScreen('home')}
          className="text-sm text-white/60 active:scale-95"
        >
          ← Back
        </button>
        <h1 className="text-base font-bold text-white">New game</h1>
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        <Field label="Your name">
          <input
            value={settings.playerName}
            onChange={(event) => updateSettings({ playerName: event.target.value })}
            maxLength={16}
            className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-accent"
          />
        </Field>

        <Field label="The table">
          <div className="rounded-lg border border-white/15 bg-white/5 px-3 py-2.5">
            <p className="text-sm text-white">
              You and {PLAYER_COUNT - 1} opponents
            </p>
            <p className="mt-1 text-[11px] leading-snug text-white/40">
              {DECK_COUNT} decks shuffled together, {JOKER_COUNT} Jokers in play.
            </p>
          </div>
        </Field>

        <Field label="Difficulty">
          <div className="flex gap-2">
            {DIFFICULTIES.map((difficulty) => (
              <Chip
                key={difficulty}
                active={settings.difficulty === difficulty}
                onClick={() => updateSettings({ difficulty })}
              >
                {DIFFICULTY_LABELS[difficulty]}
              </Chip>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] leading-snug text-white/40">
            {DIFFICULTY_BLURB[settings.difficulty]}
          </p>
        </Field>

        <Field label="Asking about the discard">
          <button
            type="button"
            onClick={() => updateSettings({ alwaysAsk: !settings.alwaysAsk })}
            className="flex w-full items-center justify-between rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-left active:scale-[0.99]"
          >
            <span className="text-sm text-white">Ask me every time</span>
            <span
              className={`h-6 w-11 rounded-full p-0.5 transition-colors ${settings.alwaysAsk ? 'bg-accent' : 'bg-white/20'}`}
            >
              <span
                className={`block h-5 w-5 rounded-full bg-white transition-transform ${settings.alwaysAsk ? 'translate-x-5' : ''}`}
              />
            </span>
          </button>
          <p className="mt-1.5 text-[11px] leading-snug text-white/40">
            {settings.alwaysAsk
              ? 'You will be asked about every card that hits the discard pile.'
              : 'You will only be interrupted for an out-of-turn claim when the card actually connects with your hand. Free claims always ask.'}
          </p>
        </Field>
      </div>

      <div className="border-t border-white/10 p-4">
        <button
          type="button"
          onClick={newGame}
          className="w-full rounded-xl bg-accent py-3.5 text-sm font-bold text-felt-900 active:scale-[0.98]"
        >
          Deal round 1
        </button>
      </div>
    </div>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-white/50">{label}</span>
        {hint && <span className="text-[11px] text-white/35">{hint}</span>}
      </div>
      {children}
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
        'flex-1 rounded-lg border py-2 text-sm font-semibold active:scale-95',
        active
          ? 'border-accent bg-accent/15 text-accent'
          : 'border-white/15 bg-white/5 text-white/70',
      ].join(' ')}
    >
      {children}
    </button>
  )
}
