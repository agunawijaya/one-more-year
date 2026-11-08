// Balance runs for tuning and for docs/NOTES.md:
//   tsx games/crown-of-florins/e2e/balance-report.ts [games] [which…]
// which: core (competent, naive, seats), difficulty, bots, personalities, scenarios. Default: core.
import { PERSONALITIES } from '../src/content/names.ts';
import { BOTS } from '../src/engine/bots.ts';
import { runBalance, type BalanceTally } from '../src/engine/balance.ts';
import { policyFor } from '../src/engine/policies.ts';
import { CURATED_SCENARIOS } from '../src/engine/scenarios.ts';
import type { Difficulty } from '../src/engine/state.ts';

const games = Number(process.argv[2] ?? 400);
const which = process.argv.slice(3);
const wants = (name: string): boolean =>
  which.length === 0 ? name === 'core' : which.includes(name);

function line(label: string, tally: BalanceTally): void {
  const pct = (x: number): string => `${(x * 100).toFixed(1)}%`;
  console.warn(
    `${label.padEnd(28)} crowned ${pct(tally.crowned).padStart(6)}  median ${String(tally.medianYears).padStart(3)}y  bankrupt ${pct(tally.bankrupt).padStart(6)}  invaded ${pct(tally.invaded).padStart(6)}  either ${pct(tally.bankruptOrInvaded).padStart(6)}  rival-first ${pct(tally.rivalFirst).padStart(6)}  titles ${tally.titles.map((t) => (t * 100).toFixed(0)).join('/')}`,
  );
}

const started = Date.now();
if (wants('core')) {
  line('competent · J2 · mixed', runBalance({ bot: BOTS.competent, rivals: 'mixed', games }));
  line('naive · J2 · mixed', runBalance({ bot: BOTS.naive, rivals: 'mixed', games }));
  const seats = runBalance({ bot: BOTS.competent, rivals: 'mixed', games, seat: 'rotate' });
  console.warn(`seats: ${seats.bySeat.map((s) => (s * 100).toFixed(1)).join(' / ')}`);
}
if (wants('difficulty')) {
  for (const difficulty of [1, 2, 3, 4] as Difficulty[]) {
    line(
      `competent · J${difficulty}`,
      runBalance({ bot: BOTS.competent, rivals: 'mixed', games, difficulty }),
    );
  }
}
if (wants('bots')) {
  line('builder', runBalance({ bot: BOTS.builder, rivals: 'mixed', games }));
  line('general', runBalance({ bot: BOTS.general, rivals: 'mixed', games }));
  line('random', runBalance({ bot: BOTS.random, rivals: 'mixed', games }));
}
if (wants('personalities')) {
  for (const personality of PERSONALITIES) {
    line(`as ${personality}`, runBalance({ bot: policyFor(personality), rivals: 'mixed', games }));
  }
}
if (wants('scenarios')) {
  for (const scenario of CURATED_SCENARIOS) {
    line(scenario, runBalance({ bot: BOTS.competent, rivals: 'mixed', games, scenario }));
  }
}
console.warn(`(${((Date.now() - started) / 1000).toFixed(1)} s)`);
