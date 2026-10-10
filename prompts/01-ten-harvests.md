# Prompt 01 — Ten Harvests (inspired by "Hamurabi", Doug Dyment 1968 / David H. Ahl, BASIC Computer Games 1978)

> Run in Claude Code from `E:\Projects\simulation\web`, ALONE, AFTER prompt 00 is finished, approved and
> committed by the owner.
> Recommended: Opus 5.5, effort **xhigh**. This is the collection's showcase: visuals are the top priority.
> **Owner checkpoint:** stage 1 ends with hero frames; STOP there and wait for the owner's approval.

## 0. Read first

1. `CLAUDE.md`, `AGENTS.md`, `.claude/skills/retro-reborn-builder/SKILL.md`, `docs/ARCHITECTURE.md`, all ADRs
   (especially the contract, Legacy, turn engine and navigation ADRs), the kit's public API and
   `docs/templates/`. Your first reply summarises the hard rules in five lines, names this prompt, says you
   are the only session (you may change `packages/kit` only for genuine gaps, each recorded in an ADR and
   covered by tests), and states your ports: dev **4480**, Playwright **5480**.
2. The **Pond** fixture in `hall/tests/fixtures/` is the reference integration: study how it uses turns,
   forecast, events, runs, signals, chronicle, codex, milestones, daily and `demo()`. Do not import from it.
3. Reference (READ-ONLY, outside the repo, never copy into it): `E:\Projects\simulation\src\hamurabi.bas`.
   Describe its behaviour in your own words. Never copy its report lines, its advisor's scolding, its
   appraisal texts, its historical comparisons or its typos into the repo.
4. This whole prompt; §14 overrides earlier sections.
5. Trademark/title rule: our title is **Ten Harvests**. "Hamurabi" appears only as
   `inspiredBy.originalTitle` and in CREDITS/About; on screen use "the 1968 grain-and-land simulation".
   The ruler on screen is "the ruler" / "Your Majesty" — never the historical king's name.

## 1. The pitch

Hamurabi is one of the founding simulation games: three numbers (people, land, grain), four decisions a
year, ten years. Its tension is timeless; its presentation was a wall of typed numbers and a black box of
luck. **Ten Harvests** keeps the model and turns it into a living city on the Euphrates that you can read at
a glance: the harvest grows in front of you, the granary fills, and at night every lit window is ten of
your people.

Hooks from the source (confirm each, §2):

- The code's own comment promises a 15% plague chance; the arithmetic actually gives 20%.
- A scoring bug: a year in which you feed *more* than everyone needs is skipped when averaging hunger,
  so earlier bad years count double — feeding people exactly enough scores better than being generous.
  We fix it in the normal game and keep it, discoverable, in the 1978 Ledger mode.

| Field | Value |
|---|---|
| Tagline | Ten years. Three numbers. One river. |
| Teaser | Rule a city on the Euphrates for ten harvests. Every bushel is a choice: bread today, seed for next year, or land for your grandchildren. The odds are honest. The river is not. |
| Domain / turn | governance / year |
| Typical turns | 10 (Dynasty: 30) |
| Players | 1P |
| Session | 10–20 minutes |
| Signals | People · Grain in store · Acres (and derived: acres per person) |

## 2. What the original does (verify every point against the source; record findings in NOTES.md)

- Start: 95 people plus 5 newcomers = 100; 1,000 acres; 2,800 bushels in store; last harvest 3 per acre;
  rats ate 200. Year 1 can never have a plague (the plague flag starts "safe").
- Each year, in this order: land price is random 17–26 bushels/acre; buy land; **only if you bought
  nothing**, sell land (you can never sell all of it — strictly less than you own); bushels to feed;
  acres to plant.
- Planting needs ½ bushel of seed per acre, and fewer than 10 acres per person (strictly less than
  10 × people).
- Any negative number ends the game at once (the steward walks out).
- Yield is random 1–5 bushels per acre planted.
- Rats: a random 1–5; on an even roll (2 in 5) rats eat stores ÷ that roll (a half or a quarter), after
  seed is taken, before the harvest is added.
- Newcomers: computed from a fresh 1–5 roll × (20 × acres + grain in store) ÷ people ÷ 100, plus 1.
- Each person needs 20 bushels; people fed = bushels ÷ 20 (rounded down).
- Plague: confirm the 20% versus the comment's 15%; it halves the population after newcomers arrive.
- Deposed: more than 45% of the population starves in one year.
- End of term after year 10: average yearly % starved and acres per person; four tiers with thresholds
  (33% / 7 acres; 10% / 9; 3% / 10). The worst tier reuses the deposed ending.
- The averaging bug (§1): confirm precisely, including what happens when food exactly equals the need.
- Note other quirks you find (e.g. a variable reused for unrelated things, the "C=0" lines that do
  nothing, the start claiming 10 acres per person).

## 3. Game design

### 3.1 The model (normal rules)

Keep the original model and numbers exactly, with these changes, each listed in CHANGES-FROM-ORIGINAL:

| Change | Why |
|---|---|
| Buying and selling land in one year: still one direction per year, but the UI makes it a single signed "land change" so it never feels like a skipped question | Clarity |
| Averaging bug fixed: every year counts | Fairness |
| Negative input impossible (controls clamp) | Direct manipulation |
| Everything else identical: ranges, probabilities, order of events, thresholds | It is a classic; balance is part of its soul |

All randomness goes through forked rng streams (`land-price`, `yield`, `rats`, `newcomers`, `plague`) so
replays and the daily scenario are exact.

### 3.2 Honest forecast (the ledger)

Before "End the year", the right panel shows, from the kit's `forecast`:

| Line | Kind |
|---|---|
| People fed / people | exact |
| Seed needed, workers needed vs available | exact |
| Harvest range (planted × 1 … × 5) with the five outcomes as a small bar | exact range, equal odds |
| Rats: "2 in 5 years; take ½ or ¼ of what's left in store" with the bushels at risk | exact odds |
| Fever (our word for the plague on screen): "1 in 5 years" (or "not this year" in year 1) | exact odds |
| Newcomers: range from the five rolls | exact range |
| Hunger warning: if more than 45% would go hungry, a calm red line "This decree would end your rule" | exact |

Forecasts can be hidden in settings for purists (kit setting).

### 3.3 Modes

| Mode | What it is |
|---|---|
| **Classic Term** | 10 years, normal rules. |
| **Daily scenario** | The kit's daily seed; same world for everyone; first attempt counts for the share. |
| **Scenarios** (6) | Our own curated starts, each a tweak of the start state or of one probability: **Dry Decade** (yield 1–3), **Crowded Gate** (300 people, same land), **Year of Rats** (rats 3 in 5), **Land Fever** (price 10–40, volatile), **Thin Inheritance** (500 bushels), **Generous Delta** (yield 3–6, fever 1 in 3). Tune with bots so each is winnable at the top tier by a good bot in ≥10% of seeds. |
| **Dynasty** | 30 years as three rulers in a row; each term is judged; the heir inherits the city; the Chronicle shows three registers on one stele. |
| **1978 Ledger** | The original rules exactly, quirks included (one-direction land question flow, the averaging bug, negative input ends the game). Input is a typed teletype panel over the same living diorama (§6.4). Its own milestones and its own Codex entry for the averaging bug. |

### 3.4 Endings and verdicts

Four tiers for a completed term, same measures and thresholds as the original, **our own words and our
own metaphors** (no historical rulers' names). Plus the deposed ending (> 45% hungry in a year) and the
"ten quiet years" special when nobody went hungry and acres per person ≥ 10. Write the tier names and two
lines of verdict copy for each; keep it warm and a little witty, all-ages.

### 3.5 Legacy integration

- **Epithet rules** (at least 10), e.g. never a hungry person; land doubled; survived three fevers; never
  bought land; ended with more grain than you started; rats never got a bushel (lucky or careful?).
- **Milestones** (~15) across Stewardship / Insight / Curiosity, including: finish a term; top tier; top
  tier on Dry Decade; see all five yields (Insight); meet rats, fever and newcomers in one term; finish
  Dynasty; find the averaging bug in 1978 Ledger; win a term without ever selling land.
- **Codex** (~10 entries): the five harvests, rats, fever, newcomers, the land market, the seed rule, the
  worker rule, hunger, deposition, the generosity paradox (1978 only). Each entry, once seen 3 times,
  reveals the exact rule in plain words and numbers.
- **Daily glyphs**: one per year — 🌾 good harvest (4–5), 🌱 poor (1–2), 🐀 rats, 🌫️ fever, 🏮 newcomers
  wave (top quintile), ⚖️ quiet. Show at most one per year by priority: fever > rats > harvest.
- **Share string** example (the kit's format):
  `One More Year · Ten Harvests #12` / `🌾🌱🐀🌾🌾🌫️🌾🌾🏮🌾` / `Fed 100% · 11.2 acres/person · "Keeper of Full Granaries"`

### 3.6 Content

Hunger and fever are part of the model and stay honest in numbers and words ("went hungry", "were lost to
the fever"). Visuals stay gentle: lamps go out, houses fall quiet, a haze passes — never bodies, never
suffering shown. No assassination jokes; deposition is a dignified exit with a dry, kind line.

## 4. Interaction

The plan screen (strict grid, see §5.3) has three ways to decide, all bound to the same plan draft and
always in sync:

1. **The grain budget bar** (the heart of the game). One horizontal bar = all grain in store. Three drag
   handles split it into **land** (coral) · **food** (amber) · **seed** (green) · **keep** (neutral,
   the remainder). Dragging a handle moves grain between the two neighbours; the diorama reacts within one
   frame (sacks slide out of the granary toward the market, the houses or the fields). Hover/focus on a
   segment shows its exact bushels and what it buys ("feeds 118 people", "seeds 900 acres").
2. **Direct manipulation in the diorama.** Drag the **field boundary** (a glowing handle on the edge of the
   owned land) outward to buy or inward to sell; parcels light up with the price and snap to 10-acre
   steps; Escape or dropping back on the start cancels. Click a field parcel to toggle planting it; drag
   across parcels to paint planting on or off.
3. **Steppers** in the decree tablet for keyboard and precision: land ±1/±10/±100, food in people
   fed (±1/±10), planting in acres (±10/±100). Typing a number into any field is allowed.

Constraints are shown, never sprung: the planting slider carries marks for "seed limit", "workers'
limit" and "land owned"; the land handle stops at what grain can buy and at "keep at least one acre".
An illegal action gets a gentle shake and a one-line reason next to the control — never a modal.

**End the year**: a single primary button (Enter). If the decree would end your rule, the button reads
"End the year anyway" and needs a second press. No undo after commit.

**The classic shortcut:** pressing **T** opens the scribe's console — a typed prompt that asks the four
questions in order, for players who want the 1970s rhythm in any mode.

## 5. Screens

1. **Game menu** — "← Back to the Hall" top-left; the city diorama slowly circling at the hour of the
   current appearance; title, tagline; Begin (Classic) · Daily scenario · Scenarios · Dynasty · 1978
   Ledger · Continue (if a run is in progress) · How to play · Codex · Settings.
2. **Tutorial** (first run, skippable, under 90 seconds): the scribe walks through one year with the
   budget bar and the field handle; the year passes in "quick" speed; done.
3. **Plan** — strict 12-column grid at 1920×1080: decree tablet (3 columns, left), diorama (6 columns,
   centre, full height), honest ledger (3 columns, right); top bar with "Year 4 of 10" and the pause
   button ("Esc"); bottom: the ten-year strip (one tile per year with its glyph, the current year
   outlined, future years empty). At 1280×720 the panels narrow but the diorama keeps at least 50% of
   the width. Ask for an automated layout test of panel alignment.
4. **The Year Turns** — the cinematic (§6.2), skippable with Space/click; speed setting.
5. **Report** — the scribe's clay tablet slides up over the diorama's lower third: the year's events in
   order with numbers and deltas (kit events), "New in your Codex" cards, "last time" ghost comparison on
   replays. Continue (Enter).
6. **End of term** — the Stele (§6.3) is carved, then the kit's chronicle page (`presentation: 'game'`
   for the stele, still reporting to the kit): verdict, epithet, timeline, key moments, charts with ghost,
   milestones and codex unlocked. Play again (R) · Replay this world · Game menu · Back to the Hall (H).
7. **Deposed** — a short, dignified sequence (the city at dusk, the palace lamps dim one by one), then the
   same chronicle page.
8. **Scenarios** — six cards with a small live diorama preview each, twist in one line, best verdict.
9. **Dynasty interludes** — between terms: the old ruler's register is carved, the heir's year 1 begins.
10. **1978 Ledger** — §6.4.
11. **Pause** — Resume · Scribe's console · How to play · Settings · Game menu · Back to the Hall.

## 6. Art direction — "Two Rivers"

The owner wants this game to show what code-drawn graphics can do. Treat every frame as a possible
README hero image. Zero raster: geometry, shaders, SVG; all procedural.

**Rendering:** three.js (lazy-loaded, its own chunk), custom GLSL shaders, `InstancedMesh`. UI panels in
DOM/SVG over the canvas. Write an ADR. Budget: 60 fps at 1920×1080 on a mid-range laptop integrated GPU;
an automatic quality ladder (wheat density, shadow resolution, water reflections, post effects) that
steps down when frame time exceeds budget and back up when it recovers, plus a manual "Graphics: high /
balanced / light" setting.

### 6.1 The city

A stylised, low-poly-but-rich Mesopotamian riverside city seen from a three-quarter view, gently
orbitable (drag with right mouse or two fingers; keyboard Q/E), always readable:

- **The river** — a water shader with slow flow, sky reflection, foam at the banks, and the seasonal flood
  that spreads a silver sheet over the fields.
- **The fields** — real parcels whose count equals owned land (one parcel per 10 acres, procedurally laid
  out along irrigation canals so 500 or 3,000 acres both look natural). Planted parcels hold **GPU-instanced
  wheat**: up to ~250,000 blades at high quality, each with its own height and phase; a wind-wave shader
  rolls visible gusts across the whole plain. Unplanted owned land is dark tilled earth; land for sale at
  the field edge is pale scrub.
- **The granary** — a cutaway mud-brick granary whose grain fill is a real heightfield surface that rises
  and falls with grain in store; sacks for the budget bar slide along a ramp.
- **The houses** — mud-brick blocks with flat roofs, palms, a ziggurat on the skyline. Population is
  visible: in light, little figures in fields and lanes (one per 10 people, simple animated rigs or
  procedural stick-figure meshes); in dark, **one lit window per 10 people**.

### 6.2 Signature moment 1 — The Year Turns (8–12 s, skippable; speeds: cinematic / quick 3 s / instant)

The camera glides low over the plain while a year passes in one breath: the flood shimmers over the
fields and recedes → seed arcs from baskets in golden particles → the planted wheat **grows from bare
earth to green to gold** with wind waves running through it → the harvest sweeps across the fields and
flows as a **river of grain particles** into the granary, whose fill visibly rises while a counter ticks
→ if rats come, a playful swarm (boids, not gross) pours over the granary roof and the fill drops →
newcomers arrive along the road as a procession (lanterns in dark) → if fever comes, a violet haze drifts
through the lanes and lamps or figures thin out house by house → hungry people: lamps go out quietly.
The yield's five outcomes must look clearly different (sparse and pale at 1, dense, tall and burnished
at 5). Sound: a synthesised swell rising with the wheat, a soft rush of grain, a scatter of tiny feet.

### 6.3 Signature moment 2 — The Stele

At the end of a term a dark basalt stele stands in a raking light and **carves itself**: one horizontal
register per year, left to right, with relief motifs generated from that year's events (wheat sheaves sized
by yield, the granary level, rats, the fever haze as spiral marks, lantern rows for newcomers, a closed
door for the hungry), a header register with the epithet as an ornamental band (our own pseudo-script
pattern, never real cuneiform signs that could be misread), and the verdict at the foot. Use a
displacement/normal-mapped relief generated procedurally per run. The light sweeps across as each register
is cut. Drag to rotate; it settles back. For Dynasty: three steles side by side. Export a 2D SVG rendering
of the stele for the kit's share card.

### 6.4 1978 Ledger look

A teletype paper panel (continuous fanfold, faint green bars, typed monospace text appearing character by
character with a soft synthesised clatter) docked where the decree tablet usually sits, while the living
diorama keeps running beside it. Our own wording for every prompt; no original strings.

### 6.5 Appearances

| | Light — Noon on the Euphrates | Dark — A Thousand Lamps |
|---|---|---|
| Sky / light | High sun, warm haze, crisp long shadows late in the turn cinematic | Indigo sky with stars, a low moon, a soft blue fill light |
| Palette | Sun-baked ochre mud-brick, lapis-lazuli blue accents, turquoise river, gold wheat | Deep blue mud-brick, warm amber window light, silver-blue wheat, moon path on the river |
| People | Figures in fields and lanes | One lit window per 10 people; lantern processions |
| UI panels | Warm clay paper, lapis ink, terracotta for warnings | Dark clay, ivory text, amber highlights, lapis outlines |

Readability first: panels sit on opaque surfaces with AA contrast; the diorama never sits behind text.
Reduced motion: no camera glides, the cinematic becomes three still cross-faded beats, wind waves calm,
the stele appears carved with a single light fade.

### 6.6 Demo for the Hall

`demo(seed)`: the diorama in a fixed calm camera, a built-in steady bot playing a year every ~3 s in
"quick" speed, emitting the three signals; cheap mode (low wheat density, no shadows), silent, pauses
off-screen, draws in the given appearance.

## 7. Settings

Graphics quality · Year cinematic speed (cinematic / quick / instant) · Forecasts shown/hidden (kit) ·
Advisor hints on/quiet/off (kit) · Camera orbit on/off · plus the kit's global settings.

## 8. Controls

| Action | Mouse | Keyboard |
|---|---|---|
| Move grain between uses | Drag budget bar handles | Tab to a handle, ← → (Shift ×10) |
| Buy / sell land | Drag the field boundary handle | L then ← → (Shift ×100) |
| Plant / unplant parcels | Click or drag-paint parcels | P then ← → (Shift ×100) |
| Feed people | Budget bar or stepper | F then ← → (Shift ×10) |
| End the year | Button | Enter |
| Skip cinematic | Click | Space |
| Scribe's console (typed 1970s prompts) | — | T |
| Orbit camera | Right-drag | Q / E |
| Pause | Pause button | Esc |
| Play again / Back to the Hall (results) | Buttons | R / H |

## 9. Engineering and tests

- Folder: `games/ten-harvests/` with `src/engine` (pure TS, no DOM), `src/scene` (three.js), `src/ui`
  (DOM/SVG panels), `src/lib`, `tests`, `docs`.
- Engine: the normal model and the 1978 model share one core with an explicit `rules: 'normal' | '1978'`
  switch; every difference is one named function, tested both ways.
- **Original-fidelity tests:** for 1978 rules, write a small reference implementation from your NOTES
  description (not by translating the BASIC line by line) and check 10,000 seeded years against
  distribution targets: land price uniform 17–26; yield uniform 1–5; rats 40% with ½ / ¼ split; plague
  rate (whatever you verified); newcomer formula; the averaging bug reproduced.
- **Balance with bots** (record in NOTES.md, lock as tests with tolerances): a naive bot (feeds all,
  plants max), a careful bot, a greedy land bot, a random bot. Targets for Classic: careful bot reaches
  the top tier in 25–45% of seeds, is deposed in < 2%; naive bot deposed in < 10%. Each scenario: careful
  bot top tier in ≥ 10% of seeds. Dynasty: careful bot finishes all three terms in ≥ 70%.
- Determinism: replay a whole run from seed + plans and match every signal; daily scenario identical
  across two browser contexts.
- Scene tests: parcel count matches land; window count matches people ÷ 10 (rounded); granary fill
  matches store within 1%; quality ladder steps down under a simulated slow frame budget.
- Playwright (game-scoped config, port 5480): Classic full run by mouse only and by keyboard only; the
  scribe's console run; a deposed run; Daily; one scenario; Dynasty interlude; 1978 Ledger incl. finding
  the averaging bug; resume after reload on the plan screen; replay with ghost; every navigation exit.
  Screenshots at 1280×720 and 1920×1080 in light and dark of: menu, plan, mid-cinematic (yield 1 and
  yield 5), rats, fever, report, stele, chronicle, 1978 Ledger. Measure fps during the cinematic and
  record it.

## 10. Staged workflow (with an owner checkpoint)

1. **Hero frames — OWNER CHECKPOINT.** Build the minimum engine and scene to render live, not mocked:
   (a) the plan screen at noon with a golden field and the budget bar mid-drag, (b) the harvest moment of
   the cinematic — grain river into the rising granary, (c) the finished stele in raking light — each in
   light and dark at 1920×1080 (six frames), plus (d) the city at night with lamps and a lantern
   procession. At least **five** critique rounds against "would this stop someone scrolling on social
   media?" and "would this be the README hero image?". Save to `games/ten-harvests/docs/media/hero/`;
   **STOP and tell the owner.** Do not continue without approval.
2. Engine (both rule sets), NOTES.md with verified facts, bots and balance → tests.
3. Wireframes of all screens with full input (budget bar, field handle, steppers, console).
4. Art pass: city, river, wheat, granary, houses, appearances, quality ladder.
5. Cinematic, report, stele, deposed sequence.
6. Modes: Daily, Scenarios, Dynasty, 1978 Ledger; tutorial.
7. Sound and feel.
8. Critique loop (≥ 3 rounds, both appearances, both resolutions).
9. Hall integration, docs, final checks.

## 11. Documentation

ABOUT (brochure: the 1968 game, the 15% vs 20% fever, the generosity paradox, what is new), HOW-TO-PLAY
(controls table, the three numbers, one year step by step, reading the ledger, modes, verdicts,
milestones, Codex, tips), ARCHITECTURE (engine and both rule sets, rng streams, the scene graph and
shaders, where each visual and sound is defined and how to tune it, quality ladder, tests),
CHANGES-FROM-ORIGINAL, NOTES — Mermaid diagrams only (at least: one-year flow, engine state machine, scene
module map). ADR for rendering. README entry via the docs script. PROGRESS row.

## 12. Content rules

All copy is ours: scribe lines, verdicts, epithets, codex text, tutorial. Warm, plain, a little dry humour,
all-ages. Run the provenance scan against `E:\Projects\simulation\src` before finishing. Historical
setting kept light: "a city on the Euphrates"; no claims of historical accuracy beyond the About facts.

## 13. When you finish

Reply with: what you built; the verified facts (plague rate, the averaging bug and its exact behaviour,
any other quirks); bot balance numbers; fps measured during the cinematic at each quality level;
deviations and why; known gaps; kit changes (with ADRs) or kit candidates; exact commands to run it.

## 14. Hall integration

Manifest: id `ten-harvests`, title, tagline and teaser from §1, domain `governance`, turnUnit `year`,
typicalTurns [10, 30], players `1P`, sessionMinutes [10, 20], accents (lapis/gold, light and dark), an
emblem as SVG path data (a wheat sheaf crossing a wavy river line, 24×24), `inspiredBy` { originalTitle:
"Hamurabi", uiTitle: "the 1968 grain-and-land simulation", year: 1968, credit: "Doug Dyment; BASIC
version by David H. Ahl" }, `hasDailyScenario: true`, the six scenarios, signals people / grain / acres.
Replace the coming-soon placeholder manifest for `ten-harvests` explicitly; re-read the registry first and
change only that entry. Results through the kit with `presentation: 'game'` for the stele; chronicle,
codex, milestones, daily share and pause items through the kit. Status `playable` only when all checks
pass.

## 15. Parallel session rules

This prompt runs alone. Stay in `games/ten-harvests/` except the final registry entry, README via the docs
script and your PROGRESS row. Kit changes only per §0.1. Ports 4480 / 5480. Game-scoped Playwright
config. No commits, no pushes.
