/**
 * Every number the engine uses, in one place, each marked as kept from the
 * 1978 program ("original", verified in docs/NOTES.md) or designed for this
 * game ("designed", tuned with bots and recorded in NOTES.md).
 *
 * The formulas that use these numbers live in economy.ts, people.ts,
 * taxes.ts, invasion.ts, title.ts and lifespan.ts; nothing else in the
 * engine hard-codes a rule.
 */

/** original: every game opens in this year. */
export const FIRST_YEAR = 1400;

/** original: what each realm begins with. */
export const START = {
  serfs: 2000,
  soldiers: 25,
  merchants: 25,
  clergy: 5,
  nobles: 4,
  land: 10_000,
  grain: 5000,
  treasury: 1000,
  customs: 25,
  sales: 10,
  wealth: 5,
  justice: 2,
  prosperity: 1,
  title: 1,
} as const;

/** original: the limits of each tax, in percent. */
export const TAX_LIMITS = {
  customs: { min: 0, max: 100 },
  sales: { min: 0, max: 50 },
  wealth: { min: 0, max: 25 },
} as const;

/** original: the four justice levels, from very fair (1) to outrageous (4). */
export const JUSTICE_LEVELS = [1, 2, 3, 4] as const;

/** original: grain released must lie between these shares of the reserves. */
export const RELEASE_MIN_SHARE = 0.2;
export const RELEASE_MAX_SHARE = 0.8;

/** original: hectares a realm always keeps; it cannot be sold and invaders never take it. */
export const CORE_LAND = 5000;

/** original: each serf can work this many hectares, and each mill takes this many serfs. */
export const HECTARES_PER_SERF = 5;
export const SERFS_PER_MILL = 100;

/** original: the cost and immediate effects of each purchase. */
export const BUILDINGS = {
  market: { cost: 1000, merchants: 5, prosperity: 0.1 },
  mill: { cost: 2000, prosperity: 0.25 },
  palace: { cost: 3000, prosperity: 0.5, noblesUpTo: 2 },
  cathedral: { cost: 5000, prosperity: 1, clergyUpTo: 6 },
  platoon: { cost: 500, soldiers: 20 },
} as const;

/** original: yearly income and upkeep. */
export const MARKET_RENT = 75;
export const MILL_BASE = 55;
export const MILL_ROLL = 250;
export const SOLDIER_PAY = 3;

/** original: interest multiplies a negative treasury each year. */
export const DEBT_INTEREST = 1.5;
/** original: creditors arrive below −(this × title) florins. */
export const BANKRUPTCY_PER_TITLE = 10_000;

/** original: what creditors leave behind. */
export const AFTER_BANKRUPTCY = {
  land: 6000,
  prosperity: 1,
  treasury: 100,
  grain: 4000,
} as const;

/** original: rats eat between 1 and this percent of the reserves every year. */
export const RATS_MAX_PERCENT = 50;

/** original: births and deaths, as the largest yearly percent of serfs (each rolled from 1). */
export const PEOPLE_ROLLS = {
  fedBirths: 7,
  fedDeaths: 3,
  hungryBirths: 3,
  /** Hungry deaths roll up to (shortfall% − 9) + this. */
  hungryDeathsBase: 8,
  /** The shortfall share above which merchants leave and the death roll stops growing. */
  shortfallCap: 65,
  /** A famine that kills more than this many serfs halves prosperity. */
  faminePanic: 1000,
} as const;

/** original: immigration needs at least this share of demand released. */
export const IMMIGRATION_THRESHOLD = 1.3;
export const IMMIGRATION_CAP = 32_000;
export const IMMIGRATION_PROSPERITY = 0.5;
export const IMMIGRANT_MERCHANTS_MAX = 50;

/** original: merchants drift in while customs and sales together stay below this. */
export const LOW_TAX_MERCHANTS_BELOW = 35;

/** original: the title review. */
export const PILLAR_CAP = 10;
export const TOP_TITLE = 8;

/** original: lifetimes. The first rulers die between 1421 and 1455; old age is named only after 1450. */
export const LIFESPAN = { least: 20, roll: 35, oldAgeAfter: 50 } as const;

/** original: invasions. */
export const INVASION = {
  /** A realm needs a soldier for every this many hectares. */
  hectaresPerSoldier: 1000,
  /** A rival this many times stronger is a threat. */
  rivalRatio: 2.4,
  /** A rival can march only with this many soldiers per 1000 of its own hectares. */
  spareRatio: 1.2,
  /** Mercenaries seize 1,001–10,000 hectares. */
  mercenaryBase: 1000,
  mercenaryRoll: 9000,
  /** Soldiers lost in battle: 1–40, never below the garrison. */
  lossRoll: 40,
  garrison: 15,
} as const;

/** original: the four difficulty levels divide title points by level + 5. */
export const DIFFICULTY_OFFSET = 5;

// ---- designed for this game (the 1978 conversion lost these lines) -----------

/**
 * designed: grain each class eats in a year, in bushels. Demand is the sum,
 * so releasing less starves people and releasing more draws newcomers.
 */
export const RATIONS = {
  serfs: 12,
  soldiers: 18,
  merchants: 24,
  clergy: 24,
  nobles: 48,
} as const;

/** designed: bushels a worked hectare yields, by weather grade 1 (drought) to 5 (excellent). */
export const YIELD_BY_WEATHER = [0.72, 1.68, 2.64, 3.6, 4.56] as const;

/** designed: the harvest varies by up to this share either way within a grade. */
export const HARVEST_SPREAD = 0.1;

/** designed: the land price's yearly base, florins per hectare, before scarcity. */
export const LAND_BASE = { low: 1.0, high: 2.0 } as const;

/** original: scarcity (demand ÷ harvest) is held between these, and a realm with no harvest uses the top. */
export const SCARCITY = { least: 0.8, most: 2 } as const;
