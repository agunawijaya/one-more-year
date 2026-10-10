/**
 * The scribe's console in use: it prints the year just lived, asks the four
 * questions in order and, once all are answered, ends the year. In the
 * 1978 Ledger it is docked on the plan screen for the whole term; in the
 * other modes T opens it over the plan and Escape closes it.
 */
import type { PlaySession } from '@one-more-year/kit';
import type { CityState, Decree } from '../../engine/state.ts';
import {
  answer,
  PROMPTS,
  reportLines,
  startConsole,
  type ConsoleState,
} from '../../ui/console-flow.ts';
import { createTeletype, type Teletype } from '../../ui/teletype.ts';

export interface ConsoleRun {
  readonly teletype: Teletype;
  dispose(): void;
}

export interface ConsoleOptions {
  session: PlaySession<CityState, Decree>;
  reducedMotion: () => boolean;
  onClatter: () => void;
  /** Each answer updates the draft, so the city shows the decree as it forms. */
  onDraft: (decree: Decree) => void;
  /** All four questions answered (or the steward walked out). */
  onDecree: (decree: Decree) => void;
}

export function runConsole(options: ConsoleOptions): ConsoleRun {
  const teletype = createTeletype({
    label: 'The scribe’s console',
    reducedMotion: options.reducedMotion,
    onClatter: options.onClatter,
  });
  let disposed = false;
  // Read through a function: the flag changes while the loop is waiting for an answer.
  const stopped = (): boolean => disposed;

  async function loop(): Promise<void> {
    const city = options.session.engine.state;
    await teletype.print(reportLines(city, options.session.turnLabel));
    let current: ConsoleState = startConsole();
    while (!disposed && current.question !== 'done') {
      const typed = await teletype.ask(PROMPTS[current.question]);
      if (stopped()) return;
      const result = answer(city, current, typed);
      if (result.kind === 'refused') {
        await teletype.print([result.reason]);
        continue;
      }
      if (result.kind === 'decree') {
        options.onDecree(result.decree);
        return;
      }
      current = result.state;
      options.onDraft(current.decree);
    }
  }
  void loop();

  return {
    teletype,
    dispose() {
      disposed = true;
      teletype.dispose();
    },
  };
}
