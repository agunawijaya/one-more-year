/**
 * The settings panel: appearance, theme, volumes, motion, text size,
 * advisor hints, forecasts, the intro and theme picker again, and "Forget my
 * data" with a clear list of what it erases. Every control changes the
 * setting at once (there is no Save button to forget).
 */
import type { ResolvedSettings, Settings, SettingsStore } from '@one-more-year/kit';
import { button, h } from '../app/dom.ts';
import { FORGET_LIST } from '../app/services.ts';
import { THEME_IDS, THEME_NAMES } from '../themes/theme-ids.ts';
import { ask, openDialog } from './dialogs.ts';

export interface SettingsPanelActions {
  replayIntro: () => void;
  chooseThemeAgain: () => void;
  forgetEverything: () => void;
}

interface Option<T> {
  value: T;
  label: string;
}

function radioGroup<T extends string | number>(
  name: string,
  legend: string,
  options: readonly Option<T>[],
  current: T,
  onChange: (value: T) => void,
): HTMLFieldSetElement {
  return h(
    'fieldset',
    { class: 'settings__group' },
    h('legend', {}, legend),
    h(
      'div',
      { class: 'settings__choices' },
      options.map((option) => {
        const input = h('input', {
          type: 'radio',
          name,
          value: String(option.value),
          checked: option.value === current,
        });
        input.addEventListener('change', () => {
          if (input.checked) onChange(option.value);
        });
        return h('label', { class: 'settings__choice' }, input, h('span', {}, option.label));
      }),
    ),
  );
}

function slider(label: string, value: number, onChange: (value: number) => void): HTMLLabelElement {
  const input = h('input', {
    type: 'range',
    min: 0,
    max: 100,
    step: 5,
    value: Math.round(value * 100),
  });
  const readout = h(
    'output',
    { class: 'settings__readout tabular' },
    `${Math.round(value * 100)}%`,
  );
  input.addEventListener('input', () => {
    readout.textContent = `${input.value}%`;
    onChange(Number(input.value) / 100);
  });
  return h('label', { class: 'settings__slider' }, h('span', {}, label), input, readout);
}

export function openSettingsPanel(settings: SettingsStore, actions: SettingsPanelActions): void {
  const s: ResolvedSettings = settings.get();
  const set = (patch: Partial<Settings>): void => settings.update(patch);

  openDialog({
    title: 'Settings',
    kind: 'dialog--settings',
    body: [
      radioGroup(
        'appearance',
        'Appearance',
        [
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
          { value: 'system', label: 'System' },
        ],
        s.appearance,
        (appearance) => set({ appearance }),
      ),
      radioGroup(
        'theme',
        'Theme',
        THEME_IDS.map((id) => ({ value: id, label: THEME_NAMES[id] })),
        s.theme,
        (theme) => set({ theme, themeChosen: true }),
      ),
      h(
        'fieldset',
        { class: 'settings__group' },
        h('legend', {}, 'Sound'),
        slider('Master', s.volumes.master, (master) =>
          set({ volumes: { ...settings.get().volumes, master } }),
        ),
        slider('Music and ambience', s.volumes.music, (music) =>
          set({ volumes: { ...settings.get().volumes, music } }),
        ),
        slider('Effects', s.volumes.sfx, (sfx) =>
          set({ volumes: { ...settings.get().volumes, sfx } }),
        ),
      ),
      radioGroup(
        'motion',
        'Motion',
        [
          { value: 'system', label: 'Follow the system' },
          { value: 'reduce', label: 'Reduced' },
          { value: 'full', label: 'Full' },
        ],
        s.motion,
        (motion) => set({ motion }),
      ),
      radioGroup(
        'text-size',
        'Text size',
        [
          { value: 100, label: '100%' },
          { value: 115, label: '115%' },
          { value: 130, label: '130%' },
        ],
        s.textSize,
        (textSize) => set({ textSize }),
      ),
      radioGroup(
        'advisor',
        'Advisor hints',
        [
          { value: 'on', label: 'On' },
          { value: 'quiet', label: 'Only warnings' },
          { value: 'off', label: 'Off' },
        ],
        s.advisorHints,
        (advisorHints) => set({ advisorHints }),
      ),
      radioGroup(
        'forecasts',
        'Forecasts',
        [
          { value: 'shown', label: 'Shown' },
          { value: 'hidden', label: 'Hidden, for purists' },
        ],
        s.forecasts,
        (forecasts) => set({ forecasts }),
      ),
      h(
        'div',
        { class: 'settings__actions' },
        button('Show the intro again', actions.replayIntro, {
          class: 'button',
          'data-action': 'replay-intro',
        }),
        button('Choose a theme again', actions.chooseThemeAgain, {
          class: 'button',
          'data-action': 'choose-theme',
        }),
      ),
      h(
        'section',
        { class: 'settings__forget' },
        h('h3', {}, 'Forget my data'),
        h('p', {}, 'Everything stays on this device. Forgetting erases, for good:'),
        h(
          'ul',
          {},
          FORGET_LIST.map((item) => h('li', {}, item)),
        ),
        button(
          'Forget my data',
          () => {
            void ask(
              'Forget everything?',
              'This erases all of the above on this device and cannot be undone.',
              [
                { id: 'forget', label: 'Forget my data', primary: true },
                { id: 'keep', label: 'Keep it' },
              ],
            ).then((answer) => {
              if (answer === 'forget') actions.forgetEverything();
            });
          },
          { class: 'button button--danger', 'data-action': 'forget' },
        ),
      ),
    ],
  });
}
