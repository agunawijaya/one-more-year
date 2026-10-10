// Finds seeds where simply accepting the drafted decree every year has a given ending,
// and tallies how that plain player fares over a thousand worlds.
import { cityModel } from '../src/engine/model.ts';
import { simulateRun, tallyRuns } from '../src/engine/simulate.ts';
import type { CityState } from '../src/engine/state.ts';

const draft = (state: CityState) => cityModel.draft(state);
const scenario = process.argv[2] ?? 'classic';
const found: Record<string, number[]> = {};
for (let seed = 1; seed < 400; seed++) {
  const run = simulateRun(draft, { seed, scenario, seats: 1 });
  const key = `${run.final.ending?.kind}:${run.final.ending?.verdictId}`;
  const list = (found[key] ??= []);
  if (list.length < 5) list.push(seed);
}
console.warn(JSON.stringify(found));
console.warn(JSON.stringify(tallyRuns(draft, scenario, 1000, 1)));
