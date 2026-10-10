import { describe, expect, it, vi } from 'vitest';
import {
  autosaveOnHide,
  createRunStore,
  listRunSummaries,
  newRunId,
  runKey,
  simsWithRuns,
  type RunRecord,
} from '../src/runs.ts';
import { createStorage } from '../src/save.ts';
import { createTurnEngine } from '../src/turns.ts';
import { orchard, type OrchardPlan, type OrchardState } from './orchard-model.ts';
import { BlockedStorage, MemoryStorage, TinyStorage } from './storage-doubles.ts';

function runFrom(id: string, updatedAt: number, turns = 0): RunRecord<OrchardState, OrchardPlan> {
  const engine = createTurnEngine(orchard, { setup: { seed: 7, scenario: 'standard', seats: 1 } });
  for (let i = 0; i < turns; i++) {
    engine.commit();
    engine.proceed();
  }
  return {
    id,
    simId: 'orchard',
    setup: engine.setup,
    daily: null,
    replayOf: null,
    status: 'in-progress',
    createdAt: 1,
    updatedAt,
    turnLabel: `Year ${engine.position.turn} of 6`,
    signals: engine.history.at(-1)?.signals ?? engine.opening[0] ?? {},
    spark: [],
    playedMs: 0,
    snapshot: engine.snapshot(),
  };
}

describe('runs', () => {
  it('autosaves and resumes a run exactly where it was', () => {
    const backing = new MemoryStorage();
    const runs = createRunStore<OrchardState, OrchardPlan>(createStorage(backing), 'orchard', {
      saveVersion: 1,
    });
    const saved = runFrom('a', 10, 3);
    expect(runs.save(saved)).toBe(true);

    // A page reload: a new store over the same storage.
    const reopened = createRunStore<OrchardState, OrchardPlan>(createStorage(backing), 'orchard', {
      saveVersion: 1,
    });
    const loaded = reopened.get('a');
    expect(loaded).toEqual(saved);
    const resumed = createTurnEngine(orchard, { snapshot: loaded?.snapshot ?? saved.snapshot });
    expect(resumed.phase).toBe('plan');
    expect(resumed.position.turn).toBe(4);
    expect(resumed.history).toHaveLength(3);
  });

  it('keeps several runs in progress, most recent first', () => {
    const runs = createRunStore(createStorage(new MemoryStorage()), 'orchard', { saveVersion: 1 });
    runs.save(runFrom('old', 10));
    runs.save(runFrom('new', 30));
    runs.save(runFrom('middle', 20));
    expect(runs.list().map((run) => run.id)).toEqual(['new', 'middle', 'old']);
  });

  it('abandons and finishes runs by removing them', () => {
    const backing = new MemoryStorage();
    const runs = createRunStore(createStorage(backing), 'orchard', { saveVersion: 1 });
    runs.save(runFrom('a', 1));
    runs.save(runFrom('b', 2));
    runs.abandon('a');
    runs.finish('b');
    expect(runs.list()).toEqual([]);
    expect(backing.length).toBe(0);
  });

  it('keeps simulations apart and lists which ones have runs', () => {
    const store = createStorage(new MemoryStorage());
    createRunStore(store, 'orchard', { saveVersion: 1 }).save(runFrom('a', 1));
    const other = createRunStore(store, 'other', { saveVersion: 1 });
    expect(other.list()).toEqual([]);
    other.save({ ...runFrom('b', 2), simId: 'other' });
    expect(simsWithRuns(store)).toEqual(['orchard', 'other']);
  });

  it('migrates runs saved by an older build', () => {
    const backing = new MemoryStorage();
    const old = { ...runFrom('a', 5), turnLabel: undefined, label: 'Year 1' };
    backing.setItem(runKey('orchard', 'a'), JSON.stringify({ v: 1, d: old }));
    const runs = createRunStore(createStorage(backing), 'orchard', {
      saveVersion: 2,
      migrations: {
        1: (data) => {
          const { label, ...rest } = data as { label: string };
          return { ...rest, turnLabel: label };
        },
      },
    });
    expect(runs.get('a')?.turnLabel).toBe('Year 1');
    expect(runs.unreadable()).toEqual([]);
  });

  it('sets aside runs it cannot read instead of crashing', () => {
    const backing = new MemoryStorage();
    backing.setItem(runKey('orchard', 'future'), JSON.stringify({ v: 9, d: runFrom('future', 1) }));
    backing.setItem(runKey('orchard', 'broken'), '{oops');
    const runs = createRunStore(createStorage(backing), 'orchard', { saveVersion: 1 });
    runs.save(runFrom('fine', 3));
    expect(runs.list().map((run) => run.id)).toEqual(['fine']);
    expect(runs.unreadable().sort()).toEqual(['broken', 'future']);
  });

  it('keeps playing in a private window where storage is blocked', () => {
    const store = createStorage(new BlockedStorage());
    const runs = createRunStore(store, 'orchard', { saveVersion: 1 });
    expect(runs.save(runFrom('a', 1, 2))).toBe(false);
    expect(runs.get('a')?.snapshot.history).toHaveLength(2);
    expect(runs.list()).toHaveLength(1);
    expect(store.degraded).toBe(true);
  });

  it('keeps playing when storage fills up mid-run', () => {
    // Room for the first few years of the run, but not for all six.
    const budget = JSON.stringify({ v: 1, d: runFrom('long', 0, 3) }).length + 40;
    const store = createStorage(new TinyStorage(budget));
    const onDegraded = vi.fn();
    store.onDegraded(onDegraded);
    const runs = createRunStore(store, 'orchard', { saveVersion: 1 });
    let lastSaved = true;
    for (let turn = 0; turn <= 6; turn++) lastSaved = runs.save(runFrom('long', turn, turn));
    expect(lastSaved).toBe(false);
    expect(onDegraded).toHaveBeenCalledWith('full');
    expect(runs.get('long')?.snapshot.history).toHaveLength(6);
  });

  it('makes distinct run ids', () => {
    const ids = new Set(Array.from({ length: 200 }, () => newRunId(1000)));
    expect(ids.size).toBeGreaterThan(190);
  });

  it('saves when the page hides', () => {
    const save = vi.fn();
    const stop = autosaveOnHide(save);
    window.dispatchEvent(new Event('pagehide'));
    expect(save).toHaveBeenCalledTimes(1);
    stop();
    window.dispatchEvent(new Event('pagehide'));
    expect(save).toHaveBeenCalledTimes(1);
  });
});

describe('run summaries', () => {
  it('lists runs of every simulation without their save versions', () => {
    const store = createStorage(new MemoryStorage());
    createRunStore(store, 'orchard', { saveVersion: 3 }).save(runFrom('a', 10, 2));
    createRunStore(store, 'other', { saveVersion: 1 }).save({
      ...runFrom('b', 20),
      simId: 'other',
    });
    store.set(runKey('broken', 'x'), '{nope');
    const summaries = listRunSummaries(store);
    expect(summaries.map((run) => [run.simId, run.id])).toEqual([
      ['other', 'b'],
      ['orchard', 'a'],
    ]);
    expect(summaries[1]).toMatchObject({ turnLabel: 'Year 3 of 6', replayOf: null });
  });
});
