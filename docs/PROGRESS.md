# Progress

One row per prompt and one per simulation. Each session edits only its own row, once, at the end of
its prompt. This file is excluded from Prettier so parallel sessions never reformat each other's rows.

## Foundation

| Prompt | What | Status | Date |
|---|---|---|---|
| 00 | Repo and tooling, `packages/kit` (turn engine, forecasts, events, runs, seats, charts, Legacy books, daily and streak, chronicle, demo, audio, settings), the contract, Legacy, the Hall with Almanac / Situation Room / Terrarium in light and dark, intro, picker, Library, Codex, Legacy, About, share card, Pond fixture, guardrails and provenance scan, docs, ADRs 0001–0007, CI and Pages workflows; 250 unit tests, 39 end-to-end tests | Done, awaiting owner review (not committed) | 2026-10-09 |

## Simulations

| Simulation | Inspired by | Prompt | Status | Notes |
|---|---|---|---|---|
| Ten Harvests | the 1968 grain-and-land simulation | 01 | Playable, approved by the owner — 2026-10-10 | three.js city diorama with the year's cinematic, granary bar, Honest Ledger, carved stele; Classic, daily, 6 scenarios, Dynasty, 1978 Ledger on a teletype; 71 unit tests, 19 end-to-end tests (port 5480) plus screenshots and fps (SHOTS=1); kit: results hand-over (ADR-0008); registry entry points at the built manifest; ports 4480/5480 |
| Crown of Florins *(provisional)* | the 1978 city-state simulation | — | Not started | Placeholder manifest in `hall/src/data/coming-soon.ts`; 1–6 players hot-seat |
