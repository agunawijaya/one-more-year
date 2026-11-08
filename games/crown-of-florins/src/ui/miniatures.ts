/**
 * The small paintings in the obituary's margin, in the fresco's own
 * language at miniature scale: the same earth pigments, forms modelled in
 * a light and a shade of one colour with the shade hatched (as fresco
 * painters build a shadow out of fine strokes), outlines in umber that
 * wander as a brush leaves them, and a ground of gold leaf behind each
 * scene: square sheets a shade apart with faint seams, a fine crackle, a
 * ring of punched dots along the quatrefoil, and a glint that crosses it.
 *
 * Each painting is drawn from the moment it tells: as many market stalls
 * as the reign opened (up to three), the cathedral as far as it rose, the
 * walls tried as often as they were, the coronet with as many points as the
 * title had steps, the realm's own colours on its banners and robes.
 */
import type { MarginPicture } from '../content/obituary.ts';
import type { Tincture } from '../lib/heraldry.ts';

const INK = {
  lime: '#efe5cf',
  bone: '#ddd0b4',
  ochre: '#c9973f',
  sienna: '#b8743a',
  burnt: '#9a4b2c',
  terracotta: '#b05a37',
  verde: '#7d8a5c',
  olive: '#5f6b3e',
  lapis: '#2f5d8c',
  vermilion: '#bf3a22',
  umber: '#4a3526',
  black: '#2b2622',
  skin: '#d8a283',
  gold: '#d6a640',
} as const;

const TINCTURES: Readonly<Record<Tincture, string>> = {
  or: INK.gold,
  argent: INK.lime,
  gules: INK.vermilion,
  azure: INK.lapis,
  vert: '#3f7a4f',
  sable: INK.black,
  purpure: '#6a3778',
};

const FRAME =
  'M100 8C128 8 140 30 140 50C162 50 192 62 192 100C192 138 162 150 140 150C140 172 128 192 100 192C72 192 60 172 60 150C38 150 8 138 8 100C8 62 38 50 60 50C60 30 72 8 100 8Z';

/** The defs every painting shares: gold leaf, its crackle and glint, hatching, the brush. */
function defs(id: string, seed: number): string {
  const sheet = (x: number, y: number, tone: string): string =>
    `<rect x="${x}" y="${y}" width="22" height="22" fill="${tone}"/>` +
    `<path d="M${x} ${y + 21.6}H${x + 22}M${x + 21.6} ${y}V${y + 22}" stroke="#7a5212" stroke-width="0.7" opacity="0.55"/>` +
    `<path d="M${x + 0.6} ${y + 21}V${y + 0.6}H${x + 21}" stroke="#f7df92" stroke-width="0.6" fill="none" opacity="0.7"/>`;
  return (
    `<pattern id="${id}-leaf" width="44" height="44" patternUnits="userSpaceOnUse" patternTransform="rotate(1.5) scale(0.62)">` +
    sheet(0, 0, '#d9ab45') +
    sheet(22, 0, '#d3a540') +
    sheet(0, 22, '#d0a13e') +
    sheet(22, 22, '#dcaf4a') +
    `</pattern>` +
    `<filter id="${id}-crackle" x="0" y="0" width="100%" height="100%">` +
    `<feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="${seed}" result="net"/>` +
    `<feColorMatrix in="net" type="matrix" values="0 0 0 0 0.42  0 0 0 0 0.24  0 0 0 0 0.08  1 0 0 0 0"/>` +
    `<feComponentTransfer><feFuncA type="table" tableValues="0 0 0 0 0.85 0 0 0 0"/></feComponentTransfer>` +
    `</filter>` +
    `<linearGradient id="${id}-sheen" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0.35" stop-color="#fff6d8" stop-opacity="0"/><stop offset="0.5" stop-color="#fff6d8" stop-opacity="0.75"/><stop offset="0.65" stop-color="#fff6d8" stop-opacity="0"/>` +
    `</linearGradient>` +
    `<pattern id="${id}-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(-38)">` +
    `<path d="M0 0.5H4" stroke="${INK.umber}" stroke-width="0.9" opacity="0.5"/></pattern>` +
    `<clipPath id="${id}-clip"><path d="${FRAME}"/></clipPath>` +
    // The brush: edges wander a little, and a streaked grain lies in the pigment.
    `<filter id="${id}-paint" x="-5%" y="-5%" width="110%" height="110%">` +
    `<feTurbulence type="fractalNoise" baseFrequency="0.07" numOctaves="2" seed="${seed + 5}" result="wobble"/>` +
    `<feDisplacementMap in="SourceGraphic" in2="wobble" scale="2.6" result="painted"/>` +
    `<feTurbulence type="fractalNoise" baseFrequency="0.04 0.5" numOctaves="2" seed="${seed + 9}" result="streaks"/>` +
    `<feColorMatrix in="streaks" type="matrix" values="0 0 0 0 0.25  0 0 0 0 0.18  0 0 0 0 0.1  1.4 0 0 0 -0.62" result="tint"/>` +
    `<feComposite in="tint" in2="painted" operator="in" result="grain"/>` +
    `<feMerge><feMergeNode in="painted"/><feMergeNode in="grain"/></feMerge></filter>`
  );
}

/** A shape in its light colour, its shaded part hatched over in the same pigment darkened. */
function modelled(d: string, light: string, shade: string, shadeD: string, id: string): string {
  return (
    `<path d="${d}" fill="${light}" stroke="${INK.umber}" stroke-width="1.6" stroke-linejoin="round"/>` +
    `<path d="${shadeD}" fill="${shade}"/>` +
    `<path d="${shadeD}" fill="url(#${id}-hatch)"/>`
  );
}

const GROUND = (id: string): string =>
  `<path d="M0 134C40 124 80 132 112 127C146 122 172 130 200 125V200H0Z" fill="${INK.verde}" stroke="${INK.umber}" stroke-width="1.2"/>` +
  `<path d="M0 150C50 144 120 152 200 144V200H0Z" fill="${INK.olive}" opacity="0.55"/>` +
  `<path d="M0 158C60 152 130 160 200 152V200H0Z" fill="url(#${id}-hatch)" opacity="0.6"/>`;

/** A pigment darkened toward ivory black, for the shaded side of a form. */
function shade(hex: string, amount = 0.32): string {
  const value = Number.parseInt(hex.slice(1), 16);
  const channel = (shift: number): number => {
    const c = (value >> shift) & 255;
    return Math.round(c * (1 - amount) + 0x2b * amount);
  };
  return `#${[16, 8, 0].map((shift) => channel(shift).toString(16).padStart(2, '0')).join('')}`;
}

function markets(count: number, id: string, field: string): string {
  const n = Math.max(1, Math.min(3, count));
  const centres = n === 1 ? [100] : n === 2 ? [74, 126] : [52, 100, 148];
  // The merchant stands behind the middle stall, in the realm's colour.
  const mx = centres[Math.floor(n / 2)] ?? 100;
  const merchant =
    `<path d="M${mx - 10} 130C${mx - 10} 116 ${mx + 10} 116 ${mx + 10} 130Z" fill="${field}" stroke="${INK.umber}" stroke-width="1.2"/>` +
    `<circle cx="${mx}" cy="113" r="6" fill="${INK.skin}" stroke="${INK.umber}"/>`;
  const awnings: [string, string][] = [
    [INK.vermilion, INK.lime],
    [INK.ochre, INK.lime],
    [INK.lapis, INK.lime],
  ];
  return (
    merchant +
    centres
      .map((x, i) => {
        const [cloth, stripe] = awnings[i % 3] ?? [INK.vermilion, INK.lime];
        const stripes = [-14, -2, 10]
          .map(
            (o) =>
              `<path d="M${x + o} 98L${x + o + 6} 98L${x + o + 7.5} 112L${x + o - 1.5} 112Z" fill="${stripe}"/>`,
          )
          .join('');
        return (
          // Posts, the counter in sienna with its shaded front hatched, and the goods.
          `<path d="M${x - 20} 112V142M${x + 20} 112V142" stroke="${INK.umber}" stroke-width="2.4"/>` +
          modelled(
            `M${x - 22} 130H${x + 22}V142H${x - 22}Z`,
            INK.sienna,
            INK.burnt,
            `M${x - 22} 136H${x + 22}V142H${x - 22}Z`,
            id,
          ) +
          `<circle cx="${x - 10}" cy="127" r="4" fill="${INK.ochre}" stroke="${INK.umber}"/>` +
          `<circle cx="${x}" cy="126" r="4.4" fill="${INK.verde}" stroke="${INK.umber}"/>` +
          `<circle cx="${x + 10}" cy="127" r="4" fill="${INK.vermilion}" stroke="${INK.umber}"/>` +
          `<path d="M${x - 24} 98H${x + 24}L${x + 28} 112H${x - 28}Z" fill="${cloth}" stroke="${INK.umber}" stroke-width="1.4"/>` +
          stripes +
          `<path d="M${x - 28} 112Q${x - 21} 117 ${x - 14} 112Q${x - 7} 117 ${x} 112Q${x + 7} 117 ${x + 14} 112Q${x + 21} 117 ${x + 28} 112" fill="${cloth}" stroke="${INK.umber}" stroke-width="1"/>`
        );
      })
      .join('')
  );
}

function cathedral(stage: number, id: string): string {
  const stripes = [92, 104, 116, 128]
    .map((y) => `<path d="M76 ${y}H124" stroke="${INK.olive}" stroke-width="3"/>`)
    .join('');
  const dome =
    stage >= 5
      ? `<path d="M88 74V64H112V74Z" fill="${INK.bone}" stroke="${INK.umber}" stroke-width="1.4"/>` +
        modelled(
          'M84 64C84 42 116 42 116 64Z',
          INK.terracotta,
          INK.burnt,
          'M102 46C110 49 116 56 116 64H104Z',
          id,
        ) +
        `<path d="M100 44V64M92 48L94 64M108 48L106 64" stroke="${INK.lime}" stroke-width="1.2"/>` +
        `<path d="M97 44H103V36H97Z" fill="${INK.gold}" stroke="${INK.umber}"/>`
      : '';
  const tower =
    stage >= 6
      ? modelled('M44 142V66H62V142Z', INK.lime, INK.bone, 'M54 66H62V142H54Z', id) +
        `<path d="M44 84H62M44 102H62M44 120H62" stroke="${INK.olive}" stroke-width="2.4"/>` +
        `<path d="M42 66L53 44L64 66Z" fill="${INK.terracotta}" stroke="${INK.umber}" stroke-width="1.4"/>` +
        `<path d="M50 74A3 4 0 0 1 56 74V80H50Z" fill="${INK.black}"/>`
      : '';
  return (
    dome +
    tower +
    // The aisle to the right, in shade and hatched; the façade in striped marble, lit.
    modelled('M124 142V96L156 104V142Z', INK.bone, '#c3b394', 'M124 96L156 104V142H124Z', id) +
    `<path d="M76 142V86H124V142Z" fill="${INK.lime}" stroke="${INK.umber}" stroke-width="1.6"/>` +
    stripes +
    `<path d="M72 88L100 66L128 88Z" fill="${INK.terracotta}" stroke="${INK.umber}" stroke-width="1.6"/>` +
    `<circle cx="100" cy="100" r="8" fill="${INK.lapis}" stroke="${INK.umber}" stroke-width="1.2"/>` +
    `<path d="M100 92V108M92 100H108M94.5 94.5L105.5 105.5M105.5 94.5L94.5 105.5" stroke="${INK.vermilion}" stroke-width="1"/>` +
    `<path d="M92 142V126A8 8 0 0 1 108 126V142Z" fill="${INK.black}"/>`
  );
}

function harvest(id: string): string {
  const sheaf = (x: number, tall: number): string => {
    const stalks = [-7, -3.5, 0, 3.5, 7]
      .map(
        (o) =>
          `<path d="M${x + o * 0.4} 142L${x + o} ${142 - tall}" stroke="${INK.ochre}" stroke-width="2.2"/>`,
      )
      .join('');
    const ears = [-7, -3.5, 0, 3.5, 7]
      .map(
        (o) =>
          `<ellipse cx="${x + o * 1.15}" cy="${142 - tall - 4}" rx="2.6" ry="6" fill="${INK.ochre}" stroke="${INK.sienna}" transform="rotate(${o * 3} ${x + o * 1.15} ${142 - tall - 4})"/>`,
      )
      .join('');
    return (
      stalks +
      ears +
      `<path d="M${x - 6} ${142 - tall * 0.45}H${x + 6}" stroke="${INK.vermilion}" stroke-width="3.2"/>` +
      `<path d="M${x + 1} ${142 - tall}L${x + 6} 142" stroke="${INK.sienna}" stroke-width="1.2" opacity="0.7"/>`
    );
  };
  return (
    sheaf(62, 44) +
    sheaf(100, 54) +
    sheaf(138, 42) +
    `<path d="M24 150H176" stroke="${INK.sienna}" stroke-width="1" stroke-dasharray="3 4"/>` +
    `<path d="M150 124C160 112 176 112 182 124C174 118 162 118 154 128Z" fill="${INK.lime}" stroke="${INK.umber}" stroke-width="1.2"/>` +
    `<path d="M154 128L148 140" stroke="${INK.umber}" stroke-width="3"/>` +
    `<path d="M40 150C70 146 130 146 160 150V156H40Z" fill="url(#${id}-hatch)"/>`
  );
}

function famine(id: string): string {
  return (
    modelled(
      'M64 128C66 150 134 150 136 128Z',
      INK.sienna,
      INK.burnt,
      'M100 128H136C135 140 122 147 100 148Z',
      id,
    ) +
    `<ellipse cx="100" cy="128" rx="36" ry="6" fill="${INK.umber}" stroke="${INK.umber}"/>` +
    `<path d="M150 140C148 116 156 96 168 82M156 112C164 108 170 110 174 104M152 124C144 118 140 112 140 104" fill="none" stroke="${INK.umber}" stroke-width="2.6" stroke-linecap="round"/>` +
    `<circle cx="52" cy="146" r="1.8" fill="${INK.ochre}"/><circle cx="58" cy="149" r="1.6" fill="${INK.ochre}"/>`
  );
}

function invasion(count: number, id: string, field: string, charge: string): string {
  const pairs = Math.max(1, Math.min(3, count));
  const pikes = Array.from({ length: pairs }, (_, i) => {
    const x = 100 + (i - (pairs - 1) / 2) * 26;
    return (
      `<path d="M${x - 24} 116L${x + 18} 46" stroke="${INK.umber}" stroke-width="2.6"/>` +
      `<path d="M${x + 24} 116L${x - 18} 46" stroke="${INK.umber}" stroke-width="2.6"/>` +
      `<path d="M${x + 18} 46L${x + 22} 38L${x + 21} 48Z" fill="${INK.lime}" stroke="${INK.umber}"/>` +
      `<path d="M${x - 18} 46L${x - 22} 38L${x - 21} 48Z" fill="${INK.lime}" stroke="${INK.umber}"/>` +
      `<path d="M${x + 14} 54L${x + 34} 60L${x + 26} 64L${x + 32} 70L${x + 10} 64Z" fill="${INK.vermilion}" stroke="${INK.umber}" stroke-width="1.1"/>` +
      `<path d="M${x - 14} 54L${x - 34} 60L${x - 26} 64L${x - 32} 70L${x - 10} 64Z" fill="${field}" stroke="${INK.umber}" stroke-width="1.1"/>` +
      `<path d="M${x - 24} 61L${x - 30} 64" stroke="${charge}" stroke-width="2"/>`
    );
  }).join('');
  const merlons = Array.from(
    { length: 7 },
    (_, i) => `M${30 + i * 21} 112V102H${42 + i * 21}V112`,
  ).join('');
  return (
    pikes +
    // Dust where the ranks meet, then the wall that held, in lit ashlar with its shaded foot hatched.
    `<circle cx="70" cy="114" r="12" fill="${INK.bone}" opacity="0.8"/><circle cx="132" cy="112" r="10" fill="${INK.bone}" opacity="0.8"/><circle cx="100" cy="108" r="9" fill="${INK.lime}" opacity="0.75"/>` +
    modelled('M28 146V112H172V146Z', INK.bone, '#c8b590', 'M28 134H172V146H28Z', id) +
    `<path d="${merlons}" fill="${INK.bone}" stroke="${INK.umber}" stroke-width="1.4"/>` +
    `<path d="M28 124H172M60 112V124M100 112V124M140 112V124M44 124V134M80 124V134M120 124V134M156 124V134" stroke="${INK.umber}" stroke-width="0.9" opacity="0.6"/>` +
    `<path d="M90 146V132A10 10 0 0 1 110 132V146Z" fill="${INK.black}"/>`
  );
}

/**
 * A ruler's head in profile, turned toward the herald, as the old court
 * portraits show them: a calm brow, a long nose, closed lips; the face
 * modelled with a green-earth shade under the cheek and jaw and a touch of
 * rose on the cheek, the hair falling to the nape under the coronet.
 */
function profileHead(points: number, id: string): string {
  const step = 22 / Math.max(1, points - 1);
  const coronet = Array.from({ length: points }, (_, i) => {
    const x = 89 + i * step;
    return `L${x.toFixed(1)} ${(58 - (i % 2) * 2).toFixed(1)}L${(x + step / 2).toFixed(1)} 66`;
  }).join('');
  return (
    // The neck, then the hair behind the face, then the face itself.
    `<path d="M91 101L104 103L104 116L91 116Z" fill="${INK.skin}" stroke="${INK.umber}" stroke-width="1.1"/>` +
    `<path d="M91 101L98 102L98 116L91 116Z" fill="${INK.verde}" opacity="0.28"/>` +
    `<path d="M86 79C84 72 87 66 93 64C99 62 105 63 109 66C103 67 97 69 94 73C92 77 91 82 93 88C91 94 89 99 87 104C84 98 84 88 86 79Z" fill="#4a2c18" stroke="${INK.umber}" stroke-width="1"/>` +
    `<path d="M88 104C86 96 86 86 88 78C90 71 96 66 103 67C108 68 110 71 110 75L111 79C112.5 82 114.5 85 115.5 87.5C115.8 88.6 114.4 89.4 112.4 89.6L112.3 91.6C113 92.6 112.4 93.6 111.2 94.4C112 95.6 111.8 97.4 110.2 98.4C110 100.6 108.6 102.6 105.6 103.6C101.6 104.8 97.6 104.6 94.6 105.4Z" fill="${INK.skin}" stroke="${INK.umber}" stroke-width="1.3" stroke-linejoin="round"/>` +
    // Green earth under the cheek and along the jaw, hatched; rose on the cheek.
    `<path d="M94 88C96 96 100 101 106 103C101 104.5 97 104.6 94.6 105.4C91 100 90 94 91 88Z" fill="${INK.verde}" opacity="0.32"/>` +
    `<path d="M94 88C96 96 100 101 106 103C101 104.5 97 104.6 94.6 105.4C91 100 90 94 91 88Z" fill="url(#${id}-hatch)" opacity="0.2"/>` +
    `<ellipse cx="104" cy="88.5" rx="3.6" ry="2.6" fill="${INK.terracotta}" opacity="0.32"/>` +
    // The eye, the brow above it, the line of the closed lips.
    `<path d="M101.2 78.6C102.6 77.4 104.6 77.4 106 78.6C104.6 79.5 102.6 79.5 101.2 78.6Z" fill="${INK.lime}" stroke="${INK.umber}" stroke-width="0.6"/>` +
    `<circle cx="104.1" cy="78.6" r="0.95" fill="${INK.umber}"/>` +
    `<path d="M99.8 75.6C102.4 74.2 105.6 74.3 108.4 75.6" fill="none" stroke="${INK.umber}" stroke-width="0.9"/>` +
    `<path d="M108.2 94.6L111.4 94.4" stroke="${INK.burnt}" stroke-width="0.9"/>` +
    `<path d="M110.6 80C111.6 83 113.2 85.4 114.4 87.4" fill="none" stroke="${INK.burnt}" stroke-width="0.6" opacity="0.6"/>` +
    // The coronet: a gold band with as many points as the title has steps.
    `<path d="M88 66${coronet}L111 66L111 70L88 70Z" fill="${INK.gold}" stroke="${INK.umber}" stroke-width="1.2" stroke-linejoin="round"/>` +
    `<path d="M89 68H110" stroke="#f7df92" stroke-width="0.8" opacity="0.8"/>` +
    `<circle cx="99.5" cy="68" r="1.4" fill="${INK.vermilion}"/>`
  );
}

function promotion(title: number, id: string, field: string, charge: string): string {
  const points = Math.max(3, Math.min(6, title - 1));
  return (
    // The mantle in the realm's colour, its fold in shade; the robe beneath in its charge.
    modelled(
      'M60 150C62 122 76 106 98 106C122 106 138 122 140 150Z',
      field,
      shade(field),
      'M98 106C122 106 138 122 140 150H112C112 132 108 116 98 106Z',
      id,
    ) +
    `<path d="M90 150V118L98 110L106 118V150Z" fill="${charge}" stroke="${INK.umber}" stroke-width="1.2"/>` +
    profileHead(points, id) +
    // The herald's hand with the scroll of the new title.
    `<path d="M178 108C164 106 150 110 140 116L142 124C154 120 166 120 178 122Z" fill="${INK.lime}" stroke="${INK.umber}" stroke-width="1.2"/>` +
    `<path d="M150 114H170M150 118H166" stroke="${INK.umber}" stroke-width="0.8"/>` +
    `<path d="M136 116C139 114 143 115 144 118C144 121 141 123 138 123C135 122 134 119 136 116Z" fill="${INK.skin}" stroke="${INK.umber}" stroke-width="0.9"/>`
  );
}

function crown(id: string): string {
  const rays = Array.from({ length: 18 }, (_, i) => {
    const a = Math.PI + (i / 17) * Math.PI;
    return `M${100 + Math.cos(a) * 30} ${96 + Math.sin(a) * 30}L${100 + Math.cos(a) * 64} ${96 + Math.sin(a) * 64}`;
  }).join('');
  return (
    `<path d="${rays}" stroke="#8a5f1a" stroke-width="1" opacity="0.6"/>` +
    // The cushion in vermilion with gold tassels, the crown on it.
    modelled(
      'M46 140C46 124 154 124 154 140C154 152 46 152 46 140Z',
      INK.vermilion,
      '#8e2a18',
      'M46 140C70 148 130 148 154 140C154 152 46 152 46 140Z',
      id,
    ) +
    `<path d="M48 140L40 154M152 140L160 154" stroke="${INK.gold}" stroke-width="3"/>` +
    `<path d="M62 130L66 84L82 106L100 70L118 106L134 84L138 130Z" fill="${INK.gold}" stroke="${INK.umber}" stroke-width="1.6"/>` +
    `<path d="M100 70L100 130M66 84L82 130M134 84L118 130" stroke="#f7df92" stroke-width="1" opacity="0.7"/>` +
    `<path d="M60 128H140V138H60Z" fill="${INK.ochre}" stroke="${INK.umber}" stroke-width="1.4"/>` +
    `<circle cx="100" cy="133" r="3.6" fill="${INK.vermilion}"/><circle cx="80" cy="133" r="3" fill="${INK.lapis}"/><circle cx="120" cy="133" r="3" fill="${INK.lapis}"/>` +
    `<circle cx="100" cy="70" r="3.2" fill="${INK.lime}" stroke="${INK.umber}"/><circle cx="66" cy="84" r="2.6" fill="${INK.lime}" stroke="${INK.umber}"/><circle cx="134" cy="84" r="2.6" fill="${INK.lime}" stroke="${INK.umber}"/>`
  );
}

function scene(picture: MarginPicture, id: string): string {
  const field = TINCTURES[picture.field];
  const charge = TINCTURES[picture.charge];
  switch (picture.scene) {
    case 'markets':
      return markets(picture.count, id, field);
    case 'cathedral':
      return cathedral(picture.count, id);
    case 'harvest':
      return harvest(id);
    case 'famine':
      return famine(id);
    case 'invasion':
      return invasion(picture.count, id, field, charge);
    case 'promotion':
      return promotion(picture.count, id, field, charge);
    case 'crown':
      return crown(id);
  }
}

/** How large a scene is painted in its frame: as large as it fits, as the old miniaturists filled theirs. */
function scaleFor(picture: MarginPicture): number {
  return picture.scene === 'markets' && picture.count >= 3 ? 1.12 : 1.32;
}

/** One painting in its gold quatrefoil, 200 by 200. */
export function miniatureSvg(picture: MarginPicture, size = 170): string {
  const id = `cf-ms-${picture.scene}`;
  const seed = picture.scene.length * 7 + picture.count;
  return (
    `<svg viewBox="0 0 200 200" width="${size}" height="${size}" aria-hidden="true">` +
    `<defs>${defs(id, seed)}</defs>` +
    `<g clip-path="url(#${id}-clip)">` +
    `<rect width="200" height="200" fill="url(#${id}-leaf)"/>` +
    `<rect width="200" height="200" filter="url(#${id}-crackle)" opacity="0.45"/>` +
    `<rect class="cf-ms__glint" x="-200" y="-200" width="400" height="400" fill="url(#${id}-sheen)" style="mix-blend-mode:screen"/>` +
    // The scene is painted large in its frame, as the old miniaturists filled theirs.
    `<g filter="url(#${id}-paint)">${GROUND(id)}<g transform="translate(100 128) scale(${scaleFor(picture)}) translate(-100 -128)">${scene(picture, id)}</g></g>` +
    `</g>` +
    // The gilder's tooling: a ring of punched dots inside the frame, then the frame itself.
    `<path d="${FRAME}" transform="translate(100 100) scale(0.92) translate(-100 -100)" fill="none" stroke="#8a5f1a" stroke-width="3" stroke-linecap="round" stroke-dasharray="0 7" opacity="0.7"/>` +
    `<path d="${FRAME}" fill="none" stroke="${INK.gold}" stroke-width="7"/>` +
    `<path d="${FRAME}" fill="none" stroke="#f3d27a" stroke-width="1.4" transform="translate(-0.8 -0.8)" opacity="0.8"/>` +
    `<path d="${FRAME}" fill="none" stroke="#7a5a1a" stroke-width="1.5"/>` +
    `</svg>`
  );
}
