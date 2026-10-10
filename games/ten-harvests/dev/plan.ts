// The plan studio: the real plan screen driving the real engine and city,
// outside the Hall, for art direction. ?appearance=dark&seed=7&years=3 plays
// a few years with the careful steward first so the strip has a history.
import '../../../hall/src/styles/fonts.css';
import '../src/ui/ten-harvests.css';
import { replayPlans } from '@one-more-year/kit';
import { cityModel } from '../src/engine/model.ts';
import { carefulBot } from '../src/engine/bots.ts';
import { createRng } from '@one-more-year/kit';
import { ledgerFor } from '../src/engine/odds.ts';
import type { CityState, Decree } from '../src/engine/state.ts';
import { createPlanScreen } from '../src/ui/plan-screen.ts';
import { createCityView, type CameraPose } from '../src/scene/view.ts';
import { createCityWorld } from '../src/scene/world.ts';
import { manifest } from '../manifest.ts';

const params = new URLSearchParams(window.location.search);
const appearance = params.get('appearance') === 'dark' ? 'dark' : 'light';
const seed = Number(params.get('seed') ?? 7);
const lived = Number(params.get('years') ?? 0);
const setup = { seed, scenario: 'classic', seats: 1 };

// A few years of a sensible steward, so the screen shows a city with a past.
const plans: Decree[] = [];
let state: CityState = cityModel.init(setup);
const bot = createRng(seed).fork('bot');
for (let i = 0; i < lived; i++) {
  const plan = carefulBot(state, bot);
  plans.push(plan);
  state = replayPlans(cityModel, setup, plans).state;
}
const history = replayPlans(cityModel, setup, plans).history;
let decree: Decree = cityModel.draft(state);

const root = document.getElementById('app') as HTMLElement;
root.className = 'th';
root.dataset.appearance = appearance;
const world = createCityWorld(appearance);
const screen = createPlanScreen(manifest.emblem, {
  change(next) {
    decree = next;
    refresh();
  },
  commit() {
    // The studio only shows the plan; years are turned in the real game.
  },
});
root.append(screen.element);
const view = createCityView(screen.dioramaHost, world, {
  quality: 'high',
  label: 'The city on the river',
});
const pose: CameraPose = {
  target: { x: Number(params.get('tx') ?? -8), y: 0, z: Number(params.get('tz') ?? -2) },
  azimuth: Number(params.get('azimuth') ?? 0.35),
  elevation: Number(params.get('elevation') ?? 0.5),
  distance: Number(params.get('distance') ?? 118),
  fov: Number(params.get('fov') ?? 34),
};
view.setPose(pose);

function refresh(): void {
  const years = Array.from({ length: 10 }, (_, i) => {
    const year = i + 1;
    const record = history[i];
    const harvest = record?.events.find((e) => e.kind === 'harvest');
    const yieldPerAcre = harvest?.numbers.yield ?? 0;
    return {
      year,
      state:
        year < state.year
          ? ('past' as const)
          : year === state.year
            ? ('now' as const)
            : ('future' as const),
      glyph: record ? (yieldPerAcre >= 4 ? '🌾' : yieldPerAcre <= 2 ? '🌱' : '⚖️') : '',
      caption: record ? `harvest ${yieldPerAcre}×` : year === state.year ? 'now' : '',
    };
  });
  screen.update({
    state,
    decree,
    issues: cityModel.validate(state, decree),
    ledger: ledgerFor(state, decree),
    turnLabel: `Year ${state.year} of 10`,
    scenarioTitle: 'Classic Term',
    years,
    forecastsHidden: false,
    lastYear: [
      `Harvest ${state.last.yieldPerAcre} bushels an acre: ${state.last.harvest.toLocaleString('en')} in all`,
      state.last.ratsAte > 0
        ? `Rats ate ${state.last.ratsAte.toLocaleString('en')}`
        : 'The rats stayed away',
      `${state.last.newcomers} newcomers arrived`,
    ],
    scribe: 'The store is deep enough to buy land this year and still feed everyone.',
    ghost: null,
    armed: false,
  });
  world.show({
    people: state.people,
    grain:
      state.grain -
      Math.max(0, decree.land) * state.landPrice -
      decree.food -
      Math.floor(decree.plant / 2),
    acres: state.acres + decree.land,
    planted: decree.plant,
    season: 1,
    yieldPerAcre: null,
    landChange: decree.land,
    sacks: {
      food: decree.food,
      seed: Math.floor(decree.plant / 2),
      land: Math.max(0, decree.land) * state.landPrice,
    },
  });
}
refresh();
Object.assign(window, { __plan: { world, view, screen } });
