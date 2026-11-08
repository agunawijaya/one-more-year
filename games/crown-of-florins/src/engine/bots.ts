/**
 * The bots the balance runs sit in the human seat: a competent ruler (the
 * careful steward), a naive one, the builder and the general (two of the AI
 * personalities, playing for themselves), and pure chance. Like the AI
 * rivals they fill in the same plan a player does and see only what a
 * player sees.
 */
import type { Rng } from '@one-more-year/kit';
import { openingPlan, releaseBounds } from './plan.ts';
import { policyFor, type PolicyView } from './policies.ts';
import type { Justice, Plan } from './state.ts';

/** Never builds, never trades, keeps the opening taxes, feeds exactly what the people need. */
export function naiveBot(view: PolicyView): Plan {
  const plan = openingPlan(view.realm);
  return { ...plan, customs: 25, sales: 10, wealth: 5, justice: 2 };
}

/** Every number drawn at random within its limits. */
export function randomBot(view: PolicyView, rng: Rng): Plan {
  const realm = view.realm;
  const grain = rng.int(-Math.floor(realm.grain / 4), 3000);
  const { least, most } = releaseBounds(realm.grain + grain);
  return {
    grain,
    land: rng.int(-1000, 2000),
    release: rng.int(least, most),
    customs: rng.int(0, 60),
    sales: rng.int(0, 30),
    wealth: rng.int(0, 20),
    justice: rng.int(1, 4) as Justice,
    build: {
      markets: rng.chance(0.3) ? 1 : 0,
      mills: rng.chance(0.15) ? 1 : 0,
      palace: rng.chance(0.1) ? 1 : 0,
      cathedral: rng.chance(0.05) ? 1 : 0,
      platoons: rng.int(0, 2),
    },
  };
}

export const BOTS = {
  competent: policyFor('steward'),
  naive: naiveBot,
  builder: policyFor('builder'),
  general: policyFor('general'),
  random: randomBot,
} as const;
