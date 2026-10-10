import { describe, expect, it, vi } from 'vitest';
import {
  createTurnEngine,
  plansOf,
  replayPlans,
  rngForStep,
  seriesOf,
  type WorldSetup,
} from '../src/turns.ts';
import { ORCHARD_YEARS, orchard, steadyPlans } from './orchard-model.ts';

const setup: WorldSetup = { seed: 1234, scenario: 'standard', seats: 1 };

function playThrough(seed: number, choose: (turn: number) => { sell: number; plant: number }) {
  const engine = createTurnEngine(orchard, { setup: { ...setup, seed } });
  while (engine.phase !== 'over') {
    if (engine.phase === 'plan') {
      engine.setDraft(choose(engine.position.turn));
      // A plan the orchard cannot afford falls back to doing nothing that year.
      if (!engine.canCommit()) engine.setDraft({ sell: 0, plant: 0 });
      engine.commit();
    } else {
      engine.proceed();
    }
  }
  return engine;
}

describe('turn engine', () => {
  it('walks plan → commit → report → plan and ends', () => {
    const engine = createTurnEngine(orchard, { setup });
    expect(engine.phase).toBe('plan');
    expect(engine.position).toEqual({ turn: 1, seat: 0 });
    const record = engine.commit();
    expect(engine.phase).toBe('report');
    expect(engine.lastRecord).toBe(record);
    expect(record).toMatchObject({ step: 0, turn: 1, seat: 0 });
    expect(record.events[0]?.kind).toBe('harvest');
    engine.proceed();
    expect(engine.phase).toBe('plan');
    expect(engine.position.turn).toBe(2);

    const finished = playThrough(99, () => ({ sell: 0, plant: 1 }));
    expect(finished.phase).toBe('over');
    expect(finished.history).toHaveLength(ORCHARD_YEARS);
    expect(finished.outcome?.ending).toBe('seasons-done');
  });

  it('validates the draft live and refuses to commit errors', () => {
    const engine = createTurnEngine(orchard, { setup });
    engine.setDraft({ sell: 500, plant: 0 });
    expect(engine.issues().map((issue) => issue.level)).toEqual(['error', 'warning']);
    expect(engine.canCommit()).toBe(false);
    expect(() => engine.commit()).toThrow(/Not enough apples/);
    engine.setDraft({ sell: 0, plant: 0 });
    expect(engine.canCommit()).toBe(true);
  });

  it('has no undo: editing during the report is refused', () => {
    const engine = createTurnEngine(orchard, { setup });
    engine.commit();
    expect(() => engine.setDraft({ sell: 1, plant: 0 })).toThrow();
    expect(() => engine.commit()).toThrow();
  });

  it('notices when the draft has been edited', () => {
    const engine = createTurnEngine(orchard, { setup });
    expect(engine.draftEdited).toBe(false);
    engine.setDraft({ ...engine.draft, sell: 3 });
    expect(engine.draftEdited).toBe(true);
    engine.resetDraft();
    expect(engine.draftEdited).toBe(false);
  });

  it('notifies subscribers on every change', () => {
    const engine = createTurnEngine(orchard, { setup });
    const listener = vi.fn();
    const stop = engine.subscribe(listener);
    engine.setDraft({ sell: 1, plant: 1 });
    engine.commit();
    engine.proceed();
    expect(listener).toHaveBeenCalledTimes(3);
    stop();
    engine.setDraft({ sell: 0, plant: 0 });
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('replays a full run from seed and plans, reproducing every signal exactly', () => {
    const played = playThrough(4242, (turn) => ({ sell: turn * 3, plant: turn % 3 }));
    const replayed = replayPlans(orchard, played.setup, plansOf(played.history));
    expect(replayed.history).toEqual(played.history);
    expect(replayed.state).toEqual(played.state);
    for (const [index, record] of played.history.entries()) {
      expect(replayed.history[index]?.signals).toEqual(record.signals);
    }
  });

  it('gives a different world for a different seed with the same plans', () => {
    const plans = steadyPlans(ORCHARD_YEARS);
    const one = replayPlans(orchard, { ...setup, seed: 1 }, plans);
    const two = replayPlans(orchard, { ...setup, seed: 2 }, plans);
    expect(one.history.map((r) => r.signals)).not.toEqual(two.history.map((r) => r.signals));
  });

  it('derives each step stream from seed and step alone', () => {
    expect(rngForStep(5, 3).next()).toBe(rngForStep(5, 3).next());
    expect(rngForStep(5, 3).next()).not.toBe(rngForStep(5, 4).next());
  });

  it('restores from a snapshot onto the plan screen, keeping a chosen draft', () => {
    const engine = createTurnEngine(orchard, { setup });
    engine.commit();
    const afterReport = createTurnEngine(orchard, {
      snapshot: JSON.parse(JSON.stringify(engine.snapshot())) as ReturnType<typeof engine.snapshot>,
    });
    expect(afterReport.phase).toBe('plan');
    expect(afterReport.position.turn).toBe(2);
    expect(afterReport.history).toEqual(engine.history);

    engine.proceed();
    engine.setDraft({ sell: 7, plant: 0 });
    const withDraft = createTurnEngine(orchard, { snapshot: engine.snapshot({ keepDraft: true }) });
    expect(withDraft.draft).toEqual({ sell: 7, plant: 0 });
    const withoutDraft = createTurnEngine(orchard, { snapshot: engine.snapshot() });
    expect(withoutDraft.draft).toEqual(orchard.draft(engine.state));
  });

  it('continues a restored run exactly as if it had never stopped', () => {
    const plans = [
      { sell: 5, plant: 1 },
      { sell: 0, plant: 2 },
      { sell: 10, plant: 0 },
      { sell: 0, plant: 1 },
    ];
    const straight = replayPlans(orchard, setup, plans);

    const first = createTurnEngine(orchard, { setup });
    for (const plan of plans.slice(0, 2)) {
      first.setDraft(plan);
      first.commit();
      first.proceed();
    }
    const resumed = createTurnEngine(orchard, { snapshot: first.snapshot() });
    for (const plan of plans.slice(2)) {
      resumed.setDraft(plan);
      resumed.commit();
      resumed.proceed();
    }
    expect(resumed.history).toEqual(straight.history);
  });

  it('records the opening signals and builds series from them', () => {
    const engine = createTurnEngine(orchard, { setup });
    engine.commit();
    expect(engine.opening).toEqual([{ trees: 10, apples: 100 }]);
    const series = seriesOf('trees', engine.opening[0] ?? {}, engine.history);
    expect(series).toEqual([10, 12]);
  });

  it('takes turns between seats in hot-seat play', () => {
    const engine = createTurnEngine(orchard, { setup: { ...setup, seats: 2 } });
    expect(engine.position).toEqual({ turn: 1, seat: 0 });
    engine.commit();
    engine.proceed();
    expect(engine.position).toEqual({ turn: 1, seat: 1 });
    engine.commit();
    engine.proceed();
    expect(engine.position).toEqual({ turn: 2, seat: 0 });
    expect(engine.history.map((r) => r.seat)).toEqual([0, 1]);
    expect(engine.opening).toHaveLength(2);
  });
});
