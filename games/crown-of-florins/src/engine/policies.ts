/**
 * How the AI rivals rule, and the bots the balance tests use.
 *
 * Every rival plays by the same rules and through the same plan a human
 * fills in. A policy sees exactly what a human in that seat sees: its own
 * realm in full, this year's opening, and the standings the whole valley
 * published at the end of last year. It never sees a rival's live numbers
 * or its own ruler's last year.
 *
 * One careful way of ruling (`steward`) is shaped by a personality's
 * leanings: how much bread to give, what to tax, what to build first and
 * how many soldiers to keep.
 */
import type { Rng } from '@one-more-year/kit';
import {
  BANKRUPTCY_PER_TITLE,
  BUILDINGS,
  INVASION,
  MARKET_RENT,
  MILL_BASE,
  MILL_ROLL,
  PILLAR_CAP,
  RELEASE_MAX_SHARE,
  SERFS_PER_MILL,
  SOLDIER_PAY,
} from './rules.ts';
import { releaseBounds, sellableLand, NO_CONSTRUCTION } from './plan.ts';
import { revenueFor } from './taxes.ts';
import { earnedTitle, titlePoints } from './title.ts';
import { titleInputs } from './year.ts';
import type { Terms } from './scenarios.ts';
import type {
  Construction,
  Difficulty,
  Justice,
  Personality,
  Plan,
  Realm,
  Standing,
} from './state.ts';

export type BuildKind = 'markets' | 'mills' | 'palace' | 'cathedral';

export interface Leanings {
  /** Bread as a multiple of demand (1.3 draws newcomers). */
  bread: number;
  customs: number;
  sales: number;
  wealth: number;
  /** The justice seal it prefers; 'earned' lowers it to 1 when that wins a title. */
  justice: Justice | 'earned';
  /** Florins kept back before building. */
  keep: number;
  /** Soldiers kept per 1,000 hectares. */
  guard: number;
  /** Extra soldiers beyond what the land and rivals require. */
  standingArmy: number;
  /** What to build first. */
  order: readonly BuildKind[];
  /** Whether it saves for its first choice instead of buying something cheaper meanwhile. */
  saves: boolean;
  /** Whether it buys land for idle hands. */
  buysLand: boolean;
}

export const LEANINGS: Readonly<Record<Personality | 'steward' | 'naive', Leanings>> = {
  steward: {
    bread: 1.32,
    customs: 25,
    sales: 9,
    wealth: 6,
    justice: 'earned',
    keep: 600,
    guard: 1.1,
    standingArmy: 0,
    order: ['markets', 'mills', 'palace', 'cathedral'],
    saves: false,
    buysLand: true,
  },
  merchant: {
    bread: 1.32,
    customs: 15,
    sales: 12,
    wealth: 5,
    justice: 2,
    keep: 800,
    guard: 1.05,
    standingArmy: 0,
    order: ['markets', 'mills', 'palace', 'cathedral'],
    saves: false,
    buysLand: true,
  },
  general: {
    bread: 1.32,
    customs: 30,
    sales: 10,
    wealth: 8,
    justice: 3,
    keep: 400,
    guard: 1.8,
    standingArmy: 10,
    order: ['markets', 'palace', 'mills', 'cathedral'],
    saves: false,
    buysLand: true,
  },
  builder: {
    bread: 1.32,
    customs: 30,
    sales: 12,
    wealth: 8,
    justice: 2,
    keep: 300,
    guard: 1.1,
    standingArmy: 0,
    order: ['palace', 'cathedral', 'markets', 'mills'],
    saves: true,
    buysLand: true,
  },
  miser: {
    bread: 1.32,
    customs: 35,
    sales: 15,
    wealth: 12,
    justice: 3,
    keep: 5000,
    guard: 1.05,
    standingArmy: 0,
    order: ['markets', 'mills', 'palace', 'cathedral'],
    saves: false,
    buysLand: true,
  },
  saint: {
    bread: 1.5,
    customs: 25,
    sales: 9,
    wealth: 5,
    justice: 1,
    keep: 300,
    guard: 1.1,
    standingArmy: 0,
    order: ['cathedral', 'markets', 'palace', 'mills'],
    saves: true,
    buysLand: true,
  },
  naive: {
    bread: 1,
    customs: 25,
    sales: 10,
    wealth: 5,
    justice: 2,
    keep: Number.POSITIVE_INFINITY,
    guard: 1,
    standingArmy: 0,
    order: [],
    saves: false,
    buysLand: false,
  },
};

export interface PolicyView {
  realm: Realm;
  difficulty: Difficulty;
  standings: readonly Standing[];
  terms: Terms;
}

/** How a rival carries its leanings: whether it hunts the weak, and how often it has an off year. */
export interface Temper {
  aggressive: boolean;
  /** The chance of a year planned without care: no building, no land, bread only to demand. */
  lapse: number;
}

export const STEADY: Temper = { aggressive: false, lapse: 0 };

/** designed: an aggressive rival keeps at most this many soldiers per 1,000 of its hectares. */
export const HUNTER_PER_THOUSAND = 6;

/**
 * designed: difficulty also sharpens the rivals. An Apprentice's rivals have
 * an off year in three, a Grand Master's never do.
 */
export function rivalLapse(difficulty: Difficulty): number {
  return [0.3, 0.1, 0.03, 0][difficulty - 1] ?? 0;
}

/**
 * The careful ruler, bent by a personality's leanings. A year is planned
 * the way a sensible player would: count the money the year will bring,
 * keep the guard strong enough, feed the people before anything else,
 * draw newcomers when the grain for them is affordable, sell a glut,
 * buy fields for idle hands, and build with what is left — never planning
 * to sink far toward the creditors.
 */
export function steward(
  view: PolicyView,
  leanings: Leanings,
  rng: Rng,
  temper: Temper = STEADY,
): Plan {
  const { realm } = view;
  const opening = realm.opening;
  if (!opening) throw new Error('A policy needs the year opened');
  const offYear = temper.lapse > 0 && rng.fork('lapse').chance(temper.lapse);
  const demand = opening.demand;
  const perBushel = opening.grainPrice / 1000;
  const justice = chooseJustice(view, leanings);
  const taxes = {
    customs: leanings.customs,
    sales: leanings.sales,
    wealth: leanings.wealth,
    justice,
  };

  // The year's money, counted cautiously: taxes on today's people, rent, a modest year at the mills.
  const { terms } = view;
  const income =
    revenueFor(realm.people, realm.prosperity, taxes, realm.title, terms.customsFactor).total *
      0.9 +
    realm.holdings.markets * MARKET_RENT * terms.marketRentFactor +
    realm.holdings.mills * (MILL_BASE + MILL_ROLL / 2) * 0.8 -
    realm.people.soldiers * SOLDIER_PAY;
  // A careful ruler borrows for bread only, never more than a fifth of the way to the creditors and
  // never more than most of a year's income: past that, half-yearly interest outruns the taxes.
  const floor = Math.max(-BANKRUPTCY_PER_TITLE * realm.title * 0.2, -Math.max(0, income) * 0.8);
  // Keep back enough to buy half a year's bread at today's price, should the next harvest fail.
  const keep = leanings.keep + demand * perBushel * 0.5;
  let cash = realm.treasury + income;

  const build: Construction = { ...NO_CONSTRUCTION };
  // Soldiers first: enough for the land and to stand against every rival.
  // An aggressive rival arms to stand more than 2.4 times over the weakest realm, so that
  // realm's gates open to it: a platoon a year at most, and no more than its land can feed.
  const weakest = temper.aggressive ? weakestRival(realm.seat, view.standings) : null;
  const hunt = weakest
    ? Math.min(
        Math.floor(weakest.soldiers * INVASION.rivalRatio) + 1,
        realm.people.soldiers + BUILDINGS.platoon.soldiers,
        Math.ceil((realm.land / 1000) * HUNTER_PER_THOUSAND),
      )
    : 0;
  // Both rules of the border must hold: enough soldiers for the land, and no rival more than 2.4
  // times as strong, with a margin for what the published army may add before the next count.
  const soldiersFor = (land: number): number =>
    Math.max(
      Math.ceil((land / 1000) * leanings.guard) + leanings.standingArmy,
      guardAgainstRivals(realm.seat, view.standings),
      hunt,
    );
  const short = soldiersFor(realm.land) - realm.people.soldiers;
  if (short > 0) {
    build.platoons = Math.min(
      Math.ceil(short / BUILDINGS.platoon.soldiers),
      Math.floor(realm.people.serfs / BUILDINGS.platoon.soldiers / 4),
    );
    cash -= build.platoons * BUILDINGS.platoon.cost;
  }

  // Bread: feed everyone (the release must be at most four fifths of the store), paying for it
  // from the treasury and this year's income, but never by sinking toward the creditors.
  let grain = Math.max(0, Math.ceil(demand / RELEASE_MAX_SHARE) - realm.grain);
  grain = Math.min(grain, Math.max(0, Math.floor((cash - floor) / perBushel)));
  cash -= grain * perBushel;
  let release = Math.min(demand, Math.floor((realm.grain + grain) * RELEASE_MAX_SHARE));
  // Newcomers, when the extra bread is affordable.
  const wanted = Math.ceil(demand * leanings.bread);
  if (wanted > demand && release >= demand && !offYear) {
    const extra = Math.max(0, Math.ceil(wanted / RELEASE_MAX_SHARE) - (realm.grain + grain));
    const extraCost = extra * perBushel;
    if (extraCost <= Math.max(0, cash - keep) * 0.7) {
      grain += extra;
      cash -= extraCost;
      release = wanted;
    }
  }
  // Cheap grain is laid by against a bad year, despite the rats; a real glut is sold.
  const left = realm.grain + grain - release;
  if (opening.grainPrice <= 45 && left < demand * 0.9 && cash - keep > 0) {
    const stock = Math.min(
      Math.ceil(demand * 0.9 - left),
      Math.floor(((cash - keep) * 0.4) / perBushel),
    );
    grain += stock;
    cash -= stock * perBushel;
  } else if (grain === 0 && left > demand * 2 && opening.grainPrice >= 60) {
    const sold = Math.floor(left - demand * 1.5);
    grain = -sold;
    cash += sold * perBushel;
  }

  // Land: in deep debt, sell outer fields before the interest compounds; otherwise buy fields for
  // idle hands, as far as the guard and the purse allow.
  let land = 0;
  if (cash < floor) {
    const toCover = Math.ceil((floor - cash) / Math.max(0.3, opening.landPrice));
    land = -Math.min(sellableLand(realm), toCover);
    cash -= land * opening.landPrice;
  } else if (leanings.buysLand && terms.landForSale && !offYear) {
    const hands = Math.max(0, realm.people.serfs - realm.holdings.mills * SERFS_PER_MILL) * 5;
    const idle = hands - realm.land;
    const guarded = realm.people.soldiers * INVASION.hectaresPerSoldier - realm.land;
    const affordable = Math.floor(Math.max(0, cash - keep) / Math.max(0.3, opening.landPrice) / 2);
    land = Math.max(0, Math.min(idle, guarded - 50, affordable));
    cash -= land * opening.landPrice;
  } else if (realm.people.soldiers * INVASION.hectaresPerSoldier < realm.land) {
    // Without enough guards, sell the outer fields rather than invite an army.
    land = -Math.min(
      sellableLand(realm),
      realm.land - realm.people.soldiers * INVASION.hectaresPerSoldier,
    );
    cash -= land * opening.landPrice;
  }

  const { least, most } = releaseBounds(realm.grain + grain);
  release = Math.min(most, Math.max(least, release));
  let purse = cash - keep;

  const prices: Record<BuildKind, number> = {
    markets: BUILDINGS.market.cost,
    mills: BUILDINGS.mill.cost,
    palace: BUILDINGS.palace.cost,
    cathedral: BUILDINGS.cathedral.cost,
  };
  const held = { ...realm.holdings };
  let guard = 0;
  while (purse > 0 && !offYear && guard++ < 40) {
    const wanted = leanings.order.filter((kind) => held[kind] < PILLAR_CAP);
    // A saver waits for its first choice once the purse holds half its price; until then, and
    // for everyone else, the purse goes to whatever it reaches.
    const first = wanted[0];
    const saving =
      leanings.saves && first !== undefined && prices[first] > purse && prices[first] <= purse * 2;
    const next = saving ? undefined : wanted.find((kind) => prices[kind] <= purse);
    if (!next) break;
    build[next] += 1;
    held[next] += 1;
    purse -= prices[next];
    // A little variety between years, from the rival's own stream.
    if (rng.chance(0.15)) break;
  }

  return { grain, land, release, ...taxes, build };
}

/** 'earned': very fair justice only when it wins a title this year; otherwise moderate. */
function chooseJustice(view: PolicyView, leanings: Leanings): Justice {
  if (leanings.justice !== 'earned') return leanings.justice;
  const points = titlePoints(titleInputs(view.realm));
  const fair = earnedTitle(points, 1, view.difficulty);
  const moderate = earnedTitle(points, 2, view.difficulty);
  return fair > Math.max(view.realm.title, moderate) ? 1 : 2;
}

/**
 * Soldiers enough that no rival stands more than 2.4 times over this realm
 * at the next count. The published army may grow before then, by a platoon
 * or by a sixth, whichever is more, so the careful ruler counts that in.
 */
function guardAgainstRivals(seat: number, standings: readonly Standing[]): number {
  let needed = 0;
  for (const rival of standings) {
    if (rival.seat === seat || rival.status === 'ended') continue;
    const expected = Math.max(rival.soldiers * 1.15, rival.soldiers + BUILDINGS.platoon.soldiers);
    needed = Math.max(needed, Math.ceil(expected / INVASION.rivalRatio) + 1);
  }
  return needed;
}

/** The realm with the smallest army, other than this one. */
function weakestRival(seat: number, standings: readonly Standing[]): Standing | null {
  let weakest: Standing | null = null;
  for (const rival of standings) {
    if (rival.seat === seat || rival.status === 'ended') continue;
    if (!weakest || rival.soldiers < weakest.soldiers) weakest = rival;
  }
  return weakest;
}

export function policyFor(
  personality: Personality | 'steward' | 'naive',
  temper: Temper = STEADY,
): (view: PolicyView, rng: Rng) => Plan {
  const leanings = LEANINGS[personality];
  return (view, rng) => steward(view, leanings, rng, temper);
}
