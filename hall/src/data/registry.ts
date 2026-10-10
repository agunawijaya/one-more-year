/**
 * The registry: every simulation the Hall knows about, in catalog order.
 *
 * Entries come from two places. Built simulations are discovered from
 * games/<id>/manifest.ts (see discovered.ts); planned ones are the
 * placeholders in coming-soon.ts. A discovered manifest replaces the
 * placeholder with the same id, so building a simulation never means
 * editing the Hall. Manifests are checked as they are registered, and
 * problems are reported instead of breaking the page.
 */
import type { SimManifest, SimModule } from '@one-more-year/kit';

export interface DiscoveredSim {
  manifest: SimManifest;
  /** Loads the simulation's module (a lazy chunk). */
  load: () => Promise<SimModule>;
}

export interface SimEntry {
  manifest: SimManifest;
  /** Null while the simulation is only planned. */
  load: (() => Promise<SimModule>) | null;
}

export interface Registry {
  readonly entries: readonly SimEntry[];
  get(id: string): SimEntry | undefined;
  playable(): SimEntry[];
  readonly problems: readonly string[];
}

export interface RegistryInput {
  placeholders: readonly SimManifest[];
  discovered: readonly DiscoveredSim[];
  /** Development builds may play simulations whose manifest still says 'coming-soon'. */
  allowUnreleased?: boolean;
}

const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

export function createRegistry(input: RegistryInput): Registry {
  const problems: string[] = [];
  const byId = new Map<string, SimEntry>();

  for (const manifest of input.placeholders) {
    problems.push(...checkManifest(manifest));
    byId.set(manifest.id, { manifest, load: null });
  }
  for (const sim of input.discovered) {
    problems.push(...checkManifest(sim.manifest));
    const playable = sim.manifest.status === 'playable' || input.allowUnreleased === true;
    byId.set(sim.manifest.id, { manifest: sim.manifest, load: playable ? sim.load : null });
  }

  // Playable worlds first, then the planned ones, each group in the order given.
  const entries = [...byId.values()].sort(
    (a, b) => Number(b.load !== null) - Number(a.load !== null),
  );

  return {
    entries,
    get: (id) => byId.get(id),
    playable: () => entries.filter((entry) => entry.load !== null),
    problems,
  };
}

/** Everything a theme relies on; returns readable problems, empty when the manifest is sound. */
export function checkManifest(manifest: SimManifest): string[] {
  const problems: string[] = [];
  const where = `manifest "${manifest.id}"`;
  if (!KEBAB.test(manifest.id)) problems.push(`${where}: id must be kebab-case`);
  if (!manifest.title.trim()) problems.push(`${where}: title is empty`);
  if (!manifest.emblem.trim().startsWith('M'))
    problems.push(`${where}: emblem must be SVG path data`);
  const [fewest, most] = manifest.typicalTurns;
  if (fewest < 1 || most < fewest) problems.push(`${where}: typicalTurns must be [min, max]`);
  const [shortest, longest] = manifest.sessionMinutes;
  if (shortest < 1 || longest < shortest)
    problems.push(`${where}: sessionMinutes must be [min, max]`);
  if (manifest.signals.length < 2 || manifest.signals.length > 4) {
    problems.push(`${where}: declare 2 to 4 signals`);
  }
  if (
    manifest.primarySignal !== undefined &&
    !manifest.signals.some((signal) => signal.id === manifest.primarySignal)
  ) {
    problems.push(`${where}: primarySignal is not one of the signals`);
  }
  if (manifest.status === 'playable' && manifest.scenarios.length === 0) {
    problems.push(`${where}: a playable simulation needs at least one scenario`);
  }
  for (const colour of [manifest.accent.light, manifest.accent.dark]) {
    if (!/^#[0-9a-f]{6}$/i.test(colour)) problems.push(`${where}: accent colours must be #rrggbb`);
  }
  return problems;
}
