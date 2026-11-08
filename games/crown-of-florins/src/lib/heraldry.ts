/**
 * Coats of arms as plain data: a field, a division, and a charge, in the
 * heraldic tinctures. Drawn by ui/heraldry-svg.ts on banners, in the rival
 * bar, on the hand-over curtain and in the manuscript.
 *
 * The rule of tincture keeps every shield legible: metal (or, argent) is
 * never laid on metal, nor colour on colour, so a charge always stands out
 * from what it sits on. Arms for a court are drawn so that no two seats
 * share a field tincture or a division, which keeps six banners apart at a
 * glance (the perceptual check is in tests/heraldry.test.ts).
 */
import type { Rng } from '@one-more-year/kit';

export type Metal = 'or' | 'argent';
export type Colour = 'gules' | 'azure' | 'vert' | 'sable' | 'purpure';
export type Tincture = Metal | Colour;

export const METALS: readonly Metal[] = ['or', 'argent'];
export const COLOURS: readonly Colour[] = ['gules', 'azure', 'vert', 'sable', 'purpure'];
export const TINCTURES: readonly Tincture[] = [...METALS, ...COLOURS];

export type Division =
  | 'plain'
  | 'per-pale'
  | 'per-fess'
  | 'per-bend'
  | 'quarterly'
  | 'chief'
  | 'fess'
  | 'pale'
  | 'bend'
  | 'chevron'
  | 'bordure'
  | 'paly';

export const DIVISIONS: readonly Division[] = [
  'plain',
  'per-pale',
  'per-fess',
  'per-bend',
  'quarterly',
  'chief',
  'fess',
  'pale',
  'bend',
  'chevron',
  'bordure',
  'paly',
];

export type Charge =
  'none' | 'lily' | 'star' | 'crescent' | 'tower' | 'key' | 'crown' | 'cross' | 'sun';

export const CHARGES: readonly Charge[] = [
  'lily',
  'star',
  'crescent',
  'tower',
  'key',
  'crown',
  'cross',
  'sun',
];

export interface ArmsSpec {
  /** The main tincture of the shield. */
  field: Tincture;
  division: Division;
  /** The tincture of the division (the other half, the chief, the ordinary). */
  second: Tincture;
  charge: Charge;
  chargeTincture: Tincture;
  /** One charge, or three (two over one). */
  chargeCount: 1 | 3;
}

export function isMetal(tincture: Tincture): tincture is Metal {
  return tincture === 'or' || tincture === 'argent';
}

/** A tincture of the other kind: a colour for a metal, a metal for a colour. */
export function contrasting(tincture: Tincture, rng: Rng): Tincture {
  return isMetal(tincture) ? rng.pick(COLOURS) : rng.pick(METALS);
}

/** True when the arms keep the rule of tincture everywhere a charge or division meets the field. */
export function obeysTincture(arms: ArmsSpec): boolean {
  if (arms.division !== 'plain' && isMetal(arms.field) === isMetal(arms.second)) return false;
  if (arms.charge === 'none') return true;
  return isMetal(arms.chargeTincture) !== isMetal(chargeGround(arms));
}

/** Which tincture a charge is laid on for this division. */
export function chargeGround(arms: ArmsSpec): Tincture {
  switch (arms.division) {
    case 'fess':
    case 'pale':
    case 'bend':
      // Charges ride on the ordinary.
      return arms.second;
    default:
      return arms.field;
  }
}

/** Divisions that leave room for three charges; the rest carry one. */
export function holdsThree(division: Division): boolean {
  return ['plain', 'bordure', 'chief', 'fess', 'pale', 'bend'].includes(division);
}

/** One coat of arms, avoiding the field tinctures and divisions already taken. */
export function drawArms(
  rng: Rng,
  taken: { fields: ReadonlySet<Tincture>; divisions: ReadonlySet<Division> } = {
    fields: new Set(),
    divisions: new Set(),
  },
): ArmsSpec {
  const freeFields = TINCTURES.filter((t) => !taken.fields.has(t));
  const field = rng.pick(freeFields.length > 0 ? freeFields : TINCTURES);
  const freeDivisions = DIVISIONS.filter((d) => !taken.divisions.has(d));
  const division = rng.pick(freeDivisions.length > 0 ? freeDivisions : DIVISIONS);
  const second = contrasting(field, rng);
  // Stripes leave no clear ground for a charge.
  const charge = division === 'paly' ? 'none' : rng.pick(CHARGES);
  const draft: ArmsSpec = {
    field,
    division,
    second,
    charge,
    chargeTincture: field,
    chargeCount: holdsThree(division) && rng.chance(0.4) ? 3 : 1,
  };
  draft.chargeTincture = contrasting(chargeGround(draft), rng);
  return draft;
}

/** Arms for a whole court: every seat with its own field tincture and division. */
export function drawCourtArms(rng: Rng, seats: number): ArmsSpec[] {
  const fields = new Set<Tincture>();
  const divisions = new Set<Division>();
  const arms: ArmsSpec[] = [];
  for (let seat = 0; seat < seats; seat++) {
    const next = drawArms(rng.fork(`arms:${seat}`), { fields, divisions });
    fields.add(next.field);
    divisions.add(next.division);
    arms.push(next);
  }
  return arms;
}

/** True when a value read back from a save is a whole, lawful coat of arms. */
export function isArmsSpec(value: unknown): value is ArmsSpec {
  if (!value || typeof value !== 'object') return false;
  const arms = value as Record<string, unknown>;
  const known = <T extends string>(list: readonly T[], item: unknown): item is T =>
    typeof item === 'string' && (list as readonly string[]).includes(item);
  return (
    known(TINCTURES, arms.field) &&
    known(DIVISIONS, arms.division) &&
    known(TINCTURES, arms.second) &&
    (arms.charge === 'none' || known(CHARGES, arms.charge)) &&
    known(TINCTURES, arms.chargeTincture) &&
    (arms.chargeCount === 1 || arms.chargeCount === 3)
  );
}

/** A plain-words blazon, for screen readers and the court setup ("Azure, a lily or"). */
export function blazon(arms: ArmsSpec): string {
  const name = (t: Tincture): string => t;
  const field =
    arms.division === 'plain'
      ? capitalise(name(arms.field))
      : `${capitalise(name(arms.field))}, ${DIVISION_WORDS[arms.division]} ${name(arms.second)}`;
  if (arms.charge === 'none') return field;
  const charge =
    arms.chargeCount === 3 ? `three ${CHARGE_PLURALS[arms.charge]}` : `a ${arms.charge}`;
  return `${field}; ${charge} ${name(arms.chargeTincture)}`;
}

const DIVISION_WORDS: Record<Division, string> = {
  plain: '',
  'per-pale': 'parted down the middle with',
  'per-fess': 'parted across with',
  'per-bend': 'parted diagonally with',
  quarterly: 'quartered with',
  chief: 'a chief',
  fess: 'a fess',
  pale: 'a pale',
  bend: 'a bend',
  chevron: 'a chevron',
  bordure: 'a border',
  paly: 'striped with',
};

const CHARGE_PLURALS: Record<Charge, string> = {
  none: '',
  lily: 'lilies',
  star: 'stars',
  crescent: 'crescents',
  tower: 'towers',
  key: 'keys',
  crown: 'crowns',
  cross: 'crosses',
  sun: 'suns',
};

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
