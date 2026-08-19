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

| Round | Cards dealt | Requirement to open |
| ----- | ----------- | ------------------- |
| 1 | 9 | Two three of a kinds |
| 2 | 9 | One three of a kind, one run of four |
| 3 | 9 | Two runs of four |
| 4 | 12 | Three three of a kinds |
| 5 | 12 | Two three of a kinds, one run of four |
| 6 | 12 | One three of a kind, two runs of four |
| 7 | 12 | Three runs of four, plus special rules |

A **three of a kind** is three or more cards of the same rank. Duplicates are fine —
4♥ 4♥ 4♣ is legal. A **run** is four or more consecutive cards in a single suit. An
Ace plays high or low, but a run may not wrap around: 2-A-K is not a run.

You may build a set of five or a run of seven, but you may never lay *more melds*
than the round requires. Two three of a kinds of the same rank are not allowed — six
Kings are one set of six, not two sets of three.

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
2. **Same-suit runs may gap or overlap, but never run sequentially.** A-2-3-4♠ and
   5-6-7-8♠ are illegal, being one run in disguise. A one-card gap is legal, and so
   is an overlap using duplicate cards from two decks. The restriction applies only
   when laying down — kicking the bridge card on later is allowed.
3. **You may open and kick on the same turn**, but not onto the melds you just laid.
   Those are closed until your next turn.
4. **In rounds 1–6 the last card must leave as a discard.** You must keep one card
   back; the app will not let you kick your hand down to nothing.
5. **A Joker in a run is pinned to its slot.** See above.
6. **Buying a Joker does not use up your turn**, you may buy more than one, and
   Jokers sitting there as kickers can be bought too.
7. **The out-of-turn penalty is one card.**
8. **An Ace scores 15** whether it was playing high or low.
9. **Round 7 opens only by going out** — the melds must consume the entire hand.

## Open questions for Dese and Karl

Things the app hit that the written rules do not cover. The app currently makes a
choice; the choice is yours to overrule.

**A round can reach a position where nobody can ever go out.** Hand size only changes
by kicking, so once every card still circulating is one that no meld on the table
will accept, no hand can shrink and the round runs forever. Simulation reaches this
in roughly 5% of rounds 3, 5 and 6, and it is the normal outcome of round 7. At a
real table people would notice and move on; software cannot shrug. **The app scores
the round where it stands** after forty turns with nothing kicked or claimed. Is that
right, or should something else happen — a redeal, or everyone scoring double?

**Does anyone actually go out in round 7?** In simulation, almost nobody does (95% of
round sevens end with everyone counting). If that matches how it plays at your table,
nothing needs changing — it makes going out in round 7 a genuine triumph. If someone
usually does go out, a rule is probably missing from the written version.
