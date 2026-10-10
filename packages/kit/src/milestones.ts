/**
 * Milestones: the collection's achievements, defined by each simulation and
 * worth Legacy points (see legacy.ts).
 *
 * There are three kinds, and every simulation writes some of each:
 * - stewardship rewards running the world well;
 * - insight rewards understanding how the model works;
 * - curiosity rewards trying unusual approaches.
 *
 * Milestones only ever unlock. Nothing expires, nothing can be lost, and
 * nothing is for sale; a milestone that disappears from a simulation's list
 * in a later version simply stops counting.
 */
import { createSlot, isRecord, type KeyValueStore } from './save.ts';

export type MilestoneKind = 'stewardship' | 'insight' | 'curiosity';

export interface MilestoneDef {
  id: string;
  kind: MilestoneKind;
  title: string;
  /** What to do, in one sentence. */
  description: string;
  /** Legacy points; 10–40 is the usual range. */
  points: number;
  /** For counted milestones ("see every kind of harvest"): unlocks when progress reaches it. */
  target?: number;
  /** Hidden until unlocked; the Legacy page shows "a secret milestone". */
  secret?: boolean;
}

export interface MilestoneRecord {
  unlockedAt: number | null;
  progress: number;
  /** Points as they stood when unlocked, so the Hall can show a rank before any module loads. */
  points?: number;
}

export interface MilestoneView {
  def: MilestoneDef;
  unlockedAt: number | null;
  progress: number;
}

export interface MilestoneUnlock {
  simId: string;
  def: MilestoneDef;
}

export interface SimMilestones {
  /** Unlocks a milestone; true only the first time. */
  unlock(id: string): boolean;
  /** Raises a counted milestone's progress (never lowers it); true if this unlocked it. */
  progress(id: string, value: number): boolean;
  isUnlocked(id: string): boolean;
  list(): MilestoneView[];
  points(): number;
}

export interface MilestoneBook {
  forSim(simId: string, defs: readonly MilestoneDef[]): SimMilestones;
  /** Points across the collection, counting only milestones that still exist. */
  totalPoints(defsBySim: Readonly<Record<string, readonly MilestoneDef[]>>): number;
  /**
   * Points from the stored records alone. Matches totalPoints unless a
   * simulation has since retired a milestone; the Hall uses it until the
   * simulations' own lists have loaded.
   */
  storedPoints(): number;
  /** Unlocked milestones per simulation, from the stored records alone. */
  unlockedCounts(): Record<string, number>;
  subscribe(listener: (unlock: MilestoneUnlock) => void): () => void;
  forget(): void;
}

type Records = Record<string, Record<string, MilestoneRecord>>;

export const MILESTONES_KEY = 'omy:milestones';

export function createMilestoneBook(
  store: KeyValueStore,
  now: () => number = Date.now,
): MilestoneBook {
  const slot = createSlot<Records>(store, MILESTONES_KEY, {
    version: 1,
    defaults: () => ({}),
    parse: (data) => (isRecord(data) ? (data as Records) : null),
  });
  const listeners = new Set<(unlock: MilestoneUnlock) => void>();

  function recordsFor(simId: string): Record<string, MilestoneRecord> {
    return slot.load()[simId] ?? {};
  }

  function write(simId: string, id: string, record: MilestoneRecord): void {
    const all = slot.load();
    all[simId] = { ...all[simId], [id]: record };
    slot.save(all);
  }

  function pointsFor(simId: string, defs: readonly MilestoneDef[]): number {
    const records = recordsFor(simId);
    return defs.reduce((sum, def) => sum + (records[def.id]?.unlockedAt ? def.points : 0), 0);
  }

  return {
    forSim(simId, defs) {
      const byId = new Map(defs.map((def) => [def.id, def]));

      function unlockNow(def: MilestoneDef, progress: number): boolean {
        write(simId, def.id, { unlockedAt: now(), progress, points: def.points });
        for (const listener of listeners) listener({ simId, def });
        return true;
      }

      return {
        unlock(id) {
          const def = byId.get(id);
          if (!def || recordsFor(simId)[id]?.unlockedAt) return false;
          return unlockNow(def, def.target ?? 1);
        },

        progress(id, value) {
          const def = byId.get(id);
          if (!def) return false;
          const record = recordsFor(simId)[id] ?? { unlockedAt: null, progress: 0 };
          if (record.unlockedAt || value <= record.progress) return false;
          if (def.target !== undefined && value >= def.target) return unlockNow(def, value);
          write(simId, id, { unlockedAt: null, progress: value });
          return false;
        },

        isUnlocked: (id) => Boolean(recordsFor(simId)[id]?.unlockedAt),

        list() {
          const records = recordsFor(simId);
          return defs.map((def) => ({
            def,
            unlockedAt: records[def.id]?.unlockedAt ?? null,
            progress: records[def.id]?.progress ?? 0,
          }));
        },

        points: () => pointsFor(simId, defs),
      };
    },

    totalPoints(defsBySim) {
      return Object.entries(defsBySim).reduce(
        (sum, [simId, defs]) => sum + pointsFor(simId, defs),
        0,
      );
    },

    storedPoints() {
      return Object.values(slot.load()).reduce(
        (sum, records) =>
          sum +
          Object.values(records).reduce(
            (inner, record) => inner + (record.unlockedAt ? (record.points ?? 0) : 0),
            0,
          ),
        0,
      );
    },

    unlockedCounts() {
      return Object.fromEntries(
        Object.entries(slot.load()).map(([simId, records]) => [
          simId,
          Object.values(records).filter((record) => record.unlockedAt).length,
        ]),
      );
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
