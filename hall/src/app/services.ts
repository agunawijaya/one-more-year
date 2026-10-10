/**
 * The Hall's services: one instance of each kit store, all over the same
 * storage, plus the clock. Everything the Hall remembers goes through here,
 * which is also what makes "Forget my data" complete: it walks this list.
 */
import {
  createAudio,
  createCodexBook,
  createDailyBook,
  createMilestoneBook,
  createSettings,
  createStatsBook,
  createStorage,
  dayKey,
  type AudioEngine,
  type CodexBook,
  type DailyBook,
  type KeyValueStore,
  type MilestoneBook,
  type SettingsStore,
  type StatsBook,
  type SystemPreferences,
} from '@one-more-year/kit';
import { createCosmeticsStore, type CosmeticsStore } from '../data/cosmetics.ts';
import { createLibrary, type Library } from '../data/library.ts';

export interface HallServices {
  readonly store: KeyValueStore;
  readonly settings: SettingsStore;
  readonly audio: AudioEngine;
  readonly milestones: MilestoneBook;
  readonly codex: CodexBook;
  readonly stats: StatsBook;
  readonly daily: DailyBook;
  readonly library: Library;
  readonly cosmetics: CosmeticsStore;
  now(): number;
  /** Today's UTC day key. */
  today(): string;
  /** Erases runs, chronicles, codex, milestones, legacy, stats, daily records and settings. */
  forgetEverything(): void;
}

export interface ServiceOptions {
  /** Null keeps everything in memory (tests); undefined uses localStorage. */
  storage?: Storage | null;
  now?: () => number;
  system?: SystemPreferences;
}

export function createServices(options: ServiceOptions = {}): HallServices {
  const store = createStorage(options.storage);
  const now = options.now ?? Date.now;
  const settings = options.system ? createSettings(store, options.system) : createSettings(store);
  const services: HallServices = {
    store,
    settings,
    audio: createAudio(),
    milestones: createMilestoneBook(store, now),
    codex: createCodexBook(store, now),
    stats: createStatsBook(store, now),
    daily: createDailyBook(store),
    library: createLibrary(store),
    cosmetics: createCosmeticsStore(store),
    now,
    today: () => dayKey(now()),

    forgetEverything() {
      // Every key the collection writes starts with "omy:"; settings go too, as the list promises.
      for (const key of store.keys('omy:')) store.remove(key);
      settings.reset();
    },
  };
  return services;
}

/** What "Forget my data" erases, as the settings panel lists it. */
export const FORGET_LIST: readonly string[] = [
  'Runs in progress, in every simulation',
  'Your chronicles in the Library',
  'Codex discoveries',
  'Milestones, Legacy points and rank, and cosmetics',
  'Daily scenario results and the Almanac streak',
  'Play statistics',
  'Settings, including theme and appearance',
];
