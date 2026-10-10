/**
 * The first-visit intro (§7.3), at most five seconds: a calendar leaf flips
 * from one year to the next while a field grows from bare soil to harvest
 * in the same breath, then the logo settles in with "Just one more year."
 * Any key or click skips it. Under reduced motion it is a single
 * cross-fade. It never shows again unless replayed from About or Settings.
 */
import { h, svgFrom } from '../app/dom.ts';
import { wordmark } from './wordmark.ts';

export const INTRO_MS = 4600;
const REDUCED_MS = 1800;

/** Twelve stalks across the field, each a stem, a leaf and a head. */
function fieldArt(): SVGSVGElement {
  const stalks = Array.from({ length: 12 }, (_, i) => {
    const x = 30 + i * 22;
    const lean = ((i % 3) - 1) * 3;
    return (
      `<g class="intro__stalk" style="--grow-delay:${(i % 6) * 70}ms">` +
      `<path d="M${x} 120Q${x + lean} 92 ${x + lean * 1.6} 66"/>` +
      `<path d="M${x + lean * 0.6} 98q-9-4-12-12"/>` +
      `<path class="intro__head" d="M${x + lean * 1.6} 66c-4-5-4-14 0-19c4 5 4 14 0 19z"/>` +
      `</g>`
    );
  }).join('');
  return svgFrom(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 130" class="intro__field" aria-hidden="true">` +
      `<path class="intro__soil" d="M6 122C80 116 240 116 314 122"/>${stalks}</svg>`,
  );
}

export function playIntro(
  layer: HTMLElement,
  options: { reducedMotion: boolean; year: number },
): Promise<void> {
  return new Promise((resolve) => {
    const leaf = h(
      'div',
      { class: 'intro__leaf', 'aria-hidden': 'true' },
      h('span', { class: 'intro__leaf-rings' }),
      h('span', { class: 'intro__year intro__year--old tabular' }, options.year - 1),
      h('span', { class: 'intro__year intro__year--new tabular' }, options.year),
    );
    const line = h('p', { class: 'intro__line' }, 'Just one more year.');
    const logo = h('div', { class: 'intro__logo' }, wordmark(), line);
    const skip = h('p', { class: 'intro__skip' }, 'Press any key to skip');
    const stage = h(
      'div',
      {
        class: `intro ${options.reducedMotion ? 'intro--still' : ''}`.trim(),
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': 'One More Year. Just one more year.',
      },
      h('div', { class: 'intro__scene' }, leaf, fieldArt()),
      logo,
      skip,
    );
    layer.replaceChildren(stage);
    layer.hidden = false;
    stage.tabIndex = -1;
    stage.focus();

    let done = false;
    const finish = (): void => {
      if (done) return;
      done = true;
      window.removeEventListener('keydown', finish, true);
      stage.removeEventListener('pointerdown', finish);
      clearTimeout(timer);
      stage.classList.add('intro--leaving');
      setTimeout(
        () => {
          layer.replaceChildren();
          layer.hidden = true;
          resolve();
        },
        options.reducedMotion ? 0 : 320,
      );
    };
    window.addEventListener('keydown', finish, true);
    stage.addEventListener('pointerdown', finish);
    const timer = setTimeout(finish, options.reducedMotion ? REDUCED_MS : INTRO_MS);
  });
}
