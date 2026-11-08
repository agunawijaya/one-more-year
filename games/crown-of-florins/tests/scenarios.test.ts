/**
 * The scenarios: each changes only what it says, each is winnable by a
 * competent ruler in at least 15 % of worlds, and Endless Dynasty keeps
 * going past the crown until the chronicle is closed.
 */
import { describe, expect, it } from 'vitest';
import { BOTS } from '../src/engine/bots.ts';
import { runBalance } from '../src/engine/balance.ts';
import { quickCourt } from '../src/engine/court.ts';
import { validatePlan, openingPlan } from '../src/engine/plan.ts';
import { CURATED_SCENARIOS, CENTURY_END, scenarioFor } from '../src/engine/scenarios.ts';
import { playGame } from '../src/engine/simulate.ts';
import { actingRealm, createWorld, playStep } from '../src/engine/world.ts';
import { heirComesForward } from '../src/engine/year.ts';
import { rngForStep } from '@one-more-year/kit';
import type { Realm } from '../src/engine/state.ts';

const court = quickCourt(3, 1, 3);
const human = (scenario: string): Realm => {
  const realm = createWorld(3, { scenario, court }).realms.find(
    (r) => r.controller.kind === 'human',
  );
  if (!realm) throw new Error('no human seat');
  return realm;
};

describe('each scenario is winnable', () => {
  for (const scenario of CURATED_SCENARIOS) {
    it(`${scenario}: a competent ruler is crowned in at least 15 % of worlds`, () => {
      const tally = runBalance({ bot: BOTS.competent, rivals: 'mixed', games: 300, scenario });
      expect(tally.crowned).toBeGreaterThanOrEqual(0.15);
    });
  }
});

describe('each scenario changes what it says', () => {
  it('Narrow Valley: little land, rich soil', () => {
    expect(human('narrow-valley').land).toBe(6500);
    expect(scenarioFor('narrow-valley').terms.yieldFactor).toBeGreaterThan(1);
  });

  it('Borrowed Crown: a Barone deep in debt, rivals untouched', () => {
    const world = createWorld(3, { scenario: 'borrowed-crown', court });
    const you = world.realms.find((r) => r.controller.kind === 'human');
    expect(you?.title).toBe(2);
    expect(you?.treasury).toBeLessThan(0);
    for (const rival of world.realms.filter((r) => r.controller.kind === 'ai')) {
      expect(rival.treasury).toBe(1000);
    }
  });

  it('The General Next Door: an aggressive General with a head start', () => {
    const world = createWorld(3, { scenario: 'general-next-door', court });
    const general = world.realms.find(
      (r) => r.controller.kind === 'ai' && r.controller.personality === 'general',
    );
    expect(general?.controller).toMatchObject({ aggressive: true });
    expect(general?.people.soldiers).toBe(55);
    expect(world.standings.find((s) => s.seat === general?.seat)?.aggressive).toBe(true);
  });

  it('Harbour Town: land can be sold but never bought', () => {
    const world = createWorld(3, { scenario: 'harbour-town', court });
    const realm = actingRealm(world);
    const buy = { ...openingPlan(realm), land: 100 };
    const sell = { ...openingPlan(realm), land: -100 };
    expect(validatePlan(realm, buy, world.terms).some((i) => i.field === 'land')).toBe(true);
    expect(validatePlan(realm, sell, world.terms).some((i) => i.field === 'land')).toBe(false);
  });

  it('Year of Fevers ends in 1460; the others at the century', () => {
    expect(scenarioFor('year-of-fevers').endYear).toBe(1460);
    expect(scenarioFor('standard').endYear).toBe(CENTURY_END);
    expect(scenarioFor('endless').endYear).toBeNull();
  });
});

describe('Endless Dynasty', () => {
  it('goes on past the crown', () => {
    const { world } = playGame({
      seed: 4,
      court: quickCourt(4, 1, 3, { difficulty: 1 }),
      scenario: 'endless',
      bot: BOTS.general,
      maxSteps: 90,
    });
    const you = world.realms.find((r) => r.controller.kind === 'human');
    expect(you?.record.crownedYear).not.toBeNull();
    expect(world.end?.ending ?? 'still playing').not.toBe('crowned');
  });

  it('ends when the ruler closes the chronicle', () => {
    const world = createWorld(4, { scenario: 'endless', court: quickCourt(4, 1, 3) });
    const plan = { ...openingPlan(actingRealm(world)), retire: true };
    const { world: after, events } = playStep(world, plan, rngForStep(4, 0));
    expect(after.end?.ending).toBe('retired');
    expect(events.map((e) => e.kind)).toEqual(['retired']);
  });

  it('ignores a request to retire outside Endless Dynasty', () => {
    const world = createWorld(4, { scenario: 'standard', court: quickCourt(4, 1, 3) });
    const plan = { ...openingPlan(actingRealm(world)), retire: true };
    expect(playStep(world, plan, rngForStep(4, 0)).world.end).toBeNull();
  });
});

describe('the end of a line', () => {
  it('comes when a Cavaliere dies in debt, and only then', () => {
    const realm = human('standard');
    expect(heirComesForward({ ...realm, title: 1, treasury: -1 })).toBe(false);
    expect(heirComesForward({ ...realm, title: 1, treasury: 0 })).toBe(true);
    expect(heirComesForward({ ...realm, title: 2, treasury: -5000 })).toBe(true);
  });
});
