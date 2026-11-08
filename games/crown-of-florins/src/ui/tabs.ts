/**
 * A card of tabs: one of a few panels showing at a time. The year screen's
 * columns must fit above the rival bar at every size, so cards that are
 * read now and then (the ruler and the realm; the road, the border and the
 * debt) share a card instead of stacking past the edge.
 *
 * The tab list follows the usual pattern: arrow keys move between tabs,
 * Home and End go to the first and the last, and only the chosen tab is in
 * the Tab order. A tab can carry a mark (the border open, the treasury in
 * debt), so what waits behind it is never a surprise.
 */
import { el } from './dom.ts';
import { scrollBody, type ScrollBody } from './scroll.ts';

export interface TabSpec {
  id: string;
  label: string;
  body: HTMLElement;
}

export interface TabsCard {
  readonly element: HTMLElement;
  readonly selected: string;
  select(id: string): void;
  /** Puts a mark on a tab (`words` is read out with it), or takes it off with null. */
  mark(id: string, words: string | null): void;
  /** Looks again for more to scroll in the showing panel. */
  refresh(): void;
}

export function createTabs(name: string, label: string, tabs: readonly TabSpec[]): TabsCard {
  const list = el('div', { class: 'cf-tabs__list', role: 'tablist', 'aria-label': label });
  const entries = tabs.map((tab) => {
    const id = `${name}-${tab.id}`;
    const flag = el('span', { class: 'cf-tabs__mark', 'aria-hidden': 'true' });
    const spoken = el('span', { class: 'cf-visually-hidden' });
    const button = el(
      'button',
      {
        type: 'button',
        role: 'tab',
        id: `${id}-tab`,
        class: 'cf-tabs__tab',
        'aria-controls': `${id}-panel`,
        'data-tab': tab.id,
      },
      el('span', { class: 'cf-tabs__label' }, tab.label),
      flag,
      spoken,
    );
    const scroll: ScrollBody = scrollBody('cf-tabs__body', tab.label, tab.body);
    const panel = el(
      'div',
      {
        role: 'tabpanel',
        id: `${id}-panel`,
        class: 'cf-tabs__panel',
        'aria-labelledby': `${id}-tab`,
        'data-tab-panel': tab.id,
      },
      scroll.element,
    );
    list.append(button);
    return { tab, button, flag, spoken, panel, scroll };
  });
  const element = el(
    'article',
    { class: `cf-card cf-tabs ${name}` },
    list,
    ...entries.map((e) => e.panel),
  );
  let selected = tabs[0]?.id ?? '';

  function select(id: string, focus = false): void {
    selected = id;
    for (const entry of entries) {
      const on = entry.tab.id === id;
      entry.button.setAttribute('aria-selected', String(on));
      entry.button.tabIndex = on ? 0 : -1;
      entry.panel.hidden = !on;
      if (on) {
        if (focus) entry.button.focus();
        entry.scroll.refresh();
      }
    }
  }

  entries.forEach((entry, i) => {
    entry.button.addEventListener('click', () => select(entry.tab.id));
    entry.button.addEventListener('keydown', (event) => {
      const last = entries.length - 1;
      const to =
        event.key === 'ArrowRight'
          ? (i + 1) % entries.length
          : event.key === 'ArrowLeft'
            ? (i - 1 + entries.length) % entries.length
            : event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? last
                : null;
      if (to === null) return;
      event.preventDefault();
      select(entries[to]?.tab.id ?? selected, true);
    });
  });
  select(selected);

  return {
    element,
    get selected() {
      return selected;
    },
    select: (id) => select(id),
    mark(id, words) {
      const entry = entries.find((e) => e.tab.id === id);
      if (!entry) return;
      entry.button.toggleAttribute('data-marked', words !== null);
      entry.spoken.textContent = words ? ` (${words})` : '';
    },
    refresh() {
      entries.find((e) => e.tab.id === selected)?.scroll.refresh();
    },
  };
}
