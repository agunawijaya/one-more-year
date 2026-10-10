/**
 * The top bar, the same in every theme (each theme only skins it): the
 * wordmark home link, the three Hall pages, then the controls a player
 * reaches for most: theme, light/dark, sound and settings.
 */
import type { Appearance } from '@one-more-year/kit';
import { button, h } from '../app/dom.ts';
import { THEME_IDS, THEME_NAMES, type ThemeId } from '../themes/theme-ids.ts';
import { icon } from './icons.ts';
import { wordmark } from './wordmark.ts';

export interface TopBarActions {
  home: () => void;
  library: () => void;
  codex: () => void;
  legacy: () => void;
  setTheme: (theme: ThemeId) => void;
  toggleAppearance: () => void;
  toggleSound: () => void;
  settings: () => void;
}

export interface TopBarState {
  theme: ThemeId;
  appearance: Appearance;
  muted: boolean;
  /** Which page is showing, for aria-current. */
  page: 'hall' | 'library' | 'codex' | 'legacy' | 'about' | 'play';
}

export interface TopBar {
  readonly element: HTMLElement;
  update(state: TopBarState): void;
}

export function createTopBar(actions: TopBarActions): TopBar {
  const link = (
    label: string,
    page: TopBarState['page'],
    iconName: 'library' | 'codex' | 'legacy',
    go: () => void,
  ) =>
    button([icon(iconName, 18), h('span', {}, label)], go, {
      class: 'top-bar__link',
      'data-page': page,
    });

  const home = h(
    'a',
    { class: 'top-bar__home', href: '#/', 'aria-label': 'One More Year, the Hall' },
    wordmark(),
  );
  home.addEventListener('click', (event) => {
    event.preventDefault();
    actions.home();
  });

  const links = [
    link('Library', 'library', 'library', actions.library),
    link('Codex', 'codex', 'codex', actions.codex),
    link('Legacy', 'legacy', 'legacy', actions.legacy),
  ];

  const themeButtons = THEME_IDS.map((theme) =>
    button(THEME_NAMES[theme], () => actions.setTheme(theme), {
      class: 'top-bar__theme',
      'data-theme-choice': theme,
      'aria-pressed': 'false',
    }),
  );
  const themeGroup = h(
    'div',
    { class: 'top-bar__themes', role: 'group', 'aria-label': 'Theme' },
    themeButtons,
  );

  const appearance = button(icon('moon'), actions.toggleAppearance, {
    class: 'icon-button top-bar__appearance',
    'data-action': 'toggle-appearance',
  });
  const sound = button(icon('soundOn'), actions.toggleSound, {
    class: 'icon-button top-bar__sound',
    'data-action': 'toggle-sound',
  });
  const settings = button(icon('settings'), actions.settings, {
    class: 'icon-button top-bar__settings',
    'aria-label': 'Settings',
    'data-action': 'settings',
  });

  const element = h(
    'header',
    { class: 'top-bar' },
    home,
    h('nav', { class: 'top-bar__nav', 'aria-label': 'Hall pages' }, links),
    h('div', { class: 'top-bar__controls' }, themeGroup, appearance, sound, settings),
  );

  return {
    element,
    update(state) {
      for (const control of links) {
        const current = control.dataset.page === state.page;
        if (current) control.setAttribute('aria-current', 'page');
        else control.removeAttribute('aria-current');
      }
      for (const control of themeButtons) {
        control.setAttribute('aria-pressed', String(control.dataset.themeChoice === state.theme));
      }
      const dark = state.appearance === 'dark';
      appearance.replaceChildren(icon(dark ? 'sun' : 'moon'));
      appearance.setAttribute(
        'aria-label',
        dark ? 'Switch to light appearance' : 'Switch to dark appearance',
      );
      sound.replaceChildren(icon(state.muted ? 'soundOff' : 'soundOn'));
      sound.setAttribute('aria-label', state.muted ? 'Turn sound on' : 'Turn sound off');
      sound.setAttribute('aria-pressed', String(!state.muted));
    },
  };
}
