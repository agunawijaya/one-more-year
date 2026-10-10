/**
 * The Library: every chronicle the player has written, kept until "Forget
 * my data". Each chronicle lives under its own key so that adding the
 * hundredth one writes one small record; listing reads them all, which is
 * cheap at the sizes a person can produce by playing.
 *
 * Filtering and sorting are plain functions over summaries, shared by the
 * Library page, the detail views ("your chronicles for this world") and the
 * themes ("your best chronicle's epithet").
 */
import {
  parseChronicle,
  serializeChronicle,
  type ChronicleEntry,
  type KeyValueStore,
} from '@one-more-year/kit';

export const CHRONICLE_PREFIX = 'omy:chronicle:';

export interface Library {
  add(entry: ChronicleEntry): void;
  get(id: string): ChronicleEntry | null;
  /** Every chronicle, newest first. */
  all(): ChronicleEntry[];
  remove(id: string): void;
  forget(): void;
}

export function createLibrary(store: KeyValueStore): Library {
  const read = (key: string): ChronicleEntry | null => {
    const raw = store.get(key);
    return raw === null ? null : parseChronicle(raw);
  };
  return {
    add(entry) {
      store.set(`${CHRONICLE_PREFIX}${entry.id}`, serializeChronicle(entry));
    },
    get: (id) => read(`${CHRONICLE_PREFIX}${id}`),
    all: () =>
      store
        .keys(CHRONICLE_PREFIX)
        .map(read)
        .filter((entry): entry is ChronicleEntry => entry !== null)
        .sort((a, b) => b.finishedAt - a.finishedAt),
    remove(id) {
      store.remove(`${CHRONICLE_PREFIX}${id}`);
    },
    forget() {
      for (const key of store.keys(CHRONICLE_PREFIX)) store.remove(key);
    },
  };
}

export type LibrarySort = 'date' | 'verdict';

export interface LibraryFilter {
  simId?: string | null;
  /** Minimum verdict tier (1–5). */
  verdictTier?: number | null;
  scenario?: string | null;
  sort?: LibrarySort;
}

export function filterChronicles(
  entries: readonly ChronicleEntry[],
  filter: LibraryFilter = {},
): ChronicleEntry[] {
  const kept = entries.filter(
    (entry) =>
      (!filter.simId || entry.simId === filter.simId) &&
      (!filter.verdictTier || entry.outcome.verdict.tier >= filter.verdictTier) &&
      (!filter.scenario || entry.setup.scenario === filter.scenario),
  );
  const byDate = (a: ChronicleEntry, b: ChronicleEntry): number => b.finishedAt - a.finishedAt;
  return kept.sort(
    filter.sort === 'verdict'
      ? (a, b) => b.outcome.verdict.tier - a.outcome.verdict.tier || byDate(a, b)
      : byDate,
  );
}

/** The best chronicle of a simulation: highest verdict, most recent on ties. */
export function bestChronicle(
  entries: readonly ChronicleEntry[],
  simId: string,
): ChronicleEntry | null {
  return filterChronicles(entries, { simId, sort: 'verdict' })[0] ?? null;
}
