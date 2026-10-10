# AGENTS.md — rules for AI coding agents

These rules bind every AI coding agent working in this repository. `CLAUDE.md` says the same things
for Claude Code; if the two ever disagree, this file wins and the disagreement is a bug to report.

One More Year is a public, open-source collection of modern web **simulations** reborn from the
turn-based simulations of the BASIC era. You run a small world one turn at a time, read what
happened, decide and press on for "just one more year". There are no arcade games here and there
never will be: no reflex tests, no high-score chases, no timers that punish slow thinking.

## How work arrives

The architect writes one prompt per task in `prompts/` (see `prompts/README.md` for order and
status). Run the prompt you were given, completely, in its stages. Read first: this file,
`CLAUDE.md`, `.claude/skills/retro-reborn-builder/SKILL.md`, `docs/ARCHITECTURE.md`, the ADRs in
`docs/adr/` and the kit's public API (`packages/kit/src/index.ts`). Your first reply summarises the
hard rules in five lines, names the prompt, says who owns `packages/kit` in this wave and states
your ports.

## Hard rules

1. **Provenance.** The originals are commercial or of unclear licence. Never copy their source,
   screen text, messages, appraisals, name lists, place-name lists or numbers tables; reimplement
   rules from behaviour, in fresh code and fresh words. The reference listings live outside the repo
   at `E:\Projects\simulation\src` and are read-only. Run `pnpm provenance <that folder>` before
   you finish.
2. **Titles.** Our own titles only. Original titles appear only as `inspiredBy.originalTitle` and in
   `CREDITS.md` and the About page. No trademarks, real brands or real living people in titles or
   UI.
3. **Zero raster.** Everything is drawn in code (SVG, Canvas 2D, WebGL). Fonts are self-hosted, OFL
   or Apache. No runtime network requests, no analytics. Raster files exist only as screenshots in
   `docs/media/`.
4. **Web first and accessible.** Desktop, keyboard and mouse; full keyboard play; visible focus via
   `:focus-visible`; reduced motion (setting and `prefers-reduced-motion`); AA contrast; tabular
   figures for numbers; every chart has a text alternative.
5. **Humanized code.** Clear names, small functions, comments that explain why, module header
   comments that say what a module is for. No filler, no commented-out code, no AI-sounding prose in
   comments or docs.
6. **Honest models.** Every engine is pure TypeScript, seeded and deterministic. Numbers shown to the
   player are the numbers the engine uses. Odds and forecasts on screen are never fudged.
7. **Stay in your folder.** Touch only the folders your prompt names. Shared files (Hall registry
   placeholder, README via `pnpm docs:sims`, your row in `docs/PROGRESS.md`) only at the very end,
   re-reading each first and changing only your own part.
8. **Never commit or push.** The owner reviews and commits.
9. **Docs in Markdown; diagrams in Mermaid only.**
10. **Light and dark everywhere**, both designed, never a recolour; react to appearance changes live.
11. **No pressure, no gambling.** Nothing purchasable, no loot boxes, no streak punishment, no
    notifications, no countdowns on decisions; all-ages copy.
12. **Navigation standard** (ADR-0005), described below.

## Folders

| Folder                      | What lives there                                             | Who changes it                                                             |
| --------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `packages/kit/`             | The shared runtime                                           | Only the session the prompt names as kit owner; others list kit candidates |
| `hall/`                     | The website: data layer, chrome, routes, themes              | Hall prompts; simulation prompts only replace their placeholder at the end |
| `games/<id>/`               | One simulation: `manifest.ts`, `src/`, `tests/`, `docs/`     | That simulation's session                                                  |
| `hall/tests/fixtures/pond/` | The test-only Pond simulation                                | Hall prompts; read it as the reference integration, never import it        |
| `docs/`                     | ARCHITECTURE, ADRs, templates, media, PROGRESS               | As the prompt says                                                         |
| `scripts/`                  | Guardrails, provenance scan, docs generator, screenshot tool | Hall prompts                                                               |

## The contract

A simulation is `games/<id>/manifest.ts` (a `SimManifest`, plain data) and `games/<id>/src/index.ts`
(a default-exported `SimModule`, loaded lazily). See ADR-0002 and `packages/kit/src/contract.ts`.

- The manifest declares 2–4 **signals**, scenarios, accent colours (AA on every theme), an emblem
  (24×24 path data) and `inspiredBy`.
- The module supplies `howToPlay`, `milestones`, `codex`, `saves`, optional `ambience`,
  `mount(host, ctx)` and `demo(host, seed, look)`.
- Use `startPlay(ctx, rules, launch)` for the run lifecycle rather than wiring runs, autosave,
  reports and chronicles by hand.
- Report every resolved turn (`reportTurn`) and the end of every run (`reportRun`, with
  `presentation: 'game'` if you show your own end screen first).
- Never draw your own pause menu or exits: supply `setPauseItems` and call `setView`.
- Style only inside your own root class; never restyle the Hall.

## Determinism obligations

- The engine is a pure `TurnModel`: no clock, no DOM, no `Math.random`, no argument mutation; State
  and Plan survive JSON.
- Use the step stream you are given (`rngForStep(seed, step)`) and `fork(label)` one stream per
  subsystem, so adding a draw in one subsystem never reshuffles another.
- No transcendental maths on random draws where browsers might differ; the kit's `normal()` is safe.
- Required tests: a full run replayed with `replayPlans` reproduces every signal exactly; forecasts
  are stable for a given world and step; balance targets are locked with tolerances from seeded bot
  runs (node or iteration budgets, never wall-clock time).

## Navigation standard

- Two destinations with fixed names: **Game menu** and **Back to the Hall**.
- Game menu: "← Back to the Hall" top-left; Escape returns to the Hall.
- During play: the Hall's Pause button with its "Esc" hint.
- Pause menu: Resume · your items · How to play · Settings · Game menu · Back to the Hall.
- Results (the chronicle page): Play again (R) · Replay this world · Game menu · Back to the Hall (H).
- Leaving asks only when the plan has unsaved edits, and offers to keep it as a draft.
- Browser Back works; a reload resumes the run on its plan screen.

## Ports and processes

Hall dev 4479, Playwright preview 5479. Simulation sessions use the ports in their prompts (Ten
Harvests: 4480/5480). Never use 4183/5183 or 4283/5283 (sibling collections). Never stop a process
you did not start. Do not run repo-wide e2e or screenshot jobs while other sessions run; use a
game-scoped Playwright config.

## Before you finish

Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm check`, `pnpm build`, your Playwright suite and
`pnpm provenance E:\Projects\simulation\src`. Update `docs/PROGRESS.md` **once**, at the end, on
your own row. Then reply with what you built, deviations and why, known gaps, kit changes or
candidates, and the exact commands to run it.
