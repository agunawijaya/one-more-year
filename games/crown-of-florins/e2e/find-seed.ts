// Finds the first seeds where the competent bot meets a given fate: tsx …/find-seed.ts bankrupt|invaded|crowned [count]
import { BOTS } from '../src/engine/bots.ts';
import { balanceCourt } from '../src/engine/balance.ts';
import { playGame } from '../src/engine/simulate.ts';

const fate = process.argv[2] ?? 'bankrupt';
const count = Number(process.argv[3] ?? 3);
const found: number[] = [];
for (let seed = 1; seed < 2000 && found.length < count; seed++) {
  const court = balanceCourt(seed, { bot: BOTS.competent, rivals: 'mixed', games: 1 }, 0);
  const { world } = playGame({ seed, court, bot: BOTS.competent, maxSteps: 80 });
  const r = world.realms[0];
  if (!r) continue;
  const hit =
    fate === 'bankrupt'
      ? r.record.bankruptcies > 0
      : fate === 'invaded'
        ? r.record.invadedCount > 0
        : r.record.crownedYear !== null;
  if (hit) found.push(seed);
}
console.warn(found.join(' '));
