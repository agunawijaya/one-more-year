/**
 * Modal dialogs for the chrome: settings, pause, how to play, share, the
 * leave confirmation. One dialog shows at a time on a layer above the page;
 * focus moves into it and is trapped there, Escape closes it (unless the
 * caller says otherwise), and focus returns to where it was.
 */
import { button, h, type Child } from '../app/dom.ts';
import { icon, type IconName } from './icons.ts';

export interface DialogOptions {
  title: string;
  /** A class for the theme to style this kind of dialog (e.g. 'dialog--pause'). */
  kind?: string;
  body: Child | readonly Child[];
  /** Called when the dialog closes for any reason. */
  onClose?: () => void;
  /** False for dialogs that must be answered (the leave confirmation). */
  dismissable?: boolean;
  /** Labels the close button; defaults to "Close". */
  closeLabel?: string;
}

export interface OpenDialog {
  readonly element: HTMLElement;
  close(): void;
}

let layer: HTMLElement | null = null;
let current: { dialog: OpenDialog; dismissable: boolean } | null = null;

export function setDialogLayer(element: HTMLElement): void {
  layer = element;
}

export function dialogIsOpen(): boolean {
  return current !== null;
}

/** Closes the top dialog if Escape may close it; returns true if it handled the key. */
export function escapeDialog(): boolean {
  if (!current) return false;
  if (current.dismissable) current.dialog.close();
  return true;
}

export function closeDialog(): void {
  current?.dialog.close();
}

export function openDialog(options: DialogOptions): OpenDialog {
  current?.dialog.close();
  const host = layer ?? document.body;
  const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const titleId = `dialog-title-${Math.random().toString(36).slice(2, 8)}`;
  const dismissable = options.dismissable ?? true;

  const panel = h(
    'div',
    {
      class: `dialog ${options.kind ?? ''}`.trim(),
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': titleId,
    },
    h(
      'header',
      { class: 'dialog__header' },
      h('h2', { class: 'dialog__title', id: titleId }, options.title),
      dismissable
        ? button(icon('close'), () => dialog.close(), {
            class: 'dialog__close icon-button',
            'aria-label': options.closeLabel ?? 'Close',
          })
        : null,
    ),
    h('div', { class: 'dialog__body' }, options.body),
  );
  const backdrop = h('div', { class: 'dialog-backdrop' }, panel);
  if (dismissable) {
    backdrop.addEventListener('pointerdown', (event) => {
      if (event.target === backdrop) dialog.close();
    });
  }
  panel.addEventListener('keydown', (event) => trapFocus(event, panel));

  // Everything else leaves the accessibility tree while the dialog is open.
  const siblings = [...(host.parentElement?.children ?? [])].filter(
    (element) => element !== host && !element.hasAttribute('inert'),
  );
  for (const sibling of siblings) sibling.setAttribute('inert', '');

  let open = true;
  const dialog: OpenDialog = {
    element: panel,
    close() {
      if (!open) return;
      open = false;
      backdrop.remove();
      for (const sibling of siblings) sibling.removeAttribute('inert');
      if (current?.dialog === dialog) current = null;
      options.onClose?.();
      returnFocus?.focus();
    },
  };
  current = { dialog, dismissable };
  host.append(backdrop);
  const first = panel.querySelector<HTMLElement>(
    '[autofocus], .dialog__body button, .dialog__body a, .dialog__body input, .dialog__body select',
  );
  (first ?? panel.querySelector<HTMLElement>('button') ?? panel).focus();
  return dialog;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function trapFocus(event: KeyboardEvent, panel: HTMLElement): void {
  if (event.key !== 'Tab') return;
  const focusable = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (element) => !element.hidden && element.offsetParent !== null,
  );
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

/** A vertical list of menu buttons, the shape of the pause menu and similar lists. */
export function menuList(
  items: readonly {
    label: string;
    hint?: string;
    icon?: IconName;
    action: string;
    onSelect: () => void;
  }[],
): HTMLElement {
  return h(
    'ul',
    { class: 'menu-list' },
    items.map((item) =>
      h(
        'li',
        {},
        button(
          [
            item.icon ? h('span', { class: 'menu-list__icon' }, icon(item.icon, 18)) : null,
            h('span', { class: 'menu-list__label' }, item.label),
            item.hint ? h('kbd', { class: 'menu-list__hint' }, item.hint) : null,
          ],
          item.onSelect,
          { class: 'menu-list__item', 'data-action': item.action },
        ),
      ),
    ),
  );
}

/** Asks a question with up to three answers; resolves with the chosen answer's id. */
export function ask(
  title: string,
  text: string,
  answers: readonly { id: string; label: string; primary?: boolean }[],
): Promise<string> {
  return new Promise((resolve) => {
    let answered = false;
    const dialog = openDialog({
      title,
      kind: 'dialog--confirm',
      dismissable: false,
      body: [
        h('p', {}, text),
        h(
          'div',
          { class: 'dialog__actions' },
          answers.map((answer) =>
            button(
              answer.label,
              () => {
                answered = true;
                dialog.close();
                resolve(answer.id);
              },
              {
                class: answer.primary ? 'button button--primary' : 'button',
                'data-answer': answer.id,
              },
            ),
          ),
        ),
      ],
      onClose: () => {
        if (!answered) resolve(answers.at(-1)?.id ?? '');
      },
    });
  });
}
