/**
 * When a ruler dies the screen becomes a page of an illuminated manuscript
 * that writes itself (ui/manuscript.ts), while a bell tolls and a quill
 * scratches. The page can be kept as an SVG share card.
 *
 * Space or a click finishes the lettering at once; the player continues
 * when ready.
 */
import type { Appearance } from '@one-more-year/kit';
import type { PastRuler, Realm, Ruler } from '../../engine/state.ts';
import { obituaryFor } from '../../content/obituary.ts';
import { createManuscriptPage, obituaryCardSvg } from '../../ui/manuscript.ts';
import { el } from '../../ui/dom.ts';

export interface ObituaryOptions {
  host: HTMLElement;
  realm: Realm;
  past: PastRuler;
  heir: Ruler | null;
  appearance: Appearance;
  /** Seconds to letter the page; 0 shows it written. */
  length: number;
  continueLabel: string;
  sound: { bell(): void; quill(): void };
  onSaved(): void;
  onContinue(): void;
}

export interface ObituaryRun {
  skip(): void;
  dispose(): void;
}

export function runObituary(options: ObituaryOptions): ObituaryRun {
  const obituary = obituaryFor(options.realm, options.past, options.heir);
  const page = createManuscriptPage(obituary, options.appearance);
  const save = el(
    'button',
    { type: 'button', class: 'cf-button', 'data-action': 'save-obituary' },
    'Keep this page (SVG)',
  );
  const next = el(
    'button',
    { type: 'button', class: 'cf-button cf-button--primary', 'data-action': 'continue' },
    options.continueLabel,
  );
  const layer = el(
    'div',
    { class: 'cf-obituary', 'data-screen-part': 'obituary' },
    page.element,
    el('div', { class: 'cf-obituary__actions' }, save, next),
  );
  options.host.append(layer);
  options.sound.bell();

  const started = performance.now();
  const length = Math.max(0, options.length);
  let progress = length === 0 ? 1 : 0;
  let frame = 0;
  let scratched = 0;
  const tick = (): void => {
    progress = Math.min(1, (performance.now() - started) / (length * 1000));
    page.setProgress(progress);
    // A quill's scratch every second or so while the text is being written.
    const written = Math.floor(progress * length);
    if (progress > 0.12 && progress < 0.9 && written > scratched) {
      scratched = written;
      options.sound.quill();
    }
    if (progress < 1) frame = requestAnimationFrame(tick);
  };
  void document.fonts.ready.then(() => {
    if (length === 0) page.setProgress(1);
    else frame = requestAnimationFrame(tick);
  });

  const finish = (): void => {
    cancelAnimationFrame(frame);
    progress = 1;
    page.setProgress(1);
  };
  page.element.addEventListener('click', finish);
  save.addEventListener('click', () => {
    const svg = obituaryCardSvg(obituary, options.appearance);
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const link = el('a', {
      href: url,
      download: `${options.past.ruler.name.replace(/\s+/g, '-').toLowerCase()}-of-${options.realm.city.toLowerCase()}.svg`,
    });
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    options.onSaved();
  });
  next.addEventListener('click', () => options.onContinue());
  next.focus();

  return {
    skip: finish,
    dispose() {
      cancelAnimationFrame(frame);
      layer.remove();
    },
  };
}
