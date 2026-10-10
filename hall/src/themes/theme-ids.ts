/**
 * The three Hall themes, by id. Kept apart from the renderers so data code
 * (cosmetics, settings checks) can name a theme without loading one.
 */

export const THEME_IDS = ['almanac', 'situation-room', 'terrarium'] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export const DEFAULT_THEME: ThemeId = 'almanac';

export function isThemeId(value: unknown): value is ThemeId {
  return THEME_IDS.includes(value as ThemeId);
}

export const THEME_NAMES: Readonly<Record<ThemeId, string>> = {
  almanac: 'Almanac',
  'situation-room': 'Situation Room',
  terrarium: 'Terrarium',
};

export const THEME_LINES: Readonly<Record<ThemeId, string>> = {
  almanac: 'The book of years: each world a chapter, engraved and bound.',
  'situation-room': 'The world as data: every signal live on one calm wall.',
  terrarium: 'Small worlds under glass, growing on warm wooden shelves.',
};
