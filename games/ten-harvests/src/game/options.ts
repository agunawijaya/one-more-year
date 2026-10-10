/**
 * Ten Harvests' own options, kept in the simulation's settings namespace:
 * graphics quality, how long the year's cinematic runs, whether the camera
 * may be turned, and a few things the game remembers for the player.
 */
import type { SimSettings } from '@one-more-year/kit';
import type { CinematicSpeed } from '../scene/cinematic.ts';
import type { QualityLevel } from '../scene/quality.ts';

export interface Options {
  graphics: QualityLevel;
  speed: CinematicSpeed;
  orbit: boolean;
  tutorialDone: boolean;
  /** Distinct yields seen across runs, for the "All Five Harvests" milestone. */
  yieldsSeen: number[];
}

const DEFAULTS: Options = {
  graphics: 'high',
  speed: 'cinematic',
  orbit: true,
  tutorialDone: false,
  yieldsSeen: [],
};

export interface OptionStore {
  get<K extends keyof Options>(key: K): Options[K];
  set<K extends keyof Options>(key: K, value: Options[K]): void;
  subscribe(listener: (key: keyof Options) => void): () => void;
}

export function optionStore(sim: SimSettings): OptionStore {
  return {
    get: (key) => sim.get(key, DEFAULTS[key]),
    set: (key, value) => sim.set(key, value),
    subscribe: (listener) => sim.subscribe((key) => listener(key as keyof Options)),
  };
}
