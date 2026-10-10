/**
 * The Hall model: everything the themes show, as one snapshot.
 *
 * Themes never read storage or the registry themselves. They receive a
 * HallSnapshot and actions, so every theme shows the same truth and adding
 * a simulation never touches theme code. The snapshot is rebuilt whenever
 * something changes (a run saved, a chronicle written, a module loaded) and
 * subscribers redraw.
 *
 * Simulation modules load lazily; until one has, the facts that live in it
 * (how many codex entries and milestones exist) are null and themes show
 * what they can without them.
 */
import {
  dailyNumber,
  dailySeed,
  listRunSummaries,
  rankFor,
  type ChronicleEntry,
  type DailyResult,
  type RankStanding,
  type RunSummary,
  type SimManifest,
  type SimModule,
  type SimStats,
  type Streak,
  emptyStats,
} from '@one-more-year/kit';
import type { HallServices } from '../app/services.ts';
import type { ThemeId } from '../themes/theme-ids.ts';
import { unlockedCosmetics, type Cosmetic } from './cosmetics.ts';
import { bestChronicle } from './library.ts';
import type { Registry, SimEntry } from './registry.ts';

export interface DailyCard {
  simId: string;
  title: string;
  number: number;
  day: string;
  seed: number;
  /** Begun today (keeps the streak). */
  played: boolean;
  /** The first finished attempt today, if any. */
  result: DailyResult | null;
}

export interface ContinueCard extends RunSummary {
  manifest: SimManifest;
}

export interface HallEntry {
  manifest: SimManifest;
  playable: boolean;
  module: SimModule | null;
  runs: RunSummary[];
  chronicleCount: number;
  best: ChronicleEntry | null;
  latest: ChronicleEntry | null;
  stats: SimStats;
  codex: { discovered: number; total: number | null };
  milestones: { unlocked: number; total: number | null };
  daily: DailyCard | null;
}

export interface LegacyView {
  standing: RankStanding;
  unlocked: Cosmetic[];
  /** The cosmetic the given theme wears now. */
  active: (theme: ThemeId) => Cosmetic;
}

export interface HallSnapshot {
  today: string;
  dailyNumber: number;
  entries: HallEntry[];
  continueRuns: ContinueCard[];
  daily: DailyCard[];
  streak: Streak;
  legacy: LegacyView;
  chronicles: ChronicleEntry[];
  storageDegraded: boolean;
}

export interface HallModel {
  snapshot(): HallSnapshot;
  refresh(): void;
  subscribe(listener: (snapshot: HallSnapshot) => void): () => void;
  /** Records a loaded module so its facts join the snapshot. */
  moduleLoaded(simId: string, module: SimModule): void;
  module(simId: string): SimModule | null;
  /** Loads a simulation's module once; later calls share the same promise. */
  loadModule(simId: string): Promise<SimModule | null>;
  readonly registry: Registry;
}

export function createHallModel(registry: Registry, services: HallServices): HallModel {
  const modules = new Map<string, SimModule>();
  const loading = new Map<string, Promise<SimModule | null>>();
  const listeners = new Set<(snapshot: HallSnapshot) => void>();
  let current = build();

  function dailyFor(entry: SimEntry, today: string): DailyCard | null {
    const { manifest } = entry;
    if (!entry.load || !manifest.hasDailyScenario) return null;
    return {
      simId: manifest.id,
      title: manifest.title,
      number: dailyNumber(today),
      day: today,
      seed: dailySeed(manifest.id, today),
      played: services.daily.played(manifest.id, today),
      result: services.daily.result(manifest.id, today),
    };
  }

  function build(): HallSnapshot {
    const today = services.today();
    const runs = listRunSummaries(services.store);
    const chronicles = services.library.all();
    const allStats = services.stats.all();
    const unlockedCounts = services.milestones.unlockedCounts();

    const entries: HallEntry[] = registry.entries.map((entry) => {
      const { manifest } = entry;
      const module = modules.get(manifest.id) ?? null;
      const own = chronicles.filter((chronicle) => chronicle.simId === manifest.id);
      const codex = module
        ? services.codex.forSim(manifest.id, module.codex).progress()
        : { discovered: 0, total: null };
      return {
        manifest,
        playable: entry.load !== null,
        module,
        runs: runs.filter((run) => run.simId === manifest.id),
        chronicleCount: own.length,
        best: bestChronicle(own, manifest.id),
        latest: own[0] ?? null,
        stats: { ...emptyStats(), ...allStats[manifest.id] },
        codex,
        milestones: {
          unlocked: unlockedCounts[manifest.id] ?? 0,
          total: module ? module.milestones.length : null,
        },
        daily: dailyFor(entry, today),
      };
    });

    const points = pointsNow();
    const manifests = new Map(registry.entries.map((entry) => [entry.manifest.id, entry.manifest]));
    return {
      today,
      dailyNumber: dailyNumber(today),
      entries,
      continueRuns: runs.flatMap((run) => {
        const manifest = manifests.get(run.simId);
        return manifest && registry.get(run.simId)?.load ? [{ ...run, manifest }] : [];
      }),
      daily: entries.flatMap((entry) => (entry.daily ? [entry.daily] : [])),
      streak: services.daily.streak(today),
      legacy: {
        standing: rankFor(points),
        unlocked: unlockedCosmetics(points),
        active: (theme) => services.cosmetics.active(theme, points),
      },
      chronicles,
      storageDegraded: services.store.degraded,
    };
  }

  /** Exact points once every playable module is known; the stored tally until then. */
  function pointsNow(): number {
    const playable = registry.playable();
    if (playable.length > 0 && playable.every((entry) => modules.has(entry.manifest.id))) {
      return services.milestones.totalPoints(
        Object.fromEntries([...modules].map(([id, module]) => [id, module.milestones])),
      );
    }
    return services.milestones.storedPoints();
  }

  function publish(): void {
    current = build();
    for (const listener of listeners) listener(current);
  }

  const model: HallModel = {
    registry,
    snapshot: () => current,
    refresh: publish,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    moduleLoaded(simId, module) {
      if (modules.get(simId) === module) return;
      modules.set(simId, module);
      publish();
    },
    module: (simId) => modules.get(simId) ?? null,
    loadModule(simId) {
      const known = modules.get(simId);
      if (known) return Promise.resolve(known);
      const pending = loading.get(simId);
      if (pending) return pending;
      const load = registry.get(simId)?.load;
      if (!load) return Promise.resolve(null);
      const promise = load().then(
        (module) => {
          model.moduleLoaded(simId, module);
          return module;
        },
        (error: unknown) => {
          loading.delete(simId);
          console.error(`Could not load ${simId}`, error);
          return null;
        },
      );
      loading.set(simId, promise);
      return promise;
    },
  };

  services.store.onDegraded(() => publish());
  return model;
}
