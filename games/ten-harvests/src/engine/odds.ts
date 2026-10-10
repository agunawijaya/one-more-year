/**
 * The honest ledger: what a decree will do, computed exactly.
 *
 * The year has only a few dice (the yield, the rats, the newcomers and the
 * fever), each with a handful of equally likely faces, so instead of
 * sampling we enumerate every combination and report exact ranges and
 * exact odds. The ledger uses the very functions the year uses (model.ts),
 * so a forecast can never disagree with what happens.
 */
import {
  grainAfterDecree,
  newcomersFor,
  peopleFedBy,
  rulesOf,
  seedFor,
  workersLimit,
} from './model.ts';
import { DEPOSITION_SHARE, DIE_FACES, yieldFaces } from './rules.ts';
import type { CityState, Decree } from './state.ts';

export interface HarvestOutcome {
  yieldPerAcre: number;
  bushels: number;
}

export interface Ledger {
  people: number;
  fed: number;
  hungry: number;
  /** True when more than 45 % would go hungry: the decree would end the ruler's term. */
  endsRule: boolean;
  seed: number;
  workersNeeded: number;
  workersLimit: number;
  /** Grain left in store after land, food and seed: what the rats could reach. */
  leftInStore: number;
  /** Every yield face, equally likely. */
  harvests: HarvestOutcome[];
  rats: {
    /** "2 in 5": faces on which rats come, out of five. */
    faces: number;
    of: number;
    /** Bushels eaten on each of those faces (½ on a 2, ¼ on a 4…). */
    eaten: { face: number; bushels: number }[];
  };
  fever: { oneIn: number };
  newcomers: { low: number; high: number };
  /** Grain in store at the end of the year, across every outcome. */
  storeAfter: { low: number; high: number };
}

export function ledgerFor(state: CityState, decree: Decree): Ledger {
  const rules = rulesOf(state);
  const acres = state.acres + decree.land;
  const left = grainAfterDecree(state, decree);
  const fed = Math.min(state.people, peopleFedBy(decree.food));
  const hungry = state.people - fed;
  const harvests = yieldFaces(rules).map((face) => ({
    yieldPerAcre: face,
    bushels: decree.plant * face,
  }));
  const eaten = rules.ratFaces.map((face) => ({
    face,
    bushels: Math.floor(Math.max(0, left) / face),
  }));

  // Every combination of yield and rats, then every newcomers face.
  let newLow = Number.POSITIVE_INFINITY;
  let newHigh = Number.NEGATIVE_INFINITY;
  let storeLow = Number.POSITIVE_INFINITY;
  let storeHigh = Number.NEGATIVE_INFINITY;
  const ratLosses = [0, ...eaten.map((e) => e.bushels)];
  for (const harvest of harvests) {
    for (const loss of ratLosses) {
      const store = left - loss + harvest.bushels;
      storeLow = Math.min(storeLow, store);
      storeHigh = Math.max(storeHigh, store);
      for (let face = 1; face <= DIE_FACES; face++) {
        const arriving = newcomersFor(face, acres, store, state.people);
        newLow = Math.min(newLow, arriving);
        newHigh = Math.max(newHigh, arriving);
      }
    }
  }

  return {
    people: state.people,
    fed,
    hungry,
    endsRule: hungry > DEPOSITION_SHARE * state.people,
    seed: seedFor(decree.plant),
    workersNeeded: decree.plant,
    workersLimit: workersLimit(state.people),
    leftInStore: left,
    harvests,
    rats: { faces: rules.ratFaces.length, of: DIE_FACES, eaten },
    fever: { oneIn: rules.feverOneIn },
    newcomers: { low: newLow, high: newHigh },
    storeAfter: { low: storeLow, high: storeHigh },
  };
}
