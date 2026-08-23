# Croatian Armageddon — the rules

A card game created by **Dese**, with help from Karl.

This is the canonical ruleset the app implements. Where it differs from the original
written rules, the difference is called out under [Rulings](#rulings) — those are
decisions made to resolve gaps that software cannot skip past, and they are Dese's to
change.

## The shape of the game

Seven rounds. Each has its own opening requirement. At the end of every round, each
player scores the cards still in their hand. **Lowest total after round seven wins.**
A tie is settled with one round of rock paper scissors.

The game is played **four-handed**, with **two decks shuffled together and three
Jokers from each** — 110 cards and six Jokers in total.

## The rounds

The simplest way to hold the whole game in your head: **the opening grows by exactly
one card every round.** Six, seven, eight, nine, ten, eleven, twelve. What changes is
the shape — three of a kinds giving way to runs — but the size only ever ticks up by
one.

| Round | Cards to lay | Made of | Dealt |
| ----- | ------------ | ------- | ----- |
| 1 | **6** | two three of a kinds | 9 |
| 2 | **7** | a three of a kind + a run of four | 9 |
| 3 | **8** | two runs of four | 9 |
| 4 | **9** | three three of a kinds | 12 |
| 5 | **10** | two three of a kinds + a run of four | 12 |
| 6 | **11** | a three of a kind + two runs of four | 12 |
| 7 | **12** | three runs of four, plus special rules | 12 |

You are always dealt more than the opening needs, so there is something to work with —
except in round 7, where the opening is your whole hand and laying it down is going
out.

Those are **minimum** sizes, not fixed ones.

A **three of a kind** is three *or more* cards of the same rank. Duplicates are fine —
4♥ 4♥ 4♣ is legal — and there is no upper limit: if you have nine Jacks, they all go
down together as a single three of a kind. A **run** is four *or more* consecutive
cards in a single suit, and can stretch as far as you can take it. An Ace plays high
or low, but a run may not wrap around: 2-A-K is not a run.

What is fixed is the *number* of melds. You may never lay more of them than the round
requires, which is why a pile of one rank is always one meld: six Kings are a single
set of six, never two sets of three.

## Dealing and turns

Deal the round's cards, then turn one card face up to start the discard pile. Play
begins with the player clockwise of the dealer; each round it moves on one more seat.

A turn is always:

1. **Take a card** — from the draw pile, or the discard pile if it is still the last
   card thrown. You take exactly one, from exactly one pile.
2. **Play** — open if you can, kick cards onto melds already on the table, buy Jokers
   back. Any order, any number of times.
3. **Throw one card.** That ends your turn.

## Wanting the discard

Every time a card is thrown, each player is asked in clockwise order from the thrower
whether they want it. The first to say yes gets it.

- If it is about to be your turn, the card is **free** and counts as your draw.
- If it is not, you take the card **and a penalty card** — two cards for one.
- Taking a card out of turn does **not** change whose turn it is.

Once a card has been claimed away, the card underneath is not the last card thrown,
so nobody may pick up from the pile.

> For a more intense game, play it so the first person to call the card gets it, out
> of order. This has been known to throw road bumps in friendships.

## Opening and kicking

To open you need the entire requirement at once. Lay it in front of you, and from
then on you may **kick** single cards onto any meld on the table — yours or anyone
else's. Runs grow at either end and only in the right direction; a set takes any card
of its rank.

This matters more than it looks. Because the number of melds is fixed for the round,
once everyone has opened, the ranks and suits on the table are settled for good. A
card matching none of them can never be played, and **your hand only shrinks when you
kick** — drawing and discarding leaves it exactly the same size. Cards that fit
nothing will still be in your hand when the round ends.

## Jokers

A Joker stands in for any card.

If a Joker is sitting in a played meld, you may **buy it** on your turn by handing
over the card it represents. You may do this even if you have not opened, and it does
not use up your turn.

- In a run, a Joker means one exact card — 4-5-6-Joker♠ is the 7♠ and nothing else.
- In a three of a kind, any card of that rank will do, including a duplicate.

Three Jokers are only a three of a kind if playing them leaves you with no cards.

## Ending a round

A round ends the moment someone throws their last card. Everyone else counts what
they are holding:

- Number cards: their face value
- Face cards: 10 each
- Aces and Jokers: 15 each

## Round seven

The endgame. You may only open if doing so leaves you with **no cards at all**, with
no discard afterwards — so the first person to open ends the game, and most rounds of
seven end with nobody opening at all.

Instead of three runs of four, you may lay one run of an entire suit, low Ace through
high Ace. That is fourteen cards, more than you are dealt, so the only route there is
through the extra cards that claims and penalties put in your hand.

---

## Rulings

Decisions taken where the written rules left a gap. Each has a named test in
`tests/rulings.test.ts`.

1. **The draw pile is rebuilt, not reshuffled.** When it runs out, the top discard
   stays where it is and the rest of the pile is flipped over bodily. Order is
   preserved (inverted), so an attentive player knows what is coming.
2. **Same-suit runs may gap or overlap, but never be laid sequentially.** A-2-3-4♠ and
   5-6-7-8♠ are illegal, being one run in disguise and one meld short of what the
   round asked for. A one-card gap is legal, and so is an overlap using duplicate
   cards from two decks. The restriction is on *laying down* only: once two runs are
   down they are two separate lays for good and never combine. Lay 2-3-4-5♠ and
   7-8-9-10♠ and the 6♠ goes onto either of them, in either position, as can a Joker.
3. **Once a meld is down it can be added to, immediately.** You may open and kick on
   the same turn, including onto what you have just laid — a Joker goes straight onto
   your own set. There is no waiting period on anything.
4. **In rounds 1–6 the last card must leave as a discard.** You must keep one card
   back; the app will not let you kick your hand down to nothing.
5. **A Joker in a run is pinned to its slot.** See above.
6. **Buying a Joker does not use up your turn**, you may buy more than one, and
   Jokers sitting there as kickers can be bought too.
7. **The out-of-turn penalty is one card.**
8. **An Ace scores 15** whether it was playing high or low.
9. **Round 7 opens only by going out** — the melds must consume the entire hand.

## Notes from twenty years of play

Two things were checked against how the game actually plays at Dese and Karl's table,
and both corrected the app rather than the rules.

**A round always ends with someone going out.** In twenty years it has never
stalemated, and the draw pile has been recycled twice in all that time. The app
originally fell far short of that, which turned out to be two bugs of its own rather
than anything missing from the rules:

- A stalemate backstop was ending a round after forty turns of nothing being kicked.
  In rounds 1–6 that is a fair signal, but in round 7 nobody kicks or opens at all
  until someone goes out, so it was killing the round before anyone could assemble
  three runs. The engine now detects a genuinely dead position exactly — every player
  opened, and no card left anywhere that any meld would accept — instead of guessing
  from a turn count.
- The bots measured progress toward "three runs of four", which is twelve cards. In
  round 7 you hold thirteen when you act and the melds must consume all of them, so
  one run has to run five long. They built exactly twelve cards' worth and then sat
  on a thirteenth they could never play.

Rounds 1–6 now end with a winner in every simulated game, and the draw pile is
recycled about once in every twenty-five rounds. Round 7 ends with someone going out
around nine times in ten; a real player manages it every time, so the bots are still
a little weaker than a person there.

**Round 7 always ends with exactly one person going out.** The last card they pick up
has to fit, and then the whole hand goes down at once; everyone else is left counting.
That is what the app implements, and `tests/simulate.test.ts` now guards both of these
so they cannot quietly regress.
