/**
 * Play statistics per simulation, for the Legacy page and the detail view:
 * runs begun and finished, turns played, time played, when it was last
 * played and the best verdict so far. Counting only; nothing here is ever
 * shown as a goal or a streak to keep up.
 */
import { createSlot, isRecord, type KeyValueStore } from './save.ts';
import type { Verdict } from './turns.ts';

export interface SimStats {
  runsBegun: number;
  runsFinished: number;
  turnsPlayed: number;
  msPlayed: number;
  lastPlayed: number | null;
  bestVerdict: Verdict | null;
}

export interface SimStatsRecorder {
  runBegun(): void;
  turnPlayed(): void;
  runFinished(verdict: Verdict): void;
  addTime(milliseconds: number): void;
  get(): SimStats;
}

export interface StatsBook {
  forSim(simId: string): SimStatsRecorder;
  all(): Record<string, SimStats>;
  forget(): void;
}

export const STATS_KEY = 'omy:stats';

export function emptyStats(): SimStats {
  return {
    runsBegun: 0,
    runsFinished: 0,
    turnsPlayed: 0,
    msPlayed: 0,
    lastPlayed: null,
    bestVerdict: null,
  };
}

export function createStatsBook(store: KeyValueStore, now: () => number = Date.now): StatsBook {
  const slot = createSlot<Record<string, SimStats>>(store, STATS_KEY, {
    version: 1,
    defaults: () => ({}),
    parse: (data) => (isRecord(data) ? (data as Record<string, SimStats>) : null),
  });

  return {
    forSim(simId) {
      const change = (apply: (stats: SimStats) => SimStats): void => {
        const all = slot.load();
        all[simId] = { ...apply({ ...emptyStats(), ...all[simId] }), lastPlayed: now() };
        slot.save(all);
      };
      return {
        runBegun: () => change((stats) => ({ ...stats, runsBegun: stats.runsBegun + 1 })),
        turnPlayed: () => change((stats) => ({ ...stats, turnsPlayed: stats.turnsPlayed + 1 })),
        runFinished: (verdict) =>
          change((stats) => ({
            ...stats,
            runsFinished: stats.runsFinished + 1,
            bestVerdict:
              stats.bestVerdict && stats.bestVerdict.tier >= verdict.tier
                ? stats.bestVerdict
                : verdict,
          })),
        addTime: (milliseconds) =>
          change((stats) => ({ ...stats, msPlayed: stats.msPlayed + Math.max(0, milliseconds) })),
        get: () => ({ ...emptyStats(), ...slot.load()[simId] }),
      };
    },

    all: () => slot.load(),

    forget() {
      slot.clear();
    },
  };
}
