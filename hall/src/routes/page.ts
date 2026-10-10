/**
 * What every Hall page receives, and the page frame they share: a heading
 * with an almanac word above it and a plain title, then the page's body.
 */
import type { Appearance, ChartTokens } from '@one-more-year/kit';
import { h, type Child } from '../app/dom.ts';
import type { HallServices } from '../app/services.ts';
import type { HallModel, HallSnapshot } from '../data/hall-model.ts';
import type { HallActions } from '../themes/theme.ts';
import type { ThemeId } from '../themes/theme-ids.ts';

export interface PageContext {
  model: HallModel;
  services: HallServices;
  actions: HallActions;
  snapshot: HallSnapshot;
  theme: ThemeId;
  appearance: Appearance;
  chartTokens: ChartTokens;
  /** Redraws the page (after a filter changes or modules load). */
  rerender(): void;
  replayIntro(): void;
}

export function pageFrame(
  rubric: string,
  title: string,
  lead: string,
  ...body: Child[]
): HTMLElement {
  document.title = `${rubric} · One More Year`;
  return h(
    'div',
    { class: 'page' },
    h(
      'header',
      { class: 'page__header' },
      h('p', { class: 'page__rubric' }, rubric),
      h('h1', { class: 'page__title', id: 'page-title', tabindex: -1 }, title),
      h('p', { class: 'page__lead' }, lead),
    ),
    ...body,
  );
}
