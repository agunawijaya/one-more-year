/**
 * The share sheet: the run's text string (copy) and its SVG card (download),
 * side by side. Nothing leaves the device unless the player pastes or sends
 * it somewhere themselves.
 */
import {
  copyText,
  downloadSvg,
  shareFileName,
  type ChronicleEntry,
  type SimManifest,
} from '@one-more-year/kit';
import { button, h, svgFrom } from '../app/dom.ts';
import { openDialog } from './dialogs.ts';
import { icon } from './icons.ts';
import { shareCardSvg, type CardSkin } from './share-card.ts';

export function openShareSheet(entry: ChronicleEntry, manifest: SimManifest, skin: CardSkin): void {
  const card = shareCardSvg(entry, manifest, skin);
  const status = h('p', { class: 'share__status', role: 'status' });
  const preview = svgFrom(card);
  preview.removeAttribute('width');
  preview.removeAttribute('height');
  const title = entry.daily ? `${manifest.title} #${entry.daily.number}` : manifest.title;

  openDialog({
    title: 'Share this chronicle',
    kind: 'dialog--share',
    body: [
      h('div', { class: 'share__card' }, preview),
      h('pre', { class: 'share__text', 'aria-label': 'Share text' }, entry.share),
      h(
        'div',
        { class: 'dialog__actions' },
        button(
          [icon('copy', 18), h('span', {}, 'Copy text')],
          () => {
            void copyText(entry.share).then((copied) => {
              status.textContent = copied
                ? 'Copied. Paste it wherever you like.'
                : 'Your browser would not copy; select the text above instead.';
            });
          },
          { class: 'button button--primary', 'data-action': 'copy-share' },
        ),
        button(
          [icon('download', 18), h('span', {}, 'Download card')],
          () => {
            downloadSvg(card, shareFileName(title));
            status.textContent = 'The card is saved as an SVG file.';
          },
          { class: 'button', 'data-action': 'download-card' },
        ),
      ),
      status,
      h(
        'p',
        { class: 'share__privacy' },
        'Neither the text nor the card contains your name or any personal details.',
      ),
    ],
  });
}
