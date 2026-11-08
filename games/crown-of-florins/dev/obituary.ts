// The obituary page from a real game: the first human ruler's death, in Dynasty.
//
//   ?appearance=dark&seed=3&at=0.62
//
// `at` holds the page at a moment of its lettering (0–1); without it the
// page writes itself over twenty seconds.
import '../../../hall/src/styles/fonts.css';
import '../src/ui/crown.css';
import { quickCourt } from '../src/engine/court.ts';
import { policyFor } from '../src/engine/policies.ts';
import { playGame } from '../src/engine/simulate.ts';
import { obituaryFor } from '../src/content/obituary.ts';
import { el } from '../src/ui/dom.ts';
import { createManuscriptPage } from '../src/ui/manuscript.ts';

const params = new URLSearchParams(window.location.search);
const number = (name: string, fallback: number): number => {
  const value = params.get(name);
  return value === null ? fallback : Number(value);
};
const appearance = params.get('appearance') === 'dark' ? 'dark' : 'light';
const seed = number('seed', 5);

const { world } = playGame({
  seed,
  court: quickCourt(seed, 1, 3, { difficulty: 4 }),
  bot: policyFor('builder'),
  maxSteps: 90,
  until: (w) => (w.realms[0]?.pastRulers.length ?? 0) > 0,
});
const realm = world.realms[0];
const past = realm?.pastRulers[0];
if (!realm || !past) throw new Error('No ruler has died in this game yet');

const root = el('div', { class: 'cf cf-obituary', 'data-appearance': appearance });
document.getElementById('app')?.append(root);
const page = createManuscriptPage(obituaryFor(realm, past, realm.ruler), appearance);
root.append(page.element);

const fixed = params.get('at');
if (fixed !== null) {
  // Let the fonts settle so words have their final widths before the quill is placed.
  void document.fonts.ready.then(() => page.setProgress(Number(fixed)));
} else {
  const started = performance.now();
  const tick = (): void => {
    const t = Math.min(1, (performance.now() - started) / 20_000);
    page.setProgress(t);
    if (t < 1) requestAnimationFrame(tick);
  };
  void document.fonts.ready.then(() => requestAnimationFrame(tick));
}

Object.assign(window, { __obituary: { world, realm, page } });
