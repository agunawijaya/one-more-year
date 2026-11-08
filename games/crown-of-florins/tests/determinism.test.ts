/**
 * A game is its seed and its plans: replaying the plans rebuilds every
 * signal exactly, and the same seed always opens the same valley.
 */
import { describe, expect, it } from 'vitest';
import { replayPlans } from '@one-more-year/kit';
import { courtFor, crownModel } from '../src/engine/model.ts';
import { courtOptions, quickCourt } from '../src/engine/court.ts';
import { dailyScenarioFor } from '../src/engine/scenarios.ts';
import { policyFor } from '../src/engine/policies.ts';
import { playGame } from '../src/engine/simulate.ts';
import { actingRealm, createWorld, policyView } from '../src/engine/world.ts';
import type { Plan } from '../src/engine/state.ts';
import { createRng, rngForStep } from '@one-more-year/kit';

describe('replays', () => {
  it('rebuild a game of thirty years from its seed and plans, signal for signal', () => {
    const setup = { seed: 1234, scenario: 'standard', seats: 1 };
    let state = crownModel.init(setup);
    const plans: Plan[] = [];
    const signals: number[][] = [];
    const bot = policyFor('steward');
    for (let step = 0; step < 30 && !crownModel.outcome(state); step++) {
      const plan = bot(policyView(state, actingRealm(state)), createRng(9).fork(`bot:${step}`));
      plans.push(plan);
      state = crownModel.resolve(state, plan, rngForStep(setup.seed, step)).state;
      signals.push(Object.values(crownModel.signals(state, 0)));
    }
    const replayed = replayPlans(crownModel, setup, plans);
    expect(replayed.history.map((record) => Object.values(record.signals))).toEqual(signals);
    expect(JSON.stringify(replayed.state)).toBe(JSON.stringify(state));
  });

  it('open the same valley for the same seed, and survive JSON', () => {
    const court = quickCourt(77, 1, 4);
    const a = createWorld(77, { scenario: 'standard', court });
    const b = createWorld(77, { scenario: 'standard', court });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.parse(JSON.stringify(a))).toEqual(a);
  });

  it('rebuild a hot-seat game of three humans and a rival from its seed and plans', () => {
    const court = quickCourt(808, 3, 1, { fate: 'classic' });
    const setup = { seed: 808, scenario: 'standard', seats: 3, options: courtOptions(court) };
    let state = crownModel.init(setup);
    const bots = [policyFor('steward'), policyFor('builder'), policyFor('miser')];
    const plans: Plan[] = [];
    for (let step = 0; step < 60 && !crownModel.outcome(state); step++) {
      const seat = crownModel.position(state).seat;
      const bot = bots[seat % bots.length] ?? policyFor('steward');
      const plan = bot(policyView(state, actingRealm(state)), createRng(3).fork(`s:${step}`));
      plans.push(plan);
      state = crownModel.resolve(state, plan, rngForStep(setup.seed, step)).state;
    }
    const seatsPlayed = new Set(replayPlans(crownModel, setup, plans).history.map((r) => r.seat));
    expect(seatsPlayed.size).toBe(3);
    expect(JSON.stringify(replayPlans(crownModel, setup, plans).state)).toBe(JSON.stringify(state));
  });

  it('play a court of rivals alone a whole year per step', () => {
    const { world } = playGame({
      seed: 5,
      court: quickCourt(5, 0, 4),
      bot: policyFor('steward'),
      maxSteps: 3,
    });
    expect(world.year).toBe(1403);
  });
});

describe('the court in the setup', () => {
  it('seats exactly the court chosen on the setup screen', () => {
    const court = quickCourt(55, 2, 2, { difficulty: 4, fate: 'classic' });
    const setup = { seed: 9, scenario: 'standard', seats: 2, options: courtOptions(court) };
    expect(courtFor(setup)).toEqual(court);
    const world = crownModel.init(setup);
    expect(world.difficulty).toBe(4);
    expect(world.fate).toBe('classic');
    expect(world.realms.map((r) => r.city)).toEqual(court.seats.map((s) => s.town));
  });

  it('falls back to a quick court when the saved one does not read back whole', () => {
    const court = courtOptions(quickCourt(55, 1, 3));
    const broken = { court: { ...(court.court as object), fate: 'forever' } };
    const setup = { seed: 9, scenario: 'standard', seats: 1, options: broken };
    expect(courtFor(setup)).toEqual(quickCourt(9, 1, 3));
  });
});

describe('the daily world', () => {
  it('is the same valley in two separate contexts', () => {
    const setup = { seed: 20261013, scenario: dailyScenarioFor(20261013), seats: 1 };
    const here = crownModel.init(setup);
    const there = crownModel.init(JSON.parse(JSON.stringify(setup)) as typeof setup);
    expect(JSON.stringify(here)).toBe(JSON.stringify(there));
    const plan = crownModel.draft(here);
    expect(JSON.stringify(crownModel.resolve(here, plan, rngForStep(setup.seed, 0)))).toBe(
      JSON.stringify(crownModel.resolve(there, plan, rngForStep(setup.seed, 0))),
    );
  });
});
