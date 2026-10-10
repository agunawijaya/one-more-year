// Prints the balance numbers recorded in NOTES.md:
//   pnpm exec tsx games/ten-harvests/e2e/balance-report.ts [runs]
import { BOTS } from '../src/engine/bots.ts';
import { cityModel } from '../src/engine/model.ts';
import { CURATED_SCENARIOS } from '../src/engine/rules.ts';
import { tallyRuns } from '../src/engine/simulate.ts';

const runs = Number(process.argv[2] ?? 2000);
const pct = (value: number): string => `${(value * 100).toFixed(1)}%`;
const print = (line: string): void => {
  process.stdout.write(`${line}
`);
};

// "plain" accepts the drafted decree every year: feed everyone, then sow all the seed allows.
const players = {
  ...BOTS,
  plain: (state: Parameters<typeof cityModel.draft>[0]) => cityModel.draft(state),
};
for (const [name, bot] of Object.entries(players)) {
  const tally = tallyRuns(bot, 'classic', runs);
  print(
    `classic  ${name.padEnd(8)} top ${pct(tally.topTier)}  deposed ${pct(tally.deposed)}  ${JSON.stringify(Object.fromEntries(Object.entries(tally.verdicts).map(([k, v]) => [k, pct(v)])))}`,
  );
}
for (const scenario of [...CURATED_SCENARIOS, 'dynasty', 'ledger-1978']) {
  const tally = tallyRuns(BOTS.careful, scenario, runs);
  print(
    `${scenario.padEnd(16)} careful top ${pct(tally.topTier)}  deposed ${pct(tally.deposed)}  completed ${pct(tally.completed)}`,
  );
}
