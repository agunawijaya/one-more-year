/**
 * The words a finished year leaves behind: one line per kind of event (for
 * the herald's scroll, the chronicle's timeline and its key moments), the
 * daily glyphs, the share line and the chronicle's title. All our own.
 */
import {
  formatNumber,
  numberOf,
  type EventText,
  type RunHistory,
  type SimEvent,
  type TurnRecord,
} from '@one-more-year/kit';
import { titleName } from './names.ts';
import type { SeatChoice } from '../engine/court.ts';
import { courtFor } from '../engine/model.ts';
import { scenarioFor } from '../engine/scenarios.ts';
import type { Plan } from '../engine/state.ts';

const n = (e: SimEvent, name: string): string => formatNumber(numberOf(e, name));
const formOf = (e: SimEvent): 'm' | 'f' => (numberOf(e, 'female') === 1 ? 'f' : 'm');
const plural = (count: number, one: string, many: string): string =>
  `${formatNumber(count)} ${count === 1 ? one : many}`;

const WEATHER_LINES = [
  'Drought: the fields cracked and gave back {harvest} bushels.',
  'A poor year: {harvest} bushels from the fields.',
  'A fair year: {harvest} bushels came in.',
  'A good year: {harvest} bushels filled the carts.',
  'An excellent year: {harvest} bushels, and the carts ran late into the evening.',
] as const;

export const EVENT_TEXT: EventText = {
  weather: (e) =>
    (WEATHER_LINES[numberOf(e, 'grade') - 1] ?? WEATHER_LINES[2]).replace(
      '{harvest}',
      n(e, 'harvest'),
    ),
  rats: (e) => `Rats ate ${n(e, 'percent')}% of the granary: ${n(e, 'bushels')} bushels.`,
  'ruler-died': () => 'The ruler died, and the bells rang the whole day.',
  'heir-crowned': (e) =>
    `An heir took the throne, the ${ordinalWord(numberOf(e, 'generation'))} of the line.`,
  'line-ended': () => 'No heir came forward, and the line ended there.',
  famine: (e) => `Hunger: ${plural(numberOf(e, 'deaths'), 'serf', 'serfs')} died.`,
  newcomers: (e) =>
    `Bread drew ${plural(numberOf(e, 'serfs'), 'newcomer', 'newcomers')} to the gates` +
    (numberOf(e, 'merchants') > 0
      ? `, ${plural(numberOf(e, 'merchants'), 'merchant', 'merchants')} among them.`
      : '.'),
  fled: (e) => `${plural(numberOf(e, 'serfs'), 'serf', 'serfs')} fled the harsh courts.`,
  'merchants-left': (e) =>
    `${plural(numberOf(e, 'merchants'), 'merchant', 'merchants')} packed up and left the hungry city.`,
  invaded: (e) =>
    numberOf(e, 'by') < 0
      ? `Mercenaries took ${n(e, 'hectares')} hectares; ${plural(numberOf(e, 'soldiers'), 'soldier', 'soldiers')} fell.`
      : `A rival army took ${n(e, 'hectares')} hectares; ${plural(numberOf(e, 'soldiers'), 'soldier', 'soldiers')} fell.`,
  interest: (e) => `The bankers added ${n(e, 'florins')} florins of interest.`,
  bankrupt: () => 'The creditors came and took the buildings, the grain and most of the land.',
  built: (e) => builtLine(e),
  promoted: (e) =>
    `The college of heralds raised the ruler to ${titleName(numberOf(e, 'to'), formOf(e))}.`,
  crowned: (e) =>
    `Crowned ${titleName(8, formOf(e))}, in the ${ordinalWord(numberOf(e, 'reign'))} year of the reign.`,
  'rival-crowned': () => 'A rival was crowned first. The race goes on for a crown of your own.',
  'justice-cost': (e) =>
    `The ${JUSTICE_WORDS[numberOf(e, 'justice') - 1] ?? 'harsh'} courts cost a title this year.`,
  retired: () => 'The chronicle was closed and the book laid on the shelf.',
};

const JUSTICE_WORDS = ['very fair', 'moderate', 'harsh', 'outrageous'] as const;

function builtLine(e: SimEvent): string {
  const parts: string[] = [];
  const add = (count: number, one: string, many: string): void => {
    if (count > 0) parts.push(plural(count, one, many));
  };
  add(numberOf(e, 'markets'), 'marketplace', 'marketplaces');
  add(numberOf(e, 'mills'), 'woollen mill', 'woollen mills');
  add(numberOf(e, 'palace'), 'piece of the palace', 'pieces of the palace');
  add(numberOf(e, 'cathedral'), 'piece of the cathedral', 'pieces of the cathedral');
  add(numberOf(e, 'platoons'), 'platoon', 'platoons');
  if (parts.length === 0) return 'The masons rested.';
  const list =
    parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
  return `The masons raised ${list ?? ''} (${n(e, 'florins')} florins).`;
}

const ORDINAL_WORDS = [
  'first',
  'second',
  'third',
  'fourth',
  'fifth',
  'sixth',
  'seventh',
  'eighth',
  'ninth',
  'tenth',
];

export function ordinalWord(count: number): string {
  const word = ORDINAL_WORDS[count - 1];
  if (word) return word;
  const tens = count % 100;
  const suffix = tens >= 11 && tens <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][count % 10] ?? 'th');
  return `${count}${suffix}`;
}

// ---- daily glyphs --------------------------------------------------------------------

const WEATHER_GLYPHS = ['🌩️', '🌧️', '☁️', '🌤️', '☀️'] as const;

/** One glyph per year: 👑 a title gained, then ⚔️ invaded, then 🏛️ something built, else the weather. */
export function glyphFor(record: TurnRecord<Plan>): string {
  const kinds = new Set(record.events.map((e) => e.kind));
  if (kinds.has('promoted') || kinds.has('crowned')) return '👑';
  if (kinds.has('invaded')) return '⚔️';
  const built = record.events.find((e) => e.kind === 'built');
  if (
    built &&
    numberOf(built, 'markets') +
      numberOf(built, 'mills') +
      numberOf(built, 'palace') +
      numberOf(built, 'cathedral') >
      0
  ) {
    return '🏛️';
  }
  const weather = record.events.find((e) => e.kind === 'weather');
  return WEATHER_GLYPHS[(weather ? numberOf(weather, 'grade') : 3) - 1] ?? '☁️';
}

// ---- the run as a whole ------------------------------------------------------------------

/** The seat whose story the chronicle tells: the crowned seat, or the first human's. */
export function ownerSeat(history: RunHistory): number {
  for (const record of history.records) {
    if (record.events.some((e) => e.kind === 'crowned')) return record.seat;
  }
  return history.records[0]?.seat ?? 0;
}

/** That seat's years only, in a hot-seat run. */
export function ownerRecords(history: RunHistory): readonly TurnRecord<unknown>[] {
  const seat = ownerSeat(history);
  return history.records.filter((record) => record.seat === seat);
}

export function crownedEvent(history: RunHistory): SimEvent | null {
  for (const record of ownerRecords(history)) {
    const crowned = record.events.find((e) => e.kind === 'crowned');
    if (crowned) return crowned;
  }
  return null;
}

/** The highest title the owner's line reached, with the form it was held in. */
/** The owner's seat as the court was set at the start of the run. */
export function ownerChoice(history: RunHistory): SeatChoice | null {
  return courtFor(history.setup).seats[ownerSeat(history)] ?? null;
}

export function highestReached(history: RunHistory): { title: number; form: 'm' | 'f' } {
  const start = scenarioFor(history.setup.scenario).humans.title ?? 1;
  let best = { title: start, form: ownerChoice(history)?.form ?? 'm' };
  for (const record of ownerRecords(history)) {
    for (const e of record.events) {
      if (e.kind === 'promoted' && numberOf(e, 'to') >= best.title) {
        best = { title: numberOf(e, 'to'), form: formOf(e) };
      }
    }
  }
  return best;
}

export function yearsPlayed(history: RunHistory): number {
  return ownerRecords(history).length;
}

/** "Valdorsa: twenty-seven years to the crown" or "Valdorsa: forty years in the valley". */
export function titleFor(history: RunHistory): string {
  const town = ownerChoice(history)?.town ?? 'The valley';
  const crowned = crownedEvent(history);
  if (crowned) return `${town}: ${spelled(numberOf(crowned, 'years'))} years to the crown`;
  const years = yearsPlayed(history);
  return `${town}: ${spelled(years)} ${years === 1 ? 'year' : 'years'} in the valley`;
}

/** "Regina in 27 years · 4 rivals", the share string's headline. */
export function shareLineFor(history: RunHistory): string {
  const crowned = crownedEvent(history);
  const best = highestReached(history);
  const rivals = courtFor(history.setup).seats.length - 1;
  const rivalsText = plural(rivals, 'rival', 'rivals');
  if (crowned) {
    return `${titleName(8, formOf(crowned))} in ${formatNumber(numberOf(crowned, 'years'))} years · ${rivalsText}`;
  }
  return `${titleName(best.title, best.form)} after ${formatNumber(yearsPlayed(history))} years · ${rivalsText}`;
}

const SMALL = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/** Numbers below a hundred in words; larger ones as figures. */
export function spelled(count: number): string {
  if (count < 0 || count >= 100 || !Number.isInteger(count)) return formatNumber(count);
  if (count < 20) return SMALL[count] ?? String(count);
  const tens = TENS[Math.floor(count / 10)] ?? '';
  const ones = count % 10;
  return ones === 0 ? tens : `${tens}-${SMALL[ones] ?? ''}`;
}

export function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
