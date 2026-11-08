/**
 * Drawing a coat of arms: as SVG markup for the interface (rival bar,
 * court setup, hand-over curtain, manuscript) and onto a Canvas 2D context
 * for the banners in the fresco. Both use the same path data, so a banner
 * in the valley and the shield in the rival bar can never disagree.
 *
 * The shield is 100 × 120 units; charges are drawn in a 100 × 100 box and
 * scaled into place. Every charge is our own drawing.
 */
import {
  holdsThree,
  type ArmsSpec,
  type Charge,
  type Division,
  type Tincture,
} from '../lib/heraldry.ts';

/**
 * Heraldic tinctures, mixed toward fresco pigments so arms sit in the
 * painting, and deep enough that every metal stands at least 3 : 1 against
 * every colour (tests/heraldry.test.ts).
 */
export const TINCTURE_COLOURS: Readonly<Record<Tincture, string>> = {
  or: '#d8aa3a',
  argent: '#efe9dc',
  gules: '#a82b1a',
  azure: '#2a5a96',
  vert: '#286240',
  sable: '#29231f',
  purpure: '#6a3778',
};

export const SHIELD_PATH = 'M8 6H92V58C92 90 66 106 50 116C34 106 8 90 8 58Z';

const DIVISION_PATHS: Readonly<Record<Division, string>> = {
  plain: '',
  'per-pale': 'M50 0H100V120H50Z',
  'per-fess': 'M0 58H100V120H0Z',
  'per-bend': 'M0 6L100 116V120H0Z',
  quarterly: 'M50 0H100V58H50ZM0 58H50V120H0Z',
  chief: 'M0 0H100V34H0Z',
  fess: 'M0 44H100V72H0Z',
  pale: 'M37 0H63V120H37Z',
  bend: 'M0 -8L18 -8L100 92V116L82 116L0 16Z',
  chevron: 'M0 96L50 40L100 96V122L50 66L0 122Z',
  bordure: 'M0 0H100V120H0ZM16 14V58C16 84 38 98 50 106C62 98 84 84 84 58V14Z',
  paly: 'M16 0H33V120H16ZM50 0H67V120H50ZM84 0H100V120H84Z',
};

/** Charges in a 100 × 100 box. */
const CHARGE_PATHS: Readonly<Record<Exclude<Charge, 'none'>, string>> = {
  lily:
    'M50 6C59 18 61 31 57 45L55 58H45L43 45C39 31 41 18 50 6Z' +
    'M45 50C34 51 21 45 19 33C17 24 26 18 33 23C25 27 27 37 37 41L46 45Z' +
    'M55 50C66 51 79 45 81 33C83 24 74 18 67 23C75 27 73 37 63 41L54 45Z' +
    'M28 58H72V67H28Z' +
    'M45 67L43 80C35 82 30 88 32 94C38 88 44 88 46 81L50 72L54 81C56 88 62 88 68 94C70 88 65 82 57 80L55 67Z',
  star: starPath(5, 46, 19),
  // Horns up and broad in the belly, as a crescent is blazoned, so it never reads as a thin smile:
  // a deep outer arc under the horns and a much shallower inner arc back between them.
  crescent: 'M20 32A34 34 0 1 0 80 32A42 42 0 0 1 20 32Z',
  tower:
    'M28 94V44H22V26H31V33H40V26H48V33H52V26H60V33H69V26H78V44H72V94ZM43 94V78C43 70 57 70 57 78V94ZM46 52H54V62H46Z',
  key: 'M50 8A16 16 0 1 0 50.1 8ZM50 16A8 8 0 1 1 49.9 16ZM46 38H54V92H46ZM54 70H68V77H54ZM54 82H64V89H54Z',
  crown: 'M16 76L20 36L35 54L50 26L65 54L80 36L84 76ZM16 80H84V90H16Z',
  cross: 'M41 12H59L56 41L88 40V60L56 59L59 88H41L44 59L12 60V40L44 41Z',
  sun: sunPath(),
};

function starPath(points: number, outer: number, inner: number): string {
  const coordinates: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    coordinates.push(`${(50 + Math.cos(a) * r).toFixed(1)} ${(52 + Math.sin(a) * r).toFixed(1)}`);
  }
  return `M${coordinates.join('L')}Z`;
}

function sunPath(): string {
  let rays = '';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const tip = { x: 50 + Math.cos(a) * 46, y: 50 + Math.sin(a) * 46 };
    const left = { x: 50 + Math.cos(a - 0.17) * 24, y: 50 + Math.sin(a - 0.17) * 24 };
    const right = { x: 50 + Math.cos(a + 0.17) * 24, y: 50 + Math.sin(a + 0.17) * 24 };
    rays += `M${left.x.toFixed(1)} ${left.y.toFixed(1)}L${tip.x.toFixed(1)} ${tip.y.toFixed(1)}L${right.x.toFixed(1)} ${right.y.toFixed(1)}Z`;
  }
  return `${rays}M50 30A20 20 0 1 0 50.1 30Z`;
}

interface Placement {
  x: number;
  y: number;
  size: number;
}

/** Where the charges sit on the shield for each division (one, or three). */
export function chargePlacements(arms: ArmsSpec): Placement[] {
  const three = arms.chargeCount === 3 && holdsThree(arms.division);
  switch (arms.division) {
    case 'chief':
      return three
        ? [
            { x: 30, y: 58, size: 24 },
            { x: 70, y: 58, size: 24 },
            { x: 50, y: 88, size: 24 },
          ]
        : [{ x: 50, y: 70, size: 38 }];
    case 'fess':
      return three
        ? [
            { x: 26, y: 58, size: 18 },
            { x: 50, y: 58, size: 18 },
            { x: 74, y: 58, size: 18 },
          ]
        : [{ x: 50, y: 58, size: 22 }];
    case 'pale':
      return three
        ? [
            { x: 50, y: 30, size: 19 },
            { x: 50, y: 58, size: 19 },
            { x: 50, y: 86, size: 19 },
          ]
        : [{ x: 50, y: 58, size: 22 }];
    case 'bend':
      return three
        ? [
            { x: 26, y: 30, size: 16 },
            { x: 50, y: 58, size: 16 },
            { x: 74, y: 86, size: 16 },
          ]
        : [{ x: 50, y: 58, size: 20 }];
    case 'per-pale':
      return [{ x: 29, y: 54, size: 30 }];
    case 'per-fess':
      return [{ x: 50, y: 32, size: 32 }];
    case 'per-bend':
      return [{ x: 68, y: 34, size: 28 }];
    case 'quarterly':
      return [{ x: 29, y: 32, size: 26 }];
    case 'chevron':
      return [{ x: 50, y: 88, size: 26 }];
    case 'bordure':
    case 'plain':
    case 'paly':
      return three
        ? [
            { x: 31, y: 38, size: 26 },
            { x: 69, y: 38, size: 26 },
            { x: 50, y: 80, size: 26 },
          ]
        : [{ x: 50, y: 56, size: 46 }];
  }
}

export interface ArmsSvgOptions {
  /** Width in CSS pixels; the height follows (5:6). */
  width?: number;
  /** An accessible name (the blazon); omit for decorative uses. */
  label?: string;
  /** Outline colour, e.g. the panel's ink. */
  outline?: string;
  idPrefix?: string;
}

let idCounter = 0;

/** The arms as a standalone SVG element's markup. */
export function armsSvg(arms: ArmsSpec, options: ArmsSvgOptions = {}): string {
  const id = options.idPrefix ?? `cf-arms-${++idCounter}`;
  const width = options.width ?? 40;
  const outline = options.outline ?? '#3a2a1e';
  const label = options.label
    ? `role="img" aria-label="${escapeAttribute(options.label)}"`
    : 'aria-hidden="true"';
  const division =
    arms.division === 'plain'
      ? ''
      : `<path d="${DIVISION_PATHS[arms.division]}" fill="${TINCTURE_COLOURS[arms.second]}" fill-rule="evenodd"/>`;
  const charges =
    arms.charge === 'none'
      ? ''
      : chargePlacements(arms)
          .map(
            (p) =>
              `<path d="${CHARGE_PATHS[arms.charge as Exclude<Charge, 'none'>]}" transform="translate(${p.x - p.size / 2} ${p.y - p.size / 2}) scale(${p.size / 100})" fill="${TINCTURE_COLOURS[arms.chargeTincture]}" fill-rule="evenodd" stroke="${outline}" stroke-width="${(100 / p.size) * 0.9}" stroke-linejoin="round"/>`,
          )
          .join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120" width="${width}" height="${width * 1.2}" ${label}>` +
    `<defs><clipPath id="${id}"><path d="${SHIELD_PATH}"/></clipPath></defs>` +
    `<g clip-path="url(#${id})"><rect width="100" height="120" fill="${TINCTURE_COLOURS[arms.field]}"/>${division}${charges}</g>` +
    `<path d="${SHIELD_PATH}" fill="none" stroke="${outline}" stroke-width="3" stroke-linejoin="round"/>` +
    `</svg>`
  );
}

/** Paints the arms into a rectangle of a 2D canvas (banners, the valley's pennants). */
export function drawArms(
  context: CanvasRenderingContext2D,
  arms: ArmsSpec,
  x: number,
  y: number,
  width: number,
  options: { shield?: boolean; outline?: string } = {},
): void {
  const scale = width / 100;
  context.save();
  context.translate(x, y);
  context.scale(scale, scale);
  const shape = options.shield === false ? new Path2D('M0 0H100V120H0Z') : new Path2D(SHIELD_PATH);
  context.save();
  context.clip(shape);
  context.fillStyle = TINCTURE_COLOURS[arms.field];
  context.fillRect(0, 0, 100, 120);
  if (arms.division !== 'plain') {
    context.fillStyle = TINCTURE_COLOURS[arms.second];
    context.fill(new Path2D(DIVISION_PATHS[arms.division]), 'evenodd');
  }
  if (arms.charge !== 'none') {
    const path = new Path2D(CHARGE_PATHS[arms.charge]);
    for (const p of chargePlacements(arms)) {
      context.save();
      context.translate(p.x - p.size / 2, p.y - p.size / 2);
      context.scale(p.size / 100, p.size / 100);
      context.fillStyle = TINCTURE_COLOURS[arms.chargeTincture];
      context.fill(path, 'evenodd');
      context.strokeStyle = options.outline ?? '#3a2a1e';
      context.lineWidth = (100 / p.size) * 0.9;
      context.stroke(path);
      context.restore();
    }
  }
  context.restore();
  if (options.shield !== false) {
    context.strokeStyle = options.outline ?? '#3a2a1e';
    context.lineWidth = 3;
    context.stroke(shape);
  }
  context.restore();
}

function escapeAttribute(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
