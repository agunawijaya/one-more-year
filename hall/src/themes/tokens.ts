/**
 * The six palettes: three themes, each designed separately for light and
 * dark. This file is the single source of truth: the Hall turns it into CSS
 * custom properties at start-up, and the contrast tests read it to assert
 * WCAG AA for every pair of text and background a theme uses.
 *
 * Token names, shared by every theme's CSS and the chrome:
 *   --bg          the backdrop (desk, wall, greenhouse)
 *   --surface     the main reading surface (page, panel, label card)
 *   --surface-2   a second surface (page shade, inset)
 *   --ink         body text
 *   --ink-soft    secondary text (still AA on both surfaces)
 *   --accent      the theme's own colour (rubric, signal, leaf)
 *   --accent-ink  text on an --accent fill
 *   --rule        hairlines and borders (decorative, not text)
 *   --good / --warning / --disaster   status text (AA on --surface)
 *   --tone-*      timeline marks (graphics: 3:1 against --surface)
 *   --focus       the focus ring
 */
import type { Appearance } from '@one-more-year/kit';
import type { ThemeId } from './theme-ids.ts';

export interface Palette {
  bg: string;
  surface: string;
  surface2: string;
  ink: string;
  inkSoft: string;
  accent: string;
  accentInk: string;
  rule: string;
  good: string;
  warning: string;
  disaster: string;
  toneGood: string;
  toneQuiet: string;
  toneHard: string;
  toneDisaster: string;
  focus: string;
  /** Theme-specific extras (gilt, wood, glass…), named without the leading dashes. */
  extra: Readonly<Record<string, string>>;
}

export const PALETTES: Readonly<Record<ThemeId, Readonly<Record<Appearance, Palette>>>> = {
  almanac: {
    light: {
      bg: '#cdb796',
      surface: '#f6eddb',
      surface2: '#efe2c6',
      ink: '#2a2017',
      inkSoft: '#5d4b37',
      accent: '#a8321c',
      accentInk: '#fff8ec',
      rule: '#cbb48b',
      good: '#3b6527',
      warning: '#8a4f00',
      disaster: '#a3261c',
      toneGood: '#4e7a32',
      toneQuiet: '#a8957a',
      toneHard: '#b7791f',
      toneDisaster: '#a3261c',
      focus: '#a8321c',
      extra: {
        gilt: '#b8902f',
        'gilt-soft': '#dcc27a',
        'desk-light': '#e6d3b0',
        'desk-shadow': '#a88b64',
        'page-edge': '#e3d4b3',
        hatch: '#2a201733',
        cover: '#c9b48f',
        ribbon: '#b3261e',
      },
    },
    dark: {
      bg: '#070b16',
      surface: '#16203a',
      surface2: '#1b2745',
      ink: '#f1e8d4',
      inkSoft: '#c4b89f',
      accent: '#e3bd66',
      accentInk: '#1a1408',
      rule: '#34436c',
      good: '#a6d58f',
      warning: '#f2b862',
      disaster: '#ff9584',
      toneGood: '#8fc277',
      toneQuiet: '#6f7fa6',
      toneHard: '#e0a144',
      toneDisaster: '#f0705f',
      focus: '#e3bd66',
      extra: {
        gilt: '#d8b257',
        'gilt-soft': '#a88a46',
        'desk-light': '#2b2516',
        'desk-shadow': '#04060c',
        'page-edge': '#253256',
        hatch: '#f1e8d433',
        cover: '#3a3426',
        ribbon: '#e0694f',
        lamp: '#ffcf7a',
      },
    },
  },
  'situation-room': {
    light: {
      bg: '#f2f4f8',
      surface: '#ffffff',
      surface2: '#f6f8fb',
      ink: '#14171d',
      inkSoft: '#566070',
      accent: '#1f5fd1',
      accentInk: '#ffffff',
      rule: '#e1e5ec',
      good: '#17703f',
      warning: '#9c5200',
      disaster: '#c0234e',
      toneGood: '#2f9a5c',
      toneQuiet: '#a9b3c2',
      toneHard: '#c47a12',
      toneDisaster: '#d62f5c',
      focus: '#1f5fd1',
      extra: {
        signal: '#1f5fd1',
        'signal-soft': '#e3ecfb',
        grid: '#e9edf3',
        glass: '#ffffffd9',
        shadow: '#1b263b14',
      },
    },
    dark: {
      bg: '#0b0e13',
      surface: '#141820',
      surface2: '#1a1f29',
      ink: '#e9eef5',
      inkSoft: '#9ba7b8',
      accent: '#5cc8e8',
      accentInk: '#06141a',
      rule: '#262d39',
      good: '#62d69c',
      warning: '#f2ab40',
      disaster: '#ff5eaa',
      toneGood: '#44b981',
      toneQuiet: '#4a5466',
      toneHard: '#e0952c',
      toneDisaster: '#ff4fa3',
      focus: '#5cc8e8',
      extra: {
        signal: '#5cc8e8',
        'signal-soft': '#16313b',
        grid: '#1d232d',
        glass: '#141820d9',
        shadow: '#00000066',
      },
    },
  },
  terrarium: {
    light: {
      bg: '#e4eedf',
      surface: '#fcf9f1',
      surface2: '#f2ecdc',
      ink: '#203024',
      inkSoft: '#4c5d4f',
      accent: '#2e7538',
      accentInk: '#ffffff',
      rule: '#cbd8c3',
      good: '#2e7538',
      warning: '#8c5200',
      disaster: '#ad3428',
      toneGood: '#4f9a4f',
      toneQuiet: '#a7b59f',
      toneHard: '#b8741a',
      toneDisaster: '#c0473a',
      focus: '#2e7538',
      extra: {
        oak: '#c28f5c',
        'oak-dark': '#8a5f36',
        terracotta: '#c56a43',
        brass: '#b08a2e',
        'brass-ink': '#2b2208',
        glass: '#ffffff59',
        'glass-edge': '#ffffffb3',
        pane: '#d6e6cf',
        leaf: '#7fae6b',
        trim: '#9fb4a6',
      },
    },
    dark: {
      bg: '#081a1c',
      surface: '#11292a',
      surface2: '#163233',
      ink: '#e5f2ea',
      inkSoft: '#a5c1b4',
      accent: '#8fe3a8',
      accentInk: '#06200f',
      rule: '#244748',
      good: '#8fe3a8',
      warning: '#f2c265',
      disaster: '#ff9d8d',
      toneGood: '#6fcf8f',
      toneQuiet: '#3f6162',
      toneHard: '#e0a94a',
      toneDisaster: '#f07a68',
      focus: '#8fe3a8',
      extra: {
        oak: '#5a3f27',
        'oak-dark': '#2e1f12',
        terracotta: '#8a4a30',
        brass: '#d6b25a',
        'brass-ink': '#1d1606',
        glass: '#bfe8ff14',
        'glass-edge': '#cfeeff59',
        pane: '#0f2629',
        leaf: '#2f5a3c',
        firefly: '#f5e27a',
        moon: '#dcecff',
        trim: '#5c7468',
      },
    },
  },
};

/** CSS for every palette: `[data-theme='x'][data-appearance='y'] { --bg: …; … }`. */
export function paletteCss(): string {
  const blocks: string[] = [];
  for (const [theme, byAppearance] of Object.entries(PALETTES)) {
    for (const [appearance, palette] of Object.entries(byAppearance)) {
      const lines = [
        `--bg:${palette.bg}`,
        `--surface:${palette.surface}`,
        `--surface-2:${palette.surface2}`,
        `--ink:${palette.ink}`,
        `--ink-soft:${palette.inkSoft}`,
        `--accent:${palette.accent}`,
        `--accent-ink:${palette.accentInk}`,
        `--rule:${palette.rule}`,
        `--good:${palette.good}`,
        `--warning:${palette.warning}`,
        `--disaster:${palette.disaster}`,
        `--tone-good:${palette.toneGood}`,
        `--tone-quiet:${palette.toneQuiet}`,
        `--tone-hard:${palette.toneHard}`,
        `--tone-disaster:${palette.toneDisaster}`,
        `--focus:${palette.focus}`,
        ...Object.entries(palette.extra).map(([name, value]) => `--${name}:${value}`),
      ];
      blocks.push(`[data-theme='${theme}'][data-appearance='${appearance}']{${lines.join(';')}}`);
    }
  }
  return blocks.join('\n');
}
