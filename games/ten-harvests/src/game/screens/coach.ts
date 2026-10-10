/**
 * The first-run tour: the scribe points at five things on the plan screen,
 * one at a time, and then lets the player end their first year (which turns
 * quickly). Skippable at any step; never shown again once finished.
 */
import { button, el } from '../../ui/dom.ts';

interface Step {
  target: string;
  title: string;
  text: string;
}

const STEPS: readonly Step[] = [
  {
    target: '.th-signals',
    title: 'Three numbers',
    text: 'People, grain in store and acres. Everything you decide moves these three.',
  },
  {
    target: '.th-budget',
    title: 'The granary',
    text: 'This bar is all your grain. Drag a handle to move it between food, seed, land and what you keep.',
  },
  {
    target: '.th-diorama',
    title: 'Your fields',
    text: 'Drag the glowing post at the edge of the fields to buy or sell land. Click a field to sow it or leave it fallow.',
  },
  {
    target: '.th-ledger',
    title: 'The honest ledger',
    text: 'Every possible harvest, the odds of rats and fever, who will be fed. No guesses: the numbers the year will use.',
  },
  {
    target: '.th-primary[data-action="end-year"]',
    title: 'End the year',
    text: 'When the decree feels right, end the year. There is no going back; the river keeps what happens.',
  },
];

export function runCoach(root: HTMLElement, onFinish: () => void): () => void {
  let index = 0;
  const title = el('strong');
  const text = el('p');
  const count = el('span', { class: 'th-coach__count' });
  const next = button('Next', () => advance(), {
    class: 'th-secondary',
    'data-action': 'coach-next',
  });
  const skip = button('Skip the tour', () => finish(), {
    class: 'th-quiet',
    'data-action': 'coach-skip',
  });
  const bubble = el(
    'div',
    { class: 'th-coach th-clay', role: 'dialog', 'aria-live': 'polite', 'aria-label': 'Tour' },
    count,
    title,
    text,
    el('div', { class: 'th-coach__actions' }, skip, next),
  );
  const ring = el('div', { class: 'th-coach-ring', 'aria-hidden': 'true' });
  root.append(ring, bubble);

  function place(): void {
    const step = STEPS[index];
    if (!step) return;
    const target = root.querySelector<HTMLElement>(step.target);
    count.textContent = `${index + 1} of ${STEPS.length}`;
    title.textContent = step.title;
    text.textContent = step.text;
    next.textContent = index === STEPS.length - 1 ? 'Got it' : 'Next';
    if (!target) return;
    const box = target.getBoundingClientRect();
    const host = root.getBoundingClientRect();
    ring.style.left = `${box.left - host.left - 6}px`;
    ring.style.top = `${box.top - host.top - 6}px`;
    ring.style.width = `${box.width + 12}px`;
    ring.style.height = `${box.height + 12}px`;
    const below = box.bottom + 16 + 200 < host.bottom;
    bubble.style.left = `${Math.min(host.width - 380, Math.max(16, box.left - host.left))}px`;
    bubble.style.top = below
      ? `${box.bottom - host.top + 16}px`
      : `${Math.max(16, box.top - host.top - 200)}px`;
  }

  function advance(): void {
    index++;
    if (index >= STEPS.length) finish();
    else place();
  }

  let done = false;
  function finish(): void {
    if (done) return;
    done = true;
    window.removeEventListener('resize', place);
    bubble.remove();
    ring.remove();
    onFinish();
  }

  window.addEventListener('resize', place);
  requestAnimationFrame(() => {
    place();
    next.focus();
  });
  return finish;
}
