# ADR-0007: Storage, offline play and privacy

- Status: accepted
- Date: 2026-10-09

## Context

There is no server. Everything a player has (runs in progress, chronicles, codex, milestones,
streak, settings) lives in their browser. Some browsers refuse storage (private windows), some run
out of it, and simulations will change their save formats over time. The site must also work with
the network switched off once it has loaded, and must never send anything anywhere.

## Decision

- **One prefix, small keys.** Every key starts with `omy:`. Runs are stored one per key
  (`omy:run:<simId>:<runId>`) so a large world never forces rewriting the others; chronicles are
  one per key (`omy:chronicle:<id>`); codex, milestones, daily results, stats, cosmetics and
  settings each have one key.
- **Envelopes and migrations.** `createSlot` stores `{v, d}` envelopes; a reader upgrades old
  versions step by step with the slot's migrations and rejects data it cannot parse instead of
  crashing. Runs carry the simulation's save version (`SimModule.saves`) and its migrations.
- **Degrade, don't fail.** `createStorage()` falls back to memory when storage is unavailable or
  full, and the Hall shows a quiet banner saying progress lasts until the tab closes.
- **Readable without code.** `listRunSummaries(store)` reads every simulation's runs without
  loading any simulation, so the Hall can show Continue cards at start-up.
- **Autosave.** After every resolved turn and when the page hides (`autosaveOnHide`).
- **Offline.** The build emits `sw.js`, which precaches every built file under a cache named from
  a hash of the file list, and removes older caches on activation. The Hall registers it only in
  production builds.
- **No network.** No analytics, no fonts or scripts from other origins, no telemetry. The only
  links to other origins are ordinary anchors the player clicks (sources in About, docs on GitHub).
  `pnpm check` fails if built code contains other URLs.
- **Forget my data** removes every `omy:` key after a confirm that lists what goes.
- **Share** copies text or downloads an SVG; nothing is uploaded.

## Consequences

- A player's history is per browser and per device; that is stated in About.
- Tests cover storage-full and private mode, migrations and the reload-resume path.
