/**
 * Almanac (the default theme): the book of years.
 *
 * The Hall is a large almanac lying open on a desk. The left page is the
 * index: each world a chapter with an engraved emblem plate, its title in
 * a bookish serif, its domain and turn as a small rubric, and a coloured
 * ribbon tab on the book's edge. The right page shows the focused world:
 * its living demo framed as an engraved plate, the teaser with a drop
 * capital, its signals as tiny marginal charts, your finest epithet and
 * the ways in. Today's page (the daily scenarios) is a dated leaf with a
 * folded corner; the streak runs along the page foot as year-marks, with
 * pressed flowers for forgiven days. Choosing another world turns the page.
 *
 * Light is a morning study (vellum, sepia ink, vermilion rubrics, gilt
 * edges, window light); dark is lamplight (ink-blue paper, ivory text,
 * gold-leaf rubrics, a warm pool of light, the desk in shadow).
 */
import {
  formatDate,
  formatDelta,
  formatStyled,
  sparkline,
  type Appearance,
  type ChartTokens,
  type DemoPalette,
} from '@one-more-year/kit';
import { button, emblem, h, svgFrom } from '../../app/dom.ts';
import type { DemoSlot } from '../../app/demos.ts';
import { renderDetail, type DetailView } from '../../chrome/detail.ts';
import { icon } from '../../chrome/icons.ts';
import { DOMAIN_NAMES } from '../../data/filters.ts';
import type { HallEntry, HallSnapshot } from '../../data/hall-model.ts';
import { chartTokensFor } from '../colors.ts';
import { createLiveSeries, lastChange } from '../live-signals.ts';
import type { Theme, ThemeContext, ThemeView } from '../theme.ts';
import { PALETTES } from '../tokens.ts';
import './almanac.css';

const ROMAN = [
  'I',
  'II',
  'III',
  'IV',
  'V',
  'VI',
  'VII',
  'VIII',
  'IX',
  'X',
  'XI',
  'XII',
  'XIII',
  'XIV',
  'XV',
  'XVI',
  'XVII',
  'XVIII',
  'XIX',
  'XX',
  'XXI',
  'XXII',
  'XXIII',
  'XXIV',
];

function numeral(index: number): string {
  return ROMAN[index] ?? String(index + 1);
}

function demoPalette(appearance: Appearance): DemoPalette {
  const p = PALETTES.almanac[appearance];
  return {
    paper: p.surface,
    ink: p.ink,
    muted: p.inkSoft,
    accent: p.accent,
    line: p.ink,
    glow: p.extra['gilt-soft'] ?? p.accent,
    good: p.toneGood,
    warning: p.toneHard,
    disaster: p.toneDisaster,
  };
}

/** A small engraved plate: the emblem in ink inside a double rule over hatching. */
function plate(entry: HallEntry, size: 'small' | 'large' = 'small'): HTMLElement {
  return h(
    'span',
    {
      class:
        `almanac-plate almanac-plate--${size} ${entry.playable ? '' : 'almanac-plate--pencil'}`.trim(),
      'aria-hidden': 'true',
    },
    emblem(entry.manifest.emblem),
  );
}

function mount(container: HTMLElement, first: HallSnapshot, ctx: ThemeContext): ThemeView {
  let snapshot = first;
  let focused = pickFocus(snapshot, ctx.initialFocus);
  let rightPage: { detail: DetailView | null; demo: DemoSlot | null; stop: (() => void) | null } = {
    detail: null,
    demo: null,
    stop: null,
  };

  const index = h('ol', { class: 'almanac-index', 'aria-label': 'Index of worlds' });
  const bookmarks = h('section', {
    class: 'almanac-bookmarks',
    'aria-labelledby': 'almanac-bookmarks-title',
  });
  const today = h('section', { class: 'almanac-today', 'aria-labelledby': 'almanac-today-title' });
  const foot = h('footer', { class: 'almanac-foot' });
  const ribbons = h('nav', { class: 'almanac-ribbons', 'aria-label': 'Ribbon tabs' });
  // The right page scrolls on its own, so keyboard users can focus it to scroll
  // even when a planned world gives it no buttons.
  const right = h('section', {
    class: 'almanac-page almanac-page--right crossfade',
    'aria-label': 'The chosen world',
    tabindex: 0,
  });

  const left = h(
    'section',
    { class: 'almanac-page almanac-page--left', 'aria-labelledby': 'almanac-index-title' },
    h(
      'p',
      { class: 'almanac-running' },
      h('span', {}, 'The Almanac of Small Worlds'),
      h('span', { class: 'almanac-folio' }, 'ii'),
    ),
    h(
      'header',
      { class: 'almanac-index__header' },
      h('h1', { id: 'almanac-index-title', class: 'almanac-index__title' }, 'Index of Worlds'),
      h(
        'p',
        { class: 'almanac-index__sub' },
        'Each a small world to tend for a while, one turn at a time.',
      ),
    ),
    index,
    bookmarks,
    today,
    foot,
  );

  const book = h(
    'div',
    { class: 'almanac-book' },
    h('div', { class: 'almanac-cover', 'aria-hidden': 'true' }),
    left,
    h('div', { class: 'almanac-gutter', 'aria-hidden': 'true' }),
    right,
    ribbons,
  );
  const root = h(
    'div',
    { class: 'almanac' },
    h(
      'div',
      { class: 'almanac-desk' },
      h('div', { class: 'almanac-window', 'aria-hidden': 'true' }),
      book,
    ),
  );
  container.append(root);

  function applyCosmetic(): void {
    const cosmetic = snapshot.legacy.active('almanac');
    for (const [name, value] of Object.entries(cosmetic.tokens[ctx.appearance()]))
      root.style.setProperty(name, value);
  }

  function chartTokens(): ChartTokens {
    return chartTokensFor('almanac', ctx.appearance());
  }

  // ---- the left page --------------------------------------------------------

  function drawIndex(): void {
    index.replaceChildren(
      ...snapshot.entries.map((entry, i) => {
        const run = entry.runs[0];
        const status = !entry.playable
          ? h(
              'span',
              { class: 'almanac-chapter__status almanac-chapter__status--preparing' },
              'in preparation',
            )
          : run
            ? h('span', { class: 'almanac-chapter__status' }, `Continue · ${run.turnLabel}`)
            : h(
                'span',
                { class: 'almanac-chapter__status' },
                entry.chronicleCount > 0
                  ? `${entry.chronicleCount} ${entry.chronicleCount === 1 ? 'chronicle' : 'chronicles'}`
                  : 'Begin',
              );
        return h(
          'li',
          {},
          button(
            [
              h('span', { class: 'almanac-chapter__numeral' }, numeral(i)),
              plate(entry),
              h(
                'span',
                { class: 'almanac-chapter__body' },
                h(
                  'span',
                  { class: 'almanac-chapter__line' },
                  h('span', { class: 'almanac-chapter__title' }, entry.manifest.title),
                  h('span', { class: 'almanac-chapter__leader', 'aria-hidden': 'true' }),
                  status,
                ),
                h(
                  'span',
                  { class: 'almanac-chapter__rubric' },
                  `${DOMAIN_NAMES[entry.manifest.domain]} · by the ${entry.manifest.turnUnit}`,
                ),
                h('span', { class: 'almanac-chapter__tagline' }, entry.manifest.tagline),
              ),
            ],
            () => select(entry.manifest.id),
            {
              class: 'almanac-chapter',
              'aria-current': entry.manifest.id === focused ? 'true' : null,
              'data-sim': entry.manifest.id,
              style: `--sim-accent:${entry.manifest.accent[ctx.appearance()]}`,
            },
          ),
        );
      }),
    );
  }

  /** Runs in progress, as ribbon bookmarks between the pages: most recent first. */
  function drawBookmarks(): void {
    const runs = snapshot.continueRuns.slice(0, 4);
    bookmarks.hidden = runs.length === 0;
    bookmarks.replaceChildren(
      h(
        'h2',
        { id: 'almanac-bookmarks-title', class: 'almanac-bookmarks__title' },
        'Where you left off',
      ),
      h(
        'ul',
        { class: 'almanac-bookmarks__list' },
        runs.map((run) => {
          const primary = run.manifest.primarySignal ?? run.manifest.signals[0]?.id ?? '';
          const signal = run.manifest.signals.find((item) => item.id === primary);
          const accent = run.manifest.accent[ctx.appearance()];
          const spark =
            run.spark.length > 1
              ? svgFrom(
                  sparkline(run.spark, {
                    label: signal?.label ?? primary,
                    tokens: { ...chartTokens(), ink: accent },
                    width: 96,
                    height: 26,
                    strokeWidth: 1.25,
                  }).markup,
                )
              : null;
          spark?.setAttribute('aria-hidden', 'true');
          return h(
            'li',
            {},
            button(
              [
                h('span', { class: 'almanac-bookmarks__ribbon', style: `background:${accent}` }),
                h('span', { class: 'almanac-bookmarks__sim' }, run.manifest.title),
                h('span', { class: 'almanac-bookmarks__turn' }, run.turnLabel),
                h(
                  'span',
                  { class: 'almanac-bookmarks__signal tabular' },
                  signal
                    ? `${signal.label} ${formatStyled(run.signals[primary] ?? 0, signal.format)}`
                    : '',
                ),
                spark,
              ],
              () => ctx.actions.continueRun(run.simId, run.id),
              { class: 'almanac-bookmarks__item', 'data-run': run.id },
            ),
          );
        }),
      ),
    );
  }

  function drawToday(): void {
    const date = formatDate(snapshot.today);
    today.replaceChildren(
      h('span', { class: 'almanac-today__corner', 'aria-hidden': 'true' }),
      h(
        'header',
        { class: 'almanac-today__header' },
        h('h2', { id: 'almanac-today-title', class: 'almanac-today__title' }, 'Today’s page'),
        h('p', { class: 'almanac-today__date' }, `${date} · No. ${snapshot.dailyNumber}`),
      ),
      snapshot.daily.length === 0
        ? h(
            'p',
            { class: 'almanac-today__empty' },
            'The daily worlds begin when the first chapter opens.',
          )
        : h(
            'ul',
            { class: 'almanac-today__list' },
            snapshot.daily.map((daily) =>
              h(
                'li',
                {},
                button(
                  [
                    h('span', { class: 'almanac-today__sim' }, daily.title),
                    h(
                      'span',
                      { class: 'almanac-today__state' },
                      daily.result
                        ? 'Written · read it again'
                        : daily.played
                          ? 'Begun today'
                          : 'The same world for everyone today',
                    ),
                  ],
                  () =>
                    daily.result
                      ? ctx.actions.openChronicle(daily.result.chronicleId)
                      : ctx.actions.playDaily(daily.simId),
                  { class: 'almanac-today__item', 'data-daily': daily.simId },
                ),
              ),
            ),
          ),
    );
  }

  function drawFoot(): void {
    const { streak, legacy } = snapshot;
    const marks = streak.days.slice(-21);
    foot.replaceChildren(
      h(
        'div',
        { class: 'almanac-streak' },
        h(
          'ol',
          { class: 'almanac-streak__marks', 'aria-hidden': 'true' },
          marks.length === 0
            ? h('li', { class: 'almanac-mark almanac-mark--empty' })
            : marks.map((day) =>
                h(
                  'li',
                  { class: `almanac-mark almanac-mark--${day.mark}` },
                  day.mark === 'grace' ? icon('flower', 14) : null,
                ),
              ),
        ),
        h(
          'p',
          { class: 'almanac-streak__text' },
          streak.current > 0
            ? `${streak.current} ${streak.current === 1 ? 'year' : 'years'} running`
            : 'A fresh volume',
          h('span', { class: 'almanac-streak__volume' }, ` · volume ${streak.volume}`),
        ),
      ),
      button(
        [
          h('span', { class: 'almanac-rank__title' }, legacy.standing.rank.title),
          h('span', { class: 'almanac-rank__points tabular' }, `${legacy.standing.points} points`),
        ],
        () => ctx.actions.openLegacy(),
        {
          class: 'almanac-rank',
          'aria-label': `Legacy rank: ${legacy.standing.rank.title}, ${legacy.standing.points} points`,
        },
      ),
    );
  }

  function drawRibbons(): void {
    ribbons.replaceChildren(
      ...snapshot.entries.map((entry) =>
        button(emblem(entry.manifest.emblem), () => select(entry.manifest.id), {
          class: 'almanac-ribbon',
          'aria-label': entry.manifest.title,
          'aria-current': entry.manifest.id === focused ? 'true' : null,
          style: `--sim-accent:${entry.manifest.accent[ctx.appearance()]}`,
          tabindex: -1,
        }),
      ),
    );
  }

  // ---- the right page -------------------------------------------------------

  function clearRight(): void {
    rightPage.stop?.();
    rightPage.demo?.dispose();
    rightPage.detail?.dispose();
    rightPage = { detail: null, demo: null, stop: null };
  }

  function drawRight(): void {
    clearRight();
    const entry = snapshot.entries.find((item) => item.manifest.id === focused);
    if (!entry) {
      right.replaceChildren();
      return;
    }
    const i = snapshot.entries.indexOf(entry);
    const accent = entry.manifest.accent[ctx.appearance()];
    const plateFrame = h('div', { class: 'almanac-engraving__frame' });
    const caption = h('figcaption', { class: 'almanac-engraving__caption' });
    const margin = h('aside', {
      class: 'almanac-margin',
      'aria-label': `${entry.manifest.title}: live numbers`,
    });

    if (entry.playable) {
      const demo = ctx.demos.mount(plateFrame, entry.manifest.id, 1009 + i);
      const live = createLiveSeries(entry.manifest.signals);
      caption.textContent = `Plate ${numeral(i)}. ${entry.manifest.title}, playing by itself.`;
      rightPage.demo = demo;
      rightPage.stop = demo.subscribe((frame) => {
        const series = live.push(frame);
        caption.textContent = `Plate ${numeral(i)}. ${entry.manifest.title}, playing by itself · ${capital(entry.manifest.turnUnit)} ${series.turn}`;
        drawMargin(margin, entry, series.values, accent);
      });
      drawMargin(margin, entry, {}, accent);
    } else {
      plateFrame.append(
        h(
          'span',
          { class: 'almanac-engraving__pencil', 'aria-hidden': 'true' },
          emblem(entry.manifest.emblem),
        ),
      );
      caption.textContent = `Plate ${numeral(i)}, in preparation.`;
      margin.append(
        ...entry.manifest.signals.map((signal) =>
          h(
            'div',
            { class: 'almanac-note almanac-note--blank' },
            h('span', { class: 'almanac-note__label' }, signal.label),
            h('span', { class: 'almanac-note__value' }, '—'),
          ),
        ),
      );
    }

    const detail = renderDetail(entry, {
      actions: ctx.actions,
      demos: ctx.demos,
      withDemo: false,
      seed: 1009 + i,
    });
    rightPage.detail = detail;

    right.style.setProperty('--sim-accent', accent);
    right.replaceChildren(
      h(
        'p',
        { class: 'almanac-running' },
        h('span', {}, `Chapter ${numeral(i)} · ${entry.manifest.title}`),
        h('span', { class: 'almanac-folio' }, String(12 + i * 8)),
      ),
      h(
        'div',
        { class: 'almanac-spread' },
        h('figure', { class: 'almanac-engraving' }, plateFrame, caption),
        margin,
      ),
      detail.element,
    );
  }

  function drawMargin(
    margin: HTMLElement,
    entry: HallEntry,
    values: Readonly<Record<string, readonly number[]>>,
    accent: string,
  ): void {
    margin.replaceChildren(
      ...entry.manifest.signals.map((signal) => {
        const series = values[signal.id] ?? [];
        const latest = series.at(-1);
        const change = lastChange(series);
        const chart =
          series.length > 1
            ? svgFrom(
                sparkline(series, {
                  label: signal.label,
                  tokens: { ...chartTokens(), ink: chartTokens().ink, accent },
                  width: 132,
                  height: 34,
                  strokeWidth: 1.25,
                }).markup,
              )
            : h('span', { class: 'almanac-note__pending' });
        return h(
          'div',
          { class: 'almanac-note' },
          h('span', { class: 'almanac-note__label' }, signal.label),
          h(
            'span',
            { class: 'almanac-note__value tabular' },
            latest === undefined ? '…' : formatStyled(latest, signal.format),
          ),
          change !== null
            ? h(
                'span',
                { class: 'almanac-note__delta tabular' },
                signal.format === 'percent'
                  ? `${formatDelta(change * 100)} pts`
                  : formatDelta(change),
              )
            : null,
          chart,
        );
      }),
    );
  }

  // ---- focus and page turns -----------------------------------------------

  function select(simId: string): void {
    if (simId === focused) return;
    focused = simId;
    ctx.actions.focus(simId);
    turnPage();
  }

  function turnPage(): void {
    right.classList.remove('almanac-page--turning');
    // Reading the layout makes the browser restart the animation.
    right.getBoundingClientRect();
    right.classList.add('almanac-page--turning');
    drawRight();
    drawIndex();
    drawRibbons();
  }

  function drawAll(): void {
    applyCosmetic();
    drawIndex();
    drawBookmarks();
    drawToday();
    drawFoot();
    drawRibbons();
    drawRight();
  }

  drawAll();

  return {
    update(next) {
      snapshot = next;
      if (!snapshot.entries.some((entry) => entry.manifest.id === focused))
        focused = pickFocus(snapshot, null);
      applyCosmetic();
      drawIndex();
      drawBookmarks();
      drawToday();
      drawFoot();
      drawRibbons();
      // The right page keeps its running demo; only its words need refreshing.
      const entry = snapshot.entries.find((item) => item.manifest.id === focused);
      if (entry && rightPage.detail) {
        const fresh = renderDetail(entry, {
          actions: ctx.actions,
          demos: ctx.demos,
          withDemo: false,
          seed: 0,
        });
        rightPage.detail.element.replaceWith(fresh.element);
        rightPage.detail.dispose();
        rightPage.detail = fresh;
      }
    },
    focus(simId) {
      const next = simId ?? pickFocus(snapshot, null);
      if (next === focused && rightPage.detail) return;
      focused = next;
      turnPage();
    },
    setAppearance() {
      applyCosmetic();
      drawIndex();
      drawRibbons();
      drawRight();
    },
    dispose() {
      clearRight();
      root.remove();
    },
  };
}

function pickFocus(snapshot: HallSnapshot, wanted: string | null): string {
  if (wanted && snapshot.entries.some((entry) => entry.manifest.id === wanted)) return wanted;
  return (
    snapshot.entries.find((entry) => entry.playable)?.manifest.id ??
    snapshot.entries[0]?.manifest.id ??
    ''
  );
}

function capital(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export const almanac: Theme = {
  id: 'almanac',
  demoStyle: 'engraving',
  demoPalette,
  chartTokens: (appearance) => chartTokensFor('almanac', appearance),
  mount,
};
