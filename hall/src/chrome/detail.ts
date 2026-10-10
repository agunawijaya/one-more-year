/**
 * A simulation's detail (§7.5): its living demo, teaser and facts,
 * scenarios, milestones and codex progress, the player's chronicles of it,
 * and the ways in: Begin, Continue, today's scenario, How to play, and its
 * documentation. Every theme shows this same content in its own setting
 * (the Almanac's right page, the Situation Room's briefing panel, the
 * Terrarium's lifted dome), styled by the theme's CSS.
 */
import { formatDate, formatQuantity, type ChronicleEntry } from '@one-more-year/kit';
import { button, emblem, h } from '../app/dom.ts';
import type { DemoHost } from '../app/demos.ts';
import { DOMAIN_NAMES } from '../data/filters.ts';
import type { HallEntry } from '../data/hall-model.ts';
import type { HallActions } from '../themes/theme.ts';
import { icon } from './icons.ts';

export interface DetailOptions {
  actions: HallActions;
  demos: DemoHost;
  /** Whether to include the big live demo (a theme may already show it). */
  withDemo: boolean;
  /** Seed for the demo world. */
  seed: number;
}

export interface DetailView {
  readonly element: HTMLElement;
  dispose(): void;
}

const repoUrl = (import.meta.env.VITE_REPO_URL ?? '').replace(/\/$/, '');

export function docsUrl(simId: string, file: string): string | null {
  return repoUrl ? `${repoUrl}/blob/main/games/${simId}/docs/${file}` : null;
}

export function playersText(players: '1P' | '1–6P'): string {
  return players === '1P' ? 'One player' : 'One to six players, taking turns';
}

export function lengthText(entry: HallEntry): string {
  const { manifest } = entry;
  const [fewest, most] = manifest.typicalTurns;
  const unit = { singular: manifest.turnUnit, plural: `${manifest.turnUnit}s` };
  const turns = fewest === most ? formatQuantity(fewest, unit) : `${fewest}–${most} ${unit.plural}`;
  const [short, long] = manifest.sessionMinutes;
  return `${turns} · about ${short}–${long} minutes`;
}

export function renderDetail(entry: HallEntry, options: DetailOptions): DetailView {
  const { manifest } = entry;
  const { actions } = options;
  let demoSlot: { dispose(): void } | null = null;

  const demo = options.withDemo
    ? h('div', {
        class: 'detail__demo',
        'aria-label': `${manifest.title}, playing by itself`,
        role: 'img',
      })
    : null;
  if (demo && entry.playable) demoSlot = options.demos.mount(demo, manifest.id, options.seed);
  if (demo && !entry.playable)
    demo.append(h('span', { class: 'detail__pencil' }, emblem(manifest.emblem)));

  const run = entry.runs[0];
  const ways = entry.playable
    ? h(
        'div',
        { class: 'detail__ways' },
        button([icon('play', 18), h('span', {}, 'Begin')], () => actions.begin(manifest.id), {
          class: 'button button--primary',
          'data-action': 'begin',
        }),
        run
          ? button(
              [h('span', {}, 'Continue'), h('span', { class: 'button__detail' }, run.turnLabel)],
              () => actions.continueRun(manifest.id, run.id),
              { class: 'button', 'data-action': 'continue' },
            )
          : null,
        entry.daily
          ? button(
              [icon('calendar', 18), h('span', {}, `Today #${entry.daily.number}`)],
              () => actions.playDaily(manifest.id),
              { class: 'button', 'data-action': 'daily' },
            )
          : null,
        button('Game menu', () => actions.gameMenu(manifest.id), {
          class: 'button button--quiet',
          'data-action': 'game-menu',
        }),
        button('How to play', () => actions.howToPlay(manifest.id), {
          class: 'button button--quiet',
          'data-action': 'how-to-play',
        }),
      )
    : h(
        'p',
        { class: 'detail__preparing' },
        'In preparation. This world is being built; its chapter is reserved.',
      );

  const facts = h(
    'dl',
    { class: 'detail__facts' },
    h('dt', {}, 'Domain'),
    h('dd', {}, DOMAIN_NAMES[manifest.domain]),
    h('dt', {}, 'A turn is'),
    h('dd', {}, `one ${manifest.turnUnit}`),
    h('dt', {}, 'Length'),
    h('dd', {}, lengthText(entry)),
    h('dt', {}, 'Players'),
    h('dd', {}, playersText(manifest.players)),
    h('dt', {}, 'After'),
    h('dd', {}, `${manifest.inspiredBy.uiTitle} (${manifest.inspiredBy.year})`),
  );

  const scenarios =
    manifest.scenarios.length > 0
      ? h(
          'section',
          { class: 'detail__section' },
          h('h3', {}, 'Scenarios'),
          h(
            'ul',
            { class: 'detail__scenarios' },
            manifest.scenarios.map((scenario) =>
              h(
                'li',
                {},
                entry.playable
                  ? button(
                      [h('strong', {}, scenario.title), h('span', {}, scenario.twist)],
                      () => actions.begin(manifest.id, scenario.id),
                      { class: 'detail__scenario', 'data-scenario': scenario.id },
                    )
                  : h('span', {}, h('strong', {}, scenario.title), ' ', scenario.twist),
              ),
            ),
          ),
        )
      : null;

  const progress = entry.playable
    ? h(
        'section',
        { class: 'detail__section detail__progress' },
        h('h3', {}, 'Your progress'),
        h(
          'ul',
          {},
          h(
            'li',
            {},
            button(
              `Codex: ${entry.codex.discovered}${entry.codex.total === null ? '' : ` of ${entry.codex.total}`} discovered`,
              () => actions.openCodex(manifest.id),
              { class: 'link-button' },
            ),
          ),
          h(
            'li',
            {},
            `Milestones: ${entry.milestones.unlocked}${entry.milestones.total === null ? '' : ` of ${entry.milestones.total}`}`,
          ),
          h('li', {}, `Runs finished: ${entry.stats.runsFinished}`),
        ),
      )
    : null;

  const chronicles =
    entry.chronicleCount > 0
      ? h(
          'section',
          { class: 'detail__section' },
          h('h3', {}, 'Your chronicles'),
          h(
            'ul',
            { class: 'detail__chronicles' },
            [entry.best, entry.latest]
              .filter(
                (chronicle, index, list): chronicle is ChronicleEntry =>
                  chronicle !== null && list.indexOf(chronicle) === index,
              )
              .map((chronicle) =>
                h(
                  'li',
                  {},
                  button(
                    [
                      h('em', {}, `“${chronicle.epithet.text}”`),
                      h(
                        'span',
                        {},
                        `${chronicle.outcome.verdict.label} · ${formatDate(chronicle.finishedAt)}`,
                      ),
                    ],
                    () => actions.openChronicle(chronicle.id),
                    { class: 'detail__chronicle' },
                  ),
                ),
              ),
          ),
          entry.chronicleCount > 2
            ? button(`All ${entry.chronicleCount} in the Library`, () => actions.openLibrary(), {
                class: 'link-button',
              })
            : null,
        )
      : null;

  const howUrl = docsUrl(manifest.id, 'HOW-TO-PLAY.md');
  const aboutUrl = docsUrl(manifest.id, 'ABOUT.md');
  const links =
    entry.playable && howUrl && aboutUrl
      ? h(
          'p',
          { class: 'detail__links' },
          h(
            'a',
            { href: aboutUrl, target: '_blank', rel: 'noopener' },
            'About this world',
            icon('external', 14),
          ),
          h(
            'a',
            { href: howUrl, target: '_blank', rel: 'noopener' },
            'Full manual',
            icon('external', 14),
          ),
        )
      : null;

  const element = h(
    'section',
    {
      class: `detail ${entry.playable ? '' : 'detail--coming-soon'}`.trim(),
      'data-sim': manifest.id,
      'aria-labelledby': `detail-title-${manifest.id}`,
    },
    demo,
    h(
      'p',
      { class: 'detail__rubric' },
      `${DOMAIN_NAMES[manifest.domain]} · by the ${manifest.turnUnit}`,
    ),
    h('h2', { class: 'detail__title', id: `detail-title-${manifest.id}` }, manifest.title),
    h('p', { class: 'detail__tagline' }, manifest.tagline),
    h('p', { class: 'detail__teaser' }, manifest.teaser),
    entry.best
      ? h(
          'p',
          { class: 'detail__epithet' },
          'Your finest tenure: ',
          h('em', {}, `“${entry.best.epithet.text}”`),
        )
      : null,
    ways,
    facts,
    scenarios,
    progress,
    chronicles,
    links,
  );

  return {
    element,
    dispose() {
      demoSlot?.dispose();
    },
  };
}
