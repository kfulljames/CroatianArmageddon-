import { useState } from 'react'
import { useStore } from '../store.ts'
import { hasSaved } from '../persist.ts'

export function Home() {
  const setScreen = useStore((store) => store.setScreen)
  const resumeSaved = useStore((store) => store.resumeSaved)
  const [savedGame] = useState(hasSaved)

  return (
    <div className="flex h-full flex-col items-center justify-between px-6 py-10">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <h1 className="text-4xl font-black leading-tight tracking-tight text-white">
          Croatian
          <br />
          <span className="text-accent">Armageddon</span>
        </h1>
        <p className="mt-3 text-sm text-white/50">Seven rounds. Lowest score wins.</p>
      </div>

      <div className="w-full max-w-xs space-y-2.5">
        {savedGame && (
          <MenuButton variant="accent" onClick={() => resumeSaved()}>
            Resume game
          </MenuButton>
        )}
        <MenuButton variant={savedGame ? 'plain' : 'accent'} onClick={() => setScreen('setup')}>
          New game
        </MenuButton>
        <MenuButton onClick={() => setScreen('rules')}>How to play</MenuButton>
      </div>

      <p className="mt-8 text-center text-[11px] leading-relaxed text-white/35">
        A card game created by <span className="text-white/60">Dese</span>,
        <br />
        with help from Karl.
      </p>
    </div>
  )
}

function MenuButton({
  onClick,
  children,
  variant = 'plain',
}: {
  onClick: () => void
  children: React.ReactNode
  variant?: 'plain' | 'accent'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'w-full rounded-xl py-3.5 text-sm font-bold active:scale-[0.98]',
        variant === 'accent'
          ? 'bg-accent text-felt-900'
          : 'border border-white/20 bg-white/5 text-white',
      ].join(' ')}
    >
      {children}
    </button>
  )
}
