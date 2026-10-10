# Ten Harvests — changes from the original

What we kept, changed, added and removed compared with the 1978 BASIC listing, and why. The original's
behaviour is described in our own words; the verified details are in [NOTES.md](NOTES.md).

## Kept

| What                                                                                            | Why it stays                                                              |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| The start: 100 people, 1,000 acres, 2,800 bushels, last harvest 3 an acre, rats ate 200         | it is the classic opening, and every number in it follows from the others |
| Land at 17–26 bushels an acre, a new price each year                                            | the land market is half the game                                          |
| Buy, or (only if buying nothing) sell; the city always keeps one acre                           | one land decision a year keeps the decree simple                          |
| 20 bushels a head; half a bushel of seed an acre, odd acres free; fewer than ten acres a person | these three limits are the puzzle                                         |
| Yield 1–5 an acre, uniform                                                                      | the river's verdict, unchanged                                            |
| Rats two years in five, eating a half or a quarter of what is kept, before the harvest comes in | the reason not to hoard                                                   |
| Newcomers: a die from 1 to 5 times (20 × acres + store), over people, over 100, plus 1          | a prosperous city draws people, which lowers acres per head               |
| Deposed at once when more than 45 % go hungry in one year                                       | the hard floor under every decision                                       |
| Fever one year in five (20 %), halving the city                                                 | what the arithmetic does, which is what players actually met              |
| The order of the year: land, food, seed, harvest, rats, newcomers, hunger, fever                | the order decides what the rats see and who is counted                    |
| End-of-term judgement on average hunger and acres per head, with the original's bands           | the original's measure of a good ruler                                    |
| All of the above in the 1978 Ledger, plus the averaging quirk and the walk-out                  | a faithful mode for anyone who wants the old game exactly                 |

## Changed

| Original behaviour                                                                  | Now                                                                                                                                | Why                                                                                                             |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Four questions asked one at a time; an impossible answer is scolded and asked again | one decree on a tablet, all three parts visible and adjustable before the year ends; impossible decrees cannot be sent and say why | you can see the trade-off instead of guessing it; the old way stays in the scribe's console and the 1978 Ledger |
| Luck is a black box                                                                 | the Honest Ledger states exact odds for harvest, rats and fever and the full range of newcomers                                    | the model is simple enough to show honestly                                                                     |
| A negative answer ends the game at once                                             | refused in the normal game; in the 1978 Ledger the steward walks out, as before                                                    | a typo should not end a reign; the quirk is kept where it belongs                                               |
| Years numbered one ahead (the decisions after "year 1" are reported as year 2)      | Year 1 is the year of your first decree                                                                                            | a year should mean the same thing on the tablet, the report and the stele                                       |
| The plague                                                                          | the fever, at the same rate with the same effect                                                                                   | all-ages wording; nothing about the model changes                                                               |
| The worst end-of-term band reuses the deposition text                               | five verdicts of its own, from Ten Quiet Years to Sent Back to the Fields; deposition has its own                                  | each ending should say what actually happened                                                                   |
| The best band covers any term with little hunger                                    | a term with nobody hungry at all, and land to spare, is set apart as Ten Quiet Years                                               | the original could not tell a perfect term from a very good one                                                 |
| The averaging of hunger skips generous years (see below)                            | every year counts in the normal game                                                                                               | being generous should never score worse than being exact                                                        |

## Added

| What                                                                                             | Why                                                              |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| The city on the river, drawn in three.js, where parcels, windows and the granary are the numbers | to read the state at a glance, and to make each harvest an event |
| The year's cinematic: flood, sowing, growth, harvest, rats, newcomers, fever                     | the year happens in front of you instead of in a line of text    |
| The granary bar, the field edge and field painting                                               | three ways to make the same decision, by hand                    |
| The scribe's report, its headline and its "last time" line on a replay                           | a readable account of the year, in order                         |
| The stele, carved one register per year, downloadable as SVG                                     | an ending you can keep                                           |
| Scenarios, today's world, Dynasty                                                                | reasons to play again that change one thing at a time            |
| The chronicle, epithets, milestones and the Codex                                                | the collection's way of remembering a run and what you learned   |
| The scribe's advice and a five-step tour for the first term                                      | help that explains the model rather than nagging                 |

## Removed

| What                                                                         | Why                                                                   |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| The scolding when an answer is impossible, and the closing appraisals        | our own words replace them; none of the original's text is used       |
| The end-of-term line that always says the city started with ten acres a head | it is a constant, not a measurement; the stele shows the real numbers |

## Bugs in the original

| Bug (verified in NOTES.md)                                                                                                          | Fixed or kept                                     | Why                                                                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| A year in which more people are fed than live in the city is skipped by the running average of hunger, so earlier years count again | fixed in the normal game; kept in the 1978 Ledger | in the normal game generosity must not be punished; in the Ledger it is a discovery, with a Codex entry and a secret milestone |
| The listing's comment promises a 15 % plague; the arithmetic gives 20 %                                                             | the arithmetic is kept, the ledger says 1 in 5    | players always met 20 %; the honest ledger states it                                                                           |
| Odd acres are sown without seed                                                                                                     | kept                                              | harmless, and part of the arithmetic the limits show                                                                           |
| The worker limit is strictly fewer than ten acres a person                                                                          | kept                                              | the tablet shows the exact limit (999 for 100 people)                                                                          |
