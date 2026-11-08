/**
 * The ruler's portrait: a profile bust in the manner of fifteenth-century
 * court portraits, under a round arch, against a lapis sky over a small
 * landscape. Drawn in SVG from a seed (the ruler's name and generation), so
 * every ruler of a dynasty has a face of their own and keeps it.
 *
 * The portrait carries the lifetime omens the glass box promises, and only
 * from the public odds: hair greys with age, and a candle at the foot of
 * the frame burns lower as the years the rule allows run out.
 */
import { createRng, hashString } from '@one-more-year/kit';
import type { Ruler } from '../engine/state.ts';

export interface PortraitOptions {
  ruler: Ruler;
  age: number;
  title: number;
  /** 0 a new candle, 1 burnt out (from the life band, never the hidden year). */
  candle: number;
  appearance: 'light' | 'dark';
  /** An accessible description; omit for decorative copies. */
  label?: string;
  width?: number;
}

interface Face {
  nose: number;
  hook: number;
  chin: number;
  brow: number;
  lip: number;
  hair: string;
  robe: string;
  trim: string;
  hat: 'mazzocchio' | 'cap' | 'bare';
  skin: string;
}

const HAIR = ['#2a1d14', '#4a2c18', '#6b3b1c', '#8a5a2a', '#b08040'];
const ROBES = ['#9b2a1a', '#24477e', '#2f6a52', '#6a2d5a', '#7a4a1e'];
const TRIMS = ['#d8aa3a', '#e8dcc0', '#c9973f'];
const SKINS = ['#dcae8e', '#d4a07e', '#c99272', '#e2b896'];

function faceFor(ruler: Ruler): Face {
  const rng = createRng(hashString(`portrait:${ruler.name}:${ruler.generation}`));
  return {
    nose: rng.next(),
    hook: rng.next(),
    chin: rng.next(),
    brow: rng.next(),
    lip: rng.next(),
    hair: rng.pick(HAIR),
    robe: rng.pick(ROBES),
    trim: rng.pick(TRIMS),
    hat: rng.pick(['mazzocchio', 'cap', 'bare'] as const),
    skin: rng.pick(SKINS),
  };
}

/** A smooth path through points (Catmull–Rom as cubic Béziers). */
function smooth(points: readonly [number, number][]): string {
  if (points.length < 2) return '';
  const first = points[0] as [number, number];
  let d = `M${first[0].toFixed(1)} ${first[1].toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)] as [number, number];
    const p1 = points[i] as [number, number];
    const p2 = points[i + 1] as [number, number];
    const p3 = points[Math.min(points.length - 1, i + 2)] as [number, number];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0]?.toFixed(1)} ${c1[1]?.toFixed(1)} ${c2[0]?.toFixed(1)} ${c2[1]?.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

function mixHex(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${pa
    .map((v, i) =>
      Math.round(v + ((pb[i] ?? v) - v) * t)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

let portraitCount = 0;

export function portraitSvg(options: PortraitOptions): string {
  const face = faceFor(options.ruler);
  const id = `cf-portrait-${++portraitCount}`;
  const dark = options.appearance === 'dark';
  const female = options.ruler.form === 'f';
  const grey = Math.min(1, Math.max(0, (options.age - 42) / 30));
  const hair = mixHex(face.hair, '#cfc8bc', grey * 0.85);
  const width = options.width ?? 200;

  // The profile, facing left, in the proportions of a court portrait: a high forehead, a gentle
  // nose, small lips and chin, a long slender neck.
  const n = face.nose;
  const profile: [number, number][] = [
    [110, 52],
    [97 - face.brow, 61],
    [91 - face.brow * 1.5, 74],
    [89 - face.brow * 1.5, 85],
    [91, 91],
    [88 - n * 2, 99],
    [82 - n * 4, 110 + n * 2 + face.hook * 1.5],
    [84 - n, 115],
    [89, 117],
    [87 - face.lip, 121],
    [90, 124],
    [88 - face.lip, 128],
    [91, 132],
    [89 - face.chin * 2.5, 139],
    [96, 146],
    [105, 152],
    [109, 168],
    [109, 194],
  ];
  const back: [number, number][] = [
    [135, 194],
    [136, 166],
    [142, 146],
    [156, 124],
    [160, 96],
    [150, 66],
    [130, 50],
    [110, 52],
  ];
  const head = `${smooth(profile)}L${smooth(back).slice(1)}Z`;

  const skyTop = dark ? '#0d1838' : '#2b5a8f';
  const skyLow = dark ? '#2a3765' : '#a9c0cf';
  const land = dark ? '#28301f' : '#7f8a4c';
  const landFar = dark ? '#343a46' : '#9aa37a';
  const ink = dark ? '#0f0b08' : '#3a2a1e';
  const skin = dark ? mixHex(face.skin, '#7a5a40', 0.25) : face.skin;
  const skinShade = mixHex(skin, '#7c6a4c', 0.45);

  const crown = options.title >= 6;
  const candleHeight = 6 + 44 * (1 - options.candle);
  const candleTop = 236 - candleHeight;
  const flameSize = 0.5 + 0.5 * (1 - options.candle);

  const headwear = female
    ? // A pearl-studded net over gathered hair, and a string of pearls at the brow.
      `<path d="M109 53C125 43 151 50 159 76C165 96 159 116 149 126C141 112 129 100 115 92C107 82 103 66 109 53Z" fill="${hair}" stroke="${ink}" stroke-width="1.2"/>` +
      `<path d="M116 60C126 70 134 82 140 96M122 54C134 64 144 78 150 92" fill="none" stroke="${mixHex(hair, '#ffffff', 0.18)}" stroke-width="1" opacity="0.7"/>` +
      `<circle cx="149" cy="100" r="21" fill="${mixHex(hair, '#000000', 0.2)}" stroke="${ink}" stroke-width="1.2"/>` +
      `<g fill="#f3ead8" stroke="${ink}" stroke-width="0.5">${Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * Math.PI * 2;
        return `<circle cx="${(149 + Math.cos(a) * 15).toFixed(1)}" cy="${(100 + Math.sin(a) * 15).toFixed(1)}" r="1.6"/>`;
      }).join('')}</g>` +
      `<path d="M106 64C120 58 136 58 150 66" fill="none" stroke="#f3ead8" stroke-width="2.4" stroke-dasharray="0.1 4.2" stroke-linecap="round"/>`
    : face.hat === 'mazzocchio' && !crown
      ? // The padded round hat with its long scarf falling behind.
        `<path d="M98 70C92 46 112 30 136 32C160 34 172 54 164 76C156 88 120 86 98 70Z" fill="${face.robe}" stroke="${ink}" stroke-width="1.3"/>` +
        `<path d="M158 74C170 100 168 140 160 176L150 178C156 140 154 106 146 84Z" fill="${mixHex(face.robe, '#000000', 0.18)}" stroke="${ink}" stroke-width="1.1"/>`
      : face.hat === 'cap' && !crown
        ? `<path d="M100 66C100 48 120 40 138 42C156 44 162 58 158 74C140 70 118 70 100 66Z" fill="${face.robe}" stroke="${ink}" stroke-width="1.3"/>` +
          `<path d="M150 74C158 92 156 116 146 130C138 112 136 92 140 78Z" fill="${hair}" stroke="${ink}" stroke-width="1"/>`
        : `<path d="M104 60C120 48 146 52 156 76C160 96 154 116 142 130C138 112 128 96 114 88C106 80 100 68 104 60Z" fill="${hair}" stroke="${ink}" stroke-width="1.2"/>`;

  const crownMarkup = crown
    ? `<path d="M106 58L110 44L118 54L127 38L136 54L144 44L148 58C134 54 120 54 106 58Z" fill="#d8aa3a" stroke="${ink}" stroke-width="1.1"/>` +
      `<circle cx="127" cy="42" r="2.2" fill="#b3301e"/><circle cx="110" cy="47" r="1.6" fill="#2a5a96"/><circle cx="144" cy="47" r="1.6" fill="#2a5a96"/>`
    : '';

  const lines =
    options.age > 45
      ? `<path d="M90 94L84 92M91 98L85 99" stroke="${skinShade}" stroke-width="0.9" fill="none"/>` +
        `<path d="M92 116C96 122 96 128 92 134" stroke="${skinShade}" stroke-width="0.8" fill="none" opacity="${Math.min(1, (options.age - 45) / 20)}"/>`
      : '';

  const label = options.label
    ? `role="img" aria-label="${options.label.replace(/"/g, '&quot;')}"`
    : 'aria-hidden="true"';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 250" width="${width}" height="${width * 1.25}" ${label} class="cf-portrait">` +
    `<defs>` +
    `<clipPath id="${id}-arch"><path d="M12 250V78A88 88 0 0 1 188 78V250Z"/></clipPath>` +
    `<linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${skyTop}"/><stop offset="0.78" stop-color="${skyLow}"/></linearGradient>` +
    `<pattern id="${id}-brocade" width="14" height="16" patternUnits="userSpaceOnUse"><rect width="14" height="16" fill="${face.robe}"/><path d="M7 2C10 5 10 9 7 12C4 9 4 5 7 2Z" fill="${mixHex(face.robe, face.trim, 0.45)}"/><circle cx="0" cy="14" r="1.2" fill="${face.trim}" opacity="0.7"/><circle cx="14" cy="14" r="1.2" fill="${face.trim}" opacity="0.7"/></pattern>` +
    `<linearGradient id="${id}-skin" x1="0.1" y1="0.4" x2="0.9" y2="0.6"><stop offset="0" stop-color="${mixHex(skin, '#fff4e4', 0.22)}"/><stop offset="0.55" stop-color="${skin}"/><stop offset="1" stop-color="${skinShade}"/></linearGradient>` +
    `<radialGradient id="${id}-glow" cx="0.82" cy="0.86" r="0.6"><stop offset="0" stop-color="#ffbe5c" stop-opacity="${dark ? 0.45 : 0}"/><stop offset="1" stop-color="#ffbe5c" stop-opacity="0"/></radialGradient>` +
    `<filter id="${id}-plaster"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 0.5  0 0 0 0 0.45  0 0 0 0 0.38  0 0 0 0.16 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>` +
    `</defs>` +
    `<g clip-path="url(#${id}-arch)">` +
    `<rect width="200" height="250" fill="url(#${id}-sky)"/>` +
    (dark
      ? Array.from({ length: 14 }, (_, i) => {
          const rng = createRng(i * 31 + 7);
          return `<circle cx="${(20 + rng.next() * 160).toFixed(0)}" cy="${(30 + rng.next() * 110).toFixed(0)}" r="1.2" fill="#e2b44c"/>`;
        }).join('')
      : '') +
    `<path d="M0 196C30 186 52 190 76 198C100 206 128 184 156 188C176 191 190 196 200 200V250H0Z" fill="${landFar}"/>` +
    `<path d="M0 214C40 204 70 214 100 210C140 205 168 212 200 206V250H0Z" fill="${land}"/>` +
    `<path d="M20 214C40 222 60 218 70 228" stroke="${dark ? '#3a4a70' : '#6f98a6'}" stroke-width="3" fill="none"/>` +
    `<path d="M168 206l3 -16l3 16z M176 207l2.5 -12l2.5 12z" fill="${dark ? '#1a2416' : '#3b4a2a'}"/>` +
    // The bust: robe in brocade with a trimmed collar.
    `<path d="M24 250C34 210 66 194 98 188L134 188C166 194 186 214 196 250Z" fill="url(#${id}-brocade)" stroke="${ink}" stroke-width="1.4"/>` +
    `<path d="M92 190C104 200 128 200 140 190" fill="none" stroke="${face.trim}" stroke-width="4"/>` +
    // The head and neck, modelled from the light at the face to green-earth shade behind the jaw,
    // as fresco painters laid flesh over verdaccio.
    `<path d="${head}" fill="url(#${id}-skin)" stroke="${ink}" stroke-width="1.3" stroke-linejoin="round"/>` +
    `<path d="M116 150C126 162 132 178 134 194L112 194C113 176 114 162 116 150Z" fill="${skinShade}" opacity="0.35"/>` +
    `<path d="M106 140C116 146 128 146 138 138" fill="none" stroke="${skinShade}" stroke-width="2" opacity="0.4"/>` +
    `<ellipse cx="103" cy="117" rx="8" ry="5.5" fill="#c66a58" opacity="0.26"/>` +
    // Lips: a little vermilion.
    `<path d="M88.5 121.5C92 120.5 94 121.5 95 123C93 124 90.5 124.5 89.5 124Z" fill="#b5503c" opacity="0.85"/>` +
    // Eye, lid and brow.
    `<path d="M95 93.5C98 91 102.5 91 105 93.5C102 95.6 98 95.8 95 93.5Z" fill="#f3ead8" stroke="${ink}" stroke-width="0.9"/>` +
    `<circle cx="97.6" cy="93.4" r="1.5" fill="${ink}"/>` +
    `<path d="M94.5 92.6C98 89.6 103 89.8 106 92.6" fill="none" stroke="${ink}" stroke-width="1.1"/>` +
    `<path d="M93 86.5C97 84 103 84 108 86" fill="none" stroke="${mixHex(hair, ink, 0.35)}" stroke-width="1.5" stroke-linecap="round"/>` +
    // The nostril and the corner of the mouth.
    `<path d="M86.5 112.5C88 113.5 89 113.5 90 112.8" fill="none" stroke="${skinShade}" stroke-width="1"/>` +
    (female
      ? ''
      : `<path d="M128 98C134 96 137 106 131 111" fill="${skin}" stroke="${ink}" stroke-width="1.1"/>`) +
    lines +
    headwear +
    crownMarkup +
    // The candle at the foot of the frame, burning down with the years the rule allows.
    `<rect width="200" height="250" fill="url(#${id}-glow)"/>` +
    `<path d="M160 240H184L180 236H164Z" fill="${dark ? '#7a6a52' : '#9a8a6a'}" stroke="${ink}" stroke-width="1"/>` +
    `<rect x="168" y="${candleTop.toFixed(1)}" width="8" height="${candleHeight.toFixed(1)}" fill="#efe4c8" stroke="${ink}" stroke-width="0.9"/>` +
    `<g class="cf-portrait__flame" style="transform-origin: 172px ${candleTop.toFixed(1)}px; transform: scale(${flameSize.toFixed(2)})">` +
    `<path d="M172 ${(candleTop - 14).toFixed(1)}C176 ${(candleTop - 8).toFixed(1)} 177 ${(candleTop - 3).toFixed(1)} 172 ${(candleTop - 0.5).toFixed(1)}C167 ${(candleTop - 3).toFixed(1)} 168 ${(candleTop - 8).toFixed(1)} 172 ${(candleTop - 14).toFixed(1)}Z" fill="#f2b23e" stroke="#b5641c" stroke-width="0.7"/>` +
    `</g>` +
    `<rect width="200" height="250" filter="url(#${id}-plaster)"/>` +
    `</g>` +
    `<path d="M12 250V78A88 88 0 0 1 188 78V250" fill="none" stroke="${dark ? '#c9a24a' : '#7a5a3a'}" stroke-width="3"/>` +
    `</svg>`
  );
}
