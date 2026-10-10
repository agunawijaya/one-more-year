/**
 * Small pieces of chrome that say one thing: the loading veil while a
 * simulation's code arrives, the one-time hint on a first visit to a
 * simulation, the quiet banner when storage only lasts until the tab
 * closes, and the How to play dialog.
 */
import type { HowToPlaySection, SimManifest } from '@one-more-year/kit';
import { h } from '../app/dom.ts';
import { openDialog } from './dialogs.ts';
import { icon } from './icons.ts';

export function loadingVeil(title: string): HTMLElement {
  return h(
    'div',
    { class: 'loading', role: 'status' },
    h('span', { class: 'loading__mark', 'aria-hidden': 'true' }),
    h('span', {}, `Opening ${title}…`),
  );
}

/** "Esc — pause and menu · your world saves itself every turn", once per simulation. */
export function firstVisitHint(host: HTMLElement): void {
  const hint = h(
    'p',
    { class: 'hint', role: 'status' },
    h('kbd', {}, 'Esc'),
    ' pause and menu · your world saves itself every turn',
  );
  host.append(hint);
  setTimeout(() => hint.classList.add('hint--leaving'), 6000);
  setTimeout(() => hint.remove(), 6600);
}

export function storageBanner(reason: 'unavailable' | 'full'): HTMLElement {
  return h(
    'p',
    { class: 'storage-banner', role: 'status' },
    icon('info', 16),
    reason === 'full'
      ? ' Your browser’s storage is full, so progress from now on lasts until this tab closes.'
      : ' This browser is not keeping site data, so progress lasts until this tab closes.',
  );
}

export function openHowToPlay(
  manifest: SimManifest,
  sections: readonly HowToPlaySection[],
  docsUrl: string | null,
): void {
  openDialog({
    title: `How to play ${manifest.title}`,
    kind: 'dialog--how-to-play',
    body: [
      ...sections.map((section) =>
        h(
          'section',
          { class: 'how-to-play__section' },
          h('h3', {}, section.heading),
          h('p', {}, section.text),
        ),
      ),
      docsUrl
        ? h(
            'p',
            { class: 'how-to-play__docs' },
            h(
              'a',
              { href: docsUrl, target: '_blank', rel: 'noopener' },
              'The full manual on GitHub',
              icon('external', 14),
            ),
          )
        : null,
    ],
  });
}
