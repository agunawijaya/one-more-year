/**
 * Hosts the simulations' living demos inside the Hall.
 *
 * A demo starts only when its box scrolls into view: that is when the
 * simulation's module is first loaded, so a visitor who never looks at a
 * world never downloads it. Every running demo follows the current theme
 * and appearance live (no restart), and each one's signals can be
 * subscribed to, which is how the Situation Room draws its sparklines.
 */
import type { DemoFrame, DemoHandle, DemoLook } from '@one-more-year/kit';
import type { HallModel } from '../data/hall-model.ts';

export interface DemoSlot {
  /** Streams the demo's frames once it runs. */
  subscribe(listener: (frame: DemoFrame) => void): () => void;
  dispose(): void;
}

export interface DemoHost {
  /** Puts simulation `simId`'s demo into `host` with a seed; nothing happens for planned worlds. */
  mount(host: HTMLElement, simId: string, seed: number): DemoSlot;
  /** Restyles every running demo. */
  setLook(look: DemoLook): void;
  disposeAll(): void;
}

export function createDemoHost(model: HallModel, initialLook: () => DemoLook): DemoHost {
  let look: DemoLook | null = null;
  const running = new Set<{ handle: DemoHandle | null; dispose: () => void }>();

  return {
    mount(host, simId, seed) {
      // Each listener's way to stop listening to the demo, once the demo exists.
      const listeners = new Map<(frame: DemoFrame) => void, (() => void) | null>();
      const entry: { handle: DemoHandle | null; dispose: () => void } = {
        handle: null,
        dispose: () => undefined,
      };
      let disposed = false;

      const start = (): void => {
        void model.loadModule(simId).then((module) => {
          if (!module || disposed) return;
          const handle = module.demo(host, seed, look ?? initialLook());
          entry.handle = handle;
          for (const listener of listeners.keys())
            listeners.set(listener, handle.subscribe(listener));
        });
      };

      const observer =
        typeof IntersectionObserver === 'function'
          ? new IntersectionObserver((entries) => {
              if (entries.some((item) => item.isIntersecting)) {
                observer?.disconnect();
                start();
              }
            })
          : null;
      if (observer) observer.observe(host);
      else start();

      entry.dispose = () => {
        disposed = true;
        observer?.disconnect();
        for (const stop of listeners.values()) stop?.();
        entry.handle?.dispose();
        running.delete(entry);
      };
      running.add(entry);

      return {
        subscribe(listener) {
          listeners.set(listener, entry.handle?.subscribe(listener) ?? null);
          return () => {
            listeners.get(listener)?.();
            listeners.delete(listener);
          };
        },
        dispose: () => entry.dispose(),
      };
    },

    setLook(next) {
      look = next;
      for (const entry of running) entry.handle?.setLook(next);
    },

    disposeAll() {
      for (const entry of [...running]) entry.dispose();
    },
  };
}
