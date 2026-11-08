// One game year by year, for tuning:
//   tsx games/crown-of-florins/e2e/trace.ts [seed] [bot or personality] [scenario]
import { BOTS } from '../src/engine/bots.ts';
import { policyFor } from '../src/engine/policies.ts';
import type { Personality } from '../src/engine/state.ts';
import { balanceCourt } from '../src/engine/balance.ts';
import { constructionCost } from '../src/engine/plan.ts';
import { playGame } from '../src/engine/simulate.ts';
import { titlePoints } from '../src/engine/title.ts';
import { titleInputs } from '../src/engine/year.ts';

const seed = Number(process.argv[2] ?? 7);
const name = process.argv[3] ?? 'competent';
const bot = name in BOTS ? BOTS[name as keyof typeof BOTS] : policyFor(name as Personality);
const { frames } = playGame({
  seed,
  court: balanceCourt(seed, { bot, rivals: 'mixed', games: 1 }, 0),
  scenario: process.argv[4] ?? 'standard',
  bot,
  maxSteps: 80,
  keepFrames: true,
});
for (const frame of frames) {
  const r = frame.realms[0];
  const log = r?.last;
  if (!r || !log) continue;
  const rev = log.revenue.customs + log.revenue.sales + log.revenue.wealth + log.revenue.justice;
  const grainCost = Math.round((log.plan.grain * log.opening.grainPrice) / 1000);
  const landCost = Math.round(log.plan.land * log.opening.landPrice);
  console.warn(
    `${log.year} w${log.opening.weather} T${r.title} pts${titlePoints(titleInputs(r))} | rev ${rev} (c${log.revenue.customs} s${log.revenue.sales} w${log.revenue.wealth} j${log.revenue.justice}) rent${log.marketRent} mills${log.millIncome} pay${log.soldiersPay} | grain ${log.plan.grain}@${log.opening.grainPrice}=${grainCost} land ${log.plan.land}@${log.opening.landPrice}=${landCost} build ${constructionCost(log.plan.build)} | fl ${r.treasury} | serfs ${r.people.serfs} mer ${r.people.merchants} nob ${r.people.nobles} cle ${r.people.clergy} sol ${r.people.soldiers} pr ${r.prosperity} land ${r.land} | M${r.holdings.markets} W${r.holdings.mills} P${r.holdings.palace} C${r.holdings.cathedral} new ${log.newcomers}`,
  );
}
