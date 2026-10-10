/**
 * Pond's living demo for the Hall: the real model, played by a calm bot,
 * drawn with the same scene as the game in whatever style the theme asks.
 */
import {
  createModelDemo,
  type DemoFrame,
  type DemoHandle,
  type DemoLook,
  type DemoRenderer,
  type Rng,
  type SimEvent,
} from '@one-more-year/kit';
import { capacity, pondModel, type PondPlan, type PondState, type Weather } from './model.ts';
import { createPondScene, type PondScene } from './scene.ts';

/**
 * The bot fishes like a sensible neighbour: it takes most of what the pond
 * holds beyond about half its capacity, and a little more or less on a whim.
 */
export function pondBot(state: PondState, rng: Rng): PondPlan {
  const pond = state.ponds[state.seat] ?? state.ponds[0];
  if (!pond) return { catch: 0 };
  const surplus = pond.fish - capacity(pond.weed) * 0.5;
  const whim = rng.float(0.6, 1.1);
  return { catch: Math.max(0, Math.min(pond.fish, Math.round(surplus * whim))) };
}

/** The weather of the year just lived, read from its events (the state has already moved on). */
export function weatherOf(events: readonly SimEvent[]): Weather | null {
  for (const e of events) {
    if (e.kind === 'rain') return 'rainy';
    if (e.kind === 'fair') return 'fair';
    if (e.kind === 'dry') return 'dry';
  }
  return null;
}

function sceneRenderer(): DemoRenderer<PondState> {
  let scene: PondScene | null = null;
  return {
    mount(host, look) {
      scene = createPondScene(host, look, 'Pond, playing by itself');
    },
    draw(state, previous, progress, frame: DemoFrame) {
      const now = state.ponds[0];
      const before = previous.ponds[0] ?? now;
      if (!now || !before) return;
      // Ease the numbers across the turn so the change reads as growth, not a jump.
      const t = progress * progress * (3 - 2 * progress);
      scene?.update({
        fish: Math.round(before.fish + (now.fish - before.fish) * t),
        weed: before.weed + (now.weed - before.weed) * t,
        weather: weatherOf(frame.events),
      });
    },
    setLook(look: DemoLook) {
      scene?.setLook(look);
    },
    dispose() {
      scene?.dispose();
      scene = null;
    },
  };
}

export function pondDemo(host: HTMLElement, seed: number, look: DemoLook): DemoHandle {
  return createModelDemo({
    host,
    seed,
    model: pondModel,
    bot: pondBot,
    renderer: sceneRenderer(),
    look,
    scenario: 'still-water',
  });
}
