/**
 * A ruler's plan for the year: what the five steps open with, what is
 * allowed, and the issues the screen shows beside each control.
 *
 * The limits are the 1978 program's: grain cannot be sold beyond the
 * reserves, land not below the 5,000 hectares inside the walls, the
 * release must lie between a fifth and four fifths of the reserves, and
 * each tax has its range. Spending beyond the treasury is allowed, as it
 * was then: it is debt, with interest and a bankruptcy line, and the
 * screen says so before the year is sealed.
 */
import type { PlanIssue } from '@one-more-year/kit';
import { BUILDINGS, CORE_LAND, RELEASE_MAX_SHARE, RELEASE_MIN_SHARE, TAX_LIMITS } from './rules.ts';
import { clamp } from './numbers.ts';
import { VALLEY_TERMS, type Terms } from './scenarios.ts';
import type { Construction, Justice, Plan, Realm } from './state.ts';

export const NO_CONSTRUCTION: Construction = {
  markets: 0,
  mills: 0,
  palace: 0,
  cathedral: 0,
  platoons: 0,
};

/** Reserves after the plan's grain trade: what the release is measured against. */
export function reservesAfterTrade(realm: Realm, plan: Pick<Plan, 'grain'>): number {
  return realm.grain + plan.grain;
}

export function releaseBounds(reserves: number): { least: number; most: number } {
  const least = Math.ceil(Math.max(0, reserves) * RELEASE_MIN_SHARE);
  const most = Math.floor(Math.max(0, reserves) * RELEASE_MAX_SHARE);
  return { least, most: Math.max(least, most) };
}

/** Hectares that may be sold: everything beyond the walls' core. */
export function sellableLand(realm: Realm): number {
  return Math.max(0, realm.land - CORE_LAND);
}

/** The plan the steps open with: no trades, bread to meet demand if the reserves allow, last year's rates. */
export function openingPlan(realm: Realm): Plan {
  const demand = realm.opening?.demand ?? 0;
  const { least, most } = releaseBounds(realm.grain);
  return {
    grain: 0,
    land: 0,
    release: clamp(demand, least, most),
    customs: realm.taxes.customs,
    sales: realm.taxes.sales,
    wealth: realm.taxes.wealth,
    justice: realm.taxes.justice,
    build: { ...NO_CONSTRUCTION },
  };
}

/**
 * The plan a player's year screen opens with: the opening plan, but if the
 * granary is too small to release what the people need (at most four fifths
 * may go out), it buys the difference when the treasury can pay for it. The
 * bots keep the bare opening plan; this is only a kinder first draft.
 */
export function feedingPlan(realm: Realm): Plan {
  const plan = openingPlan(realm);
  const demand = realm.opening?.demand ?? 0;
  const price = (realm.opening?.grainPrice ?? 0) / 1000;
  if (plan.release >= demand || price <= 0) return plan;
  const buy = Math.max(0, Math.ceil(demand / RELEASE_MAX_SHARE) - realm.grain);
  if (Math.round(buy * price) > Math.max(0, realm.treasury)) return plan;
  return { ...plan, grain: buy, release: demand };
}

export function constructionCost(build: Construction): number {
  return (
    build.markets * BUILDINGS.market.cost +
    build.mills * BUILDINGS.mill.cost +
    build.palace * BUILDINGS.palace.cost +
    build.cathedral * BUILDINGS.cathedral.cost +
    build.platoons * BUILDINGS.platoon.cost
  );
}

export function validatePlan(realm: Realm, plan: Plan, terms: Terms = VALLEY_TERMS): PlanIssue[] {
  const issues: PlanIssue[] = [];
  const whole = (value: number): boolean => Number.isInteger(value);
  if (!whole(plan.grain) || !whole(plan.land) || !whole(plan.release)) {
    issues.push({ message: 'Amounts must be whole numbers.', level: 'error' });
  }
  if (plan.land > 0 && !terms.landForSale) {
    issues.push({
      field: 'land',
      message: 'No one here sells land: the harbour town has all it will ever have.',
      level: 'error',
    });
  }
  if (plan.grain < -realm.grain) {
    issues.push({
      field: 'grain',
      message: `You can sell at most ${realm.grain} bushels.`,
      level: 'error',
    });
  }
  if (plan.land < -sellableLand(realm)) {
    issues.push({
      field: 'land',
      message: `The walls keep ${CORE_LAND} hectares; you can sell at most ${sellableLand(realm)}.`,
      level: 'error',
    });
  }
  const { least, most } = releaseBounds(reservesAfterTrade(realm, plan));
  if (plan.release < least) {
    issues.push({
      field: 'release',
      message: `Release at least ${least} bushels, a fifth of the reserves.`,
      level: 'error',
    });
  } else if (plan.release > most) {
    issues.push({
      field: 'release',
      message: `Release at most ${most} bushels; a fifth must stay in store.`,
      level: 'error',
    });
  }
  for (const tax of ['customs', 'sales', 'wealth'] as const) {
    const { min, max } = TAX_LIMITS[tax];
    if (plan[tax] < min || plan[tax] > max || !whole(plan[tax])) {
      issues.push({
        field: tax,
        message: `${tax} must be a whole percent from ${min} to ${max}.`,
        level: 'error',
      });
    }
  }
  if (![1, 2, 3, 4].includes(plan.justice)) {
    issues.push({
      field: 'justice',
      message: 'Choose one of the four seals of justice.',
      level: 'error',
    });
  }
  for (const kind of ['markets', 'mills', 'palace', 'cathedral', 'platoons'] as const) {
    const count = plan.build[kind];
    if (!whole(count) || count < 0) {
      issues.push({
        field: `build.${kind}`,
        message: 'Build whole numbers of things.',
        level: 'error',
      });
    }
  }
  if (plan.build.platoons * BUILDINGS.platoon.soldiers > realm.people.serfs) {
    issues.push({
      field: 'build.platoons',
      message: 'There are not enough serfs to arm.',
      level: 'error',
    });
  }
  return issues;
}

/** The plan with every number pulled inside its limits (for rivals, and for safety). */
export function legalPlan(realm: Realm, plan: Plan, terms: Terms = VALLEY_TERMS): Plan {
  const grain = Math.max(-realm.grain, Math.trunc(plan.grain));
  const mostLand = terms.landForSale ? Number.POSITIVE_INFINITY : 0;
  const land = Math.min(mostLand, Math.max(-sellableLand(realm), Math.trunc(plan.land)));
  const { least, most } = releaseBounds(realm.grain + grain);
  const count = (value: number): number => Math.max(0, Math.trunc(value));
  const platoons = Math.min(
    count(plan.build.platoons),
    Math.floor(realm.people.serfs / BUILDINGS.platoon.soldiers),
  );
  return {
    grain,
    land,
    release: clamp(Math.trunc(plan.release), least, most),
    customs: clamp(Math.round(plan.customs), TAX_LIMITS.customs.min, TAX_LIMITS.customs.max),
    sales: clamp(Math.round(plan.sales), TAX_LIMITS.sales.min, TAX_LIMITS.sales.max),
    wealth: clamp(Math.round(plan.wealth), TAX_LIMITS.wealth.min, TAX_LIMITS.wealth.max),
    justice: clamp(Math.round(plan.justice), 1, 4) as Justice,
    build: {
      markets: count(plan.build.markets),
      mills: count(plan.build.mills),
      palace: count(plan.build.palace),
      cathedral: count(plan.build.cathedral),
      platoons,
    },
  };
}
