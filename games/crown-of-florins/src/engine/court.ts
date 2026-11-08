/**
 * The court: who sits at the table and what realms they begin with.
 *
 * A court is chosen on the court-setup screen (seats, human or AI, names,
 * title forms, towns, arms, difficulty, fate) or derived from the seed for
 * quick starts, the daily scenario and the Hall's demo. `createRealms`
 * turns it into the opening realms, every one with the 1978 starting
 * numbers, as the original gave every player the same start.
 */
import { createRng, type OptionValue, type Rng, type WorldOptions } from '@one-more-year/kit';
import { drawCourtArms, isArmsSpec, type ArmsSpec } from '../lib/heraldry.ts';
import { GIVEN_NAMES, PERSONALITIES, RIVALS, TOWNS, regnal } from '../content/names.ts';
import { rollDeathYear } from './lifespan.ts';
import { FIRST_YEAR, START } from './rules.ts';
import type { Scenario } from './scenarios.ts';
import type {
  Controller,
  Difficulty,
  Fate,
  PastRuler,
  Personality,
  Realm,
  Ruler,
  TitleForm,
} from './state.ts';

export const MAX_SEATS = 6;

export interface SeatChoice {
  controller: Controller;
  name: string;
  form: TitleForm;
  town: string;
  arms: ArmsSpec;
}

export interface Court {
  seats: SeatChoice[];
  difficulty: Difficulty;
  fate: Fate;
}

/** A quick court: `humans` people at the table and AI rivals filling the rest. */
export function quickCourt(
  seed: number,
  humans: number,
  rivals: number,
  options: { difficulty?: Difficulty; fate?: Fate; personalities?: readonly Personality[] } = {},
): Court {
  const rng = createRng(seed).fork('court');
  const total = Math.min(MAX_SEATS, Math.max(1, humans + rivals));
  const chosen = options.personalities ?? rng.fork('rivals').shuffle(PERSONALITIES);
  const arms = drawCourtArms(rng.fork('arms'), total);
  const usedTowns = new Set<string>();
  const usedNames = new Set<string>();
  const seats: SeatChoice[] = [];
  for (let seat = 0; seat < total; seat++) {
    const seatArms = arms[seat] as ArmsSpec;
    if (seat < humans) {
      const seatRng = rng.fork(`seat:${seat}`);
      const form: TitleForm = seatRng.chance(0.5) ? 'm' : 'f';
      seats.push({
        controller: { kind: 'human' },
        name: pickFresh(seatRng, GIVEN_NAMES[form], usedNames),
        form,
        town: pickFresh(seatRng, TOWNS, usedTowns),
        arms: seatArms,
      });
      continue;
    }
    const personality = chosen[(seat - humans) % chosen.length] as Personality;
    const character = RIVALS[personality];
    usedNames.add(character.name);
    usedTowns.add(character.town);
    seats.push({
      controller: { kind: 'ai', personality },
      name: character.name,
      form: character.form,
      town: character.town,
      arms: seatArms,
    });
  }
  // The human seats were named before every rival was placed; rename any clash of town or name.
  for (const seat of seats) {
    if (seat.controller.kind === 'ai') continue;
    const rivals = seats.filter((other) => other !== seat && other.controller.kind === 'ai');
    if (rivals.some((other) => other.town === seat.town)) {
      seat.town = pickFresh(rng.fork('rename'), TOWNS, usedTowns);
    }
    if (rivals.some((other) => other.name === seat.name)) {
      seat.name = pickFresh(rng.fork('rename-ruler'), GIVEN_NAMES[seat.form], usedNames);
    }
  }
  return { seats, difficulty: options.difficulty ?? 2, fate: options.fate ?? 'dynasty' };
}

/**
 * The court as setup options (ADR-0009), so a resumed run and "Replay this
 * world" seat the same people.
 */
export function courtOptions(court: Court): WorldOptions {
  return { court: JSON.parse(JSON.stringify(court)) as OptionValue };
}

/** The court saved in the setup options, or null when there is none or it does not read back whole. */
export function courtFromOptions(options: WorldOptions | undefined): Court | null {
  const raw = options?.court;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const court = raw as Record<string, unknown>;
  const seats = court.seats;
  if (!Array.isArray(seats) || seats.length < 1 || seats.length > MAX_SEATS) return null;
  if (![1, 2, 3, 4].includes(court.difficulty as number)) return null;
  if (court.fate !== 'dynasty' && court.fate !== 'classic') return null;
  const parsed: SeatChoice[] = [];
  for (const seat of seats as unknown[]) {
    const choice = seatFrom(seat);
    if (!choice) return null;
    parsed.push(choice);
  }
  return { seats: parsed, difficulty: court.difficulty as Difficulty, fate: court.fate };
}

function seatFrom(value: unknown): SeatChoice | null {
  if (!value || typeof value !== 'object') return null;
  const seat = value as Record<string, unknown>;
  const controller = seat.controller as Record<string, unknown> | undefined;
  const name = typeof seat.name === 'string' ? seat.name.trim().slice(0, 40) : '';
  const town = typeof seat.town === 'string' ? seat.town.trim().slice(0, 40) : '';
  if (name === '' || town === '' || (seat.form !== 'm' && seat.form !== 'f')) return null;
  if (!isArmsSpec(seat.arms)) return null;
  let parsed: Controller;
  if (controller?.kind === 'human') parsed = { kind: 'human' };
  else if (
    controller?.kind === 'ai' &&
    PERSONALITIES.includes(controller.personality as Personality)
  ) {
    parsed = { kind: 'ai', personality: controller.personality as Personality };
  } else return null;
  return { controller: parsed, name, form: seat.form, town, arms: seat.arms };
}

/**
 * A scenario that insists on a rival (The General Next Door) gets one: the
 * first AI seat takes that character and turns aggressive, or one is pulled
 * up to the table if there is room and no AI seat at all.
 */
export function withAggressor(court: Court, scenario: Scenario, seed: number): Court {
  const aggressor = scenario.aggressor;
  if (!aggressor) return court;
  const character = RIVALS[aggressor.personality];
  const controller: Controller = {
    kind: 'ai',
    personality: aggressor.personality,
    aggressive: true,
  };
  const index = court.seats.findIndex((seat) => seat.controller.kind === 'ai');
  const seats = [...court.seats];
  if (index >= 0) {
    const old = seats[index] as SeatChoice;
    const clash = seats.some((seat, i) => i !== index && seat.town === character.town);
    seats[index] = {
      ...old,
      controller,
      name: character.name,
      form: character.form,
      town: clash ? old.town : character.town,
    };
  } else if (seats.length < MAX_SEATS) {
    const arms = drawCourtArms(createRng(seed).fork('aggressor-arms'), seats.length + 1);
    seats.push({
      controller,
      name: character.name,
      form: character.form,
      town: character.town,
      arms: arms[seats.length] as ArmsSpec,
    });
  }
  return { ...court, seats };
}

function pickFresh(rng: Rng, list: readonly string[], used: Set<string>): string {
  const free = list.filter((item) => !used.has(item));
  const pick = rng.pick(free.length > 0 ? free : list);
  used.add(pick);
  return pick;
}

/** The founders' realms, all with the 1978 starting numbers. */
export function createRealms(court: Court, seed: number): Realm[] {
  const lifespans = createRng(seed).fork('lifespan');
  return court.seats.map((choice, seat) => {
    const accession = FIRST_YEAR;
    const ruler: Ruler = {
      name: choice.name,
      form: choice.form,
      accession,
      ageAtAccession: 20 + lifespans.fork(`age:${seat}`).int(0, 10),
      deathYear: rollDeathYear(accession, lifespans.fork(`seat:${seat}`)),
      generation: 1,
    };
    return {
      seat,
      controller: choice.controller,
      city: choice.town,
      arms: choice.arms,
      ruler,
      pastRulers: [],
      title: START.title,
      people: {
        serfs: START.serfs,
        soldiers: START.soldiers,
        merchants: START.merchants,
        nobles: START.nobles,
        clergy: START.clergy,
      },
      land: START.land,
      grain: START.grain,
      treasury: START.treasury,
      holdings: { markets: 0, mills: 0, palace: 0, cathedral: 0 },
      taxes: {
        customs: START.customs,
        sales: START.sales,
        wealth: START.wealth,
        justice: START.justice,
      },
      prosperity: START.prosperity,
      status: 'reigning',
      opening: null,
      last: null,
      pointsHistory: [],
      record: {
        taxRaised: false,
        invadedCount: 0,
        repelledCount: 0,
        bankruptcies: 0,
        famineYears: 0,
        weathersSeen: [],
        crownedYear: null,
        peakSoldiers: START.soldiers,
      },
    };
  });
}

/**
 * designed: the heir who takes the throne in Dynasty, one title step below
 * the ruler who died. A given name from the same form's list, numbered if an
 * ancestor bore it.
 */
export function heirOf(realm: Realm, year: number, rng: Rng): Ruler {
  const form: TitleForm = rng.chance(0.5) ? 'm' : 'f';
  const base = rng.pick(GIVEN_NAMES[form]);
  const line: Ruler[] = [...realm.pastRulers.map((past: PastRuler) => past.ruler), realm.ruler];
  const namesake = line.filter((ruler) => ruler.name.split(' ')[0] === base).length;
  return {
    name: `${base}${regnal(namesake + 1)}`,
    form,
    accession: year,
    ageAtAccession: 16 + rng.int(0, 14),
    deathYear: rollDeathYear(year, rng),
    generation: realm.ruler.generation + 1,
  };
}
