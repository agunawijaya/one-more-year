/**
 * The theme registry. Each theme is its own renderer over the shared Hall
 * data (ADR-0004); the colour helpers live in colors.ts.
 */
import { almanac } from './almanac/almanac.ts';
import { situationRoom } from './situation-room/situation-room.ts';
import { terrarium } from './terrarium/terrarium.ts';
import type { Theme } from './theme.ts';
import type { ThemeId } from './theme-ids.ts';

export { cardSkin, chartTokensFor } from './colors.ts';

export const THEMES: Readonly<Record<ThemeId, Theme>> = {
  almanac,
  'situation-room': situationRoom,
  terrarium,
};
