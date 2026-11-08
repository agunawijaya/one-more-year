/**
 * The balance targets of the 1978 valley, locked with the numbers recorded
 * in docs/NOTES.md: four seats, Journeyman, the founder's reign. Seeds run
 * 1…N, so every tally is exact; the tolerances leave room for small,
 * deliberate changes to the bots.
 */
import { describe, expect, it } from 'vitest';
import { BOTS } from '../src/engine/bots.ts';
import { runBalance } from '../src/engine/balance.ts';

const GAMES = 400;

describe('a competent ruler against three rivals', () => {
  const tally = runBalance({ bot: BOTS.competent, rivals: 'mixed', games: GAMES });

  it('is crowned before death in 30–55 % of games', () => {
    expect(tally.crowned).toBeGreaterThanOrEqual(0.3);
    expect(tally.crowned).toBeLessThanOrEqual(0.55);
  });

  it('takes 25–35 years to the crown, at the median', () => {
    expect(tally.medianYears).toBeGreaterThanOrEqual(25);
    expect(tally.medianYears).toBeLessThanOrEqual(35);
  });

  it('is almost never ruined', () => {
    expect(tally.bankruptOrInvaded).toBeLessThan(0.15);
  });
});

describe('a naive ruler (never builds, mid taxes)', () => {
  const tally = runBalance({ bot: BOTS.naive, rivals: 'mixed', games: GAMES });

  it('is never crowned', () => {
    expect(tally.crowned).toBe(0);
  });

  it('is bankrupt or invaded in fewer than 40 % of games', () => {
    expect(tally.bankruptOrInvaded).toBeLessThan(0.4);
  });
});

describe('the seats', () => {
  it('give no seat more than five points over the average crown rate', () => {
    const tally = runBalance({
      bot: BOTS.competent,
      rivals: 'mixed',
      games: GAMES,
      seat: 'rotate',
    });
    const mean = tally.bySeat.reduce((sum, share) => sum + share, 0) / tally.bySeat.length;
    for (const share of tally.bySeat) expect(Math.abs(share - mean)).toBeLessThanOrEqual(0.05);
  });
});

describe('chance alone', () => {
  it('never wears the crown', () => {
    expect(runBalance({ bot: BOTS.random, rivals: 'mixed', games: 200 }).crowned).toBe(0);
  });
});
