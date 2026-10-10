/**
 * A tiny orchard used by the kit's tests: plant trees, sell apples, hope the
 * weather holds. It is a real TurnModel (pure, seeded, forked streams), small
 * enough to reason about in a test.
 */
import { event, type SimEvent } from '../src/events.ts';
import type { Rng } from '../src/rng.ts';
import type { PlanIssue, TurnModel, WorldSetup } from '../src/turns.ts';

export interface OrchardState {
  turn: number;
  seat: number;
  seats: number;
  trees: number[];
  apples: number[];
  length: number;
}

export interface OrchardPlan {
  sell: number;
  plant: number;
}

export const ORCHARD_YEARS = 6;

export const orchard: TurnModel<OrchardState, OrchardPlan> = {
  init(setup: WorldSetup) {
    const generous = setup.scenario === 'generous';
    return {
      turn: 1,
      seat: 0,
      seats: setup.seats,
      trees: Array.from({ length: setup.seats }, () => (generous ? 20 : 10)),
      apples: Array.from({ length: setup.seats }, () => 100),
      length: ORCHARD_YEARS,
    };
  },

  draft: (state) => ({
    sell: 0,
    plant: Math.min(2, Math.floor((state.apples[state.seat] ?? 0) / 10)),
  }),

  validate(state, plan) {
    const issues: PlanIssue[] = [];
    const apples = state.apples[state.seat] ?? 0;
    if (plan.sell < 0 || plan.plant < 0) {
      issues.push({ message: 'Numbers cannot be negative', level: 'error' });
    }
    if (plan.sell + plan.plant * 10 > apples) {
      issues.push({ field: 'plant', message: 'Not enough apples', level: 'error' });
    }
    if (plan.plant === 0)
      issues.push({ field: 'plant', message: 'No new trees', level: 'warning' });
    return issues;
  },

  resolve(state, plan, rng: Rng) {
    const seat = state.seat;
    const events: SimEvent[] = [];
    const weather = rng.fork('weather');
    const pests = rng.fork('pests');
    const trees = (state.trees[seat] ?? 0) + plan.plant;
    const perTree = weather.int(2, 6);
    let apples = (state.apples[seat] ?? 0) - plan.sell - plan.plant * 10 + trees * perTree;
    events.push(
      event('harvest', perTree >= 5 ? 'good' : 'neutral', { perTree, total: trees * perTree }),
    );
    if (pests.chance(0.25)) {
      const eaten = Math.floor(apples * pests.float(0.1, 0.4));
      apples -= eaten;
      events.push(
        event('pests', eaten > 50 ? 'disaster' : 'warning', { eaten }, { codex: 'pests' }),
      );
    }
    const nextSeat = (seat + 1) % state.seats;
    return {
      state: {
        ...state,
        turn: nextSeat === 0 ? state.turn + 1 : state.turn,
        seat: nextSeat,
        trees: state.trees.map((value, index) => (index === seat ? trees : value)),
        apples: state.apples.map((value, index) => (index === seat ? apples : value)),
      },
      events,
    };
  },

  signals: (state, seat) => ({ trees: state.trees[seat] ?? 0, apples: state.apples[seat] ?? 0 }),

  position: (state) => ({ turn: state.turn, seat: state.seat }),

  outcome(state) {
    if (state.turn <= state.length) return null;
    const apples = state.apples[0] ?? 0;
    return {
      ending: 'seasons-done',
      verdict:
        apples > 400
          ? { id: 'bountiful', label: 'Bountiful', tier: 5 }
          : { id: 'modest', label: 'Modest', tier: 3 },
    };
  },
};

/** A steady player: always plants two trees when it can afford them. */
export function steadyPlans(count: number): OrchardPlan[] {
  return Array.from({ length: count }, () => ({ sell: 0, plant: 2 }));
}
