/**
 * The AI rivals: each a real policy through the same plan a human fills in,
 * each recognisable at a glance, each better than a ruler who never builds,
 * and none of them peeking at what a human in its seat could not see.
 */
import { createRng } from '@one-more-year/kit';
import { describe, expect, it } from 'vitest';
import { PERSONALITIES } from '../src/content/names.ts';
import { BOTS } from '../src/engine/bots.ts';
import { profilesOf, rivalRealms, runBalance, type BalanceTally } from '../src/engine/balance.ts';
import { quickCourt } from '../src/engine/court.ts';
import { policyFor, rivalLapse } from '../src/engine/policies.ts';
import { playGame } from '../src/engine/simulate.ts';
import { policyView } from '../src/engine/world.ts';
import type { Personality, Realm } from '../src/engine/state.ts';

const realms = rivalRealms(200, 30);
const profiles = profilesOf(realms);
const others = (personality: Personality): Personality[] =>
  PERSONALITIES.filter((p) => p !== personality);
const commerceShare = (p: Personality): number => {
  const { markets, mills, monuments } = profiles[p];
  return (markets + mills) / Math.max(1, markets + mills + monuments);
};
const monumentShare = (p: Personality): number => 1 - commerceShare(p);

describe('the personalities are recognisable', () => {
  it('the General keeps the biggest armies: twice his share of the valley’s top fifth', () => {
    // By chance each of the five would hold a fifth of the top fifth.
    const bySize = [...realms].sort((a, b) => b.realm.people.soldiers - a.realm.people.soldiers);
    const topFifth = bySize.slice(0, Math.ceil(bySize.length / 5));
    const generals = topFifth.filter((r) => r.personality === 'general').length;
    expect(generals / topFifth.length).toBeGreaterThan(0.4);
    for (const p of others('general')) {
      expect(profiles.general.soldiers).toBeGreaterThan(profiles[p].soldiers);
    }
  });

  it('the Merchant taxes trade lightest and spends the most on markets and mills', () => {
    for (const p of others('merchant')) {
      expect(profiles.merchant.customs).toBeLessThan(profiles[p].customs);
      expect(commerceShare('merchant')).toBeGreaterThan(commerceShare(p));
    }
  });

  it('the Builder spends the most on the palace and the cathedral', () => {
    for (const p of others('builder')) {
      expect(monumentShare('builder')).toBeGreaterThan(monumentShare(p));
    }
  });

  it('the Miser keeps the fullest treasury and the heaviest taxes', () => {
    for (const p of others('miser')) {
      expect(profiles.miser.treasury).toBeGreaterThan(profiles[p].treasury);
      expect(profiles.miser.taxBurden).toBeGreaterThan(profiles[p].taxBurden);
    }
  });

  it('the Saint keeps the mildest courts', () => {
    expect(profiles.saint.justice).toBeCloseTo(1);
    for (const p of others('saint')) {
      expect(profiles.saint.justice).toBeLessThan(profiles[p].justice);
    }
  });
});

describe('every personality rules better than a ruler who never builds', () => {
  const meanTitle = (tally: BalanceTally): number =>
    tally.titles.reduce((sum, share, i) => sum + share * (i + 1), 0);
  const naive = runBalance({ bot: BOTS.naive, rivals: 'mixed', games: 200 });

  for (const personality of PERSONALITIES) {
    it(`the ${personality} reaches the crown sometimes and a title higher on average`, () => {
      const tally = runBalance({ bot: policyFor(personality), rivals: 'mixed', games: 200 });
      expect(tally.crowned).toBeGreaterThan(0.1);
      expect(meanTitle(tally)).toBeGreaterThan(meanTitle(naive) + 1);
    });
  }
});

describe('no rival peeks', () => {
  // A valley twelve years in, with the rivals' years about to be planned.
  const { world } = playGame({
    seed: 21,
    court: quickCourt(21, 1, 3, { difficulty: 3 }),
    bot: BOTS.competent,
    maxSteps: 12,
  });
  const seatOf = (w: typeof world): Realm => {
    const rival = w.realms.find((r) => r.controller.kind === 'ai');
    if (!rival) throw new Error('no rival seated');
    return { ...rival, opening: w.realms[0]?.opening ?? rival.opening };
  };
  const planFor = (w: typeof world, realm: Realm): string => {
    const personality = realm.controller.kind === 'ai' ? realm.controller.personality : 'merchant';
    const policy = policyFor(personality, { aggressive: false, lapse: rivalLapse(3) });
    return JSON.stringify(policy(policyView(w, realm), createRng(5).fork('peek')));
  };

  it('plans the same year whatever its ruler’s hidden death year', () => {
    const realm = seatOf(world);
    const sooner = { ...realm, ruler: { ...realm.ruler, deathYear: world.year + 1 } };
    const later = { ...realm, ruler: { ...realm.ruler, deathYear: world.year + 30 } };
    expect(planFor(world, sooner)).toBe(planFor(world, later));
  });

  it('plans the same year whatever the rivals hold beyond the published standings', () => {
    const realm = seatOf(world);
    const richer = {
      ...world,
      realms: world.realms.map((r) =>
        r.seat === realm.seat ? r : { ...r, treasury: r.treasury + 50_000, grain: 0 },
      ),
    };
    expect(planFor(richer, realm)).toBe(planFor(world, realm));
  });
});
