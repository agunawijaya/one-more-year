/**
 * The fresco is a chart: the city's plan is read back (no GPU needed) and
 * held to the realm's numbers.
 */
import { describe, expect, it } from 'vitest';
import { createQualityLadder, FRAME_BUDGET_MS, PROFILES } from '../src/scene/quality.ts';
import { PartsBuilder } from '../src/scene/parts.ts';
import { paletteFor } from '../src/scene/palette.ts';
import {
  bridgeSites,
  buildValleyLand,
  CITY_SITES,
  mapRadiusFor,
  RIVER,
  roadBetween,
} from '../src/scene/valley.ts';
import { cityHills, ridgeStartFor } from '../src/scene/terrain.ts';
import {
  CATHEDRAL_STAGES,
  crowdFor,
  drillersFor,
  guardTowerFor,
  planCity,
  wallPerimeter,
  type CityNumbers,
} from '../src/scene/layout.ts';

const base: CityNumbers = {
  town: 'Valdorsa',
  land: 10_000,
  serfs: 2000,
  soldiers: 25,
  merchants: 25,
  nobles: 4,
  clergy: 5,
  markets: 0,
  mills: 0,
  palace: 0,
  cathedral: 0,
  grain: 5000,
  worked: 10_000,
  weather: 3,
};

describe('the city shows the numbers', () => {
  it('pushes its walls out as the land grows, keeping the same shape', () => {
    const small = planCity({ ...base, land: 6000 });
    const large = planCity({ ...base, land: 60_000 });
    expect(wallPerimeter(large)).toBeGreaterThan(wallPerimeter(small) * 1.3);
    expect(large.wall).toHaveLength(small.wall.length);
  });

  it('lines the piazza with three stalls for each of the first four markets', () => {
    for (const markets of [0, 1, 4]) {
      expect(planCity({ ...base, markets }).stalls).toHaveLength(markets * 3);
    }
    expect(new Set(planCity({ ...base, markets: 7 }).stalls.map((s) => s.market)).size).toBe(7);
  });

  it('shows the cathedral at its stage and the palace in its pieces', () => {
    const plan = planCity({ ...base, cathedral: 4, palace: 7 });
    expect(plan.cathedralStage).toBe(4);
    expect(CATHEDRAL_STAGES[plan.cathedralStage - 1]).toBe('façade');
    expect(planCity({ ...base, cathedral: 9 }).cathedralAdornments).toBe(3);
    expect(plan.palacePieces).toBe(7);
  });

  it('turns a mill wheel for every mill, up to a dozen', () => {
    expect(planCity({ ...base, mills: 3 }).mills).toHaveLength(3);
    expect(planCity({ ...base, mills: 20 }).mills).toHaveLength(12);
  });

  it('crowds the piazza in proportion to the people, and drills a figure for every five soldiers', () => {
    expect(crowdFor(2059)).toBe(82);
    expect(crowdFor(100_000)).toBe(900);
    expect(drillersFor(75)).toBe(15);
  });

  it('stands the guard tower as the 1978 map did, and draws both its base and its top', () => {
    expect(guardTowerFor(10, 10_000)).toBe('none');
    expect(guardTowerFor(15, 10_000)).toBe('base');
    expect(guardTowerFor(20, 10_000)).toBe('full');
  });
});

describe('the quality ladder', () => {
  const run = (
    ladder: ReturnType<typeof createQualityLadder>,
    ms: number,
    seconds: number,
  ): void => {
    for (let t = 0; t < seconds * 1000; t += ms) ladder.frame(ms);
  };

  it('steps down when the frames run slow for two seconds, one level at a time', () => {
    // Half-speed frames: after the warm-up (half a second here) two slow seconds take it down.
    const ladder = createQualityLadder({ ceiling: 'high' });
    run(ladder, FRAME_BUDGET_MS * 2, 1.5);
    expect(ladder.level).toBe('high');
    run(ladder, FRAME_BUDGET_MS * 2, 2);
    expect(ladder.level).toBe('balanced');
    run(ladder, FRAME_BUDGET_MS * 2, 4);
    expect(ladder.level).toBe('light');
  });

  it('climbs back after comfortable frames, never above the player’s ceiling', () => {
    const ladder = createQualityLadder({ ceiling: 'balanced', start: 'light' });
    run(ladder, FRAME_BUDGET_MS * 0.5, 12);
    expect(ladder.level).toBe('balanced');
    run(ladder, FRAME_BUDGET_MS * 0.5, 12);
    expect(ladder.level).toBe('balanced');
  });

  it('paints less at each lower level: brushwork, shadows and crowds', () => {
    expect(PROFILES.light.postResolution).toBeLessThan(PROFILES.balanced.postResolution);
    expect(PROFILES.balanced.postResolution).toBeLessThan(PROFILES.high.postResolution);
    expect(PROFILES.light.shadowMap).toBeLessThan(PROFILES.high.shadowMap);
    expect(PROFILES.light.crowd).toBeLessThan(PROFILES.high.crowd);
  });
});

describe('the valley keeps clear of its towns', () => {
  // Six towns at a size no realm reaches in a normal reign, the hardest case.
  const footprints = CITY_SITES.map((site) => ({ site, radius: mapRadiusFor(80_000) }));

  it('builds no bridge, tree or farmstead inside any town’s walls', () => {
    for (const appearance of ['light', 'dark'] as const) {
      const parts = new PartsBuilder();
      buildValleyLand(parts, paletteFor(appearance), footprints);
      const position = parts.build().getAttribute('position');
      expect(position.count).toBeGreaterThan(0);
      for (let i = 0; i < position.count; i++) {
        const x = position.getX(i);
        const z = position.getZ(i);
        for (const { site, radius } of footprints) {
          expect(Math.hypot(x - site.x, z - site.z)).toBeGreaterThan(radius);
        }
      }
    }
  });

  it('runs the river between the towns, never through one, and bridges it out of town', () => {
    const distance = (p: { x: number; z: number }): number => {
      let best = Number.POSITIVE_INFINITY;
      for (let i = 0; i < RIVER.length - 1; i++) {
        const a = RIVER[i] as { x: number; z: number };
        const b = RIVER[i + 1] as { x: number; z: number };
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const t = Math.max(
          0,
          Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz)),
        );
        best = Math.min(best, Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t));
      }
      return best;
    };
    for (const { site, radius } of footprints) expect(distance(site)).toBeGreaterThan(radius + 6);
    const roads = CITY_SITES.map((site, i) =>
      roadBetween(site, CITY_SITES[(i + 1) % CITY_SITES.length] ?? site),
    );
    const bridges = bridgeSites(roads, footprints);
    expect(bridges.length).toBeGreaterThanOrEqual(2);
    for (const bridge of bridges) {
      for (const { site, radius } of footprints) {
        expect(Math.hypot(bridge.at.x - site.x, bridge.at.z - site.z)).toBeGreaterThan(radius + 10);
      }
    }
  });
});

describe('the hills', () => {
  it('are rounded cushions, each town’s its own, with no stepped terraces', () => {
    const ridge = ridgeStartFor(45);
    const a = cityHills('Valdorsa', ridge);
    const b = cityHills('Lucemara', ridge);
    expect(a.hills.map((h) => h.x)).not.toEqual(b.hills.map((h) => h.x));
    // Climbing into the hills the land never lies level for a stretch on the way up (a terrace's
    // tread), and never jumps (its riser).
    for (const x of [-120, -40, 30, 110]) {
      let flat = 0;
      let previous = a.heightAt(x, ridge);
      for (let z = ridge; z > ridge - 46; z -= 0.5) {
        const h = a.heightAt(x, z);
        flat = Math.abs(h - previous) < 1e-5 && h > 2 ? flat + 1 : 0;
        expect(flat).toBeLessThan(4);
        expect(Math.abs(h - previous)).toBeLessThan(3);
        previous = h;
      }
    }
  });
});
