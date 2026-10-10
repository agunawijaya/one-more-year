/**
 * The teletype: continuous fanfold paper with faint green bars, text typed
 * a character at a time, and a line to type the answer on. Used docked in
 * the 1978 Ledger and as the scribe's console overlay in any mode.
 *
 * Under reduced motion the text appears a line at a time instead of a
 * character at a time.
 */
import { el } from './dom.ts';

export interface Teletype {
  readonly element: HTMLElement;
  /** Types lines onto the paper; resolves when the last character is down. */
  print(lines: readonly string[]): Promise<void>;
  /** Types a prompt and waits for a typed answer (Enter). */
  ask(prompt: string): Promise<string>;
  /** Tears off the paper. */
  clear(): void;
  focus(): void;
  dispose(): void;
}

export interface TeletypeOptions {
  label: string;
  reducedMotion: () => boolean;
  /** Called every few characters, for the soft clatter. */
  onClatter?: () => void;
  /** Milliseconds per character. */
  pace?: number;
}

export function createTeletype(options: TeletypeOptions): Teletype {
  const paper = el('div', {
    class: 'th-paper',
    role: 'log',
    'aria-live': 'polite',
    'aria-label': options.label,
  });
  const input = el('input', {
    type: 'text',
    class: 'th-paper__input',
    inputmode: 'numeric',
    autocomplete: 'off',
    spellcheck: 'false',
    'aria-label': 'Your answer',
  });
  const promptLine = el('div', { class: 'th-paper__line th-paper__ask' }, el('span', {}), input);
  promptLine.hidden = true;
  const element = el('div', { class: 'th-teletype' }, paper, promptLine);
  const pace = options.pace ?? 22;
  let disposed = false;
  let waiting: ((text: string) => void) | null = null;
  // A key pressed while the paper is still printing finishes the printing at once.
  let hurry = false;
  // Read through a function: a key press changes it while printing is awaited.
  const hurried = (): boolean => hurry;
  const onHurry = (event: KeyboardEvent): void => {
    if (waiting || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === ' ' || event.key === 'Enter') event.preventDefault();
    hurry = true;
  };

  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || !waiting) return;
    event.preventDefault();
    event.stopPropagation();
    const text = input.value;
    const resolve = waiting;
    waiting = null;
    promptLine.hidden = true;
    const echoed = el(
      'div',
      { class: 'th-paper__line' },
      (promptLine.firstChild?.textContent ?? '') + ' ',
      el('b', {}, text),
    );
    paper.append(echoed);
    input.value = '';
    scroll();
    resolve(text);
  });

  function scroll(): void {
    element.scrollTop = element.scrollHeight;
  }

  const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

  async function typeLine(text: string): Promise<void> {
    const line = el('div', { class: 'th-paper__line' });
    paper.append(line);
    if (options.reducedMotion() || hurried()) {
      line.textContent = text;
      scroll();
      return;
    }
    for (let i = 0; i < text.length && !disposed; i++) {
      if (hurried()) {
        line.textContent = text;
        break;
      }
      line.textContent = text.slice(0, i + 1);
      if (i % 3 === 0) options.onClatter?.();
      scroll();
      await sleep(pace);
    }
  }

  return {
    element,
    async print(lines) {
      hurry = false;
      window.addEventListener('keydown', onHurry);
      for (const text of lines) {
        if (disposed) break;
        await typeLine(text);
        if (!hurried()) await sleep(options.reducedMotion() ? 0 : pace * 4);
      }
      window.removeEventListener('keydown', onHurry);
      scroll();
    },
    async ask(prompt) {
      await typeLine('');
      paper.lastChild?.remove();
      (promptLine.firstChild as HTMLElement).textContent = prompt;
      promptLine.hidden = false;
      scroll();
      input.focus();
      return new Promise<string>((resolve) => {
        waiting = resolve;
      });
    },
    clear() {
      paper.replaceChildren();
    },
    focus() {
      input.focus();
    },
    dispose() {
      disposed = true;
      waiting = null;
      window.removeEventListener('keydown', onHurry);
      element.remove();
    },
  };
}
