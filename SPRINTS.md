# The next four sprints

Two weeks each, give or take. Written for someone who can already code and who has
played Croatian Armageddon for years — that second half is the rarer qualification and
it decides the order below.

[CONTRIBUTING.md](CONTRIBUTING.md) covers the layout and the rules of the road.
[DEVELOPMENT.md](DEVELOPMENT.md) has the engineering detail and the honest list of what
is broken. Reorder any of this if something else grabs you; the sequence is a
recommendation, not a schedule.

The one standing rule: `npm test` and `npm run simulate` both pass before anything gets
pushed.

---

## Sprint 1 — Rules fidelity

**Goal:** the app plays the game as it is actually played, not as it was inferred from
a written ruleset.

This is first because you are the only person who can do it, and because everything
downstream is built on top of it. Bot heuristics tuned against slightly wrong rules are
wasted work.

The written rules left gaps that software cannot skip past — what happens when the draw
pile empties, whether two runs in one suit are legal, what a Joker in a run *is*. Those
gaps were resolved in conversation and are recorded as nine numbered **Rulings** in
[RULES.md](RULES.md). Each has a named test in `tests/rulings.test.ts`. They are my best
reading of the game. Some of them are probably wrong.

1. Play it on a real device, all seven rounds. `npm run dev -- --host`, or build the
   Android app — both work. Note anything that felt off, including things you can't
   immediately justify; "that isn't how it goes" is a valid bug report here and has
   already found two real ones.
2. Read the nine Rulings against your own experience. Ruling 2 (same-suit runs) and
   Ruling 5 (Joker identity in a run) are the two I'd least trust. Ruling 3 has already
   been corrected twice from the table.
3. `npm run fixture -- --r7` writes a saved game where the human can go out in round
   seven, so you can inspect the rarest moment in the game without waiting for it.
4. Fix what's wrong. A Ruling change means: update `RULES.md`, update the in-app rules
   screen in `src/ui/screens/Rules.tsx`, change the engine, and change the named test so
   it now asserts the correct behaviour. All four, or they drift.

**Done when:** you have read all nine Rulings against the real game and either corrected
them or signed off on them, and `DEVELOPMENT.md` no longer says nobody who knows the
game has played it.

**Worth knowing:** the engine is a pure reducer with `legalMoves(state)` beside it, and
both the UI and the bots go through it. So a rules fix lands in one place and cannot be
half-applied — there is no second copy of the rules to forget.

---

## Sprint 2 — Make the Hard bots hard

**Goal:** close the gap between Hard and Normal, using knowledge I don't have.

The current numbers, rotating each level through every seat because moving first is
worth real points and a fixed seating flatters whoever sits in the good chair:

```
Hard    245.7 avg    25% wins
Normal  251.2 avg    25% wins
Easy    — genuinely much weaker
```

Hard is Normal with extra steps. It's effectively a two-level game right now.

The honest diagnosis: every heuristic in `src/ai/` is my inference of how this game is
played, from reading the rules. You have twenty years of actual play. That is the
asset — the interesting question is less "what search do we run" than "what does a good
player do with a Joker in round three," and you can answer that directly.

1. `npm run compare -- --games 300` is the scoreboard. Read `src/sim/compare.ts` first;
   it explains the seat rotation and why a single seating is worthless as a measurement.
2. **No change lands without a measured win.** Measure, change, measure. If the number
   didn't move, revert it — I threw away two changes I was certain about. Log the
   negative results in `DEVELOPMENT.md`; that section is the honest record.
3. `src/ai/bot.ts` is the decision points (claim, draw, play, discard); `src/ai/evaluate.ts`
   is hand valuation and distance-to-open. The difficulty levels are knobs on one bot,
   not three bots.
4. You cannot break the game from in here. The engine refuses illegal moves regardless
   of what the bot asks for, so the worst case is a bot that plays badly.

Open questions I'd genuinely like your read on: is the claim-penalty maths right — when
is two cards for one actually worth it? Should a bot hold a Joker it could play? Does a
good player discard by point value or by what it feeds the table?

**Done when:** Hard beats Normal by a margin that survives seat rotation, and the number
is written down.

---

## Sprint 3 — Round seven

**Goal:** the hardest problem in the project.

Round seven go-outs run at about 93%. A real player manages it every time.

It is not a detection failure — the engine never misses a go-out when one exists,
verified across 19,184 hands. The bots simply don't build the right hand. And round
seven is a different game from the other six: you may only open if it empties your hand
completely, in one movement, with no discard. So there is no kicking, no partial
progress, no incremental shedding. It is pure construction toward a single legal
terminal state, twelve or thirteen cards across three runs, and every draw either helps
or doesn't.

That makes it the one place in this project where heuristics are arguably the wrong
tool and a real search would pay. `src/engine/openings.ts` already resolves abstract
shapes against concrete cards and returns every legal way a hand could open; the
question is what to *hold* thirty turns before that becomes possible.

`src/ai/evaluate.ts` has a special case for the final round already — it was capping
progress at twelve cards for a thirteen-card problem, which is fixed, but the metric
underneath it is still crude.

**Done when:** round seven go-outs are meaningfully above 93%, measured over a few
thousand games, without regressing rounds one through six.

**Fair warning:** this may not be reachable with heuristics at all, and "we tried search
and here is what it cost" is a perfectly good outcome to write up.

---

## Sprint 4 — Ship it

**Goal:** a stranger can install it.

1. **Make it survivable by someone who has never played.** Minimum bar: when you tap a
   card and nothing lights up, say why. `legalMoves(state)` in `src/engine/actions.ts`
   already knows — it's a surfacing problem, not a logic one. Everything beyond that
   (hint mode, a guided first round) is optional and can wait for real feedback.
2. **Signing.** Generate a keystore and back it up somewhere permanent — lose it and the
   listing can never be updated again. `android/app/build.gradle` has a `release` build
   type but no `signingConfig`, so `./gradlew bundleRelease` alone emits an unsigned
   bundle the Play Console will reject. Android Studio's **Build → Generate Signed App
   Bundle** writes that config; keep the password out of the repo.
3. **Store listing.** Screenshots from a real device, feature graphic, description,
   privacy policy. Ours is short and true: it collects nothing and never contacts a
   server.
4. **Internal testing track first.** Five phones that aren't yours, one week, then
   production.

iOS is the same story and the `ios/` project is already built and waiting, but it needs
a Mac and a paid Apple account, so it's a separate conversation.

**Done when:** it's on the Play Store and someone neither of us knows has installed it.

---

## Standing problems, if you'd rather pick your own

- **Online multiplayer.** The engine was built so this is possible — it's a pure
  function, so a server runs the identical one, and the client can't cheat because it
  never owned the rules. Needs a backend. Six weeks, not two, and the most interesting
  thing on this list.
- **Accessibility.** Effectively none. Almost nothing in `src/ui/` is screen-reader
  usable.
- **Undo.** The state is immutable so it's within reach, but the design question is real:
  what does undo mean when three bots have moved since?
