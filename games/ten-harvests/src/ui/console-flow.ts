/**
 * The scribe's console: the four questions of a year asked one at a time,
 * in the order the 1968 program asked them. How much land to buy; only if
 * none, how much to sell; how much grain to give out as food; how many
 * acres to sow. An impossible answer is refused with a reason and the same
 * question is asked again.
 *
 * Pure state: the teletype panel (1978 Ledger) and the console overlay
 * (any mode) both drive it. Under the 1978 rules a negative answer is
 * accepted, and the steward walks out; the normal rules refuse it.
 */
import { formatNumber } from '@one-more-year/kit';
import { maxSownWith, seedFor, workersLimit } from '../engine/model.ts';
import type { CityState, Decree } from '../engine/state.ts';

export type Question = 'buy' | 'sell' | 'food' | 'plant';

export interface ConsoleState {
  question: Question | 'done';
  decree: Decree;
}

export type Answer =
  | { kind: 'next'; state: ConsoleState }
  | { kind: 'refused'; reason: string; state: ConsoleState }
  | { kind: 'decree'; decree: Decree };

const n = (value: number): string => formatNumber(value);

export const PROMPTS: Readonly<Record<Question, string>> = {
  buy: 'ACRES TO BUY?',
  sell: 'ACRES TO SELL?',
  food: 'BUSHELS FOR FOOD?',
  plant: 'ACRES TO SOW?',
};

export function startConsole(): ConsoleState {
  return { question: 'buy', decree: { land: 0, food: 0, plant: 0 } };
}

/** Reads one typed line: a whole number, possibly negative; anything else is not a number. */
export function parseAnswer(text: string): number | null {
  const trimmed = text.trim().replace(/,/g, '');
  if (!/^-?\d+$/.test(trimmed)) return null;
  return Number(trimmed);
}

export function answer(city: CityState, current: ConsoleState, typed: string): Answer {
  const value = parseAnswer(typed);
  const refuse = (reason: string): Answer => ({ kind: 'refused', reason, state: current });
  if (value === null) return refuse('A WHOLE NUMBER, PLEASE.');
  if (value < 0) {
    if (city.ruleSet === '1978')
      return { kind: 'decree', decree: { ...current.decree, walkout: true } };
    return refuse('NOTHING LESS THAN NOTHING, PLEASE.');
  }
  const { decree } = current;
  switch (current.question) {
    case 'buy': {
      if (value * city.landPrice > city.grain) {
        return refuse(
          `THE STORE HOLDS ${n(city.grain)} BUSHELS: ENOUGH FOR ${n(Math.floor(city.grain / city.landPrice))} ACRES.`,
        );
      }
      const next = { ...decree, land: value };
      return { kind: 'next', state: { question: value > 0 ? 'food' : 'sell', decree: next } };
    }
    case 'sell': {
      if (value >= city.acres)
        return refuse(`THE CITY HAS ${n(city.acres)} ACRES AND MUST KEEP ONE.`);
      return { kind: 'next', state: { question: 'food', decree: { ...decree, land: -value } } };
    }
    case 'food': {
      const left = city.grain - decree.land * city.landPrice;
      if (value > left) return refuse(`ONLY ${n(left)} BUSHELS ARE LEFT TO GIVE.`);
      return { kind: 'next', state: { question: 'plant', decree: { ...decree, food: value } } };
    }
    case 'plant': {
      const owned = city.acres + decree.land;
      const left = city.grain - decree.land * city.landPrice - decree.food;
      if (value > owned) return refuse(`THE CITY OWNS ${n(owned)} ACRES.`);
      if (seedFor(value) > left)
        return refuse(`SEED FOR ${n(maxSownWith(left))} ACRES IS ALL THE STORE CAN SPARE.`);
      if (value > workersLimit(city.people)) {
        return refuse(`${n(city.people)} PEOPLE CAN TEND ${n(workersLimit(city.people))} ACRES.`);
      }
      return { kind: 'decree', decree: { ...decree, plant: value } };
    }
    case 'done':
      return { kind: 'decree', decree };
  }
}

/** The report the teletype prints before the questions: the year just lived, in plain numbers. */
export function reportLines(city: CityState, yearLabel: string): string[] {
  const last = city.last;
  const lines = [yearLabel.toUpperCase() + '.'];
  if (last.year === 0) lines.push('THE YEAR BEFORE YOU TOOK THE SEAL:');
  lines.push(
    last.hungry > 0
      ? `${n(last.hungry)} WENT HUNGRY. ${n(last.newcomers)} CAME TO THE CITY.`
      : `NOBODY WENT HUNGRY. ${n(last.newcomers)} CAME TO THE CITY.`,
  );
  if (last.feverLost > 0) lines.push(`FEVER TOOK ${n(last.feverLost)}.`);
  lines.push(`PEOPLE ${n(city.people)}. LAND ${n(city.acres)} ACRES.`);
  lines.push(`THE FIELDS GAVE ${last.yieldPerAcre} AN ACRE. RATS TOOK ${n(last.ratsAte)}.`);
  lines.push(`IN STORE ${n(city.grain)} BUSHELS.`);
  lines.push(`LAND GOES FOR ${city.landPrice} AN ACRE.`);
  return lines;
}
