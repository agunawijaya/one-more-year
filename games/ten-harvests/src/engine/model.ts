/**
 * Ten Harvests: the engine. A city on the river with three numbers (people,
 * grain in store, acres) and one decree a year (land, food, seed).
 *
 * One core serves both rule sets. Every place where the 1978 Ledger behaves
 * differently from the normal game is one named function below
 * (`countsTowardAverage`, `nextLedgerAverage`, `walksOut`), so the
 * differences can be read, and are tested, one by one.
 *
 * A year, in the original's order:
 *   1. land changes hands at this year's price;
 *   2. food is given out, then seed (half a bushel an acre, odd halves free);
 *   3. the harvest: planted acres × a yield of 1–5;
 *   4. rats: on an even face of a five-sided die they eat the store ÷ face,
 *      taken after food and seed, before the harvest comes in;
 *   5. newcomers: a fresh die × (20 × acres + store) ÷ people ÷ 100, plus 1;
 *   6. hunger: each person needs 20 bushels; if more than 45 % go hungry,
 *      the ruler is deposed on the spot;
 *   7. the hungry leave the count, the newcomers join it, and then a fever
 *      may halve the city (one year in five);
 *   8. next year's land price, 17–26 bushels an acre.
 *
 * Each kind of chance draws from its own forked stream, so a replay or the
 * daily world is exact and the honest ledger can enumerate every outcome.
 */
import {
  createRng,
  event,
  formatNumber,
  type Outcome,
  type PlanIssue,
  type Rng,
  type SimEvent,
  type TurnModel,
  type WorldSetup,
} from '@one-more-year/kit';
import { VERDICTS, judgeTerm, type VerdictId } from './judge.ts';
import {
  ACRES_PER_WORKER,
  BUSHELS_PER_PERSON,
  DEPOSITION_SHARE,
  DIE_FACES,
  rulesFor,
  type RuleSet,
  type WorldRules,
} from './rules.ts';
import type { CityState, Decree, TermTally, YearOutcome } from './state.ts';

export const STREAMS = {
  landPrice: 'land-price',
  yield: 'yield',
  rats: 'rats',
  newcomers: 'newcomers',
  fever: 'plague',
} as const;

// ---- the named differences between the rule sets ------------------------

/**
 * Whether a year's hunger enters the term's average. The original jumps
 * past the averaging line whenever more people were fed than lived in the
 * city, so a generous year never counts; feeding exactly enough does.
 */
export function countsTowardAverage(ruleSet: RuleSet, fed: number, people: number): boolean {
  return ruleSet === 'normal' || fed <= people;
}

/**
 * The original's running average: it assumes every earlier year was
 * counted, so each skipped year silently takes the average as it stood.
 */
export function nextLedgerAverage(previous: number, yearOfTerm: number, percent: number): number {
  return ((yearOfTerm - 1) * previous + percent) / yearOfTerm;
}

/** A negative number ends a 1978 game at once; the normal rules never accept one. */
export function walksOut(ruleSet: RuleSet, decree: Decree): boolean {
  return ruleSet === '1978' && decree.walkout === true;
}

// ---- small pure helpers the interface also uses -------------------------

/** Seed for a number of acres: half a bushel each, rounded down. */
export function seedFor(acres: number): number {
  return Math.floor(acres / 2);
}

/** The most acres a store of seed grain can sow (an odd last acre needs no extra half). */
export function maxSownWith(grain: number): number {
  return grain < 0 ? 0 : grain * 2 + 1;
}

/** People fed by a gift of food. */
export function peopleFedBy(food: number): number {
  return Math.floor(food / BUSHELS_PER_PERSON);
}

/** The most acres the people can tend: strictly fewer than ten each. */
export function workersLimit(people: number): number {
  return Math.max(0, ACRES_PER_WORKER * people - 1);
}

/** Grain in store after the land trade, the food and the seed of a decree. */
export function grainAfterDecree(state: CityState, decree: Decree): number {
  return state.grain - decree.land * state.landPrice - decree.food - seedFor(decree.plant);
}

/** The year within the current term, 1-based. */
export function yearOfTerm(state: CityState): number {
  return state.year - state.term.firstYear + 1;
}

export function rulesOf(state: CityState): WorldRules {
  return rulesFor(state.scenario);
}

export function lengthOf(state: CityState): number {
  const rules = rulesOf(state);
  return rules.yearsPerTerm * rules.terms;
}

export function newcomersFor(face: number, acres: number, grain: number, people: number): number {
  return Math.floor((face * (20 * acres + grain)) / people / 100 + 1);
}

export function landPriceFrom(rng: Rng, rules: WorldRules): number {
  return rng.int(rules.priceRange[0], rules.priceRange[1]);
}

function openTerm(
  index: number,
  firstYear: number,
  state: Pick<CityState, 'people' | 'grain' | 'acres'>,
): TermTally {
  return {
    index,
    firstYear,
    hungerPercents: [],
    ledgerAverage: 0,
    totalHungry: 0,
    skippedYears: [],
    startPeople: state.people,
    startGrain: state.grain,
    startAcres: state.acres,
  };
}

// ---- the model -----------------------------------------------------------

export const cityModel: TurnModel<CityState, Decree> = {
  init(setup: WorldSetup) {
    const rules = rulesFor(setup.scenario);
    const { start } = rules;
    const opening = createRng(setup.seed).fork('opening');
    const landPrice = landPriceFrom(opening.fork(STREAMS.landPrice), rules);
    return {
      ruleSet: rules.ruleSet,
      scenario: rules.id,
      year: 1,
      people: start.people,
      grain: start.grain,
      acres: start.acres,
      landPrice,
      last: {
        year: 0,
        yieldPerAcre: start.lastYield,
        harvest: start.lastYield * start.acres,
        ratsAte: start.lastRatsAte,
        ratFace: 0,
        newcomers: start.lastNewcomers,
        feverLost: 0,
        hungry: 0,
        peopleBefore: start.people - start.lastNewcomers,
        fed: start.people - start.lastNewcomers,
        landPrice: 0,
        landChange: 0,
        planted: start.acres,
      },
      term: openTerm(0, 1, start),
      judged: [],
      ending: null,
    };
  },

  draft(state) {
    // The opening plan feeds everyone it can and sows what is left; the player decides from there.
    const food = Math.min(state.grain, state.people * BUSHELS_PER_PERSON);
    const plant = Math.min(
      state.acres,
      workersLimit(state.people),
      maxSownWith(state.grain - food),
    );
    return { land: 0, food, plant: Math.max(0, plant) };
  },

  validate(state, decree) {
    return validateDecree(state, decree);
  },

  resolve(state, decree, rng) {
    return resolveYear(state, decree, rng);
  },

  signals(state) {
    return { people: state.people, grain: state.grain, acres: state.acres };
  },

  position(state) {
    return { turn: Math.min(state.year, lengthOf(state)), seat: 0 };
  },

  outcome(state): Outcome | null {
    if (!state.ending) return null;
    const verdict = VERDICTS[state.ending.verdictId as VerdictId];
    return {
      ending: state.ending.kind,
      verdict: { id: verdict.id, label: verdict.label, tier: state.ending.tier },
    };
  },
};

/** Counted nouns for the refusals: "1 acre", "2,080 bushels". */
const count = (value: number, one: string, many: string): string =>
  `${formatNumber(value)} ${value === 1 ? one : many}`;

export function validateDecree(state: CityState, decree: Decree): PlanIssue[] {
  const issues: PlanIssue[] = [];
  const error = (field: string, message: string): void => {
    issues.push({ field, message, level: 'error' });
  };
  const { land, food, plant } = decree;
  if (decree.walkout) {
    if (state.ruleSet !== '1978') error('land', 'Only whole, positive numbers.');
    return issues;
  }
  for (const [field, value] of Object.entries({ land, food, plant })) {
    if (!Number.isInteger(value)) error(field, 'Only whole numbers.');
  }
  if (food < 0) error('food', 'Food cannot be less than nothing.');
  if (plant < 0) error('plant', 'Planting cannot be less than nothing.');
  if (issues.length > 0) return issues;

  if (land > 0 && land * state.landPrice > state.grain) {
    error(
      'land',
      `The store holds enough for ${count(Math.floor(state.grain / state.landPrice), 'acre', 'acres')}.`,
    );
  }
  if (land < 0 && -land >= state.acres) {
    error('land', 'The city must keep at least one acre.');
  }
  const afterLand = state.grain - land * state.landPrice;
  const acres = state.acres + land;
  if (food > Math.max(0, afterLand)) {
    const left = Math.max(0, afterLand);
    error('food', `Only ${count(left, 'bushel is', 'bushels are')} left to give out.`);
  }
  if (plant > acres) error('plant', `The city owns ${count(acres, 'acre', 'acres')}.`);
  if (seedFor(plant) > Math.max(0, afterLand - food)) {
    const most = maxSownWith(Math.max(0, afterLand - food));
    error('plant', `Seed for ${count(most, 'acre', 'acres')} at most.`);
  }
  if (plant > workersLimit(state.people)) {
    const tended = count(workersLimit(state.people), 'acre', 'acres');
    error('plant', `${count(state.people, 'person', 'people')} can tend ${tended}.`);
  }
  if (issues.length > 0) return issues;

  const hungry = Math.max(0, state.people - peopleFedBy(food));
  if (hungry > DEPOSITION_SHARE * state.people) {
    issues.push({ field: 'food', message: 'This decree would end your rule.', level: 'warning' });
  } else if (hungry > 0) {
    issues.push({
      field: 'food',
      message: `${count(hungry, 'person', 'people')} would go hungry.`,
      level: 'warning',
    });
  }
  return issues;
}

function resolveYear(
  state: CityState,
  decree: Decree,
  rng: Rng,
): { state: CityState; events: SimEvent[] } {
  const rules = rulesOf(state);
  const events: SimEvent[] = [];

  if (walksOut(state.ruleSet, decree)) {
    events.push(event('walked-out', 'disaster', {}, { weight: 6 }));
    return {
      state: { ...state, ending: { kind: 'walked-out', verdictId: 'walked-out', tier: 1 } },
      events,
    };
  }

  // 1–2. Land, food and seed leave the store.
  let grain = grainAfterDecree(state, decree);
  const acres = state.acres + decree.land;
  if (decree.land !== 0) {
    events.push(
      event(
        decree.land > 0 ? 'land-bought' : 'land-sold',
        'neutral',
        {
          acres: Math.abs(decree.land),
          price: state.landPrice,
          bushels: Math.abs(decree.land) * state.landPrice,
        },
        { codex: 'land-market', weight: 0.8 },
      ),
    );
  }
  if (decree.plant > 0) {
    events.push(
      event(
        'sown',
        'neutral',
        { acres: decree.plant, seed: seedFor(decree.plant) },
        { codex: 'seed-rule', weight: 0.3 },
      ),
    );
  }
  if (decree.plant > 0 && decree.plant === workersLimit(state.people)) {
    events.push(
      event(
        'every-hand',
        'neutral',
        { acres: decree.plant, people: state.people },
        { codex: 'worker-rule', weight: 0.4 },
      ),
    );
  }

  // 3. The harvest.
  const yieldPerAcre = rng.fork(STREAMS.yield).int(rules.yieldRange[0], rules.yieldRange[1]);
  const harvest = decree.plant * yieldPerAcre;
  events.push(
    event(
      'harvest',
      yieldPerAcre >= 4 ? 'good' : yieldPerAcre <= 2 ? 'warning' : 'neutral',
      { yield: yieldPerAcre, acres: decree.plant, bushels: harvest },
      { codex: 'harvests', weight: yieldPerAcre >= 4 || yieldPerAcre <= 2 ? 2 : 1 },
    ),
  );

  // 4. Rats, on what is left after food and seed, before the harvest comes in.
  const ratFace = rng.fork(STREAMS.rats).int(1, DIE_FACES);
  const ratsCame = rules.ratFaces.includes(ratFace);
  const ratsAte = ratsCame ? Math.floor(grain / ratFace) : 0;
  if (ratsCame) {
    events.push(
      event(
        'rats',
        ratsAte > 0 ? 'warning' : 'neutral',
        { eaten: ratsAte, face: ratFace },
        { codex: 'rats', weight: 2.2 },
      ),
    );
  }
  grain = grain - ratsAte + harvest;

  // 5. Newcomers, judged on the city as it now stands.
  const newcomerFace = rng.fork(STREAMS.newcomers).int(1, DIE_FACES);
  const newcomers = newcomersFor(newcomerFace, acres, grain, state.people);

  // 6. Hunger.
  const fed = peopleFedBy(decree.food);
  const hungry = Math.max(0, state.people - fed);
  const percent = (hungry * 100) / state.people;
  const feverRoll = rng.fork(STREAMS.fever).next();
  const fever = feverRoll < 1 / rules.feverOneIn;

  if (hungry > DEPOSITION_SHARE * state.people) {
    events.push(
      event(
        'deposed',
        'disaster',
        { hungry, people: state.people, percent },
        { codex: 'deposition', weight: 8 },
      ),
    );
    return {
      state: {
        ...state,
        grain,
        acres,
        last: outcomeOf(state, decree, {
          yieldPerAcre,
          harvest,
          ratsAte,
          ratFace: ratsCame ? ratFace : 0,
          newcomers: 0,
          feverLost: 0,
          hungry,
          fed,
        }),
        ending: { kind: 'deposed', verdictId: 'deposed', tier: 1 },
      },
      events,
    };
  }

  const term = {
    ...state.term,
    hungerPercents: [...state.term.hungerPercents],
    skippedYears: [...state.term.skippedYears],
  };
  if (countsTowardAverage(state.ruleSet, fed, state.people)) {
    term.hungerPercents.push(percent);
    term.ledgerAverage = nextLedgerAverage(term.ledgerAverage, yearOfTerm(state), percent);
  } else {
    term.skippedYears.push(state.year);
    events.push(
      event(
        'generous-year',
        'neutral',
        { fed, people: state.people },
        { codex: 'generosity-paradox', weight: 0.6 },
      ),
    );
  }
  term.totalHungry += hungry;
  if (hungry > 0) {
    events.push(
      event(
        'hunger',
        hungry > state.people * 0.2 ? 'disaster' : 'warning',
        { hungry, people: state.people, percent },
        { codex: 'hunger', weight: 3 + percent / 10 },
      ),
    );
  } else {
    events.push(event('all-fed', 'good', { people: state.people }, { weight: 0.7 }));
  }

  // 7. The hungry leave, the newcomers arrive, and perhaps the fever comes.
  let people = state.people - hungry + newcomers;
  events.push(
    event(
      'newcomers',
      newcomers >= 10 ? 'good' : 'neutral',
      { people: newcomers, face: newcomerFace },
      { codex: 'newcomers', weight: newcomers >= 10 ? 1.5 : 0.5 },
    ),
  );
  let feverLost = 0;
  if (fever) {
    feverLost = people - Math.floor(people / 2);
    people -= feverLost;
    events.push(event('fever', 'disaster', { lost: feverLost }, { codex: 'fever', weight: 5 }));
  }

  // 8. Next year's market.
  const landPrice = landPriceFrom(rng.fork(STREAMS.landPrice), rules);
  const last = outcomeOf(state, decree, {
    yieldPerAcre,
    harvest,
    ratsAte,
    ratFace: ratsCame ? ratFace : 0,
    newcomers,
    feverLost,
    hungry,
    fed,
  });
  const next: CityState = {
    ...state,
    year: state.year + 1,
    people,
    grain,
    acres,
    landPrice,
    last,
    term,
  };
  return { state: closeTermIfDone(next, rules, events), events };
}

function outcomeOf(
  state: CityState,
  decree: Decree,
  parts: Omit<YearOutcome, 'year' | 'peopleBefore' | 'landPrice' | 'landChange' | 'planted'>,
): YearOutcome {
  return {
    year: state.year,
    peopleBefore: state.people,
    landPrice: state.landPrice,
    landChange: decree.land,
    planted: decree.plant,
    ...parts,
  };
}

/** At the end of ten years the term is judged; in Dynasty the heir then takes the city. */
function closeTermIfDone(state: CityState, rules: WorldRules, events: SimEvent[]): CityState {
  if (yearOfTerm(state) <= rules.yearsPerTerm) return state;
  const judged = judgeTerm(state.ruleSet, state.term, state.acres, state.people);
  const verdict = VERDICTS[judged.id];
  events.push(
    event(
      'term-judged',
      verdict.tier >= 4 ? 'good' : verdict.tier <= 1 ? 'warning' : 'neutral',
      {
        tier: verdict.tier,
        hunger: judged.averageHunger,
        acresPerPerson: judged.acresPerPerson,
        term: state.term.index + 1,
      },
      { weight: 1 },
    ),
  );
  const record = {
    index: state.term.index,
    verdictId: judged.id,
    tier: verdict.tier,
    averageHunger: judged.averageHunger,
    acresPerPerson: judged.acresPerPerson,
    totalHungry: state.term.totalHungry,
  };
  const judgedTerms = [...state.judged, record];
  if (judgedTerms.length >= rules.terms) {
    const tier = dynastyTier(judgedTerms.map((t) => t.tier));
    const finalId = rules.terms > 1 ? closestVerdict(tier) : judged.id;
    return {
      ...state,
      judged: judgedTerms,
      ending: {
        kind: rules.terms > 1 ? 'dynasty-complete' : 'term-complete',
        verdictId: finalId,
        tier,
      },
    };
  }
  return { ...state, judged: judgedTerms, term: openTerm(state.term.index + 1, state.year, state) };
}

/** A dynasty is remembered by the average of its three terms, rounded down. */
function dynastyTier(tiers: readonly number[]): number {
  return Math.max(
    1,
    Math.floor(tiers.reduce((sum, tier) => sum + tier, 0) / Math.max(1, tiers.length)),
  );
}

function closestVerdict(tier: number): VerdictId {
  const order: VerdictId[] = [
    'sent-to-the-fields',
    'heavy-hand',
    'fair-season',
    'worth-carving',
    'ten-quiet-years',
  ];
  return order[Math.min(order.length, Math.max(1, tier)) - 1] ?? 'fair-season';
}
