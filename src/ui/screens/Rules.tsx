/**
 * The rules, in the app.
 *
 * Croatian Armageddon is not a game anyone will already know, so this has to teach it
 * from nothing. It is written as the reference you reach for mid-game — round
 * requirements first, then the awkward bits people actually argue about.
 */

import { DECK_COUNT, JOKER_COUNT } from '../../engine/config.ts'
import { ROUNDS } from '../../engine/rounds.ts'
import { useStore } from '../store.ts'

export function Rules() {
  const setScreen = useStore((store) => store.setScreen)
  const game = useStore((store) => store.game)

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <button
          type="button"
          onClick={() => setScreen(game ? 'table' : 'home')}
          className="text-sm text-white/60 active:scale-95"
        >
          ← Back
        </button>
        <h1 className="text-base font-bold text-white">How to play</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 text-sm leading-relaxed text-white/75">
        <p className="text-white/60">
          Seven rounds, each with its own opening requirement. Every card left in your hand
          at the end of a round scores against you. Lowest total after round seven wins.
        </p>

        <p className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/60">
          Played four-handed, with {DECK_COUNT} decks shuffled together and three Jokers
          from each — {JOKER_COUNT} Jokers in play.
        </p>

        <Section title="The rounds">
          <div className="overflow-hidden rounded-lg border border-white/10">
            {ROUNDS.map((spec) => (
              <div
                key={spec.round}
                className="flex items-baseline gap-3 border-b border-white/5 px-3 py-2 last:border-0"
              >
                <span className="w-4 text-sm font-bold text-accent">{spec.round}</span>
                <span className="w-16 shrink-0 text-[11px] text-white/40">
                  {spec.cardsDealt} cards
                </span>
                <span className="text-xs text-white/80">{spec.label}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-white/50">
            Those are minimums, not fixed sizes. A{' '}
            <strong className="text-white/80">three of a kind</strong> is three or more cards of
            the same rank — duplicates allowed, and nine Jacks all go down as one. A{' '}
            <strong className="text-white/80">run</strong> is four or more consecutive cards in
            one suit and can run as long as you can make it. An Ace plays high or low, but a run
            cannot wrap around from King through Ace to 2.
          </p>
          <p className="mt-2 text-xs text-white/50">
            What is fixed is the <em>number</em> of melds — never more than the round asks for.
            That is why a pile of one rank is always a single meld.
          </p>
        </Section>

        <Section title="A turn">
          <ol className="list-decimal space-y-1.5 pl-5 text-xs text-white/70">
            <li>Take a card — from the draw pile, or the discard if it is still on top.</li>
            <li>
              Open, if you can and want to. Kick cards onto anything already on the table.
              Buy Jokers back.
            </li>
            <li>Throw one card. That ends your turn.</li>
          </ol>
        </Section>

        <Section title="Opening and kicking">
          <p className="text-xs text-white/70">
            You need the whole requirement at once to open. Once open, you may add single
            cards to any meld on the table, yours or anyone else&rsquo;s. You may not lay extra
            melds beyond the round&rsquo;s requirement, so the ranks and suits on the table are
            settled once everyone has opened — a card matching none of them can never be
            played, and will be stuck in your hand at the end.
          </p>
          <Note>
            You may open and kick on the same turn, but not onto the melds you just laid —
            those are closed until your next turn.
          </Note>
        </Section>

        <Section title="Wanting the discard">
          <p className="text-xs text-white/70">
            Every time a card is thrown, everyone is asked in clockwise order whether they
            want it. The first to say yes gets it. If it is about to be your turn, it is free
            and counts as your draw. If it is not, you also take a penalty card — two cards
            for one. Taking a card out of turn does not change whose turn it is.
          </p>
          <Note>
            Once a card is claimed away, the card underneath is not the last card thrown, so
            nobody may pick it up.
          </Note>
        </Section>

        <Section title="Jokers">
          <p className="text-xs text-white/70">
            A Joker stands in for any card. If one is sitting in a played meld, you may buy it
            on your turn by handing over the card it represents — even if you have not opened,
            and without using up your turn. In a run it means one exact card and no other. In
            a three of a kind, any card of that rank will do.
          </p>
          <Note>
            Three Jokers are only a three of a kind if playing them leaves you with no cards.
          </Note>
        </Section>

        <Section title="Ending a round">
          <p className="text-xs text-white/70">
            A round ends when someone throws their last card. Your hand only shrinks when you
            kick, so getting out means having cards that fit the table. Everyone else counts
            what they are holding: pips for numbers, 10 for face cards, 15 for Aces and
            Jokers.
          </p>
          <Note>
            If the draw pile runs out, the top discard stays where it is and the rest of the
            pile is flipped over to become the new draw pile. It is not shuffled, so the order
            is knowable if you were paying attention.
          </Note>
        </Section>

        <Section title="Round seven">
          <p className="text-xs text-white/70">
            The endgame. You may only open if doing so empties your hand outright, with no
            discard afterwards — so the first person to open ends the game. Instead of three
            runs you may lay one run of an entire suit, low Ace through high Ace. That is
            fourteen cards, more than you are dealt, so the only way there is through the
            extra cards that claims and penalties put in your hand.
          </p>
        </Section>

        <p className="mt-8 border-t border-white/10 pt-4 text-center text-[11px] text-white/35">
          Croatian Armageddon was created by Dese, with help from Karl.
        </p>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-accent">{title}</h2>
      {children}
    </section>
  )
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 rounded-lg border-l-2 border-accent/50 bg-white/[0.03] px-3 py-2 text-[11px] leading-snug text-white/60">
      {children}
    </p>
  )
}
