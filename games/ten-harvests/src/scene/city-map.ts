/**
 * The city as a map, drawn with Canvas 2D: the Hall's demo when WebGL would
 * run on the CPU (see gpu.ts). It is the same chart as the diorama, seen from
 * above and drawn in a few lines: one plot for every ten acres the city owns,
 * the sown ones tinted with grain, the river, the houses, the ziggurat, and
 * the granary filled in proportion to the store. It costs a few milliseconds
 * a draw and compiles nothing.
 */
import type { DemoPalette } from '@one-more-year/kit';
import { GRANARY_CAPACITY } from './granary.ts';
import {
  cityLayout,
  parcelsForAcres,
  RIVER_WIDTH,
  riverPath,
  windowsForPeople,
  type CityLayout,
} from './layout.ts';

export interface MapValues {
  people: number;
  grain: number;
  acres: number;
  planted: number;
  /** 0 bare → 1 ripe: how far this year's fields have grown. */
  season: number;
}

export interface CityMap {
  readonly canvas: HTMLCanvasElement;
  draw(values: MapValues): void;
  setPalette(palette: DemoPalette): void;
  dispose(): void;
}

/** How much of the plain the map shows: the city and the nearer fields. */
const SHOWN_PARCELS = 170;
const MARGIN = 6;

interface Bounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

function boundsOf(layout: CityLayout): Bounds {
  const xs: number[] = [];
  const zs: number[] = [];
  for (const parcel of layout.parcels.slice(0, SHOWN_PARCELS)) {
    xs.push(parcel.x - parcel.width / 2, parcel.x + parcel.width / 2);
    zs.push(parcel.z - parcel.depth / 2, parcel.z + parcel.depth / 2);
  }
  for (const house of layout.houses) {
    xs.push(house.x);
    zs.push(house.z);
  }
  const { granary, ziggurat } = layout;
  xs.push(granary.x, ziggurat.x);
  zs.push(granary.z, ziggurat.z - ziggurat.base);
  return {
    minX: Math.min(...xs) - MARGIN,
    maxX: Math.max(...xs) + MARGIN,
    minZ: Math.min(...zs) - MARGIN - RIVER_WIDTH,
    maxZ: Math.max(...zs) + MARGIN,
  };
}

export function createCityMap(host: HTMLElement, palette: DemoPalette): CityMap {
  const layout = cityLayout();
  const bounds = boundsOf(layout);
  const canvas = document.createElement('canvas');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Ten Harvests, playing by itself: a map of the city');
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  host.append(canvas);
  const context = canvas.getContext('2d');
  let colours = palette;
  let last: MapValues | null = null;

  function render(): void {
    if (!context || !last) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(host.clientWidth * ratio));
    const height = Math.max(1, Math.round(host.clientHeight * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    // Fit the shown area into the canvas, centred, keeping its proportions.
    const spanX = bounds.maxX - bounds.minX;
    const spanZ = bounds.maxZ - bounds.minZ;
    const scale = Math.min(width / spanX, height / spanZ);
    const offsetX = (width - spanX * scale) / 2 - bounds.minX * scale;
    const offsetZ = (height - spanZ * scale) / 2 - bounds.minZ * scale;
    const px = (x: number): number => offsetX + x * scale;
    const pz = (z: number): number => offsetZ + z * scale;
    const line = Math.max(1, ratio);

    context.fillStyle = colours.paper;
    context.fillRect(0, 0, width, height);

    // The river.
    context.strokeStyle = colours.line;
    context.globalAlpha = 0.22;
    context.lineWidth = RIVER_WIDTH * scale;
    context.lineCap = 'round';
    context.beginPath();
    riverPath(bounds.minX - 20, bounds.maxX + 20, 4).forEach((point, i) => {
      if (i === 0) context.moveTo(px(point.x), pz(point.z));
      else context.lineTo(px(point.x), pz(point.z));
    });
    context.stroke();
    context.globalAlpha = 1;

    // The fields: owned plots outlined, sown ones tinted as the grain ripens.
    const total = layout.parcels.length;
    const owned = parcelsForAcres(last.acres, total);
    const sown = Math.min(owned, parcelsForAcres(last.planted, total));
    context.lineWidth = line;
    context.strokeStyle = colours.ink;
    for (const parcel of layout.parcels.slice(0, owned)) {
      const x = px(parcel.x - parcel.width / 2);
      const z = pz(parcel.z - parcel.depth / 2);
      const w = parcel.width * scale;
      const d = parcel.depth * scale;
      if (parcel.index < sown) {
        context.fillStyle = colours.accent;
        context.globalAlpha = 0.15 + 0.4 * Math.max(0, Math.min(1, last.season));
        context.fillRect(x, z, w, d);
        context.globalAlpha = 1;
      }
      context.strokeRect(x + line / 2, z + line / 2, w - line, d - line);
    }

    // The houses: as many lit (filled) as there are tens of people.
    const lit = windowsForPeople(last.people, layout.houses.length);
    layout.houses.forEach((house, i) => {
      context.save();
      context.translate(px(house.x), pz(house.z));
      context.rotate(-house.turn);
      const w = house.width * scale;
      const d = house.depth * scale;
      context.fillStyle = i < lit ? colours.muted : colours.paper;
      context.fillRect(-w / 2, -d / 2, w, d);
      context.strokeStyle = colours.ink;
      context.lineWidth = line;
      context.strokeRect(-w / 2, -d / 2, w, d);
      context.restore();
    });

    // The ziggurat: three terraces seen from above.
    const { ziggurat, granary } = layout;
    context.strokeStyle = colours.ink;
    for (const share of [1, 0.66, 0.36]) {
      const half = (ziggurat.base * share * scale) / 2;
      context.strokeRect(px(ziggurat.x) - half, pz(ziggurat.z) - half, half * 2, half * 2);
    }

    // The granary, filled from the front in proportion to the store.
    const gx = px(granary.x - granary.width / 2);
    const gz = pz(granary.z - granary.depth / 2);
    const gw = granary.width * scale;
    const gd = granary.depth * scale;
    const fill = Math.max(0, Math.min(1, last.grain / GRANARY_CAPACITY));
    context.fillStyle = colours.paper;
    context.fillRect(gx, gz, gw, gd);
    context.fillStyle = colours.accent;
    context.fillRect(gx, gz + gd * (1 - fill), gw, gd * fill);
    context.lineWidth = line * 1.5;
    context.strokeRect(gx, gz, gw, gd);
  }

  const resize = new ResizeObserver(() => {
    render();
  });
  resize.observe(host);

  return {
    canvas,
    draw(values) {
      last = values;
      render();
    },
    setPalette(next) {
      colours = next;
      render();
    },
    dispose() {
      resize.disconnect();
      canvas.remove();
    },
  };
}
