/**
 * Pond's picture: the pond drawn in SVG, in whichever of the three styles
 * the Hall asks for. The Almanac wants an engraving (ink hatching on paper),
 * the Situation Room an instrument (a clean schematic cross-section), the
 * Terrarium a diorama (a small coloured world). The same scene is used by
 * the demo and by the play screens.
 *
 * Fish and weed are kept as elements keyed by index, so a new year adds or
 * removes a few of them instead of redrawing everything; gentle CSS
 * animations (in pond.css) let fish drift and weed sway, and stop under
 * reduced motion.
 */
import type { DemoLook, DemoStyle } from '@one-more-year/kit';
import type { Weather } from './model.ts';

export interface SceneValues {
  fish: number;
  /** 0–100 % cover. */
  weed: number;
  weather: Weather | null;
}

export interface PondScene {
  readonly element: SVGSVGElement;
  update(values: SceneValues): void;
  setLook(look: DemoLook): void;
  dispose(): void;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const WIDTH = 320;
const HEIGHT = 200;
const MAX_FISH_DRAWN = 26;
const MAX_WEED_DRAWN = 24;
let sceneCount = 0;

/** The pond's outline, shared by the water fill, the hatching clip and the bank. */
const POND_SHAPE =
  'M28 124C34 98 104 86 160 88C222 90 288 98 294 124C300 152 248 174 168 176C92 178 20 160 28 124Z';
const FISH_SHAPE = 'M0 0C4-4 10-4 14 0C10 4 4 4 0 0ZM13.5 0L18.5-3.5V3.5Z';

function make<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attributes: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
  return element;
}

/** A stable scatter: the same fish always swims in the same part of the pond. */
function spot(index: number, salt: number): number {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

export function createPondScene(host: HTMLElement, look: DemoLook, label: string): PondScene {
  const id = `pond-scene-${++sceneCount}`;
  const svg = make('svg', {
    viewBox: `0 0 ${WIDTH} ${HEIGHT}`,
    role: 'img',
    'aria-label': label,
    class: 'pond-scene',
  });
  const backdrop = make('g', { class: 'pond-scene__backdrop' });
  const weedLayer = make('g', { class: 'pond-scene__weed', 'clip-path': `url(#${id}-clip)` });
  const fishLayer = make('g', { class: 'pond-scene__fish', 'clip-path': `url(#${id}-clip)` });
  const foreground = make('g', { class: 'pond-scene__foreground' });
  const sky = make('g', { class: 'pond-scene__sky' });
  svg.append(backdrop, weedLayer, fishLayer, foreground, sky);
  host.append(svg);

  let current: SceneValues = { fish: 0, weed: 0, weather: null };
  let style: DemoStyle = look.style;

  function paintBackdrop(next: DemoLook): void {
    style = next.style;
    const p = next.palette;
    svg.dataset.style = style;
    svg.dataset.appearance = next.appearance;
    svg.classList.toggle('pond-scene--still', next.reducedMotion);
    svg.style.setProperty('--ink', p.ink);
    svg.style.setProperty('--accent', p.accent);
    svg.style.setProperty('--muted', p.muted);
    svg.style.setProperty('--line', p.line);
    svg.style.setProperty('--glow', p.glow);
    svg.style.setProperty('--paper', p.paper);
    svg.style.setProperty('--good', p.good);
    svg.style.setProperty('--warning', p.warning);
    backdrop.replaceChildren();
    foreground.replaceChildren();

    const defs = make('defs');
    const clip = make('clipPath', { id: `${id}-clip` });
    clip.append(make('path', { d: style === 'instrument' ? 'M40 70H280V176H40Z' : POND_SHAPE }));
    defs.append(clip);
    backdrop.append(defs);

    if (style === 'engraving') {
      // An engraver's landscape behind the pond: sky ruled in fine lines, a far
      // line of hills shaded with diagonal strokes, and a copse of trees.
      const diagonal = make('pattern', {
        id: `${id}-diagonal`,
        width: 4,
        height: 4,
        patternUnits: 'userSpaceOnUse',
        patternTransform: 'rotate(35)',
      });
      diagonal.append(
        make('path', { d: 'M0 2H4', stroke: p.ink, 'stroke-width': 0.6, opacity: 0.45 }),
      );
      defs.append(diagonal);
      const sky = make('g', { stroke: p.ink, 'stroke-width': 0.5, opacity: 0.35 });
      for (let y = 14; y < 66; y += 6) {
        const inset = (y - 14) * 0.9;
        sky.append(
          make('path', {
            d: `M${18 + inset} ${y}H${140 - inset * 1.3}M${190 + inset} ${y}H${302 - inset}`,
          }),
        );
      }
      const hills = 'M8 96C40 78 78 80 112 88C146 96 182 70 226 72C262 74 290 86 312 84';
      backdrop.append(
        sky,
        make('path', { d: `${hills}L312 112L8 112Z`, fill: `url(#${id}-diagonal)` }),
        make('path', { d: hills, fill: 'none', stroke: p.ink, 'stroke-width': 1 }),
        ...[52, 66, 78].map((x, i) => {
          const tree = make('g', { stroke: p.ink, 'stroke-width': 0.9, fill: p.paper });
          const top = 62 + i * 3;
          tree.append(
            make('path', { d: `M${x} ${top + 22}V${top + 10}` }),
            make('path', {
              d: `M${x - 8} ${top + 12}C${x - 10} ${top + 2} ${x - 2} ${top - 4} ${x + 3} ${top + 1}C${x + 10} ${top} ${x + 11} ${top + 10} ${x + 6} ${top + 13}C${x + 2} ${top + 16} ${x - 6} ${top + 16} ${x - 8} ${top + 12}Z`,
            }),
          );
          return tree;
        }),
      );
      const hatch = make('pattern', {
        id: `${id}-hatch`,
        width: 6,
        height: 5,
        patternUnits: 'userSpaceOnUse',
      });
      hatch.append(
        make('path', { d: 'M0 2.5H6', stroke: p.ink, 'stroke-width': 0.55, opacity: 0.55 }),
      );
      defs.append(hatch);
      backdrop.append(
        // Paper first, so the hills' hatching stops at the water's edge.
        make('path', { d: POND_SHAPE, fill: p.paper }),
        make('path', { d: POND_SHAPE, fill: `url(#${id}-hatch)` }),
        make('path', { d: POND_SHAPE, fill: 'none', stroke: p.ink, 'stroke-width': 1.4 }),
        // Ink strokes of the bank: short dashes that suggest grass without filling it.
        ...Array.from({ length: 34 }, (_, i) => {
          const x = 16 + i * 8.8;
          const y = 86 + Math.sin(i * 0.9) * 4 - (i % 3) * 2;
          return make('path', {
            d: `M${x} ${y}l${2 - (i % 4)} -${5 + (i % 3) * 2}`,
            stroke: p.ink,
            'stroke-width': 0.8,
            'stroke-linecap': 'round',
          });
        }),
      );
      foreground.append(...reeds(p.ink, 0.9));
    } else if (style === 'instrument') {
      const grid = make('g', { stroke: p.muted, 'stroke-width': 0.5, opacity: 0.35 });
      for (let x = 40; x <= 280; x += 24) grid.append(make('path', { d: `M${x} 60V176` }));
      for (let y = 70; y <= 176; y += 21.2) grid.append(make('path', { d: `M40 ${y}H280` }));
      backdrop.append(
        make('rect', { x: 40, y: 70, width: 240, height: 106, fill: p.glow, opacity: 0.16, rx: 3 }),
        grid,
        make('rect', {
          x: 40,
          y: 70,
          width: 240,
          height: 106,
          fill: 'none',
          stroke: p.line,
          'stroke-width': 1.2,
          rx: 3,
        }),
      );
      foreground.append(
        make('path', { d: 'M40 182H280', stroke: p.muted, 'stroke-width': 1 }),
        ...[40, 100, 160, 220, 280].map((x) =>
          make('path', { d: `M${x} 180V185`, stroke: p.muted }),
        ),
      );
    } else {
      const gradient = make('linearGradient', { id: `${id}-water`, x1: 0, y1: 0, x2: 0, y2: 1 });
      gradient.append(
        make('stop', { offset: 0, 'stop-color': p.glow }),
        make('stop', { offset: 1, 'stop-color': p.accent }),
      );
      defs.append(gradient);
      backdrop.append(
        make('ellipse', { cx: 160, cy: 132, rx: 158, ry: 62, fill: p.good, opacity: 0.85 }),
        make('path', { d: POND_SHAPE, fill: `url(#${id}-water)` }),
        make('path', {
          d: POND_SHAPE,
          fill: 'none',
          stroke: p.paper,
          'stroke-width': 2.5,
          opacity: 0.55,
        }),
      );
      foreground.append(
        make('ellipse', { cx: 92, cy: 112, rx: 13, ry: 4.5, fill: p.good }),
        make('ellipse', { cx: 236, cy: 150, rx: 11, ry: 4, fill: p.good }),
        make('circle', { cx: 238, cy: 148, r: 2.6, fill: p.warning }),
        ...reeds(p.good, 2.2),
      );
    }
  }

  function reeds(colour: string, width: number): SVGElement[] {
    return [18, 26, 33, 286, 294, 300].map((x, i) => {
      const group = make('g', { class: 'pond-scene__reed', style: `--sway-delay:${-i * 0.7}s` });
      const top = 70 + (i % 3) * 7;
      group.append(
        make('path', {
          d: `M${x} 136Q${x - 2} ${top + 30} ${x + 1} ${top}`,
          stroke: colour,
          'stroke-width': width,
          fill: 'none',
          'stroke-linecap': 'round',
        }),
        make('rect', { x: x - 1.6, y: top - 2, width: 3.6, height: 11, rx: 1.8, fill: colour }),
      );
      return group;
    });
  }

  function syncFish(count: number): void {
    const drawn = Math.min(MAX_FISH_DRAWN, Math.ceil(count / 8));
    while (fishLayer.childElementCount > drawn) fishLayer.lastElementChild?.remove();
    for (let i = fishLayer.childElementCount; i < drawn; i++) {
      const x = 60 + spot(i, 1) * 190;
      const y = style === 'instrument' ? 88 + spot(i, 2) * 76 : 104 + spot(i, 2) * 56;
      const swim = make('g', {
        class: 'pond-scene__swimmer',
        style: `--swim-duration:${7 + spot(i, 3) * 9}s;--swim-delay:${-spot(i, 4) * 10}s`,
      });
      const facing = spot(i, 5) > 0.5 ? 1 : -1;
      const scale = 0.7 + spot(i, 6) * 0.5;
      swim.append(
        make('path', {
          d: FISH_SHAPE,
          class: 'pond-scene__body',
          transform: `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${(facing * scale).toFixed(2)} ${scale.toFixed(2)})`,
        }),
      );
      fishLayer.append(swim);
    }
  }

  function syncWeed(cover: number): void {
    const drawn = Math.round((cover / 100) * MAX_WEED_DRAWN);
    while (weedLayer.childElementCount > drawn) weedLayer.lastElementChild?.remove();
    for (let i = weedLayer.childElementCount; i < drawn; i++) {
      const x = 46 + spot(i, 7) * 228;
      const base = style === 'instrument' ? 176 : 168 - Math.abs(x - 160) * 0.12;
      const height = 26 + spot(i, 8) * 40;
      const bend = (spot(i, 9) - 0.5) * 16;
      weedLayer.append(
        make('path', {
          class: 'pond-scene__strand',
          d: `M${x.toFixed(1)} ${base.toFixed(1)}q${bend.toFixed(1)} ${(-height / 2).toFixed(1)} 0 ${(-height).toFixed(1)}`,
          style: `--sway-delay:${(-spot(i, 10) * 6).toFixed(2)}s`,
        }),
      );
    }
  }

  function paintSky(weather: Weather | null): void {
    sky.replaceChildren();
    if (!weather) return;
    sky.dataset.weather = weather;
    if (weather === 'rainy') {
      for (let i = 0; i < 9; i++) {
        const x = 214 + i * 9;
        sky.append(
          make('path', { d: `M${x} ${18 + (i % 3) * 6}l-4 12`, class: 'pond-scene__rain' }),
        );
      }
      sky.append(
        make('path', {
          d: 'M206 20q6-12 20-8q8-10 22-2q14-2 16 10q10 4 4 12H210q-10-2-4-12Z',
          class: 'pond-scene__cloud',
        }),
      );
    } else {
      const rays = weather === 'dry' ? 12 : 8;
      sky.append(
        make('circle', {
          cx: 270,
          cy: 30,
          r: weather === 'dry' ? 13 : 10,
          class: 'pond-scene__sun',
        }),
      );
      for (let i = 0; i < rays; i++) {
        const angle = (i / rays) * Math.PI * 2;
        const inner = weather === 'dry' ? 18 : 15;
        sky.append(
          make('path', {
            d: `M${(270 + Math.cos(angle) * inner).toFixed(1)} ${(30 + Math.sin(angle) * inner).toFixed(1)}L${(270 + Math.cos(angle) * (inner + 6)).toFixed(1)} ${(30 + Math.sin(angle) * (inner + 6)).toFixed(1)}`,
            class: 'pond-scene__ray',
          }),
        );
      }
    }
  }

  paintBackdrop(look);

  return {
    element: svg,
    update(values) {
      current = values;
      syncFish(values.fish);
      syncWeed(values.weed);
      paintSky(values.weather);
    },
    setLook(next) {
      const restyle = next.style !== style;
      paintBackdrop(next);
      if (restyle) {
        fishLayer.replaceChildren();
        weedLayer.replaceChildren();
      }
      syncFish(current.fish);
      syncWeed(current.weed);
      paintSky(current.weather);
    },
    dispose() {
      svg.remove();
    },
  };
}
