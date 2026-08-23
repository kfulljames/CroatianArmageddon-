# The next four sprints

Two weeks each, give or take. Each one ends with something you can show someone.

Read [CONTRIBUTING.md](CONTRIBUTING.md) first — it covers how the project is put
together and the rules of the road.

---

## Sprint 1 — Land in the code, ship something you can hear

**Goal:** the game running on your own phone, with your fingerprints on it.

1. Get it running: `npm install`, then `npm run dev -- --host`. Open the address it
   prints on your phone. Play a full seven rounds. Write down every moment you were
   confused — that list is worth more than it looks, and you only get to make it once.
2. Build the real Android app: `npm run build && npx cap sync && npx cap open android`,
   then Run in Android Studio with your phone plugged in. Now it's an app on your home
   screen.
3. Read `src/engine/state.ts` and then `src/engine/reduce.ts`. That's the whole
   architecture. Skip everything else for now.
4. **Build it:** sound and haptics. New file `src/ui/sound.ts`. A card-deal sound, a
   card-place sound, a small buzz when it's your turn — Web Audio API for the sounds,
   `navigator.vibrate` for the buzz. Add an on/off toggle to `Settings` in
   `src/ui/store.ts` and make sure it survives closing the app.

**Done when:** the app is on your phone, it makes noise, and the toggle still says what
you left it saying after a restart.

**Why this first:** it's self-contained, it can't break the rules, and it teaches you
where everything lives without anyone lecturing you.

---

## Sprint 2 — Make the Hard bots actually hard

**Goal:** fix the biggest known flaw in the project.

Right now Hard and Normal are statistically the same. We measured it. That's a real
open problem, it's yours, and it lives entirely in `src/ai/` — where you cannot break
the game, because the engine refuses illegal moves no matter what the bot asks for.

1. `npm run compare -- --games 300` is your scoreboard. It rotates each difficulty
   through every seat, because seat position alone is worth real points and will lie to
   you otherwise. Read `src/sim/compare.ts` first — it explains why.
2. **The rule of this sprint: no change lands without a measured win.** Run the
   comparison before, make the change, run it after. If the number didn't move, revert
   it. This is the actual skill being learned here, and most people never learn it.
3. Ideas worth trying, roughly easiest first:
   - Track which ranks are dead — if all four 7s are visible, stop holding for one.
   - Don't discard a card an opponent has already claimed the twin of.
   - Hold Jokers longer in rounds 1–3, dump them fast in round 7.
   - Get the claim-penalty maths right: is two cards for that one card worth it?
4. Write what you found into `DEVELOPMENT.md`, including the things that *didn't* work.
   That section is the honest record and it should stay honest.

**Done when:** Hard beats Normal by a margin that holds up across rotated seats, and
the number is written down.

---

## Sprint 3 — Make it playable by someone who's never played

**Goal:** the app teaches the game.

Right now the app assumes you already know Croatian Armageddon. Nobody outside the
family does. This is the difference between a family app and a real one.

1. **Hint mode.** `src/engine/openings.ts` already works out every way a hand could
   open. Use it to show "you're two cards from opening" — and which two. Toggleable,
   off by default.
2. **Say why not.** When you tap a card and nothing lights up, the app currently says
   nothing. `legalMoves(state)` in `src/engine/actions.ts` knows exactly why. Surface
   it: "you have to open before you can add to anything."
3. **A guided first round.** Not a wall of text — a few pointers on the real table
   during round one: this is the draw pile, you need six cards down, your hand only
   shrinks when you add to a meld.
4. Test it on an actual human who has never played. Watch, don't help. Where they
   hesitate is the bug.

**Done when:** someone who has never played finishes round one without asking a
question.

---

## Sprint 4 — Put it in the Play Store

**Goal:** a stranger can install it.

1. Generate a signing keystore. **Back it up somewhere permanent** — lose it and the
   app can never be updated again, ever. This is the one irreversible step in the whole
   project.
2. Wire the keystore up. `android/app/build.gradle` has a `release` build type but no
   `signingConfig`, so `./gradlew bundleRelease` on its own emits an *unsigned* bundle
   that the Play Console will reject. Easiest route is Android Studio's
   **Build → Generate Signed App Bundle**, which writes the config for you; keep the
   keystore password out of the repo.
3. Store listing: screenshots from a real device, a feature graphic, a description, and
   a privacy policy. Ours is short and true: the app collects nothing and never talks to
   a server.
4. Google Play Console → internal testing track first. Get it onto five phones that
   aren't yours and let it sit for a week.
5. Then production.

**Done when:** it's on the Play Store and someone you've never met has installed it.

iOS is the same story but needs a Mac and a paid Apple account, so it's a separate
conversation — the `ios/` project is already built and waiting either way.

---

## After that, if you want more

- **Online multiplayer.** The engine was deliberately built so this is possible: it's a
  pure function, so a server can run the exact same one. It needs a backend and it's a
  real project — six weeks, not two. But it's the natural next thing and the groundwork
  is already laid.
- **Accessibility.** Almost none of the UI is screen-reader usable right now. It's
  unglamorous, and it's the kind of work that separates people who ship from people who
  demo.
- **An undo button.** Harder than it sounds and a genuinely interesting problem: the
  state is immutable, so it's within reach, but you have to decide what a bot's turn
  undoes to.
