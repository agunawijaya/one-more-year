/**
 * The valley as a drawn map in SVG, in the Hall theme's own colours: the
 * river, the roads, every city as a walled ring sized by its land, its
 * banner on a pole that rises with its title points, and armies on the march
 * as dashed lines. The Hall's engraved and instrument demo styles use it,
 * and so does any browser where WebGL would run on the CPU.
 */
import type { DemoPalette } from '@one-more-year/kit';
import type { BetweenNote, Realm } from '../engine/state.ts';
import { armsSvg } from '../ui/heraldry-svg.ts';
import { CITY_SITES } from './valley.ts';
import { wallRadiusFor } from './layout.ts';

export interface ValleyMap {
  draw(realms: readonly Realm[], notes: readonly BetweenNote[], progress: number): void;
  setPalette(palette: DemoPalette): void;
  dispose(): void;
}

/** The map's frame, in valley units: the sites lie within ±170 across and ±120 deep. */
const VIEW = { x: -210, y: -150, width: 420, height: 300 };

export function createValleyMap(host: HTMLElement, palette: DemoPalette): ValleyMap {
  let colours = palette;
  const holder = document.createElement('div');
  holder.style.cssText = 'position:absolute;inset:0;display:grid;place-items:stretch;';
  holder.setAttribute('role', 'img');
  holder.setAttribute('aria-label', 'The valley of city-states, drawn as a map');
  host.append(holder);
  let last: { realms: readonly Realm[]; notes: readonly BetweenNote[]; progress: number } | null =
    null;

  function draw(realms: readonly Realm[], notes: readonly BetweenNote[], progress: number): void {
    last = { realms, notes, progress };
    const river = Array.from({ length: 24 }, (_, i) => {
      const t = i / 23;
      return `${(-20 + Math.sin(t * 6.1) * 34 + Math.sin(t * 15) * 6).toFixed(1)},${(-150 + t * 300).toFixed(1)}`;
    }).join(' ');
    const roads = realms
      .map((realm, i) => {
        const a = CITY_SITES[realm.seat];
        const next = realms[(i + 1) % realms.length];
        const b = next ? CITY_SITES[next.seat] : undefined;
        return a && b
          ? `<path d="M${a.x} ${a.z}L${b.x} ${b.z}" stroke="${colours.line}" stroke-width="1.2" stroke-dasharray="3 3" fill="none"/>`
          : '';
      })
      .join('');
    const marches = notes
      .filter((n) => n.kind === 'invaded' && (n.numbers.by ?? -1) >= 0)
      .map((n) => {
        const a = CITY_SITES[n.numbers.by ?? 0];
        const b = CITY_SITES[n.seat];
        if (!a || !b) return '';
        const x = a.x + (b.x - a.x) * progress;
        const z = a.z + (b.z - a.z) * progress;
        return `<path d="M${a.x} ${a.z}L${x.toFixed(1)} ${z.toFixed(1)}" stroke="${colours.disaster}" stroke-width="2.4" stroke-dasharray="5 3" fill="none"/><circle cx="${x.toFixed(1)}" cy="${z.toFixed(1)}" r="3.4" fill="${colours.disaster}"/>`;
      })
      .join('');
    const cities = realms
      .map((realm) => {
        const site = CITY_SITES[realm.seat] ?? { x: 0, z: 0 };
        const radius = wallRadiusFor(realm.land) * 0.32;
        const points = realm.pointsHistory.at(-1) ?? 2;
        const pole = 14 + points * 0.55;
        const shield = armsSvg(realm.arms, { width: 14, outline: colours.ink }).replace(
          '<svg ',
          `<svg x="${site.x + 2}" y="${site.z - pole}" `,
        );
        return (
          `<circle cx="${site.x}" cy="${site.z}" r="${radius.toFixed(1)}" fill="${colours.paper}" stroke="${colours.ink}" stroke-width="1.6"/>` +
          `<circle cx="${site.x}" cy="${site.z}" r="${(radius * 0.55).toFixed(1)}" fill="none" stroke="${colours.muted}" stroke-width="0.8"/>` +
          `<path d="M${site.x} ${site.z}V${site.z - pole}" stroke="${colours.ink}" stroke-width="1"/>` +
          shield +
          `<text x="${site.x}" y="${site.z + radius + 11}" text-anchor="middle" font-size="9" fill="${colours.ink}" style="font-family:inherit;letter-spacing:.08em">${realm.city.toUpperCase()}</text>`
        );
      })
      .join('');
    holder.innerHTML =
      `<svg viewBox="${VIEW.x} ${VIEW.y} ${VIEW.width} ${VIEW.height}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%;background:${colours.paper}" aria-hidden="true">` +
      `<polyline points="${river}" fill="none" stroke="${colours.accent}" stroke-width="5" stroke-linecap="round" opacity="0.55"/>` +
      roads +
      marches +
      cities +
      `</svg>`;
  }

  return {
    draw,
    setPalette(next) {
      colours = next;
      if (last) draw(last.realms, last.notes, last.progress);
    },
    dispose() {
      holder.remove();
    },
  };
}
