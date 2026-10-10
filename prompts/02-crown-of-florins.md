# Prompt 02 — Crown of Florins (inspired by "Santa Paravia and Fiumaccio", George Blank 1978)

> Run in Claude Code from `E:\Projects\simulation\web`, ALONE, AFTER prompt 01 (Ten Harvests) is finished,
> approved and committed by the owner — Ten Harvests settles the kit's 3D and cinematic conventions first.
> Recommended: Opus 5.5, effort **xhigh**. This is the collection's most ambitious simulation; visuals and
> the living economy are the top priorities. Do not trim scope to save time.
> **Owner checkpoint:** stage 1 ends with hero frames; STOP there and wait for the owner's approval.

## 0. Read first

1. `CLAUDE.md`, `AGENTS.md`, `.claude/skills/retro-reborn-builder/SKILL.md`, `docs/ARCHITECTURE.md`, all ADRs,
   the kit's public API (especially `turns`, `forecast`, `events`, `runs`, `seats`, `chronicle`, `codex`,
   `milestones`, `daily`) and `docs/templates/`. Your first reply summarises the hard rules in five lines,
   names this prompt, says you are the only session (kit changes only for genuine gaps, each with an ADR and
   tests), and states your ports: dev **4481**, Playwright **5481**.
2. `games/ten-harvests/`: read its ARCHITECTURE, rendering ADR, quality ladder, cinematic structure and
   scene tests. Reuse its patterns (and promote shared pieces to the kit per the ADR process); do not copy
   its art direction — this game must look entirely different.
3. Reference (READ-ONLY, outside the repo, never copy into it): `E:\Projects\simulation\src\santaparavia.bas`
   — an IBM PC BASIC conversion. Describe its behaviour in your own words. Never copy its text, its city
   names, its title list, its causes-of-death lines, its invader's name or any message into the repo.
4. This whole prompt; §15 overrides earlier sections.
5. Title rule: our title is **Crown of Florins**. "Santa Paravia and Fiumaccio" appears only as
   `inspiredBy.originalTitle` and in CREDITS/About; on screen use "the 1978 city-state simulation".

## 1. The pitch

Santa Paravia and Fiumaccio added city building to the Hamurabi formula: grain feeds serfs, serfs fill the
treasury, the treasury builds markets, mills, palaces and cathedrals, and all of it lifts your title — while
a hidden clock counts down your life. Up to six players race to the crown on one computer. Its economy is
wonderfully tangled; its presentation hid every rule, and this conversion even lost some of them.

**Crown of Florins** keeps the race and the tangle, opens the box, and paints it: your city-state is a living
Renaissance fresco that grows wall by wall, the valley of rivals spreads out between years, and the day you
are crowned, gold leaf creeps across the whole painting.

| Field | Value |
|---|---|
| Tagline | From knight to crown — before your candle burns out. |
| Teaser | Rule an Italian city-state in the year 1400 against up to five rivals. Build markets, mills and cathedrals, weigh taxes against justice, and climb from knight to the crown. Every rule is on the table. Your lifetime is not. |
| Domain / turn | governance / year |
| Typical turns | 20–45 |
| Players | 1–6P (hot-seat), plus AI rivals |
| Session | 30–90 minutes (autosave every year; long games are normal) |
| Signals | Treasury · Population (all classes) · Land · Title points |

## 2. What the original does (verify every point; record findings in NOTES.md)

The conversion is incomplete. Your first engineering task is a careful reading that separates **working
rules** from **lost or broken rules**. Record each with the line numbers and your verdict.

Working rules to verify (expected):

- 1–6 players, start year 1400; per player: 2,000 serfs, 25 soldiers, 25 merchants, 5 clergy, 4 nobles,
  10,000 hectares, 5,000 bushels, 1,000 florins; customs 25%, sales 10%, wealth/income 5%, justice 2.
- Each player's death year is drawn at the start (1420 + 1..35); "old age" only after 1450; a ruler two
  years from death gets one free title step (deathbed promotion).
- Year flow per player: weather (five grades) and rats (a share of reserves); grain and land trading;
  releasing grain to the people (bounded between a minimum and maximum share of reserves); births, deaths,
  migration, serfs fleeing under harsh justice, merchants/nobles/clergy arriving; taxes (customs, sales,
  wealth) and justice income; building (marketplace, woollen mill, palace piece, cathedral piece) and
  soldiers; bankruptcy when debt passes a limit that scales with title (creditors seize most assets);
  interest on negative treasury; invasion when soldiers are too few for the land or a rival is strong;
  title review from twelve pillars, each capped at 10, divided by (difficulty + 5), minus justice.
- Map drawing each year: walls sized by land, guard tower, palace, cathedral, plowman, markets, mills.

Breaks to confirm (expected):

- **Difficulty is never applied**: the answer goes into a different variable than the one used, so every
  game runs at the easiest level.
- **Lost economy lines**: grain demand and harvest appear never to be computed, the land price appears to
  stay at zero, and the harvest appears never to reach the reserves. Confirm or correct each precisely.
- **Swallowed code**: two lines merged into comments, so building a palace never adds nobles and the guard
  tower base is never drawn.
- An immigration condition compares the wealth-tax rate to grain demand (wrong variable).
- The sex question accepts lowercase only; a fictional named baron invades when no rival is strong.

Write the verdict in NOTES.md: which numbers and relations we keep verbatim, and which we must design.

## 3. Game design

### 3.1 The economy (reconstruction)

The owner chose **reconstruction**: keep every working formula and its constants; design the lost pieces
ourselves; tune with bots; document every designed formula as ours. Do **not** consult or copy any other
port (C, Palm, web or otherwise) — their licences are unknown.

Pieces to design (propose, simulate, then lock):

| Piece | Requirements |
|---|---|
| Harvest | From weather grade, land under the plow (limited by serfs as labour), and a seeded variance; a bad year should hurt, a run of bad years should frighten. |
| Grain demand | From population by class, so releasing below demand starves and above demand attracts migrants, as the working code clearly intends. |
| Land price | Seeded, responsive to the harvest (scarce grain → dear land), within a believable band; never zero. |
| Grain price | Keep the working code's relation; check it once the harvest exists. |
| Fixes | Palace adds nobles; immigration uses grain released; difficulty applies (four levels). |

Bot-driven balance targets (record in NOTES, lock as tests with tolerances), 4 players, normal difficulty:

- A competent bot reaches the crown in 30–55% of games before death; median reign to crown 25–35 years.
- A naive bot (never builds, mid taxes) is never crowned and is bankrupt or invaded in < 40%.
- The first-player advantage across seats is within ±5 percentage points.
- Each difficulty step lowers the competent bot's crown rate noticeably; the hardest stays winnable (≥ 8%).

All randomness through forked rng streams (`weather`, `rats`, `prices`, `people`, `invasion`, `lifespan`,
`events`, plus one per AI rival) so replays, hot-seat games and the daily scenario are exact.

### 3.2 Glass box

Everything the engine uses is shown, through the kit's `forecast` and the UI:

- **Road to the next title**: the twelve pillars as bars with the cap at 10, points needed, and the justice
  penalty shown as a subtraction; hovering a pillar says what raises it ("+1 per 2 marketplaces").
- **Taxes and justice preview**: revenue per tax, migration and fleeing effects, all as exact numbers or
  labelled ranges.
- **Border watch**: the invasion conditions as a three-part meter ("soldiers for your land", "rival
  strength", "walls"), honest about the chance.
- **Debt**: the bankruptcy line for your title, interest due, years until the creditors arrive at this rate.
- **Lifetime** (the owner's choice): your ruler's age and an honest life-expectancy band; as the end nears,
  omens appear (the court physician's frown, a quieter court, a candle burning low in the portrait). The
  exact year stays hidden, but the odds per year are shown. A Codex entry reveals the deathbed promotion.

Forecasts can be hidden in settings (kit) for players who want the 1978 fog.

### 3.3 Fate and dynasty (the owner's choice)

- **Dynasty (default)**: when a ruler dies, the heir takes the throne one title step lower, with the city
  intact. A dynasty may be crowned by any ruler of the line; the chronicle shows every ruler.
- **Classic fate (option)**: death ends that player's game, as in 1978.
- Deaths are dignified: candle out, bells, the illuminated obituary page (§6.5). Causes named gently and in
  our own words; no disease imagery.

### 3.4 Players and rivals

- Hot-seat 1–6 through the kit's `seats` (hand-over curtain so nobody sees another's numbers).
- **AI rivals** fill empty seats (0–5) with distinct personalities, each a real policy using the same engine
  and rules as a human: **the Merchant** (markets, low customs, mills), **the General** (soldiers, invades
  the weak), **the Builder** (palace and cathedral), **the Miser** (treasury, harsh taxes), **the Saint**
  (mild justice, clergy). Each with our own invented ruler name and city. Difficulty also tunes AI skill.
- Invasions happen between real rivals (human or AI); when none is strong enough, an anonymous band of
  mercenaries comes instead (our own invention, no named NPC).
- Turn order rotates each year so no seat is always first.

### 3.5 Names

- Title ladder (our own, Italian, with a chosen form per ruler instead of a gender question):
  Cavaliere/Dama → Barone/Baronessa → Conte/Contessa → Marchese/Marchesa → Duca/Duchessa →
  Granduca/Granduchessa → Principe/Principessa → Re/Regina.
- City names: a list of 24 invented Italian-sounding towns written by you; none of the original six.
- Rival and heir names: invented generators; never real historical persons.

### 3.6 Modes

| Mode | What it is |
|---|---|
| **Solo vs rivals** | 1 human + 1–5 AI rivals; the default. |
| **Hot-seat** | 2–6 humans (+ optional AI). |
| **Daily scenario** | Fixed rivals, weather and lifespans from the date seed; 1 human; first attempt counts for the share. |
| **Scenarios** (5) | Our own: **Narrow Valley** (little land, rich soil), **Borrowed Crown** (start deep in debt, Barone), **The General Next Door** (an aggressive neighbour), **Year of Fevers** (people events doubled), **Harbour Town** (no land to buy; customs and markets matter more). Tune each with bots (competent bot crowned in ≥ 15%). |
| **Endless Dynasty** | No end date; the chronicle grows; milestones for long lines. |

Four difficulty levels that actually work: Apprentice, Journeyman, Master, Grand Master.

### 3.7 Endings

Crowned (the first to reach Re/Regina wins; others may keep playing for their own chronicle), dynasty
extinct (Classic fate, or no heir after bankruptcy and invasion), bankruptcy and seizure (survivable),
the year limit in some scenarios. Verdict lines in our own words, warm and a little wry, all-ages.

### 3.8 Legacy integration

- **Epithets** (≥ 12), e.g. builder of the full cathedral; never raised a tax; the just; crowned in under
  20 years; three generations to the crown; never invaded; bankrupt and crowned anyway.
- **Milestones** (~18) across Stewardship / Insight / Curiosity: crowned; crowned at Grand Master; crowned by
  the third ruler of a line; complete the cathedral; win without soldiers above the minimum; see the deathbed
  promotion; see all five weathers; beat each AI personality; hot-seat with six; read every pillar's rule.
- **Codex** (~12): the five weathers, rats, migration, fleeing serfs, invasion, bankruptcy, interest, the
  deathbed promotion, the title formula, the justice penalty, and **"The difficulty that never was"** (a
  history card about the conversion's lost setting).
- **Daily glyphs** per year: ☀️ excellent, 🌤️ good, ☁️ fair, 🌧️ poor, 🌩️ drought/disaster weather; ⚔️
  invaded; 🏛️ a building completed; 👑 title gained (priority 👑 > ⚔️ > 🏛️ > weather). Long games: show the
  first 30 glyphs and "+N" (kit length limit).
- Share example: `One More Year · Crown of Florins #12` / glyphs / `Regina in 27 years · 4 rivals · "The Just"`.

## 4. Interaction

A year is five steps along a top step-bar (strict grid): **1 Harvest** (watch; report) → **2 Market**
(grain and land) → **3 Bread for the people** → **4 Taxes and justice** → **5 Builders** → **Title review**.
Players may jump back to any earlier step until they press "Seal the year". Every step has both direct
manipulation in the fresco and precise controls in a side panel, bound to the same plan draft.

| Step | In the fresco | In the panel |
|---|---|---|
| Market | Drag sacks between the granary and the merchants' stalls; drag the wall line outward to buy land, inward to sell | Buy/sell grain and land with steppers; live prices |
| Bread | Drag grain sacks from the granary to the piazza; the crowd grows or thins in preview | Release slider with min/max marks and the demand line |
| Taxes and justice | Three toll gates and a magistrate's bench react (queues lengthen, faces sour, serfs pack carts) | Customs, sales, wealth sliders; justice as four stamped seals |
| Builders | Drag a building card onto a lit plot inside the walls; scaffolding appears as a preview | Build list with cost, effect on pillars, and how many you can afford |

Constraints are shown, never sprung: marks on sliders, greyed plots with a one-line reason, a gentle shake
on an illegal drop. "Seal the year" (Enter) asks once only when the plan breaks something big (starving
more than a set share, crossing the bankruptcy line, leaving the border watch red).

## 5. Screens

1. **Game menu** — "← Back to the Hall" top-left; the valley at the appearance's hour with rivals' cities
   breathing in the distance; Begin (Solo) · Hot-seat · Daily · Scenarios · Endless Dynasty · Continue ·
   How to play · Codex · Settings.
2. **Court setup** — seats 1–6: human or AI personality, ruler name (invented suggestion, editable), title
   form, city (from your list, or random), heraldry (procedural coat of arms: tinctures, charges, divisions
   generated from a seed; editable with a few clicks). Difficulty, fate (Dynasty / Classic).
3. **Tutorial** — first run, under two minutes, one guided year by a herald character.
4. **Year screen** — 12-column grid at 1920×1080: court panel (3 cols, left: portrait, age, classes,
   treasury, grain, land), the fresco (6 cols, centre), glass-box panel (3 cols, right: road to the next
   title, border watch, debt), top step-bar, bottom rival bar (each rival's coat of arms, title, and a
   tiny sparkline of their title points; details hidden for human rivals in hot-seat until the reveal at
   the end of a year). At 1280×720 the fresco keeps at least half the width. Layout alignment test.
5. **Harvest beat** — the season passes over the fresco (§6.3).
6. **Valley interlude** — between years (§6.4); invasions resolve here.
7. **Hand-over** (hot-seat) — a velvet curtain with the next ruler's coat of arms; "Ready" to lift.
8. **Title review** — a herald unrolls a scroll; on promotion, the new title is lettered in gold.
9. **Coronation** — §6.6.
10. **Obituary** — §6.5; then the heir's accession (Dynasty) or the end of that seat (Classic).
11. **End** — the chronicle (kit) with a dynasty tree of rulers, every city's final fresco as thumbnails,
    the race chart of title points for all seats with the ghost of the last run on replays; Play again (R)
    · Replay this world · Game menu · Back to the Hall (H).
12. **Pause** — Resume · Ledger (all numbers for the year) · How to play · Settings · Game menu · Back to
    the Hall.

## 6. Art direction — "Affresco"

The owner wants this game to show what code-drawn graphics can do. It must look nothing like Ten Harvests:
not a realistic diorama but **a Renaissance fresco that lives**. Zero raster: geometry, shaders, SVG, all
procedural (plaster grain, pigment noise, gold leaf, heraldry, lettering ornaments).

**Rendering:** three.js scene rendered through a custom **fresco post-process**: painterly filter (e.g.
anisotropic Kuwahara), limited earth-pigment palette mapping, procedural lime-plaster texture with fine
cracks multiplied in, soft hand-drawn outlines from depth/normal edges, slightly flattened perspective
(long lens, high three-quarter view), and gentle pigment bleed at shape edges. Inspired by the general look of
early-Renaissance civic frescoes and bird's-eye city views; do not reproduce any specific artwork. Write
an ADR. 60 fps at 1920×1080 on a mid-range laptop; reuse the quality ladder from Ten Harvests (post-process
resolution, crowd density, shadow quality), plus a manual Graphics setting.

### 6.1 The city

The city is generated from the state, every year:

- **Walls** enclose the land owned (scaled, with towers at corners); buying land pushes them out with a
  masons' animation; selling pulls them in and leaves a ruin line.
- **Districts** grow by class: serfs' houses and fields outside the walls, merchants' houses and
  **markets** (striped awnings, bustling crowd) around the piazza, **woollen mills** with turning wheels on
  a stream, nobles' towers, the **palace** in pieces (wings, loggia, tower), the **cathedral** in six visible
  stages over years (foundations → nave → aisles → façade → dome → campanile), the **guard tower** (both
  base and top, fixing the 1978 drawing bug), soldiers drilling in a yard.
- **People**: GPU-instanced crowd figures in the piazza and lanes, density from population; they cheer at
  a promotion, thin out in hunger, queue at gates under heavy customs.

### 6.2 Appearances

| | Light — Buon fresco | Dark — Notte di candele |
|---|---|---|
| Light | Tuscan noon, warm and dry, soft shadows | Night: torches along the walls, lantern-lit loggias, the cathedral's rose window glowing |
| Palette | Lime white, terra di Siena, ochre, verdigris, lapis blue, vermilion banners | Ultramarine sky with painted stars, warm candle gold, deep umber shadows |
| Plaster | Bright, fine cracks, faint pouncing marks | Darker, candle-smoke patina at the edges |
| UI panels | Parchment, sepia ink, vermilion rubrics, illuminated initials | Dark vellum, ivory ink, gold rubrics |

Readability first: panels on opaque surfaces, AA contrast; the fresco never sits behind text. Reduced
motion: no camera moves, beats become cross-fades, crowds still, gilding appears in one fade.

### 6.3 Signature moment 1 — the year passes over the fresco (6–10 s, skippable; speeds)

Light sweeps across the painting from dawn to dusk; the fields change colour with the weather grade
(lush green to cracked ochre); rain or sun is painted in, not simulated photoreal (stylised strokes);
harvest carts roll to the granary; rats are a small comic band if they come; new families arrive at the
gate; masons climb scaffolding where you built.

### 6.4 Signature moment 2 — the valley

Between years the camera pulls back and the fresco becomes a **painted map of the valley**: a river, roads,
hills, and every player's city-state at its true size with its coat-of-arms banner. Title points rise as
banners on the city towers. Invasions are **banner columns marching along the roads**, meeting at the walls
in a stylised clash of pennants and dust (no gore); the result is lettered on a ribbon. This is also the
Hall demo's main view.

### 6.5 Signature moment 3 — the obituary

When a ruler dies, the screen becomes a page of an **illuminated manuscript that writes itself**: a
decorated initial grows from the ruler's name, the text of their reign is lettered line by line (generated
from the chronicle events, our own words), the margins fill with small painted scenes of their key moments
(the cathedral finished, the year of the great harvest, the invasion repelled), a candle at the foot
gutters out. Exportable as the share card for that ruler (SVG).

### 6.6 Signature moment 4 — the coronation

When a ruler becomes Re/Regina: bells ring (synthesised), a procession fills the piazza, petals fall, and
**gold leaf spreads across the entire fresco** from the crown on the palace outward — a gilding shader with
a crackle mask and a moving specular glint — until the whole city is gilded. Then the camera pulls back to
the valley, where every rival's banner bows. This frame is the README hero candidate.

### 6.7 Demo for the Hall

`demo(seed)`: the valley view with four AI rivals playing quietly at "quick" speed, a year every ~3 s,
banners rising, the occasional invasion; emits the four signals of the leading rival; cheap mode (lower
post-process resolution, sparse crowds), silent, pauses off-screen, draws in the given appearance.

## 7. Sound

All synthesised (kit audio): a lute-like plucked motif per step, bells for promotions and deaths, crowd
murmur scaled by population, masons' taps, a war drum for invasions, quills scratching in the obituary,
a soft choir pad for the coronation. Calm and ducked under the UI.

## 8. Settings

Graphics quality · Year speed (cinematic / quick / instant) · Valley interlude on/off · Forecasts
shown/hidden (kit) · Advisor hints (kit) · AI speed in hot-seat (show AI turns / summarise) · plus the kit's
global settings.

## 9. Controls

| Action | Mouse | Keyboard |
|---|---|---|
| Next / previous step | Step-bar | Tab / Shift+Tab between steps, or 1–5 |
| Move grain / land | Drag sacks or the wall line | Panel steppers, ← → (Shift ×10, Ctrl ×100) |
| Release grain | Drag sacks to the piazza | Slider ← → |
| Taxes / justice | Sliders and seals | ← → on focused control |
| Build | Drag a card onto a plot | B, then arrows to pick a plot, Enter |
| Seal the year | Button | Enter |
| Skip a cinematic | Click | Space |
| Ledger | Pause menu | L |
| Orbit / pan the fresco | Right-drag / wheel | Q / E, + / − |
| Pause | Pause button | Esc |
| Play again / Back to the Hall | Buttons | R / H |

## 10. Engineering and tests

- Folder `games/crown-of-florins/`: `src/engine` (pure TS: economy, people, title, invasion, lifespan,
  rivals' policies), `src/scene` (three.js city, valley, fresco post-process, gilding, crowds), `src/ui`
  (DOM/SVG panels, heraldry, manuscript), `src/lib`, `tests`, `docs`.
- Engine is one pure function per step, composed into the year; each designed formula is its own named,
  documented function with a table in ARCHITECTURE.md.
- **Working-rule tests:** for each rule you verified as working (§2), a test that states the original
  behaviour in your words and checks our engine against it (title formula, justice penalty, deathbed
  promotion, bankruptcy line by title, interest, release bounds, invasion conditions).
- **Balance with bots** (§3.1): competent, naive, builder, general and random bots; ≥ 2,000 seeded games
  per configuration; results in NOTES.md with charts (Mermaid xychart or tables); lock as tests.
- **AI rivals:** each personality beats the naive bot clearly and has a recognisable profile (e.g. the
  General's soldiers per hectare in the top quintile); no rival peeks at hidden state a human cannot see.
- Determinism: replay a full hot-seat game from seed + plans; the daily scenario identical in two contexts.
- Scene tests: wall perimeter grows with land; building counts match state (incl. cathedral stage and
  palace pieces); crowd density tracks population; quality ladder steps down under a slow frame budget.
- Heraldry: generated arms are distinct across the six seats (perceptual distance check) and AA-legible.
- Playwright (game-scoped config, port 5481): Solo vs 3 AI to a coronation on a seed known to crown fast;
  hot-seat with three humans incl. hand-over privacy (no other seat's numbers in the DOM before "Ready");
  a death and heir accession; Classic fate; bankruptcy and recovery; an invasion; Daily; one scenario;
  Endless Dynasty for 60 years; keyboard-only year; mouse-only year; resume after reload mid-step; replay
  with ghost; every navigation exit. Screenshots at 1280×720 and 1920×1080 in light and dark: menu, court
  setup, each of the five steps, harvest beat, valley with an invasion, title review, obituary,
  coronation (mid-gilding and fully gilded), chronicle. Measure fps in the coronation and the valley.

## 11. Staged workflow (with an owner checkpoint)

1. **Hero frames — OWNER CHECKPOINT.** Build the minimum engine and scene to render live, not mocked:
   (a) the year screen with a mature city mid-build (cathedral at stage 4) in the fresco look, (b) the
   valley with five rivals and a banner column marching, (c) the coronation fully gilded, (d) an obituary
   page mid-lettering — each in light and dark at 1920×1080 (eight frames). At least **five** critique
   rounds against "would this stop someone scrolling on social media?", "does it look painted, not
   filtered?" and "is it unmistakably different from Ten Harvests?". Save to
   `games/crown-of-florins/docs/media/hero/`; **STOP and tell the owner.** Do not continue without approval.
2. Source reading verdict (§2) and the designed economy (§3.1) in NOTES.md; engine and bots; balance → tests.
3. AI rivals and hot-seat flow.
4. Wireframes of all screens with full input.
5. Art pass: city generator, fresco post-process, appearances, heraldry, quality ladder.
6. Harvest beat, valley and invasions, title review, obituary, coronation.
7. Modes, scenarios, difficulty, tutorial; Legacy (epithets, milestones, codex, daily glyphs).
8. Sound and feel.
9. Critique loop (≥ 3 rounds, both appearances, both resolutions).
10. Hall integration, docs, final checks.

## 12. Documentation

ABOUT (brochure: the 1978 SoftSide game, the race to the crown, the lost difficulty, what is new),
HOW-TO-PLAY (controls table, the five steps, every pillar, taxes and justice, invasions, debt, lifetime and
dynasty, modes, AI personalities, verdicts, milestones, Codex, tips), ARCHITECTURE (engine map, every
formula as a table — marked *original* or *designed for this game* —, rng streams, AI policies, the city
generator, the fresco pipeline and how to tune each pass, gilding and manuscript, quality ladder, tests),
CHANGES-FROM-ORIGINAL (incl. every conversion bug and our decision), NOTES — Mermaid only (at least: one-year
flow, the title formula as a diagram, engine module map, scene pipeline). ADRs for rendering and for the
reconstructed economy. README entry via the docs script. PROGRESS row.

## 13. Content rules

All copy is ours: herald lines, verdicts, epithets, codex, obituaries, AI and town names, tutorial. Warm,
plain, a touch of Renaissance wit, all-ages. Invasions and soldiers stay in the game (stylised, no gore).
Deaths are dignified and gentle. Clergy and the cathedral are a social class and a building in a historical
setting — no doctrine, no religious claims. No real historical persons. Run the provenance scan against
`E:\Projects\simulation\src` before finishing.

## 14. When you finish

Reply with: what you built; the source-reading verdict (working, broken, lost — with line numbers); the
designed formulas and their tuning; bot balance numbers incl. seat advantage and difficulty curve; AI rival
profiles; fps in the valley and the coronation at each quality level; deviations and why; known gaps; kit
changes (with ADRs) or kit candidates; exact commands to run it.

## 15. Hall integration

Manifest: id `crown-of-florins`, title, tagline and teaser from §1, domain `governance`, turnUnit `year`,
typicalTurns [20, 45], players `1–6P`, sessionMinutes [30, 90], accents (vermilion/gold, light and dark),
an emblem as SVG path data (a crown above a florin coin with a lily, 24×24), `inspiredBy` { originalTitle:
"Santa Paravia and Fiumaccio", uiTitle: "the 1978 city-state simulation", year: 1978, credit: "George
Blank (SoftSide, 1978); published by Instant Software" }, `hasDailyScenario: true`, the five scenarios,
signals treasury / population / land / title points. Replace the coming-soon placeholder for
`crown-of-florins` explicitly; re-read the registry first and change only that entry. Results through the
kit with `presentation: 'game'` for the coronation and obituary; chronicle (with the dynasty tree), codex,
milestones, daily share, seats and pause items through the kit. Status `playable` only when all checks pass.

## 16. Session rules

This prompt runs alone. Stay in `games/crown-of-florins/` except the final registry entry, README via the
docs script and your PROGRESS row. Kit changes only per §0.1. Ports 4481 / 5481. Game-scoped Playwright
config. No commits, no pushes.
