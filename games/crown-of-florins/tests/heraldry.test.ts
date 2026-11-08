/**
 * Coats of arms: lawful, legible and told apart at a glance. Six seats' arms
 * must differ in field tincture (and so in colour, perceptibly) and in
 * division, every charge must stand out from what it sits on, and the arms
 * editor must keep the rule of tincture whatever the player picks.
 */
import { createRng } from '@one-more-year/kit';
import { describe, expect, it } from 'vitest';
import {
  CHARGES,
  DIVISIONS,
  TINCTURES,
  blazon,
  chargeGround,
  drawCourtArms,
  isArmsSpec,
  obeysTincture,
  type ArmsSpec,
  type Tincture,
} from '../src/lib/heraldry.ts';
import { TINCTURE_COLOURS } from '../src/ui/heraldry-svg.ts';
import { lawful } from '../src/game/screens/court-setup.ts';
import { contrastRatio, deltaE } from './colour.ts';

const colour = (t: Tincture): string => TINCTURE_COLOURS[t];

describe('a court’s arms', () => {
  const courts = Array.from({ length: 200 }, (_, seed) => drawCourtArms(createRng(seed + 1), 6));

  it('keep the rule of tincture on every shield', () => {
    for (const court of courts) for (const arms of court) expect(obeysTincture(arms)).toBe(true);
  });

  it('give each of six seats its own field and its own division', () => {
    for (const court of courts) {
      expect(new Set(court.map((a) => a.field)).size).toBe(6);
      expect(new Set(court.map((a) => a.division)).size).toBe(6);
    }
  });

  it('are told apart by colour: every two fields differ by a clear perceptual distance', () => {
    for (const a of TINCTURES) {
      for (const b of TINCTURES) {
        if (a !== b) expect(deltaE(colour(a), colour(b))).toBeGreaterThan(20);
      }
    }
  });

  it('are legible: every charge and every division stands out at least 3 : 1 from its ground', () => {
    for (const court of courts) {
      for (const arms of court) {
        if (arms.charge !== 'none') {
          expect(
            contrastRatio(colour(arms.chargeTincture), colour(chargeGround(arms))),
          ).toBeGreaterThanOrEqual(3);
        }
        if (arms.division !== 'plain') {
          expect(contrastRatio(colour(arms.field), colour(arms.second))).toBeGreaterThanOrEqual(3);
        }
      }
    }
  });

  it('read back from a save only when whole', () => {
    const arms = courts[0]?.[0] as ArmsSpec;
    expect(isArmsSpec(JSON.parse(JSON.stringify(arms)))).toBe(true);
    expect(isArmsSpec({ ...arms, field: 'tartan' })).toBe(false);
    expect(isArmsSpec({ ...arms, chargeCount: 2 })).toBe(false);
  });

  it('are blazoned in plain words', () => {
    const arms: ArmsSpec = {
      field: 'azure',
      division: 'chief',
      second: 'or',
      charge: 'lily',
      chargeTincture: 'or',
      chargeCount: 3,
    };
    expect(blazon(arms)).toBe('Azure, a chief or; three lilies or');
  });
});

describe('the arms editor', () => {
  it('keeps every shield lawful, whatever part is changed to whatever value', () => {
    const base: ArmsSpec = {
      field: 'gules',
      division: 'per-pale',
      second: 'or',
      charge: 'star',
      chargeTincture: 'argent',
      chargeCount: 1,
    };
    for (const division of DIVISIONS) {
      for (const field of TINCTURES) {
        expect(obeysTincture(lawful({ ...base, division, field }, 'field'))).toBe(true);
        expect(obeysTincture(lawful({ ...base, division, second: field }, 'second'))).toBe(true);
        expect(
          obeysTincture(lawful({ ...base, division, chargeTincture: field }, 'chargeTincture')),
        ).toBe(true);
      }
      for (const charge of CHARGES) {
        expect(obeysTincture(lawful({ ...base, division, charge }, 'charge'))).toBe(true);
      }
    }
  });

  it('keeps the colour the player just chose', () => {
    const base: ArmsSpec = {
      field: 'gules',
      division: 'per-fess',
      second: 'or',
      charge: 'star',
      chargeTincture: 'argent',
      chargeCount: 1,
    };
    expect(lawful({ ...base, field: 'argent' }, 'field').field).toBe('argent');
    expect(lawful({ ...base, chargeTincture: 'vert' }, 'chargeTincture').chargeTincture).toBe(
      'vert',
    );
  });
});
