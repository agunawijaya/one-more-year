/**
 * One realm's year, in the 1978 program's order.
 *
 *   opening: a death and an heir, weather, rats, the harvest, demand, prices
 *   then the plan: trade grain and land → release grain → incomes and pay →
 *   the border → taxes and justice → interest → creditors → builders →
 *   title review
 *
 * `openYear` runs before the ruler decides (step 1 shows it); `playYear`
 * runs when the year is sealed. Both are pure: they take the world and a
 * random stream, return new values and never touch their arguments.
 */
import { event, type Rng, type SimEvent } from '@one-more-year/kit';
import {
  AFTER_BANKRUPTCY,
  BANKRUPTCY_PER_TITLE,
  BUILDINGS,
  DEBT_INTEREST,
  FIRST_YEAR,
  MARKET_RENT,
  MILL_BASE,
  MILL_ROLL,
  SOLDIER_PAY,
  TOP_TITLE,
} from './rules.ts';
import {
  demandFor,
  grainPriceFor,
  harvestFor,
  landPriceFor,
  rollRats,
  rollWeather,
  scarcityOf,
  workedHectares,
} from './economy.ts';
import { feedPeople } from './people.ts';
import { revenueFor } from './taxes.ts';
import { resolveInvasion, threatFor } from './invasion.ts';
import { earnedTitle, reviewTitle, titlePoints, type TitleInputs } from './title.ts';
import { causeOfDeath } from './lifespan.ts';
import { heirOf } from './court.ts';
import { hundredths, rollUpTo, whole } from './numbers.ts';
import { legalPlan } from './plan.ts';
import type { Terms } from './scenarios.ts';
import type {
  Construction,
  Fate,
  Invasion,
  Opening,
  PastRuler,
  Plan,
  Realm,
  Standing,
  World,
  YearLog,
} from './state.ts';

/** The random streams a realm's year draws from, one per subsystem. */
export function yearStreams(rng: Rng, year: number, seat: number): YearStreams {
  const root = rng.fork(`year:${year}:seat:${seat}`);
  return {
    weather: root.fork('weather'),
    rats: root.fork('rats'),
    prices: root.fork('prices'),
    people: root.fork('people'),
    invasion: root.fork('invasion'),
    lifespan: root.fork('lifespan'),
    events: root.fork('events'),
  };
}

export interface YearStreams {
  weather: Rng;
  rats: Rng;
  prices: Rng;
  people: Rng;
  invasion: Rng;
  lifespan: Rng;
  events: Rng;
}

export function titleInputs(realm: Realm): TitleInputs {
  return {
    people: realm.people,
    holdings: realm.holdings,
    treasury: realm.treasury,
    land: realm.land,
    prosperity: realm.prosperity,
  };
}

// ---- the opening ----------------------------------------------------------------

export interface OpenedYear {
  realm: Realm;
  events: SimEvent[];
  /** Set when the ruler died and the realm's story ended (Classic fate, or no heir came). */
  ended: boolean;
}

/**
 * designed: nobody claims a ruined seat. An heir takes the throne one title
 * lower, so a Cavaliere or Dama who dies with the treasury in debt leaves
 * nothing to step down to and only debts to inherit: the line ends there.
 */
export function heirComesForward(realm: Realm): boolean {
  return realm.title > 1 || realm.treasury >= 0;
}

export function openYear(
  realm: Realm,
  year: number,
  fate: Fate,
  terms: Terms,
  streams: YearStreams,
): OpenedYear {
  const events: SimEvent[] = [];
  let next: Realm = { ...realm, record: { ...realm.record } };
  let succession: PastRuler | null = null;

  if (realm.ruler.deathYear <= year) {
    succession = {
      ruler: realm.ruler,
      died: year,
      cause: causeOfDeath(realm.ruler, year, streams.lifespan.fork('cause')),
      title: realm.title,
    };
    events.push(
      event(
        'ruler-died',
        'warning',
        { generation: realm.ruler.generation, title: realm.title },
        {
          seat: realm.seat,
          weight: 5,
        },
      ),
    );
    if (fate === 'classic' || !heirComesForward(realm)) {
      if (fate === 'dynasty') {
        events.push(
          event(
            'line-ended',
            'disaster',
            { generation: realm.ruler.generation },
            {
              seat: realm.seat,
              weight: 8,
            },
          ),
        );
      }
      return {
        realm: {
          ...next,
          status: 'ended',
          pastRulers: [...realm.pastRulers, succession],
          opening: null,
        },
        events,
        ended: true,
      };
    }
    const heir = heirOf(realm, year, streams.lifespan.fork('heir'));
    next = {
      ...next,
      ruler: heir,
      pastRulers: [...realm.pastRulers, succession],
      title: Math.max(1, realm.title - 1),
    };
    events.push(
      event(
        'heir-crowned',
        'neutral',
        { generation: heir.generation, title: next.title },
        {
          seat: realm.seat,
          weight: 3,
        },
      ),
    );
  }

  const weather = rollWeather(streams.weather);
  const rats = rollRats(streams.rats, next.grain);
  const worked = workedHectares(next.people, next.holdings, next.land);
  const harvest = harvestFor(worked, weather, streams.weather.fork('harvest'), terms.yieldFactor);
  const demand = demandFor(next.people);
  const scarcity = scarcityOf(demand, harvest);
  const opening: Opening = {
    year,
    weather,
    ratPercent: rats.percent,
    ratsAte: rats.ate,
    worked,
    harvest,
    demand,
    grainPrice: grainPriceFor(weather, scarcity, streams.prices),
    landPrice: landPriceFor(scarcity, streams.prices.fork('land')),
    succession,
  };
  const weathersSeen = next.record.weathersSeen.includes(weather)
    ? next.record.weathersSeen
    : [...next.record.weathersSeen, weather].sort();
  next = {
    ...next,
    grain: next.grain - rats.ate + harvest,
    opening,
    record: { ...next.record, weathersSeen },
  };
  return { realm: next, events, ended: false };
}

// ---- the sealed year ----------------------------------------------------------------

export interface PlayedYear {
  realm: Realm;
  log: YearLog;
  events: SimEvent[];
  /** Land the invader took, to be added to the invader's realm (null for mercenaries). */
  seizure: { by: number; hectares: number } | null;
}

export interface YearRules {
  difficulty: World['difficulty'];
  standings: readonly Standing[];
  terms: Terms;
}

export function playYear(
  realm: Realm,
  rawPlan: Plan,
  rules: YearRules,
  streams: YearStreams,
): PlayedYear {
  const opening = realm.opening;
  if (!opening) throw new Error(`Seat ${realm.seat} has no opening for its year`);
  const { terms } = rules;
  const plan = legalPlan(realm, rawPlan, terms);
  const seat = realm.seat;
  const events = openingEvents(seat, opening);
  let { treasury, grain, land, prosperity } = realm;
  const record = { ...realm.record };

  // Market: grain and land change hands at this year's prices.
  treasury -= whole((plan.grain * opening.grainPrice) / 1000);
  grain += plan.grain;
  treasury -= whole(plan.land * opening.landPrice);
  land += plan.land;

  // Bread for the people, under this year's taxes and justice.
  grain -= plan.release;
  const rates = {
    customs: plan.customs,
    sales: plan.sales,
    wealth: plan.wealth,
    justice: plan.justice,
  };
  const fed = feedPeople(
    realm.people,
    prosperity,
    plan.release,
    opening.demand,
    rates,
    streams.people,
    { deaths: terms.deathFactor, newcomers: terms.newcomerFactor },
  );
  const people = { ...fed.people };
  prosperity = fed.prosperity;
  peopleEvents(events, seat, fed);
  if (fed.hungry) record.famineYears += 1;

  // Incomes and pay.
  const marketRent = whole(realm.holdings.markets * MARKET_RENT * terms.marketRentFactor);
  const millIncome =
    realm.holdings.mills > 0
      ? realm.holdings.mills * (MILL_BASE + rollUpTo(streams.prices.fork('mills'), MILL_ROLL))
      : 0;
  const soldiersPay = people.soldiers * SOLDIER_PAY;
  treasury += marketRent + millIncome - soldiersPay;

  // The border.
  let invaded: Invasion | null = null;
  const threat = threatFor(seat, land, people.soldiers, rules.standings);
  if (threat) {
    invaded = resolveInvasion(
      seat,
      land,
      people.soldiers,
      threat,
      rules.standings,
      streams.invasion,
    );
    land -= invaded.hectares;
    people.soldiers -= invaded.soldiersLost;
    record.invadedCount += 1;
    events.push(
      event(
        'invaded',
        'disaster',
        { hectares: invaded.hectares, soldiers: invaded.soldiersLost, by: invaded.by ?? -1 },
        { seat, codex: 'invasion', weight: 6 },
      ),
    );
  }

  // Taxes and justice, then interest and the creditors.
  const previous = realm.taxes;
  if (
    plan.customs > previous.customs ||
    plan.sales > previous.sales ||
    plan.wealth > previous.wealth
  ) {
    record.taxRaised = true;
  }
  const revenue = revenueFor(people, prosperity, rates, realm.title, terms.customsFactor);
  treasury += revenue.total;
  let interest = 0;
  if (treasury < 0) {
    const owed = whole(treasury * DEBT_INTEREST);
    interest = treasury - owed;
    treasury = owed;
    events.push(
      event('interest', 'warning', { florins: interest }, { seat, codex: 'interest', weight: 2 }),
    );
  }
  let holdings = { ...realm.holdings };
  const bankrupt = treasury < -BANKRUPTCY_PER_TITLE * realm.title;
  if (bankrupt) {
    holdings = { markets: 0, mills: 0, palace: 0, cathedral: 0 };
    // As in 1978 the creditors leave exactly this much land, even to a realm that had less.
    land = AFTER_BANKRUPTCY.land;
    prosperity = AFTER_BANKRUPTCY.prosperity;
    treasury = AFTER_BANKRUPTCY.treasury;
    people.merchants = whole(people.merchants / 2);
    grain = AFTER_BANKRUPTCY.grain;
    record.bankruptcies += 1;
    events.push(
      event(
        'bankrupt',
        'disaster',
        { line: BANKRUPTCY_PER_TITLE * realm.title },
        { seat, codex: 'bankruptcy', weight: 7 },
      ),
    );
  }

  // Builders.
  const built = build(plan.build, holdings, people, streams.events);
  holdings = built.holdings;
  treasury -= built.cost;
  prosperity = hundredths(prosperity + built.prosperity);
  if (built.cost > 0) {
    events.push(
      event(
        'built',
        'good',
        {
          ...plan.build,
          florins: built.cost,
          cathedralNow: holdings.cathedral,
          palaceNow: holdings.palace,
        },
        { seat, weight: 1.5 },
      ),
    );
  }
  record.peakSoldiers = Math.max(record.peakSoldiers, people.soldiers);

  // The title review.
  const after: Realm = {
    ...realm,
    people,
    land,
    grain,
    treasury,
    holdings,
    prosperity,
    taxes: rates,
  };
  const points = titlePoints(titleInputs(after));
  const deathbed = opening.year + 2 === realm.ruler.deathYear;
  const review = reviewTitle(realm.title, points, plan.justice, rules.difficulty, deathbed);
  const promoted = review.title > realm.title;
  if (!promoted && earnedTitle(points, 1, rules.difficulty) > realm.title) {
    // The seal of justice alone kept the title from rising this year.
    events.push(
      event(
        'justice-cost',
        'neutral',
        { justice: plan.justice },
        { seat, codex: 'justice-penalty', weight: 1 },
      ),
    );
  }
  if (promoted) {
    events.push(
      event(
        'promoted',
        'good',
        {
          from: realm.title,
          to: review.title,
          generation: realm.ruler.generation,
          female: realm.ruler.form === 'f' ? 1 : 0,
        },
        {
          seat,
          codex: deathbed && review.title === realm.title + 1 ? 'deathbed' : 'title-formula',
          weight: review.title === TOP_TITLE ? 10 : 4,
        },
      ),
    );
  }
  const crowned = review.title === TOP_TITLE && realm.status !== 'crowned';
  if (crowned) {
    record.crownedYear = opening.year;
    events.push(
      event(
        'crowned',
        'good',
        {
          year: opening.year,
          generation: realm.ruler.generation,
          reign: opening.year - realm.ruler.accession + 1,
          years: opening.year - FIRST_YEAR + 1,
          bankruptcies: record.bankruptcies,
          invasions: record.invadedCount,
          female: realm.ruler.form === 'f' ? 1 : 0,
        },
        { seat, weight: 12 },
      ),
    );
  }

  const log: YearLog = {
    year: opening.year,
    opening,
    plan,
    births: fed.births,
    deaths: fed.deaths,
    newcomers: fed.newcomers,
    fled: fed.fled,
    merchantsArrived: fed.merchantsArrived + built.merchants,
    merchantsLeft: fed.merchantsLeft,
    noblesArrived: fed.noblesArrived + built.nobles,
    clergyArrived: fed.clergyArrived + built.clergy,
    marketRent,
    millIncome,
    soldiersPay,
    revenue: {
      customs: revenue.customs,
      sales: revenue.sales,
      wealth: revenue.wealth,
      justice: revenue.justice,
    },
    interest,
    bankrupt,
    invaded,
    conquered: 0,
    titleBefore: realm.title,
    titleAfter: review.title,
    deathbed,
    points,
  };

  return {
    realm: {
      ...after,
      title: review.title,
      status: crowned ? 'crowned' : realm.status,
      opening: null,
      last: log,
      pointsHistory: [...realm.pointsHistory, points],
      record,
    },
    log,
    events,
    seizure: invaded && invaded.by !== null ? { by: invaded.by, hectares: invaded.hectares } : null,
  };
}

interface Built {
  holdings: Realm['holdings'];
  cost: number;
  prosperity: number;
  merchants: number;
  nobles: number;
  clergy: number;
}

/** original: each purchase's price and immediate effect (palace nobles restored, see NOTES.md). */
function build(
  order: Construction,
  holdings: Realm['holdings'],
  people: Realm['people'],
  rng: Rng,
): Built {
  const next = { ...holdings };
  let cost = 0;
  let prosperity = 0;
  let merchants = 0;
  let nobles = 0;
  let clergy = 0;
  for (let i = 0; i < order.markets; i++) {
    next.markets += 1;
    cost += BUILDINGS.market.cost;
    merchants += BUILDINGS.market.merchants;
    prosperity += BUILDINGS.market.prosperity;
  }
  for (let i = 0; i < order.mills; i++) {
    next.mills += 1;
    cost += BUILDINGS.mill.cost;
    prosperity += BUILDINGS.mill.prosperity;
  }
  for (let i = 0; i < order.palace; i++) {
    next.palace += 1;
    cost += BUILDINGS.palace.cost;
    prosperity += BUILDINGS.palace.prosperity;
    nobles += rollUpTo(rng.fork(`palace:${i}`), BUILDINGS.palace.noblesUpTo);
  }
  for (let i = 0; i < order.cathedral; i++) {
    next.cathedral += 1;
    cost += BUILDINGS.cathedral.cost;
    prosperity += BUILDINGS.cathedral.prosperity;
    clergy += rollUpTo(rng.fork(`cathedral:${i}`), BUILDINGS.cathedral.clergyUpTo);
  }
  const recruits = Math.min(order.platoons * BUILDINGS.platoon.soldiers, people.serfs);
  cost += order.platoons * BUILDINGS.platoon.cost;
  people.soldiers += recruits;
  people.serfs -= recruits;
  people.merchants += merchants;
  people.nobles += nobles;
  people.clergy += clergy;
  return { holdings: next, cost, prosperity: hundredths(prosperity), merchants, nobles, clergy };
}

// ---- events ------------------------------------------------------------------

const WEATHER_SEVERITY = ['disaster', 'warning', 'neutral', 'good', 'good'] as const;
const WEATHER_CODEX = [
  'weather-drought',
  'weather-poor',
  'weather-fair',
  'weather-good',
  'weather-excellent',
] as const;

function openingEvents(seat: number, opening: Opening): SimEvent[] {
  const events: SimEvent[] = [];
  events.push(
    event(
      'weather',
      WEATHER_SEVERITY[opening.weather - 1] ?? 'neutral',
      { grade: opening.weather, harvest: opening.harvest, worked: opening.worked },
      {
        seat,
        codex: WEATHER_CODEX[opening.weather - 1] ?? 'weather-fair',
        weight: opening.weather === 1 ? 4 : opening.weather === 5 ? 2.5 : 1,
      },
    ),
  );
  // Rats come every year; they only make it a hard one when they take a big share of a granary
  // that held something worth losing (a fifth of the year's bread or more).
  const ruinous = opening.ratPercent >= 40 && opening.ratsAte * 5 >= opening.demand;
  events.push(
    event(
      'rats',
      ruinous ? 'warning' : 'neutral',
      { percent: opening.ratPercent, bushels: opening.ratsAte },
      {
        seat,
        codex: 'rats',
        weight: ruinous ? 2 : 0.5,
      },
    ),
  );
  return events;
}

function peopleEvents(events: SimEvent[], seat: number, fed: ReturnType<typeof feedPeople>): void {
  if (fed.hungry) {
    events.push(event('famine', 'disaster', { deaths: fed.deaths }, { seat, weight: 5 }));
  }
  if (fed.newcomers > 0) {
    events.push(
      event(
        'newcomers',
        'good',
        { serfs: fed.newcomers, merchants: fed.merchantsArrived },
        { seat, codex: 'migration', weight: 2 },
      ),
    );
  }
  if (fed.fled > 0) {
    // A trickle under harsh courts is the price the ruler chose; only a flight of more than one
    // serf in a hundred makes it a hard year.
    const flight = fed.fled > fed.people.serfs / 100;
    events.push(
      event(
        'fled',
        flight ? 'warning' : 'neutral',
        { serfs: fed.fled },
        { seat, codex: 'fleeing', weight: flight ? 2 : 0.5 },
      ),
    );
  }
  if (fed.merchantsLeft > 0) {
    events.push(
      event('merchants-left', 'warning', { merchants: fed.merchantsLeft }, { seat, weight: 2 }),
    );
  }
}
