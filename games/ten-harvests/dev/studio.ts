// The studio: the city alone, set from the address bar, for art work.
//
//   ?appearance=dark&people=140&grain=4200&acres=1200&planted=900
//   &season=1&yield=5&quality=high&azimuth=0.4&elevation=0.6&distance=160
import { createCityView, PLAN_POSE } from '../src/scene/view.ts';
import { createCityWorld } from '../src/scene/world.ts';
import type { QualityLevel } from '../src/scene/quality.ts';

const params = new URLSearchParams(window.location.search);
const number = (name: string, fallback: number): number => {
  const value = params.get(name);
  return value === null ? fallback : Number(value);
};
const appearance = params.get('appearance') === 'dark' ? 'dark' : 'light';
const host = document.getElementById('stage') as HTMLElement;
const world = createCityWorld(appearance);
const yieldParam = params.get('yield');
world.show({
  people: number('people', 120),
  grain: number('grain', 2800),
  acres: number('acres', 1000),
  planted: number('planted', 900),
  season: number('season', 1),
  yieldPerAcre: yieldParam === null ? null : Number(yieldParam),
});
const view = createCityView(host, world, {
  quality: (params.get('quality') ?? 'high') as QualityLevel,
  label: 'The city on the river',
});
view.setPose({
  target: { x: number('tx', PLAN_POSE.target.x), y: 0, z: number('tz', PLAN_POSE.target.z) },
  azimuth: number('azimuth', PLAN_POSE.azimuth),
  elevation: number('elevation', PLAN_POSE.elevation),
  distance: number('distance', PLAN_POSE.distance),
  fov: number('fov', PLAN_POSE.fov),
});
Object.assign(window, { __studio: { world, view } });
