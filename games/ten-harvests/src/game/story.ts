/**
 * The story of one year, for the cinematic and the report: the numbers
 * before and after, read from the engine's states and the decree that
 * joined them.
 */
import { grainAfterDecree } from '../engine/model.ts';
import type { CityState, Decree } from '../engine/state.ts';
import type { YearStory } from '../scene/cinematic.ts';

export function storyOf(before: CityState, decree: Decree, after: CityState): YearStory {
  const last = after.last;
  return {
    year: before.year,
    people: before.people,
    storeBefore: grainAfterDecree(before, decree),
    acres: before.acres + decree.land,
    planted: decree.plant,
    yieldPerAcre: last.yieldPerAcre,
    harvest: last.harvest,
    ratsAte: last.ratsAte,
    newcomers: after.ending?.kind === 'deposed' ? 0 : last.newcomers,
    hungry: last.hungry,
    feverLost: last.feverLost,
    peopleAfter: after.people,
    storeAfter: after.grain,
  };
}
