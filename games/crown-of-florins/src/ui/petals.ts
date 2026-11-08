/**
 * Petals falling over the coronation, drawn in SVG over the gilded fresco
 * so they keep their colour against the gold: single rose petals (a broad
 * cupped blade with a shallow notch, narrowing to its heel) and now and
 * then a whole five-petalled blossom, in vermilion, rose and white.
 *
 * Each one falls and sways at its own pace and tumbles as it goes: it
 * turns edge-on and over (a squash and a flip of its width), and the sheen
 * on its face brightens each time it turns full to the light. Under reduced
 * motion they lie still where they were.
 */
import { createRng, type Rng } from '@one-more-year/kit';

const NS = 'http://www.w3.org/2000/svg';

// A rose petal: broad and notched at the top, cupped, narrowing to the heel where it held the flower.
const PETAL =
  'M0 7C-3.6 5.4 -6 1.8 -5.6 -2.2C-5.3 -5 -3.4 -6.6 -1.4 -6.4C-0.6 -6.3 -0.2 -5.7 0 -5.2C0.3 -5.8 0.9 -6.4 1.8 -6.4C3.9 -6.3 5.6 -4.6 5.6 -1.8C5.6 2 3.4 5.4 0 7Z';
// The cup's crease and the light on its curve.
const VEIN = 'M0 6C-0.4 2.5 -0.3 -1.5 0 -5';
const SHEEN =
  'M-3.6 -2.6C-3 -4.4 -1.6 -5.2 -0.8 -4.8C-1.9 -3.6 -2.6 -1.4 -2.6 0.8C-3.4 0.2 -3.8 -1.2 -3.6 -2.6Z';
// One petal of a blossom, its heel at the flower's heart.
const BLOSSOM_PETAL =
  'M0 0C-2.8 -1.6 -3.6 -5 -2 -7.2C-1.2 -8.2 -0.4 -8.3 0 -7.6C0.4 -8.3 1.2 -8.2 2 -7.2C3.6 -5 2.8 -1.6 0 0Z';

interface Tint {
  fill: string;
  edge: string;
}

const PETAL_TINTS: readonly Tint[] = [
  { fill: '#c23a20', edge: '#7a1e10' },
  { fill: '#b3301e', edge: '#6a1a0e' },
  { fill: '#d9798a', edge: '#8e3a48' },
  { fill: '#e8a0a8', edge: '#9a4a56' },
  { fill: '#f2e8d8', edge: '#a08a6a' },
];

const BLOSSOM_TINTS: readonly Tint[] = [
  { fill: '#f4ecdf', edge: '#a08a6a' },
  { fill: '#e6a3ad', edge: '#9a4a56' },
  { fill: '#d4545a', edge: '#7a1e22' },
];

function node<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attributes: Record<string, string>,
): SVGElementTagNameMap[K] {
  const element = document.createElementNS(NS, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  return element;
}

function rosePetal(rng: Rng): SVGGElement {
  const tint = rng.pick(PETAL_TINTS);
  const g = node('g', {});
  g.append(
    node('path', {
      d: PETAL,
      fill: tint.fill,
      stroke: tint.edge,
      'stroke-width': '0.45',
      'stroke-opacity': '0.7',
    }),
    node('path', {
      d: VEIN,
      fill: 'none',
      stroke: tint.edge,
      'stroke-width': '0.4',
      'stroke-opacity': '0.45',
    }),
    node('path', { d: SHEEN, fill: '#ffffff', class: 'cf-petal__sheen' }),
  );
  return g;
}

function blossom(rng: Rng): SVGGElement {
  const tint = rng.pick(BLOSSOM_TINTS);
  const g = node('g', {});
  for (let i = 0; i < 5; i++) {
    g.append(
      node('path', {
        d: BLOSSOM_PETAL,
        fill: tint.fill,
        stroke: tint.edge,
        'stroke-width': '0.4',
        'stroke-opacity': '0.7',
        transform: `rotate(${i * 72})`,
      }),
    );
  }
  g.append(
    node('circle', { r: '1.7', fill: '#d6a43a', stroke: '#8a5a14', 'stroke-width': '0.4' }),
    node('circle', { r: '4.6', fill: '#ffffff', class: 'cf-petal__sheen' }),
  );
  return g;
}

export function createPetals(count: number, seed: number): SVGSVGElement {
  const rng = createRng(seed).fork('petals');
  const svg = node('svg', {
    class: 'cf-petals',
    'aria-hidden': 'true',
    viewBox: '0 0 1000 1000',
    preserveAspectRatio: 'xMidYMid slice',
  });
  for (let i = 0; i < count; i++) {
    const fall = node('g', { class: 'cf-petal' });
    fall.style.setProperty('--x', `${(rng.next() * 1000).toFixed(1)}px`);
    fall.style.setProperty('--sway', `${(20 + rng.next() * 40).toFixed(0)}px`);
    fall.style.setProperty('--drift', `${(rng.next() * 360).toFixed(0)}deg`);
    // Where it lies when nothing moves (reduced motion).
    fall.style.setProperty('--rest', `${(rng.next() * 1000).toFixed(1)}px`);
    fall.style.animationDuration = `${(7 + rng.next() * 6).toFixed(2)}s`;
    fall.style.animationDelay = `${(-rng.next() * 12).toFixed(2)}s`;
    // The tumble: its own pace, so no two petals turn together.
    const tumble = node('g', { class: 'cf-petal__tumble' });
    const turn = `${(1.6 + rng.next() * 2.4).toFixed(2)}s`;
    tumble.style.animationDuration = turn;
    tumble.style.animationDelay = `${(-rng.next() * 3).toFixed(2)}s`;
    const shape = rng.next() < 0.28 ? blossom(rng) : rosePetal(rng);
    const scale = 0.7 + rng.next() * 0.7;
    shape.setAttribute('transform', `scale(${scale.toFixed(2)})`);
    for (const sheen of shape.querySelectorAll<SVGElement>('.cf-petal__sheen')) {
      sheen.style.animationDuration = turn;
      sheen.style.animationDelay = tumble.style.animationDelay;
    }
    tumble.append(shape);
    fall.append(tumble);
    svg.append(fall);
  }
  return svg;
}
