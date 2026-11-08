/**
 * The pigments of the fresco, and how the city is coloured in each
 * appearance.
 *
 * Buon fresco (light) is a Tuscan noon: lime white, ochres, the two earths
 * of Siena, green earth and verdigris, lapis blue sky and vermilion
 * banners. Notte di candele (dark) is the same wall by candlelight: an
 * ultramarine sky with painted gold stars, warm candle gold in windows and
 * torches, deep umber shadows. The scene is coloured from these lists
 * alone, and the fresco pass pulls every pixel toward them, so nothing
 * strays out of the palette.
 */
import { Color } from 'three';
import type { Appearance } from '@one-more-year/kit';

/** The earth pigments of a fresco painter's shelf, as display colours. */
export const PIGMENTS = {
  limeWhite: '#efe5cf',
  bone: '#ddd0b4',
  ochre: '#c9973f',
  paleOchre: '#dcb878',
  rawSienna: '#b8743a',
  burntSienna: '#9a4b2c',
  terracotta: '#b05a37',
  rose: '#c98b73',
  terraVerde: '#7d8a5c',
  olive: '#5f6b3e',
  verdigris: '#4f8a72',
  lapis: '#2f5d8c',
  azurite: '#5f86b0',
  vermilion: '#bf3a22',
  umber: '#4a3526',
  sinopia: '#8b3a24',
  stone: '#a89c84',
  slate: '#5a5f66',
  gold: '#d4a73c',
  ivoryBlack: '#2b2622',
  ultramarine: '#1f2f63',
} as const;

export type PigmentName = keyof typeof PIGMENTS;

export interface ScenePalette {
  appearance: Appearance;
  /** Sky at the top of the picture, and at the horizon. */
  skyTop: Color;
  skyHorizon: Color;
  /** Gold stars painted on the night sky (0 by day). */
  stars: number;
  /** The painted clouds: their lit tops and their cool undersides. */
  cloudLight: Color;
  cloudShade: Color;
  /** The sun (or moon), its colour and how strong. */
  keyColor: Color;
  keyIntensity: number;
  /** Direction toward the sun: from the south-west at noon, a high cold moon at night. */
  keyDirection: { x: number; y: number; z: number };
  /** Light from the sky and from the ground, for the shaded sides. */
  hemiSky: Color;
  hemiGround: Color;
  hemiIntensity: number;
  /** The colour shadows are mixed toward: a cool blue-grey earth by day, never black. */
  shadowTint: Color;
  /** What the whole painted world is multiplied by at night, before the lamps are lit. */
  nightTint: Color;
  /** How much the warm lights of windows and torches show (0 at noon). */
  candle: number;
  candleColor: Color;
  /** Haze over far hills. */
  haze: Color;
  hazeNear: number;
  hazeFar: number;
  // Surfaces
  ground: Color;
  meadow: Color;
  road: Color;
  water: Color;
  hills: Color;
  hillsShade: Color;
  /** The far hills, faded by the air toward blue-grey. */
  hillsFar: Color;
  cypress: Color;
  olive: Color;
  /** Haystacks and thatch. */
  straw: Color;
  wallStone: Color;
  roof: Color;
  plaster: readonly Color[];
  awnings: readonly Color[];
  robes: readonly Color[];
  marbleLight: Color;
  marbleDark: Color;
  dome: Color;
  /** The plaster of the wall itself, and its patina, for the fresco pass. */
  intonaco: Color;
  patina: Color;
  /** Line colours: the red-earth underdrawing and the dark contour. */
  sinopia: Color;
  contour: Color;
}

const c = (hex: string): Color => new Color(hex);

const NOON: ScenePalette = {
  appearance: 'light',
  skyTop: c('#3f6c9a'),
  skyHorizon: c('#a9bfcf'),
  stars: 0,
  cloudLight: c('#f4ecdb'),
  cloudShade: c('#a9b4bf'),
  keyColor: c('#fff1d6'),
  keyIntensity: 2.4,
  keyDirection: { x: -0.45, y: 0.82, z: 0.36 },
  hemiSky: c('#d9e2e6'),
  hemiGround: c('#b89a6a'),
  hemiIntensity: 1.25,
  shadowTint: c('#5d6878'),
  nightTint: c('#ffffff'),
  candle: 0,
  candleColor: c('#ffc46b'),
  haze: c('#b9c3c0'),
  hazeNear: 1000,
  hazeFar: 2600,
  ground: c('#bf9f62'),
  meadow: c('#7f8c45'),
  road: c('#dcc293'),
  water: c('#4f8796'),
  hills: c('#8e9658'),
  hillsShade: c('#5f6a3c'),
  hillsFar: c('#93a3a6'),
  cypress: c('#2f4426'),
  olive: c('#506a34'),
  straw: c('#d6b45e'),
  wallStone: c('#cdb07e'),
  roof: c('#b8532f'),
  plaster: [c('#ecc7a2'), c('#dfae6c'), c('#e8b39a'), c('#cf9a62'), c('#f0dfbd'), c('#d99a74')],
  awnings: [c('#c23a20'), c('#d19a35'), c('#3f8a6c'), c('#2c5a8e')],
  robes: [
    c('#c23a20'),
    c('#2c5a8e'),
    c('#d19a35'),
    c('#3f8a6c'),
    c('#f0e6d0'),
    c('#9a4426'),
    c('#cf8668'),
  ],
  marbleLight: c('#f2e8d4'),
  marbleDark: c('#3b5f50'),
  dome: c('#bd5531'),
  intonaco: c('#efe6d2'),
  patina: c('#b9a27c'),
  sinopia: c('#8b3a24'),
  contour: c('#4a3526'),
};

const CANDLES: ScenePalette = {
  appearance: 'dark',
  skyTop: c('#0f1d4a'),
  skyHorizon: c('#2a3a6e'),
  stars: 1,
  cloudLight: c('#5d6c96'),
  cloudShade: c('#2b3766'),
  keyColor: c('#aab8e0'),
  keyIntensity: 0.55,
  keyDirection: { x: 0.35, y: 0.86, z: -0.2 },
  hemiSky: c('#3a4a7a'),
  hemiGround: c('#3a2a1e'),
  hemiIntensity: 0.55,
  shadowTint: c('#1d1a26'),
  nightTint: c('#9ca5c2'),
  candle: 1,
  candleColor: c('#ffb44f'),
  haze: c('#1c2546'),
  hazeNear: 1000,
  hazeFar: 2600,
  ground: c('#5d5040'),
  meadow: c('#4a5038'),
  road: c('#7a6a52'),
  water: c('#22365a'),
  hills: c('#525a44'),
  hillsShade: c('#34392e'),
  hillsFar: c('#39456a'),
  cypress: c('#1f2a1e'),
  olive: c('#39402c'),
  straw: c('#6e5a34'),
  wallStone: c('#7e7060'),
  roof: c('#6e3a28'),
  plaster: [c('#8e8270'), c('#857462'), c('#8a7466'), c('#7e6b58'), c('#938674'), c('#7a6450')],
  awnings: [c('#8a2a1c'), c('#8e6a2c'), c('#355e50'), c('#243f62')],
  robes: [
    c('#8a2a1c'),
    c('#243f62'),
    c('#8e6a2c'),
    c('#355e50'),
    c('#a49a86'),
    c('#6a3420'),
    c('#8a6050'),
  ],
  marbleLight: c('#9d968a'),
  marbleDark: c('#2f4038'),
  dome: c('#6e3a28'),
  intonaco: c('#3a3128'),
  patina: c('#1a1410'),
  sinopia: c('#c08a5a'),
  contour: c('#120d0a'),
};

export function paletteFor(appearance: Appearance): ScenePalette {
  return appearance === 'dark' ? CANDLES : NOON;
}
