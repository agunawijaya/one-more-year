/**
 * "Choose your study" (§7.4): after the intro on a first visit, the three
 * themes side by side as large live previews (the real Hall views, scaled
 * down) in the visitor's current appearance, with the light/dark toggle in
 * reach. One click chooses; Skip keeps the Almanac. It shows once, unless
 * the player asks for it again in Settings.
 */
import type { Appearance } from '@one-more-year/kit';
import { button, h } from '../app/dom.ts';
import { THEME_IDS, THEME_LINES, THEME_NAMES, type ThemeId } from '../themes/theme-ids.ts';
import { icon } from './icons.ts';

export interface PickerOptions {
  appearance(): Appearance;
  toggleAppearance: () => void;
  /** Mounts a live preview of a theme into the frame; returns its disposer. */
  preview(theme: ThemeId, frame: HTMLElement): () => void;
  choose: (theme: ThemeId) => void;
}

export interface Picker {
  readonly element: HTMLElement;
  setAppearance(appearance: Appearance): void;
  close(): void;
}

export function showPicker(layer: HTMLElement, options: PickerOptions): Picker {
  const disposers: (() => void)[] = [];
  const frames: HTMLElement[] = [];

  const toggle = button(icon('moon'), options.toggleAppearance, {
    class: 'icon-button picker__appearance',
    'data-action': 'toggle-appearance',
  });
  const paintToggle = (appearance: Appearance): void => {
    toggle.replaceChildren(
      icon(appearance === 'dark' ? 'sun' : 'moon'),
      h('span', {}, appearance === 'dark' ? 'Light' : 'Dark'),
    );
    toggle.setAttribute(
      'aria-label',
      appearance === 'dark' ? 'Switch the previews to light' : 'Switch the previews to dark',
    );
  };

  const cards = THEME_IDS.map((theme) => {
    const frame = h('div', {
      class: 'picker__frame',
      'data-theme': theme,
      'data-appearance': options.appearance(),
      'aria-hidden': 'true',
      inert: true,
    });
    frames.push(frame);
    const card = button(
      [
        h('span', { class: 'picker__window' }, frame),
        h('span', { class: 'picker__name' }, THEME_NAMES[theme]),
        h('span', { class: 'picker__line' }, THEME_LINES[theme]),
      ],
      () => options.choose(theme),
      { class: 'picker__card', 'data-theme-choice': theme },
    );
    return card;
  });

  const element = h(
    'div',
    { class: 'picker', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'picker-title' },
    h(
      'header',
      { class: 'picker__header' },
      h('h1', { id: 'picker-title', class: 'picker__title' }, 'Choose your study'),
      h(
        'p',
        { class: 'picker__intro' },
        'Three ways to keep the same almanac of small worlds. You can change your mind any time in the top bar.',
      ),
      toggle,
    ),
    h('div', { class: 'picker__cards' }, cards),
    h(
      'p',
      { class: 'picker__footer' },
      button('Skip for now', () => options.choose('almanac'), {
        class: 'button button--quiet',
        'data-action': 'skip-picker',
      }),
    ),
  );

  layer.replaceChildren(element);
  layer.hidden = false;
  paintToggle(options.appearance());
  THEME_IDS.forEach((theme, index) => {
    const frame = frames[index];
    if (frame) disposers.push(options.preview(theme, frame));
  });
  cards[0]?.focus();

  return {
    element,
    setAppearance(appearance) {
      paintToggle(appearance);
      for (const frame of frames) frame.dataset.appearance = appearance;
    },
    close() {
      for (const dispose of disposers) dispose();
      layer.replaceChildren();
      layer.hidden = true;
    },
  };
}
