// The Hall's data layer: registry, daily scenarios, filters, runs in
// progress, chronicles, codex progress, legacy ranks and cosmetics, streak.
import {
  createRunStore,
  createTurnEngine,
  dailyNumber,
  dailySeed,
  type ChronicleEntry,
  type RunRecord,
  type SimManifest,
} from '@one-more-year/kit';
import { describe, expect, it } from 'vitest';
import { createServices } from '../src/app/services.ts';
import { COMING_SOON, CROWN_OF_FLORINS, TEN_HARVESTS } from '../src/data/coming-soon.ts';
import {
  COSMETICS,
  cosmeticsFor,
  createCosmeticsStore,
  unlockedCosmetics,
} from '../src/data/cosmetics.ts';
import { NO_FILTER, filterOptions, matchesFilter, sessionLength } from '../src/data/filters.ts';
import { createHallModel } from '../src/data/hall-model.ts';
import { bestChronicle, filterChronicles } from '../src/data/library.ts';
import { checkManifest, createRegistry } from '../src/data/registry.ts';
import { THEME_IDS } from '../src/themes/theme-ids.ts';
import { fixtureManifests } from './fixtures/fixture-manifests.ts';
import { manifest as pondManifest } from './fixtures/pond/manifest.ts';
import pond from './fixtures/pond/index.ts';
import { pondModel } from './fixtures/pond/model.ts';

const NOW = Date.parse('2026-10-09T09:00:00Z');
const DAY = 86_400_000;

function hall(options: { now?: () => number; withPond?: boolean } = {}) {
  const services = createServices({ storage: null, now: options.now ?? (() => NOW) });
  const registry = createRegistry({
    placeholders: COMING_SOON,
    discovered:
      options.withPond === false
        ? []
        : [{ manifest: pondManifest, load: () => Promise.resolve(pond) }],
  });
  return { services, registry, model: createHallModel(registry, services) };
}

function chronicle(overrides: Partial<ChronicleEntry> & { id: string }): ChronicleEntry {
  return {
    v: 1,
    simId: 'pond',
    runId: `r-${overrides.id}`,
    setup: { seed: 1, scenario: 'still-water', seats: 1 },
    scenarioTitle: 'Still Water',
    daily: null,
    replayOf: null,
    startedAt: NOW - 1000,
    finishedAt: NOW,
    turnUnit: 'year',
    turns: 8,
    title: 'Eight years at the pond',
    epithet: { id: 'x', text: 'Who Watched from the Bank' },
    outcome: { ending: 'eight-years', verdict: { id: 'healthy', label: 'Healthy pond', tier: 4 } },
    timeline: [],
    keyMoments: [],
    series: { fish: [180, 190] },
    finalSignals: { fish: 190 },
    primarySignal: 'fish',
    share: '',
    seatNames: [],
    ...overrides,
  };
}

describe('registry', () => {
  it('lists the two planned worlds, playable worlds first', () => {
    const { registry } = hall();
    expect(registry.entries.map((entry) => entry.manifest.id)).toEqual([
      'pond',
      'ten-harvests',
      'crown-of-florins',
    ]);
    expect(registry.playable().map((entry) => entry.manifest.id)).toEqual(['pond']);
    expect(registry.problems).toEqual([]);
  });

  it('keeps the provisional titles in the manifests only', () => {
    expect(TEN_HARVESTS).toMatchObject({
      title: 'Ten Harvests',
      status: 'playable',
      inspiredBy: { originalTitle: 'Hamurabi' },
    });
    expect(CROWN_OF_FLORINS).toMatchObject({
      title: 'Crown of Florins',
      players: '1–6P',
      inspiredBy: { originalTitle: 'Santa Paravia and Fiumaccio' },
    });
    expect(TEN_HARVESTS.signals.map((signal) => signal.id)).toEqual(['people', 'grain', 'acres']);
    expect(CROWN_OF_FLORINS.signals.map((signal) => signal.id)).toEqual([
      'treasury',
      'people',
      'land',
    ]);
  });

  it('lets a built simulation replace its placeholder', () => {
    const built: SimManifest = {
      ...TEN_HARVESTS,
      status: 'playable',
      scenarios: [{ id: 'a', title: 'A', twist: '', difficulty: 2 }],
    };
    const registry = createRegistry({
      placeholders: COMING_SOON,
      discovered: [{ manifest: built, load: () => Promise.resolve(pond) }],
    });
    expect(registry.entries).toHaveLength(2);
    expect(registry.get('ten-harvests')?.load).not.toBeNull();
  });

  it('reports broken manifests instead of crashing', () => {
    const broken = { ...TEN_HARVESTS, id: 'Not Kebab', signals: [], typicalTurns: [5, 2] as const };
    expect(checkManifest(broken)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('kebab-case'),
        expect.stringContaining('typicalTurns'),
        expect.stringContaining('2 to 4 signals'),
      ]),
    );
  });

  it('handles twenty worlds as well as two', () => {
    const registry = createRegistry({ placeholders: fixtureManifests(20), discovered: [] });
    expect(registry.entries).toHaveLength(20);
    expect(registry.problems).toEqual([]);
    expect(fixtureManifests(2).map((manifest) => manifest.id)).toEqual([
      'ten-harvests',
      'crown-of-florins',
    ]);
  });
});

describe('daily scenarios', () => {
  it('are deterministic per date and skip planned worlds', () => {
    const { model } = hall();
    const daily = model.snapshot().daily;
    expect(daily.map((card) => card.simId)).toEqual(['pond']);
    expect(daily[0]).toMatchObject({
      number: 1,
      day: '2026-10-09',
      seed: dailySeed('pond', '2026-10-09'),
      played: false,
    });
    expect(hall().model.snapshot().daily[0]?.seed).toBe(daily[0]?.seed);
  });

  it('change with the UTC date', () => {
    const { model } = hall({ now: () => NOW + DAY });
    expect(model.snapshot().daily[0]).toMatchObject({ number: 2, day: '2026-10-10' });
    expect(model.snapshot().dailyNumber).toBe(dailyNumber('2026-10-10'));
  });

  it('show today as played and keep the first result', () => {
    const { model, services } = hall();
    services.daily.markPlayed('pond', '2026-10-09');
    services.daily.record('pond', '2026-10-09', { chronicleId: 'c1', share: 's', verdictTier: 3 });
    model.refresh();
    expect(model.snapshot().daily[0]).toMatchObject({
      played: true,
      result: { chronicleId: 'c1' },
    });
  });
});

describe('filters', () => {
  it('bucket worlds by sitting length', () => {
    expect(sessionLength(pondManifest)).toBe('short');
    expect(sessionLength(TEN_HARVESTS)).toBe('short');
    expect(sessionLength(CROWN_OF_FLORINS)).toBe('long');
  });

  it('match by domain and length together', () => {
    expect(matchesFilter(pondManifest, NO_FILTER)).toBe(true);
    expect(matchesFilter(pondManifest, { domain: 'ecology', length: null })).toBe(true);
    expect(matchesFilter(pondManifest, { domain: 'governance', length: null })).toBe(false);
    expect(matchesFilter(CROWN_OF_FLORINS, { domain: 'governance', length: 'short' })).toBe(false);
  });

  it('offer only choices that occur', () => {
    expect(filterOptions(COMING_SOON)).toEqual({
      domains: ['governance'],
      lengths: ['short', 'long'],
    });
    expect(filterOptions(fixtureManifests(20)).domains).toHaveLength(6);
  });
});

describe('runs in progress', () => {
  it('appear in the Continue list, most recent first, without loading modules', () => {
    let now = NOW;
    const { model, services } = hall({ now: () => now });
    const runs = createRunStore(services.store, 'pond', { saveVersion: 1 });
    for (const [id, at] of [
      ['older', NOW - 5000],
      ['newer', NOW - 1000],
    ] as const) {
      const engine = createTurnEngine(pondModel, {
        setup: { seed: 3, scenario: 'still-water', seats: 1 },
      });
      const run: RunRecord = {
        id,
        simId: 'pond',
        setup: engine.setup,
        daily: null,
        replayOf: null,
        status: 'in-progress',
        createdAt: at,
        updatedAt: at,
        turnLabel: 'Year 1 of 8',
        signals: engine.opening[0] ?? {},
        spark: [180],
        playedMs: 0,
        snapshot: engine.snapshot(),
      };
      runs.save(run);
    }
    now += 1;
    model.refresh();
    const snapshot = model.snapshot();
    expect(snapshot.continueRuns.map((run) => run.id)).toEqual(['newer', 'older']);
    expect(snapshot.continueRuns[0]?.manifest.title).toBe('Pond');
    expect(snapshot.entries.find((entry) => entry.manifest.id === 'pond')?.runs).toHaveLength(2);
  });

  it('hide runs of simulations that are not playable here', () => {
    const { model, services } = hall({ withPond: false });
    services.store.set(
      'omy:run:pond:x',
      JSON.stringify({
        v: 1,
        d: { id: 'x', simId: 'pond', setup: {}, snapshot: {}, updatedAt: 1, status: 'in-progress' },
      }),
    );
    model.refresh();
    expect(model.snapshot().continueRuns).toEqual([]);
  });
});

describe('chronicles', () => {
  it('are kept in the Library and filtered and sorted', () => {
    const { services, model } = hall();
    services.library.add(
      chronicle({
        id: 'a',
        finishedAt: NOW - 3000,
        outcome: { ending: 'x', verdict: { id: 'v', label: 'Thinned out', tier: 2 } },
      }),
    );
    services.library.add(chronicle({ id: 'b', finishedAt: NOW - 2000 }));
    services.library.add(
      chronicle({
        id: 'c',
        finishedAt: NOW - 1000,
        setup: { seed: 2, scenario: 'overgrown', seats: 1 },
      }),
    );
    const all = services.library.all();
    expect(all.map((entry) => entry.id)).toEqual(['c', 'b', 'a']);
    expect(filterChronicles(all, { sort: 'verdict' }).map((entry) => entry.id)).toEqual([
      'c',
      'b',
      'a',
    ]);
    expect(filterChronicles(all, { verdictTier: 4 }).map((entry) => entry.id)).toEqual(['c', 'b']);
    expect(filterChronicles(all, { scenario: 'overgrown' }).map((entry) => entry.id)).toEqual([
      'c',
    ]);
    expect(bestChronicle(all, 'pond')?.id).toBe('c');
    model.refresh();
    expect(model.snapshot().entries[0]).toMatchObject({ chronicleCount: 3 });
  });
});

describe('codex progress and legacy', () => {
  it('knows codex totals once a module has loaded', async () => {
    const { model, services } = hall();
    expect(model.snapshot().entries[0]?.codex).toEqual({ discovered: 0, total: null });
    await model.loadModule('pond');
    services.codex.forSim('pond', pond.codex).sight('heron', 'r1');
    model.refresh();
    expect(model.snapshot().entries[0]?.codex).toEqual({ discovered: 1, total: 4 });
  });

  it('ranks by points and unlocks one cosmetic per rank per theme', async () => {
    const { model, services } = hall();
    await model.loadModule('pond');
    expect(model.snapshot().legacy.standing.rank.title).toBe('Novice');
    const book = services.milestones.forSim('pond', pond.milestones);
    book.unlock('fuller-pond');
    book.unlock('good-catch');
    model.refresh();
    expect(model.snapshot().legacy.standing).toMatchObject({
      points: 55,
      rank: { title: 'Scribe' },
    });
    expect(unlockedCosmetics(55).map((cosmetic) => cosmetic.rank)).toEqual([
      'novice',
      'scribe',
      'novice',
      'scribe',
      'novice',
      'scribe',
    ]);
    expect(model.snapshot().legacy.active('almanac').id).toBe('almanac-scribe');
  });

  it('lets the player wear an earlier cosmetic', () => {
    const { services } = hall();
    const store = createCosmeticsStore(services.store);
    expect(store.active('terrarium', 500).id).toBe('terrarium-keeper');
    store.choose('terrarium', 'terrarium-scribe');
    expect(store.active('terrarium', 500).id).toBe('terrarium-scribe');
    store.choose('terrarium', 'terrarium-sage');
    expect(store.active('terrarium', 500).id).toBe('terrarium-keeper');
  });

  it('has exactly one cosmetic per rank per theme', () => {
    for (const theme of THEME_IDS) expect(cosmeticsFor(theme)).toHaveLength(6);
    expect(new Set(COSMETICS.map((cosmetic) => cosmetic.id)).size).toBe(18);
  });
});

describe('the Almanac streak in the Hall', () => {
  it('counts daily play across days with a forgiven gap', () => {
    let now = NOW;
    const { model, services } = hall({ now: () => now });
    for (const offset of [0, 1, 3])
      services.daily.markPlayed('pond', new Date(NOW + offset * DAY).toISOString().slice(0, 10));
    now = NOW + 3 * DAY;
    model.refresh();
    const { streak } = model.snapshot();
    expect(streak.current).toBe(3);
    expect(streak.days.map((day) => day.mark)).toEqual(['played', 'played', 'grace', 'played']);
  });
});

describe('forget my data', () => {
  it('erases runs, chronicles, codex, milestones, daily records and settings', () => {
    const { services } = hall();
    services.library.add(chronicle({ id: 'a' }));
    services.codex.forSim('pond', pond.codex).sight('heron', 'r');
    services.milestones.forSim('pond', pond.milestones).unlock('hands-off');
    services.daily.markPlayed('pond', '2026-10-09');
    services.settings.update({ theme: 'terrarium' });
    services.forgetEverything();
    expect(services.store.keys('omy:')).toEqual([]);
    expect(services.settings.get().theme).toBe('almanac');
  });
});
