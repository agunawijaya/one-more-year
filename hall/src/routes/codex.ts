/**
 * The Codex (#/codex): for each world, the phenomena its model can produce.
 * Discovered entries are illustrated cards with what it is, when it tends
 * to happen and, once seen often enough, how the model actually computes
 * it. Undiscovered ones are silhouettes with a hint.
 *
 * The entries live in each simulation's module, so this page loads the
 * modules of every playable world first.
 */
import { formatDate, type CodexEntryView } from '@one-more-year/kit';
import { button, h, svgFrom } from '../app/dom.ts';
import { pageFrame, type PageContext } from './page.ts';

export function renderCodex(ctx: PageContext, focusSim: string | null): HTMLElement {
  const playable = ctx.snapshot.entries.filter((entry) => entry.playable);
  const missing = playable.filter((entry) => !entry.module);
  if (missing.length > 0) {
    void Promise.all(missing.map((entry) => ctx.model.loadModule(entry.manifest.id))).then(() =>
      ctx.rerender(),
    );
  }

  const sections = playable
    .filter((entry) => entry.module)
    .sort((a, b) => Number(b.manifest.id === focusSim) - Number(a.manifest.id === focusSim))
    .map((entry) => {
      const module = entry.module;
      if (!module) return null;
      const codex = ctx.services.codex.forSim(entry.manifest.id, module.codex);
      const progress = codex.progress();
      return h(
        'section',
        {
          class: 'codex__world',
          'aria-labelledby': `codex-${entry.manifest.id}`,
          style: `--sim-accent:${entry.manifest.accent[ctx.appearance]}`,
        },
        h(
          'header',
          { class: 'codex__world-header' },
          h('h2', { id: `codex-${entry.manifest.id}` }, entry.manifest.title),
          h(
            'p',
            { class: 'codex__progress tabular' },
            `${progress.discovered} of ${progress.total} discovered`,
            h('span', {
              class: 'meter',
              role: 'img',
              'aria-label': `${progress.discovered} of ${progress.total}`,
              style: `--fill:${progress.total ? progress.discovered / progress.total : 0}`,
            }),
          ),
        ),
        h(
          'ul',
          { class: 'codex__cards' },
          codex.entries().map((view) => h('li', {}, codexCard(view, ctx))),
        ),
      );
    });

  const loading =
    missing.length > 0
      ? h('p', { class: 'page__loading', role: 'status' }, 'Opening the codex…')
      : null;
  const none =
    playable.length === 0
      ? h(
          'div',
          { class: 'empty' },
          h('p', { class: 'empty__title' }, 'No world is open yet.'),
          h('p', {}, 'The Codex fills as you play.'),
        )
      : null;

  return pageFrame(
    'The Codex',
    'How these worlds work',
    'Every phenomenon a world can produce, collected as you meet it. See one often enough and its workings are written out, with the real numbers.',
    loading,
    none,
    ...sections,
  );
}

function codexCard(view: CodexEntryView, ctx: PageContext): HTMLElement {
  const art = svgFrom(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" aria-hidden="true">${view.def.art}</svg>`,
  );
  if (!view.discovered) {
    return h(
      'article',
      { class: 'codex-card codex-card--hidden', 'aria-label': 'An undiscovered phenomenon' },
      h('div', { class: 'codex-card__art codex-card__art--silhouette' }, art),
      h('h3', { class: 'codex-card__title' }, 'Not yet seen'),
      h('p', { class: 'codex-card__hint' }, view.def.hint),
    );
  }
  const reveal = view.def.revealAfter ?? 3;
  return h(
    'article',
    { class: 'codex-card', 'data-entry': view.def.id },
    h('div', { class: 'codex-card__art' }, art),
    h('h3', { class: 'codex-card__title' }, view.def.title),
    h('p', {}, view.def.summary),
    h('p', { class: 'codex-card__tendency' }, h('strong', {}, 'When: '), view.def.tendency),
    view.mechanismRevealed
      ? h(
          'p',
          { class: 'codex-card__mechanism' },
          h('strong', {}, 'How the model does it: '),
          view.def.mechanism,
        )
      : h(
          'p',
          { class: 'codex-card__locked' },
          `Seen ${view.seen} of ${reveal} times; its workings are written out after ${reveal}.`,
        ),
    h(
      'p',
      { class: 'codex-card__meta tabular' },
      `Seen ${view.seen} ${view.seen === 1 ? 'time' : 'times'}`,
      view.firstSeenAt ? ` · first ${formatDate(view.firstSeenAt)}` : '',
      view.firstChronicleId
        ? [
            ' · ',
            button('the chronicle', () => ctx.actions.openChronicle(view.firstChronicleId ?? ''), {
              class: 'link-button',
            }),
          ]
        : null,
    ),
  );
}
