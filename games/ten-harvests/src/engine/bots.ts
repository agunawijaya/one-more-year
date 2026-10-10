/**
 * Stewards that play the game by themselves: for the balance tests, for
 * the Hall's demo and for reproducible screenshots. Each is a pure function
 * from the city to a decree; any chance a bot uses comes from the stream it
 * is given, never from Math.random.
 */
import type { Rng } from '@one-more-year/kit';
import { maxSownWith, rulesOf, seedFor, workersLimit, yearOfTerm } from './model.ts';
import { BUSHELS_PER_PERSON } from './rules.ts';
import type { CityState, Decree } from './state.ts';

export type Bot = (state: CityState, rng: Rng) => Decree;

/** The most acres that can be sown with this much grain, this much land and these people. */
function sowable(state: CityState, acres: number, grain: number): number {
  return Math.max(0, Math.min(acres, workersLimit(state.people), maxSownWith(grain)));
}

/**
 * Sows every acre it can, then feeds everyone it can with the rest; never
 * trades land and keeps no reserve. What a first-time player does.
 */
export const naiveBot: Bot = (state) => {
  const plant = sowable(state, state.acres, state.grain);
  const food = Math.min(state.grain - seedFor(plant), state.people * BUSHELS_PER_PERSON);
  return { land: 0, food: Math.max(0, food), plant };
};

/**
 * A careful steward. Seed comes first (an acre sown returns about six times
 * its seed); then it feeds everyone exactly (never more: in the 1978 Ledger
 * that would hide the year from the average), selling land it could not sow
 * anyway rather than let people go hungry, and only in real need the land
 * it could. It keeps a small reserve, a quarter of a year's food, as a
 * prudent person would, though in this model a reserve is what the rats
 * eat. With food, seed and reserve settled it buys land when it is cheap,
 * aiming for ten acres a head by the end of a term.
 */
export const carefulBot: Bot = (state) => {
  const need = state.people * BUSHELS_PER_PERSON;
  let plant = sowable(state, state.acres, state.grain);
  let grain = state.grain - seedFor(plant);
  let land = 0;
  if (grain < need) {
    // First the acres nobody will sow this year, then, to keep hunger well short of a riot, sown ones.
    const idle = state.acres - plant;
    const shortfall = need - grain;
    let sell = Math.min(idle, Math.ceil(shortfall / state.landPrice));
    const stillShort = shortfall - sell * state.landPrice;
    if (stillShort > need * 0.3) {
      const more = Math.ceil((stillShort - need * 0.3) / (state.landPrice + 0.5));
      sell = Math.min(state.acres - 1, sell + more);
    }
    land = -sell;
    plant = Math.min(plant, state.acres - sell);
    grain = state.grain + sell * state.landPrice - seedFor(plant);
  }
  const food = Math.max(0, Math.min(grain, need));
  grain -= food;
  if (land < 0) return { land, food, plant };
  // Give back seed until a quarter-year reserve is left in store.
  const short = Math.max(0, state.people * RESERVE_PER_HEAD - grain);
  const kept = Math.min(plant, short * 2);
  plant -= kept;
  grain += seedFor(plant + kept) - seedFor(plant);
  return { land: landToBuy(state, grain - state.people * RESERVE_PER_HEAD, need), food, plant };
};

/** The careful steward's reserve, in bushels a head: a quarter of a year's ration. */
const RESERVE_PER_HEAD = 5;

/**
 * How much land the careful steward buys with what is left after food,
 * seed and its reserve: more eagerly when land is cheap or the city is short
 * of acres a head, and always leaving another half-year's food untouched.
 */
function landToBuy(state: CityState, spare: number, need: number): number {
  const rules = rulesOf(state);
  const [low, high] = rules.priceRange;
  const cheapness = (high - state.landPrice) / Math.max(1, high - low);
  const perHead = state.acres / Math.max(1, state.people);
  const lateTerm = yearOfTerm(state) >= rules.yearsPerTerm - 2;
  const wanting = perHead < 10.6 || lateTerm;
  const reserve = need * 0.55;
  const share = wanting ? 0.35 + cheapness * 0.55 : cheapness * 0.4;
  const spend = Math.max(0, (spare - reserve) * share);
  return Math.floor(spend / state.landPrice);
}

/** Puts every spare bushel into land, fed or not, as long as the people do not riot. */
export const greedyLandBot: Bot = (state) => {
  const minimumFood = Math.ceil(state.people * 0.56) * BUSHELS_PER_PERSON;
  const food = Math.min(state.grain, minimumFood);
  const afterFood = state.grain - food;
  const plant = sowable(state, state.acres, Math.floor(afterFood * 0.4));
  const spare = afterFood - seedFor(plant);
  return { land: Math.max(0, Math.floor(spare / state.landPrice)), food, plant };
};

/** Decides at random within the rules: the worst steward, useful as a floor. */
export const randomBot: Bot = (state, rng) => {
  const sellOrBuy = rng.next();
  let land = 0;
  if (sellOrBuy < 0.25) land = -rng.int(0, Math.max(0, Math.floor(state.acres * 0.2)));
  else if (sellOrBuy < 0.5) land = rng.int(0, Math.floor((state.grain * 0.3) / state.landPrice));
  const grain = state.grain - land * state.landPrice;
  const food = rng.int(0, Math.max(0, Math.min(grain, state.people * BUSHELS_PER_PERSON * 1.2)));
  const plant = rng.int(0, sowable(state, state.acres + land, grain - food));
  return { land, food: Math.min(food, grain), plant };
};

export const BOTS = {
  naive: naiveBot,
  careful: carefulBot,
  greedy: greedyLandBot,
  random: randomBot,
} as const;

export type BotName = keyof typeof BOTS;
