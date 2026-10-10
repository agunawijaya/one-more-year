/**
 * Versioned local storage that never crashes the page.
 *
 * Browsers refuse storage in several ordinary situations: private windows,
 * blocked site data, a full quota. A simulation must keep running in all of
 * them, so every access goes through `createStorage`, which falls back to an
 * in-memory copy the first time the browser says no and reports that once
 * (the Hall shows a quiet banner: progress lasts only until the tab closes).
 *
 * `createSlot` stores one typed value under one key as an envelope
 * `{ v, d }` (version, data) and runs migrations when an older version is
 * found, so a save written by last month's build still loads.
 */

export const STORAGE_PREFIX = 'omy:';

export interface KeyValueStore {
  get(key: string): string | null;
  /** False when the value could only be kept in memory. */
  set(key: string, value: string): boolean;
  remove(key: string): void;
  /** Every stored key that starts with the prefix. */
  keys(prefix?: string): string[];
  /** True once the store has fallen back to memory. */
  readonly degraded: boolean;
  /** Called once, when the store first falls back to memory. */
  onDegraded(listener: (reason: DegradeReason) => void): () => void;
}

export type DegradeReason = 'unavailable' | 'full';

/**
 * Wraps a Storage (localStorage by default). Passing `null` gives a purely
 * in-memory store, which the tests and the demo worlds use.
 */
export function createStorage(backing?: Storage | null): KeyValueStore {
  const memory = new Map<string, string>();
  let storage: Storage | null = backing === undefined ? defaultStorage() : backing;
  // Asking for memory on purpose is not a degradation; finding no storage is.
  let degraded = storage === null && backing !== null;
  let reason: DegradeReason | null = degraded ? 'unavailable' : null;
  const listeners = new Set<(reason: DegradeReason) => void>();

  function fallBack(why: DegradeReason): void {
    if (storage) {
      // Keep what was readable so the session carries on with its data.
      try {
        for (let i = 0; i < storage.length; i++) {
          const key = storage.key(i);
          if (key?.startsWith(STORAGE_PREFIX)) memory.set(key, storage.getItem(key) ?? '');
        }
      } catch {
        // Nothing more can be rescued; memory holds whatever was copied.
      }
    }
    storage = null;
    if (!degraded) {
      degraded = true;
      reason = why;
      for (const listener of listeners) listener(why);
    }
  }

  return {
    get(key) {
      if (storage) {
        try {
          return storage.getItem(key);
        } catch {
          fallBack('unavailable');
        }
      }
      return memory.get(key) ?? null;
    },

    set(key, value) {
      if (storage) {
        try {
          storage.setItem(key, value);
          return true;
        } catch (error) {
          fallBack(isQuotaError(error) ? 'full' : 'unavailable');
        }
      }
      memory.set(key, value);
      return false;
    },

    remove(key) {
      memory.delete(key);
      if (!storage) return;
      try {
        storage.removeItem(key);
      } catch {
        fallBack('unavailable');
      }
    },

    keys(prefix = STORAGE_PREFIX) {
      const found = new Set<string>();
      if (storage) {
        try {
          for (let i = 0; i < storage.length; i++) {
            const key = storage.key(i);
            if (key?.startsWith(prefix)) found.add(key);
          }
        } catch {
          fallBack('unavailable');
        }
      }
      for (const key of memory.keys()) if (key.startsWith(prefix)) found.add(key);
      return [...found].sort();
    },

    get degraded() {
      return degraded;
    },

    onDegraded(listener) {
      listeners.add(listener);
      if (degraded && reason) listener(reason);
      return () => listeners.delete(listener);
    },
  };
}

function defaultStorage(): Storage | null {
  try {
    // Merely reading `localStorage` throws in some privacy modes.
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function isQuotaError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
  );
}

// ---- typed slots -----------------------------------------------------------

export interface Envelope {
  v: number;
  d: unknown;
}

/** Turns data saved at version N into data for version N + 1. */
export type Migration = (data: unknown) => unknown;

export interface SlotOptions<T> {
  version: number;
  defaults: () => T;
  /** Keyed by the version they upgrade from. */
  migrations?: Readonly<Record<number, Migration>>;
  /** Shapes untrusted stored data into T, or returns null if it is unusable. */
  parse?: (data: unknown) => T | null;
}

export interface Slot<T> {
  load(): T;
  save(value: T): boolean;
  clear(): void;
  readonly key: string;
}

export function createSlot<T>(store: KeyValueStore, key: string, options: SlotOptions<T>): Slot<T> {
  return {
    key,

    load() {
      const raw = store.get(key);
      if (raw === null) return options.defaults();
      const data = upgrade(raw, options);
      if (data === undefined) return options.defaults();
      const parsed = options.parse ? options.parse(data) : (data as T);
      return parsed ?? options.defaults();
    },

    save(value) {
      const envelope: Envelope = { v: options.version, d: value };
      return store.set(key, JSON.stringify(envelope));
    },

    clear() {
      store.remove(key);
    },
  };
}

/** Reads an envelope and migrates it to the current version; undefined if that is impossible. */
export function upgrade(
  raw: string,
  options: { version: number; migrations?: Readonly<Record<number, Migration>> },
): unknown {
  let envelope: unknown;
  try {
    envelope = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (!isEnvelope(envelope)) return undefined;
  // A newer build wrote this; an older build cannot know what it means.
  if (envelope.v > options.version) return undefined;
  let { v: version, d: data } = envelope;
  while (version < options.version) {
    const migrate = options.migrations?.[version];
    if (!migrate) return undefined;
    data = migrate(data);
    version++;
  }
  return data;
}

function isEnvelope(value: unknown): value is Envelope {
  return (
    typeof value === 'object' &&
    value !== null &&
    'v' in value &&
    'd' in value &&
    Number.isInteger((value as Envelope).v)
  );
}

/** True for a plain object (not null, not an array): the usual first check in a `parse`. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
