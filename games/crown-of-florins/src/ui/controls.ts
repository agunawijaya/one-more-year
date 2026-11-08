/**
 * The controls of the year's steps: an amount (a slider with a typed box
 * and big steps), a percentage slider, and the four seals of justice.
 *
 * Every control keeps its element across updates, so focus and an
 * unfinished keystroke survive the panel refreshing around it. Arrow keys
 * move one step, Shift ten, Ctrl or Cmd a hundred; Page Up and Page Down
 * move ten; Home and End go to the limits.
 */
import { formatNumber } from '@one-more-year/kit';
import type { Justice } from '../engine/state.ts';
import { el } from './dom.ts';

export interface Bounds {
  min: number;
  max: number;
}

export interface AmountControl {
  readonly element: HTMLElement;
  update(value: number, bounds: Bounds, note: string): void;
  focus(): void;
}

export interface AmountOptions {
  id: string;
  label: string;
  /** Words before the number: "Buy" / "Sell" for a signed trade. */
  verbs?: { up: string; down: string };
  unit: string;
  step: number;
  /** The big steps on the buttons. */
  big: number;
  onChange: (value: number) => void;
}

function stepsFor(event: KeyboardEvent, step: number): number | null {
  const scale = event.ctrlKey || event.metaKey ? 100 : event.shiftKey ? 10 : 1;
  switch (event.key) {
    case 'ArrowRight':
    case 'ArrowUp':
      return step * scale;
    case 'ArrowLeft':
    case 'ArrowDown':
      return -step * scale;
    case 'PageUp':
      return step * 10;
    case 'PageDown':
      return -step * 10;
    default:
      return null;
  }
}

export function amountControl(options: AmountOptions): AmountControl {
  let value = 0;
  let bounds: Bounds = { min: 0, max: 0 };
  const clampTo = (next: number): number => Math.min(bounds.max, Math.max(bounds.min, next));
  const commit = (next: number): void => {
    const clamped = clampTo(Math.round(next));
    if (clamped === value) return;
    value = clamped;
    options.onChange(value);
  };

  const range = el('input', {
    type: 'range',
    id: options.id,
    class: 'cf-amount__range',
    step: options.step,
  });
  const typed = el('input', {
    type: 'text',
    inputmode: 'numeric',
    class: 'cf-amount__typed cf-num',
    'aria-label': `${options.label}, typed`,
    autocomplete: 'off',
  });
  const words = el('span', { class: 'cf-amount__words' });
  const note = el('p', { class: 'cf-amount__note' });
  const less = el(
    'button',
    {
      type: 'button',
      class: 'cf-amount__step',
      'aria-label': `${options.label}: ${formatNumber(options.big)} less`,
    },
    '−',
  );
  const more = el(
    'button',
    {
      type: 'button',
      class: 'cf-amount__step',
      'aria-label': `${options.label}: ${formatNumber(options.big)} more`,
    },
    '+',
  );

  range.addEventListener('input', () => commit(Number(range.value)));
  range.addEventListener('keydown', (event) => {
    const delta = stepsFor(event, options.step);
    if (delta !== null) {
      event.preventDefault();
      commit(value + delta);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      commit(event.key === 'Home' ? bounds.min : bounds.max);
    }
  });
  typed.addEventListener('change', () => {
    const parsed = Number(typed.value.replace(/[^\d-]/g, ''));
    if (Number.isFinite(parsed)) commit(parsed);
    else typed.value = formatNumber(value);
  });
  typed.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      // Enter in the box settles the number; it must not also seal the year.
      event.stopPropagation();
      typed.dispatchEvent(new Event('change'));
    }
  });
  less.addEventListener('click', () => commit(value - options.big));
  more.addEventListener('click', () => commit(value + options.big));

  const element = el(
    'div',
    { class: 'cf-amount' },
    el('label', { class: 'cf-amount__label', for: options.id }, options.label, words),
    el('div', { class: 'cf-amount__row' }, less, range, more, typed),
    note,
  );

  return {
    element,
    update(next, nextBounds, noteText) {
      value = next;
      bounds = nextBounds;
      range.min = String(nextBounds.min);
      range.max = String(nextBounds.max);
      range.value = String(next);
      range.disabled = nextBounds.min === nextBounds.max;
      const text = describe(next, options);
      range.setAttribute('aria-valuetext', text);
      words.textContent = ` · ${text}`;
      if (document.activeElement !== typed) typed.value = formatNumber(next);
      note.textContent = noteText;
      less.disabled = next <= nextBounds.min;
      more.disabled = next >= nextBounds.max;
    },
    focus: () => range.focus(),
  };
}

function describe(value: number, options: AmountOptions): string {
  if (!options.verbs) return `${formatNumber(value)} ${options.unit}`;
  if (value === 0) return 'no trade';
  const verb = value > 0 ? options.verbs.up : options.verbs.down;
  return `${verb} ${formatNumber(Math.abs(value))} ${options.unit}`;
}

/** A slider for one percentage (a tax), with a mark for last year's rate. */
export interface PercentControl {
  readonly element: HTMLElement;
  update(value: number, previous: number, note: string): void;
  focus(): void;
}

export function percentControl(options: {
  id: string;
  label: string;
  max: number;
  onChange: (value: number) => void;
}): PercentControl {
  let value = 0;
  const range = el('input', {
    type: 'range',
    id: options.id,
    class: 'cf-percent__range',
    min: 0,
    max: options.max,
    step: 1,
  });
  const readout = el('output', { class: 'cf-percent__value cf-num', for: options.id });
  const mark = el('span', { class: 'cf-percent__mark', 'aria-hidden': 'true' });
  const note = el('span', { class: 'cf-percent__note' });
  const commit = (next: number): void => {
    const clamped = Math.min(options.max, Math.max(0, Math.round(next)));
    if (clamped === value) return;
    value = clamped;
    options.onChange(value);
  };
  range.addEventListener('input', () => commit(Number(range.value)));
  range.addEventListener('keydown', (event) => {
    const delta = stepsFor(event, 1);
    if (delta !== null) {
      event.preventDefault();
      commit(value + delta);
    }
  });
  const element = el(
    'div',
    { class: 'cf-percent' },
    el('label', { for: options.id, class: 'cf-percent__label' }, options.label),
    readout,
    el('div', { class: 'cf-percent__track' }, range, mark),
    note,
  );
  return {
    element,
    update(next, previous, noteText) {
      value = next;
      range.value = String(next);
      range.setAttribute('aria-valuetext', `${next} percent; last year ${previous} percent`);
      readout.textContent = `${next}%`;
      mark.style.left = `calc(${(previous / options.max) * 100}% - 1px)`;
      mark.title = `Last year: ${previous}%`;
      note.textContent = noteText;
    },
    focus: () => range.focus(),
  };
}

export const JUSTICE_NAMES = ['Very fair', 'Moderate', 'Harsh', 'Outrageous'] as const;

/** The four seals of justice, as one radio group (arrow keys move between them). */
export interface SealsControl {
  readonly element: HTMLElement;
  update(value: Justice): void;
  focus(): void;
}

export function sealsControl(onChange: (value: Justice) => void): SealsControl {
  let value: Justice = 2;
  const seals = JUSTICE_NAMES.map((name, i) => {
    const level = (i + 1) as Justice;
    const seal = el(
      'button',
      {
        type: 'button',
        role: 'radio',
        class: 'cf-seal-choice',
        'data-level': level,
        'aria-label': `${name} justice`,
      },
      el('span', { class: 'cf-seal-choice__wax', 'aria-hidden': 'true' }, String(level)),
      el('span', { class: 'cf-seal-choice__name' }, name),
    );
    seal.addEventListener('click', () => choose(level));
    seal.addEventListener('keydown', (event) => {
      const delta =
        event.key === 'ArrowRight' || event.key === 'ArrowDown'
          ? 1
          : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
            ? -1
            : 0;
      if (delta === 0) return;
      event.preventDefault();
      const next = Math.min(4, Math.max(1, value + delta)) as Justice;
      choose(next);
      seals[next - 1]?.focus();
    });
    return seal;
  });
  function choose(level: Justice): void {
    if (level === value) return;
    value = level;
    onChange(level);
  }
  const element = el(
    'div',
    { class: 'cf-seals', role: 'radiogroup', 'aria-label': 'Seal of justice' },
    ...seals,
  );
  return {
    element,
    update(next) {
      value = next;
      seals.forEach((seal, i) => {
        const chosen = i + 1 === next;
        seal.setAttribute('aria-checked', String(chosen));
        seal.tabIndex = chosen ? 0 : -1;
      });
    },
    focus: () => seals[value - 1]?.focus(),
  };
}
