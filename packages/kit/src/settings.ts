/**
 * The player's settings, shared by the Hall and every simulation: theme,
 * appearance, sound, motion, text size, advisor hints and forecasts, plus a
 * private namespace per simulation for its own options.
 *
 * Appearance and motion each have a "follow the system" choice. The store
 * resolves them against the operating system and keeps listening, so when
 * the OS switches to dark mode at sunset an open page follows within a
 * frame and every listener hears about it.
 */
import { createSlot, isRecord, type KeyValueStore } from './save.ts';

export type AppearancePreference = 'light' | 'dark' | 'system';
export type Appearance = 'light' | 'dark';
export type MotionPreference = 'system' | 'reduce' | 'full';
export type TextSize = 100 | 115 | 130;
export type AdvisorHints = 'on' | 'quiet' | 'off';
export type ForecastDisplay = 'shown' | 'hidden';

export interface Volumes {
  /** 0–1 each. */
  master: number;
  music: number;
  sfx: number;
}

export interface Settings {
  /** A Hall theme id; the Hall validates it against its own list. */
  theme: string;
  appearance: AppearancePreference;
  volumes: Volumes;
  muted: boolean;
  motion: MotionPreference;
  textSize: TextSize;
  advisorHints: AdvisorHints;
  forecasts: ForecastDisplay;
  introSeen: boolean;
  themeChosen: boolean;
  /** One-time hints already shown, such as the first visit to each simulation. */
  hintsSeen: string[];
}

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  theme: 'almanac',
  appearance: 'system',
  volumes: { master: 0.8, music: 0.5, sfx: 0.8 },
  muted: false,
  motion: 'system',
  textSize: 100,
  advisorHints: 'on',
  forecasts: 'shown',
  introSeen: false,
  themeChosen: false,
  hintsSeen: [],
});

export const SETTINGS_KEY = 'omy:settings';
const SETTINGS_VERSION = 1;

export interface ResolvedSettings extends Settings {
  /** The appearance actually shown, after following the system if asked to. */
  resolvedAppearance: Appearance;
  /** True when motion should be reduced, by setting or by the system. */
  reducedMotion: boolean;
}

export type SettingsListener = (settings: ResolvedSettings, changed: ReadonlySet<string>) => void;

export interface SettingsStore {
  get(): ResolvedSettings;
  update(patch: Partial<Settings>): void;
  reset(): void;
  subscribe(listener: SettingsListener): () => void;
  /** A namespace for one simulation's own options. */
  forSim(simId: string): SimSettings;
  dispose(): void;
}

export interface SimSettings {
  get<T>(key: string, fallback: T): T;
  set(key: string, value: unknown): void;
  subscribe(listener: (key: string) => void): () => void;
}

/** The two OS queries the store follows; tests pass fakes. */
export interface SystemPreferences {
  prefersDark(): boolean;
  prefersReducedMotion(): boolean;
  /** Calls back whenever either query changes; returns a remover. */
  watch(onChange: () => void): () => void;
}

export function createSettings(
  store: KeyValueStore,
  system: SystemPreferences = browserPreferences(),
): SettingsStore {
  const slot = createSlot<Settings>(store, SETTINGS_KEY, {
    version: SETTINGS_VERSION,
    defaults: () => structuredClone(DEFAULT_SETTINGS),
    parse: parseSettings,
  });
  const simSlot = (simId: string) =>
    createSlot<Record<string, unknown>>(store, `omy:sim-settings:${simId}`, {
      version: 1,
      defaults: () => ({}),
      parse: (data) => (isRecord(data) ? data : null),
    });

  let current = resolve(slot.load());
  const listeners = new Set<SettingsListener>();
  const simListeners = new Map<string, Set<(key: string) => void>>();

  function resolve(settings: Settings): ResolvedSettings {
    const resolvedAppearance =
      settings.appearance === 'system'
        ? system.prefersDark()
          ? 'dark'
          : 'light'
        : settings.appearance;
    const reducedMotion =
      settings.motion === 'reduce' ||
      (settings.motion === 'system' && system.prefersReducedMotion());
    return { ...settings, resolvedAppearance, reducedMotion };
  }

  function publish(next: ResolvedSettings): void {
    const changed = new Set<string>();
    for (const key of Object.keys(next) as (keyof ResolvedSettings)[]) {
      if (JSON.stringify(next[key]) !== JSON.stringify(current[key])) changed.add(key);
    }
    current = next;
    if (changed.size === 0) return;
    for (const listener of listeners) listener(current, changed);
  }

  const stopWatching = system.watch(() => publish(resolve(current)));

  return {
    get: () => current,

    update(patch) {
      const merged: Settings = { ...stripResolved(current), ...patch };
      if (patch.volumes) merged.volumes = { ...current.volumes, ...patch.volumes };
      const parsed = parseSettings(merged) ?? merged;
      slot.save(parsed);
      publish(resolve(parsed));
    },

    reset() {
      slot.clear();
      publish(resolve(structuredClone(DEFAULT_SETTINGS)));
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    forSim(simId) {
      const own = simSlot(simId);
      return {
        get<T>(key: string, fallback: T): T {
          const values = own.load();
          return key in values ? (values[key] as T) : fallback;
        },
        set(key, value) {
          own.save({ ...own.load(), [key]: value });
          for (const listener of simListeners.get(simId) ?? []) listener(key);
        },
        subscribe(listener) {
          const set = simListeners.get(simId) ?? new Set();
          set.add(listener);
          simListeners.set(simId, set);
          return () => set.delete(listener);
        },
      };
    },

    dispose() {
      stopWatching();
      listeners.clear();
      simListeners.clear();
    },
  };
}

function stripResolved(settings: ResolvedSettings): Settings {
  const { resolvedAppearance: _appearance, reducedMotion: _motion, ...rest } = settings;
  return rest;
}

/** Keeps every known field that has a valid value and fills the rest with defaults. */
export function parseSettings(data: unknown): Settings | null {
  if (!isRecord(data)) return null;
  const pick = <T>(value: unknown, valid: readonly T[], fallback: T): T =>
    valid.includes(value as T) ? (value as T) : fallback;
  const unit = (value: unknown, fallback: number): number =>
    typeof value === 'number' && value >= 0 && value <= 1 ? value : fallback;
  const volumes = isRecord(data.volumes) ? data.volumes : {};
  const defaults = DEFAULT_SETTINGS;
  return {
    theme: typeof data.theme === 'string' ? data.theme : defaults.theme,
    appearance: pick(data.appearance, ['light', 'dark', 'system'] as const, defaults.appearance),
    volumes: {
      master: unit(volumes.master, defaults.volumes.master),
      music: unit(volumes.music, defaults.volumes.music),
      sfx: unit(volumes.sfx, defaults.volumes.sfx),
    },
    muted: typeof data.muted === 'boolean' ? data.muted : defaults.muted,
    motion: pick(data.motion, ['system', 'reduce', 'full'] as const, defaults.motion),
    textSize: pick(data.textSize, [100, 115, 130] as const, defaults.textSize),
    advisorHints: pick(data.advisorHints, ['on', 'quiet', 'off'] as const, defaults.advisorHints),
    forecasts: pick(data.forecasts, ['shown', 'hidden'] as const, defaults.forecasts),
    introSeen: data.introSeen === true,
    themeChosen: data.themeChosen === true,
    hintsSeen: Array.isArray(data.hintsSeen)
      ? data.hintsSeen.filter((hint): hint is string => typeof hint === 'string')
      : [],
  };
}

/** The real OS preferences, read through matchMedia where the browser has it. */
export function browserPreferences(): SystemPreferences {
  const query = (text: string): MediaQueryList | null =>
    typeof matchMedia === 'function' ? matchMedia(text) : null;
  const dark = query('(prefers-color-scheme: dark)');
  const motion = query('(prefers-reduced-motion: reduce)');
  return {
    prefersDark: () => dark?.matches ?? false,
    prefersReducedMotion: () => motion?.matches ?? false,
    watch(onChange) {
      dark?.addEventListener('change', onChange);
      motion?.addEventListener('change', onChange);
      return () => {
        dark?.removeEventListener('change', onChange);
        motion?.removeEventListener('change', onChange);
      };
    },
  };
}
