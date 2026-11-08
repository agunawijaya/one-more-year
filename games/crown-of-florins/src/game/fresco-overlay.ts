/**
 * The fresco as a place to work, not only to look at: sacks to drag between
 * the granary and the market or the piazza, the line of the walls to pull
 * outward or push in, the toll gates and the magistrate's bench answering
 * the taxes, and lit plots that take a building card.
 *
 * Everything here is DOM laid over the canvas at points projected from the
 * scene, so it stays crisp, focusable and readable to a screen reader. Every
 * gesture changes the same plan the side panel edits; the panel stays the
 * precise way, the fresco the direct one.
 */
import { formatNumber } from '@one-more-year/kit';
import type { Plan } from '../engine/state.ts';
import type { CityScene } from '../scene/city-scene.ts';
import type { FrescoView } from '../scene/view.ts';
import { BUILD_ITEMS, buildIcon, type BuildKind, type YearView } from '../ui/year-screen.ts';
import { el, svgNode } from '../ui/dom.ts';

export interface OverlayHandlers {
  change(update: (plan: Plan) => Plan): void;
  /** A drop that is not allowed: shake and a dull knock, never a silent failure. */
  refuse(): void;
  /** A building placed on its plot. */
  placed(kind: BuildKind): void;
  grain(): void;
}

export interface FrescoOverlay {
  update(view: YearView): void;
  /** Keyboard placement (B): focus the plots, arrows choose, Enter places. */
  pickPlot(kind?: BuildKind): void;
  dispose(): void;
}

interface Anchor {
  x: number;
  y: number;
  z: number;
}

/** Bushels in one sack. */
const SACK = 1000;
/** Hectares per pixel the wall line is dragged. */
const HECTARES_PER_PIXEL = 25;

export function createFrescoOverlay(
  host: HTMLElement,
  view: FrescoView,
  city: CityScene,
  handlers: OverlayHandlers,
): FrescoOverlay {
  let current: YearView | null = null;
  const layer = el('div', { class: 'cf-overlay', 'data-step': 'harvest' });
  host.append(layer);

  // ---- anchors in the scene --------------------------------------------------------------

  function anchors(): Record<string, Anchor> {
    const plan = city.plan;
    const wall = plan?.wall ?? [];
    let south = wall[0] ?? { x: 0, z: 40 };
    for (const p of wall) if (p.z > south.z) south = p;
    const gate = (i: number): Anchor => {
      const index = plan?.gates[i] ?? 0;
      const a = wall[index] ?? { x: 0, z: 0 };
      const b = wall[(index + 1) % Math.max(1, wall.length)] ?? a;
      return { x: (a.x + b.x) / 2, y: 3, z: (a.z + b.z) / 2 };
    };
    const stalls = plan?.stalls ?? [];
    const stallAt =
      stalls.length > 0
        ? {
            x: stalls.reduce((s, p) => s + p.x, 0) / stalls.length,
            z: stalls.reduce((s, p) => s + p.z, 0) / stalls.length,
          }
        : { x: 10, z: 8 };
    const stream = plan?.stream ?? [];
    const mill = plan?.mills[plan.mills.length - 1]?.bank ??
      stream[Math.floor(stream.length * 0.2)] ?? { x: 50, z: 0 };
    return {
      granary: { x: plan?.granary.x ?? -18, y: 4, z: plan?.granary.z ?? -1.5 },
      stalls: { x: stallAt.x, y: 2, z: stallAt.z },
      piazza: { x: 0, y: 1, z: 2 },
      wall: { x: south.x, y: 4, z: south.z },
      gate0: gate(0),
      gate1: gate(1),
      gate2: gate(2),
      bench: { x: 6, y: 2, z: -6 },
      cathedral: { x: 0, y: 12, z: -24.5 },
      palace: { x: 20.5, y: 8, z: 1 },
      markets: { x: stallAt.x + 6, y: 2, z: stallAt.z + 4 },
      mills: { x: mill.x, y: 2, z: mill.z },
      platoons: { x: plan?.yard.x ?? -20, y: 1, z: plan?.yard.z ?? 20 },
    };
  }

  function place(node: HTMLElement, at: Anchor): void {
    const p = view.project(at);
    node.style.left = `${(p.x * 100).toFixed(2)}%`;
    node.style.top = `${(p.y * 100).toFixed(2)}%`;
    node.hidden = p.x < -0.05 || p.x > 1.05 || p.y < -0.05 || p.y > 1.05;
  }

  // ---- sacks: drag between two places ---------------------------------------------------------

  interface Sack {
    node: HTMLElement;
    from: string;
    to: string;
    apply(): void;
  }

  function sack(
    id: string,
    label: string,
    from: string,
    to: string,
    apply: () => void,
    hint: string,
  ): Sack {
    const node = el(
      'button',
      {
        type: 'button',
        class: 'cf-sack',
        'data-sack': id,
        'aria-label': `${label}. ${hint}`,
        title: hint,
      },
      svgNode(SACK_SVG),
      el('span', { class: 'cf-sack__label' }, label),
    );
    const record: Sack = { node, from, to, apply };
    node.addEventListener('click', () => {
      // A click (or Enter) moves one sack; dragging is the same, with a destination to see.
      apply();
      handlers.grain();
    });
    node.addEventListener('pointerdown', (event) => startDrag(event, record));
    return record;
  }

  function targetUnder(x: number, y: number, name: string): boolean {
    const target = targets.get(name);
    if (!target) return false;
    const r = target.getBoundingClientRect();
    const pad = 28;
    return x > r.left - pad && x < r.right + pad && y > r.top - pad && y < r.bottom + pad;
  }

  function startDrag(event: PointerEvent, record: Sack): void {
    if (event.button !== 0) return;
    event.preventDefault();
    const ghost = record.node.cloneNode(true) as HTMLElement;
    ghost.classList.add('cf-sack--ghost');
    ghost.removeAttribute('aria-label');
    ghost.setAttribute('aria-hidden', 'true');
    layer.append(ghost);
    const box = layer.getBoundingClientRect();
    const move = (e: PointerEvent): void => {
      ghost.style.left = `${e.clientX - box.left}px`;
      ghost.style.top = `${e.clientY - box.top}px`;
      targets
        .get(record.to)
        ?.toggleAttribute('data-hot', targetUnder(e.clientX, e.clientY, record.to));
    };
    const up = (e: PointerEvent): void => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      ghost.remove();
      targets.get(record.to)?.removeAttribute('data-hot');
      const moved = Math.hypot(e.clientX - event.clientX, e.clientY - event.clientY);
      if (moved < 6) return; // a click; the click handler does the work
      if (targetUnder(e.clientX, e.clientY, record.to)) {
        record.apply();
        handlers.grain();
      } else {
        handlers.refuse();
        shake(record.node);
      }
    };
    move(event);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  const targets = new Map<string, HTMLElement>();
  const target = (name: string, label: string): HTMLElement => {
    const node = el('span', { class: 'cf-target', 'data-target': name }, el('span', {}, label));
    targets.set(name, node);
    return node;
  };

  const sellSack = sack(
    'sell',
    'Sell a sack',
    'granary',
    'stalls',
    () => handlers.change((plan) => ({ ...plan, grain: plan.grain - SACK })),
    `Drag from the granary to the merchants’ stalls to sell ${formatNumber(SACK)} bushels`,
  );
  const buySack = sack(
    'buy',
    'Buy a sack',
    'stalls',
    'granary',
    () => handlers.change((plan) => ({ ...plan, grain: plan.grain + SACK })),
    `Drag from the stalls to the granary to buy ${formatNumber(SACK)} bushels`,
  );
  const giveSack = sack(
    'give',
    'Give a sack',
    'granary',
    'piazza',
    () => handlers.change((plan) => ({ ...plan, release: plan.release + SACK })),
    `Drag from the granary to the piazza to release ${formatNumber(SACK)} more bushels`,
  );
  const keepSack = sack(
    'keep',
    'Keep a sack',
    'piazza',
    'granary',
    () => handlers.change((plan) => ({ ...plan, release: plan.release - SACK })),
    `Drag from the piazza back to the granary to release ${formatNumber(SACK)} fewer bushels`,
  );
  const granaryTarget = target('granary', 'Granary');
  const stallsTarget = target('stalls', 'Merchants’ stalls');
  const piazzaTarget = target('piazza', 'Piazza');

  // ---- the wall line ----------------------------------------------------------------------------

  const wallHandle = el(
    'button',
    {
      type: 'button',
      role: 'slider',
      class: 'cf-wall-handle',
      'aria-label': 'The line of the walls: drag outward or press Down to buy land, Up to sell',
    },
    el('span', { class: 'cf-wall-handle__grip', 'aria-hidden': 'true' }),
    el('span', { class: 'cf-wall-handle__label' }),
  );
  wallHandle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || !current) return;
    event.preventDefault();
    wallHandle.setPointerCapture(event.pointerId);
    const startY = event.clientY;
    const startLand = current.plan.land;
    const move = (e: PointerEvent): void => {
      // Down the picture is toward the viewer: outward from the southern wall.
      const hectares = Math.round(((e.clientY - startY) * HECTARES_PER_PIXEL) / 50) * 50;
      handlers.change((plan) => ({ ...plan, land: startLand + hectares }));
    };
    const up = (): void => {
      wallHandle.removeEventListener('pointermove', move);
      wallHandle.removeEventListener('pointerup', up);
    };
    wallHandle.addEventListener('pointermove', move);
    wallHandle.addEventListener('pointerup', up);
  });
  wallHandle.addEventListener('keydown', (event) => {
    const step = event.shiftKey ? 500 : 50;
    const delta =
      event.key === 'ArrowDown' || event.key === 'ArrowRight'
        ? step
        : event.key === 'ArrowUp' || event.key === 'ArrowLeft'
          ? -step
          : 0;
    if (delta === 0) return;
    event.preventDefault();
    handlers.change((plan) => ({ ...plan, land: plan.land + delta }));
  });

  // ---- the taxes in the streets -------------------------------------------------------------------

  const gates = [0, 1, 2].map((i) =>
    el(
      'span',
      { class: 'cf-gate', 'aria-hidden': 'true', 'data-gate': i },
      el('span', { class: 'cf-gate__queue' }),
    ),
  );
  const bench = el('span', { class: 'cf-bench', 'aria-hidden': 'true' });
  const carts = el('span', { class: 'cf-carts', 'aria-hidden': 'true' });

  // ---- plots for the builders -------------------------------------------------------------------------

  const plots = BUILD_ITEMS.map((item) => {
    const node = el(
      'button',
      {
        type: 'button',
        class: 'cf-plot',
        'data-plot': item.key,
        'aria-label': `Plot for a ${item.name.toLowerCase()}: Enter places one`,
      },
      svgNode(buildIcon(item.key)),
    );
    node.addEventListener('click', () => build(item.key, node));
    node.addEventListener('dragover', (event) => {
      if (!event.dataTransfer?.types.includes('text/x-cf-build')) return;
      event.preventDefault();
      node.toggleAttribute('data-hot', true);
    });
    node.addEventListener('dragleave', () => node.removeAttribute('data-hot'));
    node.addEventListener('drop', (event) => {
      event.preventDefault();
      node.removeAttribute('data-hot');
      const kind = event.dataTransfer?.getData('text/x-cf-build');
      if (kind === item.key) build(item.key, node);
      else {
        handlers.refuse();
        shake(node);
      }
    });
    node.addEventListener('keydown', (event) => {
      const index = plots.findIndex((p) => p.node === node);
      const delta =
        event.key === 'ArrowRight' || event.key === 'ArrowDown'
          ? 1
          : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
            ? -1
            : 0;
      if (delta === 0) return;
      event.preventDefault();
      plots[(index + delta + plots.length) % plots.length]?.node.focus();
    });
    return { key: item.key, node };
  });

  function build(kind: BuildKind, node: HTMLElement): void {
    handlers.change((plan) => ({
      ...plan,
      build: { ...plan.build, [kind]: plan.build[kind] + 1 },
    }));
    handlers.placed(kind);
    node.animate(
      [
        { transform: 'translate(-50%, -50%) scale(1.25)' },
        { transform: 'translate(-50%, -50%) scale(1)' },
      ],
      {
        duration: 260,
      },
    );
  }

  function shake(node: HTMLElement): void {
    node.animate(
      [
        { translate: '0 0' },
        { translate: '-6px 0' },
        { translate: '6px 0' },
        { translate: '-3px 0' },
        { translate: '0 0' },
      ],
      { duration: 280 },
    );
  }

  layer.append(
    granaryTarget,
    stallsTarget,
    piazzaTarget,
    sellSack.node,
    buySack.node,
    giveSack.node,
    keepSack.node,
    wallHandle,
    ...gates,
    bench,
    carts,
    ...plots.map((p) => p.node),
  );

  // ---- placing everything, every frame ------------------------------------------------------------------

  function layout(): void {
    const a = anchors();
    const at = (node: HTMLElement, name: string, dx = 0, dz = 0): void => {
      const point = a[name];
      if (point) place(node, { x: point.x + dx, y: point.y, z: point.z + dz });
    };
    at(granaryTarget, 'granary');
    at(stallsTarget, 'stalls');
    at(piazzaTarget, 'piazza');
    // Each sack waits inside the ring of the place it comes from, clear of that ring's name.
    at(sellSack.node, 'granary');
    at(buySack.node, 'stalls');
    at(giveSack.node, 'granary');
    at(keepSack.node, 'piazza');
    at(wallHandle, 'wall');
    gates.forEach((gate, i) => at(gate, `gate${i}`));
    at(bench, 'bench');
    at(carts, 'gate0', 6, 6);
    for (const plot of plots) at(plot.node, plot.key);
  }
  const stopFrames = view.onFrame(layout);

  return {
    update(next) {
      current = next;
      layer.dataset.step = next.step;
      const { plan, realm } = next;
      sellSack.node.toggleAttribute('disabled', realm.grain + plan.grain - SACK < 0);
      buySack.node.toggleAttribute('disabled', false);
      const { least, most } = next.projection.release;
      giveSack.node.toggleAttribute('disabled', plan.release + SACK > most);
      keepSack.node.toggleAttribute('disabled', plan.release - SACK < least);
      const label = wallHandle.querySelector('.cf-wall-handle__label');
      if (label) {
        label.textContent =
          plan.land === 0
            ? `${formatNumber(realm.land)} ha`
            : `${plan.land > 0 ? '+' : '−'}${formatNumber(Math.abs(plan.land))} ha`;
      }
      wallHandle.setAttribute('aria-valuenow', String(realm.land + plan.land));
      wallHandle.setAttribute(
        'aria-valuetext',
        `${formatNumber(realm.land + plan.land)} hectares after the trade`,
      );
      const rates = [plan.customs, plan.sales, plan.wealth];
      gates.forEach((gate, i) => {
        const queue = gate.firstElementChild as HTMLElement | null;
        // The queue at each gate lengthens with customs; the other two taxes slow the eastern and western gates.
        const share = i === 0 ? (rates[0] ?? 0) : (rates[i] ?? 0) * 2;
        if (queue) queue.style.setProperty('--queue', String(Math.min(10, Math.round(share / 10))));
      });
      bench.dataset.justice = String(plan.justice);
      carts.toggleAttribute('data-show', plan.justice >= 3);
      for (const plot of plots) {
        const item = BUILD_ITEMS.find((i) => i.key === plot.key);
        plot.node.dataset.count = String(plan.build[plot.key]);
        plot.node.title = item ? `${item.name} · ${formatNumber(item.cost)} fl` : '';
      }
      layout();
    },
    pickPlot(kind) {
      const plot = plots.find((p) => p.key === kind) ?? plots[0];
      plot?.node.focus();
    },
    dispose() {
      stopFrames();
      layer.remove();
    },
  };
}

const SACK_SVG =
  '<svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true"><path d="M10 9C8 7 9 4 12 5L16 7L20 5C23 4 24 7 22 9C26 12 28 17 27 22C26 27 22 29 16 29C10 29 6 27 5 22C4 17 6 12 10 9Z" fill="#d9b779" stroke="#4a3220" stroke-width="1.4" stroke-linejoin="round"/><path d="M10 9C13 10.5 19 10.5 22 9" fill="none" stroke="#4a3220" stroke-width="1.4"/><path d="M12 17H20M12 21H18" stroke="#8a6238" stroke-width="1.2" stroke-linecap="round"/></svg>';
