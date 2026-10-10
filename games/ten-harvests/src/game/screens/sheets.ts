/**
 * Ten Harvests' own sheets: a modal panel over the game, used for the Codex
 * and the game's options. Focus stays inside while it is open, and Escape
 * closes it before the Hall ever hears the key.
 */
import type { CodexEntryView, SimContext } from '@one-more-year/kit';
import { button, el } from '../../ui/dom.ts';
import type { OptionStore } from '../options.ts';

export interface Sheet {
  close(): void;
}

export function openSheet(
  root: HTMLElement,
  title: string,
  body: (Node | null)[],
  onClose?: () => void,
): Sheet {
  const returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const heading = el('h2', { id: 'th-sheet-title' }, title);
  const closeButton = button('Close', () => close(), {
    class: 'th-quiet',
    'data-action': 'close-sheet',
  });
  const panel = el(
    'div',
    {
      class: 'th-sheet th-clay',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'th-sheet-title',
      tabindex: -1,
    },
    el('div', { class: 'th-sheet__head' }, heading, closeButton),
    el('div', { class: 'th-sheet__body' }, ...body),
  );
  const backdrop = el('div', { class: 'th-sheet-backdrop' }, panel);
  root.append(backdrop);
  panel.focus();

  function onKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      close();
    } else if (event.key === 'Tab') {
      const focusable = [
        ...panel.querySelectorAll<HTMLElement>('button, input, [tabindex="0"]'),
      ].filter((node) => !node.hidden);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }
  window.addEventListener('keydown', onKey, true);
  backdrop.addEventListener('pointerdown', (event) => {
    if (event.target === backdrop) close();
  });

  let open = true;
  function close(): void {
    if (!open) return;
    open = false;
    window.removeEventListener('keydown', onKey, true);
    backdrop.remove();
    returnTo?.focus();
    onClose?.();
  }
  return { close };
}

function codexArt(markup: string): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 48 48');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = markup;
  return svg;
}

function codexEntry(view: CodexEntryView): HTMLElement {
  const { def } = view;
  if (!view.discovered) {
    return el(
      'article',
      { class: 'th-codex__entry', 'data-discovered': 'false' },
      el('div', { class: 'th-codex__art th-codex__art--hidden' }, codexArt(def.art)),
      el('div', {}, el('h3', {}, 'Not yet seen'), el('p', {}, def.hint)),
    );
  }
  const reveal = def.revealAfter ?? 3;
  return el(
    'article',
    { class: 'th-codex__entry', 'data-discovered': 'true' },
    el('div', { class: 'th-codex__art' }, codexArt(def.art)),
    el(
      'div',
      {},
      el('h3', {}, def.title),
      el('p', {}, def.summary),
      el('p', { class: 'th-codex__tendency' }, def.tendency),
      view.mechanismRevealed
        ? el('p', { class: 'th-codex__rule' }, el('strong', {}, 'The rule: '), def.mechanism)
        : el(
            'p',
            { class: 'th-codex__locked' },
            `Seen ${view.seen} of ${reveal} times. The exact rule shows after ${reveal}.`,
          ),
    ),
  );
}

export function openCodex(root: HTMLElement, ctx: SimContext): Sheet {
  const entries = ctx.codex.entries();
  const { discovered, total } = ctx.codex.progress();
  return openSheet(root, 'The Codex', [
    el(
      'p',
      { class: 'th-sheet__lead' },
      `${discovered} of ${total} discovered. Each entry reveals its exact rule once you have seen it a few times.`,
    ),
    el('div', { class: 'th-codex' }, ...entries.map(codexEntry)),
  ]);
}

function radios<T extends string>(
  name: string,
  legend: string,
  choices: readonly { value: T; label: string }[],
  current: T,
  onChange: (value: T) => void,
): HTMLFieldSetElement {
  return el(
    'fieldset',
    { class: 'th-options__group' },
    el('legend', {}, legend),
    el(
      'div',
      { class: 'th-options__choices' },
      ...choices.map((choice) => {
        const input = el('input', {
          type: 'radio',
          name,
          value: choice.value,
          checked: choice.value === current,
        });
        input.addEventListener('change', () => input.checked && onChange(choice.value));
        return el('label', { class: 'th-options__choice' }, input, el('span', {}, choice.label));
      }),
    ),
  );
}

export function openOptions(root: HTMLElement, ctx: SimContext, options: OptionStore): Sheet {
  const orbit = el('input', { type: 'checkbox', checked: options.get('orbit') });
  orbit.addEventListener('change', () => options.set('orbit', orbit.checked));
  let sheet: Sheet | null = null;
  sheet = openSheet(root, 'Ten Harvests options', [
    radios(
      'th-graphics',
      'Graphics',
      [
        { value: 'high', label: 'High' },
        { value: 'balanced', label: 'Balanced' },
        { value: 'light', label: 'Light' },
      ],
      options.get('graphics'),
      (value) => options.set('graphics', value),
    ),
    el(
      'p',
      { class: 'th-options__note' },
      'The city steps down by itself if your computer struggles, and back up when it can.',
    ),
    radios(
      'th-speed',
      'The year’s cinematic',
      [
        { value: 'cinematic', label: 'Cinematic (about ten seconds)' },
        { value: 'quick', label: 'Quick (three seconds)' },
        { value: 'instant', label: 'Instant' },
      ],
      options.get('speed'),
      (value) => options.set('speed', value),
    ),
    el(
      'label',
      { class: 'th-options__toggle' },
      orbit,
      el('span', {}, 'Let me turn the city (right-drag, Q and E)'),
    ),
    el(
      'p',
      { class: 'th-options__note' },
      'Forecasts, the scribe’s hints, sound, motion and appearance are in the collection’s settings.',
    ),
    button(
      'All settings…',
      () => {
        sheet?.close();
        ctx.openSettings();
      },
      { class: 'th-secondary' },
    ),
  ]);
  return sheet;
}
