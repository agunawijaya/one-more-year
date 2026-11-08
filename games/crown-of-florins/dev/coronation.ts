// The coronation from a real game: the first human realm played until it is crowned.
//
//   ?appearance=dark&seed=12&gold=1&glint=9.5
//
// `gold` sets how far the gilding has spread (0–1); without it the gold
// spreads over eight seconds, as in the game. `glint` holds the travelling
// glint at that moment (seconds), for a still of the light crossing the gold;
// `petals=0` paints the city without its falling petals.
import '../../../hall/src/styles/fonts.css';
import '../src/ui/crown.css';
import { ordinal } from '@one-more-year/kit';
import { quickCourt } from '../src/engine/court.ts';
import { policyFor } from '../src/engine/policies.ts';
import { playGame } from '../src/engine/simulate.ts';
import { titleName } from '../src/content/names.ts';
import { createCityScene } from '../src/scene/city-scene.ts';
import { createGilding } from '../src/scene/gilding.ts';
import { cityNumbersOf } from '../src/scene/numbers.ts';
import { paletteFor } from '../src/scene/palette.ts';
import type { QualityLevel } from '../src/scene/quality.ts';
import { createFrescoView } from '../src/scene/view.ts';
import { el } from '../src/ui/dom.ts';
import { createPetals } from '../src/ui/petals.ts';

const params = new URLSearchParams(window.location.search);
const number = (name: string, fallback: number): number => {
  const value = params.get(name);
  return value === null ? fallback : Number(value);
};
const appearance = params.get('appearance') === 'dark' ? 'dark' : 'light';
const seed = number('seed', 12);

const { world } = playGame({
  seed,
  court: quickCourt(seed, 1, 3, { personalities: ['merchant', 'builder', 'saint'], difficulty: 2 }),
  bot: policyFor('builder'),
  maxSteps: 90,
  until: (w) => (w.realms[0]?.title ?? 0) >= 8,
});
const realm = world.realms[0];
if (!realm) throw new Error('No realm');

const root = el('div', { class: 'cf cf-coronation', 'data-appearance': appearance });
const stage = el('div', { class: 'cf-coronation__stage' });
root.append(stage);
document.getElementById('app')?.append(root);

const city = createCityScene(appearance);
city.show(cityNumbersOf(realm), realm.arms, { crowned: true, procession: true });
const view = createFrescoView(stage, {
  quality: (params.get('quality') ?? 'high') as QualityLevel,
  label: `${realm.city} gilded for a coronation`,
});
const palette = paletteFor(appearance);
view.setLook({
  intonaco: palette.intonaco,
  patina: palette.patina,
  sinopia: palette.sinopia,
  contour: palette.contour,
  night: appearance === 'dark' ? 1 : 0,
  pull: 0.35,
});
view.setFrame(number('frame', 18));
view.setScene({
  scene: city.scene,
  update: (s, t) => city.update(s, t),
  setShadowMap: (size) => city.setShadowMap(size),
});
view.setPose(city.pose({ elevation: number('elevation', 0.48), crestAt: 0.86 }));

const gilding = createGilding();
gilding.setNight(appearance === 'dark' ? 1 : 0);
if (params.has('glint')) gilding.holdGlint(number('glint', 0));
view.setOverlay(gilding);
const crown = city.city?.crownPoint ?? { x: 16, y: 36, z: -5.6 };
const fixed = params.get('gold');
const started = performance.now();
view.onFrame(() => {
  const origin = view.project(crown);
  gilding.setOrigin(origin.x, origin.y);
  gilding.setProgress(
    fixed === null ? Math.min(1.05, (performance.now() - started) / 8000) : Number(fixed),
  );
});

const title = titleName(8, realm.ruler.form);
stage.append(
  createPetals(number('petals', 70), seed),
  el(
    'div',
    { class: 'cf-cartouche' },
    el('p', { class: 'cf-cartouche__eyebrow' }, `Anno ${world.year} · ${realm.city}`),
    el('h1', { class: 'cf-cartouche__title' }, `${title} ${realm.ruler.name}`),
    el(
      'p',
      { class: 'cf-cartouche__line' },
      `Crowned in the ${ordinal(world.year - realm.ruler.accession + 1)} year of the reign`,
    ),
  ),
);

Object.assign(window, { __coronation: { world, realm, view, city, gilding } });
