/**
 * The two looks of the city, "Noon on the Euphrates" and "A Thousand
 * Lamps". Every colour and light level the scene uses is here, so tuning
 * an appearance never means hunting through shaders.
 *
 * Colours are linear-light three.js colours built from sRGB hex; shaders
 * receive them as uniforms.
 */
import { Color, Vector3 } from 'three';
import type { Appearance } from '@one-more-year/kit';

export interface ScenePalette {
  appearance: Appearance;
  /** Sky gradient, zenith to horizon, and the haze the distance fades into. */
  skyZenith: Color;
  skyHorizon: Color;
  fog: Color;
  fogNear: number;
  fogFar: number;
  /** The key light: the sun at noon, the moon at night. */
  keyDirection: Vector3;
  keyColor: Color;
  keyIntensity: number;
  /** Disc and glow of the sun or moon in the sky. */
  discColor: Color;
  discSize: number;
  hemiSky: Color;
  hemiGround: Color;
  hemiIntensity: number;
  stars: number;
  sand: Color;
  silt: Color;
  wetBank: Color;
  /** Scrub and grass on the floodplain. */
  grass: Color;
  road: Color;
  tilled: Color;
  scrub: Color;
  waterDeep: Color;
  waterShallow: Color;
  foam: Color;
  wheatGreen: Color;
  wheatGold: Color;
  wheatBurnished: Color;
  wheatPale: Color;
  brick: Color;
  brickLight: Color;
  brickShade: Color;
  lapis: Color;
  gold: Color;
  palmLeaf: Color;
  palmTrunk: Color;
  windowDark: Color;
  windowLit: Color;
  lantern: Color;
  garments: Color[];
  grain: Color;
  bloomStrength: number;
  exposure: number;
}

const hex = (value: string): Color => new Color(value);

/** Noon on the Euphrates: high sun, warm haze, ochre brick, turquoise water, gold wheat. */
const NOON: ScenePalette = {
  appearance: 'light',
  skyZenith: hex('#2f78c8'),
  skyHorizon: hex('#f3e2bf'),
  fog: hex('#efdfbd'),
  fogNear: 230,
  fogFar: 900,
  keyDirection: new Vector3(-0.68, 0.6, 0.42).normalize(),
  keyColor: hex('#fff0d2'),
  keyIntensity: 3.6,
  discColor: hex('#fff6e0'),
  discSize: 0.03,
  hemiSky: hex('#b4d0ee'),
  hemiGround: hex('#b08a58'),
  hemiIntensity: 0.85,
  stars: 0,
  sand: hex('#e2c792'),
  silt: hex('#9c8556'),
  wetBank: hex('#6f5d3e'),
  grass: hex('#7f8a44'),
  road: hex('#d9bf8a'),
  tilled: hex('#6a4a2e'),
  scrub: hex('#c4b07e'),
  waterDeep: hex('#14606e'),
  waterShallow: hex('#3f9e9a'),
  foam: hex('#f4f0e2'),
  wheatGreen: hex('#6f9a32'),
  wheatGold: hex('#f2bf48'),
  wheatBurnished: hex('#e09a2a'),
  wheatPale: hex('#cbb57a'),
  brick: hex('#d9ae74'),
  brickLight: hex('#ecd0a0'),
  brickShade: hex('#b27a48'),
  lapis: hex('#2a56b0'),
  gold: hex('#e9b84a'),
  palmLeaf: hex('#4c6a2c'),
  palmTrunk: hex('#7a5a3c'),
  windowDark: hex('#3b2a1c'),
  windowLit: hex('#ffb54f'),
  lantern: hex('#ffc56a'),
  garments: [hex('#f2ece0'), hex('#d9c3a0'), hex('#3d5fa8'), hex('#b8573a'), hex('#e2d6bd')],
  grain: hex('#f0c25a'),
  bloomStrength: 0.12,
  exposure: 1.0,
};

/** A Thousand Lamps: indigo sky, low moon, deep blue brick, amber windows, silver wheat. */
const LAMPS: ScenePalette = {
  appearance: 'dark',
  skyZenith: hex('#060a22'),
  skyHorizon: hex('#2a356a'),
  fog: hex('#1a2148'),
  fogNear: 170,
  fogFar: 760,
  keyDirection: new Vector3(-0.3, 0.55, -0.78).normalize(),
  keyColor: hex('#b4c4ff'),
  keyIntensity: 2.2,
  discColor: hex('#f6f2e4'),
  discSize: 0.022,
  hemiSky: hex('#5a6cb8'),
  hemiGround: hex('#20264c'),
  hemiIntensity: 1.6,
  stars: 1,
  sand: hex('#2f3766'),
  silt: hex('#283058'),
  wetBank: hex('#1e2446'),
  grass: hex('#26344f'),
  road: hex('#3d4679'),
  tilled: hex('#2a2b4a'),
  scrub: hex('#4d5586'),
  waterDeep: hex('#0b1638'),
  waterShallow: hex('#1d3770'),
  foam: hex('#9fb0e0'),
  wheatGreen: hex('#3d5f66'),
  wheatGold: hex('#6f7ea6'),
  wheatBurnished: hex('#8e9bc2'),
  wheatPale: hex('#4f5a80'),
  brick: hex('#5563a6'),
  brickLight: hex('#7180c4'),
  brickShade: hex('#3a4582'),
  lapis: hex('#3f66d6'),
  gold: hex('#f0b54a'),
  palmLeaf: hex('#22354e'),
  palmTrunk: hex('#2c2c46'),
  windowDark: hex('#161838'),
  windowLit: hex('#ffb347'),
  lantern: hex('#ffcc70'),
  garments: [hex('#8b93c4'), hex('#6a72a6'), hex('#4d5c9c'), hex('#9a7a8a'), hex('#7d86b8')],
  grain: hex('#f3c766'),
  bloomStrength: 0.9,
  exposure: 1.3,
};

export function paletteFor(appearance: Appearance): ScenePalette {
  return appearance === 'dark' ? LAMPS : NOON;
}
