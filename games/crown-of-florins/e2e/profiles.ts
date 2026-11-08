// The AI personalities side by side, for docs/NOTES.md and tuning:
//   tsx games/crown-of-florins/e2e/profiles.ts [games] [years] [difficulty]
import { rivalProfiles } from '../src/engine/balance.ts';
import type { Difficulty } from '../src/engine/state.ts';

const games = Number(process.argv[2] ?? 200);
const years = Number(process.argv[3] ?? 30);
const difficulty = Number(process.argv[4] ?? 2) as Difficulty;
const profiles = rivalProfiles(games, years, difficulty);
const fixed = (x: number, digits = 1): string => x.toFixed(digits).padStart(8);
console.warn(
  'personality   soldiers sold/kha  customs  burden  justice  markets   mills  monum.  treasury  merch.  clergy  points  title',
);
for (const [name, p] of Object.entries(profiles)) {
  console.warn(
    `${name.padEnd(12)}${fixed(p.soldiers)}${fixed(p.soldiersPerThousand)}${fixed(p.customs)}${fixed(p.taxBurden)}${fixed(p.justice, 2)}${fixed(p.markets)}${fixed(p.mills)}${fixed(p.monuments)}${fixed(p.treasury, 0).padStart(10)}${fixed(p.merchants)}${fixed(p.clergy)}${fixed(p.points)}${fixed(p.title, 2)}`,
  );
}
