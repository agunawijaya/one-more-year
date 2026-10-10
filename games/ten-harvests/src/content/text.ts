/**
 * The words of the year: one sentence per event kind, the verdicts' two
 * lines each, chronicle titles, share glyphs and the scribe's advice. All of
 * it is ours; nothing is taken from the original program's lines.
 */
import {
  formatNumber,
  numberOf,
  type EventText,
  type RunHistory,
  type SimEvent,
  type TurnRecord,
} from '@one-more-year/kit';
import type { VerdictId } from '../engine/judge.ts';
import type { Ledger } from '../engine/odds.ts';
import type { CityState, Decree } from '../engine/state.ts';
import { acresOf, bushelsOf, plural } from './counts.ts';

const n = (value: number): string => formatNumber(value);

export const EVENT_TEXT: EventText = {
  'land-bought': (e) =>
    `The city bought ${acresOf(numberOf(e, 'acres'))} at ${numberOf(e, 'price')} bushels each.`,
  'land-sold': (e) =>
    `The city sold ${acresOf(numberOf(e, 'acres'))} at ${numberOf(e, 'price')} bushels each.`,
  sown: (e) => {
    const acres = numberOf(e, 'acres');
    const seed = numberOf(e, 'seed');
    const sown = `${acresOf(acres)} ${plural(acres, 'was', 'were')} sown`;
    // One odd acre costs no seed at all: the half-bushel is rounded away.
    return seed === 0
      ? `${sown}, and the seed it needed rounded down to nothing.`
      : `${sown} with ${bushelsOf(seed)} of seed.`;
  },
  'every-hand': () => 'Every pair of hands in the city was out in the fields.',
  harvest: (e) => {
    const acres = numberOf(e, 'acres');
    const perAcre = numberOf(e, 'yield');
    if (acres === 0) return 'Nothing was sown, so nothing was reaped.';
    const kind =
      perAcre >= 4 ? 'A fine harvest' : perAcre <= 2 ? 'A thin harvest' : 'An ordinary harvest';
    return `${kind}: ${bushelsOf(perAcre)} an acre, ${n(numberOf(e, 'bushels'))} in all.`;
  },
  rats: (e) => {
    const eaten = numberOf(e, 'eaten');
    return eaten > 0
      ? `Rats got into the granary and ate ${bushelsOf(eaten)}.`
      : 'Rats came to the granary and found it bare.';
  },
  'generous-year': () => 'More rations were handed out than there were mouths to feed.',
  hunger: (e) => {
    const hungry = numberOf(e, 'hungry');
    return `${n(hungry)} ${plural(hungry, 'person', 'people')} went hungry this year.`;
  },
  'all-fed': () => 'Everyone in the city was fed.',
  newcomers: (e) => {
    const people = numberOf(e, 'people');
    return people === 1
      ? 'One newcomer came to the city.'
      : `${n(people)} newcomers came to the city.`;
  },
  fever: (e) => `A fever passed through the lanes; ${n(numberOf(e, 'lost'))} were lost to it.`,
  deposed: (e) =>
    `${n(numberOf(e, 'hungry'))} of ${n(numberOf(e, 'people'))} went hungry, and the council met at dawn.`,
  'walked-out': () => 'Handed a number below nothing, the steward bowed and left.',
  'term-judged': (e) => `Term ${numberOf(e, 'term')} came to its end and was judged.`,
};

/** Two lines for each verdict: warm, a little dry, never cruel. */
/**
 * The report's headline: the harvest, and the one other thing the year will be
 * remembered for. Short phrases, so the headline never repeats a line below it.
 */
export function headlineFor(events: readonly SimEvent[]): string {
  const find = (kind: string): SimEvent | undefined => events.find((e) => e.kind === kind);
  if (find('deposed')) return 'The council meets at dawn';
  if (find('walked-out')) return 'The steward has gone';
  const harvest = find('harvest');
  const perAcre = harvest ? numberOf(harvest, 'yield') : 0;
  const sown = harvest ? numberOf(harvest, 'acres') : 0;
  const lead =
    sown === 0
      ? 'A year with nothing sown'
      : perAcre >= 4
        ? 'A fine harvest'
        : perAcre <= 2
          ? 'A thin harvest'
          : 'An ordinary harvest';
  const hungry = find('hunger');
  const rats = find('rats');
  const newcomers = find('newcomers');
  const second = find('fever')
    ? 'fever in the lanes'
    : hungry
      ? 'empty bowls'
      : rats && numberOf(rats, 'eaten') > 0
        ? 'rats in the granary'
        : find('generous-year')
          ? 'more rations than mouths'
          : newcomers && numberOf(newcomers, 'people') >= 10
            ? 'families at the gate'
            : find('land-bought')
              ? 'new fields bought'
              : find('land-sold')
                ? 'fields sold'
                : null;
  return second ? `${lead}, and ${second}` : lead;
}

export const VERDICT_LINES: Readonly<Record<VerdictId, readonly [string, string]>> = {
  'ten-quiet-years': [
    'Not one empty bowl in ten years, and land to spare for every family.',
    'The scribes ran out of complaints and started writing poems.',
  ],
  'worth-carving': [
    'Your people ate, your fields spread and the river had nothing to say against you.',
    'The stonecutters ask for a taller stone.',
  ],
  'fair-season': [
    'Some bowls went empty and some fields went unsown, but the city stands.',
    'Most of it thinks kindly of you, especially after dinner.',
  ],
  'heavy-hand': [
    'The granary was guarded better than the people.',
    'They will remember the lean years longer than the good ones.',
  ],
  'sent-to-the-fields': [
    'Too many went hungry, or too little land was left to feed the rest.',
    'The council thanks you warmly and hands you a hoe.',
  ],
  deposed: [
    'So many went hungry in one year that the council met at dawn.',
    'Your sandals have been placed by the gate, neatly, side by side.',
  ],
  'walked-out': [
    'Given a number less than nothing, your steward folded the tablet and bowed.',
    'The steward has gone to keep bees, which are better at arithmetic.',
  ],
};

/** The chronicle's title line. */
export function titleFor(history: RunHistory): string {
  const years = history.records.length;
  switch (history.outcome.ending) {
    case 'dynasty-complete':
      return 'Thirty years, three rulers, one river';
    case 'deposed':
      return `${years} ${plural(years, 'year', 'years')} on the river, then the gate`;
    case 'walked-out':
      return 'A term cut short by a steward’s arithmetic';
    default:
      return 'Ten years on the river';
  }
}

/** The year's share glyph, by priority: fever, rats, the harvest, a wave of newcomers, a quiet year. */
export function glyphFor(record: TurnRecord<unknown>): string {
  const find = (kind: string): SimEvent | undefined => record.events.find((e) => e.kind === kind);
  if (find('fever')) return '🌫️';
  const rats = find('rats');
  if (rats && numberOf(rats, 'eaten') > 0) return '🐀';
  const harvest = find('harvest');
  const perAcre = harvest ? numberOf(harvest, 'yield') : 0;
  if (harvest && numberOf(harvest, 'acres') > 0 && perAcre >= 4) return '🌾';
  if (harvest && numberOf(harvest, 'acres') > 0 && perAcre <= 2) return '🌱';
  const newcomers = find('newcomers');
  if (newcomers && numberOf(newcomers, 'face') === 5) return '🏮';
  return '⚖️';
}

/** The share line: how well fed the city was across the run, and its land a head at the end. */
export function shareLineFor(history: RunHistory): string {
  const years = Math.max(1, history.records.length);
  const hungry = history.records.reduce((sum, record) => {
    const hunger = record.events.find((e) => e.kind === 'hunger' || e.kind === 'deposed');
    return sum + (hunger ? numberOf(hunger, 'percent') : 0);
  }, 0);
  const fed = Math.max(0, 100 - hungry / years);
  const perHead = history.final('acres') / Math.max(1, history.final('people'));
  return `Fed ${fed.toFixed(fed === 100 ? 0 : 1)}% · ${perHead.toFixed(1)} acres/person`;
}

export type HintLevel = 'on' | 'quiet' | 'off';

/**
 * The scribe's one line of advice for a decree, or null. 'quiet' keeps
 * only the warnings that matter most. The scribe never spoils the 1978
 * Ledger's secret.
 */
export function scribeAdvice(
  state: CityState,
  decree: Decree,
  ledger: Ledger,
  level: HintLevel,
): string | null {
  if (level === 'off') return null;
  if (ledger.endsRule)
    return 'Your Majesty, with so many hungry the council would not wait for the harvest.';
  if (ledger.hungry > 0)
    return `${n(ledger.hungry)} would go hungry. A fed city grows; a hungry one remembers.`;
  const sowable = Math.min(state.acres + decree.land, ledger.workersLimit);
  if (decree.plant < sowable * 0.8 && ledger.leftInStore > 0)
    return 'There are fields lying idle that the people could sow. Seed returns many times over.';
  if (level === 'quiet') return null;
  if (ledger.leftInStore > ledger.people * 40)
    return 'A full store tempts the rats. Grain sown or spent on land cannot be eaten by them.';
  const perHead = (state.acres + decree.land) / Math.max(1, state.people);
  if (perHead < 9.5)
    return 'When the term is judged, acres a head count: the city is short of land.';
  if (state.landPrice <= 18) return 'Land is cheap this year.';
  return null;
}
