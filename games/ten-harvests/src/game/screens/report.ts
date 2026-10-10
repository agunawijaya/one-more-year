/**
 * The scribe's report: a clay tablet that rises over the lower third of the
 * city after the year has turned. Every event of the year in the order it
 * happened, the three numbers with their changes, anything new in the
 * Codex, and on a replayed world how the earlier run stood.
 */
import {
  describeEvent,
  formatDelta,
  formatNumber,
  type Discovery,
  type Signals,
  type TurnRecord,
} from '@one-more-year/kit';
import { EVENT_TEXT, headlineFor } from '../../content/text.ts';
import type { Decree } from '../../engine/state.ts';
import { button, el } from '../../ui/dom.ts';

/** Events worth a line in the report; the bookkeeping ones are folded into others. */
const SHOWN = new Set([
  'land-bought',
  'land-sold',
  'sown',
  'harvest',
  'rats',
  'hunger',
  'all-fed',
  'generous-year',
  'newcomers',
  'fever',
  'deposed',
  'walked-out',
]);

export interface ReportView {
  record: TurnRecord<Decree>;
  before: Signals;
  discoveries: readonly Discovery[];
  ghost: string | null;
  continueLabel: string;
}

/** New Codex entries share one line at the foot; a single one also gets its summary. */
function codexLine(found: readonly Discovery[]): HTMLElement | null {
  if (found.length === 0) return null;
  const chip = (entry: Discovery): HTMLElement => {
    const art = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    art.setAttribute('viewBox', '0 0 48 48');
    art.setAttribute('aria-hidden', 'true');
    art.innerHTML = entry.def.art;
    return el('span', { class: 'th-codex-chip' }, art, entry.def.title);
  };
  const only = found.length === 1 ? found[0] : undefined;
  return el(
    'div',
    { class: 'th-codex-line', role: 'note' },
    el('span', { class: 'th-codex-line__label' }, 'New in your Codex'),
    ...found.map(chip),
    only ? el('span', { class: 'th-codex-line__summary' }, only.def.summary) : null,
  );
}

function signalRow(label: string, value: number, before: number | undefined): HTMLElement {
  const delta = before === undefined ? null : value - before;
  return el(
    'div',
    { class: 'th-report__signal' },
    el('span', {}, label),
    el('b', {}, formatNumber(value)),
    delta === null
      ? null
      : el(
          'em',
          { 'data-sign': delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat' },
          formatDelta(delta),
        ),
  );
}

export function renderReport(
  view: ReportView,
  onContinue: () => void,
): { element: HTMLElement; focus(): void } {
  const { record, before } = view;
  const events = record.events.filter((e) => SHOWN.has(e.kind));
  const proceed = button([view.continueLabel, el('kbd', {}, 'Enter')], onContinue, {
    class: 'th-primary',
    'data-action': 'continue',
  });
  const element = el(
    'section',
    { class: 'th-report th-clay', 'aria-labelledby': 'th-report-title' },
    el(
      'header',
      { class: 'th-report__head' },
      el('p', {}, `Year ${record.turn} · the scribe’s report`),
      el('h2', { id: 'th-report-title' }, headlineFor(record.events)),
    ),
    el(
      'div',
      { class: 'th-report__body' },
      el(
        'ol',
        { class: 'th-report__events' },
        ...events.map((e) =>
          el('li', { 'data-severity': e.severity }, describeEvent(EVENT_TEXT, e)),
        ),
      ),
      el(
        'div',
        { class: 'th-report__side' },
        el(
          'div',
          { class: 'th-report__signals' },
          signalRow('People', record.signals.people ?? 0, before.people),
          signalRow('Grain in store', record.signals.grain ?? 0, before.grain),
          signalRow('Acres', record.signals.acres ?? 0, before.acres),
        ),
        view.ghost ? el('p', { class: 'th-ghost' }, view.ghost) : null,
      ),
    ),
    el(
      'div',
      { class: 'th-report__foot' },
      codexLine(view.discoveries.filter((found) => found.isNew)),
      proceed,
    ),
  );
  return { element, focus: () => proceed.focus() };
}
