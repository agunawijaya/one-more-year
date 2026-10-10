/**
 * Runs in progress: autosaved after every resolved turn, several per
 * simulation, resumable at any time from the Hall's "Continue" list.
 *
 * Each run lives under its own key (omy:run:<simId>:<runId>) so that saving
 * year 31 of a long reign rewrites one small record, not every run at once.
 * A run carries the simulation's save version; when a newer build changes
 * the shape of its state, the simulation supplies migrations, and a run
 * that cannot be migrated is set aside (listed as unreadable) rather than
 * crashing the Hall.
 *
 * Finished runs leave this store: their history lives on as a chronicle.
 */
import { isRecord, upgrade, type KeyValueStore, type Migration } from './save.ts';
import type { EngineSnapshot, Signals, WorldSetup } from './turns.ts';

export type RunStatus = 'in-progress' | 'finished';

/** Where a run's seed came from, shown on its card and kept in its chronicle. */
export interface DailyTag {
  day: string;
  number: number;
}

/** A replay remembers the run it replays, so charts can draw that run as a ghost. */
export interface GhostOf {
  chronicleId: string;
  /** The earlier run's signal series by id, opening value first. */
  series: Readonly<Record<string, readonly number[]>>;
  verdictLabel: string;
}

export interface RunRecord<State = unknown, Plan = unknown> {
  id: string;
  simId: string;
  setup: WorldSetup;
  daily: DailyTag | null;
  replayOf: GhostOf | null;
  status: RunStatus;
  createdAt: number;
  updatedAt: number;
  /** "Year 6 of 10", for the Continue list. */
  turnLabel: string;
  /** The latest signals of the first seat, for the Continue card. */
  signals: Signals;
  /** The primary signal so far, for the Continue card's sparkline. */
  spark: number[];
  /** Milliseconds of play so far, kept across sessions. */
  playedMs: number;
  /**
   * False until a turn is played or a plan is edited. An untouched run was
   * only a look: it is never listed, and the next run of the same world
   * clears it. (Older saves have no flag and count as touched.)
   */
  touched?: boolean;
  snapshot: EngineSnapshot<State, Plan>;
}

export interface RunStoreOptions {
  /** The simulation's current save version (bump it whenever State or Plan changes shape). */
  saveVersion: number;
  /** Keyed by the version they upgrade from; each receives and returns a whole RunRecord. */
  migrations?: Readonly<Record<number, Migration>>;
}

export interface RunStore<State = unknown, Plan = unknown> {
  readonly simId: string;
  /** Runs in progress, most recently played first. */
  list(): RunRecord<State, Plan>[];
  get(id: string): RunRecord<State, Plan> | null;
  /** Saves (creates or replaces) a run; returns false if it is only kept in memory. */
  save(run: RunRecord<State, Plan>): boolean;
  /** Removes a run the player gave up on. Ask first: this cannot be undone. */
  abandon(id: string): void;
  /** Removes a run that has become a chronicle. */
  finish(id: string): void;
  /** Removes every run of this simulation that was only looked at. */
  clearUntouched(): void;
  /** Ids of stored runs this build cannot read (newer build, or no migration). */
  unreadable(): string[];
}

export const RUN_PREFIX = 'omy:run:';

export function runKey(simId: string, runId: string): string {
  return `${RUN_PREFIX}${simId}:${runId}`;
}

export function createRunStore<State = unknown, Plan = unknown>(
  store: KeyValueStore,
  simId: string,
  options: RunStoreOptions,
): RunStore<State, Plan> {
  const prefix = `${RUN_PREFIX}${simId}:`;

  function read(key: string): RunRecord<State, Plan> | null {
    const raw = store.get(key);
    if (raw === null) return null;
    const data = upgrade(raw, { version: options.saveVersion, ...withMigrations(options) });
    return isRunRecord(data) ? (data as RunRecord<State, Plan>) : null;
  }

  return {
    simId,

    list() {
      return store
        .keys(prefix)
        .map(read)
        .filter(
          (run): run is RunRecord<State, Plan> =>
            run?.status === 'in-progress' && run.touched !== false,
        )
        .sort((a, b) => b.updatedAt - a.updatedAt);
    },

    get: (id) => read(runKey(simId, id)),

    save(run) {
      return store.set(runKey(simId, run.id), JSON.stringify({ v: options.saveVersion, d: run }));
    },

    abandon(id) {
      store.remove(runKey(simId, id));
    },

    finish(id) {
      store.remove(runKey(simId, id));
    },

    clearUntouched() {
      for (const key of store.keys(prefix)) {
        if (read(key)?.touched === false) store.remove(key);
      }
    },

    unreadable() {
      return store
        .keys(prefix)
        .filter((key) => read(key) === null)
        .map((key) => key.slice(prefix.length));
    },
  };
}

function withMigrations(options: RunStoreOptions): {
  migrations?: Readonly<Record<number, Migration>>;
} {
  return options.migrations ? { migrations: options.migrations } : {};
}

function isRunRecord(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.simId === 'string' &&
    isRecord(value.setup) &&
    isRecord(value.snapshot) &&
    typeof value.updatedAt === 'number'
  );
}

/** A short unique id; runs never need to be deterministic, only distinct. */
export function newRunId(now = Date.now()): string {
  const random = Math.floor(Math.random() * 36 ** 4)
    .toString(36)
    .padStart(4, '0');
  return `${now.toString(36)}${random}`;
}

/** What the Hall's Continue list shows about a run; readable without the simulation's code. */
export interface RunSummary {
  id: string;
  simId: string;
  setup: WorldSetup;
  turnLabel: string;
  signals: Signals;
  spark: number[];
  createdAt: number;
  updatedAt: number;
  daily: DailyTag | null;
  replayOf: { chronicleId: string; verdictLabel: string } | null;
}

/**
 * Every run in progress across the collection, most recent first. Only the
 * kit-owned summary fields are read, and those keep their shape across a
 * simulation's save versions, so this works before any simulation module has
 * loaded (and for runs whose state needs a migration first).
 */
export function listRunSummaries(store: KeyValueStore): RunSummary[] {
  const summaries: RunSummary[] = [];
  for (const key of store.keys(RUN_PREFIX)) {
    const raw = store.get(key);
    if (raw === null) continue;
    let envelope: unknown;
    try {
      envelope = JSON.parse(raw);
    } catch {
      continue;
    }
    const run = isRecord(envelope) ? envelope.d : null;
    if (!isRunRecord(run)) continue;
    if ((run as RunRecord).status !== 'in-progress' || (run as RunRecord).touched === false)
      continue;
    const record = run as RunRecord;
    summaries.push({
      id: record.id,
      simId: record.simId,
      setup: record.setup,
      turnLabel: record.turnLabel,
      signals: record.signals,
      spark: record.spark,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      daily: record.daily,
      replayOf: record.replayOf
        ? { chronicleId: record.replayOf.chronicleId, verdictLabel: record.replayOf.verdictLabel }
        : null,
    });
  }
  return summaries.sort((a, b) => b.updatedAt - a.updatedAt);
}

/** The ids of every simulation that has at least one stored run (for the Hall's Continue list). */
export function simsWithRuns(store: KeyValueStore): string[] {
  const sims = new Set<string>();
  for (const key of store.keys(RUN_PREFIX)) {
    const simId = key.slice(RUN_PREFIX.length).split(':')[0];
    if (simId) sims.add(simId);
  }
  return [...sims].sort();
}

/**
 * Saves when the page is being hidden or closed. `pagehide` is the one event
 * browsers promise to fire when a tab goes away (including on mobile and
 * when the page enters the back/forward cache); a hidden tab may never come
 * back, so visibility changes save too.
 */
export function autosaveOnHide(save: () => void, target: Window = window): () => void {
  const onHide = (): void => save();
  const onVisibility = (): void => {
    if (target.document.visibilityState === 'hidden') save();
  };
  target.addEventListener('pagehide', onHide);
  target.document.addEventListener('visibilitychange', onVisibility);
  return () => {
    target.removeEventListener('pagehide', onHide);
    target.document.removeEventListener('visibilitychange', onVisibility);
  };
}
