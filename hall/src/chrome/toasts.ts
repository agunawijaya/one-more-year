/**
 * Quiet notices: a milestone reached, a codex entry discovered, storage
 * running in memory only. They appear in a corner, are read out politely by
 * screen readers, and leave on their own. Never more than three at once,
 * and never anything that asks the player to hurry or come back.
 */
import { h, type Child } from '../app/dom.ts';

export interface Toasts {
  readonly element: HTMLElement;
  show(content: { title: string; detail?: string; art?: Child; kind?: string }): void;
  clear(): void;
}

const VISIBLE_MS = 5200;

export function createToasts(): Toasts {
  const element = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
  return {
    element,
    show({ title, detail, art, kind }) {
      const toast = h(
        'div',
        { class: `toast ${kind ? `toast--${kind}` : ''}`.trim() },
        art ? h('span', { class: 'toast__art' }, art) : null,
        h(
          'span',
          { class: 'toast__text' },
          h('strong', {}, title),
          detail ? h('span', {}, detail) : null,
        ),
      );
      element.append(toast);
      while (element.childElementCount > 3) element.firstElementChild?.remove();
      setTimeout(() => {
        toast.classList.add('toast--leaving');
        setTimeout(() => toast.remove(), 400);
      }, VISIBLE_MS);
    },
    clear() {
      element.replaceChildren();
    },
  };
}
