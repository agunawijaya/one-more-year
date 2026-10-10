# ADR-0002: The simulation contract

- Status: accepted
- Date: 2026-10-09

## Context

Every simulation in the collection plugs into the same Hall, the same Legacy system and the same
chrome. Simulations are written by different sessions, one at a time, long after the Hall exists.
The contract has to be small enough to learn from one example (the Pond fixture), strict enough that
the Hall can draw a world it has never loaded, and generous enough that a simulation keeps full
control of its own screens. It lives in `packages/kit/src/contract.ts`.

## Decision

A simulation is a folder `games/<id>/` with two entry points.

```mermaid
flowchart LR
  subgraph games/id
    manifest[manifest.ts<br/>SimManifest · plain data]
    module[src/index.ts<br/>SimModule · lazy chunk]
  end
  manifest -->|eager, at start-up| registry[Hall registry]
  registry --> themes[Themes draw the catalog]
  module -->|import() when opened<br/>or demo in view| stage[Hall stage]
  stage -->|SimContext| module
  module -->|SimInstance| stage
  module -->|demo: DemoHandle| themes
```

**`SimManifest`** is what the Hall needs without loading code: id, title, tagline, teaser, domain,
turn unit, typical turns, players (`1P` or `1–6P` hot-seat), session minutes, status
(`playable` or `coming-soon`), accent for light and dark, emblem (24×24 SVG path data),
`inspiredBy` (original title, generic UI title, year, credit), whether there is a daily scenario,
scenarios, 2–4 **signals** and optionally which signal leads (`primarySignal`).

**Signals** (`SignalDef`) are the headline numbers a world produces: id, label, unit, number style
and whether higher is better (or neither). They feed the Situation Room's sparklines through the
demo, the chronicle charts, the ghost overlay, the share string's numbers and the Continue cards.

**`SimModule`** is the code: the manifest again, a short How to play, milestones, codex entries,
the save format (version and migrations), an optional ambience bed, `mount(host, ctx)` returning a
`SimInstance`, and `demo(host, seed, look)` returning a `DemoHandle`.

**`SimContext`** is everything the Hall gives a mounted simulation: the manifest and the launch
(menu, new with scenario and seats, resume, daily, replay of a chronicle), audio, global settings
plus the simulation's own namespace, the appearance feed with change events, its run store, its
milestones and codex, today's daily info, the seats helper, the Hall's clock, `reportTurn`,
`reportRun` (with `presentation: 'hall' | 'game'`), `markDailyPlayed`, `share`, `setView`,
`setPauseItems`, `openSettings`, `openHowToPlay`, `forgetData` and `navigate`.

**`SimInstance`** answers the chrome: `pause`, `resume`, `gameMenu`, `leaveCheck`, the optional
`keepDraft` (keep a half-edited plan when leaving) and `dispose`.

**`DemoHandle`** streams `DemoFrame`s (cycle, turn, signals, tone, events) to subscribers, redraws
in a new look without restarting (`setLook`) and stops on `dispose`. `createModelDemo` builds one
from the simulation's own `TurnModel`, a bot and a renderer, so the demo is the real model playing
itself, at about one turn every 2.5 seconds.

Most simulations will not drive the contract by hand: `startPlay(ctx, rules, launch)` in
`session.ts` wires the turn engine to runs, autosave, turn reports, codex sightings, forecasts,
ghosts, the chronicle and automatic milestones (ADR-0006).

## Refinements to the starting sketch

| Change                                             | Why                                                                                                                                  |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `Launch` passed in the context                     | The Hall decides from the URL whether this is a resume, a daily, a replay or a new run; the simulation does not parse URLs.          |
| `howToPlay`, `saves`, `ambience` on the module     | The pause menu, run migrations and the Terrarium's hover sound all need them before the simulation is mounted.                       |
| `AutoMilestoneDef` (`atRunEnd`, `codexDiscovered`) | Most milestones are conditions over a finished run or codex counts; the session checks them so every simulation gets them right.     |
| `keepDraft()` on the instance                      | Leaving with an edited plan offers to keep it as a draft (ADR-0005).                                                                 |
| `setView(view, runId)`                             | The address bar can resume the exact run after a reload.                                                                             |
| `DemoContext` is a `DemoLook`                      | A demo needs the appearance, the theme's drawing style (engraving, instrument, diorama), a palette and reduced motion; nothing else. |
| `primarySignal`                                    | The Hall needs one number to lead with on cards and sparklines.                                                                      |

## Consequences

- The Hall can draw a coming-soon world from its manifest alone; building it later replaces the
  placeholder by id without touching the Hall.
- A simulation never draws its own pause menu or exits; it supplies items and reports views.
- Changing the contract touches every simulation, so it needs an ADR and a version note in this file.
