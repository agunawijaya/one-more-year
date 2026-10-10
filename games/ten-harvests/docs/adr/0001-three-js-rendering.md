# Ten Harvests ADR-0001: The city and the stele in three.js

- Status: accepted
- Date: 2026-10-10

## Context

Ten Harvests is the collection's showcase. Its one idea is that the original's three numbers can be
read as a place: a parcel for every ten acres, a lit window for every ten people, a granary that fills
with the store, and a year that happens in front of you. That needs depth and light (a low sun across
wheat, a night lit by windows and torches), thousands of moving blades, particles for the grain river
and the rats, and a carved stone in raking light. The collection allows SVG, Canvas 2D and WebGL; no
raster images, nothing fetched at runtime, and the page must stay usable on modest laptops.

Options considered:

- **SVG or Canvas 2D isometric drawing.** Light on dependencies, but lighting, shadows and the
  harvest's motion would all be faked by hand, and a few thousand animated blades are already heavy
  for Canvas 2D.
- **Raw WebGL2.** No dependency, full control, and a large amount of plumbing (scene graph, camera,
  instancing, shadow maps, post-processing) to write and test ourselves.
- **three.js.** A mature, MIT-licensed scene graph with instancing, shadow maps, an effect composer and
  `onBeforeCompile` hooks for custom shading; widely understood; tree-shakes to what is imported.

## Decision

Use three.js (r186, pinned in `games/ten-harvests/package.json`) for the city and the stele, and keep
everything else in the DOM:

- One `WebGLRenderer` for the city, shared by every screen that shows it (menu, plan, the year, report,
  dusk) by moving its canvas between hosts; the stele has its own small renderer.
- All geometry is built in code; all surfaces are shaders or vertex colours. The only textures are a
  `DataTexture` holding each parcel's state and the stele's height map, drawn on a canvas from the
  term's history. Fonts for the stele come from the Hall's self-hosted files.
- Custom shading through `ShaderMaterial` and `onBeforeCompile` (ground, water, sky, wheat, bricks,
  relief); post-processing through the effect composer (bloom, a one-pass tilt-shift, a finishing
  grade, the Hall's styles).
- A quality ladder (high, balanced, light) chooses blades per parcel, shadow map size, bloom,
  tilt-shift, multisampling and resolution, and steps down by itself when frames run slow.
- Panels, text and controls stay DOM and SVG, so they are accessible, themeable and crisp at any size.
  The engine never imports three.js; the scene reads the engine's numbers and nothing else.

## Consequences

- The production bundle for the game grows by the parts of three.js it imports (the renderer, a few
  materials, the composer and its passes). It is loaded only when the world opens or its demo comes
  into view, as for every simulation.
- A WebGL2-capable browser is required. Without a GPU the browser's software renderer still draws the
  same pictures, slowly: the view detects it (`src/scene/gpu.ts`), starts at light and renders at
  reduced resolution. The Hall's demo does not use WebGL there at all: it draws a flat Canvas 2D map
  of the same city (`src/scene/city-map.ts`), because compiling the city's shaders on a CPU held the
  Hall's home page for over a second at a time.
- Frame rates during the cinematic were measured on an RTX 4060 at 582 / 917 / 2054 fps (high /
  balanced / light) at 1280×720 and 352 / 514 / 1468 fps at 1920×1080, with the frame cap lifted (see
  ARCHITECTURE.md). Older integrated GPUs are expected to sit on balanced or light.
- The production chunk for the game is about 784 kB (217 kB gzipped), most of it three.js; Vite's
  size warning for it is expected.
- Shaders are compiled with `compileAsync` before the first frame, so opening the city or its demo does
  not hold the page while they compile (about a second on Direct3D otherwise).
- Shaders that sample inside loops or after a discard use explicit level-0 lookups, so Direct3D
  backends compile them without warnings.
- Scene tests run without a GPU: they build the world under happy-dom and read back parcel, window,
  figure and granary counts. The look itself is checked with screenshots at two sizes and both
  appearances (`e2e/shots/critique.spec.ts`).
