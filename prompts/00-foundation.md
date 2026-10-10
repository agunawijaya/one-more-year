# Prompt 00 — Foundation: repo, simulation kit, Legacy system, and the Hall ("the Almanac")

> Run this in Claude Code from `E:\Projects\simulation\web`.
> Recommended: Opus 5.5, effort **xhigh**. Expect a long session; work in the stages of §12.
> **Owner checkpoint:** stage 4 ends with Hall hero frames; STOP there and wait for the owner's
> approval before finishing the themes.
> No simulation is built here. Simulation prompts (01 onwards) are written after each design brief.

## 0. Read first

1. This whole prompt, top to bottom, before touching anything.
2. `CLAUDE.md` and `.claude/skills/retro-reborn-builder/SKILL.md`. Your first reply summarises the
   hard rules in five lines, names this prompt, says you own `packages/kit` (you are the only
   session), and states your ports (§3).
3. `prompts/README.md` (run order and conventions).
4. Reference material — READ-ONLY, OUTSIDE this repo (`E:\Projects\simulation\src`), never copy
   anything from it into the repo:
   - `hamurabi.bas` — the 1978 BASIC Computer Games listing of Hamurabi.
   - `santaparavia.bas` — an IBM PC BASIC conversion of Santa Paravia and Fiumaccio.
   Read both so you understand what kind of programs this collection is built for: turn-based, numeric,
   one decision screen per turn, a report at the start of each turn, a verdict at the end. That shape is
   what the kit and the Hall must serve. Write no text that reproduces their wording.
5. Sibling collections by the same owner exist at `E:\Projects\byte-sized-83` and
   `E:\Projects\boss-key-83`. You may read their `packages/kit`, contract, ADRs, navigation standard
   and doc templates to learn what worked, and re-implement ideas here. Do not import from them and do
   not copy their themes: this collection must look like itself, and it is the first one built for
   **simulations only**.

## 1. Goal

Create **One More Year** — a public, open-source collection of modern web simulations inspired by the
classic turn-based simulations of the BASIC era. The first two are Hamurabi (Doug Dyment's 1968 game
as published by David H. Ahl) and Santa Paravia and Fiumaccio (George Blank, 1978). More will follow:
the kit and the Hall must make adding a simulation a matter of one folder and one manifest.

The collection's promise, in one line for the README: *run a small world, one year at a time — and
see whether you can stop at just one more.*

There is **no arcade** here. That changes the foundation compared with the sibling collections:

| Arcade collections had | This collection has instead |
|---|---|
| A fixed-timestep game loop at 120 Hz | A **turn engine**: plan → commit → resolve → report, with deterministic replays |
| High-score tables with initials | **Chronicles**: every finished run becomes a readable history page |
| Reflex difficulty curves | **Scenarios** (curated starting worlds) and honest forecasts |
| Attract mode that shows motion | Attract mode that shows a **living model** plus the numbers it produces |
| Lives and timers | Autosave every turn, resume any time, multiple runs in progress |

This prompt builds everything except the simulations:

- monorepo scaffold, tooling, CI, GitHub Pages workflow
- `packages/kit` — the shared runtime for **turn-based simulations** (§5)
- the simulation contract (manifest + module) that games plug into (§4)
- the **Legacy** system — the collection's gamification (§6)
- `hall/` — the catalog, three switchable themes in light and dark (§7)
- documentation templates, repo docs, ADRs, credits

When you finish, the Hall runs, shows the two planned simulations as "coming soon", switches themes
and appearance live, and a test-only fake simulation proves the whole loop: begin → plan → end the
turn → report → pause → resume after reload → finish → chronicle → back to the Hall.

## 2. Hard rules

`CLAUDE.md` is binding. In addition, for this prompt:

1. **Provenance.** Nothing from the reference folder enters the repo: no strings, no report phrasing,
   no ruler appraisals, no title lists, no city names, no numbers tables. Both originals have famous
   lines; write our own.
2. **Titles.** The two simulation titles in §7.1 are provisional and ours. "Hamurabi" and
   "Santa Paravia and Fiumaccio" appear only as `inspiredBy.originalTitle` and in CREDITS/About.
3. **Zero raster.** All visuals from code. The favicon is an inline SVG.
4. **Humanized code** as in `CLAUDE.md`. Module header comments say what a module is for and why.
5. **Git:** `git init`, `.gitignore`, `.gitattributes`; **no commits, no pushes**.
6. **Offline.** No analytics, no external requests at runtime; service worker for offline play.
7. **Accessibility.** Whole Hall keyboard-navigable; visible focus via `:focus-visible`; reduced
   motion setting plus `prefers-reduced-motion`; AA contrast in all six theme × appearance variants;
   numbers use tabular figures; charts always have a text alternative (a table or a one-line summary).
8. **No gambling, no pressure.** Legacy (§6) rewards understanding and good stewardship, never
   compulsion: no purchasable anything, no loot boxes, no streak loss shaming, no countdown timers on
   decisions, no notifications.

## 3. Stack (record as ADR-0001)

- pnpm workspaces, TypeScript strict, Vite, Vitest, Playwright, ESLint, Prettier.
- Hall and kit: framework-free TypeScript + DOM/SVG/Canvas + CSS. If you find a strong reason for a
  tiny UI library in the Hall, justify it in the ADR; otherwise stay vanilla.
- Each simulation chooses its rendering tech in its own ADR (SVG, Canvas 2D, WebGL, three.js
  lazy-loaded). Charts in the kit are SVG.
- Hash routes: `#/`, `#/sim/<id>` (game menu), `#/play/<id>` (optionally `?run=<runId>`),
  `#/chronicles`, `#/chronicles/<chronicleId>`, `#/codex`, `#/legacy`, `#/about`.
- Simulations are code-split and loaded with dynamic `import()` only when opened.
- Vite `base` configurable for GitHub Pages (`/one-more-year/`).
- **Ports:** Hall dev server 4479, Playwright preview 5479. Byte Sized '83 uses 4183/5183 and
  Boss Key '83 uses 4283/5283 on the same machine; never use those. If 4479 or 5479 is taken, pick
  the next free pair and say so in your first reply.

```
web/
├── hall/
│   ├── src/data/        # registry, daily scenario, filters, legacy, chronicles, codex, runs in progress
│   ├── src/themes/      # almanac/, situation-room/, terrarium/
│   ├── src/chrome/      # top bar, settings, pause, results/chronicle page, share card, intro, picker
│   └── src/routes/
├── games/<id>/          # added by later prompts: src/engine, src/render, tests, docs
├── packages/kit/
├── docs/                # ARCHITECTURE, adr/, templates/, media/, PROGRESS.md
└── prompts/
```

## 4. The simulation contract (`packages/kit/src/contract.ts`, ADR-0002)

Design it carefully; every future simulation depends on it. Starting point, refine and justify:

```ts
type SimStatus = 'playable' | 'coming-soon';
type Domain = 'governance' | 'economy' | 'ecology' | 'society' | 'journey' | 'physics';
type TurnUnit = 'year' | 'season' | 'month' | 'week' | 'day';

interface SimManifest {
  id: string;                    // kebab-case: folder name and route
  title: string;                 // our title
  tagline: string;               // one line for the card
  teaser: string;                // 2–3 sentences: why play this today
  domain: Domain;
  turnUnit: TurnUnit;
  typicalTurns: [number, number];// e.g. [10, 10] or [20, 45]
  players: '1P' | '1–6P';        // 1–6P = hot-seat on one device, players take turns
  sessionMinutes: [number, number];
  status: SimStatus;
  accent: { light: string; dark: string };
  emblem: string;                // SVG path data, 24×24 viewBox, drawn by every theme
  inspiredBy: {
    originalTitle: string;
    uiTitle: string;             // generic on-screen description, e.g. "the 1968 grain-and-land simulation"
    year: number;
    credit: string;              // e.g. "Doug Dyment; BASIC version by David H. Ahl"
  };
  hasDailyScenario: boolean;
  scenarios: ScenarioSummary[];  // curated starting worlds (§6.4); may be empty while coming soon
  signals: SignalDef[];          // the 2–4 headline numbers this world produces (§4.1)
}

interface SimModule {
  manifest: SimManifest;
  milestones: MilestoneDef[];    // the achievements of this collection (§6.3)
  codex: CodexEntryDef[];        // phenomena the player can discover (§6.5)
  mount(host: HTMLElement, ctx: SimContext): SimInstance;
  demo(host: HTMLElement, seed: number, ctx: DemoContext): DemoHandle;
}

interface SimInstance {
  pause(reason: 'menu' | 'hidden'): void;
  resume(): void;
  gameMenu(): void;
  leaveCheck(): 'safe' | 'would-lose-progress'; // with autosave per turn this is almost always 'safe'
  dispose(): void;
}
```

### 4.1 Signals — the numbers a world produces

Every simulation declares 2–4 **signals** (e.g. population, grain in store, treasury, land), each with
an id, label, unit, number format and whether higher is better. The engine emits them every turn.
They feed: the Situation Room theme's live sparklines (from `demo`), the chronicle's charts, the
ghost overlay (§6.2), the share string and the Codex. `DemoHandle` exposes a subscribe method that
streams the demo world's signals, turn by turn, so a theme can draw them next to the demo.

### 4.2 Context

`SimContext` provides: seeded RNG; the turn engine helpers (§5); audio; settings (global +
per-simulation namespace) and the resolved appearance with change events; **run storage** (§5, saves
per run, several runs in progress per simulation); milestones; codex discovery; daily scenario seed
and number; the seats helper for hot-seat play; `reportTurn(summary)` after every resolved turn and
`reportRun(result)` at the end, with `presentation: 'hall' | 'game'` (the simulation may show its own
end screen but must still report); share; `setView('menu' | 'plan' | 'report' | 'results')`;
pause-menu items; `openSettings()`; `forgetData()`.

`demo()` is cheap, silent, plays the simulation by itself with a built-in bot at a calm pace (about
one turn every 2–3 seconds), loops forever with a fresh world each cycle, draws in the given
appearance, pauses off-screen (IntersectionObserver), and stops cleanly on `dispose()`. A coming-soon
simulation is a manifest without a module; themes still draw it beautifully (see §7.2).

## 5. `packages/kit` — shared runtime for turn-based simulations

Each module small, documented, unit-tested.

| Module | What it must do |
|---|---|
| `rng` | Seeded PRNG (sfc32 or similar) with int, float, pick, shuffle, chance, `fork(label)` for independent streams (weather, events, people…) so adding one random draw in one subsystem never reshuffles another; deterministic across browsers. |
| `turns` | The turn cycle every simulation shares: **plan** (the player edits a draft of decisions; freely changeable, validated live) → **commit** ("End the year" / the sim's own verb) → **resolve** (pure engine step from state + plan + rng) → **report** (what happened, as structured events). Keeps a history of `{turn, plan, events, signals}` so any run can be replayed exactly from its seed and plans. No undo after commit, by design; clear messaging before commit. |
| `forecast` | Helper for honest previews: run the pure engine step on a copy with the current plan and return either an exact consequence (when no randomness is involved) or a range from N seeded samples, labelled as such. Simulations decide what to forecast; the kit makes it cheap and consistent. |
| `events` | A typed event log for reports: severity (good / neutral / warning / disaster), a codex id if it reveals a phenomenon, numbers involved. Turn reports and chronicles are built from events, never from free text the engine invents ad hoc. |
| `runs` | Versioned run storage: autosave after every resolved turn and on `pagehide`; several runs in progress per simulation; list, resume, abandon (with confirm), finish. Never crashes in private mode or when storage is full (degrades to in-memory with a quiet banner). Migrations per simulation save version. |
| `seats` | Hot-seat play for 1–6 players on one device: whose turn, per-seat state, the hand-over interstitial ("Seat 3, the room is yours") with a ready press so nobody sees another player's numbers by accident. |
| `charts` | Small SVG chart primitives in the kit's visual language: sparkline, line with area band, stacked bars, a ghost line overlay, year axis; all accept appearance tokens; all produce an accessible text summary. |
| `format` | Number and unit formatting (tabular figures, thousands separators, signed deltas, percent, units supplied by each simulation), plural rules, and a compact "+12 / −340" delta style used everywhere. |
| `audio` | WebAudio synth: calm named cues (page turn, seal stamp, coin, harvest chime, warning bell), soft ambience beds per simulation, master/music/SFX volumes, mute, unlock on first gesture. No audio files. |
| `settings` | Typed store: theme, appearance (light/dark/system, follows `prefers-color-scheme` live), volumes, reduced motion, text size (100/115/130 %), advisor hints (on / quiet / off), forecasts (shown / hidden for purists), per-simulation namespace; persisted; change events. |
| `save` | Versioned localStorage wrapper with migrations, used by `runs` and by the Hall. |
| `milestones` | Registry per simulation, unlock, progress, toast event, points value (§6.3). |
| `codex` | Registry of phenomena per simulation, discovery events, "seen N times", first-seen chronicle link. |
| `chronicle` | Builds a `ChronicleEntry` from a finished run's history: title line, epithet (§6.1), timeline of turn glyphs, key moments, final signals, verdict, seed, scenario, date. Stable serialisation. |
| `daily` | UTC-day seed per simulation, daily number (#1 = launch day, constant in one place), "already played today's scenario", the **Almanac streak** (§6.6), Wordle-style share string helper. |
| `legacy` | Points from milestones, rank thresholds, cosmetic unlocks (§6.3). |
| `stats` | Per simulation: runs begun, runs finished, turns played, time played, last played, best verdict. |
| `color` | Contrast checks (AA asserts in tests), token helpers for light/dark. |
| `share` | Clipboard + download of a share card rendered to SVG (no raster files in the repo). |

Unit tests at minimum: RNG determinism and stream independence after `fork`; a full run replayed
from seed + plans reproduces every signal exactly; forecast ranges contain the realised value at the
stated rate on a seeded test model; runs autosave/resume/migrate, including storage-full and private
mode; seats hand-over; chronicle serialisation round-trip; daily number and streak across midnight
UTC and DST, including the grace day (§6.6); legacy rank thresholds; settings persistence.

## 6. Legacy — how this collection is gamified (record as ADR-0003)

The owner delegated the gamification to the architect. The decision is: **reward understanding,
stewardship and curiosity, not grind.** Simulations are slow, thoughtful and replayable; the
gamification must make finishing a run feel like writing history, make a second run of the same world
irresistible, and make learning how the model works a game of its own. Six pieces, all theme-agnostic
data in `hall/src/data` and the kit; themes only present them.

### 6.1 Chronicles — every run becomes history

When a run ends (completed, ruler deposed, colony lost, whatever the simulation's endings are) the
kit builds a **Chronicle**: a single beautiful page with

- a generated **epithet** for the player's tenure, picked from rules each simulation supplies (e.g. a
  ruler who never let a year end with less grain than the year before earns a "Keeper of Full
  Granaries"–style epithet — our own words, written per simulation). The kit provides the rule engine
  (conditions over the history) and a fallback;
- a **timeline strip**: one glyph per turn (good, quiet, hard, disaster), hover/focus shows that
  turn's headline event;
- two or three **key moments** chosen by significance (biggest swing, worst disaster survived,
  best turn);
- charts of the simulation's signals across the run;
- the verdict, seed, scenario and date; "Replay this world" (§6.2).

Chronicles are kept forever (until "Forget my data") in the **Library** (`#/chronicles`): filter by
simulation, verdict, scenario; sort by date or by verdict. A chronicle page is shareable as an SVG card
and as a short text string. No personal data in either.

### 6.2 Same world, second chance — replays and ghosts

Because engines are deterministic, every run can be **replayed on the same world** (same seed, same
weather, same luck — only the player's decisions differ). When replaying, the previous run of that
world is drawn as a **ghost line** on every signal chart, and the turn report shows a quiet
"last time: …" comparison. The daily scenario is the same world for everyone that day (§6.4), so a
shared result means something.

### 6.3 Milestones, Legacy points and ranks

Each simulation defines about 12–20 **milestones** (achievements) in three kinds, with points:

| Kind | Rewards | Example shape (each simulation writes its own) |
|---|---|---|
| Stewardship | Running the world well | Finish a full term with nobody going hungry |
| Insight | Discovering how the model works | See every kind of harvest at least once |
| Curiosity | Trying unusual approaches | Finish a run without ever buying land |

Total points across the collection give a **Legacy rank**: six ranks with our own names (suggested
ladder: Novice · Clerk · Steward · Governor · Sovereign · Sage; refine the words, keep them generic and
all-ages). Ranks unlock **cosmetics only**, one per rank per theme: an almanac cover and ribbon, a
Situation Room palette, a terrarium dome trim and plant. Nothing affects any simulation's balance.
Points are earned only by play; nothing is bought, nothing expires.

### 6.4 Scenarios and the daily scenario

A **scenario** is a curated starting world with its own twist (a scarce first year, a crowded city, a
rival who starts ahead). Simulations list theirs in the manifest; the kit gives them a common card and
a "played / finished / best verdict" record. The **daily scenario** for each simulation is generated
from the UTC date seed (plus an optional twist the simulation picks from its pool), numbered (#1 on
launch day), and has a share string, for example:

```
One More Year · <Sim title> #12
🌾🌾🌧️🐀🌾🌾☀️🌾🌾🌾
Fed 100% · Land +40% · "Keeper of Full Granaries"
```

The glyphs per turn come from each simulation (the kit supplies the format and length limits). First
attempt of the day is the one that counts for the share; replays are always allowed.

### 6.5 The Codex — learn the model, collect the phenomena

Each simulation defines **phenomena** (a plague, a rat infestation, a drought, a wave of
newcomers…). The first time a run produces one, it is **discovered**: a small "New in your Codex"
card appears in the turn report. The Codex page (`#/codex`) shows, per simulation, discovered entries
as illustrated cards (code-drawn) with: what it is, when it tends to happen, and — once seen a few
times — **how the model actually computes it**, in plain words and honest numbers ("roughly one year
in five"). Undiscovered entries are silhouettes with a hint. This turns the old "black box" of these
programs into a glass box, which is the most modern thing we can do for them. Completion per
simulation feeds Insight milestones.

### 6.6 The Almanac streak — gentle, not punishing

Playing any daily scenario on a UTC day extends the **Almanac streak** ("12 years running"). One grace
day per seven is forgiven automatically, shown as a pressed flower in the almanac rather than a
broken chain; losing a streak is never announced with shame, the counter simply starts a new volume.
No reminders, no notifications.

### 6.7 Runs in progress

The Hall always shows **Continue** for runs in progress (most recent first, with simulation, turn
"Year 6 of 10", last signals and a tiny sparkline). Resuming lands on the plan screen of the current
turn, never mid-animation.

## 7. The Hall

The concept: **an almanac of small worlds.** Each simulation is a world you can open, tend for a
while, and close; the Hall is where the worlds live, where your chronicles are shelved and where your
legacy grows. Keep the metaphor light and the UI clear: almanac words in headings, plain words on
buttons ("Begin", "Continue", "How to play", "Settings").

### 7.1 Data layer (theme-agnostic)

Registry of manifests, daily scenario per simulation (seeded by UTC date, playable simulations only),
filters by domain and session length, runs in progress, chronicles, codex progress, milestones,
legacy rank and cosmetics, streak, stats. All themes read the same data; adding a simulation never
touches theme code. Titles live only in manifests, so a rename is a one-file change (both titles
below are provisional).

Register these two as **coming soon**:

| id | Title | Domain | Turn | Turns | Players | inspiredBy.originalTitle | inspiredBy.uiTitle |
|---|---|---|---|---|---|---|---|
| ten-harvests | Ten Harvests *(provisional)* | governance | year | 10 | 1P | Hamurabi | the 1968 grain-and-land simulation |
| crown-of-florins | Crown of Florins *(provisional)* | governance | year | 20–45 | 1–6P | Santa Paravia and Fiumaccio | the 1978 city-state simulation |

Write a placeholder tagline, teaser, emblem, accent and 3 signals for each (e.g. people / grain /
land; treasury / people / land); each simulation's own prompt finalises them. The data layer and all
themes must look intentional with 2 simulations **and** with 20: test both with generated fixture
manifests (fixtures never ship).

### 7.2 Three themes × two appearances (record as ADR-0004)

Each theme is its own renderer (layout, components, motion, tokens) over the shared data layer.
Theme and appearance are independent settings: six art-directed variants, never a recolour. Themes
skin the shared chrome (top bar, settings, pause, chronicle page, share card, loading, Library,
Codex, Legacy). They never restyle the inside of a simulation.

All three themes are **calm**: no flashing, no score counters spinning, no arcade glow. Motion is slow
and physical (pages, glass, ink, growing plants). Every theme must make numbers beautiful — this is a
collection about reading a world through its numbers.

**Almanac** (default) — the book of years.
The Hall is a large open almanac lying on a desk. The left page is the **index**: each simulation is a
chapter with an engraved-style emblem plate, its title in a bookish serif, domain and turn unit as a
small rubric, and a coloured ribbon tab on the book's edge. The right page shows the focused
simulation: its living demo framed like an engraved plate (the demo is drawn in the theme's line
style via the appearance tokens it receives), the teaser, its signals as tiny marginal charts, your
best chronicle's epithet, and **Begin** / **Continue**. "Today's page" (the daily scenarios) is a
dated leaf with a calendar corner; the streak is a row of small year-marks along the page foot, with
pressed flowers for grace days. Opening a simulation turns the page (reduced motion: cross-fade).
Coming-soon chapters are blank plates with a pencilled outline of the emblem and "in preparation".

| | Light — morning study | Dark — lamplight |
|---|---|---|
| Mood | Warm vellum paper, sepia ink, vermilion rubrics, gilt page edges, a soft window light across the desk | Deep ink-blue paper, ivory text, gold-leaf rubrics, a warm lamp pool on the book, the desk falling into shadow |
| Accent | Each simulation's accent as its ribbon and rubric colour | Same accents, lifted to glow softly on the dark paper |

**Situation Room** — the world as data.
A clean, modern operations wall for people who love numbers. Each simulation is a **live feed tile**:
its demo runs in a compact panel, and beside it its 2–4 signals stream as crisp sparklines with the
current value in large tabular figures and the last change as a delta. A **year ticker** along the
top shows the demo worlds advancing in sync. Focus enlarges a tile into a briefing panel (teaser,
scenarios, your chronicles as a small table, Begin / Continue). The daily scenarios are a "Today's
briefing" strip with numbers; the streak and legacy rank sit in a status bar. This theme proves the
signals contract (§4.1) and must look like a premium product dashboard, not a spreadsheet.

| | Light — briefing | Dark — night shift |
|---|---|---|
| Mood | White and pale grey surfaces, graphite type, signal blue, amber for warnings, generous whitespace | Charcoal glass, cool cyan lines, amber warnings, a single magenta for disasters, soft depth, no neon bloom |

**Terrarium** — small worlds under glass.
Each simulation is a tiny living world under a glass dome on wooden shelves: the demo is rendered as
a miniature diorama (fields, rooftops, a river; the simulation decides) seen through curved glass with
a subtle reflection. Hover or focus lifts the dome a little and the world's sounds become faintly
audible (only if sound is on); a small brass label shows the title and a tag shows domain and turn
unit. Daily scenarios are domes with a ribbon; finished chronicles appear as little pressed-paper
labels hanging from the shelf. Cosy, warm, playful — the theme for younger players.

| | Light — greenhouse noon | Dark — firefly night |
|---|---|---|
| Mood | Sunlit greenhouse, pale green glass, terracotta pots, oak shelves, leaf shadows | Deep teal night, glass catching moonlight, worlds glowing softly from inside, slow fireflies (reduced motion: a still glow) |

Top bar (all themes): collection logo (an inline SVG wordmark "One More Year"), Library, Codex,
Legacy, theme switch, light/dark toggle (sun/moon; Light/Dark/System in settings), sound toggle,
settings.

### 7.3 The intro (first visit only, skippable)

A short opener in our own design: a year counter on a calendar leaf flips from one year to the next,
a field grows from bare soil to harvest in the same breath, and the logo settles in with the line
"Just one more year." At most 5 seconds. Any key or click skips. Under reduced motion: a single
cross-fade. Never shown again unless replayed from About.

### 7.4 First-visit picker — "Choose your study"

After the intro: the three themes as large live previews side by side, in the visitor's current
appearance, with the light/dark toggle visible. One click chooses; "Skip" = Almanac. Never shown
again unless reset in settings.

### 7.5 Hall pages

- **Simulation detail** (overlay or right page, per theme): big live demo, teaser, domain, turn unit,
  typical length, players, scenarios, milestones, codex progress, your chronicles for it, "Begin",
  "Continue" (if a run is in progress), "How to play", links to the simulation's docs on GitHub.
- **Library** (`#/chronicles`, `#/chronicles/<id>`): all chronicles; each opens as a full chronicle
  page (§6.1) with share.
- **Codex** (`#/codex`): per simulation, discovered and undiscovered phenomena (§6.5).
- **Legacy** (`#/legacy`): rank, points, the next rank's cosmetic, milestones across all simulations,
  stats, the streak as a little almanac of days.
- **About** (`#/about`): the story of these programs and of this project (facts in §10 only), the
  originals and their new titles, credits, "Replay the intro".

### 7.6 Navigation standard and shared chrome (record as ADR-0005)

Build it into the chrome now so every simulation inherits it:

- Two destinations with fixed names everywhere: **Game menu** (the simulation's own title screen)
  and **Back to the Hall**.
- Every game menu shows "← Back to the Hall" top-left; Escape on a game menu returns to the Hall.
- During play: a visible pause button with an "Esc" hint. Pause menu order: Resume · simulation items
  · How to play · Settings · Game menu · Back to the Hall.
- Results (the chronicle page): Play again (R) · Replay this world · Game menu · Back to the Hall (H).
- Leaving mid-run: no confirm needed when the run is autosaved (it always is after a resolved turn);
  confirm only if the current plan has unsaved edits, and offer to keep them as a draft.
- Browser Back works (hash routes). First visit to any simulation: a one-time hint "Esc — pause and
  menu · your world saves itself every turn".
- Settings panel: appearance, theme, volumes, reduced motion, text size, advisor hints, forecasts,
  "Show the intro again", "Choose a theme again", "Forget my data" (with a clear list of what is
  erased: runs, chronicles, codex, legacy).
- Share card: themed SVG with the simulation emblem, the timeline strip, the epithet, the daily
  number if any; never any personal data.

## 8. Documentation

### 8.1 Per-simulation templates (`docs/templates/`)

Five Markdown templates with headings and one-line guidance each; diagrams are Mermaid only.

1. **ABOUT.md** — brochure: the original program and its hook, who made it and when, then what the
   reborn simulation looks and feels like and why it is worth playing today. At least one Mermaid
   diagram.
2. **HOW-TO-PLAY.md** — player's manual: controls table, the world and its numbers, one turn step by
   step, how to read the report, scenarios, the daily scenario, settings, endings and verdicts,
   milestones, codex, tips for a first good run.
3. **ARCHITECTURE.md** — for programmers: module map, the model (every formula, as a table and a
   Mermaid flow of one turn), rng streams, forecast use, rendering pipeline, where each visual and
   sound is defined in code and how to change it, contract usage, tests, how to add a scenario.
4. **CHANGES-FROM-ORIGINAL.md** — kept, changed, added, removed, and why; original bugs we fixed or
   kept on purpose.
5. **NOTES.md** — verified facts about the original (from reading its code), simulations and balance
   tuning with numbers.

### 8.2 Repo docs

- `README.md` — hero section (Hall screenshot), what this is in three lines, "no arcade, only
  worlds", the list of simulations (generated from the registry by a `pnpm docs:sims` script),
  Legacy in five bullets, run/build/test, credits, licence. Written to attract GitHub visitors.
- `CREDITS.md` — the original authors and publishers (§10), sources with links, fonts and licences,
  libraries.
- `AGENTS.md` — rules for any AI coding agent: hard rules, contract, folders, navigation standard,
  determinism obligations (pure engine, rng streams, replay test), "stay in your folder",
  "PROGRESS.md once at the end", "never commit". `CLAUDE.md` already exists: keep its content, keep
  the two consistent, do not reduce it to a pointer.
- `docs/adr/` — 0001 stack, 0002 contract, 0003 Legacy, 0004 themes, 0005 navigation, 0006 turn
  engine and determinism, plus any others you need.
- `docs/ARCHITECTURE.md` — kit, turn cycle, runs and replays, Hall data layer, theme renderers,
  routing, build and deploy. Mermaid diagrams.
- `docs/PROGRESS.md` — the simulations with status (excluded from Prettier so parallel sessions can
  each edit their own row).
- `.github/workflows/pages.yml` — build, test, deploy to GitHub Pages on push to `main` (written, not
  run; Pages source must be "GitHub Actions").
- `LICENSE` — MIT.

## 9. The test-only fake simulation

Under `hall/tests/fixtures/`, build **Pond**: a tiny but real simulation (a pond with fish and weed;
each turn the player sets how many fish to catch; weed grows; random rainy/dry years from a forked
rng stream; ends after 8 turns or when the fish are gone). It must exercise: mount, plan → commit →
resolve → report, forecast (exact and ranged), events with codex discoveries, signals, autosave and
resume after a page reload, two runs in progress, replay on the same seed with a ghost, chronicle
with epithet rules, milestones, the daily scenario and its share string, seats with 2 players,
`demo()` with a bot, pause and every navigation exit. It never appears in the registry or the built
site (assert it). Keep its code exemplary: it is the first thing a simulation builder will read.

## 10. Facts for About, README and CREDITS

Use only these, cite the sources in `CREDITS.md`, and write every sentence in your own words. If you
want to add a fact, it needs a source.

Hamurabi (source: Wikipedia, "Hamurabi (video game)"):

- It began in 1968 as *The Sumer Game* (also called *King of Sumeria*), written by Doug Dyment at
  Digital Equipment Corporation in the FOCAL language for a PDP-8.
- It was inspired by *The Sumerian Game* (1964–1966), an educational economic simulation by teacher
  Mabel Addis and IBM programmer William McKay.
- Around 1971 David H. Ahl ported it to BASIC, renamed it Hamurabi and added the end-of-term
  appraisal; it appeared in *101 BASIC Computer Games* (1973) and again in *BASIC Computer Games*
  (1978), which became the first million-selling computer book.
- The single "m" in the name has a reason: Dyment shortened words so the program would fit into a
  4K machine, and Ahl kept that spelling. The ruler is meant to be the Babylonian king Hammurabi,
  although the game speaks of Sumeria.
- It is regarded as an ancestor of strategy, simulation and city-building games.

Santa Paravia and Fiumaccio (source: Wikipedia, "Santa Paravia en Fiumaccio"):

- Written by George Blank; it first appeared in the December 1978 issue of *SoftSide* magazine and
  was sold on cassette by Instant Software for the TRS-80, Apple II, TI-99/4A and Commodore PET.
- Each player rules a young Italian city-state around the year 1400 and tries to rise through noble
  titles to king or queen; it added city building to the Hamurabi formula and is counted among the
  antecedents of the city-building genre.
- The reference file in this project is a later IBM PC BASIC conversion whose header carries a 1979
  Instant Software copyright line (verify in the reference before writing it); present 1978 as the
  first publication and the file as a later conversion.

Sources to list: <https://en.wikipedia.org/wiki/Hamurabi_(video_game)>,
<https://en.wikipedia.org/wiki/Santa_Paravia_en_Fiumaccio>, and
<https://en.wikipedia.org/wiki/The_Sumerian_Game>.

## 11. Tests and checks

- Unit tests for every kit module (§5) and the Hall data layer (daily scenario deterministic per date
  and skipping coming-soon simulations, filters, runs in progress, chronicles, codex progress, legacy
  ranks, streak with grace days).
- The Pond fixture (§9) driven end to end through the real chrome.
- Playwright (port 5479): load the Hall; every theme × appearance; flip the OS colour scheme while on
  System; keyboard-only navigation to a simulation and its detail; Pond: a full run by keyboard only
  and by mouse only; reload mid-run and resume on the plan screen; replay a world and see the ghost;
  chronicle page and share string; Library, Codex and Legacy pages; intro skip; theme picker on a fresh
  profile; "Forget my data"; browser Back; with 2 and with 20 fixture manifests; no console errors.
- Accessibility: axe on every theme × appearance and on the chronicle page; contrast asserts on
  tokens; every chart has a text alternative.
- Guardrail script (`pnpm check`): no raster files outside `docs/media/`; no network URLs in built
  code; no reference-folder paths imported; a deny-list of the originals' distinctive phrases is NOT
  stored in the repo — instead `scripts/provenance-scan.ts` takes the reference folder path as an
  argument at run time, extracts strings of 20+ characters from the originals, and fails if any appear
  in `hall/`, `packages/` or `games/*/src`.

## 12. Staged workflow

Work in this order; do not move on until the stage's checks pass.

1. **Scaffold** — workspace, tooling, scripts (`dev`, `build`, `preview`, `test`, `lint`,
   `typecheck`, `e2e`, `check`, `docs:sims`), empty Hall route, `git init` (no commit).
2. **Kit** — every module in §5 with unit tests, including the replay and forecast tests.
3. **Contract + data layer + Legacy + Pond** — registry with the two coming-soon manifests, Legacy
   data (§6), data layer tests, the Pond fixture running through the real chrome (unstyled is fine).
4. **Hall hero frames — OWNER CHECKPOINT.** Build just enough of each theme to render real, live
   screens (not mockups), with Pond's demo standing in for a playable simulation next to the two
   coming-soon entries: for each of Almanac, Situation Room and Terrarium, the main Hall view in
   light and in dark at 1920×1080 (six frames), plus Pond's chronicle page in Almanac light and
   Situation Room dark (two frames). Critique them as a demanding art director for at least five
   rounds: hierarchy, spacing, typography, numbers as beautiful objects, colour, does it feel calm,
   premium and alive, would this be the README hero image, does each theme look like itself and not
   like Byte Sized '83 or Boss Key '83? Save the finals to `docs/media/hero/` and **STOP. Tell the
   owner the frames are ready and wait for approval or changes before continuing.**
5. **Themes** — after approval, finish each theme fully, one at a time (Almanac → Situation Room →
   Terrarium): Hall, detail, Library, chronicle page, Codex, Legacy, About, settings, picker, pause
   (with Pond). Screenshots at 1280×720 and 1920×1080 in light and dark; at least three critique and
   fix rounds per theme. Save finals to `docs/media/hall/<theme>/`.
6. **Intro, chrome, share card polish.**
7. **Docs** — everything in §8.
8. **Final check** — `pnpm lint`, `typecheck`, `test`, `check`, `build`, `e2e`; run the provenance
   scan against `E:\Projects\simulation\src`; a fresh-profile run showing intro and picker; sanity
   on the built Hall (fast first load, no layout shift, works offline after first load).

## 13. Deliverables checklist

- [ ] Monorepo scaffold with all scripts; CI and Pages workflow written
- [ ] `packages/kit` complete and tested: rng streams, turns, forecast, events, runs, seats, charts,
      format, audio, settings, save, milestones, codex, chronicle, daily, legacy, stats, color, share
- [ ] Contract (ADR-0002) with signals; Pond fixture kept out of the build
- [ ] Legacy (ADR-0003): chronicles, replays with ghosts, milestones and ranks with cosmetics,
      scenarios and daily scenario with share string, Codex, gentle streak, runs in progress
- [ ] Hall: data layer, three finished themes × light/dark, intro, picker, detail, Library, Codex,
      Legacy, About
- [ ] Navigation standard built in and tested
- [ ] Two coming-soon manifests; layouts verified with 2 and 20 fixture manifests
- [ ] Docs templates, README, CREDITS, AGENTS, ADRs 0001–0006+, ARCHITECTURE, PROGRESS, LICENSE
- [ ] Hero frames (approved by the owner) and final screenshots in `docs/media/`
- [ ] All checks green, provenance scan clean; git initialised, nothing committed

## 14. When you finish

Reply with: what you built; decisions that differ from this prompt and why; the final Legacy rank
names and cosmetics; known gaps; a **kit API summary** a simulation prompt can rely on (turn cycle,
forecast, events, runs, signals, chronicle epithet rules, codex, milestones, daily glyphs, seats,
demo); the exact commands to run the Hall locally. Update `docs/PROGRESS.md` once.
