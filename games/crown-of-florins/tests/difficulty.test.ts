/**
 * The four difficulty levels, which the 1978 conversion asked about and
 * then forgot: each one must lower a competent ruler's chances noticeably,
 * Grand Master must stay winnable, and the rivals must play sharper as the
 * level rises.
 */
import { describe, expect, it } from 'vitest';
import { BOTS } from '../src/engine/bots.ts';
import { rivalRealms, type RivalRealm } from '../src/engine/balance.ts';
import { runBalance } from '../src/engine/balance.ts';
import { rivalLapse } from '../src/engine/policies.ts';
import { titlePoints } from '../src/engine/title.ts';
import { titleInputs } from '../src/engine/year.ts';
import type { Difficulty } from '../src/engine/state.ts';

const GAMES = 300;
const LEVELS: Difficulty[] = [1, 2, 3, 4];

describe('difficulty', () => {
  const crowned = LEVELS.map(
    (difficulty) =>
      runBalance({ bot: BOTS.competent, rivals: 'mixed', games: GAMES, difficulty }).crowned,
  );

  it('lowers the crown rate by at least four points at every step', () => {
    for (let i = 1; i < crowned.length; i++) {
      expect((crowned[i - 1] ?? 0) - (crowned[i] ?? 0)).toBeGreaterThanOrEqual(0.04);
    }
  });

  it('leaves Grand Master winnable in at least 8 % of games', () => {
    expect(crowned[3]).toBeGreaterThanOrEqual(0.08);
  });
});

describe('the rivals’ skill', () => {
  const meanPoints = (realms: readonly RivalRealm[]): number =>
    realms.reduce((sum, { realm }) => sum + titlePoints(titleInputs(realm)), 0) / realms.length;

  it('gives an Apprentice’s rivals off years and a Grand Master’s none', () => {
    expect(rivalLapse(1)).toBeGreaterThan(rivalLapse(2));
    expect(rivalLapse(2)).toBeGreaterThan(rivalLapse(3));
    expect(rivalLapse(4)).toBe(0);
  });

  it('builds a Grand Master’s rivals at least a tenth more title points in thirty years', () => {
    const apprentice = meanPoints(rivalRealms(100, 30, 1));
    const grandMaster = meanPoints(rivalRealms(100, 30, 4));
    expect(grandMaster).toBeGreaterThan(apprentice * 1.1);
  });
});
