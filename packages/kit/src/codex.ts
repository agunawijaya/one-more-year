/**
 * The Codex: the phenomena a simulation's model can produce (a plague, a
 * drought, a wave of newcomers), collected by playing.
 *
 * The first time a run produces a phenomenon it is discovered, and the turn
 * report shows a small "New in your Codex" card. After it has been seen a
 * few times its entry reveals how the model actually computes it, in plain
 * words and honest numbers. The old programs were black boxes; the Codex
 * turns each one into a glass box, one discovery at a time.
 */
import { createSlot, isRecord, type KeyValueStore } from './save.ts';

export interface CodexEntryDef {
  id: string;
  title: string;
  /** What it is, in a sentence or two. */
  summary: string;
  /** When it tends to happen. */
  tendency: string;
  /** How the model computes it, with real numbers ("roughly one year in five"). */
  mechanism: string;
  /** Shown on the silhouette before discovery. */
  hint: string;
  /** Sightings before the mechanism is revealed (default 3). */
  revealAfter?: number;
  /** SVG markup for a 48×48 viewBox, drawn with currentColor so every theme can ink it. */
  art: string;
}

export interface CodexRecord {
  seen: number;
  firstSeenAt: number;
  /** The run in which it was first seen, until that run becomes a chronicle. */
  firstRunId: string | null;
  firstChronicleId: string | null;
}

export interface CodexEntryView {
  def: CodexEntryDef;
  discovered: boolean;
  seen: number;
  mechanismRevealed: boolean;
  firstSeenAt: number | null;
  firstChronicleId: string | null;
}

export interface Discovery {
  simId: string;
  def: CodexEntryDef;
  isNew: boolean;
  seen: number;
  /** True on the sighting that reveals the mechanism. */
  revealedNow: boolean;
}

export interface SimCodex {
  /** Records a sighting; returns what changed, or null for an unknown id. */
  sight(id: string, runId: string): Discovery | null;
  entries(): CodexEntryView[];
  progress(): { discovered: number; total: number };
  /** When a run becomes a chronicle, its first sightings point at that chronicle. */
  linkChronicle(runId: string, chronicleId: string): void;
}

export interface CodexBook {
  forSim(simId: string, defs: readonly CodexEntryDef[]): SimCodex;
  subscribe(listener: (discovery: Discovery) => void): () => void;
  forget(): void;
}

type Records = Record<string, Record<string, CodexRecord>>;

export const CODEX_KEY = 'omy:codex';
export const DEFAULT_REVEAL_AFTER = 3;

export function createCodexBook(store: KeyValueStore, now: () => number = Date.now): CodexBook {
  const slot = createSlot<Records>(store, CODEX_KEY, {
    version: 1,
    defaults: () => ({}),
    parse: (data) => (isRecord(data) ? (data as Records) : null),
  });
  const listeners = new Set<(discovery: Discovery) => void>();

  return {
    forSim(simId, defs) {
      const byId = new Map(defs.map((def) => [def.id, def]));
      const recordsFor = (): Record<string, CodexRecord> => slot.load()[simId] ?? {};
      const save = (records: Record<string, CodexRecord>): void => {
        const all = slot.load();
        all[simId] = records;
        slot.save(all);
      };

      return {
        sight(id, runId) {
          const def = byId.get(id);
          if (!def) return null;
          const records = recordsFor();
          const previous = records[id];
          const seen = (previous?.seen ?? 0) + 1;
          records[id] = previous
            ? { ...previous, seen }
            : { seen, firstSeenAt: now(), firstRunId: runId, firstChronicleId: null };
          save(records);
          const discovery: Discovery = {
            simId,
            def,
            isNew: !previous,
            seen,
            revealedNow: seen === (def.revealAfter ?? DEFAULT_REVEAL_AFTER),
          };
          for (const listener of listeners) listener(discovery);
          return discovery;
        },

        entries() {
          const records = recordsFor();
          return defs.map((def) => {
            const record = records[def.id];
            const seen = record?.seen ?? 0;
            return {
              def,
              discovered: seen > 0,
              seen,
              mechanismRevealed: seen >= (def.revealAfter ?? DEFAULT_REVEAL_AFTER),
              firstSeenAt: record?.firstSeenAt ?? null,
              firstChronicleId: record?.firstChronicleId ?? null,
            };
          });
        },

        progress() {
          const records = recordsFor();
          return {
            discovered: defs.filter((def) => (records[def.id]?.seen ?? 0) > 0).length,
            total: defs.length,
          };
        },

        linkChronicle(runId, chronicleId) {
          const records = recordsFor();
          let changed = false;
          for (const record of Object.values(records)) {
            if (record.firstRunId === runId && record.firstChronicleId === null) {
              record.firstChronicleId = chronicleId;
              changed = true;
            }
          }
          if (changed) save(records);
        },
      };
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    forget() {
      slot.clear();
    },
  };
}
