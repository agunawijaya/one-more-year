# Crown of Florins — changes from the original

What we kept, changed, added and removed compared with the 1978 city-state simulation, as its IBM
PC BASIC conversion behaves (verified line by line in NOTES.md). The original's behaviour is
described in our own words; none of its text, names or tables is reused.

## Kept

| What                                                                                                                                                                         | Why it stays                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| The start: 2,000 serfs, 25 soldiers, 25 merchants, 5 clergy, 4 nobles, 10,000 hectares, 5,000 bushels, 1,000 florins, taxes 25 / 10 / 5, justice 2                           | Every realm begins alike, as in 1978.                            |
| Weather in five grades from two dice, and its 3 / 7 / 10 / 7 / 3 spread                                                                                                      | It is the year's luck, and the converter's intent.               |
| Rats eating 1–50 % of the reserves every year                                                                                                                                | A full granary always loses something; it shapes the bread step. |
| The grain price from weather and scarcity                                                                                                                                    | It works once the harvest exists.                                |
| Release bounds of a fifth to four fifths of the reserves                                                                                                                     | It forces a reserve and caps generosity.                         |
| Births, deaths, newcomers, merchants drifting in under low taxes, hunger and its toll                                                                                        | The people's arithmetic is the heart of the game.                |
| Taxes sharing one willingness to pay; justice income scaled by title; the sales tax shrinking under harsh courts                                                             | The tangle that makes taxes interesting.                         |
| Purchases, their prices and their effects                                                                                                                                    | The city you build is the same city.                             |
| Interest of half the debt a year; bankruptcy below −10,000 × title and what it takes                                                                                         | The creditors are the game's floor.                              |
| The border: one soldier per 1,000 hectares, the 2.4 times rival test (fixed, below), the invader's claim, mercenaries' 1,001–10,000, the walls' 5,000, losses never below 15 | Invasion is a rule you can see coming.                           |
| Twelve pillars capped at ten; points ÷ (difficulty + 5) − justice + 1; titles never fall                                                                                     | The title formula is the race.                                   |
| Lifetimes fixed at the start, old age named only late, the deathbed step                                                                                                     | The hidden candle is the original's best idea.                   |
| Bankruptcy setting land to exactly 6,000 even for a smaller realm                                                                                                            | A harmless quirk; it gives a ruined small realm a little land.   |

## Changed

| Original behaviour                                                                     | Now                                                                                                                                                               | Why                                                                                            |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| The people's year uses last year's tax rates; this year's are set afterwards           | The plan's rates apply to the whole year                                                                                                                          | The preview and the year must agree; a player sets the rates for this year.                    |
| The first player to reach the top title ends the game for everyone (7190, 7600, 11000) | A player's crown ends the game; a rival's crown wins the race, is announced to the whole table, and the players may play on for a crown of their own or end there | Prompt 02 §3.7: others may keep playing for their own chronicle. NOTES, "The end of the race". |
| Seat 1 always acts first                                                               | The order rotates every year                                                                                                                                      | No seat should always go first (measured: within 1.7 points).                                  |
| A sex question decides the title names, and accepts lower case only                    | Each ruler has a chosen form of address (Cavaliere or Dama … Re or Regina)                                                                                        | A choice of title form, not a question about the player.                                       |
| A named outsider invades when no rival can                                             | An anonymous band of mercenaries                                                                                                                                  | No named characters from the original.                                                         |
| Every ruler and town from the original's lists                                         | 24 towns, given names and five rivals of our own                                                                                                                  | Provenance: nothing of the original's lists is reused.                                         |
| A typed question-and-answer turn                                                       | Five steps on one screen, with the fresco and precise controls bound to the same plan                                                                             | The rules are the same; the interface is new.                                                  |

## Added

| What                                                                                   | Why                                                              |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| The designed harvest, demand and land price (see NOTES.md and ADR 0002)                | The conversion lost them; without them the economy does not run. |
| Heirs and Dynasty (the default); Classic fate as an option                             | The owner's choice: a line, not a single life.                   |
| The end of a line: no heir for a Cavaliere or Dama who dies in debt                    | Ruin can end a dynasty.                                          |
| AI rivals with five personalities, sharper at higher difficulty                        | The race needs rivals when there are no other players.           |
| The glass box: the road to the title, the border watch, debt, lifetime odds, forecasts | Every rule on the table.                                         |
| Scenarios, the daily valley, Endless Dynasty                                           | Replayable worlds and long reigns.                               |
| The fresco, the season passing, the valley, the obituary page, the coronation's gold   | The game is a painting that lives.                               |
| Chronicle, epithets, milestones, the Codex, share strings, replays with a ghost        | The collection's Legacy.                                         |
| A year limit (1500, or 1460 in Year of Fevers) outside Endless Dynasty                 | With heirs a game could otherwise run for ever.                  |

## Removed

| What                                                                  | Why                                                       |
| --------------------------------------------------------------------- | --------------------------------------------------------- |
| A growth factor computed from the release and taxes, then overwritten | It never reached the game; nothing tells what it was for. |
| A second land test always implied by the first                        | It changes nothing.                                       |
| The plough team on the map                                            | The fresco shows the fields worked instead.               |
| Out-of-range answers silently replaced (a bad sales tax becomes 5 %)  | The controls cannot leave their ranges.                   |

## Bugs in the original

| Bug (verified in NOTES.md)                                                                                | Fixed or kept       | Why                                                                          |
| --------------------------------------------------------------------------------------------------------- | ------------------- | ---------------------------------------------------------------------------- |
| The difficulty is stored in a variable the title review never reads: every game runs at the easiest level | Fixed               | Four levels that work, and a Codex card about the difficulty that never was. |
| Harvest and demand are never computed; the harvest never reaches the reserves                             | Fixed (designed)    | The economy needs them.                                                      |
| Scarcity divides zero by zero and is always held at 2                                                     | Fixed by the above  | Grain is priced by the real shortage.                                        |
| The land price is never set: land is free                                                                 | Fixed (designed)    | Land must cost something, more in a dear year.                               |
| With demand at zero nobody ever goes hungry                                                               | Fixed by the above  | Bread matters again.                                                         |
| The newcomers test compares the wealth tax with demand                                                    | Fixed               | It uses the grain released, as intended.                                     |
| The hunger death roll ignores its own cap                                                                 | Fixed               | The cap applies.                                                             |
| The rival test is inverted: in any game of two or more everyone is invaded every year                     | Fixed               | A rival with more than 2.4 times your soldiers is the threat.                |
| A comment swallows the palace's nobles                                                                    | Fixed               | Palace pieces bring 1–2 nobles.                                              |
| A comment swallows the guard tower's base                                                                 | Fixed in the fresco | The tower stands on its base.                                                |
| A deathbed step to the top title skips the win and the new title's name                                   | Fixed               | It crowns.                                                                   |
| Battle losses capped at soldiers − 15 become a gain below 15                                              | Fixed               | No loss below the garrison, never a gain.                                    |
| Bankruptcy sets land to 6,000 even when the realm had less                                                | Kept                | Harmless, and it reads as the creditors' mercy.                              |
