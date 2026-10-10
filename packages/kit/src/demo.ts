/**
 * Living demos for the Hall: a simulation playing itself, calmly, forever.
 *
 * The Hall shows every playable world running on its own (an engraved plate
 * in the Almanac, a live feed tile in the Situation Room, a diorama under
 * glass in the Terrarium). `createModelDemo` runs the simulation's real
 * model with a built-in bot at about one turn every 2.5 seconds, starts a
 * fresh world when one ends, streams each turn's signals to subscribers (the
 * Situation Room draws them as sparklines), and pauses whenever the demo is
 * off-screen or the tab is hidden, so a page of demos costs nothing while
 * nobody is looking.
 */
import type { SimEvent, TurnTone } from './events.ts';
import { createRng, mixSeeds, type Rng } from './rng.ts';
import { resolveStep, type Signals, type TurnModel } from './turns.ts';
import type { Appearance } from './settings.ts';

/** How a theme wants demos drawn; simulations support all three. */
export type DemoStyle = 'engraving' | 'instrument' | 'diorama';

/** Colours a demo draws with, chosen by the theme for the current appearance. */
export interface DemoPalette {
  paper: string;
  ink: string;
  muted: string;
  accent: string;
  line: string;
  glow: string;
  good: string;
  warning: string;
  disaster: string;
}

export interface DemoLook {
  appearance: Appearance;
  style: DemoStyle;
  palette: DemoPalette;
  reducedMotion: boolean;
}

export interface DemoFrame {
  /** Which world this is since the demo started (a fresh world each cycle). */
  cycle: number;
  turn: number;
  signals: Signals;
  tone: TurnTone;
  events: readonly SimEvent[];
  /** True on the last turn of a world, just before a new one begins. */
  ended: boolean;
}

export interface DemoHandle {
  /** Streams every turn's frame; the current frame is sent at once. */
  subscribe(listener: (frame: DemoFrame) => void): () => void;
  /** Redraws in a new appearance or style without restarting the world. */
  setLook(look: DemoLook): void;
  dispose(): void;
}

/** Draws one demo world. `progress` runs 0 → 1 across the transition into the latest turn. */
export interface DemoRenderer<State> {
  mount(host: HTMLElement, look: DemoLook): void;
  draw(state: State, previous: State, progress: number, frame: DemoFrame): void;
  setLook(look: DemoLook): void;
  dispose(): void;
}

export interface ModelDemoOptions<State, Plan> {
  host: HTMLElement;
  seed: number;
  model: TurnModel<State, Plan>;
  /** Chooses the bot's plan; its stream is separate from the world's. */
  bot: (state: State, rng: Rng) => Plan;
  renderer: DemoRenderer<State>;
  look: DemoLook;
  scenario?: string;
  /** Milliseconds per turn (default 2500). */
  pace?: number;
  /** Milliseconds of animation into each turn (default 1200, none under reduced motion). */
  transition?: number;
}

export function createModelDemo<State, Plan>(options: ModelDemoOptions<State, Plan>): DemoHandle {
  const { host, model, renderer } = options;
  const pace = options.pace ?? 2500;
  let look = options.look;
  let cycle = 0;
  let step = 0;
  let worldSeed = options.seed;
  let state = newWorld();
  let previous = state;
  let frame = openingFrame();
  let turnStartedAt = now();
  let visible = true;
  let pageVisible = typeof document === 'undefined' || document.visibilityState !== 'hidden';
  let timer: ReturnType<typeof setTimeout> | null = null;
  let animation: number | null = null;
  let disposed = false;
  const listeners = new Set<(frame: DemoFrame) => void>();

  function newWorld(): State {
    worldSeed = mixSeeds(options.seed, cycle);
    step = 0;
    return model.init({ seed: worldSeed, scenario: options.scenario ?? 'standard', seats: 1 });
  }

  function openingFrame(): DemoFrame {
    return {
      cycle,
      turn: model.position(state).turn - 1,
      signals: model.signals(state, 0),
      tone: 'quiet',
      events: [],
      ended: false,
    };
  }

  function now(): number {
    return typeof performance === 'undefined' ? Date.now() : performance.now();
  }

  function running(): boolean {
    return !disposed && visible && pageVisible;
  }

  function advance(): void {
    timer = null;
    if (!running()) return;
    if (frame.ended) {
      cycle++;
      state = newWorld();
      previous = state;
      frame = openingFrame();
    } else {
      const plan = options.bot(state, createRng(worldSeed).fork('bot').fork(`step:${step}`));
      const resolved = resolveStep(model, state, plan, worldSeed, step);
      step++;
      previous = state;
      state = resolved.state;
      frame = {
        cycle,
        turn: resolved.record.turn,
        signals: model.signals(state, 0),
        tone: resolved.record.tone,
        events: resolved.record.events,
        ended: model.outcome(state) !== null,
      };
    }
    turnStartedAt = now();
    for (const listener of listeners) listener(frame);
    paint();
    schedule();
  }

  function schedule(): void {
    if (timer !== null || !running()) return;
    // Linger on a finished world a little longer before the next one begins.
    timer = setTimeout(advance, frame.ended ? pace * 1.6 : pace);
  }

  function paint(): void {
    if (disposed) return;
    const transition = look.reducedMotion ? 0 : (options.transition ?? 1200);
    const progress = transition === 0 ? 1 : Math.min(1, (now() - turnStartedAt) / transition);
    renderer.draw(state, previous, progress, frame);
    if (progress < 1 && running() && typeof requestAnimationFrame === 'function') {
      animation = requestAnimationFrame(() => {
        animation = null;
        paint();
      });
    }
  }

  function stopTimers(): void {
    if (timer !== null) clearTimeout(timer);
    if (animation !== null && typeof cancelAnimationFrame === 'function')
      cancelAnimationFrame(animation);
    timer = null;
    animation = null;
  }

  function wake(): void {
    if (running()) {
      paint();
      schedule();
    } else {
      stopTimers();
    }
  }

  const observer =
    typeof IntersectionObserver === 'function'
      ? new IntersectionObserver((entries) => {
          visible = entries.some((entry) => entry.isIntersecting);
          wake();
        })
      : null;
  observer?.observe(host);

  const onVisibility = (): void => {
    pageVisible = document.visibilityState !== 'hidden';
    wake();
  };
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility);

  renderer.mount(host, look);
  paint();
  schedule();

  return {
    subscribe(listener) {
      listeners.add(listener);
      listener(frame);
      return () => listeners.delete(listener);
    },

    setLook(next) {
      look = next;
      renderer.setLook(next);
      paint();
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      stopTimers();
      observer?.disconnect();
      if (typeof document !== 'undefined')
        document.removeEventListener('visibilitychange', onVisibility);
      listeners.clear();
      renderer.dispose();
    },
  };
}
