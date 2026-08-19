# Croatian Armageddon

A mobile app for the seven-round card game created by **Dese**, with help from Karl.

Four-handed: you against three computer opponents, on Android or iOS. Everything runs
on the device — no account, no network, no server.

The rules are in [RULES.md](RULES.md), including the decisions taken where the
original written rules left a gap, and the questions the build raised that are Dese's
to answer.

## Running it

```bash
npm install
npm run dev          # play it in a browser
```

## Checks

```bash
npm test             # unit tests, plus a short simulation sweep
npm run typecheck
npm run simulate -- --games 4000            # long invariant sweep
npm run compare  -- --games 150             # measure the bot difficulties
npm run playthrough                         # drive a real browser through a round
```

`npm run playthrough` needs the dev server running.

## How it is put together

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

That mattered in practice. The simulator immediately found that rounds could run
forever — hand size only changes by kicking, so once every live card has been
absorbed into the melds, nobody can go out. It went on to find four more genuine
bugs, including openings that left two runs sequential and bots that discarded the
card they could play while clinging to one they never could.

Runs are modelled on a 1..14 slot scale where slot 1 is the low Ace and slot 14 the
high Ace. "An Ace is high and low but cannot wrap" then needs no special case: no
consecutive span contains both ends.

## Building for the stores

```bash
npm run build
npx cap sync
npx cap open android     # then build in Android Studio
npx cap open ios         # then build in Xcode
```

The native projects are committed, so they open directly. Publishing needs a Google
Play Console account (one-off fee) and, for iOS, an Apple Developer account
(annual) plus a Mac or a cloud build service.

## What is not here yet

Online multiplayer with friends on their own phones. The engine was built so that it
could be added without rewriting the rules, but it needs a backend and is out of
scope for this version.
