# Crown of Florins ADR-0002: Rebuilding the economy the conversion lost

- Status: accepted
- Date: 2026-10-13

## Context

The 1978 city-state game survives for us as an IBM PC BASIC conversion that is incomplete: the
harvest and the people's demand are never computed, the land price is never set, the harvest never
reaches the granary, the chosen difficulty is never used, and several lines were swallowed by
comments (NOTES.md lists each with its line numbers). Played as it stands, every year prices grain
as if scarce, land is free, everyone is always fed, newcomers flood in, and every player is invaded
every year. The owner chose reconstruction: keep every working formula and its constants, design the
lost pieces, tune them with bots, and document every designed formula as ours. Other ports of the
game were not to be consulted.

## Decision

- **Keep** every rule the listing shows working, with its constants: the start, weather, rats, the
  grain price, release bounds, births and deaths, newcomers, fleeing serfs, taxes and justice,
  purchases and their effects, interest, bankruptcy, invasion, the twelve pillars and the title
  formula, lifetimes and the deathbed step (`src/engine/rules.ts`, each marked _original_).
- **Design** the lost pieces as named functions (`src/engine/economy.ts`, constants marked
  _designed_): the harvest from worked land, weather and a tenth of variance; demand from rations
  per class; a land price from a yearly base and the same scarcity as grain; the harvest stored at
  the opening of the year.
- **Fix** the bugs whose intent is clear (difficulty applied, the rival test the right way round,
  palace nobles restored, immigration on the grain released, the hunger cap applied, losses never a
  gain, a deathbed step to the top title crowns), and **keep** the harmless quirks (bankruptcy sets
  land to 6,000 even for a smaller realm).
- **Add** what the owner's design needs and the original never had: heirs (Dynasty), AI rivals
  with personalities, rotating turn order, scenarios.
- **Lock** the balance with seeded bot runs: targets from the prompt, numbers in NOTES.md, the same
  checks with tolerances in the test suite.

## Consequences

- Every number on screen is a number the engine uses; the glass box and the forecasts call the same
  functions as the year.
- The designed formulas are ours, not the original's; ABOUT.md, HOW-TO-PLAY.md and
  CHANGES-FROM-ORIGINAL.md say so.
- Retuning means changing the designed constants in `rules.ts` and running
  `e2e/balance-report.ts`; the tests fail if a target is missed.
- The harsh-justice income is kept from 1978 and turns out to be strong; it is the price the
  original set, shown honestly, and the title penalty balances it.
