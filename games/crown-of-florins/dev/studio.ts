// The fresco studio: a realm from a real game, painted alone, set from the address bar.
//
//   ?appearance=dark&seed=12&cathedral=4&quality=high&frame=18&preview=cathedral
//   &azimuth=0.12&elevation=0.66&fov=15&radius=110
//
// The game is played by the careful bot until the first human realm's
// cathedral reaches the asked stage (or `years` have passed), so the city
// shown is one the engine really grew.
import { quickCourt } from '../src/engine/court.ts';
import { policyFor } from '../src/engine/policies.ts';
import { playGame } from '../src/engine/simulate.ts';
import { createCityScene } from '../src/scene/city-scene.ts';
import { cityNumbersOf } from '../src/scene/numbers.ts';
import { paletteFor } from '../src/scene/palette.ts';
import type { QualityLevel } from '../src/scene/quality.ts';
import { createFrescoView } from '../src/scene/view.ts';

const params = new URLSearchParams(window.location.search);
const number = (name: string, fallback: number): number => {
  const value = params.get(name);
  return value === null ? fallback : Number(value);
};
const appearance = params.get('appearance') === 'dark' ? 'dark' : 'light';
const seed = number('seed', 12);
const cathedral = number('cathedral', 4);
const years = number('years', 60);

const { world } = playGame({
  seed,
  court: quickCourt(seed, 1, 3, { personalities: ['merchant', 'general', 'saint'] }),
  bot: policyFor('builder'),
  maxSteps: years,
  until: (w) => (w.realms[0]?.holdings.cathedral ?? 0) >= cathedral,
});
const realm = world.realms[0];
if (!realm) throw new Error('No realm');

const host = document.getElementById('stage') as HTMLElement;
const city = createCityScene(appearance);
const preview = params.get('preview');
city.show(
  cityNumbersOf(realm),
  realm.arms,
  preview === 'cathedral' || preview === 'palace' ? { preview: { kind: preview } } : {},
);

const view = createFrescoView(host, {
  quality: (params.get('quality') ?? 'high') as QualityLevel,
  label: `The city of ${realm.city}`,
  loop: params.get('still') === null,
});
const palette = paletteFor(appearance);
view.setLook({
  intonaco: palette.intonaco,
  patina: palette.patina,
  sinopia: palette.sinopia,
  contour: palette.contour,
  night: appearance === 'dark' ? 1 : 0,
  pull: number('pull', 0.35),
});
view.setFrame(number('frame', 0));
view.setScene({
  scene: city.scene,
  update: (seconds, time) => city.update(seconds, time),
  setShadowMap: (size) => city.setShadowMap(size),
});
view.setPose(
  city.pose({
    elevation: number('elevation', 0.5),
    fov: number('fov', 15),
    crestAt: number('crest', 0.8),
    azimuth: number('azimuth', 0.1),
  }),
);

Object.assign(window, { __studio: { view, city, world, realm } });
console.warn(
  `${realm.city}: year ${world.year}, title ${realm.title}, land ${realm.land}, cathedral ${realm.holdings.cathedral}, palace ${realm.holdings.palace}, markets ${realm.holdings.markets}, mills ${realm.holdings.mills}, people ${realm.people.serfs}`,
);
