# Development

Engineering notes for [Croatian Armageddon](README.md). The rules themselves, and the
decisions taken where the written rules left a gap, are in [RULES.md](RULES.md).

## Running it

```bash
npm install
npm run dev              # play it in a browser
npm run dev -- --host    # ...or on your phone, over the same wifi
```

## Checks

```bash
npm test                                    # unit tests, plus a short simulation sweep
npm run typecheck
npm run simulate -- --games 4000            # long invariant sweep
npm run compare  -- --games 150             # measure the bot difficulties
npm run playthrough                         # drive a real browser through a round
npm run icons                               # rebuild every icon from the source artwork
```

`npm run playthrough` needs the dev server running. `npm run fixture -- --r7` writes a
saved game where the human can go out in round seven, so the rarest and most important
moment in the game can be rendered on demand rather than waited for.

## Layout

```
src/engine/   the rules — pure TypeScript, no React, no DOM, no I/O
src/ai/       the opponents
src/sim/      headless games, for finding rules bugs at volume
src/ui/       the interface
```

The engine is the load-bearing piece. It is a reducer — `(state, action) => state` —
alongside `legalMoves(state)`, which lists everything that may be done right now. The
interface and the bots both go through that same door, so a move that is illegal is
unrepresentable rather than merely un-rendered, and the two can never drift apart.

Keeping it free of the framework is what makes the rest cheap. Tens of thousands of
bot-vs-bot games run in seconds with no browser involved, every game replays exactly
from its seed, and the same engine would serve online multiplayer unchanged.

Runs are modelled on a 1..14 slot scale where slot 1 is the low Ace and slot 14 the
high Ace. "An Ace is high and low but cannot wrap" then needs no special case: no
consecutive span contains both ends.

## What the simulator found

It earned its place immediately by finding that rounds could run forever. Hand size
only changes by kicking, so once every live card has been absorbed into the melds,
nobody can go out. It went on to find four more genuine bugs, including openings that
left two runs sequential and bots that discarded the card they could play while
clinging to one they never could.

It also made the game's own history usable as a specification. Dese and Karl have
never seen a round stalemate in twenty years, and have recycled the draw pile twice in
all that time. Measuring against that caught two further bugs — a stalemate backstop
that was ending round seven before anyone could assemble three runs, and bots that
valued a run only up to four cards when round seven needs thirteen across three.
Rounds 1–6 now finish with a winner in every simulated game.

## Known gaps

**Hard bots are not harder than Normal.** Measured by rotating each level through
every seat, because moving first is worth real points and a single seating flatters
whoever sits in the good chair: Hard 245.7, Normal 251.2, both winning at the 25%
baseline. Easy is genuinely much weaker. Treat it as a two-level game until that is
fixed.

**Round seven go-outs run at about 93%.** A real player manages it every time. The
engine never misses a go-out when one exists — verified across 19,184 hands — so this
is bot skill, not detection.

**Nobody who knows the game has played it yet.** Both corrections that came back from
the table found real bugs that no amount of simulation surfaced on its own.

## Building for the stores

```bash
npm run build
npx cap sync
npx cap open android     # then build in Android Studio
npx cap open ios         # then build in Xcode
```

The native projects are committed, so they open directly. Publishing needs a Google
Play Console account (one-off fee) and, for iOS, an Apple Developer account (annual)
plus a Mac or a cloud build service.

Icons and splash screens are generated from `assets/source/emblem.png` by
`npm run icons`; everything derived from it is gitignored, so the artwork is the
single source of truth.

`vercel.json` is present and correct but unused — the connected Vercel account's role
cannot create projects. If that is ever sorted, importing the repository is all it
needs.

## Not here yet

Online multiplayer with friends on their own phones. The engine was built so it could
be added without rewriting the rules, but it needs a backend and is out of scope for
this version.
