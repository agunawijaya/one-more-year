// The stele studio: plays ten real years with the opening plans on a seed,
// then carves the term's stele. ?appearance=dark&seed=11&carve=0.6&turn=0.3
import '../../../hall/src/styles/fonts.css';
import { resolveStep } from '@one-more-year/kit';
import { cityModel } from '../src/engine/model.ts';
import { carefulBot } from '../src/engine/bots.ts';
import { createRng } from '@one-more-year/kit';
import { VERDICTS, type VerdictId } from '../src/engine/judge.ts';
import type { CityState, YearOutcome } from '../src/engine/state.ts';
import { loadReliefFont } from '../src/stele/heightmap.ts';
import { buildRelief, type YearMark } from '../src/stele/relief.ts';
import { createSteleView } from '../src/stele/stele-scene.ts';

const params = new URLSearchParams(window.location.search);
const appearance = params.get('appearance') === 'dark' ? 'dark' : 'light';
/** Ten years with the opening plans; the first seed (from ?seed) whose term runs its course. */
function term(seed: number): { state: CityState; years: YearOutcome[]; stores: number[] } {
  const setup = { seed, scenario: 'classic', seats: 1 };
  let state: CityState = cityModel.init(setup);
  const years: YearOutcome[] = [];
  const stores: number[] = [];
  const bot = createRng(seed).fork('bot');
  for (let step = 0; step < 10 && !state.ending; step++) {
    state = resolveStep(cityModel, state, carefulBot(state, bot), seed, step).state;
    years.push(state.last);
    stores.push(state.grain);
  }
  return { state, years, stores };
}
let seed = Number(params.get('seed') ?? 11);
let run = term(seed);
while (run.state.ending?.kind !== 'term-complete' && seed < 100000) run = term(++seed);
const { state, years, stores } = run;
const fullest = Math.max(1, ...stores);
const marks: YearMark[] = years.map((year, i) => ({
  year: year.year,
  yieldPerAcre: year.yieldPerAcre,
  storeShare: (stores[i] ?? 0) / fullest,
  ratsAte: year.ratsAte,
  feverLost: year.feverLost,
  newcomers: year.newcomers,
  hungry: year.hungry,
}));
const verdict = VERDICTS[(state.ending?.verdictId ?? 'fair-season') as VerdictId];
await loadReliefFont();
const relief = buildRelief({
  epithet: params.get('epithet') ?? 'Keeper of Full Granaries',
  verdict: verdict.label,
  footnote: `Ten years on the river · ${state.people} people · ${state.acres.toLocaleString('en')} acres`,
  years: marks,
  registers: 10,
});
const host = document.getElementById('app') as HTMLElement;
const view = createSteleView(host, [relief], appearance);
view.setCarving(Number(params.get('carve') ?? 1));
view.turn(Number(params.get('turn') ?? 0));
const tick = (): void => {
  view.renderOnce();
  requestAnimationFrame(tick);
};
tick();
Object.assign(window, { __stele: { view, relief, marks } });
