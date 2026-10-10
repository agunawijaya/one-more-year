// AA contrast for all six theme × appearance palettes, every simulation
// accent on every theme's reading surface, and the cosmetics' colours.
import { AA_LARGE, AA_TEXT, contrastRatio, type Appearance } from '@one-more-year/kit';
import { describe, expect, it } from 'vitest';
import { COMING_SOON } from '../src/data/coming-soon.ts';
import { COSMETICS } from '../src/data/cosmetics.ts';
import { THEME_IDS } from '../src/themes/theme-ids.ts';
import { PALETTES } from '../src/themes/tokens.ts';
import { manifest as pond } from './fixtures/pond/manifest.ts';

const APPEARANCES: Appearance[] = ['light', 'dark'];
const variants = THEME_IDS.flatMap((theme) =>
  APPEARANCES.map((appearance) => [theme, appearance] as const),
);

describe.each(variants)('%s · %s', (theme, appearance) => {
  const p = PALETTES[theme][appearance];

  it('keeps body and secondary text AA on both surfaces', () => {
    for (const background of [p.surface, p.surface2]) {
      expect(contrastRatio(p.ink, background)).toBeGreaterThanOrEqual(AA_TEXT);
      expect(contrastRatio(p.inkSoft, background)).toBeGreaterThanOrEqual(AA_TEXT);
      expect(contrastRatio(p.accent, background)).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });

  it('keeps text on the backdrop AA', () => {
    expect(contrastRatio(p.ink, p.bg)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('keeps text on the accent fill AA', () => {
    expect(contrastRatio(p.accentInk, p.accent)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('keeps status colours AA as text on the surface', () => {
    for (const colour of [p.good, p.warning, p.disaster]) {
      expect(contrastRatio(colour, p.surface)).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });

  it('keeps timeline marks visible against the surface (3:1 for graphics)', () => {
    for (const colour of [p.toneGood, p.toneHard, p.toneDisaster]) {
      expect(contrastRatio(colour, p.surface)).toBeGreaterThanOrEqual(AA_LARGE);
    }
    expect(contrastRatio(p.focus, p.surface)).toBeGreaterThanOrEqual(AA_LARGE);
  });

  it('gives every simulation accent AA on the reading surface', () => {
    for (const manifest of [...COMING_SOON, pond]) {
      expect(
        contrastRatio(manifest.accent[appearance], p.surface),
        manifest.id,
      ).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });
});

describe('cosmetics', () => {
  it('keep the Situation Room signal colour AA on its surfaces and under button text', () => {
    for (const cosmetic of COSMETICS.filter((item) => item.theme === 'situation-room')) {
      for (const appearance of APPEARANCES) {
        const p = PALETTES['situation-room'][appearance];
        const signal = cosmetic.tokens[appearance]['--signal'] ?? '';
        expect(contrastRatio(signal, p.surface), cosmetic.id).toBeGreaterThanOrEqual(AA_TEXT);
        const buttonText = appearance === 'light' ? '#ffffff' : p.accentInk;
        expect(contrastRatio(buttonText, signal), cosmetic.id).toBeGreaterThanOrEqual(AA_TEXT);
      }
    }
  });
});
