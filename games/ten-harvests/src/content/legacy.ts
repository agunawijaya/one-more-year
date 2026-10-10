/**
 * Ten Harvests in the collection's Legacy: the epithets a finished run can
 * earn, the milestones (stewardship, insight, curiosity) and the Codex of
 * phenomena the model can produce, each revealing its exact rule after
 * three sightings.
 */
import {
  numberOf,
  type AutoMilestoneDef,
  type CodexEntryDef,
  type EpithetRule,
  type RunHistory,
} from '@one-more-year/kit';

const total = (history: RunHistory, kind: string, field: string): number =>
  history.records.reduce(
    (sum, record) =>
      sum +
      record.events.filter((e) => e.kind === kind).reduce((s, e) => s + numberOf(e, field), 0),
    0,
  );

const harvests = (history: RunHistory): number[] =>
  history.records.flatMap((record) =>
    record.events
      .filter((e) => e.kind === 'harvest' && numberOf(e, 'acres') > 0)
      .map((e) => numberOf(e, 'yield')),
  );

const ended = (history: RunHistory, ...kinds: string[]): boolean =>
  kinds.includes(history.outcome.ending);
const completed = (history: RunHistory): boolean =>
  ended(history, 'term-complete', 'dynasty-complete');

/** Highest priority first when several hold. */
export const EPITHETS: readonly EpithetRule[] = [
  {
    id: 'kept-bees',
    text: 'Whose Steward Kept Bees',
    priority: 20,
    when: (h) => ended(h, 'walked-out'),
  },
  {
    id: 'council-at-dawn',
    text: 'Remembered Kindly, if Briefly',
    priority: 19,
    when: (h) => ended(h, 'deposed'),
  },
  {
    id: 'three-fevers',
    text: 'Who Outlasted Three Fevers',
    priority: 9,
    when: (h) => completed(h) && h.count('fever') >= 3,
  },
  {
    id: 'generous-beyond-ledger',
    text: 'Generous Beyond the Ledger',
    priority: 8,
    when: (h) => h.count('generous-year') >= 3,
  },
  {
    id: 'doubled-fields',
    text: 'Who Doubled the Fields',
    priority: 8,
    when: (h) => h.final('acres') >= 2 * h.first('acres'),
  },
  {
    id: 'never-empty',
    text: 'Whose Bowls Were Never Empty',
    priority: 7,
    when: (h) => completed(h) && h.count('hunger') === 0,
  },
  {
    id: 'lean-years',
    text: 'Steady Through the Lean Years',
    priority: 6,
    when: (h) => completed(h) && harvests(h).filter((y) => y <= 2).length >= 3,
  },
  {
    id: 'hundred-newcomers',
    text: 'Host to a Hundred Newcomers',
    priority: 5,
    when: (h) => total(h, 'newcomers', 'people') >= 100,
  },
  {
    id: 'golden-summers',
    text: 'Ruler of Golden Summers',
    priority: 5,
    when: (h) => harvests(h).filter((y) => y >= 5).length >= 3,
  },
  {
    id: 'full-granaries',
    text: 'Keeper of Full Granaries',
    priority: 4,
    when: (h) => completed(h) && h.final('grain') >= 2 * h.first('grain'),
  },
  {
    id: 'rats-passed-by',
    text: 'Whom the Rats Passed By',
    priority: 3,
    when: (h) => completed(h) && total(h, 'rats', 'eaten') === 0,
  },
  {
    id: 'fields-for-bread',
    text: 'Who Traded Fields for Bread',
    priority: 3,
    when: (h) => total(h, 'land-sold', 'acres') >= 300,
  },
  {
    id: 'content-with-given',
    text: 'Content With the Land Given',
    priority: 2,
    when: (h) => completed(h) && h.count('land-bought') === 0 && h.count('land-sold') === 0,
  },
];

const topTier = (h: RunHistory): boolean => completed(h) && h.outcome.verdict.tier >= 4;

export const MILESTONES: readonly AutoMilestoneDef[] = [
  // Stewardship
  {
    id: 'first-term',
    kind: 'stewardship',
    title: 'A Full Term',
    description: 'See a term through to its tenth harvest.',
    points: 10,
    atRunEnd: completed,
  },
  {
    id: 'worth-carving',
    kind: 'stewardship',
    title: 'Worth Carving',
    description: 'End a term in the top tier: little hunger and ten acres a head.',
    points: 20,
    atRunEnd: topTier,
  },
  {
    id: 'ten-quiet-years',
    kind: 'stewardship',
    title: 'Ten Quiet Years',
    description: 'Finish a term in which nobody went hungry, with land to spare.',
    points: 30,
    atRunEnd: (h) => h.outcome.verdict.id === 'ten-quiet-years',
  },
  {
    id: 'dry-decade-top',
    kind: 'stewardship',
    title: 'Rain Was Not Required',
    description: 'Reach the top tier on Dry Decade.',
    points: 30,
    atRunEnd: (h) => h.setup.scenario === 'dry-decade' && topTier(h),
  },
  {
    id: 'crowded-fed',
    kind: 'stewardship',
    title: 'Room at the Table',
    description: 'Finish Crowded Gate without anyone going hungry.',
    points: 25,
    atRunEnd: (h) => h.setup.scenario === 'crowded-gate' && completed(h) && h.count('hunger') === 0,
  },
  {
    id: 'dynasty',
    kind: 'stewardship',
    title: 'A Line of Rulers',
    description: 'See a Dynasty through all three terms.',
    points: 35,
    atRunEnd: (h) => ended(h, 'dynasty-complete'),
  },
  {
    id: 'never-sold',
    kind: 'stewardship',
    title: 'Not One Acre Sold',
    description: 'Reach the top tier without ever selling land.',
    points: 20,
    atRunEnd: (h) => topTier(h) && h.count('land-sold') === 0,
  },
  // Insight
  {
    id: 'five-harvests',
    kind: 'insight',
    title: 'All Five Harvests',
    description: 'See every yield from one to five bushels an acre (across any runs).',
    points: 15,
    target: 5,
  },
  {
    id: 'rats-fever-newcomers',
    kind: 'insight',
    title: 'A Full Year’s Weather',
    description: 'Meet rats, fever and newcomers within a single term.',
    points: 15,
    atRunEnd: (h) =>
      h.count('rats') > 0 && h.count('fever') > 0 && total(h, 'newcomers', 'people') > 0,
  },
  {
    id: 'no-idle-bushel',
    kind: 'insight',
    title: 'Every Bushel Spoken For',
    description:
      'Decree a year that leaves the store empty: all of it eaten, sown or traded, and nobody hungry.',
    points: 10,
  },
  {
    id: 'codex-most',
    kind: 'insight',
    title: 'Most of the Codex',
    description: 'Discover seven of the Codex’s ten entries.',
    points: 15,
    codexDiscovered: 7,
  },
  {
    id: 'codex-all',
    kind: 'insight',
    title: 'The Whole Codex',
    description: 'Discover every entry in the Codex.',
    points: 30,
    codexDiscovered: 'all',
  },
  {
    id: 'averaging-bug',
    kind: 'insight',
    title: 'The Generosity Paradox',
    description: 'In the 1978 Ledger, finish a term after a year the old average quietly skipped.',
    points: 30,
    secret: true,
    atRunEnd: (h) =>
      h.setup.scenario === 'ledger-1978' && completed(h) && h.count('generous-year') > 0,
  },
  // Curiosity
  {
    id: 'ledger-term',
    kind: 'curiosity',
    title: 'By Teletype',
    description: 'Finish a term in the 1978 Ledger.',
    points: 15,
    atRunEnd: (h) => h.setup.scenario === 'ledger-1978' && completed(h),
  },
  {
    id: 'scribes-console',
    kind: 'curiosity',
    title: 'The Old Way',
    description: 'Decree a whole year through the scribe’s console.',
    points: 10,
  },
  {
    id: 'walked-out',
    kind: 'curiosity',
    title: 'Bees, Mostly',
    description: 'Give the steward a number less than nothing.',
    points: 10,
    secret: true,
    atRunEnd: (h) => ended(h, 'walked-out'),
  },
  {
    id: 'land-fever-trader',
    kind: 'curiosity',
    title: 'Buy Low, Sell High',
    description:
      'In Land Fever, buy land at 15 or less and sell some at 35 or more in the same term.',
    points: 25,
    atRunEnd: (h) =>
      h.setup.scenario === 'land-fever' &&
      h.records.some((r) =>
        r.events.some((e) => e.kind === 'land-bought' && numberOf(e, 'price') <= 15),
      ) &&
      h.records.some((r) =>
        r.events.some((e) => e.kind === 'land-sold' && numberOf(e, 'price') >= 35),
      ),
  },
];

/** A 48 × 48 drawing in currentColor. */
const art = (body: string): string =>
  `<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</g>`;

export const CODEX: readonly CodexEntryDef[] = [
  {
    id: 'harvests',
    title: 'The Five Harvests',
    summary: 'Every planted acre gives between one and five bushels, and the year decides which.',
    tendency: 'Each of the five is equally likely, every year, whatever happened the year before.',
    mechanism:
      'Yield is a whole number from 1 to 5 drawn evenly; the harvest is acres sown × yield. Dry Decade draws 1–3, Generous Delta 3–6.',
    hint: 'What the fields give back.',
    art: art(
      '<path d="M24 42V14"/><path d="M24 14c-3-2-3-7 0-10c3 3 3 8 0 10z"/><path d="M24 22c-4 0-6-3-7-6c4 0 6 2 7 6zM24 22c4 0 6-3 7-6c-4 0-6 2-7 6z"/><path d="M24 30c-4 0-6-3-7-6c4 0 6 2 7 6zM24 30c4 0 6-3 7-6c-4 0-6 2-7 6z"/>',
    ),
  },
  {
    id: 'rats',
    title: 'Rats',
    summary: 'Some years rats get into the granary and eat part of what is stored.',
    tendency:
      'Two years in five. They eat from the store as it stands before the harvest comes in.',
    mechanism:
      'A five-sided die: on a 2 they eat half the grain left after food and seed, on a 4 a quarter (rounded down). Year of Rats adds the 3: a third.',
    hint: 'Small guests with large appetites.',
    art: art(
      '<ellipse cx="22" cy="28" rx="11" ry="7"/><circle cx="12" cy="24" r="4"/><circle cx="11" cy="19" r="2"/><path d="M33 29c6 0 9-4 9-8"/><path d="M16 35l-1 4M28 35l1 4"/>',
    ),
  },
  {
    id: 'fever',
    title: 'The Fever',
    summary: 'A fever can pass through the city and take half of everyone in it.',
    tendency:
      'One year in five, after the newcomers have arrived. Nothing a ruler does changes the odds.',
    mechanism:
      'A one-in-five chance each year (one in three in Generous Delta) halves the people, rounded down. The 1968 program said fifteen in a hundred; its arithmetic gives twenty.',
    hint: 'A haze in the lanes.',
    art: art(
      '<path d="M24 24m-3 0a3 3 0 1 0 6 0a6 6 0 1 0 -12 0a9 9 0 1 0 18 0a12 12 0 1 0 -24 0"/>',
    ),
  },
  {
    id: 'newcomers',
    title: 'Newcomers',
    summary: 'Families walk in from the countryside when the city looks prosperous.',
    tendency:
      'More come when land is wide and the store is full, and fewer when the city is crowded.',
    mechanism:
      'A five-sided die × (20 × acres + grain in store) ÷ people ÷ 100, plus one, rounded down. Counted on the store after the harvest and the rats.',
    hint: 'Lanterns on the river road.',
    art: art(
      '<path d="M14 40V22l-3 6M14 22l3 6M14 18a2 2 0 1 0 0-4a2 2 0 1 0 0 4z"/><path d="M30 40V22l-3 6M30 22l3 6M30 18a2 2 0 1 0 0-4a2 2 0 1 0 0 4z"/><rect x="36" y="20" width="5" height="7" rx="1.5"/><path d="M38.5 20v-3"/>',
    ),
  },
  {
    id: 'land-market',
    title: 'The Land Market',
    summary: 'Land changes hands at a price that moves every year.',
    tendency: 'Each year the price is set afresh, so a cheap year says nothing about the next.',
    mechanism:
      'A whole number from 17 to 26 bushels an acre, drawn evenly (Land Fever: 10 to 40). You may buy or sell in a year, not both, and must keep at least one acre.',
    hint: 'Acres for bushels, bushels for acres.',
    art: art('<path d="M8 36h32M12 36V24h10v12M26 36V18h10v18"/><path d="M14 14l6-6 6 6"/>'),
  },
  {
    id: 'seed-rule',
    title: 'Seed',
    summary: 'Sowing an acre takes half a bushel of seed from the store.',
    tendency:
      'Seed is cheap for what it returns: one bushel sows two acres that give back two to ten.',
    mechanism:
      'Seed is half the acres sown, rounded down, so an odd last acre is sown for free. It leaves the store with the food, before the rats come.',
    hint: 'What you hold back to have more.',
    art: art(
      '<path d="M10 38c8-2 20-2 28 0"/><circle cx="16" cy="28" r="1.5"/><circle cx="24" cy="25" r="1.5"/><circle cx="32" cy="28" r="1.5"/><path d="M24 25V12c-4 0-6 3-6 6M24 12c4 0 6 3 6 6"/>',
    ),
  },
  {
    id: 'worker-rule',
    title: 'Hands for the Fields',
    summary: 'Every acre sown needs someone to tend it.',
    tendency: 'A small city cannot sow a large holding, however much seed it has.',
    mechanism:
      'People can tend strictly fewer than ten acres each: 100 people may sow at most 999 acres.',
    hint: 'Land without hands lies fallow.',
    art: art(
      '<path d="M16 40V24l-4 6M16 24l5 5M16 20a2.5 2.5 0 1 0 0-5a2.5 2.5 0 1 0 0 5z"/><path d="M22 40l18-10M26 38l2-6M32 35l2-6M38 32l2-6"/>',
    ),
  },
  {
    id: 'hunger',
    title: 'Hunger',
    summary: 'Each person needs twenty bushels a year; those without leave the city.',
    tendency: 'The term is judged on how many went hungry, year after year.',
    mechanism:
      'People fed = food ÷ 20, rounded down. The hungry leave the count before the newcomers arrive, and the term averages each year’s hungry share.',
    hint: 'An empty bowl is remembered.',
    art: art(
      '<path d="M10 24h28c0 8-6 14-14 14s-14-6-14-14z"/><path d="M18 18c0-3 2-3 2-6M28 18c0-3 2-3 2-6"/>',
    ),
  },
  {
    id: 'deposition',
    title: 'The Council at Dawn',
    summary: 'If too many go hungry in one year, the ruler’s term ends at once.',
    tendency: 'Only a single disastrous year matters, not a long run of small ones.',
    mechanism:
      'More than 45 in every 100 people hungry in one year ends the term immediately; exactly 45 does not.',
    hint: 'Sandals by the gate.',
    art: art('<path d="M14 40V18a10 10 0 0 1 20 0v22"/><path d="M10 40h28"/><path d="M20 30h8"/>'),
  },
  {
    id: 'generosity-paradox',
    title: 'The Generosity Paradox',
    summary:
      'In the 1978 Ledger, a year in which you fed more people than you had vanishes from the record.',
    tendency:
      'Only in the 1978 Ledger. Feeding exactly enough counts as a perfect year; one ration more does not count at all.',
    mechanism:
      'The old program keeps a running average that assumes every earlier year was counted, but skips the update in a generous year. The skipped year silently takes the average as it stood, so earlier bad years count again.',
    hint: 'Kindness, misfiled.',
    revealAfter: 1,
    art: art(
      '<path d="M10 14h28v24H10z"/><path d="M16 22h16M16 28h10"/><path d="M30 26l6 6M36 26l-6 6"/>',
    ),
  },
];
