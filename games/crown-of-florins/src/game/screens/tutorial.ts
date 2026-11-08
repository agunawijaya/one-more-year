/**
 * The first year, guided by the city's herald: eight short cards that walk
 * through the year screen, each pointing at the part it explains and
 * opening the step it talks about. Under two minutes; skippable at any
 * moment (the button or Escape) and never shown again once finished or
 * skipped.
 */
import type { StepId } from '../../content/words.ts';
import { el, svgNode } from '../../ui/dom.ts';

interface Card {
  target: string;
  step?: StepId;
  title: string;
  text: string;
}

function cards(city: string): Card[] {
  return [
    {
      target: '.cf-ruler',
      title: `Welcome to ${city}`,
      text: 'I am the herald of the city. You rule it from the year 1400, racing up to five rivals to the crown. Your ruler’s last year is fixed but hidden; the honest odds are written here.',
    },
    {
      target: '[data-panel="harvest"]',
      step: 'harvest',
      title: '1 · Harvest',
      text: 'Each year opens with the weather, the rats and the harvest, and tells you how much bread the people need.',
    },
    {
      target: '[data-panel="market"]',
      step: 'market',
      title: '2 · Market',
      text: 'Buy grain when it is cheap and land when there are hands to work it. In the fresco you can drag a sack between the granary and the stalls, or pull the line of the walls.',
    },
    {
      target: '[data-panel="bread"]',
      step: 'bread',
      title: '3 · Bread',
      text: 'Give the people at least what they need. A third more draws newcomers to the gates, with merchants, a noble and clergy among them.',
    },
    {
      target: '[data-panel="taxes"]',
      step: 'taxes',
      title: '4 · Taxes and justice',
      text: 'Three taxes share one willingness to pay. Harsher courts bring in fines, but serfs flee them and every level is taken from your title.',
    },
    {
      target: '[data-panel="builders"]',
      step: 'builders',
      title: '5 · Builders',
      text: 'Markets and mills pay their way; the palace and the cathedral raise you; a platoon guards the border from next year. Drag a card onto a lit plot, or use the steppers.',
    },
    {
      target: '.cf-year__glass',
      title: 'The glass box',
      text: 'The road to the next title, the border watch and the debt, worked out by the same rules as the year itself. Nothing here is a guess dressed as a fact.',
    },
    {
      target: '.cf-seal',
      title: 'Seal the year',
      text: 'When the plan is ready, seal it (Enter). The heralds will read out what happened and whether you rise. Good fortune, and long life.',
    },
  ];
}

export function runTutorial(
  host: HTMLElement,
  city: string,
  setStep: (step: StepId) => void,
  onEnd: () => void,
): () => void {
  const list = cards(city);
  let index = 0;
  const title = el('h2', { id: 'cf-coach-title', class: 'cf-coach__title' });
  const text = el('p', { class: 'cf-coach__text' });
  const count = el('span', { class: 'cf-coach__count' });
  const next = el(
    'button',
    { type: 'button', class: 'cf-button cf-button--primary', 'data-action': 'coach-next' },
    'Next',
  );
  const skip = el(
    'button',
    { type: 'button', class: 'cf-button', 'data-action': 'coach-skip' },
    'Skip the tour',
  );
  const ring = el('div', { class: 'cf-coach__ring', 'aria-hidden': 'true' });
  const card = el(
    'div',
    {
      class: 'cf-coach__card cf-card',
      role: 'dialog',
      'aria-labelledby': 'cf-coach-title',
      'aria-describedby': 'cf-coach-text',
    },
    svgNode(HERALD_BUST),
    el(
      'div',
      {},
      count,
      title,
      Object.assign(text, { id: 'cf-coach-text' }),
      el('div', { class: 'cf-coach__actions' }, skip, next),
    ),
  );
  const layer = el('div', { class: 'cf-coach' }, ring, card);
  host.append(layer);

  function show(): void {
    const current = list[index];
    if (!current) {
      end();
      return;
    }
    if (current.step) setStep(current.step);
    title.textContent = current.title;
    text.textContent = current.text;
    count.textContent = `${index + 1} of ${list.length}`;
    next.textContent = index === list.length - 1 ? 'Begin' : 'Next';
    requestAnimationFrame(() => {
      const target = host.querySelector<HTMLElement>(current.target);
      const box = host.getBoundingClientRect();
      if (!target) {
        ring.hidden = true;
        return;
      }
      const r = target.getBoundingClientRect();
      ring.hidden = false;
      Object.assign(ring.style, {
        left: `${r.left - box.left - 6}px`,
        top: `${r.top - box.top - 6}px`,
        width: `${r.width + 12}px`,
        height: `${r.height + 12}px`,
      });
      // The card sits beside its target, on whichever side has room.
      const right = r.right + 380 < box.right;
      card.style.left = right
        ? `${r.right - box.left + 18}px`
        : `${Math.max(16, r.left - box.left - 380)}px`;
      card.style.top = `${Math.min(box.height - 260, Math.max(80, r.top - box.top))}px`;
    });
    next.focus();
  }

  let ended = false;
  function end(): void {
    if (ended) return;
    ended = true;
    window.removeEventListener('keydown', onKey, true);
    layer.remove();
    onEnd();
  }
  function onKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      end();
    }
  }
  next.addEventListener('click', () => {
    index += 1;
    show();
  });
  skip.addEventListener('click', end);
  window.addEventListener('keydown', onKey, true);
  show();
  return end;
}

const HERALD_BUST =
  '<svg class="cf-coach__herald" viewBox="0 0 80 96" width="72" height="86" aria-hidden="true"><g stroke="#2b1f15" stroke-width="1.6" stroke-linejoin="round"><path d="M10 96c2-22 14-34 30-34s28 12 30 34z" fill="#a12e1a"/><path d="M28 62h24v34H28z" fill="#d8aa3a"/><path d="M40 70l6 10-6 10-6-10z" fill="#a12e1a"/><circle cx="40" cy="40" r="15" fill="#e8c9a2"/><path d="M25 36c2-14 28-16 31 0c-7-5-24-5-31 0z" fill="#3a2414"/><path d="M24 30c4-12 28-14 33-2l-4 3c-6-8-20-7-25 2z" fill="#24477e"/></g></svg>';
