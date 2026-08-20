import { useState } from 'react'
import { useStore } from '../store.ts'
import { hasSaved } from '../persist.ts'

export function Home() {
  const setScreen = useStore((store) => store.setScreen)
  const resumeSaved = useStore((store) => store.resumeSaved)
  const [savedGame] = useState(hasSaved)

  return (
    <div className="flex h-full flex-col">
      {/*
        The banner runs to the edges and sits flush with the top, so its only visible
        boundary is the bottom one — which is faded into the felt rather than cut, so
        the artwork settles onto the table instead of being pasted over it.
      */}
      <img
        src="title.webp"
        alt="Croatian Armageddon"
        className="w-full shrink-0 select-none"
        style={{
          maskImage: 'linear-gradient(to bottom, black 74%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 74%, transparent 100%)',
        }}
      />

      <div className="-mt-4 flex flex-1 flex-col px-6 pb-8">
        {/* The tagline belongs to the artwork, so it stays tucked under it. */}
        <p className="text-center text-sm text-white/55">
          Seven rounds. Lowest score wins.
        </p>

        {/* The buttons take the room that is left, centred, rather than being
            stranded at a fixed distance from either end. */}
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs space-y-2.5">
            {savedGame && (
              <MenuButton variant="accent" onClick={() => resumeSaved()}>
                Resume game
              </MenuButton>
            )}
            <MenuButton
              variant={savedGame ? 'plain' : 'accent'}
              onClick={() => setScreen('setup')}
            >
              New game
            </MenuButton>
            <MenuButton onClick={() => setScreen('rules')}>How to play</MenuButton>
          </div>
        </div>

        <p className="text-center text-[11px] leading-relaxed text-white/35">
          A card game created by <span className="text-white/60">Dese</span>,
          <br />
          with help from Karl.
        </p>
      </div>
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
