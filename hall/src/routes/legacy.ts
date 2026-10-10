/**
 * Legacy (#/legacy): your rank and points, the next rank's cosmetic, the
 * cosmetics you have earned for each theme, every milestone across the
 * collection, play statistics, and the Almanac streak as a little almanac
 * of days (pressed flowers for forgiven days).
 */
import { RANKS, addDays, formatDate, formatDuration, type MilestoneView } from '@one-more-year/kit';
import { button, h } from '../app/dom.ts';
import { COSMETICS, cosmeticsFor, rankTitle } from '../data/cosmetics.ts';
import { THEME_IDS, THEME_NAMES } from '../themes/theme-ids.ts';
import { icon } from '../chrome/icons.ts';
import { pageFrame, type PageContext } from './page.ts';

const KIND_NAMES = {
  stewardship: 'Stewardship',
  insight: 'Insight',
  curiosity: 'Curiosity',
} as const;

export function renderLegacy(ctx: PageContext): HTMLElement {
  const { snapshot } = ctx;
  const playable = snapshot.entries.filter((entry) => entry.playable);
  const missing = playable.filter((entry) => !entry.module);
  if (missing.length > 0) {
    void Promise.all(missing.map((entry) => ctx.model.loadModule(entry.manifest.id))).then(() =>
      ctx.rerender(),
    );
  }
  const { standing } = snapshot.legacy;
  const nextCosmetic = standing.next
    ? COSMETICS.find((c) => c.rank === standing.next?.id && c.theme === ctx.theme)
    : null;

  const rank = h(
    'section',
    { class: 'legacy__rank', 'aria-labelledby': 'legacy-rank' },
    h('p', { class: 'legacy__rank-label' }, 'Your rank'),
    h('h2', { id: 'legacy-rank', class: 'legacy__rank-title' }, standing.rank.title),
    h('p', { class: 'legacy__motto' }, standing.rank.motto),
    h('p', { class: 'legacy__points tabular' }, `${standing.points} Legacy points`),
    h('div', {
      class: 'meter meter--large',
      role: 'progressbar',
      'aria-label': standing.next ? `Progress to ${standing.next.title}` : 'Highest rank reached',
      'aria-valuemin': 0,
      'aria-valuemax': 100,
      'aria-valuenow': Math.round(standing.progress * 100),
      style: `--fill:${standing.progress}`,
    }),
    standing.next
      ? h(
          'p',
          { class: 'legacy__next' },
          `${standing.toNext} points to ${standing.next.title}`,
          nextCosmetic
            ? `, which brings ${nextCosmetic.name.toLowerCase()} to the ${THEME_NAMES[ctx.theme]}.`
            : '.',
        )
      : h('p', { class: 'legacy__next' }, 'The top of the ladder. Every cosmetic is yours.'),
    h(
      'ol',
      { class: 'legacy__ladder' },
      RANKS.map((item, index) =>
        h(
          'li',
          {
            class: index <= standing.index ? 'legacy__step legacy__step--reached' : 'legacy__step',
          },
          h('span', { class: 'legacy__step-title' }, item.title),
          h('span', { class: 'legacy__step-points tabular' }, item.threshold),
        ),
      ),
    ),
  );

  const unlockedIds = new Set(snapshot.legacy.unlocked.map((cosmetic) => cosmetic.id));
  const cosmetics = h(
    'section',
    { class: 'legacy__cosmetics', 'aria-labelledby': 'legacy-cosmetics' },
    h('h2', { id: 'legacy-cosmetics' }, 'Cosmetics'),
    h(
      'p',
      { class: 'page__note' },
      'One for each rank in each theme. They change how the Hall looks, never how a world plays.',
    ),
    THEME_IDS.map((theme) => {
      const active = snapshot.legacy.active(theme);
      return h(
        'div',
        { class: 'legacy__theme' },
        h('h3', {}, THEME_NAMES[theme]),
        h(
          'ul',
          { class: 'legacy__cosmetic-list' },
          cosmeticsFor(theme).map((cosmetic) => {
            const unlocked = unlockedIds.has(cosmetic.id);
            const swatch = h('span', {
              class: 'swatch',
              'aria-hidden': 'true',
              style: `--swatch-a:${swatchColours(cosmetic.tokens[ctx.appearance])[0]};--swatch-b:${swatchColours(cosmetic.tokens[ctx.appearance])[1]}`,
              'data-kind': theme,
            });
            return h(
              'li',
              {},
              unlocked
                ? button(
                    [
                      swatch,
                      h('span', {}, cosmetic.name),
                      active.id === cosmetic.id ? icon('check', 16) : null,
                    ],
                    () => {
                      ctx.services.cosmetics.choose(theme, cosmetic.id);
                      ctx.model.refresh();
                    },
                    {
                      class: 'cosmetic',
                      'aria-pressed': String(active.id === cosmetic.id),
                      'data-cosmetic': cosmetic.id,
                    },
                  )
                : h(
                    'span',
                    { class: 'cosmetic cosmetic--locked' },
                    swatch,
                    h('span', {}, cosmetic.name),
                    h('span', { class: 'cosmetic__rank' }, rankTitle(cosmetic.rank)),
                  ),
            );
          }),
        ),
      );
    }),
  );

  const milestones = h(
    'section',
    { class: 'legacy__milestones', 'aria-labelledby': 'legacy-milestones' },
    h('h2', { id: 'legacy-milestones' }, 'Milestones'),
    playable.length === 0 ? h('p', {}, 'Milestones arrive with the first playable world.') : null,
    playable
      .filter((entry) => entry.module)
      .map((entry) => {
        const views = ctx.services.milestones
          .forSim(entry.manifest.id, entry.module?.milestones ?? [])
          .list();
        return h(
          'div',
          { class: 'legacy__world' },
          h(
            'h3',
            {},
            entry.manifest.title,
            h(
              'span',
              { class: 'legacy__count tabular' },
              ` ${views.filter((v) => v.unlockedAt).length} of ${views.length}`,
            ),
          ),
          h(
            'ul',
            { class: 'milestones' },
            views.map((view) => h('li', {}, milestoneItem(view))),
          ),
        );
      }),
  );

  const stats = h(
    'section',
    { class: 'legacy__stats', 'aria-labelledby': 'legacy-stats' },
    h('h2', { id: 'legacy-stats' }, 'Statistics'),
    h(
      'table',
      { class: 'stats-table' },
      h(
        'thead',
        {},
        h(
          'tr',
          {},
          [
            'World',
            'Runs begun',
            'Finished',
            'Turns',
            'Time played',
            'Best verdict',
            'Last played',
          ].map((label) => h('th', { scope: 'col' }, label)),
        ),
      ),
      h(
        'tbody',
        {},
        playable.map((entry) =>
          h(
            'tr',
            {},
            h('th', { scope: 'row' }, entry.manifest.title),
            h('td', { class: 'tabular' }, entry.stats.runsBegun),
            h('td', { class: 'tabular' }, entry.stats.runsFinished),
            h('td', { class: 'tabular' }, entry.stats.turnsPlayed),
            h('td', { class: 'tabular' }, formatDuration(entry.stats.msPlayed)),
            h('td', {}, entry.stats.bestVerdict?.label ?? '—'),
            h('td', {}, entry.stats.lastPlayed ? formatDate(entry.stats.lastPlayed) : '—'),
          ),
        ),
      ),
    ),
  );

  return pageFrame(
    'Legacy',
    'What you have built',
    'Points come from milestones alone; ranks bring cosmetics; nothing is bought and nothing expires.',
    h('div', { class: 'legacy__top' }, rank, streakAlmanac(ctx)),
    cosmetics,
    milestones,
    stats,
  );
}

function milestoneItem(view: MilestoneView): HTMLElement {
  const { def } = view;
  const unlocked = view.unlockedAt !== null;
  if (def.secret && !unlocked) {
    return h(
      'div',
      { class: 'milestone milestone--secret' },
      h('p', { class: 'milestone__title' }, 'A secret milestone'),
      h('p', {}, 'Play on to find it.'),
    );
  }
  return h(
    'div',
    {
      class: `milestone ${unlocked ? 'milestone--unlocked' : ''}`.trim(),
      'data-milestone': def.id,
    },
    h('p', { class: 'milestone__kind' }, KIND_NAMES[def.kind]),
    h('p', { class: 'milestone__title' }, def.title),
    h('p', {}, def.description),
    h(
      'p',
      { class: 'milestone__meta tabular' },
      `${def.points} points`,
      unlocked && view.unlockedAt ? ` · ${formatDate(view.unlockedAt)}` : '',
      !unlocked && def.target ? ` · ${view.progress} of ${def.target}` : '',
    ),
  );
}

/**
 * The streak as a little almanac of days: whole weeks, Monday first, from
 * the start of the current volume (at most the last five weeks) to today.
 * Days played carry a leaf-mark, forgiven days a pressed flower.
 */
function streakAlmanac(ctx: PageContext): HTMLElement {
  const { streak, today } = ctx.snapshot;
  const marks = new Map(streak.days.map((day) => [day.day, day.mark]));
  const first = streak.days[0]?.day ?? today;
  const earliest = addDays(today, -34);
  const from = mondayOf(first > earliest ? first : earliest);
  const to = addDays(mondayOf(today), 6);
  const cells: HTMLElement[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const mark = marks.get(day) ?? (day > today ? 'future' : 'empty');
    const label = `${formatDate(day)}${mark === 'played' ? ': played' : mark === 'grace' ? ': forgiven' : ''}`;
    cells.push(
      h(
        'li',
        { class: `almanac-day almanac-day--${mark}`, title: label, 'aria-label': label },
        mark === 'grace'
          ? icon('flower', 16)
          : h('span', { class: 'tabular' }, Number(day.slice(8))),
      ),
    );
  }
  return h(
    'section',
    { class: 'legacy__streak', 'aria-labelledby': 'legacy-streak' },
    h('p', { class: 'legacy__rank-label' }, `The Almanac · volume ${streak.volume}`),
    h(
      'h2',
      { id: 'legacy-streak', class: 'legacy__streak-count' },
      streak.current === 0
        ? 'A fresh volume'
        : `${streak.current} ${streak.current === 1 ? 'year' : 'years'} running`,
    ),
    h(
      'p',
      { class: 'page__note' },
      streak.current === 0
        ? 'Play any daily scenario to write its first page.'
        : `Since ${formatDate(first)}. One missed day in seven is forgiven on its own.`,
    ),
    h(
      'div',
      { class: 'almanac-days__head', 'aria-hidden': 'true' },
      ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((letter) => h('span', {}, letter)),
    ),
    h('ol', { class: 'almanac-days' }, cells),
    h(
      'p',
      { class: 'legacy__best tabular' },
      `Longest volume: ${streak.best} ${streak.best === 1 ? 'day' : 'days'} · next page: ${formatDate(addDays(today, streak.playedToday ? 1 : 0))}`,
    ),
  );
}

/** The Monday on or before a UTC day. */
function mondayOf(day: string): string {
  const weekday = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
  return addDays(day, -weekday);
}

/** Two colours that stand for a cosmetic, whatever kind of tokens it carries. */
function swatchColours(tokens: Readonly<Record<string, string>>): [string, string] {
  const colours = Object.values(tokens).filter((value) => value.startsWith('#'));
  const first = colours[0] ?? '#888888';
  return [first, colours[1] ?? first];
}
