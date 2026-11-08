/**
 * Crown of Florins as the kit's TurnModel: the valley as State, one human
 * ruler's year as the Plan, and the four headline numbers as signals.
 */
import type { Outcome, Signals, TurnModel, WorldSetup } from '@one-more-year/kit';
import { courtFromOptions, MAX_SEATS, quickCourt, type Court } from './court.ts';
import { feedingPlan, validatePlan } from './plan.ts';
import { titlePoints } from './title.ts';
import { actingRealm, actingSeat, createWorld, playStep } from './world.ts';
import { FIRST_YEAR } from './rules.ts';
import { verdictFor } from './verdict.ts';
import { titleInputs } from './year.ts';
import type { Plan, Realm, World } from './state.ts';

/** Seats at a quick table: the humans, and AI rivals filling it to four. */
export const QUICK_TABLE = 4;

/**
 * The court a setup describes: the one chosen on the court-setup screen
 * (carried in the setup's options), or a quick court drawn from the seed.
 * The Hall's demo seats four AI rivals and nobody else.
 */
export function courtFor(setup: WorldSetup): Court {
  if (setup.scenario === 'demo') return quickCourt(setup.seed, 0, QUICK_TABLE);
  const chosen = courtFromOptions(setup.options);
  if (chosen) return chosen;
  const humans = Math.max(1, Math.min(MAX_SEATS, setup.seats));
  return quickCourt(setup.seed, humans, Math.max(0, QUICK_TABLE - humans));
}

export function population(realm: Realm): number {
  const p = realm.people;
  return p.serfs + p.soldiers + p.merchants + p.nobles + p.clergy;
}

export const crownModel: TurnModel<World, Plan> = {
  init(setup) {
    return createWorld(setup.seed, { scenario: setup.scenario, court: courtFor(setup) });
  },

  draft(world) {
    return feedingPlan(actingRealm(world));
  },

  validate(world, plan) {
    return validatePlan(actingRealm(world), plan, world.terms);
  },

  resolve(world, plan, rng) {
    const { world: next, events } = playStep(world, plan, rng);
    return { state: next, events };
  },

  signals(world, seat): Signals {
    const realm = world.realms[seat] ?? world.realms[0];
    if (!realm) return {};
    return {
      treasury: realm.treasury,
      population: population(realm),
      land: realm.land,
      points: titlePoints(titleInputs(realm)),
    };
  },

  position(world) {
    return { turn: world.year - FIRST_YEAR + 1, seat: actingSeat(world) };
  },

  outcome(world): Outcome | null {
    const verdict = verdictFor(world);
    if (!world.end || !verdict) return null;
    return { ending: world.end.ending, verdict };
  },
};
