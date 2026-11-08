/**
 * Crown of Florins in the collection's Legacy: the epithets a finished run
 * can earn, the milestones (stewardship, insight, curiosity) and the Codex
 * of what the valley can do, each entry revealing its exact rule after
 * three sightings. All written for this game.
 */
import {
  numberOf,
  type AutoMilestoneDef,
  type CodexEntryDef,
  type EpithetRule,
  type RunHistory,
} from '@one-more-year/kit';
import { courtFromOptions } from '../engine/court.ts';
import type { Plan } from '../engine/state.ts';
import { crownedEvent, ownerRecords, yearsPlayed } from './text.ts';

const plansOf = (h: RunHistory): Plan[] => ownerRecords(h).map((r) => r.plan as Plan);
const count = (h: RunHistory, kind: string): number =>
  ownerRecords(h).reduce((sum, r) => sum + r.events.filter((e) => e.kind === kind).length, 0);
const sum = (h: RunHistory, kind: string, field: string): number =>
  ownerRecords(h).reduce(
    (total, r) =>
      total + r.events.filter((e) => e.kind === kind).reduce((s, e) => s + numberOf(e, field), 0),
    0,
  );
const crowned = (h: RunHistory): boolean => crownedEvent(h) !== null;
/** Which ruler of the line wore the crown: 1 for the founder, 0 when nobody did. */
const crownedGeneration = (h: RunHistory): number => {
  const event = crownedEvent(h);
  return event ? numberOf(event, 'generation') : 0;
};
const crownedWithin = (h: RunHistory, years: number): boolean => {
  const event = crownedEvent(h);
  return event !== null && numberOf(event, 'years') < years;
};
const lastBuilt = (h: RunHistory, field: 'cathedralNow' | 'palaceNow'): number =>
  ownerRecords(h)
    .flatMap((r) => r.events.filter((e) => e.kind === 'built'))
    .reduce((most, e) => Math.max(most, numberOf(e, field)), 0);
const neverRaisedTaxes = (h: RunHistory): boolean =>
  plansOf(h).every((plan) => plan.customs <= 25 && plan.sales <= 10 && plan.wealth <= 5);
const difficultyOf = (h: RunHistory): number => courtFromOptions(h.setup.options)?.difficulty ?? 2;

/** Highest priority first when several hold. */
export const EPITHETS: readonly EpithetRule[] = [
  {
    id: 'bankrupt-crowned',
    text: 'Crowned Despite the Creditors',
    priority: 20,
    when: (h) => crowned(h) && count(h, 'bankrupt') > 0,
  },
  {
    id: 'three-generations',
    text: 'Whose Grandchildren Wore the Crown',
    priority: 18,
    when: (h) => crownedGeneration(h) >= 3,
  },
  {
    id: 'swift-crown',
    text: 'Crowned Before the Ink Was Dry',
    priority: 16,
    when: (h) => crownedWithin(h, 20),
  },
  {
    id: 'never-invaded',
    text: 'Whose Gates Never Opened',
    priority: 12,
    when: (h) => crowned(h) && count(h, 'invaded') === 0,
  },
  {
    id: 'full-cathedral',
    text: 'Builder of the Whole Cathedral',
    priority: 11,
    when: (h) => lastBuilt(h, 'cathedralNow') >= 6,
  },
  {
    id: 'the-just',
    text: 'The Just',
    priority: 10,
    when: (h) => yearsPlayed(h) >= 10 && plansOf(h).every((plan) => plan.justice <= 1),
  },
  {
    id: 'light-hand',
    text: 'Who Never Raised a Tax',
    priority: 9,
    when: (h) => yearsPlayed(h) >= 10 && neverRaisedTaxes(h),
  },
  {
    id: 'palace-complete',
    text: 'Whose Palace Had a Tower',
    priority: 8,
    when: (h) => lastBuilt(h, 'palaceNow') >= 5,
  },
  {
    id: 'open-gates',
    text: 'Host to a Thousand Newcomers',
    priority: 7,
    when: (h) => sum(h, 'newcomers', 'serfs') >= 1000,
  },
  {
    id: 'never-hungry',
    text: 'Whose People Never Went Hungry',
    priority: 6,
    when: (h) => yearsPlayed(h) >= 15 && count(h, 'famine') === 0,
  },
  {
    id: 'patient-crown',
    text: 'Patient as Stone',
    priority: 5,
    when: (h) => crowned(h) && !crownedWithin(h, 45),
  },
  {
    id: 'stern',
    text: 'Of the Iron Seal',
    priority: 4,
    when: (h) => yearsPlayed(h) >= 10 && plansOf(h).every((plan) => plan.justice >= 3),
  },
  {
    id: 'weathered',
    text: 'Who Weathered Three Droughts',
    priority: 3,
    when: (h) =>
      ownerRecords(h).filter((r) =>
        r.events.some((e) => e.kind === 'weather' && numberOf(e, 'grade') === 1),
      ).length >= 3,
  },
  {
    id: 'many-markets',
    text: 'Friend of the Market Stalls',
    priority: 2,
    when: (h) => sum(h, 'built', 'markets') >= 8,
  },
];

export const MILESTONES: readonly AutoMilestoneDef[] = [
  // Stewardship
  {
    id: 'crowned',
    kind: 'stewardship',
    title: 'A Crown in the Valley',
    description: 'Be crowned Re or Regina.',
    points: 20,
    atRunEnd: crowned,
  },
  {
    id: 'crowned-first',
    kind: 'stewardship',
    title: 'First to the Crown',
    description: 'Be crowned before any rival.',
    points: 20,
    atRunEnd: (h) => h.outcome.verdict.id === 'crowned-first',
  },
  {
    id: 'crowned-grand-master',
    kind: 'stewardship',
    title: 'Against the Hardest Heralds',
    description: 'Be crowned at Grand Master.',
    points: 40,
    atRunEnd: (h) => crowned(h) && difficultyOf(h) === 4,
  },
  {
    id: 'third-of-the-line',
    kind: 'stewardship',
    title: 'Three Generations',
    description: 'Be crowned by the third ruler of a line, or a later one.',
    points: 30,
    atRunEnd: (h) => crownedGeneration(h) >= 3,
  },
  {
    id: 'full-cathedral',
    kind: 'stewardship',
    title: 'Campanile',
    description: 'Raise all six stages of a cathedral, foundations to bell tower.',
    points: 20,
  },
  {
    id: 'lean-army',
    kind: 'stewardship',
    title: 'A Crown Without Drums',
    description: 'Be crowned without ever arming a platoon.',
    points: 30,
    atRunEnd: (h) => crowned(h) && plansOf(h).every((plan) => plan.build.platoons === 0),
  },
  {
    id: 'unbreached',
    kind: 'stewardship',
    title: 'Unbreached',
    description: 'Be crowned without ever being invaded.',
    points: 20,
    atRunEnd: (h) => crowned(h) && count(h, 'invaded') === 0,
  },
  // Insight
  {
    id: 'deathbed',
    kind: 'insight',
    title: 'For Long Service',
    description: 'See the heralds raise a ruler on the deathbed.',
    points: 15,
  },
  {
    id: 'five-weathers',
    kind: 'insight',
    title: 'Every Sky',
    description: 'See all five kinds of year, drought to excellent (across any games).',
    points: 15,
    target: 5,
  },
  {
    id: 'every-pillar',
    kind: 'insight',
    title: 'The Twelve Pillars',
    description: 'Read how every one of the twelve pillars is earned.',
    points: 10,
    target: 12,
  },
  {
    id: 'beat-every-rival',
    kind: 'insight',
    title: 'Every Way of Ruling',
    description: 'Be crowned against each of the five rivals (across any games).',
    points: 30,
    target: 5,
  },
  {
    id: 'codex-most',
    kind: 'insight',
    title: 'Most of the Codex',
    description: 'Discover ten of the Codex’s entries.',
    points: 15,
    codexDiscovered: 10,
  },
  {
    id: 'codex-all',
    kind: 'insight',
    title: 'The Whole Codex',
    description: 'Discover every entry in the Codex.',
    points: 30,
    codexDiscovered: 'all',
  },
  // Curiosity
  {
    id: 'six-at-table',
    kind: 'curiosity',
    title: 'A Full Table',
    description: 'Begin a hot-seat game with six seats.',
    points: 10,
  },
  {
    id: 'classic-fate',
    kind: 'curiosity',
    title: 'One Candle Only',
    description: 'Finish a game under Classic fate, as in 1978.',
    points: 10,
    atRunEnd: (h) => courtFromOptions(h.setup.options)?.fate === 'classic',
  },
  {
    id: 'crowned-despite',
    kind: 'curiosity',
    title: 'The Creditors Bowed',
    description: 'Go bankrupt and be crowned anyway.',
    points: 25,
    secret: true,
    atRunEnd: (h) => crowned(h) && count(h, 'bankrupt') > 0,
  },
  {
    id: 'endless-sixty',
    kind: 'curiosity',
    title: 'Sixty Winters',
    description: 'Keep an Endless Dynasty going for sixty years.',
    points: 20,
  },
  {
    id: 'obituary-kept',
    kind: 'curiosity',
    title: 'Kept in the Archive',
    description: 'Save an obituary page as a share card.',
    points: 5,
  },
];

/** A 48 × 48 drawing in currentColor. */
const art = (body: string): string =>
  `<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</g>`;

const WEATHER_MECHANISM =
  'Two dice, of five faces and of six, are added; half of one less than the sum, rounded up, is the grade from 1 to 5. In thirty years that gives about 3 droughts, 7 poor, 10 fair, 7 good and 3 excellent. A worked hectare yields 0.72, 1.68, 2.64, 3.6 or 4.56 bushels by grade, give or take a tenth.';

export const CODEX: readonly CodexEntryDef[] = [
  {
    id: 'weather-drought',
    title: 'Drought',
    summary: 'A dry year: the fields give barely a quarter of a fair harvest.',
    tendency: 'About one year in ten. Grain grows dear and land with it.',
    mechanism: WEATHER_MECHANISM,
    hint: 'Cracked earth under a white sky.',
    art: art(
      '<path d="M8 36h32"/><path d="M14 36l3-6 4 3 3-7 5 5 3-4 4 9"/><circle cx="34" cy="13" r="5"/>',
    ),
  },
  {
    id: 'weather-poor',
    title: 'A Poor Year',
    summary: 'Thin rain and a thin harvest.',
    tendency: 'About one year in four. Two in a row empty a careless granary.',
    mechanism: WEATHER_MECHANISM,
    hint: 'Grey over the wheat.',
    art: art(
      '<path d="M12 22a8 8 0 0 1 15-4a6 6 0 1 1 3 11H13a5 5 0 0 1-1-7z"/><path d="M16 34l-2 5M24 34l-2 5M32 34l-2 5"/>',
    ),
  },
  {
    id: 'weather-fair',
    title: 'A Fair Year',
    summary: 'An ordinary harvest: enough, if the granary was kept.',
    tendency: 'The most common year, a third of all of them.',
    mechanism: WEATHER_MECHANISM,
    hint: 'Neither feast nor famine.',
    art: art(
      '<path d="M10 26a9 9 0 0 1 17-4a7 7 0 1 1 3 13H12a6 6 0 0 1-2-9z"/><path d="M33 12l2-3M38 17l3-1"/>',
    ),
  },
  {
    id: 'weather-good',
    title: 'A Good Year',
    summary: 'Sun and rain in turn, and full carts.',
    tendency: 'About one year in four. Grain grows cheap; a good moment to buy.',
    mechanism: WEATHER_MECHANISM,
    hint: 'Gold in the furrows.',
    art: art(
      '<circle cx="18" cy="18" r="6"/><path d="M18 6v3M18 27v3M6 18h3M27 18h3"/><path d="M22 34a7 7 0 0 1 13-3a5 5 0 1 1 1 9H23a4 4 0 0 1-1-6z"/>',
    ),
  },
  {
    id: 'weather-excellent',
    title: 'An Excellent Year',
    summary: 'A harvest songs are written about.',
    tendency: 'About one year in ten. The granary fills and the price of land falls.',
    mechanism: WEATHER_MECHANISM,
    hint: 'A sun with all its rays.',
    art: art(
      '<circle cx="24" cy="24" r="7"/><path d="M24 8v5M24 35v5M8 24h5M35 24h5M13 13l3 3M32 32l3 3M13 35l3-3M32 16l3-3"/>',
    ),
  },
  {
    id: 'rats',
    title: 'Rats',
    summary: 'Every year the rats take a share of what is stored.',
    tendency: 'Never nothing, sometimes half: a full granary loses the most.',
    mechanism:
      'At the start of each year rats eat 1 to 50 percent of the grain in store, every percent equally likely, before the harvest comes in.',
    hint: 'Small guests with large appetites.',
    art: art(
      '<ellipse cx="22" cy="28" rx="11" ry="7"/><circle cx="12" cy="23" r="4"/><path d="M33 29c6 0 9-4 9-9"/><path d="M16 35l-1 4M28 35l1 4"/>',
    ),
  },
  {
    id: 'migration',
    title: 'Newcomers',
    summary:
      'Generous bread draws families to the gates, and a few merchants and nobles with them.',
    tendency:
      'Only when the release is at least 130 % of what the people need; more come to a bigger city.',
    mechanism:
      'The most who may come is the surplus share × 10 × the thousands of serfs × a die of 25, plus a die of 40, never above 32,000; then a die of that size decides. Up to 50 merchants, one noble and two clergy come too, and prosperity rises by half a point.',
    hint: 'Lanterns on the valley road.',
    art: art(
      '<path d="M14 40V22l-3 6M14 22l3 6"/><circle cx="14" cy="16" r="2.5"/><path d="M28 40V22l-3 6M28 22l3 6"/><circle cx="28" cy="16" r="2.5"/><rect x="35" y="20" width="5" height="7" rx="1.5"/>',
    ),
  },
  {
    id: 'fleeing',
    title: 'Serfs in Flight',
    summary: 'Under harsh courts, serfs slip away at night.',
    tendency: 'Only at harsh or outrageous justice, and more at outrageous.',
    mechanism:
      'Harsh justice lets up to 1 % of the serfs flee each year, outrageous up to 4 %, the number drawn evenly from one to that most.',
    hint: 'Carts on the road before dawn.',
    art: art(
      '<path d="M8 34h22"/><circle cx="13" cy="36" r="3"/><circle cx="25" cy="36" r="3"/><path d="M10 34V24h16v10"/><path d="M32 30l8-4M34 36l7-1"/>',
    ),
  },
  {
    id: 'invasion',
    title: 'The Border',
    summary:
      'An army marches on a realm with too few soldiers, or one facing a far stronger rival.',
    tendency: 'Never a gamble: the border watch says in advance whether the gates will open.',
    mechanism:
      'A realm is invaded when it has fewer soldiers than its thousands of hectares, or when a rival in last year’s standings has more than 2.4 times its soldiers. The strongest rival with 1.2 soldiers per 1,000 of its own hectares marches and takes its soldiers × 1,000 less a third of its own land; if none can, mercenaries take 1,001 to 10,000 hectares. The walls keep the first 5,000.',
    hint: 'Pennants on the road.',
    art: art('<path d="M12 40V10l14 5-14 5"/><path d="M30 40V16l12 4-12 4"/><path d="M6 40h36"/>'),
  },
  {
    id: 'bankruptcy',
    title: 'The Creditors',
    summary: 'Sink too deep into debt and the creditors take nearly everything.',
    tendency: 'The deeper the title, the deeper the debt a ruler may carry.',
    mechanism:
      'Below −10,000 florins for each step of title, the creditors take every building, half the merchants and all but 6,000 hectares and 4,000 bushels, and leave 100 florins in the chest. The title stays.',
    hint: 'A ledger closed with a hammer.',
    art: art(
      '<path d="M10 12h22v26H10z"/><path d="M15 19h12M15 25h12M15 31h7"/><path d="M34 14l6 6-4 4-6-6z"/><path d="M33 23l-6 6"/>',
    ),
  },
  {
    id: 'interest',
    title: 'Interest',
    summary: 'A debt left at the year’s end grows by half.',
    tendency: 'Small debts are cheap to clear; large ones run away from the taxes.',
    mechanism:
      'At the end of the year a negative treasury is multiplied by 1.5, rounded to the florin.',
    hint: 'Coins that breed.',
    art: art(
      '<ellipse cx="18" cy="30" rx="8" ry="3"/><path d="M10 30v4c0 2 4 3 8 3s8-1 8-3v-4"/><ellipse cx="30" cy="20" rx="8" ry="3"/><path d="M22 20v4c0 2 4 3 8 3s8-1 8-3v-4"/><path d="M36 8v6M33 11h6"/>',
    ),
  },
  {
    id: 'deathbed',
    title: 'For Long Service',
    summary: 'The heralds sometimes raise a ruler whose points have not earned it.',
    tendency: 'It comes late in a reign, and only once.',
    mechanism:
      'Two years before a ruler’s last year, the review grants one title step whatever the points say. The 1978 program did the same; the step is the one sign the end is near.',
    hint: 'A promotion that is also a farewell.',
    revealAfter: 1,
    art: art(
      '<path d="M14 40V20h20v20"/><path d="M24 20v-8"/><path d="M24 8c-2 2-2 4 0 6c2-2 2-4 0-6z"/><path d="M10 40h28"/>',
    ),
  },
  {
    id: 'title-formula',
    title: 'The Title Review',
    summary: 'Twelve pillars of the realm decide its ruler’s title.',
    tendency: 'Every pillar counts up to ten; justice takes away; titles never fall.',
    mechanism:
      'Each pillar gives a point for so much of it (a marketplace, 5,000 florins, 6,000 hectares, 50 merchants, 5 nobles…), at most ten. The title earned is the points ÷ (difficulty + 5), less the justice level, plus one, rounded down.',
    hint: 'A scroll and twelve columns.',
    art: art(
      '<path d="M10 14h28M10 38h28"/><path d="M13 14v24M18 14v24M23 14v24M28 14v24M33 14v24"/><path d="M24 6l3 5h-6z"/>',
    ),
  },
  {
    id: 'justice-penalty',
    title: 'The Price of Justice',
    summary: 'Harsh courts fill the treasury and slow the heralds.',
    tendency: 'Each level of justice above very fair costs a whole title’s worth of points.',
    mechanism:
      'The justice level (1 very fair to 4 outrageous) is taken from the title earned. Courts also earn (300 × level − 500) × title florins a year: very fair costs money, harsh brings it in.',
    hint: 'A scale that does not balance.',
    art: art(
      '<path d="M24 8v32M14 40h20"/><path d="M10 16h28"/><path d="M10 16l-5 10h10zM38 16l-5 14h10z"/>',
    ),
  },
  {
    id: 'lost-difficulty',
    title: 'The Difficulty That Never Was',
    summary: 'The 1978 conversion asked how hard the game should be, then forgot the answer.',
    tendency: 'A story from the game’s history: every old game ran at the easiest level.',
    mechanism:
      'The conversion stored the chosen level in one variable and divided the title points by another, which stayed at the first level. Here the four levels divide the points by 6, 7, 8 and 9, and sharpen the rivals as well.',
    hint: 'A question asked, an answer lost.',
    revealAfter: 1,
    art: art(
      '<path d="M14 14a10 10 0 1 1 13 9c-2 1-3 3-3 5v3"/><circle cx="24" cy="38" r="1.5"/><path d="M34 32l6 6M40 32l-6 6"/>',
    ),
  },
];
