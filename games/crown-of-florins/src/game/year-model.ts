/**
 * What the year screen shows about the plan before it is sealed.
 *
 * Two kinds of number. The projection is exact: what the trades and the
 * works cost, what stays in the granary, the land and the border after the
 * trade, the road to the next title with this year's works counted in. The
 * forecast is honest about chance: the acting realm's year is played by the
 * engine's own `playYear` on many sample streams (never the real one), and
 * each number is shown as the range that held in eight of ten of them.
 */
import { forecastMany, forecastSeed, type Forecast, type TurnModel } from '@one-more-year/kit';
import {
  borderWatch,
  debtView,
  roadToTitle,
  type BorderView,
  type DebtView,
  type RoadView,
} from '../engine/glass.ts';
import { lifeView, type LifeView } from '../engine/glass.ts';
import { drawsNewcomers, isFed } from '../engine/people.ts';
import { constructionCost, releaseBounds, sellableLand } from '../engine/plan.ts';
import { playYear, yearStreams } from '../engine/year.ts';
import { actingRealm } from '../engine/world.ts';
import type { Plan, Realm, World } from '../engine/state.ts';
import { TOP_TITLE } from '../engine/rules.ts';
import { titleName } from '../content/names.ts';
import { population } from '../engine/model.ts';

export interface Projection {
  grainCost: number;
  landCost: number;
  buildCost: number;
  /** The treasury after the trades and the works, before this year's income. */
  treasuryAfterSpending: number;
  storeAfterTrade: number;
  storeAfterRelease: number;
  landAfter: number;
  release: { least: number; most: number };
  sellable: number;
  fed: boolean;
  newcomers: boolean;
  road: RoadView;
  border: BorderView;
  debt: DebtView;
  life: LifeView;
}

export function projectPlan(world: World, realm: Realm, plan: Plan): Projection {
  const opening = realm.opening;
  const grainPrice = opening?.grainPrice ?? 0;
  const landPrice = opening?.landPrice ?? 0;
  const grainCost = Math.round((plan.grain * grainPrice) / 1000);
  const landCost = Math.round(plan.land * landPrice);
  const buildCost = constructionCost(plan.build);
  const storeAfterTrade = realm.grain + plan.grain;
  const landAfter = realm.land + plan.land;
  const treasuryAfterSpending = realm.treasury - grainCost - landCost - buildCost;
  const demand = opening?.demand ?? 0;
  const b = plan.build;
  return {
    grainCost,
    landCost,
    buildCost,
    treasuryAfterSpending,
    storeAfterTrade,
    storeAfterRelease: storeAfterTrade - plan.release,
    landAfter,
    release: releaseBounds(storeAfterTrade),
    sellable: sellableLand(realm),
    fed: isFed(plan.release, demand),
    newcomers: drawsNewcomers(plan.release, demand),
    road: roadToTitle(
      {
        people: realm.people,
        holdings: {
          markets: realm.holdings.markets + b.markets,
          mills: realm.holdings.mills + b.mills,
          palace: realm.holdings.palace + b.palace,
          cathedral: realm.holdings.cathedral + b.cathedral,
        },
        treasury: treasuryAfterSpending,
        land: landAfter,
        prosperity: realm.prosperity,
      },
      realm.title,
      plan.justice,
      world.difficulty,
    ),
    // Soldiers armed this year stand guard only from next year: the border counts today's.
    border: borderWatch(realm.seat, landAfter, realm.people.soldiers, world.standings),
    debt: debtView(realm.treasury, realm.title),
    life: lifeView(realm.ruler, world.year),
  };
}

export type ForecastKey =
  | 'treasury'
  | 'customs'
  | 'sales'
  | 'wealth'
  | 'justice'
  | 'births'
  | 'deaths'
  | 'newcomers'
  | 'fled'
  | 'merchants'
  | 'population'
  | 'title'
  | 'mills'
  | 'interest';

export type YearForecast = Record<ForecastKey, Forecast>;

/**
 * The acting realm's year alone, as a model the kit's forecast can sample:
 * the same playYear the sealed year runs, without the rivals' turns that
 * follow it (they cannot change this realm's year).
 */
const yearOnly: TurnModel<World, Plan> = {
  init: () => {
    throw new Error('yearOnly forecasts an existing world');
  },
  draft: () => {
    throw new Error('yearOnly has no drafts');
  },
  validate: () => [],
  resolve(world, plan, rng) {
    const realm = actingRealm(world);
    const played = playYear(
      realm,
      plan,
      { difficulty: world.difficulty, standings: world.standings, terms: world.terms },
      yearStreams(rng, world.year, realm.seat),
    );
    return {
      state: {
        ...world,
        realms: world.realms.map((r) => (r.seat === realm.seat ? played.realm : r)),
      },
      events: played.events,
    };
  },
  signals: () => ({}),
  position: () => ({ turn: 1, seat: 0 }),
  outcome: () => null,
};

export function forecastYear(world: World, plan: Plan, seed: number, step: number): YearForecast {
  const seat = actingRealm(world).seat;
  const after = (state: World): Realm => state.realms[seat] as Realm;
  const log = (state: World) => {
    const last = after(state).last;
    if (!last) throw new Error('The forecast year left no log');
    return last;
  };
  return forecastMany(
    yearOnly,
    world,
    plan,
    {
      treasury: (state) => after(state).treasury,
      customs: (state) => log(state).revenue.customs,
      sales: (state) => log(state).revenue.sales,
      wealth: (state) => log(state).revenue.wealth,
      justice: (state) => log(state).revenue.justice,
      births: (state) => log(state).births,
      deaths: (state) => log(state).deaths,
      newcomers: (state) => log(state).newcomers,
      fled: (state) => log(state).fled,
      merchants: (state) => log(state).merchantsArrived - log(state).merchantsLeft,
      population: (state) => population(after(state)),
      title: (state) => after(state).title,
      mills: (state) => log(state).millIncome,
      interest: (state) => log(state).interest,
    },
    { seed: forecastSeed(seed, step), samples: 120 },
  );
}

/** The race to the crown, once it is won: who, by which ruler's hand, and when. */
export interface RaceWon {
  seat: number;
  city: string;
  /** The ruler who was crowned, by name, and the crown's title in their form. */
  ruler: string;
  title: string;
  year: number;
}

/**
 * Who won the race to the crown (the first realm crowned), or null while it is open. The ruler is
 * the one who reigned in the year of the crowning, even if an heir sits on the throne now.
 */
export function raceWon(world: World): RaceWon | null {
  const seat = world.firstCrowned;
  if (seat === null) return null;
  const realm = world.realms[seat];
  const year = realm?.record.crownedYear ?? null;
  if (!realm || year === null) return null;
  const reigning =
    realm.ruler.accession <= year
      ? realm.ruler
      : (realm.pastRulers.find((past) => past.ruler.accession <= year && year <= past.died)
          ?.ruler ?? realm.ruler);
  return {
    seat,
    city: realm.city,
    ruler: reigning.name,
    title: titleName(TOP_TITLE, reigning.form),
    year,
  };
}
