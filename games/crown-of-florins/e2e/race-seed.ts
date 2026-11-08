// Finds solo seeds (the default court) where a rival wins the race to the crown while the
// player seals the plan the year screen opens with, earliest first: tsx …/race-seed.ts [count]
import { quickCourt } from '../src/engine/court.ts';
import { feedingPlan } from '../src/engine/plan.ts';
import { playGame } from '../src/engine/simulate.ts';

const count = Number(process.argv[2] ?? 5);
const found: { seed: number; year: number; steps: number }[] = [];
for (let seed = 1; seed < 400; seed++) {
  const { world, steps } = playGame({
    seed,
    court: quickCourt(seed, 1, 3),
    bot: (view) => feedingPlan(view.realm),
    maxSteps: 80,
    until: (w) => w.firstCrowned !== null,
  });
  if (world.firstCrowned !== null && world.firstCrowned !== 0 && !world.end) {
    found.push({ seed, year: world.year, steps });
  }
}
found.sort((a, b) => a.steps - b.steps);
console.warn(
  found
    .slice(0, count)
    .map((f) => `${f.seed} (step ${f.steps}, ${f.year})`)
    .join('\n'),
);
