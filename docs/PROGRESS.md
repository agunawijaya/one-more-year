# Progress

One row per prompt and one per simulation. Each session edits only its own row, once, at the end of
its prompt. This file is excluded from Prettier so parallel sessions never reformat each other's rows.

## Foundation

| Prompt | What | Status | Date |
|---|---|---|---|
| 00 | Repo and tooling, `packages/kit` (turn engine, forecasts, events, runs, seats, charts, Legacy books, daily and streak, chronicle, demo, audio, settings), the contract, Legacy, the Hall with Almanac / Situation Room / Terrarium in light and dark, intro, picker, Library, Codex, Legacy, About, share card, Pond fixture, guardrails and provenance scan, docs, ADRs 0001–0007, CI and Pages workflows; 250 unit tests, 39 end-to-end tests | Done, committed | 2026-10-09 |

## Simulations

| Simulation | Inspired by | Prompt | Status | Notes |
|---|---|---|---|---|
| Ten Harvests | the 1968 grain-and-land simulation | 01 | Playable, approved by the owner — 2026-10-10 | three.js city diorama with the year's cinematic, granary bar, Honest Ledger, carved stele; Classic, daily, 6 scenarios, Dynasty, 1978 Ledger on a teletype; 71 unit tests, 19 end-to-end tests (port 5480) plus screenshots and fps (SHOTS=1); kit: results hand-over (ADR-0008); registry entry points at the built manifest; ports 4480/5480 |
| Crown of Florins | the 1978 city-state simulation | 02, 02a | Playable, approved by the owner after play-test, committed — 2026-11-08 | three.js fresco of a generated city-state, five-step year worked on the fresco itself, harvest beat, heralds' scroll, the valley with marching armies, illuminated obituary, coronation in gold leaf; reconstructed economy (harvest, demand, land price) tuned on 2,000-game runs; 1–6 seats hot-seat, five AI personalities, four difficulties, Dynasty or Classic fate; Standard, daily, 5 scenarios, Endless Dynasty. 02a: fresco rebuilt (painted light, stroke pass, intonaco, pressure lines, pigment bleed), seeded cushion hills, painted sky with soft clouds and moon, gold leaf on architecture only with a travelling glint, the invasion as a signature moment (column by army size, garrison, clash, ribbon, dipping banner), moonlit valley night, vellum and painted miniatures; year screen fits above the rival bar at both sizes (tabs, scrolling bodies), one "Seal the year", title review by name, the treasury told one way, the race to the crown announced with play on / end here (NOTES "The end of the race"); 138 unit tests, 33 end-to-end tests (port 5481) plus critique shots and fps (SHOTS=1); kit: setup options travel with the run (ADR-0009); registry entry points at the built manifest; ports 4481/5481 |
