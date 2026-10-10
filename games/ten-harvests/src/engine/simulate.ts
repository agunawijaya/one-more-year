/**
 * Plays whole runs with a bot: for the balance tests, the demo and the
 * development studios. Each step uses the same derived random stream the
 * real game uses (rngForStep), and the bot draws from its own stream, so a
 * simulated run is exactly the run a player would see on that seed.
 */
import { createRng, resolveStep, type TurnRecord, type WorldSetup } from '@one-more-year/kit';
import type { Bot } from './bots.ts';
import { cityModel } from './model.ts';
import type { CityState, Decree } from './state.ts';

export interface SimulatedRun {
  setup: WorldSetup;
  final: CityState;
  plans: Decree[];
  history: TurnRecord<Decree>[];
  /** The state at the start of every year played (before its decree). */
  states: CityState[];
}

/** The stream a bot decides with on a given world and step, apart from the world's own dice. */
export function botStream(seed: number, step: number) {
  return createRng(seed).fork('bot').fork(`step:${step}`);
}

export function simulateRun(
  bot: Bot,
  setup: WorldSetup,
  stopAfter = Number.POSITIVE_INFINITY,
): SimulatedRun {
  let state = cityModel.init(setup);
  const plans: Decree[] = [];
  const history: TurnRecord<Decree>[] = [];
  const states: CityState[] = [];
  for (let step = 0; !state.ending && step < stopAfter; step++) {
    const plan = bot(state, botStream(setup.seed, step));
    states.push(state);
    const resolved = resolveStep(cityModel, state, plan, setup.seed, step);
    plans.push(plan);
    history.push(resolved.record);
    state = resolved.state;
  }
  return { setup, final: state, plans, history, states };
}

export interface BalanceTally {
  runs: number;
  /** Share of runs ending in each verdict id. */
  verdicts: Record<string, number>;
  deposed: number;
  topTier: number;
  /** Share of runs that reached the natural end (all terms). */
  completed: number;
}

/** Plays `runs` worlds on seeds 1…runs and tallies how they ended. */
export function tallyRuns(bot: Bot, scenario: string, runs: number, firstSeed = 1): BalanceTally {
  const verdicts: Record<string, number> = {};
  let deposed = 0;
  let topTier = 0;
  let completed = 0;
  for (let i = 0; i < runs; i++) {
    const { final } = simulateRun(bot, { seed: firstSeed + i, scenario, seats: 1 });
    const ending = final.ending;
    if (!ending) continue;
    verdicts[ending.verdictId] = (verdicts[ending.verdictId] ?? 0) + 1 / runs;
    if (ending.kind === 'deposed') deposed += 1 / runs;
    if (ending.tier >= 4) topTier += 1 / runs;
    if (ending.kind === 'term-complete' || ending.kind === 'dynasty-complete')
      completed += 1 / runs;
  }
  return { runs, verdicts, deposed, topTier, completed };
}
