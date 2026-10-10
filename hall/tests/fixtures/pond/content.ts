/**
 * Pond's words: event sentences, epithets, share glyphs, milestones and the
 * codex. Everything a player reads lives here, apart from the engine, so the
 * model never writes prose and the prose never invents numbers.
 */
import {
  formatNumber,
  numberOf,
  type AutoMilestoneDef,
  type CodexEntryDef,
  type EpithetRule,
  type EventText,
  type RunHistory,
  type TurnRecord,
} from '@one-more-year/kit';
import type { PondPlan } from './model.ts';
import { YEARS } from './model.ts';

const fish = (count: number): string => `${formatNumber(count)} fish`;

export const EVENT_TEXT: EventText = {
  catch: (e) => `You landed ${fish(numberOf(e, 'fish'))}.`,
  rain: () => 'A wet spring filled the pond to the brim.',
  fair: () => 'A fair year, neither wet nor dry.',
  dry: () => 'A dry summer: the water dropped and the shallows warmed.',
  heron: (e) => `A heron fished the shallows and took ${fish(numberOf(e, 'fish'))}.`,
  births: (e) => `${fish(numberOf(e, 'fish'))} hatched and grew.`,
  spawning: (e) => `A spawning run: ${fish(numberOf(e, 'fish'))} joined the shoal.`,
  bloom: (e) =>
    `Weed at ${formatNumber(numberOf(e, 'weed'))}% fed an algae bloom; ${fish(numberOf(e, 'fish'))} were lost.`,
  emptied: () => 'The last fish are gone. The pond is still.',
};

export const EPITHETS: readonly EpithetRule[] = [
  {
    id: 'clear-water',
    text: 'Keeper of the Clear Water',
    priority: 3,
    when: (h) =>
      h.series('weed').every((weed) => weed <= 0.5) && h.final('fish') >= h.first('fish'),
  },
  {
    id: 'shoal-builder',
    text: 'Who Let the Shoal Grow',
    priority: 2,
    when: (h) => h.neverFell('fish'),
  },
  {
    id: 'village-fed',
    text: 'Who Fed the Village',
    priority: 1,
    when: (h) => h.final('caught') >= 300 && h.final('fish') > 0,
  },
  {
    id: 'heron-friend',
    text: 'Friend of the Grey Heron',
    when: (h) => h.count('heron') >= 3,
  },
  {
    id: 'quiet-bank',
    text: 'Who Watched from the Bank',
    when: (h) => h.final('caught') === 0,
  },
];

/** One glyph per year for the share string: the year's worst news, or its weather. */
export function glyphFor(record: TurnRecord<PondPlan>): string {
  const kinds = new Set(record.events.map((e) => e.kind));
  if (kinds.has('emptied')) return '🫧';
  if (kinds.has('bloom')) return '🟩';
  if (kinds.has('heron')) return '🪶';
  if (kinds.has('spawning')) return '🐟';
  if (kinds.has('rain')) return '🌧️';
  if (kinds.has('dry')) return '☀️';
  return '🌤️';
}

export function titleFor(history: RunHistory): string {
  const years = Math.max(...history.records.map((record) => record.turn));
  return years >= YEARS
    ? 'Eight years at the pond'
    : `${years} ${years === 1 ? 'year' : 'years'} at the pond`;
}

export function shareLineFor(history: RunHistory): string {
  const start = history.first('fish');
  const end = history.final('fish');
  const change = start > 0 ? Math.round(((end - start) / start) * 100) : 0;
  return `Fish ${change >= 0 ? '+' : '−'}${Math.abs(change)}% · Caught ${formatNumber(history.final('caught'))}`;
}

export const MILESTONES: readonly AutoMilestoneDef[] = [
  {
    id: 'fuller-pond',
    kind: 'stewardship',
    title: 'Fuller than you found it',
    description: 'Finish eight years with more fish than you started with.',
    points: 25,
    atRunEnd: (h) => h.records.length >= YEARS && h.final('fish') > h.first('fish'),
  },
  {
    id: 'good-catch',
    kind: 'stewardship',
    title: 'A good catch',
    description: 'Land 300 fish in one run and still leave a living pond.',
    points: 30,
    atRunEnd: (h) => h.final('caught') >= 300 && h.final('fish') > 0,
  },
  {
    id: 'first-entry',
    kind: 'insight',
    title: 'First page of the codex',
    description: 'Discover one of the pond’s phenomena.',
    points: 10,
    codexDiscovered: 1,
  },
  {
    id: 'whole-codex',
    kind: 'insight',
    title: 'Every ripple explained',
    description: 'Discover every phenomenon the pond can produce.',
    points: 25,
    codexDiscovered: 'all',
  },
  {
    id: 'hands-off',
    kind: 'curiosity',
    title: 'Hands off',
    description: 'Finish a run without catching a single fish.',
    points: 15,
    atRunEnd: (h) => h.records.length >= YEARS && h.final('caught') === 0,
  },
  {
    id: 'weed-garden',
    kind: 'curiosity',
    title: 'Weed garden',
    description: 'Let the weed cover more than nine tenths of the pond.',
    points: 10,
    secret: true,
    atRunEnd: (h) => h.series('weed').some((weed) => weed > 0.9),
  },
];

const art = (body: string): string =>
  `<g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${body}</g>`;

export const CODEX: readonly CodexEntryDef[] = [
  {
    id: 'heron',
    title: 'The grey heron',
    summary: 'A patient bird that wades the shallows and takes a share of the fish.',
    tendency: 'Any year, whatever you do; it is the one thing in the pond you cannot plan for.',
    mechanism:
      'Each year has a 15% chance of a heron visit. It takes between 8 and 24 fish, evenly likely.',
    hint: 'Something tall stands very still at the water’s edge.',
    revealAfter: 2,
    art: art(
      '<path d="M20 40V30M26 40V30M18 30C14 24 16 16 24 14C28 13 30 10 29 7L36 9L30 11C32 16 33 22 30 28C28 31 23 31 18 30Z"/><path d="M8 42H40"/>',
    ),
  },
  {
    id: 'algae-bloom',
    title: 'Algae bloom',
    summary: 'When weed smothers the water, a green bloom can steal the oxygen fish need.',
    tendency:
      'Weed cover above 60%, especially after a run of dry years when few fish graze the weed.',
    mechanism:
      'Above 60% weed, the chance of a bloom is (weed − 60) ÷ 40, at most 90%. A bloom kills 20–35% of the fish.',
    hint: 'The water turns a colour it should not be.',
    art: art(
      '<path d="M6 30C12 26 18 34 24 30C30 26 36 34 42 30"/><circle cx="14" cy="20" r="3"/><circle cx="26" cy="16" r="4"/><circle cx="34" cy="22" r="2.5"/><path d="M8 38H40"/>',
    ),
  },
  {
    id: 'drought-year',
    title: 'Dry summer',
    summary: 'Low water and warm shallows: fewer young fish survive.',
    tendency: 'About one year in five.',
    mechanism:
      'Dry years come with 20% odds. The birth rate falls from 0.40 to 0.20 and the weed barely grows (+1 point).',
    hint: 'The bank shows a ring where the water used to be.',
    art: art(
      '<circle cx="24" cy="14" r="6"/><path d="M24 3V5M24 23V25M13 14H15M33 14H35M16 6L17.5 7.5M30.5 20.5L32 22M16 22L17.5 20.5M30.5 7.5L32 6"/><path d="M8 36C14 33 20 39 26 36C32 33 36 37 40 36"/>',
    ),
  },
  {
    id: 'spawning-run',
    title: 'Spawning run',
    summary: 'A year when the shoal multiplies far beyond the usual.',
    tendency: 'Wet years with a middling shoal and weed near its sweet spot, around 44% cover.',
    mechanism:
      'Births follow r × F × (1 − F ÷ K): r is 0.55 in a wet year, and the pond holds K = 120 + 8W − 0.09W² fish at W% weed. 30 births or more is a spawning run.',
    hint: 'One spring the shallows seem to shimmer.',
    art: art(
      '<path d="M8 20C11 17 15 17 18 20C15 23 11 23 8 20ZM18 20L21 18V22Z"/><path d="M22 30C25 27 29 27 32 30C29 33 25 33 22 30ZM32 30L35 28V32Z"/><path d="M26 13C28 11 31 11 33 13C31 15 28 15 26 13Z"/><path d="M6 40H42"/>',
    ),
  },
];

/** The "How to play" dialog text, as headed paragraphs. */
export const HOW_TO_PLAY: readonly { heading: string; text: string }[] = [
  {
    heading: 'Your pond',
    text: 'Fish, weed and weather. Fish graze the weed; some weed shelters young fish; too much chokes the water.',
  },
  {
    heading: 'Each year',
    text: 'Choose how many fish to catch, then end the year. The forecast shows what the catch leaves behind exactly, and the likely range for next spring.',
  },
  {
    heading: 'The end',
    text: 'After eight years, or if the fish are gone, the run becomes a chronicle in the Library. Replay the same world to try another way.',
  },
];
