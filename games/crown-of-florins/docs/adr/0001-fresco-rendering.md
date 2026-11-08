# Crown of Florins ADR-0001: A living fresco, painted by a post-process

- Status: accepted (revised 2026-11-08 by prompt 02a)
- Date: 2026-10-13

## Context

The owner asked for this game to show what code-drawn graphics can do, and to look nothing like Ten
Harvests' realistic diorama: a Renaissance fresco that lives. A city-state has to grow wall by wall
from its numbers, the valley has to hold up to six cities and marching armies, a coronation has to
gild the whole painting, and all of it in light (buon fresco at noon) and dark (a night of
candles). Zero raster, nothing fetched at runtime, 60 fps at 1920×1080 on a mid-range laptop.

Options considered:

- **Painting in SVG or Canvas 2D.** Fully illustrative and resolution-free, but a city of hundreds
  of buildings that grows each year, with lights at night and an orbiting camera, would need a
  hand-written renderer of its own.
- **three.js with stylised materials only (toon shading).** Simple and fast, but it reads as a
  game, not a painting: hard edges, uniform fills, no plaster.
- **three.js through a fresco post-process.** Model the city as plain geometry, render it, then paint
  the result: brushwork, a limited earth palette, contour lines, lime plaster. The painting style
  lives in a few passes and one material, apart from the city generator.

The first version (prompt 02) took the third option, and the architect's review of its hero frames
(prompt 02a) found that it read as a clean low-poly render with outlines, not a fresco: an
anisotropic Kuwahara filter alone flattens colour but leaves no stroke a viewer can see; three bands
of Lambert shading still look like flat-shaded polygons; uniform outlines look drawn by a machine;
the hills were stepped contour bands; and the coronation's gold was a monochrome colour grade. The
revision below keeps the scene graph and rebuilds the look in the materials and the post-process.

## Decision

Use three.js (r186, as in Ten Harvests) for geometry and lighting, and turn every frame into a
fresco (`src/scene/fresco.ts`):

1. **Painted light** (`PAINTED_LIGHT` in `src/scene/glsl.ts`, used by every material): four soft
   values of each pigment, warm toward lime white in the light, cool toward a blue-grey earth in
   the shade, never black; walls graded darker toward their foot and brushed across, roofs
   brushed down the slope. By night the whole world is multiplied by a night tint and the lamps
   bring it back.
2. **A second render target** holds each surface's normal and, in its alpha, a class and an object
   id: 0 architecture (what the coronation gilds), 1 painted things that keep their colour (people,
   trees, awnings, banners' cloth, a share of the town's roofs, the cottages outside the walls),
   2 the land and the water, 3 the sky (its clouds and its moon carry their own ids).
3. **Flat mixtures**: a structure tensor, blurred, steers an anisotropic Kuwahara filter at a
   fraction of the screen's resolution.
4. **The brush** (`STROKES`): the picture is tiled with rows of daubs in ten directions; each pixel
   finds the stroke it lies in for the one or two directions nearest the flow there (the picture's
   own edges where it has them, the surface's contour where it has not, level strokes in the sky)
   and takes the one laid last. A stroke is one mixture, a touch lighter or darker, warmer or cooler
   than its neighbour, streaked by its bristles, tapering at its tail, and it never carries its
   colour across an edge. Strokes are long in the sky, broad in the near fields, finer toward the
   hills and short in the town; the moon is left as a clean disc.
5. **Composite** at full resolution: wet pigment bleeding a pixel or two past an edge and pooling on
   its darker side (from a quarter-size blurred copy of the strokes); every colour pulled toward
   the two nearest pigments on an eighteen-pigment shelf in Oklab, the darkest held a little open
   by day as lime cannot hold a true black; contour lines from normals, depth and ids whose
   width follows the hand's pressure along them (swelling and thinning within a few pixels), which
   break off now and then and thin with distance, with the red sinopia underdrawing a little off
   them; the intonaco multiplied in (sand grain and pits that show most in the thin paint of the
   shade, uneven tone, the trowel's sweeps, giornate seams, sparse hairline cracks, more of it
   toward the frame); the candle-smoke patina at night; and a painted Cosmati frame band.
6. **The hills** (`src/scene/hills.ts`) are rows of rounded cushions joined in soft saddles, each
   town's from its own name and the valley's from its seed, painted with small fields, olive
   groves in dotted rows and cypress flames, the far rows fading into a blue-grey air.
7. **The gold** (`src/scene/gilding.ts`) is a separate overlay reading the finished painting and
   its info target. It gilds the architecture and the frame only: square sheets of leaf a little
   askew with faint overlapping seams, a fine crackle with the red bole in its cracks, a body of
   deep amber rising to bright metal from the painted light and each face's turn toward the key
   light, the sky mirrored in faces that turn up to it, a bevel of light on edges turned to the
   light, a narrow streak of light travelling across the city, and single sheets flashing. Colour
   stays beside it: people, trees, awnings, banners' cloth, a share of the roofs and the cottages
   keep their pigments, and the land and the sky are only warmed.
8. The camera is a long lens at a high three-quarter view, solved analytically (`skylinePose` in
   `src/scene/view.ts`) so the crests of the back row of hills sit at the same height of the picture
   and the painted sky shows above them. The sky places its clouds (laid with the sky's own level
   strokes, soft-edged) and the moon in that band, so they always sit whole inside the frame.

One renderer is shared by every screen (`src/game/stage.ts`): it paints a realm's city or the
valley on whichever host the screen gives it.

## Consequences

- The look is the materials' and the post-process's concern: the city generator never thinks about
  painting, and the painting never thinks about cities. Tuning is described pass by pass in
  ARCHITECTURE.md ("The fresco").
- Shader colour constants must be linear values; the composite converts to sRGB.
- The strokes and the plaster are fixed to the picture, not to the world, as a painted wall is. A
  still picture reads as painted; while the camera moves (the valley's pull-back, the ease toward a
  clash) the colours under the strokes slide while the strokes stay, a soft shimmer. It is the
  price of a stroke pass with no world-space parameterisation, accepted because the camera moves
  only in short eased beats and not at all under reduced motion.
- A WebGL2-capable browser is required. The Hall's demo uses the fresco only in the diorama style and
  with a GPU; otherwise it draws the valley as an SVG map in the theme's colours
  (`src/scene/valley-map.ts`), because compiling the fresco's shaders on a CPU would hold the Hall's
  home page.
- The quality ladder (high, balanced, light) changes the brushwork's resolution and Kuwahara radius,
  how many stroke directions cross at a pixel (two, or one on light), how much of the plaster is
  painted (all of it, or the grain alone on light), the shadow map, the crowd share and the render
  resolution, and steps down by itself after two seconds of slow frames. Frame rates measured at
  each level are recorded in ARCHITECTURE.md.
- Scene tests run without a GPU: they read the city plan back (walls, stalls, cathedral stage,
  palace pieces, mills, crowd, guard tower), the valley's land and bridges against the towns'
  footprints, and the hills' profile. The look itself is checked with the critique screenshots at
  two sizes and both appearances (`e2e/shots/critique.spec.ts`) and the hero frames
  (`e2e/hero.ts`).
