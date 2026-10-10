/**
 * Colour helpers every theme shares: chart tokens and share-card skins,
 * both derived from the palettes in tokens.ts.
 */
import { withAlpha, type Appearance, type ChartTokens, type SimManifest } from '@one-more-year/kit';
import type { CardSkin } from '../chrome/share-card.ts';
import type { ThemeId } from './theme-ids.ts';
import { PALETTES } from './tokens.ts';

/** Chart colours from a palette: ink lines on the surface, the accent for the latest point. */
export function chartTokensFor(theme: ThemeId, appearance: Appearance): ChartTokens {
  const p = PALETTES[theme][appearance];
  return {
    ink: p.ink,
    muted: p.inkSoft,
    grid: p.rule,
    accent: p.accent,
    ghost: withAlpha(p.inkSoft, 0.75),
    band: withAlpha(p.accent, 0.12),
    paper: p.surface,
  };
}

const CARD_FONTS: Readonly<Record<ThemeId, { display: string; text: string }>> = {
  almanac: {
    display: "'EB Garamond', Garamond, Georgia, serif",
    text: "'EB Garamond', Garamond, Georgia, serif",
  },
  'situation-room': {
    display: "Geist, 'Segoe UI', Inter, Arial, sans-serif",
    text: "Geist, 'Segoe UI', Inter, Arial, sans-serif",
  },
  terrarium: { display: 'Fraunces, Georgia, serif', text: "Nunito, 'Segoe UI', Arial, sans-serif" },
};

export function cardSkin(theme: ThemeId, appearance: Appearance, manifest: SimManifest): CardSkin {
  const p = PALETTES[theme][appearance];
  return {
    paper: p.bg,
    panel: p.surface,
    ink: p.ink,
    muted: p.inkSoft,
    rule: p.rule,
    accent: manifest.accent[appearance],
    tones: { good: p.toneGood, quiet: p.toneQuiet, hard: p.toneHard, disaster: p.toneDisaster },
    ...CARD_FONTS[theme],
  };
}
