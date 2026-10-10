// The year studio: resolves one real year on the engine and plays its
// cinematic. ?seed=7&appearance=dark&t=6.4 freezes it at 6.4 seconds;
// without t it plays on a loop. &yield=5 searches seeds for that harvest.
import '../../../hall/src/styles/fonts.css';
import '../src/ui/ten-harvests.css';
import { resolveStep } from '@one-more-year/kit';
import { cityModel } from '../src/engine/model.ts';
import { carefulBot } from '../src/engine/bots.ts';
import { createRng } from '@one-more-year/kit';
import type { Decree } from '../src/engine/state.ts';
import { createYearCinematic, poseAt, type YearStory } from '../src/scene/cinematic.ts';
import type { QualityLevel } from '../src/scene/quality.ts';
import { createCityView, type CameraPose } from '../src/scene/view.ts';
import { createCityWorld } from '../src/scene/world.ts';
import { el } from '../src/ui/dom.ts';

const params = new URLSearchParams(window.location.search);
const appearance = params.get('appearance') === 'dark' ? 'dark' : 'light';
const wantedYield = params.get('yield');
const wantRats = params.has('rats');
const wantFever = params.has('fever');

const lived = Number(params.get('lived') ?? 0);

/** The year after `lived` years of the opening plans, on this seed. */
function yearFor(seed: number) {
  const setup = { seed, scenario: 'classic', seats: 1 };
  let state = cityModel.init(setup);
  const bot = createRng(seed).fork('bot');
  for (let step = 0; step < lived && !state.ending; step++) {
    state = resolveStep(cityModel, state, carefulBot(state, bot), seed, step).state;
  }
  const planned = carefulBot(state, bot);
  const decree: Decree = {
    ...planned,
    land: params.has('land') ? Number(params.get('land')) : planned.land,
  };
  const resolved = resolveStep(cityModel, state, decree, seed, lived);
  return { state, decree, after: resolved.state };
}

let seed = Number(params.get('seed') ?? 7);
for (let tries = 0; tries < 4000; tries++) {
  const { state, after } = yearFor(seed);
  const okYield = wantedYield === null || after.last.yieldPerAcre === Number(wantedYield);
  const okRats = !wantRats || after.last.ratsAte > 0;
  const okFever = !wantFever || after.last.feverLost > 0;
  const okNewcomers =
    !params.has('newcomers') || after.last.newcomers >= Number(params.get('newcomers'));
  const okAlive = state.ending === null && after.ending?.kind !== 'deposed';
  const okPeople = !params.has('people') || state.people >= Number(params.get('people'));
  if (okYield && okRats && okFever && okNewcomers && okAlive && okPeople) break;
  seed++;
}
const { state, decree, after } = yearFor(seed);
if (state.ending || after.ending?.kind === 'deposed')
  console.warn(`No seed matched; showing ${seed}`);
const story: YearStory = {
  year: state.year,
  people: state.people,
  storeBefore:
    state.grain - decree.land * state.landPrice - decree.food - Math.floor(decree.plant / 2),
  acres: state.acres + decree.land,
  planted: decree.plant,
  yieldPerAcre: after.last.yieldPerAcre,
  harvest: after.last.harvest,
  ratsAte: after.last.ratsAte,
  newcomers: after.last.newcomers,
  hungry: after.last.hungry,
  feverLost: after.last.feverLost,
  peopleAfter: after.people,
  storeAfter: after.grain,
};

const root = document.getElementById('app') as HTMLElement;
root.className = 'th';
root.dataset.appearance = appearance;
const world = createCityWorld(appearance);
world.show({
  people: state.people,
  grain: story.storeBefore,
  acres: story.acres,
  planted: story.planted,
  season: 0,
  yieldPerAcre: story.yieldPerAcre,
});
const quality = (params.get('quality') ?? 'high') as QualityLevel;
const view = createCityView(root, world, { quality, label: 'The year turns' });
const cinematic = createYearCinematic(world, story, 'cinematic');
const caption = el('div', { class: 'th-caption', hidden: params.has('nocaption') });
root.append(caption);

// Fixed hero views, overriding the cinematic's camera.
const HERO_POSES: Record<string, CameraPose> = {
  'night-city': {
    target: { x: 30, y: 3, z: -42 },
    azimuth: 1.32,
    elevation: 0.2,
    distance: 92,
    fov: 40,
  },
};
const heroPose = HERO_POSES[params.get('pose') ?? ''];
const frozen = params.get('t');
const started = performance.now();
view.onFrame(() => {
  const beat = cinematic.beats.find((b) => b.name === params.get('beat'));
  const fixed = beat
    ? beat.start + beat.length * Number(params.get('at') ?? 0.6)
    : frozen === null
      ? null
      : Number(frozen);
  const t = fixed ?? ((performance.now() - started) / 1000) % (cinematic.duration + 1.5);
  const shown = cinematic.seek(t);
  view.setPose(heroPose ?? poseAt(cinematic.beats, t));
  caption.replaceChildren(
    el('span', {}, `Year ${story.year}`),
    el('strong', {}, shown.title),
    el('b', {}, shown.value),
  );
});
Object.assign(window, { __year: { world, view, cinematic, story, seed } });
