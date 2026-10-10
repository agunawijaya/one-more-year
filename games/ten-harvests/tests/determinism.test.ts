import { describe, expect, it } from 'vitest';
import { dailySeed, plansOf, replayPlans, rngForStep } from '@one-more-year/kit';
import { carefulBot } from '../src/engine/bots.ts';
import { cityModel } from '../src/engine/model.ts';
import { ledgerFor } from '../src/engine/odds.ts';
import { simulateRun } from '../src/engine/simulate.ts';

describe('a run is fully described by its seed and its plans', () => {
  it('replays a whole Classic run signal for signal', () => {
    const run = simulateRun(carefulBot, { seed: 2026, scenario: 'classic', seats: 1 });
    const replay = replayPlans(cityModel, run.setup, plansOf(run.history));
    expect(replay.history.map((r) => r.signals)).toEqual(run.history.map((r) => r.signals));
    expect(replay.state).toEqual(run.final);
  });

  it('replays a thirty-year Dynasty and a 1978 Ledger the same way', () => {
    for (const scenario of ['dynasty', 'ledger-1978', 'land-fever']) {
      const run = simulateRun(carefulBot, { seed: 77, scenario, seats: 1 });
      const replay = replayPlans(cityModel, run.setup, plansOf(run.history));
      expect(replay.state).toEqual(run.final);
    }
  });

  it('gives everyone the same daily world', () => {
    const seed = dailySeed('ten-harvests', '2026-10-10');
    const a = simulateRun(carefulBot, { seed, scenario: 'classic', seats: 1 });
    const b = simulateRun(carefulBot, { seed, scenario: 'classic', seats: 1 });
    expect(a.final).toEqual(b.final);
    expect(seed).toBe(dailySeed('ten-harvests', '2026-10-10'));
    expect(seed).not.toBe(dailySeed('ten-harvests', '2026-10-11'));
  });

  it('keeps the dice of one kind of chance apart from the others', () => {
    // Planting changes nothing about the rats' roll or the plague's: each draws from its own stream.
    const state = cityModel.init({ seed: 5, scenario: 'classic', seats: 1 });
    const sown = cityModel.resolve(
      state,
      { land: 0, food: 2000, plant: 999 },
      rngForStep(5, 0),
    ).state;
    const fallow = cityModel.resolve(
      state,
      { land: 0, food: 2000, plant: 0 },
      rngForStep(5, 0),
    ).state;
    expect(sown.last.ratFace).toBe(fallow.last.ratFace);
    expect(sown.last.yieldPerAcre).toBe(fallow.last.yieldPerAcre);
    expect(sown.last.feverLost > 0).toBe(fallow.last.feverLost > 0);
  });
});

describe('the honest ledger never fudges', () => {
  it('names every outcome the year can have, and the year always lands on one of them', () => {
    let checked = 0;
    for (let seed = 1; seed <= 300; seed++) {
      let state = cityModel.init({
        seed,
        scenario: seed % 2 === 0 ? 'classic' : 'year-of-rats',
        seats: 1,
      });
      for (let step = 0; step < 10 && !state.ending; step++) {
        const decree = carefulBot(state, rngForStep(seed, 99));
        const ledger = ledgerFor(state, decree);
        const next = cityModel.resolve(state, decree, rngForStep(seed, step)).state;
        expect(ledger.harvests.map((h) => h.bushels)).toContain(next.last.harvest);
        expect([0, ...ledger.rats.eaten.map((e) => e.bushels)]).toContain(next.last.ratsAte);
        expect(ledger.fed).toBe(next.last.fed > state.people ? state.people : next.last.fed);
        if (!next.ending) {
          expect(next.last.newcomers).toBeGreaterThanOrEqual(ledger.newcomers.low);
          expect(next.last.newcomers).toBeLessThanOrEqual(ledger.newcomers.high);
          expect(next.grain).toBeGreaterThanOrEqual(ledger.storeAfter.low);
          expect(next.grain).toBeLessThanOrEqual(ledger.storeAfter.high);
        }
        checked++;
        state = next;
      }
    }
    expect(checked).toBeGreaterThan(2500);
  });

  it('states the odds the rules use', () => {
    const state = cityModel.init({ seed: 1, scenario: 'classic', seats: 1 });
    const ledger = ledgerFor(state, cityModel.draft(state));
    expect(ledger.rats).toMatchObject({ faces: 2, of: 5 });
    expect(ledger.fever.oneIn).toBe(5);
    expect(ledger.harvests).toHaveLength(5);
    const delta = ledgerFor(
      cityModel.init({ seed: 1, scenario: 'generous-delta', seats: 1 }),
      cityModel.draft(cityModel.init({ seed: 1, scenario: 'generous-delta', seats: 1 })),
    );
    expect(delta.fever.oneIn).toBe(3);
    expect(delta.harvests.map((h) => h.yieldPerAcre)).toEqual([3, 4, 5, 6]);
  });

  it('warns that a decree would end the rule exactly when it would', () => {
    const state = cityModel.init({ seed: 1, scenario: 'classic', seats: 1 });
    expect(ledgerFor(state, { land: 0, food: 1100, plant: 0 }).endsRule).toBe(false);
    expect(ledgerFor(state, { land: 0, food: 1080, plant: 0 }).endsRule).toBe(true);
  });
});
