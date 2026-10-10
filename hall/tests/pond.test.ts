// Pond's engine is exemplary on purpose: these are the tests every
// simulation's engine should have (determinism, replay, honest forecasts,
// codex coverage, balance with a bot).
import {
  createRng,
  forecast,
  forecastHolds,
  forecastSeed,
  plansOf,
  replayPlans,
  resolveStep,
  type TurnRecord,
} from '@one-more-year/kit';
import { describe, expect, it } from 'vitest';
import { CODEX, EPITHETS, EVENT_TEXT, MILESTONES } from './fixtures/pond/content.ts';
import { pondBot } from './fixtures/pond/demo.ts';
import {
  YEARS,
  capacity,
  dailyScenario,
  pondModel,
  type PondPlan,
  type PondState,
} from './fixtures/pond/model.ts';

function botRun(seed: number, scenario = 'still-water') {
  let state = pondModel.init({ seed, scenario, seats: 1 });
  const history: TurnRecord<PondPlan>[] = [];
  for (let step = 0; !pondModel.outcome(state); step++) {
    const plan = pondBot(state, createRng(seed).fork('bot').fork(`step:${step}`));
    const resolved = resolveStep(pondModel, state, plan, seed, step);
    state = resolved.state;
    history.push(resolved.record);
  }
  return { state, history };
}

describe('pond engine', () => {
  it('ends after eight years', () => {
    const { history, state } = botRun(1);
    expect(history).toHaveLength(YEARS);
    expect(pondModel.outcome(state)?.ending).toBe('eight-years');
  });

  it('ends early when the fish are gone', () => {
    let state: PondState = pondModel.init({ seed: 1, scenario: 'young-pond', seats: 1 });
    const fish = state.ponds[0]?.fish ?? 0;
    state = resolveStep(pondModel, state, { catch: fish }, 1, 0).state;
    expect(pondModel.outcome(state)).toMatchObject({ ending: 'emptied', verdict: { tier: 1 } });
  });

  it('replays exactly from seed and plans', () => {
    const run = botRun(77);
    const replay = replayPlans(
      pondModel,
      { seed: 77, scenario: 'still-water', seats: 1 },
      plansOf(run.history),
    );
    expect(replay.history).toEqual(run.history);
  });

  it('refuses impossible catches and warns about heavy ones', () => {
    const state = pondModel.init({ seed: 1, scenario: 'still-water', seats: 1 });
    expect(pondModel.validate(state, { catch: 999 })[0]).toMatchObject({ level: 'error' });
    expect(pondModel.validate(state, { catch: -1 })[0]).toMatchObject({ level: 'error' });
    expect(pondModel.validate(state, { catch: 100 })[0]).toMatchObject({ level: 'warning' });
    expect(pondModel.validate(state, { catch: 10 })).toEqual([]);
  });

  it('shares each year’s weather between hot-seat ponds', () => {
    const state = pondModel.init({ seed: 5, scenario: 'still-water', seats: 2 });
    const first = resolveStep(pondModel, state, { catch: 0 }, 5, 0);
    const second = resolveStep(pondModel, first.state, { catch: 0 }, 5, 1);
    const weather = (events: readonly { kind: string }[]) =>
      events.find((e) => ['rain', 'fair', 'dry'].includes(e.kind))?.kind;
    expect(weather(second.record.events)).toBe(weather(first.record.events));
  });

  it('forecasts next spring honestly', () => {
    let held = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const state = pondModel.init({ seed, scenario: 'still-water', seats: 1 });
      const plan = { catch: 20 };
      const predicted = forecast(pondModel, state, plan, (after) => after.ponds[0]?.fish ?? 0, {
        seed: forecastSeed(seed, 0),
      });
      if (
        forecastHolds(
          predicted,
          resolveStep(pondModel, state, plan, seed, 0).state.ponds[0]?.fish ?? 0,
        )
      )
        held++;
    }
    expect(held / 300).toBeGreaterThan(0.74);
  });

  it('keeps the fish near the pond’s capacity when the bot fishes sensibly', () => {
    const finals = Array.from(
      { length: 60 },
      (_, seed) => botRun(seed + 1).state.ponds[0]?.fish ?? 0,
    );
    const mean = finals.reduce((sum, fish) => sum + fish, 0) / finals.length;
    expect(mean).toBeGreaterThan(capacity(30) * 0.35);
    expect(finals.filter((fish) => fish === 0).length).toBeLessThan(6);
  });

  it('can produce every codex phenomenon, and every event has words', () => {
    const seen = new Set<string>();
    const kinds = new Set<string>();
    for (let seed = 1; seed <= 200 && seen.size < CODEX.length; seed++) {
      for (const scenario of ['still-water', 'overgrown', 'young-pond']) {
        for (const record of botRun(seed, scenario).history) {
          for (const e of record.events) {
            kinds.add(e.kind);
            if (e.codex) seen.add(e.codex);
          }
        }
      }
    }
    expect([...seen].sort()).toEqual(CODEX.map((entry) => entry.id).sort());
    for (const kind of kinds) expect(EVENT_TEXT[kind], kind).toBeTypeOf('function');
  });

  it('picks the daily scenario from the seed', () => {
    expect(['still-water', 'overgrown', 'young-pond']).toContain(dailyScenario(12345));
    expect(dailyScenario(12345)).toBe(dailyScenario(12345));
  });

  it('defines its milestones and epithets in its own words', () => {
    expect(MILESTONES.map((m) => m.kind)).toEqual(
      expect.arrayContaining(['stewardship', 'insight', 'curiosity']),
    );
    expect(new Set(EPITHETS.map((rule) => rule.id)).size).toBe(EPITHETS.length);
  });
});
