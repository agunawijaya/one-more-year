/**
 * Endings. The stele: at the end of a term (and between the terms of a
 * Dynasty) a basalt stone carves itself one register a year while the light
 * sweeps across it; then the verdict, the epithet, and the way on. It can be
 * turned by dragging, and downloaded as a drawing.
 */
import { downloadSvg, shareFileName, type Appearance } from '@one-more-year/kit';
import { buildRelief, type StelePlan } from '../../stele/relief.ts';
import { createSteleView, type SteleView } from '../../stele/stele-scene.ts';
import { steleSvg } from '../../stele/svg.ts';
import { button, el } from '../../ui/dom.ts';
import { onKeyPress } from '../keys.ts';

export interface SteleScreenOptions {
  host: HTMLElement;
  plans: readonly StelePlan[];
  appearance: Appearance;
  reducedMotion: boolean;
  eyebrow: string;
  verdict: string;
  lines: readonly string[];
  epithet: string | null;
  primaryLabel: string;
  onPrimary(): void;
  onChisel(): void;
}

export interface SteleScreen {
  setAppearance(appearance: Appearance): void;
  dispose(): void;
}

/** Seconds of carving per step (a head, a register or a foot). */
const STEP_SECONDS = 0.62;

export function runStele(options: SteleScreenOptions): SteleScreen {
  const reliefs = options.plans.map(buildRelief);
  const stage = el('div', { class: 'th-stele-stage' });
  const view: SteleView = createSteleView(stage, reliefs, options.appearance);
  const primary = button(options.primaryLabel, () => options.onPrimary(), {
    class: 'th-primary',
    'data-action': 'stele-continue',
  });
  const download = button(
    'Download the stele',
    () => {
      const first = reliefs[reliefs.length - 1];
      if (first)
        downloadSvg(steleSvg(first), shareFileName(`ten-harvests-stele-${options.verdict}`));
    },
    { class: 'th-secondary', 'data-action': 'download-stele' },
  );
  const panel = el(
    'section',
    { class: 'th-stele-panel th-clay', 'aria-labelledby': 'th-verdict', hidden: true },
    el('p', { class: 'th-stele-panel__eyebrow' }, options.eyebrow),
    el('h1', { id: 'th-verdict' }, options.verdict),
    ...options.lines.map((line) => el('p', {}, line)),
    options.epithet
      ? el('p', { class: 'th-stele-panel__epithet' }, `Remembered as “${options.epithet}”`)
      : null,
    el('div', { class: 'th-stele-panel__actions' }, primary, download),
  );
  const hint = el('p', { class: 'th-skip' }, 'Space · finish carving · drag to turn the stone');
  stage.append(panel, hint);
  options.host.append(stage);

  const total = view.steps * STEP_SECONDS;
  const started = performance.now();
  let carved = options.reducedMotion;
  let lastStep = -1;
  let frame = 0;

  function reveal(): void {
    panel.hidden = false;
    hint.textContent = 'Drag to turn the stone';
    primary.focus();
  }

  function tick(): void {
    const elapsed = (performance.now() - started) / 1000;
    const progress = carved ? 1 : Math.min(1, elapsed / total);
    view.setCarving(progress);
    const step = Math.floor(progress * view.steps);
    if (step !== lastStep && !carved) {
      lastStep = step;
      options.onChisel();
    }
    if (progress >= 1 && panel.hidden) reveal();
    view.renderOnce();
    frame = requestAnimationFrame(tick);
  }
  if (carved) reveal();
  frame = requestAnimationFrame(tick);

  // Drag to turn; the stone settles back when let go.
  let dragFrom: number | null = null;
  view.canvas.addEventListener('pointerdown', (event) => {
    dragFrom = event.clientX;
    view.canvas.setPointerCapture(event.pointerId);
    if (!carved) carved = true;
  });
  view.canvas.addEventListener('pointermove', (event) => {
    if (dragFrom !== null) view.turn((event.clientX - dragFrom) * 0.006);
  });
  const release = (): void => {
    dragFrom = null;
    view.turn(0);
  };
  view.canvas.addEventListener('pointerup', release);
  view.canvas.addEventListener('pointercancel', release);

  // Space finishes the carving on release, so the button it reveals is not pressed by the same key.
  const stopSpace = onKeyPress([' '], () => {
    carved = true;
  });
  function onKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' && carved && document.activeElement?.tagName !== 'BUTTON') {
      event.preventDefault();
      options.onPrimary();
    }
  }
  window.addEventListener('keydown', onKey);

  return {
    setAppearance(next) {
      view.setAppearance(next);
    },
    dispose() {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKey);
      stopSpace();
      view.dispose();
      stage.remove();
    },
  };
}
