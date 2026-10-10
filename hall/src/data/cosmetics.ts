/**
 * Legacy cosmetics: one per rank per theme, and nothing else. They change
 * how the Hall looks (an almanac's cover and ribbon, a Situation Room
 * palette, a terrarium's dome trim and plant), never how any simulation
 * plays. Earned by play only; nothing is bought and nothing expires.
 *
 * A theme reads the active cosmetic's tokens; by default that is the latest
 * one unlocked, and the Legacy page lets the player pick any earlier one.
 */
import { RANKS, createSlot, isRecord, ranksReached, type KeyValueStore } from '@one-more-year/kit';
import type { ThemeId } from '../themes/theme-ids.ts';

export interface Cosmetic {
  id: string;
  theme: ThemeId;
  /** The rank that unlocks it. */
  rank: string;
  name: string;
  description: string;
  /** Colours the theme applies: CSS custom property name → value, per appearance. */
  tokens: { light: Readonly<Record<string, string>>; dark: Readonly<Record<string, string>> };
}

const almanac = (
  rank: string,
  name: string,
  description: string,
  cover: [string, string],
  ribbon: [string, string],
): Cosmetic => ({
  id: `almanac-${rank}`,
  theme: 'almanac',
  rank,
  name,
  description,
  tokens: {
    light: { '--cover': cover[0], '--ribbon': ribbon[0] },
    dark: { '--cover': cover[1], '--ribbon': ribbon[1] },
  },
});

const room = (
  rank: string,
  name: string,
  description: string,
  signal: [string, string],
  signalSoft: [string, string],
): Cosmetic => ({
  id: `situation-room-${rank}`,
  theme: 'situation-room',
  rank,
  name,
  description,
  tokens: {
    light: { '--signal': signal[0], '--signal-soft': signalSoft[0] },
    dark: { '--signal': signal[1], '--signal-soft': signalSoft[1] },
  },
});

const dome = (
  rank: string,
  name: string,
  description: string,
  trim: [string, string],
  plant: string,
): Cosmetic => ({
  id: `terrarium-${rank}`,
  theme: 'terrarium',
  rank,
  name,
  description,
  tokens: {
    light: { '--trim': trim[0], '--plant': plant },
    dark: { '--trim': trim[1], '--plant': plant },
  },
});

export const COSMETICS: readonly Cosmetic[] = [
  almanac(
    'novice',
    'Linen and red silk',
    'A plain linen cover with a red silk ribbon.',
    ['#c9b48f', '#3a3426'],
    ['#b3261e', '#e0694f'],
  ),
  almanac(
    'scribe',
    'Oxblood cloth',
    'Oxblood cloth boards with a gilt rule around the edge.',
    ['#6e2222', '#4a1c1c'],
    ['#c99a2e', '#e6c15c'],
  ),
  almanac(
    'steward',
    'Forest buckram',
    'Forest green buckram and twin ribbons.',
    ['#2f5a3c', '#1f3a28'],
    ['#d9b44a', '#f0cf6a'],
  ),
  almanac(
    'chronicler',
    'Navy morocco',
    'Navy morocco leather with tooled corners.',
    ['#22325a', '#1a2440'],
    ['#c4553a', '#f08a6b'],
  ),
  almanac(
    'keeper',
    'Tan calf',
    'Tan calf with raised bands and a gilt title.',
    ['#9a6a3c', '#5e4026'],
    ['#2e5d8a', '#86b4e0'],
  ),
  almanac(
    'sage',
    'Midnight vellum',
    'Midnight vellum boards tooled with stars, and a gold ribbon.',
    ['#141c33', '#0c1224'],
    ['#d4a72c', '#f2cd5c'],
  ),

  room(
    'novice',
    'Standard issue',
    'Signal blue by day, cool cyan at night, as issued.',
    ['#1f5fd1', '#5cc8e8'],
    ['#e3ecfb', '#16313b'],
  ),
  room(
    'scribe',
    'Harbour',
    'Harbour teal for the night watch.',
    ['#0f7a7a', '#4fd1c5'],
    ['#ddf1f0', '#12302f'],
  ),
  room(
    'steward',
    'Meridian',
    'Meridian green, steady and clear.',
    ['#2c7a3f', '#6fd08c'],
    ['#e2f2e6', '#16301e'],
  ),
  room(
    'chronicler',
    'Ember',
    'Warm ember orange on graphite.',
    ['#b5531b', '#ff9f5a'],
    ['#f8e7dc', '#3a2215'],
  ),
  room(
    'keeper',
    'Aurora',
    'Aurora violet with a cyan edge.',
    ['#6a46c8', '#b49cff'],
    ['#ebe6fa', '#261d40'],
  ),
  room(
    'sage',
    'Obsidian gold',
    'Gold on obsidian, for the last watch.',
    ['#8a6a12', '#e8c35a'],
    ['#f4eedc', '#2e2610'],
  ),

  dome(
    'novice',
    'Plain glass and a seedling',
    'A plain glass dome over a first seedling.',
    ['#9fb4a6', '#5c7468'],
    'seedling',
  ),
  dome(
    'scribe',
    'Copper and fern',
    'A copper-trimmed dome with a curling fern.',
    ['#b0683a', '#d48a5a'],
    'fern',
  ),
  dome(
    'steward',
    'Brass and moss',
    'Brass trim over a soft moss garden.',
    ['#b08a2e', '#d6b25a'],
    'moss',
  ),
  dome(
    'chronicler',
    'Verdigris and cactus',
    'Verdigris trim and a flowering cactus.',
    ['#3f8a78', '#6cc2ab'],
    'cactus',
  ),
  dome(
    'keeper',
    'Silver and bonsai',
    'Silver trim around a patient bonsai.',
    ['#8e9aa6', '#c2ccd6'],
    'bonsai',
  ),
  dome(
    'sage',
    'Gold and orchard',
    'A gold-trimmed dome over a tiny fruiting tree.',
    ['#b8932a', '#e8c35a'],
    'orchard',
  ),
];

export function cosmeticsFor(theme: ThemeId): Cosmetic[] {
  return COSMETICS.filter((cosmetic) => cosmetic.theme === theme);
}

export function unlockedCosmetics(points: number, theme?: ThemeId): Cosmetic[] {
  const reached = new Set(ranksReached(points).map((rank) => rank.id));
  return COSMETICS.filter(
    (cosmetic) => reached.has(cosmetic.rank) && (theme === undefined || cosmetic.theme === theme),
  );
}

export interface CosmeticChoices {
  /** Chosen cosmetic per theme; absent means "the latest unlocked". */
  chosen: Partial<Record<ThemeId, string>>;
}

export interface CosmeticsStore {
  /** The cosmetic a theme should wear now. */
  active(theme: ThemeId, points: number): Cosmetic;
  choose(theme: ThemeId, cosmeticId: string | null): void;
  forget(): void;
}

export function createCosmeticsStore(store: KeyValueStore): CosmeticsStore {
  const slot = createSlot<CosmeticChoices>(store, 'omy:cosmetics', {
    version: 1,
    defaults: () => ({ chosen: {} }),
    parse: (data) =>
      isRecord(data) && isRecord(data.chosen) ? (data as unknown as CosmeticChoices) : null,
  });
  return {
    active(theme, points) {
      const unlocked = unlockedCosmetics(points, theme);
      const chosen = slot.load().chosen[theme];
      return (
        unlocked.find((cosmetic) => cosmetic.id === chosen) ??
        unlocked.at(-1) ??
        (cosmeticsFor(theme)[0] as Cosmetic)
      );
    },
    choose(theme, cosmeticId) {
      const choices = slot.load();
      const others = Object.entries(choices.chosen).filter(([key]) => key !== theme);
      slot.save({
        chosen: Object.fromEntries(cosmeticId === null ? others : [...others, [theme, cosmeticId]]),
      });
    },
    forget() {
      slot.clear();
    },
  };
}

/** Rank title by id, for cosmetic labels ("unlocked at Steward"). */
export function rankTitle(rankId: string): string {
  return RANKS.find((rank) => rank.id === rankId)?.title ?? rankId;
}
