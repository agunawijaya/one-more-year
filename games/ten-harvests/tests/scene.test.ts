/**
 * The diorama is a chart: one parcel for every ten acres, one lit window
 * for every ten people, the granary filled in proportion to the store.
 * These read the built scene back (no GPU needed) and hold it to that.
 */
import { describe, expect, it } from 'vitest';
import { createQualityLadder, FRAME_BUDGET_MS } from '../src/scene/quality.ts';
import { GRANARY_CAPACITY } from '../src/scene/granary.ts';
import { figuresForPeople, parcelsForAcres, windowsForPeople } from '../src/scene/layout.ts';
import { webglRunsOnCpu } from '../src/scene/gpu.ts';
import { createCityWorld } from '../src/scene/world.ts';

describe('the city shows the numbers', () => {
  // After dark, so the windows are lit; by day the same count shows as people in the fields.
  const world = createCityWorld('dark');
  const cases = [
    { people: 100, grain: 2800, acres: 1000 },
    { people: 37, grain: 120, acres: 410 },
    { people: 260, grain: 7400, acres: 2400 },
  ];

  for (const values of cases) {
    it(`at ${values.people} people, ${values.grain} bushels, ${values.acres} acres`, () => {
      world.show({ ...values, planted: 300, season: 1, yieldPerAcre: 3 });
      const parcels = world.layout.parcels.length;
      expect(world.owned()).toHaveLength(parcelsForAcres(values.acres, parcels));
      expect(world.owned()).toHaveLength(Math.min(parcels, Math.round(values.acres / 10)));
      expect(world.planted()).toHaveLength(parcelsForAcres(300, parcels));
      const windows = world.layout.windows.length;
      expect(world.city.litWindows).toBe(windowsForPeople(values.people, windows));
      expect(world.city.litWindows).toBe(Math.min(windows, Math.round(values.people / 10)));
      expect(world.figures.shown).toBe(figuresForPeople(values.people));
      expect(Math.abs(world.granary.fill - values.grain / GRANARY_CAPACITY)).toBeLessThan(0.01);
    });
  }

  it('has room for a large city before it stops counting', () => {
    expect(world.layout.parcels.length).toBeGreaterThanOrEqual(240);
    expect(world.layout.windows.length).toBeGreaterThanOrEqual(30);
  });
});

describe('the quality ladder', () => {
  it('steps down after slow frames, one level at a time, and only as far as light', () => {
    const ladder = createQualityLadder({ ceiling: 'high' });
    const levels: string[] = [];
    for (let i = 0; i < 400; i++) levels.push(ladder.frame(40));
    expect(levels).toContain('balanced');
    expect(ladder.level).toBe('light');
  });

  it('holds its level within budget, and climbs back no higher than the ceiling', () => {
    const ladder = createQualityLadder({ ceiling: 'balanced', stepUpAfter: 1 });
    for (let i = 0; i < 600; i++) ladder.frame(FRAME_BUDGET_MS);
    expect(ladder.level).toBe('balanced');
    for (let i = 0; i < 300; i++) ladder.frame(40);
    expect(ladder.level).toBe('light');
    for (let i = 0; i < 600; i++) ladder.frame(8);
    expect(ladder.level).toBe('balanced');
  });

  it('can begin below its ceiling on a machine known to be slow, never above it', () => {
    expect(createQualityLadder({ ceiling: 'high', start: 'light' }).level).toBe('light');
    expect(createQualityLadder({ ceiling: 'balanced', start: 'high' }).level).toBe('balanced');
  });

  it('ignores the frames right after a change, while shaders compile', () => {
    const ladder = createQualityLadder({ ceiling: 'high' });
    for (let i = 0; i < 30; i++) ladder.frame(250);
    expect(ladder.level).toBe('high');
  });
});

describe('the demo without a GPU', () => {
  it('takes a browser with no WebGL2 for one that would draw on the CPU, and draws the map', () => {
    // happy-dom has no WebGL at all: the Hall's demo must not try to compile shaders there.
    expect(webglRunsOnCpu()).toBe(true);
  });
});
