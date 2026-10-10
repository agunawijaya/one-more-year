/**
 * About (#/about): the story of these programs and of this project, the
 * originals beside their new titles, and the credits. Every fact here comes
 * from the sources listed in CREDITS.md and is written in our own words.
 */
import { button, emblem, h } from '../app/dom.ts';
import { icon } from '../chrome/icons.ts';
import { pageFrame, type PageContext } from './page.ts';

const SOURCES = [
  {
    label: 'Hamurabi (video game), Wikipedia',
    href: 'https://en.wikipedia.org/wiki/Hamurabi_(video_game)',
  },
  {
    label: 'Santa Paravia en Fiumaccio, Wikipedia',
    href: 'https://en.wikipedia.org/wiki/Santa_Paravia_en_Fiumaccio',
  },
  {
    label: 'The Sumerian Game, Wikipedia',
    href: 'https://en.wikipedia.org/wiki/The_Sumerian_Game',
  },
];

/** The dates of the story, set in the page margin like an almanac's chronology. */
const DATES: readonly [string, string][] = [
  ['1964–66', 'The Sumerian Game, by Mabel Addis and William McKay'],
  ['1968', 'The Sumer Game, by Doug Dyment, in FOCAL on a PDP-8'],
  ['c. 1971', 'Hamurabi, David H. Ahl’s BASIC version'],
  ['1973', '101 BASIC Computer Games'],
  ['1978', 'BASIC Computer Games; Santa Paravia and Fiumaccio in SoftSide'],
  ['1979', 'The Instant Software copyright line on the PC conversion'],
];

function timeline(): HTMLElement {
  return h(
    'aside',
    { class: 'about__timeline', 'aria-label': 'Chronology' },
    h('h2', { class: 'about__timeline-title' }, 'Chronology'),
    h(
      'ol',
      {},
      DATES.map(([year, event]) =>
        h('li', {}, h('span', { class: 'about__year tabular' }, year), h('span', {}, event)),
      ),
    ),
  );
}

export function renderAbout(ctx: PageContext): HTMLElement {
  const worlds = ctx.snapshot.entries.filter(
    (entry) =>
      entry.manifest.inspiredBy.originalTitle !== '' &&
      !entry.manifest.inspiredBy.originalTitle.includes('fixture'),
  );

  return pageFrame(
    'About',
    'Small worlds, one year at a time',
    'Long before strategy games had maps and music, people ran whole cities on a teletype: read the report, type a few numbers, press return, and see what the year brought.',
    timeline(),
    h(
      'section',
      { class: 'about__story' },
      h('h2', {}, 'Where these games come from'),
      h(
        'p',
        {},
        'In 1968 Doug Dyment, working at Digital Equipment Corporation, wrote The Sumer Game in the FOCAL language for a PDP-8. Some players knew it as King of Sumeria. ',
        'It owed its idea to The Sumerian Game, an educational economic simulation that the teacher Mabel Addis and the IBM programmer William McKay built between 1964 and 1966.',
      ),
      h(
        'p',
        {},
        'Around 1971 David H. Ahl brought Dyment’s game to BASIC, renamed it Hamurabi and gave it an appraisal of the ruler at the end of the term. ',
        'It was printed in 101 BASIC Computer Games in 1973 and again in BASIC Computer Games in 1978, the first computer book to sell a million copies. ',
        'The name has one m for a reason: Dyment trimmed words so the program would fit a machine with 4K of memory, and Ahl kept the spelling. The ruler is meant to be the Babylonian king Hammurabi, even though the game talks about Sumeria.',
      ),
      h(
        'p',
        {},
        'George Blank’s Santa Paravia and Fiumaccio first appeared in the December 1978 issue of SoftSide magazine and was sold on cassette by Instant Software for the TRS-80, Apple II, TI-99/4A and Commodore PET. ',
        'Each player rules a young Italian city-state around the year 1400 and climbs through noble titles toward a crown. It added building a city to the grain-and-land formula. ',
        'The version we studied is a later IBM PC BASIC conversion that carries a 1979 Instant Software copyright line.',
      ),
      h(
        'p',
        {},
        'Both are counted among the ancestors of today’s strategy, simulation and city-building games.',
      ),
    ),
    h(
      'section',
      { class: 'about__project' },
      h('h2', {}, 'What this project is'),
      h(
        'p',
        {},
        'One More Year rebuilds these turn-based worlds for today: the same small, honest models, written from scratch, with their numbers drawn as charts, their chances shown as forecasts, and every run kept as a chronicle you can read and replay. ',
        'There is no arcade here, no timer on any decision, nothing to buy and nothing to lose by stepping away. Not an emulator and not a port: new code, new words, the old idea.',
      ),
    ),
    h(
      'section',
      { class: 'about__originals' },
      h('h2', {}, 'The originals and their new titles'),
      h(
        'ul',
        { class: 'about__worlds' },
        worlds.map((entry) =>
          h(
            'li',
            { style: `--sim-accent:${entry.manifest.accent[ctx.appearance]}` },
            h('span', { class: 'about__emblem' }, emblem(entry.manifest.emblem)),
            h(
              'span',
              {},
              h('strong', {}, entry.manifest.title),
              entry.manifest.status === 'coming-soon'
                ? h('span', { class: 'about__status' }, ' (in preparation)')
                : null,
              h('br', {}),
              `after ${entry.manifest.inspiredBy.originalTitle} (${entry.manifest.inspiredBy.year}) by ${entry.manifest.inspiredBy.credit}`,
            ),
          ),
        ),
      ),
    ),
    h(
      'section',
      { class: 'about__credits' },
      h('h2', {}, 'Credits and sources'),
      h(
        'p',
        {},
        'The original programs belong to their authors and publishers; nothing of their text or code is reused here. Our code is MIT-licensed. The typefaces are EB Garamond, Geist, Fraunces and Nunito, all under the SIL Open Font License.',
      ),
      h(
        'ul',
        {},
        SOURCES.map((source) =>
          h(
            'li',
            {},
            h(
              'a',
              { href: source.href, target: '_blank', rel: 'noopener' },
              source.label,
              icon('external', 14),
            ),
          ),
        ),
      ),
    ),
    h(
      'p',
      { class: 'about__actions' },
      button([icon('replay', 18), h('span', {}, 'Replay the intro')], () => ctx.replayIntro(), {
        class: 'button',
        'data-action': 'replay-intro',
      }),
    ),
  );
}
