# Working on Croatian Armageddon

Welcome. This is a real app that real people play, so the bar is "it still works when
Dese picks it up," not "it compiles."

Start here, then see [SPRINTS.md](SPRINTS.md) for what to actually work on.

## Get it running

```bash
npm install
npm run dev -- --host     # prints an address — open it on your phone
npm test                  # 93 tests, roughly one per rule
npm run simulate          # bots play thousands of games against each other
```

The game is meant to be played in a hand. A laptop browser will lie to you about
whether the cards are readable.

## How the project is put together

Three layers, and the split is the most important thing to understand:

| Layer | What lives there | Size |
| --- | --- | --- |
| `src/engine/` + `src/ai/` | The rules of the game and the computer opponents | ~2,600 lines |
| `src/ui/` | The cards, the table, the taps and drags | ~2,300 lines |
| `android/` + `ios/` | The actual phone apps | generated |

The engine is deliberately *pure*: it knows the rules of Croatian Armageddon and
nothing else. No screen, no buttons, no internet, no idea it's even on a phone. Give
it a game state and a move, it hands back the new game state. That's it.

Every rule lives in exactly one place, and both you and the bots have to go through it.
An illegal move isn't merely hidden from the screen — it cannot be expressed.

Two files explain the whole architecture. Read them in this order and skip the rest
until you need it:

1. `src/engine/state.ts` — what a game *is*
2. `src/engine/reduce.ts` — every way a game can change

## Rules of the road

- One branch per piece of work. Small commits with real messages.
- `npm test` and `npm run simulate` both pass before anything gets pushed. No exceptions.
- **The engine is the contract.** `src/engine/` holds the rules as Dese plays them.
  Changing anything in there means a test proving the new behaviour, and a conversation
  first. Everything outside it is fair game.
- If you're not sure whether something is a bug or the rules being weird — ask. Twenty
  years of house rules live in this thing and some of them look wrong until explained.
- Found a bug? Every game replays exactly from its seed. Record the seed, turn it into
  a regression test.

## The mobile apps already exist

There is nothing to convert. `android/` and `ios/` aren't plans or placeholders —
they're complete native projects, committed to the repo, that open directly in Android
Studio and Xcode.

```bash
npm run build
npx cap sync

npx cap open android    # opens Android Studio → press Run
npx cap open ios        # opens Xcode → press ⌘R   (Mac only)
```

They already have the app name, the icon, the splash screen, the felt-green background
so there's no white flash on launch, and the app id `com.croatianarmageddon.app`.

The tool doing this is **Capacitor**. It puts the web app inside a real native shell —
a genuine `.apk` for Android, a genuine `.ipa` for iPhone. Not a bookmark to a website.
An app, installed, that works with the wifi off.

## Why we don't rewrite it in something else

This comes up, so here is the reasoning written down once.

**React Native.** The engine would carry over untouched — that's the payoff of keeping
it pure. But all 2,300 lines of interface get rebuilt from scratch, because React
Native has no HTML and no CSS. The fanned hand, dragging a Joker where you want it, the
scrolling row of melds — all rewritten. About a week, to end up with a game that plays
exactly the same.

**Flutter.** Written in Dart, which cannot run our TypeScript. So *everything* gets
rewritten, engine included: all nine Rulings, the Ace-high-and-low handling, the bot
logic, and the tests that prove it works. Rewriting a rules engine that took twenty
years of real play to get right, in exchange for nothing we need, is the worst option
available.

**Swift / native Xcode.** Same total rewrite as Flutter, and it only covers iPhone.
Android would need its own rewrite on top. Most work, least coverage.

The pitch for a rewrite is always "native performance." So ask what this game needs a
device to do: draw some cards, notice a tap, save the score. That's the list. No
camera, no GPS, no 3D, no 60-frames-a-second physics. A webview does all of it
instantly. There is no performance being left on the table, so there is nothing to buy.

And there's a cost people skip past: rules kept in two languages drift apart. Fix a bug
in the TypeScript, forget the Swift, and the game plays one way on iPhone and another
on Android. One engine, one set of rules, one place to fix things.

## What actually stands between us and the app stores

Not the code. Accounts and signing:

- **Google Play** — developer account (one-off fee), a signing key we generate and must
  never lose, a store listing with screenshots and a privacy policy. Ours can honestly
  say it collects nothing, because it does.
- **Apple** — developer account (annual fee), plus a Mac to run Xcode, or a cloud
  service that rents one by the minute.

Rewriting in React Native, Flutter, or Swift removes exactly zero of those steps. Worth
being clear about, because "we should rewrite it" often really means "submitting to the
stores looks intimidating." Those are different problems and only one of them is real.

---

For the engineering detail — how the rules are modelled and what the simulator found —
see [DEVELOPMENT.md](DEVELOPMENT.md). The rules themselves are in [RULES.md](RULES.md).
