/**
 * Ten Harvests' living demo for the Hall: the real model played by the
 * careful steward, a year about every three seconds, on a light-quality
 * city seen from a fixed, calm camera. Silent; it draws only when a year
 * changes (and while that change animates), so off-screen it costs nothing.
 * It follows the Hall's look: a coloured diorama, an engraving or an
 * instrument's schematic, in the theme's colours and the current appearance.
 * Where WebGL would run on the CPU it draws a flat map of the same city
 * instead, so the Hall's home page never waits on shaders compiling.
 */
import {
  createModelDemo,
  type DemoHandle,
  type DemoLook,
  type DemoRenderer,
} from '@one-more-year/kit';
import { Color } from 'three';
import { carefulBot } from './engine/bots.ts';
import { cityModel } from './engine/model.ts';
import type { CityState } from './engine/state.ts';
import { createCityMap, type CityMap } from './scene/city-map.ts';
import { webglRunsOnCpu } from './scene/gpu.ts';
import { createCityView, type CameraPose, type CityView } from './scene/view.ts';
import { createCityWorld, type CityWorld } from './scene/world.ts';

const DEMO_POSE: CameraPose = {
  target: { x: -4, y: 0, z: -12 },
  azimuth: 0.55,
  elevation: 0.42,
  distance: 150,
  fov: 34,
};

/** The drawn styles look closer and a little more from above: fewer, larger shapes read best. */
const SKETCH_POSE: CameraPose = {
  target: { x: -8, y: 0, z: -18 },
  azimuth: 0.5,
  elevation: 0.62,
  distance: 112,
  fov: 34,
};

function cityRenderer(): DemoRenderer<CityState> {
  let world: CityWorld | null = null;
  let view: CityView | null = null;

  function applyLook(look: DemoLook): void {
    const sketch = look.style !== 'diorama';
    if (world) {
      // A drawing is made from the city at noon: the theme's own colours say whether the page is
      // light or dark, and a night scene would leave nothing but shadow to draw.
      world.setAppearance(sketch ? 'light' : look.appearance);
      world.setSketch(sketch);
      view?.setPose(sketch ? SKETCH_POSE : DEMO_POSE);
      world.uniforms.uGust.value = look.reducedMotion ? 0 : 0.6;
    }
    const p = look.palette;
    view?.post.setStyle(look.style, {
      paper: new Color(p.paper),
      ink: new Color(p.ink),
      line: new Color(p.line),
      accent: new Color(p.accent),
    });
  }

  return {
    mount(host, look) {
      world = createCityWorld(look.appearance);
      view = createCityView(host, world, {
        quality: 'light',
        label: 'Ten Harvests, playing by itself',
        loop: false,
      });
      view.setPose(DEMO_POSE);
      applyLook(look);
    },
    draw(state, previous, progress) {
      if (!world || !view) return;
      const before = previous.year === state.year ? state : previous;
      // A year in one breath: the fields grow, then stand ripe until the next year turns.
      world.show({
        people: Math.round(before.people + (state.people - before.people) * progress),
        grain: Math.round(before.grain + (state.grain - before.grain) * progress),
        acres: state.acres,
        planted: state.last.planted,
        season: Math.min(1, progress * 1.2),
        yieldPerAcre: state.last.yieldPerAcre,
      });
      view.renderOnce();
    },
    setLook(look) {
      applyLook(look);
      view?.renderOnce();
    },
    dispose() {
      view?.dispose();
      view = null;
      world = null;
    },
  };
}

/** The city as a flat map, for browsers where WebGL would run on the CPU and stall the page. */
function mapRenderer(): DemoRenderer<CityState> {
  let map: CityMap | null = null;
  return {
    mount(host, look) {
      map = createCityMap(host, look.palette);
    },
    draw(state, previous, progress) {
      const before = previous.year === state.year ? state : previous;
      map?.draw({
        people: Math.round(before.people + (state.people - before.people) * progress),
        grain: Math.round(before.grain + (state.grain - before.grain) * progress),
        acres: state.acres,
        planted: state.last.planted,
        season: progress,
      });
    },
    setLook(look) {
      map?.setPalette(look.palette);
    },
    dispose() {
      map?.dispose();
      map = null;
    },
  };
}

export function tenHarvestsDemo(host: HTMLElement, seed: number, look: DemoLook): DemoHandle {
  return createModelDemo({
    host,
    seed,
    model: cityModel,
    bot: carefulBot,
    renderer: webglRunsOnCpu() ? mapRenderer() : cityRenderer(),
    look,
    scenario: 'classic',
    pace: 3000,
  });
}
