import { describe, expect, it, vi } from 'vitest';
import { createCodexBook } from '../src/codex.ts';
import type { RunReport, SimContext, SimManifest, TurnSummary } from '../src/contract.ts';
import { numberOf } from '../src/events.ts';
import { createMilestoneBook } from '../src/milestones.ts';
import { createRunStore } from '../src/runs.ts';
import { createStorage, type KeyValueStore } from '../src/save.ts';
import { createSeats, showHandover } from '../src/seats.ts';
import { startPlay, type PlayRules } from '../src/session.ts';
import { createSettings } from '../src/settings.ts';
import { ORCHARD_YEARS, orchard, type OrchardPlan, type OrchardState } from './orchard-model.ts';
import { MemoryStorage } from './storage-doubles.ts';

const manifest: SimManifest = {
  id: 'orchard',
  title: 'Orchard',
  tagline: '',
  teaser: '',
  domain: 'ecology',
  turnUnit: 'year',
  typicalTurns: [6, 6],
  players: '1P',
  sessionMinutes: [5, 10],
  status: 'playable',
  accent: { light: '#225522', dark: '#88cc88' },
  emblem: 'M0 0',
  inspiredBy: { originalTitle: 'x', uiTitle: 'x', year: 1970, credit: 'x' },
  hasDailyScenario: true,
  scenarios: [
    { id: 'standard', title: 'Standard', twist: '', difficulty: 2 },
    { id: 'generous', title: 'Generous', twist: '', difficulty: 1 },
  ],
  signals: [
    { id: 'apples', label: 'Apples', unit: null, format: 'integer', higherIsBetter: true },
    { id: 'trees', label: 'Trees', unit: null, format: 'integer', higherIsBetter: true },
  ],
};

const rules: PlayRules<OrchardState, OrchardPlan> = {
  model: orchard,
  text: {
    harvest: (e) => `${numberOf(e, 'total')} apples picked`,
    pests: (e) => `Pests ate ${numberOf(e, 'eaten')}`,
  },
  epithets: [{ id: 'planter', text: 'Who Kept Planting', when: (h) => h.neverFell('trees') }],
  title: (h) => `${h.records.length} years among the trees`,
  glyph: (record) => (record.tone === 'good' ? '🍎' : '🌳'),
  shareLine: (h) => `Trees ${h.final('trees')}`,
  length: (state) => state.length,
  milestones: [
    {
      id: 'full-term',
      kind: 'stewardship',
      title: 'Full term',
      description: '',
      points: 20,
      atRunEnd: (h) => h.records.length === ORCHARD_YEARS,
    },
    {
      id: 'pests-seen',
      kind: 'insight',
      title: 'Pests',
      description: '',
      points: 10,
      codexDiscovered: 1,
    },
  ],
};

function testContext(store: KeyValueStore = createStorage(new MemoryStorage())) {
  const turns: TurnSummary[] = [];
  const reports: RunReport[] = [];
  const markDailyPlayed = vi.fn();
  const settings = createSettings(store, {
    prefersDark: () => false,
    prefersReducedMotion: () => false,
    watch: () => () => undefined,
  });
  const milestoneDefs = rules.milestones ?? [];
  const codexDefs = [
    { id: 'pests', title: 'Pests', summary: '', tendency: '', mechanism: '', hint: '', art: '' },
  ];
  let clock = 1_000_000;
  const ctx: SimContext = {
    manifest,
    launch: { kind: 'menu' },
    audio: { play: () => undefined, define: () => undefined, setAmbience: () => undefined },
    settings: {
      get: () => settings.get(),
      subscribe: () => () => undefined,
      sim: settings.forSim('orchard'),
    },
    appearance: { current: 'light', reducedMotion: false, subscribe: () => () => undefined },
    runs: createRunStore(store, 'orchard', { saveVersion: 1 }),
    milestones: createMilestoneBook(store).forSim('orchard', milestoneDefs),
    codex: createCodexBook(store).forSim('orchard', codexDefs),
    daily: { day: '2026-10-09', number: 1, seed: 4242, played: false },
    seats: { create: createSeats, handover: showHandover },
    now: () => (clock += 1000),
    reportTurn: (summary) => turns.push(summary),
    reportRun: (report) => reports.push(report),
    markDailyPlayed,
    share: () => undefined,
    setView: () => undefined,
    setPauseItems: () => undefined,
    openSettings: () => undefined,
    openHowToPlay: () => undefined,
    forgetData: () => undefined,
    navigate: () => undefined,
  };
  return { ctx, turns, reports, markDailyPlayed, store };
}

function playToEnd(session: ReturnType<typeof startPlay<OrchardState, OrchardPlan>>) {
  while (session.engine.phase !== 'over') {
    if (session.engine.phase === 'plan') {
      session.engine.setDraft({ sell: 0, plant: 1 });
      session.commit();
    } else {
      session.proceed();
    }
  }
}

describe('play session', () => {
  it('begins a run and saves it before the first turn', () => {
    const { ctx } = testContext();
    const session = startPlay(ctx, rules, {
      kind: 'new',
      scenario: 'generous',
      seats: 1,
      seatNames: [],
    });
    const saved = ctx.runs.get(session.runId);
    expect(saved?.setup.scenario).toBe('generous');
    expect(saved?.turnLabel).toBe('Year 1 of 6');
    expect(session.turnLabel).toBe('Year 1 of 6');
    session.dispose();
  });

  it('autosaves every resolved turn and resumes on the plan screen', () => {
    const { ctx, turns, store } = testContext();
    const session = startPlay(ctx, rules, { kind: 'new', scenario: null, seats: 1, seatNames: [] });
    session.commit();
    expect(turns).toHaveLength(1);
    expect(ctx.runs.get(session.runId)?.snapshot.history).toHaveLength(1);
    session.proceed();
    session.commit();
    session.dispose();

    const { ctx: reopened } = testContext(store);
    const resumed = startPlay(reopened, rules, { kind: 'resume', runId: session.runId });
    expect(resumed.engine.phase).toBe('plan');
    expect(resumed.engine.history).toHaveLength(2);
    expect(resumed.turnLabel).toBe('Year 3 of 6');
    resumed.dispose();
  });

  it('keeps a half-edited plan as a draft when asked', () => {
    const { ctx, store } = testContext();
    const session = startPlay(ctx, rules, { kind: 'new', scenario: null, seats: 1, seatNames: [] });
    expect(session.leaveCheck()).toBe('safe');
    session.engine.setDraft({ sell: 5, plant: 0 });
    expect(session.leaveCheck()).toBe('would-lose-progress');
    session.keepDraft();
    expect(session.leaveCheck()).toBe('safe');
    session.dispose();
    const resumed = startPlay(testContext(store).ctx, rules, {
      kind: 'resume',
      runId: session.runId,
    });
    expect(resumed.engine.draft).toEqual({ sell: 5, plant: 0 });
    resumed.dispose();
  });

  it('keeps the draft when the page hides', () => {
    const { ctx } = testContext();
    const session = startPlay(ctx, rules, { kind: 'new', scenario: null, seats: 1, seatNames: [] });
    session.engine.setDraft({ sell: 9, plant: 0 });
    window.dispatchEvent(new Event('pagehide'));
    expect(ctx.runs.get(session.runId)?.snapshot.draft).toEqual({ sell: 9, plant: 0 });
    session.dispose();
  });

  it('finishes with a chronicle, milestones and a report to the Hall', () => {
    const { ctx, reports } = testContext();
    const session = startPlay(ctx, rules, { kind: 'new', scenario: null, seats: 1, seatNames: [] });
    playToEnd(session);
    expect(reports).toHaveLength(1);
    const chronicle = reports[0]?.chronicle;
    expect(chronicle?.title).toBe('6 years among the trees');
    expect(chronicle?.epithet.text).toBe('Who Kept Planting');
    expect(reports[0]?.presentation).toBe('hall');
    expect(session.chronicle).toBe(chronicle);
    expect(ctx.milestones.isUnlocked('full-term')).toBe(true);
    expect(ctx.runs.list()).toEqual([]);
  });

  it('plays the daily world with the day seed and marks the day', () => {
    const { ctx, reports, markDailyPlayed } = testContext();
    const session = startPlay(ctx, rules, { kind: 'daily' });
    expect(session.engine.setup.seed).toBe(4242);
    expect(session.daily).toEqual({ day: '2026-10-09', number: 1 });
    expect(markDailyPlayed).toHaveBeenCalledTimes(1);
    playToEnd(session);
    expect(reports[0]?.chronicle.share.split('\n')[0]).toBe('One More Year · Orchard #1');
  });

  it('replays the same world with the old run as a ghost', () => {
    const { ctx, reports } = testContext();
    const first = startPlay(ctx, rules, { kind: 'new', scenario: null, seats: 1, seatNames: [] });
    playToEnd(first);
    const chronicle = reports[0]?.chronicle;
    if (!chronicle) throw new Error('no chronicle');

    const replay = startPlay(ctx, rules, { kind: 'replay', chronicle });
    expect(replay.engine.setup).toEqual(chronicle.setup);
    expect(replay.ghost?.chronicleId).toBe(chronicle.id);
    expect(replay.ghostSeries('apples')).toEqual(chronicle.series.apples);
    replay.engine.setDraft({ sell: 0, plant: 1 });
    replay.commit();
    // Same plan, same world: last time's value at this point is today's value.
    expect(replay.lastTime('apples')).toBe(replay.engine.lastRecord?.signals.apples);
    replay.dispose();
  });

  it('records codex sightings and their milestones', () => {
    const { ctx, turns } = testContext();
    // The daily world has a fixed seed, so this run's pests are known in advance.
    const session = startPlay(ctx, rules, { kind: 'daily' });
    playToEnd(session);
    const pestYears = session.engine.history.filter((r) =>
      r.events.some((e) => e.kind === 'pests'),
    );
    const sighted = turns.flatMap((turn) => turn.discoveries);
    expect(pestYears.length).toBeGreaterThan(0);
    expect(sighted).toHaveLength(pestYears.length);
    expect(sighted[0]).toMatchObject({ isNew: true, seen: 1 });
    expect(ctx.milestones.isUnlocked('pests-seen')).toBe(true);
  });

  it('gives stable forecasts that do not use the real stream', () => {
    const { ctx } = testContext();
    const session = startPlay(ctx, rules, { kind: 'new', scenario: null, seats: 1, seatNames: [] });
    const measures = { apples: (after: OrchardState) => after.apples[0] ?? 0 };
    const one = session.forecast(measures);
    expect(session.forecast(measures)).toEqual(one);
    expect(one.apples.kind).toBe('range');
    session.dispose();
  });
});

describe('play session clean-up', () => {
  it('lets go of a run left before its first turn', () => {
    const { ctx } = testContext();
    const look = startPlay(ctx, rules, { kind: 'new', scenario: null, seats: 1, seatNames: [] });
    expect(ctx.runs.get(look.runId)).not.toBeNull();
    expect(ctx.runs.list()).toEqual([]);
    look.dispose();
    expect(ctx.runs.get(look.runId)).toBeNull();
  });

  it('keeps a run left before its first turn when the plan was kept', () => {
    const { ctx } = testContext();
    const session = startPlay(ctx, rules, { kind: 'new', scenario: null, seats: 1, seatNames: [] });
    session.engine.setDraft({ sell: 2, plant: 0 });
    session.keepDraft();
    session.dispose();
    expect(ctx.runs.list()).toHaveLength(1);
  });

  it('keeps a run once a turn has been played', () => {
    const { ctx } = testContext();
    const session = startPlay(ctx, rules, { kind: 'new', scenario: null, seats: 1, seatNames: [] });
    session.commit();
    session.dispose();
    expect(ctx.runs.list()).toHaveLength(1);
  });
});

describe('runs only looked at', () => {
  it('never pile up when the page reloads before the first turn', () => {
    const { ctx } = testContext();
    const first = startPlay(ctx, rules, { kind: 'new', scenario: null, seats: 1, seatNames: [] });
    // The page goes away without the session being disposed (a reload, a crash).
    window.dispatchEvent(new Event('pagehide'));
    first.dispose = () => undefined;
    expect(ctx.runs.list()).toEqual([]);
    const second = startPlay(ctx, rules, { kind: 'new', scenario: null, seats: 1, seatNames: [] });
    second.commit();
    expect(ctx.runs.list().map((run) => run.id)).toEqual([second.runId]);
    expect(ctx.runs.get(first.runId)).toBeNull();
  });
});
