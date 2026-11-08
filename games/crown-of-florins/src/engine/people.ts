/**
 * Bread for the people: what releasing grain does to the city's classes.
 *
 * All original rules, with two conversion bugs fixed (docs/NOTES.md):
 * newcomers are decided by the grain released, not by the wealth tax, and
 * a famine's death roll stops growing at the cap the program set but never
 * applied.
 *
 * - Fed (release at least demand − 1): 1–7 % of serfs are born, 1–3 % die.
 * - Customs plus sales below 35 %: 1–4 merchants move in.
 * - Release at least 130 % of demand: newcomers, scaled by the surplus and
 *   the city's size, plus merchants (up to 50), a noble and two clergy, and
 *   prosperity rises by half a point.
 * - Hungry: 1–3 % born, and up to (shortfall − 9 % + 8 %) die; past a 74 %
 *   shortfall half the merchants leave; more than 1,000 dead halves
 *   prosperity.
 * - Harsh or outrageous justice: up to 1 % or 4 % of serfs flee.
 */
import type { Rng } from '@one-more-year/kit';
import {
  IMMIGRANT_MERCHANTS_MAX,
  IMMIGRATION_CAP,
  IMMIGRATION_PROSPERITY,
  IMMIGRATION_THRESHOLD,
  LOW_TAX_MERCHANTS_BELOW,
  PEOPLE_ROLLS,
} from './rules.ts';
import { hundredths, rollUpTo, whole } from './numbers.ts';
import type { Justice, People } from './state.ts';

export interface PeopleOutcome {
  people: People;
  prosperity: number;
  births: number;
  deaths: number;
  newcomers: number;
  fled: number;
  merchantsArrived: number;
  merchantsLeft: number;
  noblesArrived: number;
  clergyArrived: number;
  hungry: boolean;
}

export interface Rates {
  customs: number;
  sales: number;
  wealth: number;
  justice: Justice;
}

/** True when the people count as fed: the program allowed one bushel short. */
export function isFed(release: number, demand: number): boolean {
  return release >= demand - 1;
}

/** True when the release draws newcomers (at least 130 % of demand). */
export function drawsNewcomers(release: number, demand: number): boolean {
  return demand > 0 && release >= demand * IMMIGRATION_THRESHOLD;
}

/** The share of demand left unmet, in percent, less the 9 % the people can bear. */
export function shortfallPercent(release: number, demand: number): number {
  if (demand <= 0) return 0;
  return ((demand - release) / demand) * 100 - 9;
}

/** A scenario's pressure on the people: 1 and 1 in the 1978 valley, 2 and 2 in a year of fevers. */
export interface PeopleFactors {
  deaths: number;
  newcomers: number;
}

const ORDINARY: PeopleFactors = { deaths: 1, newcomers: 1 };

export function feedPeople(
  before: People,
  prosperityBefore: number,
  release: number,
  demand: number,
  rates: Rates,
  rng: Rng,
  factors: PeopleFactors = ORDINARY,
): PeopleOutcome {
  const people = { ...before };
  let prosperity = prosperityBefore;
  const out: PeopleOutcome = {
    people,
    prosperity,
    births: 0,
    deaths: 0,
    newcomers: 0,
    fled: 0,
    merchantsArrived: 0,
    merchantsLeft: 0,
    noblesArrived: 0,
    clergyArrived: 0,
    hungry: !isFed(release, demand),
  };

  if (!out.hungry) {
    out.births = percentOfSerfs(people.serfs, rollUpTo(rng, PEOPLE_ROLLS.fedBirths));
    people.serfs += out.births;
    out.deaths = percentOfSerfs(
      people.serfs,
      rollUpTo(rng, PEOPLE_ROLLS.fedDeaths * factors.deaths),
    );
    people.serfs -= out.deaths;
    if (rates.customs + rates.sales < LOW_TAX_MERCHANTS_BELOW) {
      const arrived = rollUpTo(rng, 4);
      people.merchants += arrived;
      out.merchantsArrived += arrived;
    }
    if (drawsNewcomers(release, demand)) {
      const newcomers = whole(
        rollNewcomers(people.serfs, release, demand, rng) * factors.newcomers,
      );
      out.newcomers = newcomers;
      people.serfs += newcomers;
      prosperity = hundredths(prosperity + IMMIGRATION_PROSPERITY);
      const merchants = Math.min(IMMIGRANT_MERCHANTS_MAX, rollUpTo(rng, whole(newcomers / 5)));
      people.merchants += merchants;
      out.merchantsArrived += merchants;
      people.nobles += 1;
      people.clergy += 2;
      out.noblesArrived = 1;
      out.clergyArrived = 2;
    }
  } else {
    const shortfall = shortfallPercent(release, demand);
    if (shortfall > PEOPLE_ROLLS.shortfallCap) {
      const stay = whole(people.merchants / 2);
      out.merchantsLeft = people.merchants - stay;
      people.merchants = stay;
    }
    const deathRoll = Math.max(0, Math.min(PEOPLE_ROLLS.shortfallCap, whole(shortfall)));
    out.births = percentOfSerfs(people.serfs, rollUpTo(rng, PEOPLE_ROLLS.hungryBirths));
    people.serfs += out.births;
    out.deaths = percentOfSerfs(
      people.serfs,
      rollUpTo(rng, deathRoll + PEOPLE_ROLLS.hungryDeathsBase),
    );
    people.serfs -= out.deaths;
    if (out.deaths > PEOPLE_ROLLS.faminePanic) prosperity = hundredths(prosperity / 2);
  }

  out.fled = fleeingSerfs(people.serfs, rates.justice, rng);
  people.serfs -= out.fled;
  out.prosperity = prosperity;
  return out;
}

function percentOfSerfs(serfs: number, percent: number): number {
  return whole((percent * serfs) / 100);
}

/**
 * original (with the released grain in place of the wealth tax): the surplus
 * share × 10, times the city's thousands of serfs, times a die of 25, plus a
 * die of 40, capped at 32,000; then a die of that size.
 */
export function rollNewcomers(serfs: number, release: number, demand: number, rng: Rng): number {
  const thousands = whole(serfs / 1000);
  const surplus = ((release - demand) / demand) * 10;
  const most = Math.min(
    IMMIGRATION_CAP,
    surplus * thousands * rollUpTo(rng, 25) + rollUpTo(rng, 40),
  );
  return rollUpTo(rng, whole(most));
}

/** The most newcomers this release could draw (the top of the dice), for the forecast's range. */
export function mostNewcomers(serfs: number, release: number, demand: number, factor = 1): number {
  if (!drawsNewcomers(release, demand)) return 0;
  const thousands = whole(serfs / 1000);
  const surplus = ((release - demand) / demand) * 10;
  return whole(whole(Math.min(IMMIGRATION_CAP, surplus * thousands * 25 + 40)) * factor);
}

/** original: harsh justice (3) drives off up to 1 % of serfs; outrageous (4) up to 4 %. */
export function fleeingSerfs(serfs: number, justice: Justice, rng: Rng): number {
  if (justice < 3) return 0;
  const most = (serfs / 100) * (justice - 2) * (justice - 2);
  return Math.min(serfs, rollUpTo(rng, most));
}
