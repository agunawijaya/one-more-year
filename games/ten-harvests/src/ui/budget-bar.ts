/**
 * The grain budget bar, the heart of the plan: one bar for the whole store,
 * split into land, food, seed and what is kept. Three handles move grain
 * between neighbours by mouse, touch or keyboard (Tab to a handle, ← →,
 * Shift for ten). Hovering or focusing a segment says what it buys.
 */
import {
  barLength,
  budgetOf,
  dragHandle,
  handleEnabled,
  handlePositions,
  nudgeHandle,
  shortfallOf,
  type Handle,
} from './budget.ts';
import { el, setText } from './dom.ts';
import { n, segmentTip, WORDS } from './words.ts';
import { peopleFedBy } from '../engine/model.ts';
import type { CityState, Decree } from '../engine/state.ts';

export interface BudgetBar {
  element: HTMLElement;
  update(state: CityState, decree: Decree): void;
}

const HANDLES: readonly { id: Handle; label: string }[] = [
  { id: 'food-seed', label: 'Move grain between food and seed' },
  { id: 'seed-land', label: 'Move grain between seed and land' },
  { id: 'land-keep', label: 'Move grain between land and the store' },
];

type Use = 'food' | 'seed' | 'land' | 'keep';
const USES: readonly Use[] = ['food', 'seed', 'land', 'keep'];

function eachUse<T>(make: (use: Use) => T): Record<Use, T> {
  return { food: make('food'), seed: make('seed'), land: make('land'), keep: make('keep') };
}

function eachHandle<T>(make: (handle: Handle, label: string) => T): Record<Handle, T> {
  const [a, b, c] = HANDLES as [
    (typeof HANDLES)[number],
    (typeof HANDLES)[number],
    (typeof HANDLES)[number],
  ];
  return {
    'food-seed': make(a.id, a.label),
    'seed-land': make(b.id, b.label),
    'land-keep': make(c.id, c.label),
  };
}

/** The segment a handle mostly changes, for its tooltip: the one to its left. */
const TIP_FOR: Record<Handle, Use> = {
  'food-seed': 'food',
  'seed-land': 'seed',
  'land-keep': 'land',
};

function edgesOf(positions: Record<Handle, number>): Record<Use, [number, number]> {
  return {
    food: [0, positions['food-seed']],
    seed: [positions['food-seed'], positions['seed-land']],
    land: [positions['seed-land'], positions['land-keep']],
    keep: [positions['land-keep'], 1],
  };
}

export function createBudgetBar(onChange: (decree: Decree) => void): BudgetBar {
  const total = el('span', { class: 'tabular' });
  const bar = el('div', { class: 'th-bar', role: 'group', 'aria-label': 'Grain budget' });
  const segments = eachUse((use) => el('div', { class: 'th-bar__segment', 'data-use': use }));
  for (const use of USES) bar.append(segments[use]);
  // Past the end of the store: what the decree asks for that the granary does not hold. The
  // amount is written in the header and under Keep; the bar only hatches it.
  const over = el('div', { class: 'th-bar__over', hidden: true, 'aria-hidden': 'true' });
  bar.append(over);
  const tip = el('div', { class: 'th-bar__tip', hidden: true, role: 'status' });
  bar.append(tip);
  const handles = eachHandle((id, label) =>
    el('button', {
      type: 'button',
      class: 'th-bar__handle',
      'data-handle': id,
      role: 'slider',
      'aria-label': label,
      'aria-valuemin': 0,
      'aria-valuemax': 100,
    }),
  );
  for (const { id } of HANDLES) bar.append(handles[id]);
  const legend = el('div', { class: 'th-bar__legend' });
  const legendValues = eachUse((use) => {
    const value = el('b');
    legend.append(
      el('span', { style: `--swatch: var(--th-${use})` }, el('i'), `${WORDS[use]} `, value),
    );
    return value;
  });
  const sale = el('span', { class: 'th-bar__sale', hidden: true });
  legend.append(sale);

  const element = el(
    'section',
    { class: 'th-budget th-clay', 'aria-label': 'Grain budget' },
    el('div', { class: 'th-budget__head' }, el('strong', {}, WORDS.granary), total),
    bar,
    legend,
  );

  let state: CityState | null = null;
  let decree: Decree | null = null;
  let dragging: Handle | null = null;
  let hovered: Use | null = null;

  function shareAt(clientX: number): number {
    const box = bar.getBoundingClientRect();
    return (clientX - box.left) / Math.max(1, box.width);
  }

  function detailOf(use: Use): number {
    if (!state || !decree) return 0;
    switch (use) {
      case 'land':
        return Math.max(0, decree.land);
      case 'food':
        return Math.min(state.people, peopleFedBy(decree.food));
      case 'seed':
        return decree.plant;
      case 'keep':
        return 0;
    }
  }

  function showTip(use: Use | null, centre: number): void {
    if (!state || !decree || use === null) {
      tip.hidden = true;
      return;
    }
    const budget = budgetOf(state, decree);
    tip.hidden = false;
    tip.replaceChildren(el('b', {}, segmentTip(use, budget[use], detailOf(use))));
    tip.style.left = `${Math.max(8, Math.min(92, centre * 100))}%`;
  }

  function useNear(share: number): Use {
    if (!state || !decree) return 'keep';
    const edges = edgesOf(handlePositions(budgetOf(state, decree)));
    return USES.find((use) => share < edges[use][1]) ?? 'keep';
  }

  function segmentCentre(use: Use): number {
    if (!state || !decree) return 0.5;
    const [a, b] = edgesOf(handlePositions(budgetOf(state, decree)))[use];
    return (a + b) / 2;
  }

  for (const { id } of HANDLES) {
    const handle = handles[id];
    handle.addEventListener('pointerdown', (event) => {
      dragging = id;
      handle.setPointerCapture(event.pointerId);
      handle.dataset.dragging = 'true';
      event.preventDefault();
    });
    handle.addEventListener('pointermove', (event) => {
      if (dragging !== id || !state || !decree) return;
      const next = dragHandle(state, decree, id, shareAt(event.clientX));
      onChange(next);
      showTip(TIP_FOR[id], segmentCentre(TIP_FOR[id]));
    });
    const release = (): void => {
      if (dragging !== id) return;
      dragging = null;
      delete handle.dataset.dragging;
      showTip(hovered, hovered ? segmentCentre(hovered) : 0.5);
    };
    handle.addEventListener('pointerup', release);
    handle.addEventListener('pointercancel', release);
    handle.addEventListener('keydown', (event) => {
      if (!state || !decree) return;
      const direction = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
      if (direction === 0) return;
      event.preventDefault();
      onChange(nudgeHandle(state, decree, id, direction * (event.shiftKey ? 10 : 1)));
    });
    handle.addEventListener('focus', () => showTip(TIP_FOR[id], segmentCentre(TIP_FOR[id])));
    handle.addEventListener('blur', () => showTip(null, 0));
  }

  bar.addEventListener('pointermove', (event) => {
    if (dragging) return;
    hovered = useNear(shareAt(event.clientX));
    showTip(hovered, segmentCentre(hovered));
  });
  bar.addEventListener('pointerleave', () => {
    hovered = null;
    if (!dragging) showTip(null, 0);
  });

  return {
    element,
    update(nextState, nextDecree) {
      state = nextState;
      decree = nextDecree;
      const budget = budgetOf(nextState, nextDecree);
      const whole = barLength(budget);
      const short = shortfallOf(budget);
      const positions = handlePositions(budget);
      const edges = edgesOf(positions);
      for (const use of USES) {
        const [from, to] = edges[use];
        const segment = segments[use];
        segment.style.left = `${from * 100}%`;
        segment.style.width = `${Math.max(0, to - from) * 100}%`;
        // Numbers inside a segment only when there is room to read them.
        setText(segment, (to - from) * whole > whole * 0.07 ? n(budget[use]) : '');
        setText(legendValues[use], n(budget[use]));
      }
      legendValues.keep.dataset.short = String(short > 0);
      over.hidden = short === 0;
      if (short > 0) {
        const storeEnds = budget.total / whole;
        over.style.left = `${storeEnds * 100}%`;
        over.style.width = `${(1 - storeEnds) * 100}%`;
      }
      for (const { id } of HANDLES) {
        const handle = handles[id];
        handle.style.left = `${positions[id] * 100}%`;
        handle.setAttribute('aria-valuenow', String(Math.round(positions[id] * 100)));
        handle.setAttribute(
          'aria-valuetext',
          `${n(Math.round(positions[id] * budget.total))} bushels`,
        );
        handle.disabled = !handleEnabled(nextDecree, id);
      }
      setText(
        total,
        `${n(budget.total)} bushels${budget.sale > 0 ? `, ${n(budget.sale)} of them from land sold` : ''}` +
          (short > 0 ? ` · ${n(short)} short` : ''),
      );
      total.dataset.short = String(short > 0);
      sale.hidden = true;
      if (dragging || !tip.hidden) {
        const use = dragging ? TIP_FOR[dragging] : hovered;
        if (use) showTip(use, segmentCentre(use));
      }
    },
  };
}
