# Croatian Armageddon

A card game invented by **Dese**, and played at her table for twenty years.
This is the app.

Seven rounds. Each one asks you to lay down one more card than the last, and every
card still in your hand when a round ends is scored against you. Lowest total after
round seven wins. If two people tie, it goes to a single round of rock paper scissors,
which is the correct way to settle anything.

## The shape of it

The whole game hangs on one number, climbing:

| Round | Lay down | Made of |
| ----- | -------- | ------- |
| 1 | **6** | two three of a kinds |
| 2 | **7** | a three of a kind and a run of four |
| 3 | **8** | two runs of four |
| 4 | **9** | three three of a kinds |
| 5 | **10** | two three of a kinds and a run of four |
| 6 | **11** | a three of a kind and two runs of four |
| 7 | **12** | three runs of four, and then it gets serious |

Six, seven, eight, nine, ten, eleven, twelve. The shape shifts underneath you as three
of a kinds give way to runs, but the size only ever ticks up by one.

## Why it bites

**You need the whole thing at once.** No laying a set now and a run later. Until you
can put the entire requirement on the table you are just holding cards and watching
your score climb.

**Your hand only shrinks when you kick.** This is the one that catches people. Drawing
a card and throwing one away leaves you with exactly as many cards as before. The only
way to get rid of anything is to add it to a meld already on the table — yours or
anybody else's. So the melds *decide* what you can shed.

And the number of melds is fixed for the round. Once everyone has opened, the ranks
and suits on the table are settled for good, and a card matching none of them will
still be in your hand when the round ends. Which means the melds you choose to lay
down are really a decision about what you will be able to get rid of later. Most
people work that out somewhere around round four.

**Everyone wants the discard.** Every single time a card is thrown, the whole table is
asked in turn whether they want it. First yes takes it. If your turn is next it costs
you nothing — but if it is not, you take a penalty card as well. Two cards for one, on
a gamble that the one you wanted is worth it.

> The original rules note that playing this as a free-for-all, first to shout, "has
> been known to throw road bumps in friendships."

**Jokers are never safe.** A Joker stands in for any card, but while it sits in a meld
on the table anyone can buy it — hand over the card it is pretending to be and the
Joker is yours. You do not even have to be open. It costs you nothing but the card.

## Round seven

You may only open in round seven if doing so empties your hand completely, in one
movement, with no discard afterwards. So nobody opens early, nobody opens carefully,
and the round is quiet for a long time while everybody builds.

Then somebody picks up the card that fits, lays their whole hand down at once, and
the game is over. Everyone else counts what they were holding.

Exactly one person ever does this.

## The app

Four-handed — you and three opponents — with two decks shuffled together and six
Jokers in play, which is how it is dealt at Dese's table.

It runs entirely on the device. No account, no network, nothing to sign up for.

You do not need to know the rules to start. Tap a card and every place it can legally
go lights up; anything the rules forbid is simply never offered. The scoring is kept
for you, so nobody has to find a pen. The full rules are a tap away inside the app,
and written out in [RULES.md](RULES.md).

Three difficulty settings. Sort your hand by rank or by suit, put the Ace at whichever
end you are building towards, and drag any card — a Joker especially — to sit beside
the run you mean it for.

## Playing it

```bash
npm install
npm run dev -- --host
```

That prints an address on your local network. Open it on a phone: the game is meant
to be played to hand, and a laptop browser will lie to you about whether the cards are
readable.

For the engineering — how the rules are modelled, what the simulator found, and how to
build for the stores — see [DEVELOPMENT.md](DEVELOPMENT.md).

---

Croatian Armageddon was created by Dese, with help from Karl.
