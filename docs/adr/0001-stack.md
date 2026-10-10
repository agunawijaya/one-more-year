# ADR-0001: Stack, layout and ports

- Status: accepted
- Date: 2026-10-09

## Context

One More Year is a static website: a Hall (the catalog) and, later, one folder per simulation. It
must run offline after the first visit, make no requests to other origins, load each simulation only
when it is opened, and be easy for several building sessions to work on side by side. Simulations
are turn-based, so there is no frame-rate-critical loop in the shared code; the heavy rendering, if
any, belongs to individual simulations.

## Decision

| Concern              | Choice                                                                               |
| -------------------- | ------------------------------------------------------------------------------------ |
| Workspace            | pnpm workspaces: `hall`, `packages/*`, `games/*`                                     |
| Language             | TypeScript, strict, with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` |
| Build and dev server | Vite; the Hall is the only site entry; simulations are lazy chunks of it             |
| Unit tests           | Vitest with happy-dom where a test needs the DOM                                     |
| Browser tests        | Playwright (Chromium), accessibility checks with axe                                 |
| Lint and format      | ESLint (typescript-eslint, type-aware rules) and Prettier                            |
| UI                   | Framework-free TypeScript, DOM, SVG and CSS in the Hall and the kit                  |
| Charts               | SVG, drawn by the kit (`charts.ts`)                                                  |
| Fonts                | Self-hosted variable fonts from `@fontsource-variable` (OFL)                         |
| Offline              | A service worker emitted at build time that precaches every built file               |
| Routing              | Hash routes, so GitHub Pages needs no rewrite rules                                  |

```
web/
├── hall/            # the website: src/app, src/data, src/chrome, src/routes, src/themes
├── packages/kit/    # the shared runtime every simulation uses
├── games/<id>/      # one folder per simulation (manifest.ts, src/index.ts, docs/)
├── docs/            # ARCHITECTURE, adr/, templates/, media/, PROGRESS.md
├── scripts/         # check (guardrails), provenance scan, docs:sims, shoot
└── prompts/         # the architect's prompts, one per session
```

Routes: `#/` (Hall, `#/?sim=<id>` focuses a world), `#/sim/<id>` (game menu), `#/play/<id>` with
`?run=<runId>`, `?new=<scenario>&seats=<n>`, `?daily` or `?replay=<chronicleId>`, `#/chronicles`,
`#/chronicles/<id>`, `#/codex` (optionally `?sim=<id>`), `#/legacy`, `#/about`.

Vite's `base` comes from `BASE_PATH`, so the same build serves from `/` locally and from
`/one-more-year/` on GitHub Pages.

**Ports.** Hall dev server **4479**, Playwright preview **5479**. Byte Sized '83 uses 4183/5183 and
Boss Key '83 uses 4283/5283 on the same machine. Simulation sessions get their own pairs in their
prompts (Ten Harvests: 4480/5480).

**No UI library.** The Hall's screens are a few dozen small components that redraw from one
snapshot (ADR-0004). A small `h()` helper in `hall/src/app/dom.ts` covers what a library would give
us, without a runtime dependency, a virtual DOM or a build plugin. A simulation may choose otherwise
for its own screens in its own ADR.

## Alternatives considered

- **A UI framework (Preact, Svelte, Lit).** Rejected for the Hall: the gain is small at this size,
  and every simulation session would have to learn and keep up with it.
- **Path routes.** Rejected: GitHub Pages cannot rewrite unknown paths to `index.html` without a
  404 trick, and hash routes keep browser Back working with no server.
- **A service-worker library (Workbox).** Rejected: the site is a fixed set of hashed files, so a
  forty-line worker that precaches the build list is enough and easy to read.

## Consequences

- A simulation is one folder; the Hall finds it with `import.meta.glob` at build time.
- Every simulation chooses its own rendering technology (SVG, Canvas 2D, WebGL, three.js loaded
  lazily) and records the choice in its own ADR.
- Tests that need a real simulation use the test-only Pond fixture through `hall/harness.html`,
  which the dev server serves and the build never includes.
