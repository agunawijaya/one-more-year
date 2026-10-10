/**
 * The share card: a 1200×630 SVG of a finished run, drawn in the current
 * theme's colours. It shows the simulation's emblem and title, the daily
 * number if there is one, the epithet, the verdict, the timeline strip and
 * the final numbers. It never contains a name or anything else personal;
 * hot-seat names are left out on purpose.
 *
 * The card is a standalone SVG file, so its fonts are named with fallbacks
 * that exist on any machine (the Hall's own fonts are not embedded).
 */
import {
  escapeXml,
  formatStyled,
  type ChronicleEntry,
  type SimManifest,
  type TurnTone,
} from '@one-more-year/kit';
import { MARK_PATHS } from './wordmark.ts';

export interface CardSkin {
  paper: string;
  panel: string;
  ink: string;
  muted: string;
  rule: string;
  accent: string;
  tones: Readonly<Record<TurnTone, string>>;
  display: string;
  text: string;
}

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

export function shareCardSvg(entry: ChronicleEntry, manifest: SimManifest, skin: CardSkin): string {
  const x = (text: string): string => escapeXml(text);
  const title = entry.daily ? `${manifest.title} #${entry.daily.number}` : manifest.title;
  const strip = timelineStrip(entry, skin, 96, 374, CARD_WIDTH - 192);
  // Long epithets shrink to stay inside the card (about half an em per glyph).
  const epithet = `“${entry.epithet.text}”`;
  const epithetSize = Math.min(62, Math.floor(1960 / epithet.length));
  const signals = manifest.signals.slice(0, 3).map((signal, index) => {
    const value = entry.finalSignals[signal.id] ?? 0;
    const left = 96 + index * 280;
    return (
      `<text x="${left}" y="494" font-family="${skin.text}" font-size="22" fill="${skin.muted}">${x(signal.label)}</text>` +
      `<text x="${left}" y="542" font-family="${skin.display}" font-size="40" font-weight="600" fill="${skin.ink}" style="font-variant-numeric: tabular-nums">${x(formatStyled(value, signal.format))}</text>`
    );
  });
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" role="img" aria-label="${x(`${title}: ${entry.epithet.text}`)}">`,
    `<rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="${skin.paper}"/>`,
    `<rect x="40" y="40" width="${CARD_WIDTH - 80}" height="${CARD_HEIGHT - 80}" rx="18" fill="${skin.panel}" stroke="${skin.rule}" stroke-width="2"/>`,
    `<g transform="translate(96 84) scale(1.6)" fill="none" stroke="${skin.muted}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${MARK_PATHS}</g>`,
    `<text x="144" y="110" font-family="${skin.text}" font-size="24" fill="${skin.muted}" letter-spacing="1">One More Year</text>`,
    `<g transform="translate(${CARD_WIDTH - 236} 84)"><circle cx="70" cy="70" r="70" fill="none" stroke="${skin.accent}" stroke-width="3"/>`,
    `<g transform="translate(22 22) scale(4)"><path d="${x(manifest.emblem)}" fill="none" stroke="${skin.accent}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></g></g>`,
    `<text x="96" y="188" font-family="${skin.text}" font-size="30" fill="${skin.accent}" font-weight="600">${x(title)}</text>`,
    `<text x="96" y="262" font-family="${skin.display}" font-size="${epithetSize}" fill="${skin.ink}">${x(epithet)}</text>`,
    `<text x="96" y="314" font-family="${skin.text}" font-size="28" fill="${skin.muted}">${x(entry.outcome.verdict.label)} · ${x(entry.scenarioTitle)} · ${entry.turns} ${x(entry.turnUnit)}${entry.turns === 1 ? '' : 's'}</text>`,
    strip,
    `<line x1="96" x2="${CARD_WIDTH - 96}" y1="452" y2="452" stroke="${skin.rule}" stroke-width="1.5"/>`,
    ...signals,
    `</svg>`,
  ].join('');
}

/** One rounded block per turn, coloured by how the turn went. */
function timelineStrip(
  entry: ChronicleEntry,
  skin: CardSkin,
  left: number,
  top: number,
  width: number,
): string {
  const count = Math.max(1, entry.timeline.length);
  const gap = count > 30 ? 3 : 6;
  const size = Math.min(44, (width - gap * (count - 1)) / count);
  return entry.timeline
    .map((turn, index) => {
      const x = left + index * (size + gap);
      return `<rect x="${x.toFixed(1)}" y="${top}" width="${size.toFixed(1)}" height="${size.toFixed(1)}" rx="${(size / 4).toFixed(1)}" fill="${skin.tones[turn.tone]}"/>`;
    })
    .join('');
}
