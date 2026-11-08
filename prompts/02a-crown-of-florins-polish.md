# Prompt 02a — Crown of Florins: polish (architect review of the prompt 02 hero frames)

> Run in Claude Code from `E:\Projects\simulation\web`, ALONE, on top of the current, uncommitted working tree
> of prompt 02. This is an addendum, not a rewrite: keep the engine, economy, AI rivals, modes, tests and
> everything that already works. Recommended: Opus 5.5, effort **xhigh**. Do not trim scope to save time.
> **Owner checkpoint:** stage 1 ends with before/after hero frames; STOP there and wait for the owner.

## 0. Read first

1. `CLAUDE.md`, `.claude/skills/retro-reborn-builder/SKILL.md`, `prompts/02-crown-of-florins.md` (still
   binding; this prompt overrides it only where it says so), and the game's docs:
   `games/crown-of-florins/docs/` (ARCHITECTURE, NOTES, both ADRs).
2. The eight current hero frames in `games/crown-of-florins/docs/media/hero/`. Copy them first to
   `games/crown-of-florins/docs/media/hero/before/` — they are the "before" for this review.
3. Your first reply: five-line summary of the hard rules, names this prompt, confirms you work on the existing
   working tree, states ports **4481 / 5481**, and lists which of the findings in §2 you can already confirm
   from the code (file and line).

## 1. The verdict in one paragraph

The interface and the glass-box data design are strong: the year screen's grid, the twelve-pillar Road to the
Crown, Border Watch, the rival bar and the illuminated obituary all work and stay. The game's headline visual
promise does not yet land. The city and the valley read as a clean **low-poly 3D render with outlines**, not a
fresco; the coronation reads as a **sepia/yellow filter**, not gold leaf. Several artefacts and layout faults
would embarrass a README hero image. Fix those, raise the art to the bar of prompt 02 §6, and fix three logic
and UI-truth issues.

## 2. Findings to fix (from the architect's review of the eight frames)

| # | Severity | Finding | Where |
|---|---|---|---|
| 1 | Critical | Not a fresco: almost no plaster grain, brushwork, pigment bleed or hand-drawn edge; shapes are flat-shaded polygons with uniform outlines. Fails "painted, not filtered". | Year, Valley |
| 2 | Critical | Mountains are stepped "layer-cake" contour bands, identical and repeated across the horizon. | Year, Valley, Coronation |
| 3 | Critical | Gold leaf reads as a monochrome yellow tint: no metallic specular, no leaf sheets, no glint, and every original colour is lost. | Coronation |
| 4 | High | Artefacts: a faint square checkerboard pattern in the sky; white cloud blobs clipped at the frame corners; a stray plank/bridge mesh overlapping Lucemara at the river. | Coronation, Valley |
| 5 | High | Valley dark is too dark: land near-black, field patches muddy, cities barely separate from ground. | Valley dark |
| 6 | High | The invasion is not a signature moment yet: one short, small column. | Valley |
| 7 | High | Layout overflow at 1920×1080: "The Realm" card (left) and the bottom card of the right column are cut off by the rival bar. | Year |
| 8 | Medium | Panel headings set the initial in a separate box with a gap, so they misread ("B ORDER WATCH" reads as "ORDER WATCH", "P REVIEW OF THE YEAR" as "REVIEW OF THE YEAR"). | Year |
| 9 | Medium | Two primary "Seal the year" buttons (top bar and Builders panel). | Year |
| 10 | Medium | Truth in the UI: "Title after the review: 6" shows a number, not the title; "Treasury at the year's end: 13,169 fl in every trial year" sits next to "treasury after the plan 1,107 fl" without explaining the difference; two rivals already show **Re** while the human plays on, and nothing on screen says the crown has been won by someone else. | Year |
| 11 | Low | Obituary (light): flat gradient parchment, no vellum grain; marginal quatrefoil scenes are simple clip-art shapes. | Obituary |

## 3. Art direction — what "Affresco" must look like

Zero raster still applies: every texture, stroke and leaf is procedural. Keep three.js and the existing scene
graph; rebuild the look in the post-process and in the materials. Record the changes in the rendering ADR.

### 3.1 The fresco pass (findings 1, 2)

A frame should look like a wall painting photographed in good light, not a 3D render with a filter.

| Layer | Requirement |
|---|---|
| Pigment palette | Map final colours to a limited earth palette (lime white, raw/burnt sienna, yellow ochre, terre verte, lapis, vermilion, umber, ivory black) with soft quantisation, so colours look mixed from pigments, not RGB. |
| Brushwork | Directional, visible strokes that follow the form: a structure-tensor guided (anisotropic) Kuwahara or stroke-based pass with stroke length driven by distance and surface orientation (long strokes in fields and sky, short in architecture). Strokes must be visible at 100% zoom on a 1920×1080 frame. |
| Plaster | Procedural *intonaco*: fine grain, faint trowel marks, a few hairline cracks, slight unevenness of tone; multiplied under the paint, stronger in shadows and at the frame edge. |
| Edges | Hand-drawn contour: line weight varies along the edge (pressure noise), occasionally breaks, slightly offset from the colour fill; outlines from depth/normal/ID edges but never uniform-width. |
| Pigment bleed | Colours bleed a few pixels past edges and pool at strong contrasts, as wet-on-wet painting does. |
| Light | Painted light, not shaded light: soft lambert ramps quantised to 3–4 values per pigment; warm highlights, cool shadows. |
| Mountains | Rebuild the hills: no stepped contour bands. Rounded, varied Tuscan-fresco hills (stylised "cushion" hills with cypress and olive dots), each hill unique from a seed, with painted ridgelines and atmospheric fade to blue-grey in the distance. Same treatment in the valley and behind the coronation. |
| Sky | Painted gradient with visible strokes; clouds as painted, rounded forms fully inside the frame (no clipping at corners). |

Ask yourself at every critique: "would a viewer believe this was painted by hand on a wall?" If any part still
reads as polygons, it is not done.

### 3.2 Gold leaf (finding 3)

Gilding must read as **metal applied over paint**, not a colour grade.

- **Leaf sheets**: gold is laid in square-ish sheets with slightly irregular, overlapping edges and faint seams
  (procedural sheet grid with jitter and per-sheet tone variation); the crackle mask stays but becomes finer and
  sits within sheets.
- **Metallic response**: view-dependent specular with an anisotropic sheen; a slow **glint sweep** travels
  across the gilded areas; bright spots catch the light, recesses go deep amber-brown.
- **What gets gilded**: architecture, walls, roofs, the crown, banners' edges, the frame — gilding spreads
  outward from the palace crown as before. The fields, the river and the sky stay painted (warm-shifted), and
  vermilion and lapis must show through in gaps and on banners. Gold must sit next to colour to look rich.
- **Petals**: real petal shapes (five-petal blossoms and single rose petals) that tumble with rotation and
  catch light, in vermilion, rose and white.
- Remove the checkerboard artefact at its source (finding 4).
- Light and dark must both read as gold; dark is lit by torches, so gold glows warm with deep shadows.

### 3.3 The valley (findings 4, 5, 6)

- Fix the Lucemara bridge/plank overlap and the clipped clouds.
- **Dark appearance**: a moonlit painted night, not black. Raise land values, keep fields distinguishable by
  hue, add a soft moon glow and torch-lit city halos so every city reads as a warm island; check that each
  city, road and label is legible at 1920×1080 and 1280×720.
- Cities differ in size and silhouette with their state (walls, cathedral stage, towers).
- **Invasion as a signature moment** (prompt 02 §6.4, now raised): the attacker's column is long and dense
  (instanced soldiers proportional to soldiers sent, with pennants and dust), it marches the whole road; the
  defenders form up at the walls; the clash is a stylised swirl of pennants, dust and painted spear-lines;
  the result is lettered on a ribbon and the loser's banner dips. Still no gore. Camera eases toward the clash
  and back (reduced motion: a still sequence of three painted beats).

### 3.4 Obituary (finding 11)

Light appearance: procedural vellum (fibre grain, faint follicle speckle, slightly darker edges, a soft cockle
in the light). Marginal quatrefoil scenes become small painted miniatures in the fresco language (the same
pigment palette and brushwork at miniature scale), generated from the event they depict, with gold-leaf
backgrounds using the §3.2 material. Keep everything else.

## 4. Year screen fixes (findings 7, 8, 9, 10)

1. **Overflow**: at 1920×1080 and 1280×720 every panel is fully visible above the rival bar. Long columns
   scroll inside their panel (with a visible scroll affordance) or collapse secondary cards into tabs. Add an
   automated layout test: no panel's bounding box intersects the rival bar or the viewport edge, at both sizes.
2. **Headings**: in UI panels, drop the boxed initial; use small caps with a coloured first letter set inline,
   no gap. Keep illuminated initials for the obituary and chronicle only.
3. **One primary action**: "Seal the year" lives in one place — the top bar, with the Enter hint. The Builders
   panel ends with its total line only.
4. **Truth in the UI**:
   - Title review shows the title by name and the change ("Granduchessa → stays", "→ Principessa").
   - Treasury: one consistent model on screen — "after this plan" (now) and "expected at year's end"
     (after income, upkeep and interest), each labelled, with a hover breakdown. The phrase "in every trial
     year" is replaced by an honest range or an exact number from the forecast.
   - **When a rival is crowned**: the whole table is told at once — a herald's announcement in the valley
     interlude, a persistent ribbon in the top bar ("Roccaventosa crowned Re Alessio, 1449"), the rival bar
     marks the winner, and the human gets a clear choice: *Play on for your own chronicle* or *End here and see
     the chronicle*. Verify the engine's end-of-race rule (prompt 02 §3.7) and make the UI match it exactly;
     explain in NOTES how a second rival can also become Re after the race is won, and whether that is intended.

## 5. Staged workflow

1. **Before/after hero frames — OWNER CHECKPOINT.** Re-render the same eight frames (year, valley, coronation,
   obituary × light, dark) from the same seeds, plus (i) a 100% crop of a fresco area showing brushwork and
   plaster, (ii) the coronation mid-glint, (iii) the invasion clash in the valley, light and dark. Critique at
   least **five** rounds against: "would a viewer believe this is hand-painted?", "is the gold metal?", "would
   this stop someone scrolling?", "is it unmistakably different from Ten Harvests?". Save to
   `games/crown-of-florins/docs/media/hero/` (the before set stays in `before/`). **STOP and tell the owner.**
2. After approval: apply the look to every scene and screen (menu, court setup, the five steps, harvest beat,
   title review, chronicle thumbnails, Hall demo), year-screen fixes (§4), obituary (§3.4).
3. Performance: re-measure fps in the valley, the invasion and the coronation at each quality level; the
   quality ladder must keep 60 fps at 1920×1080 on a mid-range laptop. Brush and plaster passes need their own
   steps on the ladder.
4. Critique loop (≥ 3 rounds), screenshots at 1280×720 and 1920×1080 in light and dark of every screen listed
   in prompt 02 §10.
5. Tests: existing unit and e2e tests stay green; add the layout test (§4.1), a test that the title review shows
   a title name, a test for the rival-crowned announcement and the player's choice, and a scene test that no
   geometry in the valley overlaps a city footprint (the bridge bug).
6. Docs: update ARCHITECTURE (fresco pipeline passes, gilding material, how to tune each), the rendering ADR,
   CHANGES (nothing about the original changes), NOTES (end-of-race rule), and the PROGRESS row once at the end.

## 6. When you finish

Reply with: before/after summary per finding (#1–#11) with the file(s) changed; fps per scene and quality
level; what the end-of-race rule is and how the UI now presents it; deviations and why; known gaps; exact
commands to run. No commits, no pushes. Ports 4481 / 5481. Stay in `games/crown-of-florins/` except the
PROGRESS row.
