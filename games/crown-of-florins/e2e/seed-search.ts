// Finds seeds for the hero frames and tests: tsx games/crown-of-florins/e2e/seed-search.ts
import { quickCourt } from '../src/engine/court.ts';
import { policyFor } from '../src/engine/policies.ts';
import { playGame } from '../src/engine/simulate.ts';

for (let seed = 1; seed <= 40; seed++) {
  const { world } = playGame({
    seed,
    court: quickCourt(seed, 1, 3, { difficulty: 4 }),
    bot: policyFor('builder'),
    maxSteps: 90,
    until: (w) => (w.realms[0]?.pastRulers.length ?? 0) > 0,
  });
  const realm = world.realms[0];
  if (!realm) continue;
  const past = realm.pastRulers[0];
  if (past) {
    console.warn(
      `seed ${seed}: died ${past.died} after ${past.died - past.ruler.accession} years, title ${past.title}, cathedral ${realm.holdings.cathedral}, invaded ${realm.record.invadedCount}, famine ${realm.record.famineYears}, weathers ${realm.record.weathersSeen.join('')}`,
    );
  }
}
