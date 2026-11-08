/**
 * Crown of Florins' own options, kept in the simulation's settings
 * namespace: graphics, how the year's moments play, the valley between
 * years, how AI turns show in hot-seat, and what the game remembers for the
 * player (the last court, the tutorial, progress toward cross-game
 * milestones).
 */
import type { OptionValue, SimSettings } from '@one-more-year/kit';
import type { QualityLevel } from '../scene/quality.ts';

/** Cinematic plays every moment in full, quick shortens them, instant cuts straight to the result. */
export type YearSpeed = 'cinematic' | 'quick' | 'instant';
/** Show every rival's year in the valley, or one summary of them all. */
export type AiSpeed = 'show' | 'summarise';

export interface Options {
  graphics: QualityLevel;
  speed: YearSpeed;
  valley: boolean;
  aiSpeed: AiSpeed;
  tutorialDone: boolean;
  /** The last court set up, for "Play again" and the next visit to the setup screen. */
  lastCourt: OptionValue | null;
  /** Weather grades seen across games, for "Every Sky". */
  weathersSeen: number[];
  /** Pillars whose rule was read, for "The Twelve Pillars". */
  pillarsRead: string[];
  /** Personalities beaten to the crown, for "Every Way of Ruling". */
  rivalsBeaten: string[];
}

const DEFAULTS: Options = {
  graphics: 'high',
  speed: 'cinematic',
  valley: true,
  aiSpeed: 'show',
  tutorialDone: false,
  lastCourt: null,
  weathersSeen: [],
  pillarsRead: [],
  rivalsBeaten: [],
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

/** Seconds a moment lasts at each speed, from its cinematic length. */
export function momentLength(cinematic: number, speed: YearSpeed, reducedMotion: boolean): number {
  if (speed === 'instant') return 0;
  const length = speed === 'quick' ? cinematic * 0.4 : cinematic;
  return reducedMotion ? Math.min(length, 1.2) : length;
}
