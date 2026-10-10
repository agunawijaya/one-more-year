/**
 * Pond: the engine. A small pond with fish and weed, eight years long.
 *
 * Each year the player decides how many fish to catch. Then the year
 * happens: the weather (rainy, fair or dry, from its own random stream),
 * perhaps a heron, the fish breed toward what the weed lets the pond hold,
 * the weed grows unless the fish graze it down, and a pond choked with weed
 * may bloom and lose fish. The run ends after eight years or when the fish
 * are gone.
 *
 * This file is the template for every engine in the collection: pure
 * functions only, one forked random stream per kind of chance, and events
 * with numbers instead of sentences. Pond is a test fixture and never
 * ships, but simulation builders read it first, so it stays tidy.
 *
 * The model, as numbers:
 * - weather: rainy 35 %, fair 45 %, dry 20 %; drawn once a year and shared
 *   by every seat in hot-seat play, so rivals face the same skies;
 * - heron: 15 % a year, takes 8–24 fish;
 * - capacity K = 120 + 8·W − 0.09·W² fish for W % weed cover (best near 44 %);
 * - births = r · F · (1 − F / K) with r = 0.55 rainy, 0.40 fair, 0.20 dry,
 *   and none below two fish;
 * - weed grows +12 / +6 / +1 points (rainy / fair / dry) and fish graze
 *   F / 45 points of it;
 * - bloom: above 60 % cover, a (W − 60) / 40 chance (at most 90 %) to lose
 *   20–35 % of the fish.
 */
import {
  event,
  type Outcome,
  type PlanIssue,
  type Rng,
  type SimEvent,
  type TurnModel,
  type WorldSetup,
} from '@one-more-year/kit';

export const YEARS = 8;

export type Weather = 'rainy' | 'fair' | 'dry';

export interface Pond {
  fish: number;
  /** Weed cover, 0–100 %. */
  weed: number;
  /** Fish caught so far this run. */
  caught: number;
  startFish: number;
}

export interface PondState {
  /** The year being planned, 1-based. */
  year: number;
  seat: number;
  seats: number;
  scenario: string;
  /** One pond per seat. */
  ponds: Pond[];
  /** This year's weather once the first seat has acted; null before. */
  weather: Weather | null;
}

export interface PondPlan {
  catch: number;
}

export interface ScenarioStart {
  fish: number;
  weed: number;
}

export const SCENARIO_STARTS: Readonly<Record<string, ScenarioStart>> = {
  'still-water': { fish: 180, weed: 30 },
  overgrown: { fish: 140, weed: 72 },
  'young-pond': { fish: 40, weed: 12 },
};

export const WEATHER_ODDS: readonly { value: Weather; weight: number }[] = [
  { value: 'rainy', weight: 35 },
  { value: 'fair', weight: 45 },
  { value: 'dry', weight: 20 },
];

const BIRTH_RATE: Readonly<Record<Weather, number>> = { rainy: 0.55, fair: 0.4, dry: 0.2 };
const WEED_GROWTH: Readonly<Record<Weather, number>> = { rainy: 12, fair: 6, dry: 1 };
export const HERON_CHANCE = 0.15;
/** Births in one year that count as a spawning run. */
export const SPAWNING_RUN = 30;

/** How many fish the pond can hold at this weed cover. */
export function capacity(weed: number): number {
  return Math.max(10, 120 + 8 * weed - 0.09 * weed * weed);
}

export function bloomChance(weed: number): number {
  return Math.min(0.9, Math.max(0, (weed - 60) / 40));
}

function startOf(scenario: string): ScenarioStart {
  return SCENARIO_STARTS[scenario] ?? (SCENARIO_STARTS['still-water'] as ScenarioStart);
}

export const pondModel: TurnModel<PondState, PondPlan> = {
  init(setup: WorldSetup) {
    const start = startOf(setup.scenario);
    return {
      year: 1,
      seat: 0,
      seats: setup.seats,
      scenario: setup.scenario,
      ponds: Array.from({ length: setup.seats }, () => ({
        fish: start.fish,
        weed: start.weed,
        caught: 0,
        startFish: start.fish,
      })),
      weather: null,
    };
  },

  draft: () => ({ catch: 0 }),

  validate(state, plan) {
    const fish = pondOf(state).fish;
    const issues: PlanIssue[] = [];
    if (!Number.isInteger(plan.catch) || plan.catch < 0) {
      issues.push({
        field: 'catch',
        message: 'The catch must be a whole number of fish.',
        level: 'error',
      });
    } else if (plan.catch > fish) {
      issues.push({
        field: 'catch',
        message: `There are only ${fish} fish in the pond.`,
        level: 'error',
      });
    } else if (plan.catch > fish * 0.4) {
      issues.push({
        field: 'catch',
        message: 'That is more than the pond can replace, even in a wet year.',
        level: 'warning',
      });
    }
    return issues;
  },

  resolve(state, plan, rng: Rng) {
    const events: SimEvent[] = [];
    const seat = state.seat;
    const pond = pondOf(state);
    const weather = state.weather ?? rng.fork('weather').weighted(WEATHER_ODDS);

    let fish = pond.fish - plan.catch;
    if (plan.catch > 0)
      events.push(event('catch', 'neutral', { fish: plan.catch }, { weight: 0.6 }));
    events.push(weatherEvent(weather));

    const heron = rng.fork('heron');
    if (fish > 0 && heron.chance(HERON_CHANCE)) {
      const taken = Math.min(fish, heron.int(8, 24));
      fish -= taken;
      events.push(event('heron', 'warning', { fish: taken }, { codex: 'heron', weight: 2.5 }));
    }

    const births =
      fish >= 2
        ? Math.max(0, Math.round(BIRTH_RATE[weather] * fish * (1 - fish / capacity(pond.weed))))
        : 0;
    fish += births;
    if (births >= SPAWNING_RUN) {
      events.push(
        event('spawning', 'good', { fish: births }, { codex: 'spawning-run', weight: 3 }),
      );
    } else if (births > 0) {
      events.push(event('births', 'good', { fish: births }, { weight: 1 }));
    }

    const weed = clamp(Math.round(pond.weed + WEED_GROWTH[weather] - fish / 45), 0, 100);

    const bloom = rng.fork('bloom');
    if (fish > 0 && bloom.chance(bloomChance(weed))) {
      const lost = Math.round(fish * bloom.float(0.2, 0.35));
      fish -= lost;
      events.push(
        event(
          'bloom',
          lost > 20 ? 'disaster' : 'warning',
          { fish: lost, weed },
          { codex: 'algae-bloom', weight: 4 },
        ),
      );
    }
    if (fish <= 0 && pond.fish > 0) {
      events.push(event('emptied', 'disaster', {}, { weight: 6 }));
    }

    const nextSeat = (seat + 1) % state.seats;
    return {
      state: {
        ...state,
        seat: nextSeat,
        year: nextSeat === 0 ? state.year + 1 : state.year,
        weather: nextSeat === 0 ? null : weather,
        ponds: state.ponds.map((other, index) =>
          index === seat
            ? { ...other, fish: Math.max(0, fish), weed, caught: other.caught + plan.catch }
            : other,
        ),
      },
      events,
    };
  },

  signals(state, seat) {
    const pond = state.ponds[seat] ?? pondOf(state);
    return { fish: pond.fish, weed: pond.weed / 100, caught: pond.caught };
  },

  position: (state) => ({ turn: state.year, seat: state.seat }),

  outcome(state) {
    const allEmpty = state.ponds.every((pond) => pond.fish <= 0);
    if (state.year <= YEARS && !allEmpty) return null;
    return { ending: allEmpty ? 'emptied' : 'eight-years', verdict: verdictFor(state) };
  },
};

function pondOf(state: PondState): Pond {
  return state.ponds[state.seat] ?? (state.ponds[0] as Pond);
}

function weatherEvent(weather: Weather): SimEvent {
  switch (weather) {
    case 'rainy':
      return event('rain', 'good', {}, { weight: 1.2 });
    case 'fair':
      return event('fair', 'neutral', {}, { weight: 0.4 });
    case 'dry':
      return event('dry', 'warning', {}, { codex: 'drought-year', weight: 2 });
  }
}

function verdictFor(state: PondState): Outcome['verdict'] {
  const fish = state.ponds.reduce((sum, pond) => sum + pond.fish, 0);
  const start = state.ponds.reduce((sum, pond) => sum + pond.startFish, 0);
  const caught = state.ponds.reduce((sum, pond) => sum + pond.caught, 0);
  if (fish <= 0) return { id: 'emptied', label: 'Emptied', tier: 1 };
  if (fish < start * 0.5) return { id: 'thinned', label: 'Thinned out', tier: 2 };
  if (fish < start) return { id: 'fished-hard', label: 'Fished hard', tier: 3 };
  if (caught >= 200 * state.seats) return { id: 'thriving', label: 'Thriving water', tier: 5 };
  return { id: 'healthy', label: 'Healthy pond', tier: 4 };
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

/** The daily world's scenario, chosen from the day's seed so everyone gets the same one. */
export function dailyScenario(seed: number): string {
  const ids = Object.keys(SCENARIO_STARTS);
  return ids[seed % ids.length] ?? 'still-water';
}
