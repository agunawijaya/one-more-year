# Ten Harvests — notes

Working notes that the other documents cite: verified facts about the original program, written in
our own words, then the simulations we ran and the balance decisions they led to.

## Sources

- `hamurabi.bas`, the 1978 BASIC listing from _BASIC Computer Games_ (David H. Ahl), after Doug
  Dyment's 1968 original. Read-only, outside the repository at `E:\Projects\simulation\src`.
- Nothing from the listing is copied into this repository: no code, no report lines, no messages,
  no appraisals. Everything below is a description of behaviour.

## Verified behaviour of the original

Each fact was read in the listing's turn loop and traced by hand through the first two years.

- **The opening.** The city starts with 95 people, then 5 newcomers are added by the first report,
  so play begins with 100 people, 1,000 acres and 2,800 bushels. The opening report says last year's
  harvest was 3 bushels an acre (3,000 bushels) and that rats ate 200. The acres are derived from
  those numbers (3,000 ÷ 3), and the 200 is simply the difference between 3,000 and 2,800.
- **The opening report is scripted, not rolled.** The plague flag starts at a "safe" value, so the
  very first report never shows a plague. That report describes the year before the player's first
  decision. Every year the player actually decides, including the first, rolls the plague normally.
  (The prompt's "year 1 can never have a plague" is true only of that scripted report.)
- **Report numbering runs one ahead.** The decisions taken after the report headed "year _n_" are
  reported in "year _n + 1_". A term is ten decisions; the game ends on the eleventh report.
- **Land price.** Each year a whole number from 17 to 26 bushels an acre, uniform, drawn just before
  the land question.
- **Land questions.** The player is asked how much to buy; only if the answer is zero are they asked
  how much to sell. A purchase may spend the whole store (cost ≤ store). A sale must be strictly
  less than the land owned, so at least one acre always remains.
- **Food.** Asked after land, limited to the grain left after the land trade.
- **Planting.** Asked last. Zero skips every check. Otherwise the acres must not exceed the land
  owned, the seed (half the acres, rounded down) must not exceed the grain left after food, and the
  acres must be strictly fewer than ten times the people. An impossible answer is refused and the
  same question is asked again; the year does not advance.
- **Negative answers end the game at once**, at any of the four questions: the steward resigns.
- **Yield.** A whole number from 1 to 5 bushels an acre, uniform; harvest = acres planted × yield.
  The yield is rolled even when nothing was planted.
- **Rats.** A second roll from 1 to 5. On an even roll (2 or 4, so 2 years in 5) rats eat the store
  divided by the roll, rounded down: half on a 2, a quarter on a 4. The store they see is what is left
  after the land trade, the food and the seed, and before the harvest comes in.
- **Newcomers.** A third roll from 1 to 5, multiplied by (20 × acres + store), divided by the
  people, divided by 100, plus 1, rounded down. The acres are after the land trade, the store is after
  rats and harvest, and the people are those at the start of the year, before hunger.
- **Hunger.** Each person needs 20 bushels; people fed = food ÷ 20, rounded down. If more people are
  fed than live in the city, nobody goes hungry. Otherwise the hungry are the difference.
- **Deposition.** If the hungry are more than 45 % of the people, the ruler is deposed at once and
  the game ends. Newcomers and plague of that year never happen.
- **Plague.** A value equal to ten times (twice a uniform draw minus three tenths), rounded down. The
  plague comes when that value is zero or less, which is when the draw is below 0.2: **one year in
  five, 20 %**. The listing's own comment promises 15 %, which would be true only if a value of exactly
  zero did not count. When it comes, the population (after hunger and newcomers) is halved, rounded
  down.
- **Order within the year.** Land trade → food → seed → yield and harvest → rats (on the store before
  the harvest) → harvest added → newcomers computed → hunger and deposition → (next report) the hungry
  are gone, newcomers arrive, then plague halves the city.
- **End of term.** Two measures: the average yearly share of people who went hungry (in percent), and
  acres per person at the end (after the last year's newcomers and plague). Four bands, checked from
  worst to best: average hunger above 33 % or fewer than 7 acres each → the worst ending, which reuses
  the deposition text; above 10 % or fewer than 9 → the second; above 3 % or fewer than 10 → the third;
  otherwise the best.

## Quirks and bugs

- **The generosity paradox (the averaging bug).** The running average of hunger is updated with a
  formula that assumes every earlier year was counted:
  new average = ((year − 1) × old average + this year's percent) ÷ year. But a year in which more
  people are fed than live in the city jumps past that update entirely. The skipped year therefore
  silently takes the running average as it stood, so earlier bad years count again. Feeding exactly
  enough (fed equal to the people) is counted as a 0 % year; feeding even one ration more is skipped.
  Example: 30 % hungry in year 1, then nine generous years → the term's average stays 30 % (the worst
  band but one). The same city fed exactly in years 2–10 averages 3 % (the best band if the land
  holds). **Fixed** in the normal rules (every year counts); **kept** in the 1978 Ledger, where it is a
  Codex entry and a milestone.
- **Odd acres plant free.** Seed is half the acres rounded down, so the last half bushel of an odd
  number of acres is never charged. Kept: it is harmless and part of the arithmetic.
- **The worker limit is strict.** People can tend strictly fewer than ten acres each: 100 people can
  sow 999 acres, not 1,000. Kept; the interface shows the exact limit.
- **One variable, many jobs.** A single variable holds, in turn, the land price draw, a scratch value
  after trades, the three five-sided rolls and the number fed; another holds the answers to the buy,
  sell and food questions and then the plague flag; a third holds both the acres planted and the
  people who went hungry. The program's order of operations is what keeps these from colliding.
- **Lines that do nothing.** After a purchase or a sale, and after feeding, a scratch variable is set
  to a constant that is overwritten before it is ever read.
- **"Ten acres per person" is printed, not computed.** The end-of-term summary always says the city
  started with ten acres per person. True for the standard start (1,000 ÷ 100), but it is a constant.
- **The price variable is reused for the yield**, so last year's yield is overwritten by this year's
  price before the land question, and the yield shown in a report is the one just rolled.

## Simulations

Seeds 1…_N_, one run per seed, every step on the game's own derived stream (`simulateRun` in
`src/engine/simulate.ts`). Bots are defined in `src/engine/bots.ts`. Locked by
`tests/balance.test.ts` with the tolerances given there.

### Classic Term, 2,000 runs each

| Bot     | Top tier (verdict 4–5) | Deposed | Notes                                                  |
| ------- | ---------------------- | ------- | ------------------------------------------------------ |
| careful | 38.9 %                 | 0.0 %   | target 25–45 % top, < 2 % deposed: met                 |
| naive   | 31.2 %                 | 40.8 %  | target < 10 % deposed: not met (see Balance decisions) |
| greedy  | 0.0 %                  | 94.3 %  | every spare bushel into land, half-fed people          |
| random  | 0.0 %                  | 99.9 %  | a floor: random decisions within the rules             |
| plain   | 22.9 %                 | 65.9 %  | accepts the drafted decree every year (not a bot test) |

"Plain" is the player who only presses Enter: the tablet's draft feeds everyone and sows all the seed
allows, keeping nothing back on purpose. Two runs in three end with the council, so the default decree
is a starting point, never a strategy. Measured with `e2e/balance-report.ts`; the Playwright suite
uses seeds from `e2e/seed-search.ts` where this player's ending is known.

### Scenarios, careful bot, 2,000 runs each

| Scenario         | Top tier | Deposed | Completed | Target                 |
| ---------------- | -------- | ------- | --------- | ---------------------- |
| Dry Decade       | 20.6 %   | 0.0 %   | 100 %     | top ≥ 10 %: met        |
| Crowded Gate     | 12.0 %   | 0.0 %   | 100 %     | top ≥ 10 %: met        |
| Year of Rats     | 37.4 %   | 0.0 %   | 100 %     | top ≥ 10 %: met        |
| Land Fever       | 40.3 %   | 0.0 %   | 100 %     | top ≥ 10 %: met        |
| Thin Inheritance | 41.1 %   | 0.0 %   | 100 %     | top ≥ 10 %: met        |
| Generous Delta   | 86.8 %   | 0.0 %   | 100 %     | top ≥ 10 %: met        |
| Dynasty          | 42.0 %   | 0.0 %   | 100 %     | all three terms ≥ 70 % |
| 1978 Ledger      | 38.9 %   | 0.0 %   | 100 %     | —                      |

The careful bot never feeds more than everyone, so in the 1978 Ledger it never trips the averaging
bug and scores exactly as in Classic.

### What a careful steward does

The first careful bot fed everyone first and sowed with what was left. After one bad harvest it had
no seed, sold land to feed the city, and spiralled: in Dynasty it was deposed in 76 % of runs. Sowing
first (an acre returns about six times its seed) and selling first the acres nobody will sow ended
deposition entirely. With no reserve at all the bot then reached the top tier in 52–56 % of Classic
runs, above the 25–45 % target, and buying less land hardly changed that: fevers that halve the city
raise acres per head by themselves. A reserve of a quarter-year's ration, which is what a prudent
person keeps, brought it to 38.9 %. In this model a reserve is exactly what the rats eat, which is a
lesson the Codex entry on rats states plainly.

## Balance decisions

| Decision                    | Before                  | After                         | Evidence                                    |
| --------------------------- | ----------------------- | ----------------------------- | ------------------------------------------- |
| Classic model               | the original            | unchanged                     | §3.1: the balance is part of the classic    |
| Crowded Gate start          | 300 people, 2,800 grain | 150 people, 3,000 grain       | 300 people: 3.5 % top; 150: 12.0 %          |
| Year of Rats                | —                       | rats on faces 2, 3, 4 (½ ⅓ ¼) | "three in five" with the original's divisor |
| Naive-bot deposition target | < 10 %                  | 40.8 % measured, kept as is   | only reachable by changing the classic      |
| Careful bot's reserve       | none                    | 5 bushels a head              | 52 % → 38.9 % top tier                      |

The naive target cannot be met honestly: a player who sows every acre and never keeps or sells
anything is deposed by the first yield of 1 or 2 that follows a lean year, and in the original that
happens in two runs out of five. Changing it would mean changing the classic's numbers, which §3.1
rules out. The measured rate is locked as a regression test instead.
