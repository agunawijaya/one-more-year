/**
 * The valley's year: whose turn it is, the order of seats, the standings
 * published at each year's end, the AI rivals' turns, and when the game
 * ends.
 *
 * A step of the game is one human ruler's year. Sealing it plays that year,
 * then every AI rival whose turn falls before the next human's, rolls the
 * next human's opening (a death and an heir, the weather, the harvest) and
 * stops there, so the next plan screen opens on a year that has already
 * begun. In a court of AI rivals alone (the Hall's demo) a step is a whole
 * year.
 */
import { createRng, event, type Rng, type SimEvent } from '@one-more-year/kit';
import { createRealms, withAggressor, type Court } from './court.ts';
import { FIRST_YEAR } from './rules.ts';
import { scenarioFor, type StartChanges } from './scenarios.ts';
import { titlePoints } from './title.ts';
import { openYear, playYear, titleInputs, yearStreams } from './year.ts';
import { policyFor, rivalLapse, type PolicyView } from './policies.ts';
import type { BetweenNote, Plan, Realm, Standing, World } from './state.ts';

export interface WorldOptions {
  scenario: string;
  court: Court;
  /** Overrides the scenario's last year; undefined keeps it. */
  endYear?: number | null | undefined;
}

export function createWorld(seed: number, options: WorldOptions): World {
  const scenario = scenarioFor(options.scenario);
  const court = withAggressor(options.court, scenario, seed);
  const realms = createRealms(court, seed).map((realm) => {
    let opened = startWith(realm, scenario.everyone);
    if (isHuman(realm)) opened = startWith(opened, scenario.humans);
    if (realm.controller.kind === 'ai' && realm.controller.aggressive && scenario.aggressor) {
      opened = startWith(opened, scenario.aggressor.start);
    }
    return opened;
  });
  const world: World = {
    version: 1,
    scenario: options.scenario,
    terms: scenario.terms,
    difficulty: court.difficulty,
    fate: court.fate,
    endYear: options.endYear === undefined ? scenario.endYear : options.endYear,
    year: FIRST_YEAR,
    realms,
    order: orderFor(FIRST_YEAR, realms),
    cursor: 0,
    standings: realms.map(standingOf),
    firstCrowned: null,
    between: [],
    end: null,
  };
  return reachNextHuman(world, createRng(seed).fork('opening'), []).world;
}

function startWith(realm: Realm, changes: StartChanges): Realm {
  const soldiers = changes.soldiers ?? realm.people.soldiers;
  return {
    ...realm,
    land: changes.land ?? realm.land,
    treasury: changes.treasury ?? realm.treasury,
    title: changes.title ?? realm.title,
    grain: changes.grain ?? realm.grain,
    people: {
      ...realm.people,
      merchants: changes.merchants ?? realm.people.merchants,
      soldiers,
    },
    record: { ...realm.record, peakSoldiers: soldiers },
  };
}

export function standingOf(realm: Realm): Standing {
  return {
    seat: realm.seat,
    title: realm.title,
    points: titlePoints(titleInputs(realm)),
    land: realm.land,
    soldiers: realm.people.soldiers,
    serfs: realm.people.serfs,
    merchants: realm.people.merchants,
    nobles: realm.people.nobles,
    clergy: realm.people.clergy,
    treasury: realm.treasury,
    status: realm.status,
    aggressive: realm.controller.kind === 'ai' && realm.controller.aggressive === true,
  };
}

/** Seats still playing, rotated by one place each year so no seat always goes first. */
export function orderFor(year: number, realms: readonly Realm[]): number[] {
  const playing = realms.filter((r) => r.status !== 'ended').map((r) => r.seat);
  if (playing.length === 0) return [];
  const shift = (year - FIRST_YEAR) % playing.length;
  return [...playing.slice(shift), ...playing.slice(0, shift)];
}

export function isHuman(realm: Realm): boolean {
  return realm.controller.kind === 'human';
}

/** The seat whose turn it is. */
export function actingSeat(world: World): number {
  return world.order[world.cursor] ?? 0;
}

export function actingRealm(world: World): Realm {
  const realm = world.realms[actingSeat(world)];
  if (!realm) throw new Error('No realm is acting');
  return realm;
}

/** The first human seat: whose run the chronicle tells. */
export function firstHuman(world: World): Realm | null {
  return world.realms.find(isHuman) ?? null;
}

function hasHumans(world: World): boolean {
  return world.realms.some(isHuman);
}

function humansLeft(world: World): boolean {
  return world.realms.some((r) => isHuman(r) && r.status !== 'ended');
}

// ---- playing a step ---------------------------------------------------------------

export interface StepResult {
  world: World;
  events: SimEvent[];
}

/** Seals the acting ruler's year with `plan` (ignored for rivals) and plays on to the next human's opening. */
export function playStep(world: World, plan: Plan, rng: Rng): StepResult {
  if (world.end) return { world, events: [] };
  const events: SimEvent[] = [];
  let next: World = { ...world, between: [] };
  if (!hasHumans(next)) return playRivalYear(next, rng, events);
  if (plan.retire && (world.endYear === null || world.firstCrowned !== null)) {
    // The ruler closes the chronicle instead of playing the year: in Endless Dynasty at any time,
    // otherwise once another realm has won the race to the crown (prompt 02 §3.7).
    const seat = actingSeat(next);
    events.push(event('retired', 'neutral', { year: world.year }, { seat, weight: 2 }));
    return { world: { ...next, end: { ending: 'retired', seat, year: world.year } }, events };
  }
  next = sealYear(next, actingSeat(next), plan, rng, events);
  next = { ...next, cursor: next.cursor + 1 };
  return reachNextHuman(next, rng, events);
}

/** An all-rival court: every seat plays its year, then the next year opens. */
function playRivalYear(start: World, rng: Rng, events: SimEvent[]): StepResult {
  let world = start;
  const year = world.year;
  let guard = 0;
  while (!world.end && world.year === year && guard++ < 20) {
    const seat = actingSeat(world);
    world = sealYear(world, seat, rivalPlan(world, seat, rng), rng, events);
    world = { ...world, cursor: world.cursor + 1 };
    world = openNextPlayable(world, rng, events);
  }
  return { world, events };
}

/** Plays rival turns until a human's year is open, or the game ends. */
function reachNextHuman(start: World, rng: Rng, events: SimEvent[]): StepResult {
  let world = start;
  let guard = 0;
  while (!world.end && guard++ < 1000) {
    world = openNextPlayable(world, rng, events);
    if (world.end) break;
    const realm = actingRealm(world);
    if (isHuman(realm) || !hasHumans(world)) break;
    world = sealYear(world, realm.seat, rivalPlan(world, realm.seat, rng), rng, events);
    world = { ...world, cursor: world.cursor + 1 };
  }
  return { world, events };
}

/** Opens the acting realm's year, passing over realms whose story has ended, closing years as needed. */
function openNextPlayable(start: World, rng: Rng, events: SimEvent[]): World {
  let world = start;
  let guard = 0;
  while (!world.end && guard++ < 100) {
    world = closeYearIfDone(world);
    if (world.end) return world;
    if (world.order.length === 0 || (hasHumans(world) && !humansLeft(world))) {
      const owner = firstHuman(world);
      return { ...world, end: { ending: 'extinct', seat: owner?.seat ?? 0, year: world.year } };
    }
    world = openActing(world, rng, events);
    if (actingRealm(world).status !== 'ended') return world;
    world = { ...world, cursor: world.cursor + 1 };
  }
  return world;
}

function sealYear(world: World, seat: number, plan: Plan, rng: Rng, events: SimEvent[]): World {
  const realm = world.realms[seat] as Realm;
  const played = playYear(
    realm,
    plan,
    { difficulty: world.difficulty, standings: world.standings, terms: world.terms },
    yearStreams(rng, world.year, seat),
  );
  const realms = world.realms.map((r) => (r.seat === seat ? played.realm : r));
  if (played.seizure) {
    const { by, hectares } = played.seizure;
    const invader = realms[by];
    if (invader) {
      realms[by] = {
        ...invader,
        land: invader.land + hectares,
        last: invader.last
          ? { ...invader.last, conquered: invader.last.conquered + hectares }
          : null,
      };
    }
  }
  let next: World = {
    ...world,
    realms,
    between: [...world.between, ...notesFor(seat, world.year, realm, played.realm)],
  };
  const crownedNow = played.realm.status === 'crowned' && realm.status !== 'crowned';
  if (crownedNow && next.firstCrowned === null) next = { ...next, firstCrowned: seat };
  if (isHuman(realm)) {
    events.push(...played.events);
    if (crownedNow && world.terms.crownEnds) {
      next = { ...next, end: { ending: 'crowned', seat, year: world.year } };
    }
  } else if (crownedNow && next.firstCrowned === seat) {
    events.push(event('rival-crowned', 'warning', { seat, year: world.year }, { weight: 3 }));
  }
  return next;
}

/** What the rest of the valley hears about a realm's year. */
function notesFor(seat: number, year: number, before: Realm, after: Realm): BetweenNote[] {
  const notes: BetweenNote[] = [];
  const log = after.last;
  if (!log) return notes;
  if (log.invaded) {
    notes.push({
      seat,
      year,
      kind: 'invaded',
      numbers: { by: log.invaded.by ?? -1, hectares: log.invaded.hectares },
    });
  }
  if (log.bankrupt) notes.push({ seat, year, kind: 'bankrupt', numbers: {} });
  if (log.titleAfter > log.titleBefore)
    notes.push({ seat, year, kind: 'promoted', numbers: { title: log.titleAfter } });
  if (after.status === 'crowned' && before.status !== 'crowned')
    notes.push({ seat, year, kind: 'crowned', numbers: {} });
  const built = log.plan.build;
  if (built.cathedral + built.palace + built.markets + built.mills > 0) {
    notes.push({ seat, year, kind: 'built', numbers: { ...built } });
  }
  return notes;
}

function rivalPlan(world: World, seat: number, rng: Rng): Plan {
  const realm = world.realms[seat] as Realm;
  const controller = realm.controller;
  const personality = controller.kind === 'ai' ? controller.personality : 'steward';
  const temper = {
    aggressive: controller.kind === 'ai' && controller.aggressive === true,
    lapse: rivalLapse(world.difficulty),
  };
  return policyFor(personality, temper)(
    policyView(world, realm),
    rng.fork(`ai:${seat}`).fork(`year:${world.year}`),
  );
}

/** What a ruler in this seat may see: its own realm, last year's standings and the world's terms. */
export function policyView(world: World, realm: Realm): PolicyView {
  return {
    realm,
    difficulty: world.difficulty,
    standings: world.standings,
    terms: world.terms,
  };
}

/** Moves past the end of the year once every seat has played: new standings, new order. */
function closeYearIfDone(world: World): World {
  if (world.cursor < world.order.length) return world;
  const year = world.year + 1;
  const standings = world.realms.map(standingOf);
  if (world.endYear !== null && year > world.endYear) {
    const owner = firstHuman(world);
    return {
      ...world,
      standings,
      order: [],
      cursor: 0,
      end: { ending: 'year-limit', seat: owner?.seat ?? 0, year: world.year },
    };
  }
  return { ...world, year, standings, order: orderFor(year, world.realms), cursor: 0 };
}

/** Rolls the acting realm's opening (a death and an heir, then the year's weather and harvest). */
function openActing(world: World, rng: Rng, events: SimEvent[]): World {
  const seat = actingSeat(world);
  const realm = world.realms[seat] as Realm;
  const opened = openYear(
    realm,
    world.year,
    world.fate,
    world.terms,
    yearStreams(rng, world.year, seat),
  );
  const realms = world.realms.map((r) => (r.seat === seat ? opened.realm : r));
  let next: World = { ...world, realms };
  if (opened.realm.opening?.succession || opened.ended) {
    next = {
      ...next,
      between: [
        ...next.between,
        { seat, year: world.year, kind: 'died', numbers: { generation: realm.ruler.generation } },
      ],
    };
  }
  if (isHuman(realm)) events.push(...opened.events);
  return next;
}
