/**
 * The opening of a realm's year: weather, rats, the harvest, what the
 * people need, and the prices of grain and land.
 *
 * Weather, rats and the grain price follow the 1978 program. The harvest,
 * the demand and the land price were lost from the conversion this game
 * reconstructs (docs/NOTES.md, "Lost economy lines"), so they are designed
 * here, each as one named function, and tuned with bots.
 */
import type { Rng } from '@one-more-year/kit';
import {
  HARVEST_SPREAD,
  HECTARES_PER_SERF,
  LAND_BASE,
  RATIONS,
  RATS_MAX_PERCENT,
  SCARCITY,
  SERFS_PER_MILL,
  YIELD_BY_WEATHER,
} from './rules.ts';
import { clamp, rollUpTo, whole } from './numbers.ts';
import type { Holdings, People, Weather } from './state.ts';

/**
 * original: two dice, one of five faces and one of six, averaged and
 * rounded to a grade from 1 (drought) to 5 (excellent). The grades come up
 * 3, 7, 10, 7 and 3 times in 30: a fair year is the most common, a drought
 * or an excellent year one in ten.
 */
export function rollWeather(rng: Rng): Weather {
  const sum = rollUpTo(rng, 5) + rollUpTo(rng, 6);
  // (sum − 1) ÷ 2 lands on halves; the program rounded them up.
  return Math.ceil((sum - 1) / 2) as Weather;
}

/** original: rats eat 1–50 % of the reserves, every year. */
export function rollRats(rng: Rng, grain: number): { percent: number; ate: number } {
  const percent = rollUpTo(rng, RATS_MAX_PERCENT);
  const left = whole((grain * (100 - percent)) / 100);
  return { percent, ate: grain - left };
}

/** original: serfs not working in the mills can each plough a few hectares; the land caps it. */
export function workedHectares(people: People, holdings: Holdings, land: number): number {
  const farmers = Math.max(0, people.serfs - holdings.mills * SERFS_PER_MILL);
  return Math.min(land, farmers * HECTARES_PER_SERF);
}

/**
 * designed: the harvest is the worked land times the weather's yield, give
 * or take a tenth. A drought brings in barely a quarter of a fair year.
 * `soil` is the scenario's yield factor (1 in the 1978 valley).
 */
export function harvestFor(worked: number, weather: Weather, rng: Rng, soil = 1): number {
  const perHectare = (YIELD_BY_WEATHER[weather - 1] ?? 0) * soil;
  const spread = 1 - HARVEST_SPREAD + rng.next() * HARVEST_SPREAD * 2;
  return Math.floor(worked * perHectare * spread);
}

/** designed: the bushels a year's people eat, class by class. */
export function demandFor(people: People): number {
  return (
    people.serfs * RATIONS.serfs +
    people.soldiers * RATIONS.soldiers +
    people.merchants * RATIONS.merchants +
    people.clergy * RATIONS.clergy +
    people.nobles * RATIONS.nobles
  );
}

/**
 * original: scarcity is demand over harvest, held between 0.8 and 2; with
 * no harvest at all it is 2.
 */
export function scarcityOf(demand: number, harvest: number): number {
  if (harvest <= 0) return SCARCITY.most;
  return clamp(demand / harvest, SCARCITY.least, SCARCITY.most);
}

/**
 * original: florins per 1,000 bushels. Dear in bad weather and when grain is
 * scarce: (3 × (6 − grade) + two dice of five) ÷ 5 × scarcity × 20.
 */
export function grainPriceFor(weather: Weather, scarcity: number, rng: Rng): number {
  const dice = rollUpTo(rng, 5) + rollUpTo(rng, 5);
  return whole((((6 - weather) * 3 + dice) / 5) * scarcity * 20);
}

/**
 * designed: florins per hectare, to one decimal. A base drawn each year
 * between 1 and 2, times the same scarcity that moves the grain price,
 * so a bad harvest makes land dear. Never below 0.3, never zero.
 */
export function landPriceFor(scarcity: number, rng: Rng): number {
  const base = LAND_BASE.low + rng.next() * (LAND_BASE.high - LAND_BASE.low);
  return Math.max(0.3, Math.floor(base * scarcity * 10) / 10);
}
