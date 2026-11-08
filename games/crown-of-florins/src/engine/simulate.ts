/**
 * Seeded games played by bots, for balance tests, NOTES.md and the hero
 * frames: the same model and the same steps as a real game, with a policy
 * filling in each human seat's plan.
 */
import { createRng, rngForStep, type Rng } from '@one-more-year/kit';
import { actingRealm, createWorld, playStep, policyView } from './world.ts';
import type { Court } from './court.ts';
import type { PolicyView } from './policies.ts';
import type { Plan, World } from './state.ts';

export type Bot = (view: PolicyView, rng: Rng) => Plan;

export interface PlayedGame {
  world: World;
  /** Every world after each step, when asked for. */
  frames: World[];
  steps: number;
}

export interface GameOptions {
  seed: number;
  court: Court;
  scenario?: string;
  endYear?: number | null;
  /** The policy that fills in the human seats' plans. */
  bot: Bot;
  /** Stop after this many steps (a safety net; games end by themselves). */
  maxSteps?: number;
  /** Stop as soon as this is true. */
  until?: (world: World) => boolean;
  keepFrames?: boolean;
}

export function playGame(options: GameOptions): PlayedGame {
  let world = createWorld(options.seed, {
    scenario: options.scenario ?? 'standard',
    court: options.court,
    endYear: options.endYear,
  });
  const frames: World[] = options.keepFrames ? [world] : [];
  const maxSteps = options.maxSteps ?? 600;
  let steps = 0;
  while (!world.end && steps < maxSteps && !(options.until?.(world) ?? false)) {
    const view = policyView(world, actingRealm(world));
    const plan = options.bot(view, createRng(options.seed).fork('bot').fork(`step:${steps}`));
    world = playStep(world, plan, rngForStep(options.seed, steps)).world;
    steps++;
    if (options.keepFrames) frames.push(world);
  }
  return { world, frames, steps };
}
