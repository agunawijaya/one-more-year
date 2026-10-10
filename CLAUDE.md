# CLAUDE.md — One More Year

One More Year is a public, open-source collection of modern web **simulations** reborn from the classic
turn-based simulations of the BASIC era (Hamurabi, Santa Paravia and the programs that will follow them).
Every title is redesigned for today's players: you run a small world one turn at a time, read what happened,
decide, and press on for "just one more year". There are no arcade games in this collection and there never
will be: no reflex tests, no high-score chases, no timers that punish slow thinking. Not an emulator, not a port.

## Before any work

Read `.claude/skills/retro-reborn-builder/SKILL.md` and follow it. Tasks arrive as prompts in `prompts/`
(see `prompts/README.md`). Full agent rules live in `AGENTS.md`; if they disagree, AGENTS.md wins.

## Hard rules

1. Provenance: the originals are commercial or of unclear licence. Never copy their source, screen text,
   messages, ruler appraisals, name lists, place-name lists or tables — reimplement rules from behaviour, in
   fresh code and fresh words. Originals live outside the repo at `E:\Projects\simulation\src` and are
   read-only.
2. Our own titles only; original titles appear only as `inspiredBy.originalTitle` and in CREDITS/About.
   No trademarks, real brands or real living people in titles or UI.
3. Visual asset policy: zero raster. Everything is drawn in code (SVG, Canvas 2D, WebGL). Fonts are
   self-hosted, OFL or Apache. No runtime network requests, no analytics.
4. Web first: desktop, keyboard + mouse; accessible (keyboard, visible focus via `:focus-visible`, reduced
   motion, AA contrast, readable numbers with tabular figures).
5. Humanized code: clear names, small functions, comments that explain why, no filler, no commented-out code,
   no AI-sounding prose in comments or docs.
6. Simulations are honest models: every engine is pure TypeScript, seeded and deterministic; numbers shown to
   the player are the numbers the engine uses; odds and forecasts on screen are never fudged.
7. Stay inside the folders your prompt names; shared files only at the very end; PROGRESS.md once.
8. No commits, no pushes.
9. Docs in Markdown; diagrams in Mermaid only.
10. Light and dark appearance everywhere, both designed, never a recolour.
11. No gambling mechanics, nothing purchasable, no loot boxes, no streak punishment; all-ages copy.
12. Navigation standard: "Game menu" and "Back to the Hall" everywhere, same pause and results order
    (see `docs/adr/` once written).

## Working here

- Ports: Hall dev server 4479, Playwright preview 5479; simulation sessions use the ports in their prompts.
  Never use 4183/5183 or 4283/5283 (sibling collections on the same machine), and never stop a process you
  did not start.
- The contract, the turn engine and Legacy are described in `docs/adr/` (0002, 0006, 0003); the test-only
  Pond fixture in `hall/tests/fixtures/pond/` is the reference integration. Read it; never import it.
- Before finishing: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm check`, your Playwright
  suite, `pnpm provenance E:\Projects\simulation\src`, then `pnpm docs:sims` if the catalog changed.
